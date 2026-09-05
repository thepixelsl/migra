import { Buffer } from "node:buffer";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import { AGENT_AVAILABILITY_MAX_BODY_BYTES } from "../functions/_agent-availability-contract.js";
import worker from "../src/worker.js";
import {
  adminAuthenticationRetryAfterSeconds,
  clearAdminAuthenticationAttempts,
  reserveAdminAuthenticationAttempt,
} from "./admin-auth-rate-limit.mjs";
import { createAssetBinding } from "./bunny-assets.mjs";
import { createBunnyDatabase } from "./bunny-database.mjs";
import { createContactMailer } from "./bunny-mailer.mjs";
import { handleAgentAvailabilityTrial, isAgentAvailabilityTrialPath } from "./agent-availability-trial.mjs";

const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ASSET_DIRECTORY = path.resolve(MODULE_DIRECTORY, "../dist");
const MAX_REQUEST_BODY_BYTES = 8 * 1024 * 1024;
const MAX_ADMIN_LOGIN_BODY_BYTES = 8 * 1024;
const ADMIN_SESSION_COOKIE = "artbild_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const HSTS_HEADER_VALUE = "max-age=31536000; includeSubDomains; preload";
const CONTENT_SECURITY_POLICY_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://*.clarity.ms",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://connect.facebook.net https://www.facebook.com https://*.clarity.ms https://c.bing.com",
];

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
    || pathname === "/api/admin/availability"
    || pathname === "/api/admin/agent-requests";
}

function adminLoginPath(pathname) {
  return pathname === "/admin-login" || pathname === "/admin-login/";
}

function adminConfiguration(env) {
  const username = String(env.ADMIN_USERNAME || "");
  const password = String(env.ADMIN_PASSWORD || "");
  const sessionSecret = String(env.ADMIN_SESSION_SECRET || password);
  return {
    configured: Boolean(username && password && sessionSecret),
    password,
    sessionSecret,
    username,
  };
}

function cookieValue(request, name) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim();
    }
  }
  return "";
}

function adminSessionSignature({ expiresAt, nonce, username }, secret) {
  return createHmac("sha256", secret)
    .update(`v1\n${expiresAt}\n${nonce}\n${username}`)
    .digest("base64url");
}

function validAdminSession(request, configuration) {
  const value = cookieValue(request, ADMIN_SESSION_COOKIE);
  const [version, expiresValue, nonce, signature, ...extra] = value.split(".");
  if (version !== "v1" || !expiresValue || !nonce || !signature || extra.length) return false;

  const expiresAt = Number(expiresValue);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(nonce)) return false;

  const expectedSignature = adminSessionSignature({
    expiresAt,
    nonce,
    username: configuration.username,
  }, configuration.sessionSecret);
  return safeEqual(signature, expectedSignature);
}

function createAdminSessionCookie(configuration, secure = true) {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_MAX_AGE_SECONDS;
  const nonce = randomBytes(18).toString("base64url");
  const signature = adminSessionSignature({
    expiresAt,
    nonce,
    username: configuration.username,
  }, configuration.sessionSecret);
  const secureAttribute = secure ? "; Secure" : "";
  return `${ADMIN_SESSION_COOKIE}=v1.${expiresAt}.${nonce}.${signature}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ADMIN_SESSION_MAX_AGE_SECONDS}${secureAttribute}`;
}

async function authenticateAdminCredentials(
  { password, username },
  configuration,
  rateLimitDatabase,
  method,
) {
  let rateLimit;
  try {
    rateLimit = await reserveAdminAuthenticationAttempt(rateLimitDatabase, {
      secret: configuration.sessionSecret,
    });
  } catch (error) {
    console.error("Admin authentication rate limiter failed", error);
    return { configured: true, authorized: false, unavailable: true };
  }

  if (!rateLimit.allowed) {
    return { configured: true, authorized: false, method, rateLimit, rateLimited: true };
  }

  const usernameValid = safeEqual(username, configuration.username);
  const passwordValid = safeEqual(password, configuration.password);
  const authorized = usernameValid && passwordValid;
  if (authorized) {
    try {
      await clearAdminAuthenticationAttempts(rateLimitDatabase, {
        secret: configuration.sessionSecret,
      });
    } catch (error) {
      console.error("Admin authentication rate-limit reset failed", error);
      return { configured: true, authorized: false, unavailable: true };
    }
  }

  return { configured: true, authorized, method, rateLimit };
}

