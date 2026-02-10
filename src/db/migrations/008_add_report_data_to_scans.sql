-- Migration: Add report data storage to scans table
-- Date: 2026-02-06
-- Description: Adds report_id and result_json columns to the scans table
--              so that completed scan results can be recalled from the server
--              instead of relying solely on browser localStorage (24h expiry).

-- report_id links the scan to the deterministic report ID used by the frontend
ALTER TABLE scans ADD COLUMN report_id TEXT;

-- result_json stores the full API response JSON for report recall
ALTER TABLE scans ADD COLUMN result_json TEXT;

-- Index for fast lookup by report_id (used by GET /api/reports/:id)
CREATE INDEX IF NOT EXISTS idx_scans_report_id ON scans(report_id);
