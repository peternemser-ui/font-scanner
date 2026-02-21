-- Migration: Add Authentication Fields (PostgreSQL)

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  stripe_price_id TEXT UNIQUE,
  features_json TEXT,
  max_scans_per_month INTEGER DEFAULT -1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO subscription_plans (id, name, price_cents, stripe_price_id, features_json, max_scans_per_month)
VALUES
  ('free', 'Free', 0, NULL, '{"pro_features": false, "max_pages": 1, "pdf_export": false}', 3),
  ('pro', 'Pro', 2900, 'price_xxx', '{"pro_features": true, "max_pages": 250, "pdf_export": true, "priority_support": true}', -1)
ON CONFLICT DO NOTHING;

ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE entitlements ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

INSERT INTO migrations (name) VALUES ('001_add_authentication');
