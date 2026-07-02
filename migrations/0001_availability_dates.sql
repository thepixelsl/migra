CREATE TABLE IF NOT EXISTS availability_dates (
  date TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('available', 'unavailable')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_availability_dates_status
  ON availability_dates (status);
