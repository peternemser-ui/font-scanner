-- Migration: SQLite Hardening
-- Date: 2026-01-30
-- Description: Add UNIQUE constraint on entitlements.user_id for ON CONFLICT support

-- SQLite doesn't support adding constraints to existing tables directly
-- So we need to create a unique index instead (which enforces uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_user_id_unique ON entitlements(user_id);

-- Insert migration record
INSERT INTO migrations (name) VALUES ('005_sqlite_hardening');
