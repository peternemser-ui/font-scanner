-- Migration: Add locale column to scans table (PostgreSQL)

ALTER TABLE scans ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en';

INSERT INTO migrations (name) VALUES ('009_add_locale_to_scans');
