-- Social OAuth login providers (Google, Facebook, etc.)
CREATE TABLE IF NOT EXISTS social_logins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,            -- 'google', 'facebook'
  provider_user_id TEXT NOT NULL,    -- provider's unique user ID
  email TEXT,                        -- email from provider (for reference)
  display_name TEXT,                 -- name from provider
  avatar_url TEXT,                   -- profile picture URL
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_logins_user_id ON social_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_social_logins_provider ON social_logins(provider, provider_user_id);

INSERT INTO migrations (name) VALUES ('017_add_social_logins');
