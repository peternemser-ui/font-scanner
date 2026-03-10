-- Social OAuth login providers (Google, Facebook, etc.)
CREATE TABLE IF NOT EXISTS social_logins (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_logins_user_id ON social_logins(user_id);
CREATE INDEX IF NOT EXISTS idx_social_logins_provider ON social_logins(provider, provider_user_id);

INSERT INTO migrations (name) VALUES ('017_add_social_logins');
