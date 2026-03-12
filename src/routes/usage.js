/**
 * Usage Stats API Routes
 * Provides user usage statistics (scans, credits, etc.)
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { getDatabase } = require('../db');
const { PRICING, getPlanLimits } = require('../config/pricing');
const { getFullEntitlements } = require('../utils/entitlements');
const { toISODate } = require('../utils/formatHelpers');

/**
 * GET /api/usage/stats
 * Get current user's usage statistics
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    // Use canonical resolver for plan detection
    const full = await getFullEntitlements(userId);
    const isPro = full.plan === 'pro' || full.plan === 'day_pass';

    // Count total scans ever
    const totalScans = await db.get(
      'SELECT COUNT(*) as count FROM scans WHERE user_id = ?',
      [userId]
    );

    const limits = getPlanLimits(full.planCode);

    res.json({
      success: true,
      plan: full.plan,
      isPro,
      scansToday: full.usage.scansUsedToday,
      totalScans: totalScans?.count || 0,
      dailyLimit: full.usage.scanLimitDaily,
      scansRemaining: full.usage.scansRemainingToday,
      entitlement: {
        scansRemaining: full.usage.scansRemainingToday,
        maxPagesPerScan: limits.pagesPerCrawl,
        pdfExportEnabled: limits.pdfExport,
        validUntil: full.currentPeriodEnd
      }
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch usage statistics'
    });
  }
});

/**
 * GET /api/usage/recent-scans
 * Get user's recent scans for account/reports page
 */
router.get('/recent-scans', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);

    // Get recent scans for this user
    const scans = await db.all(
      `SELECT id, report_id, target_url, status, options_json, created_at, finished_at
       FROM scans
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, limit]
    );

    // Check which scans have been individually purchased
    const purchasedIds = new Set();
    try {
      const rows = await db.all(
        'SELECT report_id FROM report_purchases WHERE user_id = ?',
        [userId]
      );
      rows.forEach(r => purchasedIds.add(r.report_id));
    } catch (e) {
      // report_purchases table may not exist yet
    }

    res.json({
      success: true,
      scans: scans.map(scan => {
        // Try to extract analyzer type from options_json
        let analyzerType = 'full';
        if (scan.options_json) {
          try {
            const opts = JSON.parse(scan.options_json);
            analyzerType = opts.analyzerType || opts.analyzer || opts.type || 'full';
          } catch (e) { /* ignore parse errors */ }
        }

        return {
          id: scan.report_id || scan.id,
          siteUrl: scan.target_url,
          analyzerType,
          status: scan.status || 'completed',
          isPurchased: purchasedIds.has(scan.report_id || scan.id),
          createdAt: toISODate(scan.created_at),
          finishedAt: toISODate(scan.finished_at)
        };
      })
    });
  } catch (error) {
    console.error('Error fetching recent scans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent scans'
    });
  }
});

/**
 * POST /api/usage/track-scan
 * Track a scan for usage limits (called after scan starts)
 */
router.post('/track-scan', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { url } = req.body;

    // Use canonical resolver for plan detection
    const full = await getFullEntitlements(userId);
    const isPro = full.plan === 'pro' || full.plan === 'day_pass';
    const scanLimit = full.usage.scanLimitDaily;

    if (!isPro && full.usage.scansRemainingToday <= 0) {
      return res.status(429).json({
        success: false,
        error: `Daily scan limit reached (${scanLimit} scans). Upgrade to Pro for unlimited scans.`,
        upgradeUrl: '/upgrade.html'
      });
    }

    // Record the scan in the database
    const scanId = require('crypto').randomUUID();
    await db.run(
      `INSERT INTO scans (id, user_id, target_url, status, created_at)
       VALUES (?, ?, ?, 'completed', datetime('now'))`,
      [scanId, userId, url || 'unknown']
    );

    const usageService = require('../services/usageService');
    const updated = await usageService.incrementScanUsage(userId, null);

    res.json({
      success: true,
      message: 'Scan tracked successfully',
      scansToday: updated.scansUsedToday,
      scansRemaining: isPro ? -1 : Math.max(0, scanLimit - updated.scansUsedToday)
    });
  } catch (error) {
    console.error('Error tracking scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track scan'
    });
  }
});

module.exports = router;