async function authorizedAdmin(request, env, rateLimitDatabase) {
  const configuration = adminConfiguration(env);
  if (!configuration.configured) return { configured: false, authorized: false };

  if (validAdminSession(request, configuration)) {
    return { configured: true, authorized: true, method: "session" };
  }

  const authorization = request.headers.get("authorization") || "";
  if (!/^Basic\s+/i.test(authorization)) return { configured: true, authorized: false };

  try {
    const decoded = Buffer.from(authorization.replace(/^Basic\s+/i, ""), "base64").toString("utf8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return { configured: true, authorized: false };
    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);
    return authenticateAdminCredentials(
      { password, username },
      configuration,
      rateLimitDatabase,
      "basic",
    );
  } catch {
    return authenticateAdminCredentials(
      { password: "", username: "" },
      configuration,
      rateLimitDatabase,
      "basic",
    );
  }
}

function adminDenied(configured) {
  return new Response(
    configured ? "Anmeldung erforderlich." : "Admin-Zugang ist noch nicht konfiguriert.",
    {
      status: configured ? 401 : 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Robots-Tag": "noindex, nofollow, noarchive",
      },
    },
  );
}

function adminRedirect(location) {
  return new Response(null, {
    status: 303,
    headers: {
      "Cache-Control": "no-store",
      Location: location,
    },
  });
}

function adminRateLimitHeaders(rateLimit, includeRetryAfter = false) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "X-RateLimit-Limit": String(rateLimit.limit),
    "X-RateLimit-Remaining": String(rateLimit.remaining),
  });
  const resetAt = Date.parse(rateLimit.resetAt || "");
  if (Number.isFinite(resetAt)) {
    headers.set("X-RateLimit-Reset", String(Math.ceil(resetAt / 1000)));
  }
  if (includeRetryAfter) {
    headers.set("Retry-After", String(adminAuthenticationRetryAfterSeconds(rateLimit)));
  }
  return headers;
}

