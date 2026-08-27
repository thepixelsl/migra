CREATE TABLE IF NOT EXISTS agent_availability_audit (
  id TEXT PRIMARY KEY,
  requested_at INTEGER NOT NULL,
  client_label TEXT NOT NULL,
  identity_source TEXT NOT NULL,
  client_verified INTEGER NOT NULL DEFAULT 0,
  dates_json TEXT NOT NULL,
  results_json TEXT NOT NULL,
  response_status INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_availability_audit_time
  ON agent_availability_audit (requested_at);
