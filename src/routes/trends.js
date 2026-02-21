/**
 * Trend Detection API Routes
 * GET /api/trends — scan history + deltas for a URL
 */

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/requireAuth');
const { getTrendData, getScanHistory } = require('../services/trendService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('TrendsRoute');

// GET /api/trends?url=<encoded>&analyzer_type=<type>
router.get('/', requireAuth, async (req, res) => {
  try {
    const { url, analyzer_type: analyzerType } = req.query;

    if (!url || !analyzerType) {
      return res.status(400).json({ error: 'url and analyzer_type query params required' });
    }

    const userId = req.user.id;
    const history = await getScanHistory(url, userId, analyzerType, 10);

    res.json({
      url,
      analyzerType,
      history,
      scanCount: history.length,
    });
  } catch (error) {
    logger.error('Failed to fetch trends', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch trend data' });
  }
});

module.exports = router;
