-- Migration 019: Bug Reports & Reward Tokens
-- Allows users to report data issues on scans and earn free report tokens

CREATE TABLE IF NOT EXISTS bug_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  report_id TEXT,
  analyzer_type TEXT,
  scanned_url TEXT,
  category TEXT NOT NULL CHECK(category IN ('wrong_data','missing_section','display_issue','crash_error','other')),
  description TEXT NOT NULL,
  browser_info TEXT,
  context_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','duplicate')),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_url_analyzer ON bug_reports(user_id, scanned_url, analyzer_type);

CREATE TABLE IF NOT EXISTS bug_reward_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  bug_report_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','redeemed','expired','revoked')),
  redeemed_report_id TEXT,
  redeemed_at DATETIME,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bug_report_id) REFERENCES bug_reports(id) ON DELETE CASCADE,
  UNIQUE(bug_report_id)
);

CREATE INDEX IF NOT EXISTS idx_bug_reward_tokens_user_id ON bug_reward_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reward_tokens_status ON bug_reward_tokens(status);
CREATE INDEX IF NOT EXISTS idx_bug_reward_tokens_expires_at ON bug_reward_tokens(expires_at);

-- Add source column to report_purchases to distinguish paid vs reward tokens
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a safe approach
-- that silently fails if the column already exists
ALTER TABLE report_purchases ADD COLUMN source TEXT DEFAULT 'stripe';

INSERT INTO migrations (name) VALUES ('019_add_bug_reports_and_tokens');
