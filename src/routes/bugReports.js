/**
 * Bug Report API Routes
 * POST /api/bugs         — submit a bug report
 * GET  /api/bugs/my      — user's own reports + token balance
 * POST /api/bugs/redeem-token — redeem token for report unlock
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const bugReportService = require('../services/bugReportService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BugReportRoutes');

// All routes require authentication
router.use(requireAuth);

/**
 * POST /api/bugs — Submit a bug report
 */
router.post('/', async (req, res) => {
  try {
    const { reportId, analyzerType, scannedUrl, category, description, browserInfo, contextJson } = req.body;

    const result = await bugReportService.submitBugReport(req.user.id, {
      reportId,
      analyzerType,
      scannedUrl,
      category,
      description,
      browserInfo,
      contextJson
    });

    res.status(201).json({ success: true, bugReport: result });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      logger.error('Bug report submission failed', { error: err.message, userId: req.user.id });
    }
    res.status(status).json({ error: err.message });
  }
});

/**
 * GET /api/bugs/my — User's own reports + token balance
 */
router.get('/my', async (req, res) => {
  try {
    const [bugReports, tokenBalance] = await Promise.all([
      bugReportService.getUserBugReports(req.user.id),
      bugReportService.getUserTokenBalance(req.user.id)
    ]);

    res.json({ success: true, bugReports, tokenBalance });
  } catch (err) {
    logger.error('Failed to fetch user bug reports', { error: err.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to load bug reports' });
  }
});

/**
 * POST /api/bugs/redeem-token — Redeem a reward token for a report
 */
router.post('/redeem-token', async (req, res) => {
  try {
    const { reportId } = req.body;
    if (!reportId) {
      return res.status(400).json({ error: 'reportId is required' });
    }

    const result = await bugReportService.redeemToken(req.user.id, reportId);
    res.json(result);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) {
      logger.error('Token redemption failed', { error: err.message, userId: req.user.id });
    }
    res.status(status).json({ error: err.message });
  }
});

module.exports = router;
