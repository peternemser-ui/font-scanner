-- Migration 019: Bug Reports & Reward Tokens (PostgreSQL)
-- Allows users to report data issues on scans and earn free report tokens.
--
-- NOTE: this is a late port of the SQLite-only migration of the same name.
-- Postgres reads exclusively from migrations/pg/, so bug_reports,
-- bug_reward_tokens and report_purchases.source never existed in production —
-- any bug report submission would have failed against a missing relation.

CREATE TABLE IF NOT EXISTS bug_reports (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_id TEXT,
  analyzer_type TEXT,
  scanned_url TEXT,
  category TEXT NOT NULL CHECK (category IN ('wrong_data','missing_section','display_issue','crash_error','other')),
  description TEXT NOT NULL,
  browser_info TEXT,
  context_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','duplicate')),
  admin_notes TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_user_id ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created_at ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user_url_analyzer ON bug_reports(user_id, scanned_url, analyzer_type);

CREATE TABLE IF NOT EXISTS bug_reward_tokens (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  bug_report_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed','expired','revoked')),
  redeemed_report_id TEXT,
  redeemed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bug_report_id) REFERENCES bug_reports(id) ON DELETE CASCADE,
  UNIQUE (bug_report_id)
);

CREATE INDEX IF NOT EXISTS idx_bug_reward_tokens_user_id ON bug_reward_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reward_tokens_status ON bug_reward_tokens(status);
CREATE INDEX IF NOT EXISTS idx_bug_reward_tokens_expires_at ON bug_reward_tokens(expires_at);

-- Distinguishes paid purchases from reward-token redemptions.
ALTER TABLE report_purchases ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'stripe';

INSERT INTO migrations (name) VALUES ('019_add_bug_reports_and_tokens');
