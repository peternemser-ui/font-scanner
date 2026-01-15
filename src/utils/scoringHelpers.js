/**
 * Scoring Helper Utilities
 *
 * Consolidates scoring algorithms used across 36+ analyzer services:
 * - Penalty-based scoring (start at 100, apply penalties)
 * - Weighted scoring (combine multiple scores with weights)
 * - Score-to-grade conversion
 * - Domain-specific scoring functions (meta tags, headings, images, etc.)
 *
 * @module utils/scoringHelpers
 */

const { clamp, roundTo } = require('./formatHelpers');

/**
 * Calculate penalty-based score
 *
 * Consolidates the pattern:
 *   let score = 100;
 *   if (condition1) score -= penalty1;
 *   if (condition2) score -= penalty2;
 *   return Math.max(0, score);
 *
 * Used in 16+ services
 *
 * @param {number} baseScore - Starting score (usually 100)
 * @param {Array<number>} penalties - Array of penalty values to subtract
 * @returns {number} Final score clamped between 0 and baseScore
 *
 * @example
 * calculatePenaltyScore(100, [20, 15, 10]) // 55
 * calculatePenaltyScore(100, [150]) // 0 (clamped)
 * calculatePenaltyScore(100, []) // 100
 */
function calculatePenaltyScore(baseScore, penalties) {
  if (!Array.isArray(penalties)) return baseScore;

  let score = baseScore;
  for (const penalty of penalties) {
    if (typeof penalty === 'number' && !isNaN(penalty)) {
      score -= penalty;
    }
  }

  return Math.max(0, Math.min(score, baseScore));
}

/**
 * Calculate weighted average score
 *
 * Consolidates the pattern:
 *   totalScore += score1 * weight1;
 *   totalScore += score2 * weight2;
 *   return totalScore / totalWeight;
 *
 * Used in 10+ services for overall scoring
 *
 * @param {Array<Object>} components - Array of {score, weight} objects
 * @returns {number} Weighted average score (0-100)
 *
 * @example
 * calculateWeightedScore([
 *   { score: 80, weight: 0.3 },
 *   { score: 90, weight: 0.7 }
 * ]) // 87
 */
