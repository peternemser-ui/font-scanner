-- Migration: SQLite Hardening + Report Versioning
-- Date: 2026-01-30
-- Description: Adds indexes for query performance and versioning fields for reports

-- ============================================================
-- ADDITIONAL INDEXES FOR QUERY PERFORMANCE
-- ============================================================

-- Composite index for user report history queries
CREATE INDEX IF NOT EXISTS idx_scans_user_created ON scans(user_id, created_at DESC);

-- Index for URL lookups (caching/deduplication)
CREATE INDEX IF NOT EXISTS idx_scans_target_url ON scans(target_url);

-- Composite index for entitlement expiry checks
CREATE INDEX IF NOT EXISTS idx_entitlements_user_expires ON entitlements(user_id, valid_until);

-- Index for scan_results by scan_id and type (common query pattern)
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_type ON scan_results(scan_id, result_type);

-- ============================================================
-- REPORT VERSIONING FIELDS
-- ============================================================
-- Track analyzer/schema/renderer versions for reproducibility and upgrade paths

ALTER TABLE scans ADD COLUMN analyzer_version TEXT;
ALTER TABLE scans ADD COLUMN schema_version TEXT DEFAULT '1.0';
ALTER TABLE scans ADD COLUMN renderer_version TEXT;

-- ============================================================
-- REPORT ARTIFACTS TABLE
-- ============================================================
-- Stores metadata + filesystem paths for large artifacts (screenshots, raw JSON)
-- Actual data lives on filesystem, not in SQLite rows

CREATE TABLE IF NOT EXISTS report_artifacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL,
  artifact_type TEXT NOT NULL,        -- screenshot, lighthouse_json, pdf, etc.
  file_path TEXT NOT NULL,            -- Relative path from artifacts dir
  file_size INTEGER,                  -- Bytes
  mime_type TEXT,
  metadata_json TEXT,                 -- Extra info (dimensions, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_report_artifacts_scan_id ON report_artifacts(scan_id);
CREATE INDEX IF NOT EXISTS idx_report_artifacts_type ON report_artifacts(scan_id, artifact_type);

-- Insert migration record
INSERT INTO migrations (name) VALUES ('005_sqlite_hardening');
