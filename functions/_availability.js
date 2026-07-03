export const BLOCKED_DATES_KEY = "blockedDates";

export const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...JSON_HEADERS,
      ...extraHeaders,
    },
  });
}

export function parseDateValue(value) {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return value;
}

export function normalizeBlockedDates(input) {
  if (!Array.isArray(input)) return [];

  return [...new Set(input.filter((item) => parseDateValue(item)))]
    .sort((a, b) => a.localeCompare(b));
}

export async function readBlockedDates(env) {
  const kv = env?.AVAILABILITY_KV;
  if (!kv) throw new Error("missing_availability_kv");

  const raw = await kv.get(BLOCKED_DATES_KEY);
  if (!raw) return [];

  try {
    return normalizeBlockedDates(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function writeBlockedDates(env, blockedDates) {
  const kv = env?.AVAILABILITY_KV;
  if (!kv) throw new Error("missing_availability_kv");

  await kv.put(BLOCKED_DATES_KEY, JSON.stringify(normalizeBlockedDates(blockedDates)));
}

export function methodNotAllowed(allow) {
  return json(
    {
      error: "method_not_allowed",
      message: "Diese Methode ist hier nicht erlaubt.",
    },
    405,
    { Allow: allow },
  );
}

export function accessEmail(request) {
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function allowedAdminEmail(env) {
  const email = env?.ADMIN_EMAIL || env?.CONTACT_TO || "info@artbild-fotografie.de";
  return String(email).trim().toLowerCase();
}

export function assertAdminAccess(request, env) {
  const authenticatedEmail = accessEmail(request);
  const allowedEmail = allowedAdminEmail(env);

  if (!authenticatedEmail || authenticatedEmail !== allowedEmail) {
    return json(
      {
        error: "not_authorized",
        message: "Der Admin-Bereich ist durch Cloudflare Access geschützt.",
      },
      401,
    );
  }

  return null;
}
