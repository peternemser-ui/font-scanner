/**
 * Benchmark Service
 * Percentile rankings — "Better than 72% of sites"
 */

const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');
const config = require('../config');
const { ANALYZER_SCORE_FIELDS } = require('./trendService');

const logger = createLogger('BenchmarkService');

/**
 * Compute the percentile for a given score against stored benchmark stats
 */
async function computePercentile(analyzerType, scoreField, currentScore) {
  if (currentScore == null || isNaN(currentScore)) return null;

  const db = getDatabase();

  try {
    const stats = await db.get(
      'SELECT * FROM benchmark_stats WHERE analyzer_type = ? AND score_field = ?',
      [analyzerType, scoreField]
    );

    if (!stats || stats.total_scans < config.benchmarks.minScansForPercentile) {
      return null;
    }

    // Sum buckets below the current score to compute percentile
    const score = Math.max(0, Math.min(100, Math.round(currentScore)));
    const buckets = [
      stats.bucket_0, stats.bucket_10, stats.bucket_20, stats.bucket_30,
      stats.bucket_40, stats.bucket_50, stats.bucket_60, stats.bucket_70,
      stats.bucket_80, stats.bucket_90,
    ];

    let belowCount = 0;
    const bucketIndex = Math.min(Math.floor(score / 10), 9);

    // Full buckets below
    for (let i = 0; i < bucketIndex; i++) {
      belowCount += buckets[i];
    }

    // Partial bucket (linear interpolation within bucket)
    const withinBucket = score % 10;
    belowCount += Math.round(buckets[bucketIndex] * (withinBucket / 10));

    const percentile = Math.round((belowCount / stats.total_scans) * 100);
    return Math.max(0, Math.min(100, percentile));
  } catch (error) {
    logger.error('Failed to compute percentile', { error: error.message, analyzerType, scoreField });
    return null;
  }
}

/**
 * Extract a nested value from an object using dot-notation path
 */
function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null;
    current = current[part];
  }
  return typeof current === 'number' ? current : null;
}

/**
 * Recompute benchmark stats for a specific analyzer+score field
 */
async function recomputeStats(analyzerType, scoreField) {
  const db = getDatabase();
  const scorePath = ANALYZER_SCORE_FIELDS[analyzerType]?.[scoreField];
  if (!scorePath) return;

  try {
    const scans = await db.all(
      `SELECT result_json FROM scans
       WHERE options_json LIKE ? AND result_json IS NOT NULL
       ORDER BY created_at DESC LIMIT 10000`,
      [`%"analyzerType":"${analyzerType}"%`]
    );

    const scores = [];
    const buckets = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0-9, 10-19, ... 90-100

    for (const scan of scans) {
      let data;
      try {
        data = JSON.parse(scan.result_json);
      } catch {
        continue;
      }

      const val = getNestedValue(data, scorePath);
      if (val === null) continue;

      const score = Math.max(0, Math.min(100, Math.round(val)));
      scores.push(score);
      const idx = Math.min(Math.floor(score / 10), 9);
      buckets[idx]++;
    }

    if (scores.length === 0) return;

    // Compute mean
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;

    // Compute median
    const sorted = [...scores].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    await db.run(
      `INSERT INTO benchmark_stats (analyzer_type, score_field, bucket_0, bucket_10, bucket_20, bucket_30, bucket_40, bucket_50, bucket_60, bucket_70, bucket_80, bucket_90, total_scans, mean_score, median_score, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(analyzer_type, score_field)
       DO UPDATE SET bucket_0=?, bucket_10=?, bucket_20=?, bucket_30=?, bucket_40=?, bucket_50=?, bucket_60=?, bucket_70=?, bucket_80=?, bucket_90=?, total_scans=?, mean_score=?, median_score=?, updated_at=datetime('now')`,
      [
        analyzerType, scoreField,
        ...buckets, scores.length, mean, median,
        ...buckets, scores.length, mean, median,
      ]
    );
  } catch (error) {
    logger.error('Failed to recompute stats', { error: error.message, analyzerType, scoreField });
  }
}

/**
 * Recompute all benchmark stats — called on startup + hourly
 */
async function recomputeAllStats() {
  logger.info('Starting benchmark stats recomputation');
  const startTime = Date.now();

  for (const [analyzerType, fields] of Object.entries(ANALYZER_SCORE_FIELDS)) {
    for (const scoreField of Object.keys(fields)) {
      try {
        await recomputeStats(analyzerType, scoreField);
      } catch (error) {
        logger.error('Failed to recompute stats for field', {
          error: error.message, analyzerType, scoreField,
        });
      }
    }
  }

  logger.info('Benchmark stats recomputation complete', {
    durationMs: Date.now() - startTime,
  });
}

let _recomputeInterval = null;

/**
 * Start the periodic recompute loop
 */
function startPeriodicRecompute() {
  if (_recomputeInterval) return;

  // Run once at startup (non-blocking)
  recomputeAllStats().catch(err => {
    logger.error('Initial benchmark recompute failed', { error: err.message });
  });

  // Then on interval
  _recomputeInterval = setInterval(() => {
    recomputeAllStats().catch(err => {
      logger.error('Periodic benchmark recompute failed', { error: err.message });
    });
  }, config.benchmarks.recomputeIntervalMs);
}

function stopPeriodicRecompute() {
  if (_recomputeInterval) {
    clearInterval(_recomputeInterval);
    _recomputeInterval = null;
  }
}

module.exports = {
  computePercentile,
  recomputeStats,
  recomputeAllStats,
  startPeriodicRecompute,
  stopPeriodicRecompute,
};
