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
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

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

    if (isHttpRequest(request, url)) {
      url.protocol = "https:";
      return new Response(null, {
        status: 301,
        headers: {
          Location: url.toString(),
        },
      });
    }

    if (url.hostname === "www.artbild-fotografie.ch") {
      url.hostname = "artbild-fotografie.ch";
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

    return withSecurityHeaders(await env.ASSETS.fetch(request));
  },
};
