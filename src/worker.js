import * as availability from "../functions/api/availability.js";
import * as contact from "../functions/api/contact.js";

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

    if (url.pathname === "/api/contact") {
      return handlePagesFunction(contact, request, env, ctx);
    }

    if (url.pathname === "/api/availability") {
      return handlePagesFunction(availability, request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
