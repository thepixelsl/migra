import { Buffer } from "node:buffer";
import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import worker from "../src/worker.js";
import { createAssetBinding } from "./bunny-assets.mjs";
import { createBunnyDatabase } from "./bunny-database.mjs";
import { createContactMailer } from "./bunny-mailer.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ASSET_DIRECTORY = path.resolve(MODULE_DIRECTORY, "../dist");
const MAX_REQUEST_BODY_BYTES = 8 * 1024 * 1024;
const HSTS_HEADER_VALUE = "max-age=31536000; includeSubDomains; preload";
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://connect.facebook.net https://www.facebook.com",
  "upgrade-insecure-requests",
].join("; ");

function firstHeaderValue(value) {
  return String(value || "").split(",", 1)[0].trim();
}

function safeEqual(actual, expected) {
  const actualHash = createHash("sha256").update(String(actual)).digest();
  const expectedHash = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(actualHash, expectedHash);
}

function adminPath(pathname) {
  return pathname === "/admin-termine"
    || pathname.startsWith("/admin-termine/")
    || pathname === "/api/admin/availability";
}

function authorizedAdmin(request, env) {
  const expectedUsername = String(env.ADMIN_USERNAME || "");
  const expectedPassword = String(env.ADMIN_PASSWORD || "");
  if (!expectedUsername || !expectedPassword) return { configured: false, authorized: false };

  const authorization = request.headers.get("authorization") || "";
  if (!authorization.startsWith("Basic ")) return { configured: true, authorized: false };

  try {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return { configured: true, authorized: false };
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return {
      configured: true,
      authorized: safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword),
    };
  } catch {
    return { configured: true, authorized: false };
  }
}

function adminDenied(configured) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  if (configured) headers.set("WWW-Authenticate", 'Basic realm="Artbild Dev", charset="UTF-8"');

  return new Response(
    configured ? "Anmeldung erforderlich." : "Admin-Zugang ist noch nicht konfiguriert.",
    { status: configured ? 401 : 503, headers },
  );
}

async function readRequestBody(request) {
  const contentLength = Number.parseInt(request.headers["content-length"] || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    throw new RangeError("request_body_too_large");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_REQUEST_BODY_BYTES) throw new RangeError("request_body_too_large");
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

async function toWebRequest(request, env) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  // Never trust a client-supplied Cloudflare Access identity on Bunny.
  headers.delete("cf-access-authenticated-user-email");
  headers.delete("cf-connecting-ip");
  const realIp = firstHeaderValue(headers.get("x-real-ip"));
  if (realIp) headers.set("cf-connecting-ip", realIp);

  const publicProtocol = firstHeaderValue(headers.get("x-forwarded-proto"))
    || String(env.BUNNY_PUBLIC_SCHEME || "https");
  const publicHost = firstHeaderValue(headers.get("x-forwarded-host"))
    || firstHeaderValue(headers.get("host"))
    || "localhost";
  headers.set("x-forwarded-proto", publicProtocol);

  const url = new URL(request.url || "/", `${publicProtocol}://${publicHost}`);
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await readRequestBody(request);

  return new Request(url, {
    method: request.method,
    headers,
    body,
  });
}

