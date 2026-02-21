-- Migration 010: Add composite index for fast URL history lookups (PostgreSQL)

CREATE INDEX IF NOT EXISTS idx_scans_url_user_date
  ON scans (target_url, user_id, created_at DESC);

INSERT INTO migrations (name) VALUES ('010_add_scan_history_indexes');