function calculateWeightedScore(components) {
  if (!Array.isArray(components) || components.length === 0) return 0;

  let totalScore = 0;
  let totalWeight = 0;

  for (const { score, weight } of components) {
    if (typeof score === 'number' && typeof weight === 'number' && !isNaN(score) && !isNaN(weight)) {
      totalScore += score * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? roundTo(totalScore / totalWeight, 1) : 0;
}

/**
 * Score meta tags (SEO)
 *
 * Consolidated from seoAnalyzer.js, mobileAnalyzerService.js
 * Penalty-based scoring for meta tag completeness and quality
 *
 * @param {Object} meta - Meta tags object
 * @returns {number} Score (0-100)
 */
function scoreMetaTags(meta) {
  const penalties = [];

  if (!meta.title) penalties.push(20);
  if (!meta.description) penalties.push(20);
  if (meta.titleLength < 30 || meta.titleLength > 60) penalties.push(10);
  if (meta.descriptionLength < 120 || meta.descriptionLength > 160) penalties.push(10);
  if (!meta.ogTitle && !meta.ogDescription) penalties.push(15);
  if (!meta.viewport) penalties.push(15);
  if (!meta.language) penalties.push(10);

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score heading structure
 *
 * Consolidated from seoAnalyzer.js, accessibilityAnalyzerService.js
 * Penalty-based scoring for heading hierarchy and usage
 *
 * @param {Object} headings - Heading structure object
 * @returns {number} Score (0-100)
 */
function scoreHeadingStructure(headings) {
  const penalties = [];

  if (headings.h1.length === 0) penalties.push(30);
  if (headings.h1.length > 1) penalties.push(20);
  if (headings.total === 0) penalties.push(40);
  if (headings.total < 3) penalties.push(10);

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score image accessibility
 *
 * Consolidated from seoAnalyzer.js, accessibilityAnalyzerService.js
 * Penalty-based scoring for image alt text coverage
 *
 * @param {Object} images - Image analysis object
 * @returns {number} Score (0-100)
 */
function scoreImageAccessibility(images) {
  const penalties = [];

  if (images.total > 0) {
    const altRatio = images.withAlt / images.total;
    if (altRatio < 0.5) penalties.push(40);
    else if (altRatio < 0.8) penalties.push(20);
    else if (altRatio < 1.0) penalties.push(10);
  }

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score security headers
 *
 * Consolidated from seoAnalyzer.js, securityAnalyzerService.js
 * Penalty-based scoring for security header presence
 *
 * @param {Object} headers - Security headers object
 * @returns {number} Score (0-100)
 */
function scoreSecurityHeaders(headers) {
  const penalties = [];

  if (!headers.hasHTTPS) penalties.push(50);
  if (!headers.strictTransportSecurity && headers.hasHTTPS) penalties.push(15);
  if (!headers.contentSecurityPolicy) penalties.push(10);
  if (!headers.xFrameOptions) penalties.push(10);
  if (!headers.xContentTypeOptions) penalties.push(10);

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score performance metrics
 *
 * Consolidated from seoAnalyzer.js, performanceAnalyzerService.js
 * Penalty-based scoring for page performance
 *
 * @param {Object} metrics - Performance metrics object
 * @returns {number} Score (0-100)
 */
function scorePerformanceMetrics(metrics) {
  const penalties = [];

  // Load time penalties
  if (metrics.loadComplete > 5000) penalties.push(40);
  else if (metrics.loadComplete > 3000) penalties.push(20);
  else if (metrics.loadComplete > 2000) penalties.push(10);

  // DOM complexity penalties
  if (metrics.domNodes > 2000) penalties.push(15);
  else if (metrics.domNodes > 1500) penalties.push(10);

  // Transfer size penalties
  if (metrics.transferSize > 5 * 1024 * 1024) penalties.push(25);
  else if (metrics.transferSize > 3 * 1024 * 1024) penalties.push(15);

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score mobile responsiveness
 *
 * Consolidated from seoAnalyzer.js, mobileAnalyzerService.js
 * Penalty-based scoring for mobile optimization
 *
 * @param {Object} mobileResults - Mobile test results
 * @returns {number} Score (0-100)
 */
function scoreMobileResponsiveness(mobileResults) {
  const penalties = [];

  const mobileResult = Array.isArray(mobileResults)
    ? mobileResults.find(r => r.viewport === 'Mobile')
    : mobileResults;

  if (mobileResult) {
    if (mobileResult.hasHorizontalScroll) penalties.push(30);
    if (!mobileResult.hasViewportMeta) penalties.push(40);
    if (!mobileResult.fontSizeReadable) penalties.push(10);
  }

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score content quality
 *
 * Consolidated from seoAnalyzer.js
 * Penalty-based scoring for content quality metrics
 *
 * @param {Object} content - Content analysis object
 * @returns {number} Score (0-100)
 */
function scoreContentQuality(content) {
  const penalties = [];

  if (content.wordCount < 300) penalties.push(30);
  else if (content.wordCount < 600) penalties.push(10);

  if (content.averageWordsPerSentence > 25) penalties.push(10);
  if (content.textToHTMLRatio < 0.1) penalties.push(15);

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score link structure
 *
 * Consolidated from seoAnalyzer.js
 * Penalty-based scoring for link quality
 *
 * @param {Object} links - Link analysis object
 * @returns {number} Score (0-100)
 */
function scoreLinkStructure(links) {
  const penalties = [];

  if (links.brokenFormat > 0) penalties.push(20);

  const emptyAnchors = links.links
    ? links.links.filter(l => !l.text).length
    : 0;
  if (emptyAnchors > 0) penalties.push(15);

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score structured data (Schema.org)
 *
 * Consolidated from seoAnalyzer.js
 * Penalty-based scoring for structured data implementation
 *
 * @param {Object} data - Structured data analysis
 * @returns {number} Score (0-100)
 */
function scoreStructuredData(data) {
  const penalties = [];

  if (!data.hasStructuredData) penalties.push(40);

  const invalidCount = data.schemas
    ? data.schemas.filter(s => !s.valid).length
    : 0;
  penalties.push(invalidCount * 20);

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score accessibility compliance
 *
 * Consolidated from accessibilityAnalyzerService.js
 * Penalty-based scoring for WCAG compliance
 *
 * @param {Object} results - Accessibility test results
 * @returns {number} Score (0-100)
 */
function scoreAccessibilityCompliance(results) {
  const penalties = [];

  // Violations severity penalties
  if (results.violations) {
    const critical = results.violations.filter(v => v.impact === 'critical').length;
    const serious = results.violations.filter(v => v.impact === 'serious').length;
    const moderate = results.violations.filter(v => v.impact === 'moderate').length;

    penalties.push(critical * 15);
    penalties.push(serious * 10);
    penalties.push(moderate * 5);
  }

  return calculatePenaltyScore(100, penalties);
}

/**
 * Score to grade conversion (A-F)
 *
 * Standard mapping used across all analyzers
 * Moved from formatHelpers for semantic grouping
 *
 * @param {number} score - Score value (0-100)
 * @returns {string} Grade letter
 */
function scoreToGrade(score) {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';

  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Calculate contribution of each component to weighted score
 *
 * Shows how much each component contributes to the final score
 * Used in competitive analysis and detailed reports
 *
 * @param {Array<Object>} components - Array of {score, weight, key} objects
 * @returns {Object} Map of key → contribution percentage
 *
 * @example
 * calculateContributions([
 *   { key: 'seo', score: 80, weight: 0.3 },
 *   { key: 'performance', score: 90, weight: 0.7 }
 * ])
 * // { seo: 27.59, performance: 72.41 }
 */
function calculateContributions(components) {
  if (!Array.isArray(components) || components.length === 0) return {};

  let totalWeight = 0;
  const weightedScores = {};

  for (const { key, score, weight } of components) {
    if (typeof score === 'number' && typeof weight === 'number' && !isNaN(score) && !isNaN(weight)) {
      weightedScores[key] = score * weight;
      totalWeight += weight;
    }
  }

  const contributions = {};
  for (const [key, weightedScore] of Object.entries(weightedScores)) {
    contributions[key] = totalWeight > 0
      ? roundTo((weightedScore / (totalWeight * 100)) * 100, 2)
      : 0;
  }

  return contributions;
}

/**
 * Normalize score to 0-100 range
 *
 * Useful when scores come from different scales
 *
 * @param {number} value - Raw value
 * @param {number} min - Minimum possible value
 * @param {number} max - Maximum possible value
 * @returns {number} Normalized score (0-100)
 *
 * @example
 * normalizeScore(75, 0, 150) // 50
 * normalizeScore(5, 1, 10) // 44.44
 */
function normalizeScore(value, min, max) {
  if (max === min) return 100;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

module.exports = {
  // Core scoring functions
  calculatePenaltyScore,
  calculateWeightedScore,
  scoreToGrade,
  calculateContributions,
  normalizeScore,

  // Domain-specific scoring
  scoreMetaTags,
  scoreHeadingStructure,
  scoreImageAccessibility,
  scoreSecurityHeaders,
  scorePerformanceMetrics,
  scoreMobileResponsiveness,
  scoreContentQuality,
  scoreLinkStructure,
  scoreStructuredData,
  scoreAccessibilityCompliance
};
