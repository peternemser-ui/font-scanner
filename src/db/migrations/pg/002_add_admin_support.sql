-- Add admin support (PostgreSQL)

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin);

CREATE TABLE IF NOT EXISTS admin_activity_log (
  id SERIAL PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_id TEXT,
  details_json TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_id ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_created_at ON admin_activity_log(created_at DESC);

INSERT INTO migrations (name) VALUES ('002_add_admin_support');
