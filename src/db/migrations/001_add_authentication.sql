-- Migration: Add Authentication Fields
-- Date: 2026-01-03
-- Description: Adds password authentication, sessions, and subscription plans

-- Add password_hash to users table (if not exists)
-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- So we'll check in code before running this
ALTER TABLE users ADD COLUMN password_hash TEXT;

-- Sessions table for JWT alternative (optional but useful for session management)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT UNIQUE,
  features_json TEXT,
  max_scans_per_month INTEGER DEFAULT -1, -- -1 = unlimited
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert default plans
INSERT OR IGNORE INTO subscription_plans (id, name, price_cents, stripe_price_id, features_json, max_scans_per_month)
VALUES
  ('free', 'Free', 0, NULL, '{"pro_features": false, "max_pages": 1, "pdf_export": false}', 3),
  ('pro', 'Pro', 2900, 'price_xxx', '{"pro_features": true, "max_pages": 250, "pdf_export": true, "priority_support": true}', -1);

-- Update entitlements table to track subscription status
ALTER TABLE entitlements ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE entitlements ADD COLUMN current_period_end DATETIME;

-- Insert migration record
INSERT INTO migrations (name) VALUES ('001_add_authentication');
