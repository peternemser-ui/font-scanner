/**
 * AI Recommendations API Routes
 * POST /api/ai/recommendations — Pro-gated Claude-powered advice
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { resolveEntitlements, canViewProSections } = require('../utils/entitlements');
const { getRecommendations } = require('../services/aiRecommendationService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('AIRecommendationsRoute');

// POST /api/ai/recommendations
router.post('/', requireAuth, async (req, res) => {
  try {
    const { reportId, analyzerType, scanData, locale } = req.body;

    if (!reportId || !analyzerType) {
      return res.status(400).json({ error: 'reportId and analyzerType are required' });
    }

    // Pro gate — check entitlements
    const entitlements = await resolveEntitlements({ userId: req.user.id });
    const hasAccess = canViewProSections(entitlements, reportId);

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Pro subscription required',
        code: 'PRO_REQUIRED',
      });
    }

    const result = await getRecommendations(
      reportId,
      analyzerType,
      scanData || {},
      locale || 'en'
    );

    res.json(result);
  } catch (error) {
    logger.error('Failed to get AI recommendations', { error: error.message });
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

module.exports = router;
