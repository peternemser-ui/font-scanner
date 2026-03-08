-- Add updated_at column to users table (PostgreSQL)

ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

INSERT INTO migrations (name) VALUES ('016_add_users_updated_at');
