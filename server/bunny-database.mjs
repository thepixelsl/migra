import { createClient } from "@libsql/client";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS contact_requests (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'new',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    request_type TEXT,
    event_date TEXT,
    location TEXT,
    coverage TEXT,
    guest_count TEXT,
    referral TEXT,
    message TEXT NOT NULL,
    security_year TEXT,
    attachment_count TEXT,
    attachment_names TEXT,
    source_path TEXT,
    user_agent TEXT,
    ip_hash TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at
    ON contact_requests (created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_contact_requests_email
    ON contact_requests (email)`,
  `CREATE INDEX IF NOT EXISTS idx_contact_requests_ip_hash
    ON contact_requests (ip_hash)`,
  `CREATE TABLE IF NOT EXISTS agent_availability_requests (
    id TEXT PRIMARY KEY,
    ip_hash TEXT NOT NULL,
    requested_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_availability_requests_ip_time
    ON agent_availability_requests (ip_hash, requested_at)`,
  `CREATE INDEX IF NOT EXISTS idx_agent_availability_requests_time
    ON agent_availability_requests (requested_at)`,
  `CREATE TABLE IF NOT EXISTS agent_availability_audit (
    id TEXT PRIMARY KEY,
    requested_at INTEGER NOT NULL,
    client_label TEXT NOT NULL,
    identity_source TEXT NOT NULL,
    client_verified INTEGER NOT NULL DEFAULT 0,
    dates_json TEXT NOT NULL,
    results_json TEXT NOT NULL,
    response_status INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_agent_availability_audit_time
    ON agent_availability_audit (requested_at)`,
];

const CONTACT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const AGENT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const AGENT_AUDIT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

async function pruneContactRequests(client) {
  await client.execute(`
    UPDATE contact_requests
    SET ip_hash = NULL,
        user_agent = NULL,
        security_year = NULL
    WHERE created_at < datetime('now', '-15 minutes')
      AND (ip_hash IS NOT NULL OR user_agent IS NOT NULL OR security_year IS NOT NULL)
  `);
  await client.execute(`
    DELETE FROM contact_requests
    WHERE created_at < datetime('now', '-30 days')
  `);
}

async function pruneAgentAvailabilityRequests(client, now = Date.now()) {
  await client.execute({
    sql: `DELETE FROM agent_availability_requests
      WHERE requested_at <= ?`,
    args: [now - AGENT_RATE_LIMIT_WINDOW_MS],
  });
}

async function pruneAgentAvailabilityAudit(client, now = Date.now()) {
  await client.execute({
    sql: `DELETE FROM agent_availability_audit
      WHERE requested_at <= ?`,
    args: [now - AGENT_AUDIT_RETENTION_MS],
  });
}

async function pruneStoredData(client) {
  await pruneContactRequests(client);
  await pruneAgentAvailabilityRequests(client);
  await pruneAgentAvailabilityAudit(client);
}

function requiredText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function databaseConfiguration(env = process.env) {
  const remoteUrl = requiredText(env.BUNNY_DATABASE_URL || env.DB_URL);
  const authToken = requiredText(env.BUNNY_DATABASE_AUTH_TOKEN || env.DB_TOKEN);

  if (!remoteUrl && env.BUNNY_ALLOW_EPHEMERAL_DATABASE !== "true") {
    throw new Error(
      "BUNNY_DATABASE_URL is required. Set BUNNY_ALLOW_EPHEMERAL_DATABASE=true only for disposable local tests.",
    );
  }

  return {
    url: remoteUrl || "file:/tmp/artbild-dev.db",
    authToken: authToken || undefined,
    persistent: Boolean(remoteUrl),
  };
}

export async function createBunnyDatabase(env = process.env) {
  const configuration = databaseConfiguration(env);
  const client = createClient({
    url: configuration.url,
    ...(configuration.authToken ? { authToken: configuration.authToken } : {}),
  });

  for (const statement of SCHEMA_STATEMENTS) {
    await client.execute(statement);
  }

  await pruneStoredData(client);
  const cleanupTimer = setInterval(() => {
    pruneStoredData(client).catch((error) => {
      console.error("Stored data cleanup failed", error);
    });
  }, CONTACT_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref?.();

  return {
    client,
    persistent: configuration.persistent,
    async ready() {
      await client.execute("SELECT 1");
      return true;
    },
    async cleanupContactRequests() {
      await pruneContactRequests(client);
    },
    async cleanupAgentAvailabilityRequests(now) {
      await pruneAgentAvailabilityRequests(client, now);
    },
    async cleanupAgentAvailabilityAudit(now) {
      await pruneAgentAvailabilityAudit(client, now);
    },
    close() {
      clearInterval(cleanupTimer);
      client.close?.();
    },
    d1: createD1Adapter(client),
    kv: createKvAdapter(client),
  };
}

export function createD1Adapter(client) {
  return {
    prepare(sql) {
      let args = [];

      const statement = {
        bind(...values) {
          args = values;
          return statement;
        },
        async first() {
          const result = await client.execute({ sql, args });
          return result.rows[0] ?? null;
        },
        async run() {
          return client.execute({ sql, args });
        },
        async all() {
          const result = await client.execute({ sql, args });
          return { results: result.rows };
        },
      };

      return statement;
    },
  };
}

export function createKvAdapter(client) {
  return {
    async get(key) {
      const result = await client.execute({
        sql: "SELECT value FROM app_kv WHERE key = ? LIMIT 1",
        args: [String(key)],
      });
      return result.rows[0]?.value ?? null;
    },
    async put(key, value) {
      await client.execute({
        sql: `INSERT INTO app_kv (key, value, updated_at)
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = CURRENT_TIMESTAMP`,
        args: [String(key), String(value)],
      });
    },
  };
}
