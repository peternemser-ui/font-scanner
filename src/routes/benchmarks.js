/**
 * Benchmark Percentile API Routes
 * GET /api/benchmarks — percentile rank for a score
 */

const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/requireAuth');
const { computePercentile } = require('../services/benchmarkService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BenchmarksRoute');

// GET /api/benchmarks?analyzer_type=<type>&score_field=<field>&score=<num>
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { analyzer_type: analyzerType, score_field: scoreField, score } = req.query;

    if (!analyzerType || !scoreField || score == null) {
      return res.status(400).json({ error: 'analyzer_type, score_field, and score query params required' });
    }

    const numericScore = parseFloat(score);
    if (isNaN(numericScore)) {
      return res.status(400).json({ error: 'score must be a number' });
    }

    const percentile = await computePercentile(analyzerType, scoreField, numericScore);

    res.json({
      analyzerType,
      scoreField,
      score: numericScore,
      percentile,
      hasEnoughData: percentile !== null,
    });
  } catch (error) {
    logger.error('Failed to fetch benchmark', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch benchmark data' });
  }
});

module.exports = router;
