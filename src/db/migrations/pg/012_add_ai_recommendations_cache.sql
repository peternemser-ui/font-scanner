-- Migration 012: AI recommendations cache table (PostgreSQL)

CREATE TABLE IF NOT EXISTS ai_recommendations (
  id SERIAL PRIMARY KEY,
  report_id TEXT NOT NULL,
  analyzer_type TEXT NOT NULL,
  recommendations_json TEXT NOT NULL,
  model_id TEXT NOT NULL,
  locale TEXT DEFAULT 'en',
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_report
  ON ai_recommendations (report_id);

CREATE INDEX IF NOT EXISTS idx_ai_recommendations_expires
  ON ai_recommendations (expires_at);

INSERT INTO migrations (name) VALUES ('012_add_ai_recommendations_cache');
