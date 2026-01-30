-- Migration: Add unique constraint to entitlements.user_id
-- Date: 2026-01-30
-- Description: Enables ON CONFLICT(user_id) for upsert operations in webhook handlers

-- Add status and current_period_end columns if missing
ALTER TABLE entitlements ADD COLUMN status TEXT;
ALTER TABLE entitlements ADD COLUMN current_period_end DATETIME;

-- SQLite doesn't support adding a unique constraint directly.
-- We recreate the table with the constraint in place.
-- First, preserve existing data.

CREATE TABLE IF NOT EXISTS entitlements_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,       -- Now UNIQUE for ON CONFLICT support
  plan TEXT NOT NULL DEFAULT 'free',
  scans_remaining INTEGER NOT NULL DEFAULT 0,
  max_pages_per_scan INTEGER NOT NULL DEFAULT 10,
  pdf_export_enabled INTEGER DEFAULT 0,
  valid_from DATETIME DEFAULT CURRENT_TIMESTAMP,
  valid_until DATETIME,
  stripe_subscription_id TEXT,
  status TEXT,
  current_period_end DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Copy data (only the first row per user_id to satisfy unique constraint)
INSERT OR IGNORE INTO entitlements_new (
  id, user_id, plan, scans_remaining, max_pages_per_scan, pdf_export_enabled,
  valid_from, valid_until, stripe_subscription_id, status, current_period_end,
  created_at, updated_at
)
SELECT
  id, user_id, plan, scans_remaining, max_pages_per_scan, pdf_export_enabled,
  valid_from, valid_until, stripe_subscription_id, status, current_period_end,
  created_at, updated_at
FROM entitlements;

-- Swap tables
DROP TABLE entitlements;
ALTER TABLE entitlements_new RENAME TO entitlements;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_entitlements_user_id ON entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_entitlements_valid_until ON entitlements(valid_until);
CREATE INDEX IF NOT EXISTS idx_entitlements_status ON entitlements(status);

-- Record migration
INSERT INTO migrations (name) VALUES ('004_add_entitlements_unique_constraint');
