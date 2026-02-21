-- Migration 007: Usage Tracking (PostgreSQL)

CREATE TABLE IF NOT EXISTS usage_tracking (
  id SERIAL PRIMARY KEY,
  user_id TEXT,
  anon_id TEXT,
  scans_used_today INTEGER DEFAULT 0,
  scans_reset_at TIMESTAMPTZ NOT NULL,
  reports_used_in_window INTEGER DEFAULT 0,
  report_window_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CHECK (
    (user_id IS NOT NULL AND anon_id IS NULL) OR
    (user_id IS NULL AND anon_id IS NOT NULL)
  ),
  UNIQUE(user_id),
  UNIQUE(anon_id)
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_anon_id ON usage_tracking(anon_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_scans_reset ON usage_tracking(scans_reset_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_report_window ON usage_tracking(report_window_ends_at);

INSERT INTO migrations (name) VALUES ('007_usage_tracking');
