import { parseDateValue } from "./_availability.js";

export const AGENT_AUDIT_RETENTION_DAYS = 30;
export const AGENT_AUDIT_RETENTION_MS = AGENT_AUDIT_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const CLIENT_LABEL_MAX_LENGTH = 64;
const CLIENT_TOKEN_MAX_LENGTH = 512;
const AUDIT_RESULTS_LIMIT = 100;

function auditDatabase(env) {
  const database = env?.AGENT_AUDIT_DB || env?.DB;
  return database && typeof database.prepare === "function" ? database : null;
}

function cleanClientLabel(value) {
  const label = String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return label.slice(0, CLIENT_LABEL_MAX_LENGTH);
}

function configuredAgentClients(env) {
  const raw = String(env?.AGENT_API_CLIENTS_JSON || "").trim();
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

  return Object.entries(parsed)
    .map(([label, token]) => ({
      label: cleanClientLabel(label),
      token: typeof token === "string" ? token : "",
    }))
    .filter(({ label, token }) => label && token.length >= 16 && token.length <= CLIENT_TOKEN_MAX_LENGTH);
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(value)),
  ));
}

function equalBytes(left, right) {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function bearerToken(request) {
  const authorization = request.headers.get("Authorization") || "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match || match[1].length > CLIENT_TOKEN_MAX_LENGTH) return "";
  return match[1];
}

async function verifiedClientIdentity(request, env) {
  const presentedToken = bearerToken(request);
  const clients = configuredAgentClients(env);
  if (!presentedToken || clients.length === 0) return null;

  const presentedDigest = await digest(presentedToken);
  let matchingLabel = "";
  for (const client of clients) {
    const configuredDigest = await digest(client.token);
    if (equalBytes(presentedDigest, configuredDigest)) matchingLabel = client.label;
  }

  return matchingLabel
    ? {
      clientLabel: matchingLabel,
      identitySource: "api_key",
      clientVerified: true,
    }
    : null;
}

function reportedClientIdentity(request) {
  const userAgent = request.headers.get("User-Agent") || "";
  const categories = [
    [/ChatGPT-User|OAI-SearchBot|GPTBot/i, "OpenAI"],
    [/Claude-User|Claude-SearchBot|ClaudeBot/i, "Anthropic Claude"],
    [/Perplexity-User|PerplexityBot/i, "Perplexity"],
    [/Google-CloudVertexBot|GoogleOther/i, "Google"],
    [/Applebot(?:-Extended)?/i, "Apple"],
  ];
  const match = categories.find(([pattern]) => pattern.test(userAgent));

  if (!match) {
    return {
      clientLabel: "Nicht identifiziert",
      identitySource: "unknown",
      clientVerified: false,
    };
  }

  return {
    clientLabel: match[1],
    identitySource: "user_agent",
    clientVerified: false,
  };
}

export async function identifyAgentClient(request, env) {
  return await verifiedClientIdentity(request, env) || reportedClientIdentity(request);
}

function normalizeResults(results) {
  if (!Array.isArray(results)) return [];
  return results.flatMap((result) => {
    const date = parseDateValue(result?.date);
    if (!date || typeof result?.available !== "boolean") return [];
    return [{ date, available: result.available }];
  });
}

export async function writeAgentAvailabilityAudit({
  env,
  request,
  dates,
  results,
  responseStatus,
  requestedAt = Date.now(),
}) {
  const database = auditDatabase(env);
  if (!database) throw new Error("missing_agent_audit_database");

  const identity = await identifyAgentClient(request, env);
  const validDates = Array.isArray(dates) ? dates.filter(parseDateValue) : [];
  const validResults = normalizeResults(results);

  return database
    .prepare(`
      INSERT INTO agent_availability_audit (
        id,
        requested_at,
        client_label,
        identity_source,
        client_verified,
        dates_json,
        results_json,
        response_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      requestedAt,
      identity.clientLabel,
      identity.identitySource,
      identity.clientVerified ? 1 : 0,
      JSON.stringify(validDates),
      JSON.stringify(validResults),
      Number(responseStatus),
    )
    .run();
}

function parseStoredJson(value, fallback) {
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function auditRows(result) {
  if (Array.isArray(result?.results)) return result.results;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

export async function readAgentAvailabilityAudit(env, limit = AUDIT_RESULTS_LIMIT) {
  const database = auditDatabase(env);
  if (!database) throw new Error("missing_agent_audit_database");
  const safeLimit = Math.max(1, Math.min(AUDIT_RESULTS_LIMIT, Number(limit) || AUDIT_RESULTS_LIMIT));
  const statement = database
    .prepare(`
      SELECT
        id,
        requested_at,
        client_label,
        identity_source,
        client_verified,
        dates_json,
        results_json,
        response_status
      FROM agent_availability_audit
      ORDER BY requested_at DESC, id DESC
      LIMIT ?
    `)
    .bind(safeLimit);
  const result = typeof statement.all === "function"
    ? await statement.all()
    : await statement.run();

  return auditRows(result).map((row) => ({
    id: String(row.id),
    requestedAt: new Date(Number(row.requested_at)).toISOString(),
    clientLabel: cleanClientLabel(row.client_label) || "Nicht identifiziert",
    identitySource: ["api_key", "user_agent", "unknown"].includes(String(row.identity_source))
      ? String(row.identity_source)
      : "unknown",
    clientVerified: Number(row.client_verified) === 1,
    dates: parseStoredJson(row.dates_json, []).filter(parseDateValue),
    results: normalizeResults(parseStoredJson(row.results_json, [])),
    responseStatus: Number(row.response_status),
  }));
}

export async function pruneAgentAvailabilityAudit(env, now = Date.now()) {
  const database = auditDatabase(env);
  if (!database) throw new Error("missing_agent_audit_database");
  return database
    .prepare(`
      DELETE FROM agent_availability_audit
      WHERE requested_at <= ?
    `)
    .bind(now - AGENT_AUDIT_RETENTION_MS)
    .run();
}
