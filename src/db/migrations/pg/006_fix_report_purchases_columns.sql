-- Migration: Fix report_purchases table with missing columns (PostgreSQL)

ALTER TABLE report_purchases ADD COLUMN IF NOT EXISTS site_url TEXT;
ALTER TABLE report_purchases ADD COLUMN IF NOT EXISTS analyzer_type TEXT;
ALTER TABLE report_purchases ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid';

INSERT INTO migrations (name) VALUES ('006_fix_report_purchases_columns');
