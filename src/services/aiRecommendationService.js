/**
 * AI Recommendation Service
 * Claude API generates site-specific, prioritized advice (Pro-gated)
 */

const { getDatabase } = require('../db');
const { createLogger } = require('../utils/logger');
const config = require('../config');
const { generateFallback } = require('./fallbackRecommendations');

const logger = createLogger('AIRecommendationService');

/**
 * Sanitize scan data for sending to Claude — strip binary/base64, truncate
 */
function sanitizeScanData(scanData) {
  if (!scanData || typeof scanData !== 'object') return {};

  const sanitized = {};
  const MAX_STRING_LENGTH = 500;
  const MAX_ARRAY_LENGTH = 20;

  for (const [key, value] of Object.entries(scanData)) {
    // Skip binary/base64/screenshot data
    if (key === 'screenshot' || key === 'screenshotUrl' || key === 'screenshotBase64') continue;
    if (typeof value === 'string' && (value.startsWith('data:') || value.length > MAX_STRING_LENGTH)) {
      sanitized[key] = value.substring(0, MAX_STRING_LENGTH) + '...';
      continue;
    }
    if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, MAX_ARRAY_LENGTH);
      continue;
    }
    if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeScanData(value);
      continue;
    }
    sanitized[key] = value;
  }

  return sanitized;
}

/**
 * Build Claude prompt for recommendations
 */
function buildPrompt(analyzerType, scanData, locale) {
  const analyzerLabels = {
    'security': 'Security',
    'seo': 'SEO',
    'performance': 'Performance',
    'accessibility': 'Accessibility',
    'core-web-vitals': 'Core Web Vitals',
    'cwv': 'Core Web Vitals',
    'enhanced-fonts': 'Font & Typography',
    'fonts': 'Font & Typography',
    'tag-intelligence': 'Tag Intelligence',
    'broken-links': 'Broken Links',
    'mobile-analyzer': 'Mobile',
    'mobile': 'Mobile',
    'hosting-analyzer': 'Hosting',
    'hosting': 'Hosting',
    'site-crawler': 'Site Crawler',
    'cro-analysis': 'CRO',
    'cro': 'CRO',
    'brand-consistency': 'Brand Consistency',
    'geo-seo': 'Geo SEO',
    'local-seo': 'Local SEO',
    'gdpr-compliance': 'GDPR Compliance',
    'gdpr': 'GDPR Compliance',
    'ip-reputation': 'IP Reputation',
    'competitive': 'Competitive Analysis',
    'performance-snapshot': 'Performance Snapshot',
  };

  const label = analyzerLabels[analyzerType] || analyzerType;

  const systemPrompt = `You are a senior web ${label} consultant. The user has already seen detailed per-issue fix cards with code examples and step-by-step instructions. Your role is to provide STRATEGIC analysis — what matters most and why — not to repeat individual fixes.

Output ONLY a JSON object (NOT an array) with these fields:
- "strategic": true
- "assessment": 1-2 paragraph strategic overview of the site's ${label.toLowerCase()} posture, referencing specific data points from the scan
- "priorityOrder": array of objects, each with "category" (string) and "reason" (string explaining WHY this should be tackled in this order), sorted by business impact
- "quickWin": object with "title" (the single highest-ROI fix), "description" (business reasoning for why this fix first), and "estimatedImpact" (e.g. "+30 points")
- "connections": array of objects with "text" (cross-cutting insight linking related issues, e.g. "SSL and cookie security are both server configuration — fix together for efficiency") — or null if no meaningful connections
- "totalImpact": summary string of expected improvement if all issues are addressed (e.g. "Addressing all issues could improve your security score by approximately 55 points")

Keep it concise and strategic. Focus on business impact, not technical steps.
${locale !== 'en' ? `IMPORTANT: All text content must be written in locale "${locale}". Do not use English.` : ''}`;

  const userPrompt = `Here is the ${label} scan data for the website:\n\n${JSON.stringify(sanitizeScanData(scanData), null, 2)}`;

  return { systemPrompt, userPrompt };
}

