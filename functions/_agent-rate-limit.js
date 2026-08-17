export const AGENT_RATE_LIMIT_MAX_REQUESTS = 2;
export const AGENT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

const MINIMUM_SALT_LENGTH = 32;

function bunnyRateLimitDatabase(env) {
  const database = env?.AGENT_RATE_LIMIT_DB;
  return database && typeof database.prepare === "function" ? database : null;
}

function firstHeaderValue(value) {
  return String(value || "").split(",", 1)[0].trim();
}

export function agentClientIp(request) {
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
    env?.AGENT_RATE_LIMIT_SALT
      || env?.CONTACT_HASH_SALT
      || "",
  ).trim();

  if (value.length < MINIMUM_SALT_LENGTH) {
    throw new Error("missing_agent_rate_limit_salt");
  }

  return value;
}

function toHex(bytes) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashAgentClientIp(ip, env) {
  if (!ip) throw new Error("missing_agent_client_ip");

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
    encoder.encode(`agent-availability:${ip}`),
  );

  return toHex(signature);
}

function changedRows(result) {
  const value = result?.meta?.changes ?? result?.rowsAffected;
  return Number(value || 0);
}

async function readRateLimitState(database, ipHash, cutoff) {
  const row = await database
    .prepare(`
      SELECT COUNT(*) AS count, MIN(requested_at) AS oldest
      FROM agent_availability_requests
      WHERE ip_hash = ?
        AND requested_at > ?
    `)
    .bind(ipHash, cutoff)
    .first();

  return {
    count: Number(row?.count || 0),
    oldest: row?.oldest == null ? null : Number(row.oldest),
  };
}

function publicRateLimitState(state) {
  const oldest = Number.isFinite(state.oldest) ? state.oldest : null;
  return {
    limit: AGENT_RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, AGENT_RATE_LIMIT_MAX_REQUESTS - state.count),
    resetAt: oldest == null
      ? null
      : new Date(oldest + AGENT_RATE_LIMIT_WINDOW_MS).toISOString(),
  };
}

async function reserveWithBunnyDatabase(database, ipHash, now) {
  const cutoff = now - AGENT_RATE_LIMIT_WINDOW_MS;
  const result = await database
    .prepare(`
      INSERT INTO agent_availability_requests (id, ip_hash, requested_at)
      SELECT ?, ?, ?
      WHERE (
        SELECT COUNT(*)
        FROM agent_availability_requests
        WHERE ip_hash = ?
          AND requested_at > ?
      ) < ?
    `)
    .bind(
      crypto.randomUUID(),
      ipHash,
      now,
      ipHash,
      cutoff,
      AGENT_RATE_LIMIT_MAX_REQUESTS,
    )
    .run();

  const state = await readRateLimitState(database, ipHash, cutoff);
  return {
    allowed: changedRows(result) === 1,
    ...publicRateLimitState(state),
  };
}

function cloudflareRateLimiter(env, ipHash) {
  const namespace = env?.AGENT_RATE_LIMITER;
  if (!namespace || typeof namespace.jurisdiction !== "function") {
    throw new Error("missing_agent_rate_limiter");
  }

  const euNamespace = namespace.jurisdiction("eu");
  if (!euNamespace || typeof euNamespace.getByName !== "function") {
    throw new Error("missing_eu_agent_rate_limiter");
  }

  return euNamespace.getByName(ipHash);
}

async function reserveWithCloudflareDurableObject(env, ipHash) {
  const stub = cloudflareRateLimiter(env, ipHash);
  const response = await stub.fetch("https://agent-rate-limiter.internal/reserve", {
    method: "POST",
  });
  if (!response?.ok) throw new Error("agent_rate_limiter_unavailable");

  const state = await response.json();
  const resetAt = state?.resetAt == null ? null : String(state.resetAt);
  if (
    typeof state?.allowed !== "boolean"
    || Number(state?.limit) !== AGENT_RATE_LIMIT_MAX_REQUESTS
    || !Number.isInteger(Number(state?.remaining))
    || Number(state.remaining) < 0
    || Number(state.remaining) > AGENT_RATE_LIMIT_MAX_REQUESTS
    || (resetAt !== null && !Number.isFinite(Date.parse(resetAt)))
  ) {
    throw new Error("invalid_agent_rate_limiter_response");
  }

  return {
    allowed: state.allowed,
    limit: AGENT_RATE_LIMIT_MAX_REQUESTS,
    remaining: Number(state.remaining),
    resetAt,
  };
}

export async function reserveAgentAvailabilityRequest(request, env, now = Date.now()) {
  const ip = agentClientIp(request);
  const ipHash = await hashAgentClientIp(ip, env);
  const database = bunnyRateLimitDatabase(env);
  if (database) return reserveWithBunnyDatabase(database, ipHash, now);
  return reserveWithCloudflareDurableObject(env, ipHash);
}

export async function pruneAgentRateLimits(env, now = Date.now()) {
  const database = bunnyRateLimitDatabase(env);
  if (!database) throw new Error("missing_agent_rate_limit_database");
  return database
    .prepare(`
      DELETE FROM agent_availability_requests
      WHERE requested_at <= ?
    `)
    .bind(now - AGENT_RATE_LIMIT_WINDOW_MS)
    .run();
}

export function retryAfterSeconds(rateLimit, now = Date.now()) {
  const resetAt = Date.parse(rateLimit?.resetAt || "");
  if (!Number.isFinite(resetAt)) {
    return Math.ceil(AGENT_RATE_LIMIT_WINDOW_MS / 1000);
  }
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
