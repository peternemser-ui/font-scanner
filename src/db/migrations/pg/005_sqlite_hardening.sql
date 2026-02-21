-- Migration: Unique constraint on entitlements.user_id (PostgreSQL)
-- PostgreSQL supports ADD CONSTRAINT IF NOT EXISTS via DO block

CREATE UNIQUE INDEX IF NOT EXISTS idx_entitlements_user_id_unique ON entitlements(user_id);

INSERT INTO migrations (name) VALUES ('005_sqlite_hardening');
