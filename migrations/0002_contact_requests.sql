CREATE TABLE IF NOT EXISTS contact_requests (
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
  source_path TEXT,
  user_agent TEXT,
  ip_hash TEXT
);

CREATE INDEX IF NOT EXISTS idx_contact_requests_created_at
  ON contact_requests (created_at);

CREATE INDEX IF NOT EXISTS idx_contact_requests_email
  ON contact_requests (email);

CREATE INDEX IF NOT EXISTS idx_contact_requests_ip_hash
  ON contact_requests (ip_hash);
