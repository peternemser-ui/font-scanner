-- Migration: Add Subscription Billing Fields
-- Date: 2026-01-21
-- Description: Adds subscription tracking columns to users table and report_purchases table

-- Add subscription tracking columns to users table
-- These columns track the user's Stripe subscription state locally for fast lookups
ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN stripe_subscription_status TEXT;
ALTER TABLE users ADD COLUMN stripe_current_period_end DATETIME;
ALTER TABLE users ADD COLUMN stripe_subscription_interval TEXT;

-- Create index for faster subscription status lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON users(stripe_subscription_status);

-- Create report_purchases table for single report unlocks (linked to users)
-- Each row represents a user purchasing access to a specific report
CREATE TABLE IF NOT EXISTS report_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  report_id TEXT NOT NULL,
  stripe_checkout_session_id TEXT,
  purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, report_id)
);

-- Indexes for efficient lookup
CREATE INDEX IF NOT EXISTS idx_report_purchases_user_id ON report_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_report_purchases_report_id ON report_purchases(report_id);

-- Insert migration record
INSERT INTO migrations (name) VALUES ('003_add_subscription_billing');
