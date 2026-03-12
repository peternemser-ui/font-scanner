-- Make report_id unique on scans table so upsert (ON CONFLICT) works correctly
-- Remove duplicate report_ids first (keep the latest entry per report_id)
DELETE FROM scans s
USING (
  SELECT report_id, MAX(created_at) AS max_created
  FROM scans
  WHERE report_id IS NOT NULL
  GROUP BY report_id
  HAVING COUNT(*) > 1
) dupes
WHERE s.report_id = dupes.report_id
  AND s.created_at < dupes.max_created;

-- Drop the non-unique index and create a unique one (partial: only non-null report_ids)
DROP INDEX IF EXISTS idx_scans_report_id;
CREATE UNIQUE INDEX IF NOT EXISTS idx_scans_report_id ON scans(report_id) WHERE report_id IS NOT NULL;
