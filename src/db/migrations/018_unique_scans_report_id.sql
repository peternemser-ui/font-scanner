-- Make report_id unique on scans table so upsert (ON CONFLICT) works correctly
-- Remove duplicate report_ids first (keep the latest entry)
DELETE FROM scans WHERE rowid NOT IN (
  SELECT MAX(rowid) FROM scans WHERE report_id IS NOT NULL GROUP BY report_id
) AND report_id IS NOT NULL;

-- Drop the non-unique index and create a unique one
DROP INDEX IF EXISTS idx_scans_report_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_report_id ON scans(report_id) WHERE report_id IS NOT NULL;
