-- Migration 013: Recommendation feedback (thumbs up/down) and aggregate scores
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id TEXT NOT NULL,
  recommendation_id TEXT NOT NULL,
  recommendation_type TEXT NOT NULL DEFAULT 'static',
  user_id TEXT,
  anon_id TEXT,
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(report_id, recommendation_id, user_id),
  UNIQUE(report_id, recommendation_id, anon_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_report
  ON recommendation_feedback (report_id);

CREATE INDEX IF NOT EXISTS idx_feedback_recommendation
  ON recommendation_feedback (recommendation_id);

-- Aggregate view for recommendation scores
CREATE VIEW IF NOT EXISTS recommendation_scores AS
SELECT
  recommendation_id,
  recommendation_type,
  SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS upvotes,
  SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS downvotes,
  SUM(vote) AS net_score,
  COUNT(*) AS total_votes
FROM recommendation_feedback
GROUP BY recommendation_id, recommendation_type;

INSERT INTO migrations (name) VALUES ('013_add_recommendation_feedback');