function adminRateLimited(rateLimit, html = false) {
  const headers = adminRateLimitHeaders(rateLimit, true);
  headers.set("Content-Type", html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8");
  return new Response(
    html
      ? adminLoginPage({
        configured: true,
        error: "Zu viele Anmeldeversuche. Bitte warten Sie kurz und versuchen Sie es dann erneut.",
      })
      : "Zu viele Anmeldeversuche. Bitte später erneut versuchen.",
    { status: 429, headers },
  );
}

function adminAuthenticationUnavailable(html = false) {
  return new Response(
    html
      ? adminLoginPage({
        configured: true,
        error: "Die Anmeldung ist vorübergehend nicht verfügbar. Bitte versuchen Sie es später erneut.",
      })
      : "Die Anmeldung ist vorübergehend nicht verfügbar.",
    {
      status: 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": html ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
      },
    },
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function adminLoginPage({ configured, error = "", next = "/admin-termine/" }) {
  const safeNext = next === "/admin-termine/" ? next : "/admin-termine/";
  const errorMarkup = error
    ? `<p class="login-error" role="alert">${escapeHtml(error)}</p>`
    : "";
  const formMarkup = configured
    ? `<form method="post" action="/admin-login/">
        <input type="hidden" name="next" value="${escapeHtml(safeNext)}">
        <label for="admin-username">Benutzername</label>
        <input id="admin-username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
        <label for="admin-password">Passwort</label>
        <input id="admin-password" name="password" type="password" autocomplete="current-password" required>
        ${errorMarkup}
        <button type="submit">Anmelden</button>
      </form>`
    : '<p class="login-error" role="alert">Der Admin-Zugang ist noch nicht konfiguriert.</p>';

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <title>Terminverwaltung anmelden | Artbild-Fotografie</title>
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; background: #f4f2ee; color: #181818; }
    * { box-sizing: border-box; }
    body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
    main { width: min(100%, 430px); background: #fff; border: 1px solid #dedbd5; border-radius: 18px; padding: clamp(28px, 8vw, 44px); box-shadow: 0 18px 50px rgba(0,0,0,.08); }
    .eyebrow { margin: 0 0 10px; color: #6b665e; font-size: .75rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
    h1 { margin: 0; font-size: clamp(1.7rem, 8vw, 2.35rem); line-height: 1.1; }
    .intro { margin: 14px 0 26px; color: #56514a; line-height: 1.55; }
    form { display: grid; gap: 10px; }
    label { margin-top: 8px; font-size: .9rem; font-weight: 700; }
    input { width: 100%; min-height: 50px; border: 1px solid #aaa49b; border-radius: 10px; padding: 11px 13px; font: inherit; font-size: 16px; }
    input:focus { outline: 3px solid rgba(20,92,75,.22); border-color: #145c4b; }
    button { min-height: 52px; margin-top: 12px; border: 0; border-radius: 10px; padding: 12px 18px; background: #145c4b; color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
    button:focus-visible { outline: 3px solid rgba(20,92,75,.3); outline-offset: 3px; }
    .login-error { margin: 8px 0 0; padding: 12px 14px; border-radius: 9px; background: #fff0ee; color: #8d1f16; line-height: 1.4; }
    .privacy { margin: 24px 0 0; color: #6b665e; font-size: .8rem; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Artbild-Fotografie</p>
    <h1>Terminverwaltung</h1>
    <p class="intro">Bitte melden Sie sich an, um gesperrte Termine und Agentenabfragen zu verwalten.</p>
    ${formMarkup}
    <p class="privacy">Die Anmeldung wird ausschließlich über eine verschlüsselte HTTPS-Verbindung übertragen. Die Sitzung endet automatisch nach zwölf Stunden.</p>
  </main>
</body>
</html>`;
}

async function handleAdminLogin(request, env, url, rateLimitDatabase) {
  const configuration = adminConfiguration(env);
  const next = url.searchParams.get("next") || "/admin-termine/";

  if (request.method === "GET" || request.method === "HEAD") {
    const access = await authorizedAdmin(request, env, rateLimitDatabase);
    if (access.authorized) {
      return adminRedirect(new URL("/admin-termine/", url.origin).href);
    }
    if (access.rateLimited) return adminRateLimited(access.rateLimit, true);
    if (access.unavailable) return adminAuthenticationUnavailable(true);
    const response = new Response(adminLoginPage({ configured: configuration.configured, next }), {
      status: configuration.configured ? 200 : 503,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    });
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD, POST" },
    });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) {
    return new Response("Forbidden", { status: 403 });
  }
  if (!configuration.configured) {
    return new Response(adminLoginPage({ configured: false }), {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const mediaType = (request.headers.get("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/x-www-form-urlencoded") {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  const form = new URLSearchParams(await request.text());
  const access = await authenticateAdminCredentials(
    {
      password: form.get("password") || "",
      username: form.get("username") || "",
    },
    configuration,
    rateLimitDatabase,
    "form",
  );
  if (access.rateLimited) return adminRateLimited(access.rateLimit, true);
  if (access.unavailable) return adminAuthenticationUnavailable(true);
  if (!access.authorized) {
    const headers = adminRateLimitHeaders(access.rateLimit);
    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(adminLoginPage({
      configured: true,
      error: "Benutzername oder Passwort ist nicht korrekt.",
      next: form.get("next") || "/admin-termine/",
    }), {
      status: 401,
      headers,
    });
  }

  const response = adminRedirect(new URL("/admin-termine/", url.origin).href);
  response.headers.set(
    "Set-Cookie",
    createAdminSessionCookie(configuration, url.protocol === "https:"),
  );
  return response;
}

async function readRequestBody(request, maxBytes = MAX_REQUEST_BODY_BYTES) {
  const contentLength = Number.parseInt(request.headers["content-length"] || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RangeError("request_body_too_large");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new RangeError("request_body_too_large");
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

  // Identity headers from an unsupported upstream must never authorize access.
  headers.delete("cf-access-authenticated-user-email");
  headers.delete("cf-connecting-ip");
  const realIp = firstHeaderValue(headers.get("x-real-ip"));
  if (realIp) headers.set("x-real-ip", realIp);

  const publicProtocol = firstHeaderValue(headers.get("x-forwarded-proto"))
    || String(env.BUNNY_PUBLIC_SCHEME || "https");
  const publicHost = firstHeaderValue(headers.get("x-forwarded-host"))
    || firstHeaderValue(headers.get("host"))
    || "localhost";
  headers.set("x-forwarded-proto", publicProtocol);

  const url = new URL(request.url || "/", `${publicProtocol}://${publicHost}`);
  const maxBodyBytes = url.pathname === "/api/agent-availability"
    ? AGENT_AVAILABILITY_MAX_BODY_BYTES
    : adminLoginPath(url.pathname)
      ? MAX_ADMIN_LOGIN_BODY_BYTES
      : MAX_REQUEST_BODY_BYTES;
  const body = request.method === "GET" || request.method === "HEAD"
    ? undefined
    : await readRequestBody(request, maxBodyBytes);

  return new Request(url, {
    method: request.method,
    headers,
    body,
  });
}

function indexableHosts(env) {
  return new Set(
    String(
      env.BUNNY_INDEXABLE_HOSTS
        || "artbild-fotografie.de,www.artbild-fotografie.de",
    )
      .split(",")
      .map((hostname) => hostname.trim().toLowerCase())
      .filter(Boolean),
  );
}

function withBunnyHeaders(response, env, requestUrl) {
  const headers = new Headers(response.headers);
  const hostname = String(requestUrl?.hostname || "").toLowerCase();
  const pathname = String(requestUrl?.pathname || "");
  const securePublicOrigin = String(env.BUNNY_PUBLIC_SCHEME || "https").toLowerCase() !== "http";
  headers.delete("Server");
  if (securePublicOrigin) headers.set("Strict-Transport-Security", HSTS_HEADER_VALUE);
  headers.set("Content-Security-Policy", [
    ...CONTENT_SECURITY_POLICY_DIRECTIVES,
    ...(securePublicOrigin ? ["upgrade-insecure-requests"] : []),
  ].join("; "));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  const privatePath = pathname.startsWith("/api/")
    || pathname.startsWith("/admin-termine")
    || adminLoginPath(pathname);
  const productionIndexingEnabled = env.DEV_NOINDEX === "false";
  const recognizedProductionHost = indexableHosts(env).has(hostname);
  if (!productionIndexingEnabled || !recognizedProductionHost || privatePath) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }
  if (
    pathname.startsWith("/api/")
    || pathname.startsWith("/admin-termine")
    || adminLoginPath(pathname)
  ) {
    const privateAdminPage = pathname.startsWith("/admin-termine") || adminLoginPath(pathname);
    headers.set("Cache-Control", privateAdminPage ? "private, no-store" : "no-store");
  }
  if (
    pathname.startsWith("/admin-termine")
    || pathname.startsWith("/api/admin/")
    || adminLoginPath(pathname)
  ) {
    headers.set("Vary", "Authorization, Cookie");
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
    AGENT_AUDIT_DB: database.d1,
    AGENT_RATE_LIMIT_DB: database.d1,
    PUBLIC_AVAILABILITY_RATE_LIMIT_DB: database.d1,
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
        await writeNodeResponse(nodeResponse, withBunnyHeaders(health, env, url));
        return;
      }

      if (isAgentAvailabilityTrialPath(url.pathname)) {
        const response = await handleAgentAvailabilityTrial({ request, env: workerEnv });
        await writeNodeResponse(nodeResponse, withBunnyHeaders(response, env, url));
        return;
      }

      if (adminLoginPath(url.pathname)) {
        const loginResponse = await handleAdminLogin(
          request,
          env,
          url,
          database.d1,
        );
        await writeNodeResponse(
          nodeResponse,
          withBunnyHeaders(loginResponse, env, url),
        );
        return;
      }

      if (adminPath(url.pathname)) {
        const access = await authorizedAdmin(request, env, database.d1);
        if (!access.authorized) {
          const isAdminPage = url.pathname === "/admin-termine"
            || url.pathname.startsWith("/admin-termine/");
          const deniedResponse = access.rateLimited
            ? adminRateLimited(access.rateLimit)
            : access.unavailable
              ? adminAuthenticationUnavailable()
              : access.configured && isAdminPage
                ? adminRedirect(new URL("/admin-login/?next=/admin-termine/", url.origin).href)
                : adminDenied(access.configured);
          await writeNodeResponse(
            nodeResponse,
            withBunnyHeaders(deniedResponse, env, url),
          );
          return;
        }

        const origin = request.headers.get("origin");
        if (request.method === "POST" && origin && origin !== url.origin) {
          await writeNodeResponse(nodeResponse, withBunnyHeaders(new Response("Forbidden", {
            status: 403,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }), env, url));
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
      await writeNodeResponse(nodeResponse, withBunnyHeaders(response, env, url));
    } catch (error) {
      const status = error instanceof RangeError ? 413 : 500;
      if (status === 500) console.error("Unhandled Bunny request error", error);
      const requestUrl = new URL(nodeRequest.url || "/", "http://bunny.internal");
      const pathname = requestUrl.pathname;
      const agentPayloadTooLarge = status === 413
        && pathname === "/api/agent-availability";
      const response = agentPayloadTooLarge
        ? Response.json(
          { error: "payload_too_large", message: "Die Anfrage ist zu groß." },
          { status, headers: { "Cache-Control": "no-store" } },
        )
        : new Response(
          status === 413 ? "Die Anfrage ist zu groß." : "Internal Server Error",
          {
            status,
            headers: {
              "Cache-Control": "no-store",
              "Content-Type": "text/plain; charset=utf-8",
            },
          },
        );
      await writeNodeResponse(
        nodeResponse,
        withBunnyHeaders(response, env, requestUrl),
      );
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
      if (typeof database.close === "function") {
        await database.close();
      } else {
        database.client?.close?.();
      }
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
