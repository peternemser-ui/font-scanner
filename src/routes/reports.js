/**
 * Reports API Routes
 * Handles stored report retrieval and management
 */

const express = require('express');
const router = express.Router();
const { getDatabase } = require('../db');
const { requireAuth, optionalAuth } = require('../middleware/requireAuth');
const { requireReportAccess } = require('../middleware/entitlementGuard');
const { createLogger } = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');

const logger = createLogger('ReportsRoutes');

// ============================================================
// GET /api/reports/stats - Report statistics (for admin)
// ============================================================
router.get('/stats', asyncHandler(async (req, res) => {
  const db = getDatabase();
  const total = await db.get('SELECT COUNT(*) as count FROM scans WHERE result_json IS NOT NULL');
  res.json({
    success: true,
    stats: {
      totalReports: total?.count || 0
    }
  });
}));

// ============================================================
// GET /api/reports/owned - Get all reports owned by the user
// Returns purchased reports + reports saved during active plan
// ============================================================
router.get('/owned', requireAuth, asyncHandler(async (req, res) => {
  const db = getDatabase();
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  // Get reports from scans table (user's own scans with saved results)
  const scans = await db.all(
    `SELECT report_id, target_url, options_json, created_at
     FROM scans
     WHERE user_id = ? AND result_json IS NOT NULL AND report_id IS NOT NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  // Get purchased report IDs
  const purchases = await db.all(
    'SELECT report_id, site_url, analyzer_type, purchased_at FROM report_purchases WHERE user_id = ? ORDER BY purchased_at DESC',
    [userId]
  );
  const purchasedIds = new Set(purchases.map(p => p.report_id));

  // Merge: scans + purchases (deduped)
  const reportMap = new Map();

  // Add scans first
  for (const scan of scans) {
    let analyzerType = 'full';
    if (scan.options_json) {
      try {
        const opts = JSON.parse(scan.options_json);
        analyzerType = opts.analyzerType || opts.analyzer || opts.type || 'full';
      } catch (e) { /* ignore */ }
    }

    reportMap.set(scan.report_id, {
      reportId: scan.report_id,
      siteUrl: scan.target_url,
      analyzerType,
      createdAt: scan.created_at,
      ownedVia: purchasedIds.has(scan.report_id) ? 'purchased' : 'plan'
    });
  }

  // Add purchased reports not already in scans
  for (const p of purchases) {
    if (!reportMap.has(p.report_id)) {
      reportMap.set(p.report_id, {
        reportId: p.report_id,
        siteUrl: p.site_url || '',
        analyzerType: p.analyzer_type || 'unknown',
        createdAt: p.purchased_at,
        ownedVia: 'purchased'
      });
    }
  }

  const reports = Array.from(reportMap.values());
  reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    success: true,
    reports: reports.slice(0, limit),
    total: reports.length,
    offset,
    limit
  });
}));

// ============================================================
// GET /api/reports/:id - Get a specific report by report_id
// Requires authentication + report access check
// ============================================================
router.get('/:id', requireAuth, requireReportAccess, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  logger.info('Report requested', { reportId: id, userId: userId.substring(0, 8) + '...' });

  const db = getDatabase();

  // Look up by report_id in scans table
  const scan = await db.get(
    `SELECT id, target_url, report_id, result_json, options_json, user_id, locale, created_at
     FROM scans
     WHERE report_id = ? AND result_json IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [id]
  );

  if (!scan || !scan.result_json) {
    return res.status(404).json({
      success: false,
      error: 'Report not found'
    });
  }

  // Parse the stored result JSON
  let resultData;
  try {
    resultData = JSON.parse(scan.result_json);
  } catch (e) {
    logger.error('Failed to parse stored report JSON', { reportId: id, error: e.message });
    return res.status(500).json({
      success: false,
      error: 'Stored report data is corrupted'
    });
  }

  res.json({
    success: true,
    reportId: scan.report_id,
    siteUrl: scan.target_url,
    locale: scan.locale || 'en',
    createdAt: scan.created_at,
    data: resultData,
    access: req.reportAccess
  });
}));

module.exports = router;
