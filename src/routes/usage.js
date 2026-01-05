/**
 * Usage Stats API Routes
 * Provides user usage statistics (scans, credits, etc.)
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { getDatabase } = require('../db');

/**
 * GET /api/usage/stats
 * Get current user's usage statistics
 */
router.get('/stats', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString();

    // Count scans today
    const scansToday = await db.get(
      'SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND created_at >= ? AND created_at < ?',
      [userId, todayISO, tomorrowISO]
    );

    // Count total scans ever
    const totalScans = await db.get(
      'SELECT COUNT(*) as count FROM scans WHERE user_id = ?',
      [userId]
    );

    // Get entitlements (credits, limits)
    const entitlement = await db.get(
      'SELECT * FROM entitlements WHERE user_id = ? AND (valid_until IS NULL OR valid_until > datetime("now")) ORDER BY created_at DESC LIMIT 1',
      [userId]
    );

    // Calculate remaining scans
    const plan = req.user.plan || 'free';
    const isPro = plan === 'pro';
    const dailyLimit = isPro ? -1 : 25; // -1 = unlimited
    const scansRemainingToday = isPro ? -1 : Math.max(0, dailyLimit - (scansToday?.count || 0));

    // Response
    res.json({
      success: true,
      plan: plan,
      isPro: isPro,
      scansToday: scansToday?.count || 0,
      totalScans: totalScans?.count || 0,
      dailyLimit: dailyLimit,
      scansRemaining: scansRemainingToday,
      entitlement: entitlement ? {
        scansRemaining: entitlement.scans_remaining,
        maxPagesPerScan: entitlement.max_pages_per_scan,
        pdfExportEnabled: entitlement.pdf_export_enabled === 1,
        validUntil: entitlement.valid_until
      } : null
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
 * POST /api/usage/track-scan
 * Track a scan for usage limits (called after scan starts)
 */
router.post('/track-scan', requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;
    const { scanId, url } = req.body;

    // Check daily limit (free tier only)
    const isPro = req.user.plan === 'pro';
    if (!isPro) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowISO = tomorrow.toISOString();

      const scansToday = await db.get(
        'SELECT COUNT(*) as count FROM scans WHERE user_id = ? AND created_at >= ? AND created_at < ?',
        [userId, todayISO, tomorrowISO]
      );

      if (scansToday.count >= 25) {
        return res.status(429).json({
          success: false,
          error: 'Daily scan limit reached (25 scans). Upgrade to Pro for unlimited scans.',
          upgradeUrl: '/upgrade.html'
        });
      }
    }

    res.json({
      success: true,
      message: 'Scan tracked successfully'
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
