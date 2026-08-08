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
];

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

  return {
    client,
    persistent: configuration.persistent,
    async ready() {
      await client.execute("SELECT 1");
      return true;
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
