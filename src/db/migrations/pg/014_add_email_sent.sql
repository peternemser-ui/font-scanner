-- Migration: Add email_sent tracking to report_purchases
-- Prevents duplicate emails on Stripe webhook retries

ALTER TABLE report_purchases ADD COLUMN IF NOT EXISTS email_sent INTEGER DEFAULT 0;
ALTER TABLE report_purchases ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- Insert migration record
INSERT INTO migrations (name) VALUES ('014_add_email_sent');
