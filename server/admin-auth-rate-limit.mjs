import { createHmac, randomUUID } from "node:crypto";

export const ADMIN_AUTH_MAX_ATTEMPTS = 5;
export const ADMIN_AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function changedRows(result) {
  const value = result?.meta?.changes ?? result?.rowsAffected;
  return Number(value || 0);
}

function bucketHash(secret, scope, identity) {
  if (!secret) throw new Error("missing_admin_auth_rate_limit_secret");
  return createHmac("sha256", secret)
    .update(`admin-auth:${scope}:${identity}`)
    .digest("hex");
}

async function readBucketState(database, bucket, cutoff, limit) {
  const row = await database
    .prepare(`
      SELECT COUNT(*) AS count, MIN(attempted_at) AS oldest
      FROM admin_auth_attempts
      WHERE bucket_hash = ?
        AND attempted_at > ?
    `)
    .bind(bucket, cutoff)
    .first();
  const count = Number(row?.count || 0);
  const oldest = row?.oldest == null ? null : Number(row.oldest);
  return {
    limit,
    remaining: Math.max(0, limit - count),
    resetAt: Number.isFinite(oldest)
      ? new Date(oldest + ADMIN_AUTH_RATE_LIMIT_WINDOW_MS).toISOString()
      : null,
  };
}

async function reserveBucket(database, { bucket, limit, now, scope }) {
  const cutoff = now - ADMIN_AUTH_RATE_LIMIT_WINDOW_MS;
  const result = await database
    .prepare(`
      INSERT INTO admin_auth_attempts (id, bucket_hash, scope, attempted_at)
      SELECT ?, ?, ?, ?
      WHERE (
        SELECT COUNT(*)
        FROM admin_auth_attempts
        WHERE bucket_hash = ?
          AND attempted_at > ?
      ) < ?
    `)
    .bind(randomUUID(), bucket, scope, now, bucket, cutoff, limit)
    .run();
  return {
    allowed: changedRows(result) === 1,
    scope,
    ...await readBucketState(database, bucket, cutoff, limit),
  };
}

function authenticationBucket(secret) {
  return bucketHash(secret, "account", "configured-admin");
}

export async function reserveAdminAuthenticationAttempt(
  database,
  { secret, now = Date.now() },
) {
  if (!database || typeof database.prepare !== "function") {
    throw new Error("missing_admin_auth_rate_limit_database");
  }

  return reserveBucket(database, {
    bucket: authenticationBucket(secret),
    limit: ADMIN_AUTH_MAX_ATTEMPTS,
    now,
    scope: "account",
  });
}

export async function clearAdminAuthenticationAttempts(
  database,
  { secret },
) {
  if (!database || typeof database.prepare !== "function") {
    throw new Error("missing_admin_auth_rate_limit_database");
  }
  return database
    .prepare(`
      DELETE FROM admin_auth_attempts
      WHERE bucket_hash = ?
    `)
    .bind(authenticationBucket(secret))
    .run();
}

export function adminAuthenticationRetryAfterSeconds(rateLimit, now = Date.now()) {
  const resetAt = Date.parse(rateLimit?.resetAt || "");
  if (!Number.isFinite(resetAt)) {
    return Math.ceil(ADMIN_AUTH_RATE_LIMIT_WINDOW_MS / 1000);
  }
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
