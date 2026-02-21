-- Migration 011: Benchmark statistics table (PostgreSQL)

CREATE TABLE IF NOT EXISTS benchmark_stats (
  id SERIAL PRIMARY KEY,
  analyzer_type TEXT NOT NULL,
  score_field TEXT NOT NULL,
  bucket_0   INTEGER DEFAULT 0,
  bucket_10  INTEGER DEFAULT 0,
  bucket_20  INTEGER DEFAULT 0,
  bucket_30  INTEGER DEFAULT 0,
  bucket_40  INTEGER DEFAULT 0,
  bucket_50  INTEGER DEFAULT 0,
  bucket_60  INTEGER DEFAULT 0,
  bucket_70  INTEGER DEFAULT 0,
  bucket_80  INTEGER DEFAULT 0,
  bucket_90  INTEGER DEFAULT 0,
  total_scans INTEGER DEFAULT 0,
  mean_score DOUBLE PRECISION DEFAULT 0,
  median_score DOUBLE PRECISION DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(analyzer_type, score_field)
);

INSERT INTO migrations (name) VALUES ('011_add_benchmark_stats');
