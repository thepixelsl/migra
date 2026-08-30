export const PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES = 3;
export const PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const MINIMUM_SALT_LENGTH = 32;

function bunnyRateLimitDatabase(env) {
  const database = env?.PUBLIC_AVAILABILITY_RATE_LIMIT_DB;
  return database && typeof database.prepare === "function" ? database : null;
}

function firstHeaderValue(value) {
  return String(value || "").split(",", 1)[0].trim();
}

function publicAvailabilityClientIp(request) {
  const value = firstHeaderValue(
    request.headers.get("cf-connecting-ip")
      || request.headers.get("x-real-ip"),
  );

  if (!value || value.length > 64 || /[\s,\u0000-\u001f\u007f]/.test(value)) {
    return "";
  }

  return value;
}

function rateLimitSalt(env) {
  const value = String(
    env?.PUBLIC_AVAILABILITY_RATE_LIMIT_SALT
      || env?.AGENT_RATE_LIMIT_SALT
      || env?.CONTACT_HASH_SALT
      || "",
  ).trim();

  if (value.length < MINIMUM_SALT_LENGTH) {
    throw new Error("missing_public_availability_rate_limit_salt");
  }

  return value;
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPublicAvailabilityClientIp(ip, env) {
  if (!ip) throw new Error("missing_public_availability_client_ip");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(rateLimitSalt(env)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`public-availability:${ip}`),
  );

  return toHex(signature);
}

function publicRateLimitState(row) {
  const count = Number(row?.count || 0);
  const oldest = row?.oldest == null ? null : Number(row.oldest);
  return {
    limit: PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES,
    remaining: Math.max(0, PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES - count),
    resetAt: Number.isFinite(oldest)
      ? new Date(oldest + PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS).toISOString()
      : null,
  };
}

async function readBunnyRateLimitState(database, ipHash, date, cutoff) {
  const row = await database
    .prepare(`
      SELECT
        COUNT(*) AS count,
        MIN(requested_at) AS oldest,
        MAX(CASE WHEN requested_date = ? THEN 1 ELSE 0 END) AS requested_date_active
      FROM public_availability_requests
      WHERE ip_hash = ?
        AND requested_at > ?
    `)
    .bind(date, ipHash, cutoff)
    .first();

  return {
    allowed: Number(row?.requested_date_active || 0) === 1,
    ...publicRateLimitState(row),
  };
}

async function reserveWithBunnyDatabase(database, ipHash, date, now) {
  const cutoff = now - PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS;
  await database
    .prepare(`
      INSERT INTO public_availability_requests (
        id, ip_hash, requested_date, requested_at
      )
      SELECT ?, ?, ?, ?
      WHERE (
        SELECT COUNT(*)
        FROM public_availability_requests
        WHERE ip_hash = ?
          AND requested_at > ?
      ) < ?
      ON CONFLICT(ip_hash, requested_date) DO UPDATE SET
        id = excluded.id,
        requested_at = excluded.requested_at
      WHERE public_availability_requests.requested_at <= ?
    `)
    .bind(
      crypto.randomUUID(),
      ipHash,
      date,
      now,
      ipHash,
      cutoff,
      PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES,
      cutoff,
    )
    .run();

  return readBunnyRateLimitState(database, ipHash, date, cutoff);
}

function cloudflareRateLimiter(env, ipHash) {
  const namespace = env?.AGENT_RATE_LIMITER;
  if (!namespace || typeof namespace.jurisdiction !== "function") {
    throw new Error("missing_public_availability_rate_limiter");
  }

  const euNamespace = namespace.jurisdiction("eu");
  if (!euNamespace || typeof euNamespace.getByName !== "function") {
    throw new Error("missing_eu_public_availability_rate_limiter");
  }

  return euNamespace.getByName(ipHash);
}

async function reserveWithCloudflareDurableObject(env, ipHash, date) {
  const stub = cloudflareRateLimiter(env, ipHash);
  const response = await stub.fetch(
    "https://agent-rate-limiter.internal/reserve-public-date",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    },
  );
  if (!response?.ok) throw new Error("public_availability_rate_limiter_unavailable");

  const state = await response.json();
  const resetAt = state?.resetAt == null ? null : String(state.resetAt);
  if (
    typeof state?.allowed !== "boolean"
    || Number(state?.limit) !== PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES
    || !Number.isInteger(Number(state?.remaining))
    || Number(state.remaining) < 0
    || Number(state.remaining) > PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES
    || (resetAt !== null && !Number.isFinite(Date.parse(resetAt)))
  ) {
    throw new Error("invalid_public_availability_rate_limiter_response");
  }

  return {
    allowed: state.allowed,
    limit: PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES,
    remaining: Number(state.remaining),
    resetAt,
  };
}

export async function reservePublicAvailabilityDate(request, env, date, now = Date.now()) {
  const ip = publicAvailabilityClientIp(request);
  const ipHash = await hashPublicAvailabilityClientIp(ip, env);
  const database = bunnyRateLimitDatabase(env);
  if (database) return reserveWithBunnyDatabase(database, ipHash, date, now);
  return reserveWithCloudflareDurableObject(env, ipHash, date);
}

export function publicAvailabilityRetryAfterSeconds(rateLimit, now = Date.now()) {
  const resetAt = Date.parse(rateLimit?.resetAt || "");
  if (!Number.isFinite(resetAt)) {
    return Math.ceil(PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS / 1000);
  }
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
