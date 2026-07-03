import {
  assertAdminAccess,
  json,
  methodNotAllowed,
  normalizeBlockedDates,
  parseDateValue,
  readBlockedDates,
  writeBlockedDates,
} from "../../_availability.js";

const MAX_ADMIN_BODY_BYTES = 220;
const ALLOWED_ACTIONS = new Set(["block", "unblock"]);

function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      Allow: "GET, POST, OPTIONS",
    },
  });
}

function badRequest(message) {
  return json({ error: "bad_request", message }, 400);
}

export function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet({ request, env }) {
  const denied = assertAdminAccess(request, env);
  if (denied) return denied;

  try {
    return json({ blockedDates: await readBlockedDates(env) });
  } catch {
    return json(
      {
        error: "temporarily_unavailable",
        message: "Die Terminverwaltung ist gerade nicht verfügbar.",
      },
      503,
    );
  }
}

export async function onRequestPost({ request, env }) {
  const denied = assertAdminAccess(request, env);
  if (denied) return denied;

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return badRequest("Bitte JSON senden.");
  }

  const contentLength = Number.parseInt(request.headers.get("Content-Length") || "0", 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_ADMIN_BODY_BYTES) {
    return json(
      {
        error: "payload_too_large",
        message: "Die Anfrage ist zu groß.",
      },
      413,
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return badRequest("Bitte gültiges JSON senden.");
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return badRequest("Bitte ein gültiges Datum und eine gültige Aktion senden.");
  }

  const keys = Object.keys(payload);
  if (keys.length !== 2 || !keys.includes("date") || !keys.includes("action")) {
    return badRequest("Erlaubt sind nur date und action.");
  }

  const date = parseDateValue(payload.date);
  const action = typeof payload.action === "string" ? payload.action : "";
  if (!date) return badRequest("Bitte ein gültiges Datum im Format YYYY-MM-DD senden.");
  if (!ALLOWED_ACTIONS.has(action)) return badRequest("Diese Aktion ist nicht erlaubt.");

  try {
    const current = await readBlockedDates(env);
    const next = action === "block"
      ? normalizeBlockedDates([...current, date])
      : current.filter((item) => item !== date);

    await writeBlockedDates(env, next);

    return json({
      date,
      action,
      available: !next.includes(date),
      blockedDates: next,
    });
  } catch {
    return json(
      {
        error: "temporarily_unavailable",
        message: "Die Terminverwaltung ist gerade nicht verfügbar.",
      },
      503,
    );
  }
}

export function onRequest() {
  return methodNotAllowed("GET, POST, OPTIONS");
}
