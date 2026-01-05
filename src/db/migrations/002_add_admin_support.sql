-- Add admin support to users table
-- This migration adds the is_admin column to enable admin users

ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0;

-- Create an index for faster admin user lookups
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

-- Add admin activity log table for auditing
CREATE TABLE IF NOT EXISTS admin_activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  details_json TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at DESC);