/**
 * Get recommendations — cache-first, falls back to Claude API call
 */
async function getRecommendations(reportId, analyzerType, scanData, locale = 'en') {
  if (!config.ai?.enabled || !config.ai?.apiKey) {
    logger.info('AI API not configured, using fallback recommendations', { analyzerType });
    const recs = generateFallback(analyzerType, scanData, locale);
    return { recommendations: recs, cached: false, source: 'fallback' };
  }

  const db = getDatabase();

  // Check cache first
  try {
    const cached = await db.get(
      `SELECT recommendations_json FROM ai_recommendations
       WHERE report_id = ? AND analyzer_type = ? AND locale = ? AND expires_at > datetime('now')
       ORDER BY created_at DESC LIMIT 1`,
      [reportId, analyzerType, locale]
    );

    if (cached) {
      logger.debug('Returning cached AI recommendations', { reportId, analyzerType });
      return {
        recommendations: JSON.parse(cached.recommendations_json),
        cached: true,
      };
    }
  } catch (error) {
    logger.warn('Failed to check AI cache', { error: error.message });
  }

  // Call Claude API (with retry for transient errors like 529 Overloaded)
  const MAX_RETRIES = 2;
  let lastError = null;

  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    logger.error('Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk');
    return { recommendations: [], cached: false, error: 'AI SDK not available' };
  }

  const client = new Anthropic({ apiKey: config.ai.apiKey });
  const { systemPrompt, userPrompt } = buildPrompt(analyzerType, scanData, locale);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = 2000 * attempt; // 2s, 4s backoff
        logger.info('Retrying Claude API call', { attempt, delay, analyzerType });
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const response = await client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });

      const content = response.content?.[0]?.text || '[]';

      // Parse strategic analysis from Claude's response
      let recommendations;
      try {
        // Handle response that might be wrapped in markdown code blocks
        const jsonStr = content.replace(/^```json?\n?/m, '').replace(/\n?```$/m, '').trim();
        const parsed = JSON.parse(jsonStr);
        // Accept both strategic object and legacy array format
        if (parsed && parsed.strategic) {
          recommendations = parsed;
        } else if (Array.isArray(parsed)) {
          recommendations = parsed;
        } else {
          recommendations = [];
        }
      } catch {
        logger.warn('Failed to parse AI response as JSON', { content: content.substring(0, 200) });
        recommendations = [];
      }

      const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);
      const modelId = response.model || config.ai.model;

      // Cache the result
      const expiresAt = new Date(Date.now() + config.ai.cacheTtlHours * 3600 * 1000).toISOString();

      await db.run(
        `INSERT INTO ai_recommendations (report_id, analyzer_type, recommendations_json, model_id, locale, tokens_used, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [reportId, analyzerType, JSON.stringify(recommendations), modelId, locale, tokensUsed, expiresAt]
      ).catch(err => {
        logger.warn('Failed to cache AI recommendations', { error: err.message });
      });

      logger.info('Generated AI recommendations', {
        reportId, analyzerType, strategic: !!recommendations.strategic, tokensUsed, attempt,
      });

      return { recommendations, cached: false, tokensUsed, modelId };
    } catch (error) {
      lastError = error;
      const status = error.status || error.statusCode || '';
      const isRetryable = status === 529 || status === 503 || status === 500 || error.message?.includes('Overloaded');

      if (isRetryable && attempt < MAX_RETRIES) {
        logger.warn('Claude API transient error, will retry', { status, attempt, analyzerType });
        continue;
      }

      logger.error('Claude API call failed, using fallback', {
        error: error.message, analyzerType, attempt, status,
      });
      break;
    }
  }

  // Fall back to rule-based recommendations
  const recs = generateFallback(analyzerType, scanData, locale);
  return { recommendations: recs, cached: false, source: 'fallback' };
}

module.exports = {
  getRecommendations,
  sanitizeScanData,
  buildPrompt,
};
