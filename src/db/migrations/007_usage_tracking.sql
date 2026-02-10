-- Migration 007: Usage Tracking
-- Adds usage_tracking table for scan and report quota enforcement
-- Supports both authenticated users (user_id) and anonymous users (anon_id)

-- Usage tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  -- User identification (mutually exclusive: one must be set, not both)
  user_id TEXT,                           -- For authenticated users (FK to users.id)
  anon_id TEXT,                           -- For anonymous users (cookie-based UUID)

  -- Scan usage (daily quota)
  scans_used_today INTEGER DEFAULT 0,
  scans_reset_at DATETIME NOT NULL,       -- Next reset time (midnight UTC)

  -- Report usage (billing period or pass window)
  reports_used_in_window INTEGER DEFAULT 0,
  report_window_ends_at DATETIME,         -- Billing period end or day pass expiry

  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  -- Constraints
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  -- Ensure exactly one identifier is set (user_id XOR anon_id)
  CHECK (
    (user_id IS NOT NULL AND anon_id IS NULL) OR
    (user_id IS NULL AND anon_id IS NOT NULL)
  ),

  -- Unique constraints to prevent duplicates
  UNIQUE(user_id),
  UNIQUE(anon_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_id ON usage_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_anon_id ON usage_tracking(anon_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_scans_reset ON usage_tracking(scans_reset_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_report_window ON usage_tracking(report_window_ends_at);
