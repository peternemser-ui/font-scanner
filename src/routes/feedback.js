/**
 * Recommendation Feedback API Routes
 * POST /api/feedback — submit thumbs up/down
 * GET  /api/feedback — get user's votes for a report
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/requireAuth');
const { submitFeedback, getFeedbackForReport } = require('../services/feedbackService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FeedbackRoute');

// POST /api/feedback
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { reportId, recommendationId, recommendationType, vote } = req.body;

    if (!reportId || !recommendationId || ![-1, 1].includes(vote)) {
      return res.status(400).json({ error: 'reportId, recommendationId, and vote (-1 or 1) are required' });
    }

    const userId = req.user?.id || null;
    const anonId = req.anonId || req.cookies?.anon_id || null;

    if (!userId && !anonId) {
      return res.status(400).json({ error: 'Authentication or anonymous ID required' });
    }

    const result = await submitFeedback({
      reportId,
      recommendationId,
      recommendationType: recommendationType || 'static',
      userId,
      anonId: userId ? null : anonId,
      vote,
    });

    res.json(result);
  } catch (error) {
    logger.error('Failed to submit feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// GET /api/feedback?reportId=<id>
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { reportId } = req.query;

    if (!reportId) {
      return res.status(400).json({ error: 'reportId query param required' });
    }

    const userId = req.user?.id || null;
    const anonId = req.anonId || req.cookies?.anon_id || null;

    const votes = await getFeedbackForReport(reportId, userId, anonId);
    res.json({ reportId, votes });
  } catch (error) {
    logger.error('Failed to fetch feedback', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

module.exports = router;
