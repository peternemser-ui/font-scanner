-- Migration 015: Add composite indexes for user-facing query performance (PostgreSQL)
-- Date: 2026-03-05
-- Description: Three composite indexes that eliminate sequential scans on the
--              most common user-facing queries: scan history, purchased-report
--              listing, and paginated result fetching by scan + type.
--
-- Rationale:
--   1. idx_scans_user_id_created_at
--      Query pattern: SELECT ... FROM scans WHERE user_id = ? ORDER BY created_at DESC
--      Without this index the planner uses idx_scans_user_id, fetches all rows for
--      the user, then sorts. The composite index with DESC created_at makes the sort
--      free and avoids the extra sort step for the common "latest scans first" display.
--
--   2. idx_report_purchases_user_purchased
--      Query pattern: SELECT ... FROM report_purchases WHERE user_id = ? ORDER BY purchased_at DESC
--      idx_report_purchases_user_id (single-column) already covers the filter, but
--      does not cover the sort. The composite avoids a post-filter sort on the result set.
--
--   3. idx_scan_results_scan_id_type
--      Query pattern: SELECT ... FROM scan_results WHERE scan_id = ? AND result_type = ?
--      idx_scan_results_scan_id (single-column) covers the outer filter but forces a
--      second pass to filter result_type. The composite resolves both predicates in
--      one index lookup and supports paginated fetching with LIMIT/OFFSET.
--
-- PostgreSQL notes:
--   - CREATE INDEX IF NOT EXISTS is supported from PostgreSQL 9.5+.
--   - DESC on non-leading index columns is meaningful in PostgreSQL; the planner will
--     use a backward index scan for ASC queries on the same column, so there is no
--     need for a separate ASC variant.
--   - These indexes are safe to create CONCURRENTLY in production to avoid table locks.
--     Replace CREATE INDEX with CREATE INDEX CONCURRENTLY for a live migration.

-- --------------------------------------------------------
-- 1. User scan history: filter by user, order newest first
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scans_user_id_created_at
  ON scans (user_id, created_at DESC);

-- --------------------------------------------------------
-- 2. User purchased reports: filter by user, order newest purchase first
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_report_purchases_user_purchased
  ON report_purchases (user_id, purchased_at DESC);

-- --------------------------------------------------------
-- 3. Scan result fetching: filter by scan + result type (paginated)
-- --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id_type
  ON scan_results (scan_id, result_type);

-- Record migration
INSERT INTO migrations (name) VALUES ('015_add_user_facing_composite_indexes');