function withBunnyHeaders(response, env, pathname = "") {
  const headers = new Headers(response.headers);
  headers.delete("Server");
  headers.set("Strict-Transport-Security", HSTS_HEADER_VALUE);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  if (env.DEV_NOINDEX !== "false") {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin-termine")) {
    headers.set("Cache-Control", pathname.startsWith("/admin-termine") ? "private, no-store" : "no-store");
  }
  if (pathname.startsWith("/admin-termine") || pathname.startsWith("/api/admin/")) {
    headers.append("Vary", "Authorization");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function writeNodeResponse(nodeResponse, response) {
  nodeResponse.statusCode = response.status;
  nodeResponse.statusMessage = response.statusText;
  for (const [name, value] of response.headers) nodeResponse.setHeader(name, value);

  if (!response.body) {
    nodeResponse.end();
    return;
  }

  await new Promise((resolve, reject) => {
    const body = Readable.fromWeb(response.body);
    body.once("error", reject);
    nodeResponse.once("error", reject);
    nodeResponse.once("finish", resolve);
    body.pipe(nodeResponse);
  });
}

export async function createBunnyRuntime(options = {}) {
  const env = { ...process.env, ...(options.env || {}) };
  const database = options.database || await createBunnyDatabase(env);
  const contactMailer = options.contactMailer ?? createContactMailer(env);
  const assetDirectory = options.assetDirectory || env.ASSET_DIRECTORY || DEFAULT_ASSET_DIRECTORY;

  const workerEnv = {
    ...env,
    ASSETS: createAssetBinding(assetDirectory),
    AVAILABILITY_KV: database.kv,
    DB: database.d1,
    CONTACT_DB: database.d1,
    ...(contactMailer ? { CONTACT_MAILER: contactMailer } : {}),
  };

  const server = createServer(async (nodeRequest, nodeResponse) => {
    try {
      let request = await toWebRequest(nodeRequest, env);
      const url = new URL(request.url);

      if (url.pathname === "/healthz" || url.pathname === "/readyz") {
        let databaseReady = true;
        if (url.pathname === "/readyz") {
          try {
            await database.ready?.();
          } catch {
            databaseReady = false;
          }
        }
        const health = new Response(JSON.stringify({
          ok: databaseReady,
          database: database.persistent ? "bunny" : "ephemeral",
        }), {
          status: databaseReady ? 200 : 503,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "application/json; charset=utf-8",
          },
        });
        await writeNodeResponse(nodeResponse, withBunnyHeaders(health, env, url.pathname));
        return;
      }

      if (adminPath(url.pathname)) {
        const access = authorizedAdmin(request, env);
        if (!access.authorized) {
          await writeNodeResponse(
            nodeResponse,
            withBunnyHeaders(adminDenied(access.configured), env, url.pathname),
          );
          return;
        }

        const origin = request.headers.get("origin");
        if (request.method === "POST" && origin && origin !== url.origin) {
          await writeNodeResponse(nodeResponse, withBunnyHeaders(new Response("Forbidden", {
            status: 403,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }), env, url.pathname));
          return;
        }

        const headers = new Headers(request.headers);
        headers.set(
          "Cf-Access-Authenticated-User-Email",
          String(env.ADMIN_EMAIL || env.CONTACT_TO || "info@artbild-fotografie.de"),
        );
        request = new Request(request, { headers });
      }

      const response = await worker.fetch(request, workerEnv, {
        waitUntil(promise) {
          Promise.resolve(promise).catch((error) => console.error("Background task failed", error));
        },
        passThroughOnException() {},
      });
      await writeNodeResponse(nodeResponse, withBunnyHeaders(response, env, url.pathname));
    } catch (error) {
      const status = error instanceof RangeError ? 413 : 500;
      if (status === 500) console.error("Unhandled Bunny request error", error);
      await writeNodeResponse(nodeResponse, withBunnyHeaders(new Response(
        status === 413 ? "Die Anfrage ist zu groß." : "Internal Server Error",
        {
          status,
          headers: {
            "Cache-Control": "no-store",
            "Content-Type": "text/plain; charset=utf-8",
          },
        },
      ), env, nodeRequest.url || ""));
    }
  });

  return {
    database,
    server,
    async listen({ host = env.HOST || "0.0.0.0", port = Number(env.PORT || 8080) } = {}) {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async close() {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      database.client?.close?.();
    },
  };
}

async function main() {
  const runtime = await createBunnyRuntime();
  const address = await runtime.listen();
  const host = typeof address === "object" && address ? address.address : process.env.HOST || "0.0.0.0";
  const port = typeof address === "object" && address ? address.port : process.env.PORT || 8080;
  console.log(`Artbild Bunny runtime listening on ${host}:${port}`);
  if (!runtime.database.persistent) {
    console.warn("BUNNY_DATABASE_URL is not set; availability data is ephemeral.");
  }

  const shutdown = async () => {
    try {
      await runtime.close();
      process.exit(0);
    } catch (error) {
      console.error("Bunny runtime shutdown failed", error);
      process.exit(1);
    }
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

const entryFile = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (entryFile === import.meta.url) {
  main().catch((error) => {
    console.error("Bunny runtime failed to start", error);
    process.exit(1);
  });
}
