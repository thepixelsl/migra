import * as availability from "../functions/api/availability.js";
import * as adminAvailability from "../functions/api/admin/availability.js";
import * as contact from "../functions/api/contact.js";
import { assertAdminAccess } from "../functions/_availability.js";

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
const DOWNLOAD_PATH_PREFIXES = ["/downloads/"];

function isExplicitDownloadPath(pathname) {
  return DOWNLOAD_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function normalizePathname(pathname) {
  return pathname.replace(/\/{2,}/g, "/");
}

function collectionRootRedirect(pathname) {
  if (pathname === "/gallery" || pathname === "/gallery/") return "/portfolio/";
  if (pathname === "/gallery-category" || pathname === "/gallery-category/") return "/portfolio/";
  return null;
}

function canonicalContentRedirect(pathname) {
  if (
    pathname === "/datenschutzerklaerung"
    || pathname === "/datenschutzerklaerung/"
  ) {
    return "/datenschutz/";
  }

  const traukalenderAliases = new Set([
    "/traukalender-hamburg",
    "/traukalender-hamburg/",
    "/blog/traukalender-hamburg",
    "/blog/traukalender-hamburg/",
    "/blog/trautermin-hamburg-online-reservieren",
    "/blog/trautermin-hamburg-online-reservieren/",
  ]);

  if (traukalenderAliases.has(pathname)) {
    return "/trautermin-hamburg-online-reservieren/";
  }

  return null;
}

function looksLikePagePath(pathname) {
  const lastSegment = pathname.split("/").pop() || "";
  return pathname.endsWith("/") || !lastSegment.includes(".") || lastSegment.endsWith(".html");
}

function withSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  headers.set("Strict-Transport-Security", HSTS_HEADER_VALUE);
  headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isHttpRequest(request, url) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const cfVisitor = request.headers.get("cf-visitor") || "";

  return (
    url.protocol === "http:"
    || forwardedProto === "http"
    || cfVisitor.includes('"scheme":"http"')
  );
}

function pageContext(request, env, ctx) {
  return {
    request,
    env,
    params: {},
    waitUntil: ctx.waitUntil.bind(ctx),
    passThroughOnException: ctx.passThroughOnException?.bind(ctx),
  };
}

async function handlePagesFunction(module, request, env, ctx) {
  const method = request.method.toLowerCase();
  const handler =
    (method === "options" && module.onRequestOptions)
    || (method === "get" && module.onRequestGet)
    || (method === "post" && module.onRequestPost)
    || module.onRequest;

  if (!handler) return new Response("Method Not Allowed", { status: 405 });
  return handler(pageContext(request, env, ctx));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const normalizedPathname = normalizePathname(url.pathname);
    const collectionRedirectPath = collectionRootRedirect(normalizedPathname);
    const contentRedirectPath = canonicalContentRedirect(normalizedPathname);

    if (normalizedPathname !== url.pathname || collectionRedirectPath || contentRedirectPath) {
      url.pathname = collectionRedirectPath || contentRedirectPath || normalizedPathname;
      return withSecurityHeaders(new Response(null, {
        status: 301,
        headers: {
          Location: url.toString(),
        },
      }));
    }

    if (isHttpRequest(request, url)) {
      url.protocol = "https:";
      return new Response(null, {
        status: 301,
        headers: {
          Location: url.toString(),
        },
      });
    }

    const canonicalHosts = new Set(["www.artbild-fotografie.de", "www.artbild-fotografie.ch"]);
    if (canonicalHosts.has(url.hostname)) {
      url.hostname = url.hostname.replace(/^www\./, "");
      return withSecurityHeaders(new Response(null, {
        status: 301,
        headers: {
          Location: url.toString(),
        },
      }));
    }

    if (url.pathname === "/api/contact") {
      return withSecurityHeaders(await handlePagesFunction(contact, request, env, ctx));
    }

    if (url.pathname === "/api/availability") {
      return withSecurityHeaders(await handlePagesFunction(availability, request, env, ctx));
    }

    if (url.pathname === "/api/admin/availability") {
      return withSecurityHeaders(await handlePagesFunction(adminAvailability, request, env, ctx));
    }

    if (url.pathname === "/admin-termine" || url.pathname.startsWith("/admin-termine/")) {
      const denied = assertAdminAccess(request, env);
      if (denied) return withSecurityHeaders(denied);
    }

    let assetResponse = await env.ASSETS.fetch(request);

    if (
      assetResponse.status === 404
      && (request.method === "GET" || request.method === "HEAD")
      && looksLikePagePath(url.pathname)
    ) {
      const notFoundRequest = new Request(new URL("/404.html", request.url), {
        method: request.method,
        headers: request.headers,
      });
      const notFoundAssetResponse = await env.ASSETS.fetch(notFoundRequest);

      if (notFoundAssetResponse.ok) {
        assetResponse = new Response(
          request.method === "HEAD" ? null : notFoundAssetResponse.body,
          {
            status: 404,
            statusText: "Not Found",
            headers: notFoundAssetResponse.headers,
          },
        );
      }
    }

    const responseHeaders = new Headers(assetResponse.headers);

    if (url.pathname.startsWith("/_astro/")) {
      responseHeaders.set("Cache-Control", "public, max-age=31556952, immutable");
    }

    if (!isExplicitDownloadPath(url.pathname)) {
      const contentDisposition = responseHeaders.get("Content-Disposition") || "";
      if (contentDisposition.toLowerCase().includes("attachment")) {
        responseHeaders.delete("Content-Disposition");
      }
    }

    if (
      looksLikePagePath(url.pathname)
      && (!responseHeaders.has("Content-Type")
        || responseHeaders.get("Content-Type") === "application/octet-stream")
    ) {
      responseHeaders.set("Content-Type", "text/html; charset=utf-8");
    }

    return withSecurityHeaders(new Response(assetResponse.body, {
      status: assetResponse.status,
      statusText: assetResponse.statusText,
      headers: responseHeaders,
    }));
  },
};
