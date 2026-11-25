import { agentClientIp } from "./_agent-rate-limit.js";
import { hashPublicAvailabilityClientIp } from "./_public-availability-rate-limit.js";

export const AVAILABILITY_ADMISSION_WINDOW_MS = 60_000;
export const AVAILABILITY_ADMISSION_TOTAL_LIMIT = 120;
export const AVAILABILITY_ADMISSION_CLIENT_LIMIT = 12;
export const AVAILABILITY_BUSY_MESSAGE = "Es laufen zu viele Terminprüfungen. Bitte versuche es gleich erneut.";

// Give the database and Durable Object a bounded amount of admission work per
// runtime before making a shared reservation. This map cannot grow beyond the
// total request allowance. Only the time bucket and counters reach storage.
const localWindows = new WeakMap();

async function reserveLocalAdmission(binding, ip, windowStart, env) {
  let window = localWindows.get(binding);
  if (!window || window.start < windowStart) {
    window = { start: windowStart, count: 0, byClient: new Map() };
    localWindows.set(binding, window);
  }
  if (window.start !== windowStart || window.count >= AVAILABILITY_ADMISSION_TOTAL_LIMIT) return false;
  const identity = await hashPublicAvailabilityClientIp(ip, env);
  if (localWindows.get(binding) !== window || window.count >= AVAILABILITY_ADMISSION_TOTAL_LIMIT) return false;
  const clientCount = window.byClient.get(identity) ?? 0;
  if (clientCount >= AVAILABILITY_ADMISSION_CLIENT_LIMIT) return false;
  window.count++;
  window.byClient.set(identity, clientCount + 1);
  return true;
}

async function reserveInDatabase(database, windowStart) {
  const result = await database.prepare(`
    INSERT INTO availability_admission (id, window_start, admitted)
    VALUES (1, ?, 1)
    ON CONFLICT(id) DO UPDATE SET
      window_start = excluded.window_start,
      admitted = CASE
        WHEN excluded.window_start > availability_admission.window_start THEN 1
        ELSE availability_admission.admitted + 1
      END
    WHERE excluded.window_start > availability_admission.window_start
      OR (excluded.window_start = availability_admission.window_start
        AND availability_admission.admitted < ?)
  `).bind(windowStart, AVAILABILITY_ADMISSION_TOTAL_LIMIT).run();
  const changes = Number(result?.meta?.changes ?? result?.rowsAffected);
  if (changes !== 0 && changes !== 1) throw new Error("invalid_availability_admission_result");
  return changes === 1;
}

async function reserveInDurableObject(namespace) {
  const limiter = namespace.jurisdiction("eu").getByName("availability-admission");
  const response = await limiter.fetch("https://agent-rate-limiter.internal/reserve-availability", { method: "POST" });
  if (!response.ok) throw new Error("availability_admission_unavailable");
  const { allowed } = await response.json();
  if (typeof allowed !== "boolean") throw new Error("invalid_availability_admission_response");
  return allowed;
}

export async function reserveAvailabilityAdmission(request, env, now = Date.now()) {
  const ip = agentClientIp(request);
  if (!ip) throw new Error("missing_availability_client_ip");

  const database = env.PUBLIC_AVAILABILITY_RATE_LIMIT_DB || env.AGENT_RATE_LIMIT_DB;
  const binding = database || env.AGENT_RATE_LIMITER;
  if (!binding) throw new Error("missing_availability_admission_limiter");

  const windowStart = Math.floor(now / AVAILABILITY_ADMISSION_WINDOW_MS) * AVAILABILITY_ADMISSION_WINDOW_MS;
  const allowed = await reserveLocalAdmission(binding, ip, windowStart, env)
    && await (database ? reserveInDatabase(database, windowStart) : reserveInDurableObject(binding));
  return {
    allowed,
    retryAfter: Math.ceil((windowStart + AVAILABILITY_ADMISSION_WINDOW_MS - now) / 1000),
  };
}
