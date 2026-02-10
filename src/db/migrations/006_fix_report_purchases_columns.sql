-- Migration: Fix report_purchases table with missing columns
-- Date: 2026-02-01
-- Description: Adds site_url and analyzer_type columns that are used by stripeService.js
--              but were missing from the original migration.

-- Add site_url column for tracking which site the report was for
ALTER TABLE report_purchases ADD COLUMN site_url TEXT;

-- Add analyzer_type column for tracking which analyzer generated the report
ALTER TABLE report_purchases ADD COLUMN analyzer_type TEXT;

-- Add status column to track payment state (paid, refunded, disputed)
ALTER TABLE report_purchases ADD COLUMN status TEXT DEFAULT 'paid';

-- Update entitlements table to have status and current_period_end columns
-- (These are already being used by stripeService but may not exist)

-- Note: SQLite doesn't support IF NOT EXISTS for ALTER TABLE ADD COLUMN
-- The migration runner handles duplicate column errors gracefully.
