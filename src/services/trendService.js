/**
 * Trend Detection Service
 * Compares re-scans to show score deltas ("SEO improved +12 since last scan")
 */

const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('TrendService');

/**
 * Score field mappings per analyzer type.
 * Each entry maps a human label to a JSON path inside result_json.
 */
const ANALYZER_SCORE_FIELDS = {
  'security': {
    overallScore: 'overallScore',
    sslScore: 'ssl.score',
    headersScore: 'headers.score',
    vulnerabilityScore: 'vulnerabilities.score',
  },
  'seo': {
    overallScore: 'overallScore',
    metaTagsScore: 'metaTags.score',
    contentScore: 'content.score',
    technicalScore: 'technical.score',
  },
  'performance': {
    overallScore: 'overallScore',
    performanceScore: 'performanceScore',
    lighthouseScore: 'lighthouse.score',
  },
  'accessibility': {
    overallScore: 'overallScore',
    complianceScore: 'complianceScore',
  },
  'core-web-vitals': {
    overallScore: 'overallScore',
    performanceScore: 'performanceScore',
  },
  'enhanced-fonts': {
    overallScore: 'overallScore',
    fontScore: 'fontScore',
  },
  'tag-intelligence': {
    overallScore: 'overallScore',
  },
  'broken-links': {
    overallScore: 'overallScore',
    healthScore: 'healthScore',
  },
  'mobile-analyzer': {
    overallScore: 'overallScore',
    mobileScore: 'mobileScore',
  },
  'hosting-analyzer': {
    overallScore: 'overallScore',
  },
  'site-crawler': {
    overallScore: 'overallScore',
    crawlScore: 'crawlScore',
  },
  'cro-analysis': {
    overallScore: 'overallScore',
  },
  'brand-consistency': {
    overallScore: 'overallScore',
  },
  'geo-seo': {
    overallScore: 'overallScore',
  },
  'gdpr-compliance': {
    overallScore: 'overallScore',
    complianceScore: 'complianceScore',
  },
  'ip-reputation': {
    overallScore: 'overallScore',
    reputationScore: 'reputationScore',
  },
  'performance-snapshot': {
    overallScore: 'overallScore',
  },
};

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
 * Get trend data comparing current scan to previous scan for same URL+user
 */
async function getTrendData(targetUrl, userId, currentData, analyzerType) {
  if (!targetUrl || !userId) return null;

  const db = getDatabase();
  const scoreFields = ANALYZER_SCORE_FIELDS[analyzerType];
  if (!scoreFields) return null;

  try {
    // Get the most recent previous scan for this URL+user+analyzerType
    const previousScan = await db.get(
      `SELECT result_json, created_at FROM scans
       WHERE target_url = ? AND user_id = ? AND options_json LIKE ?
       ORDER BY created_at DESC LIMIT 1 OFFSET 1`,
      [targetUrl, userId, `%"analyzerType":"${analyzerType}"%`]
    );

    if (!previousScan || !previousScan.result_json) return null;

    let previousData;
    try {
      previousData = JSON.parse(previousScan.result_json);
    } catch {
      return null;
    }

    // Compute deltas for each score field
    const deltas = {};
    for (const [key, path] of Object.entries(scoreFields)) {
      const currentScore = getNestedValue(currentData, path);
      const previousScore = getNestedValue(previousData, path);

      if (currentScore !== null && previousScore !== null) {
        deltas[key] = {
          current: Math.round(currentScore),
          previous: Math.round(previousScore),
          delta: Math.round(currentScore - previousScore),
        };
      }
    }

    if (Object.keys(deltas).length === 0) return null;

    return {
      hasPreviousScan: true,
      previousScanDate: previousScan.created_at,
      deltas,
    };
  } catch (error) {
    logger.error('Failed to get trend data', { error: error.message, targetUrl, analyzerType });
    return null;
  }
}

/**
 * Get scan history for a URL+user (for charts)
 */
async function getScanHistory(targetUrl, userId, analyzerType, limit = 10) {
  if (!targetUrl || !userId) return [];

  const db = getDatabase();
  const scoreFields = ANALYZER_SCORE_FIELDS[analyzerType];
  if (!scoreFields) return [];

  try {
    const scans = await db.all(
      `SELECT result_json, created_at FROM scans
       WHERE target_url = ? AND user_id = ? AND options_json LIKE ?
       ORDER BY created_at DESC LIMIT ?`,
      [targetUrl, userId, `%"analyzerType":"${analyzerType}"%`, limit]
    );

    return scans.map(scan => {
      let data;
      try {
        data = JSON.parse(scan.result_json);
      } catch {
        return null;
      }

      const scores = {};
      for (const [key, path] of Object.entries(scoreFields)) {
        const val = getNestedValue(data, path);
        if (val !== null) scores[key] = Math.round(val);
      }

      return {
        scanDate: scan.created_at,
        scores,
      };
    }).filter(Boolean).reverse(); // Chronological order
  } catch (error) {
    logger.error('Failed to get scan history', { error: error.message, targetUrl, analyzerType });
    return [];
  }
}

module.exports = {
  getTrendData,
  getScanHistory,
  ANALYZER_SCORE_FIELDS,
};
