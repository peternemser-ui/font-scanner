-- Migration: Add Subscription Billing Fields (PostgreSQL)

ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_current_period_end TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_interval TEXT;

CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(stripe_subscription_status);

CREATE TABLE IF NOT EXISTS report_purchases (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_report_purchases_user_id ON report_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_report_purchases_report_id ON report_purchases(report_id);

INSERT INTO migrations (name) VALUES ('003_add_subscription_billing');
