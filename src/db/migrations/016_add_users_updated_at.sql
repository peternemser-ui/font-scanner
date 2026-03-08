-- Add updated_at column to users table (SQLite)

ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

INSERT INTO migrations (name) VALUES ('016_add_users_updated_at');
