-- Migration: Add report data storage to scans table (PostgreSQL)

ALTER TABLE scans ADD COLUMN IF NOT EXISTS report_id TEXT;
ALTER TABLE scans ADD COLUMN IF NOT EXISTS result_json TEXT;

CREATE INDEX IF NOT EXISTS idx_scans_report_id ON scans(report_id);

INSERT INTO migrations (name) VALUES ('008_add_report_data_to_scans');
