/**
 * Scan API Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ScanRoutes');
const { getDatabase } = require('../db');
const { getQueue } = require('../queue/scanQueue');
const stripeService = require('../services/stripeService');
const { optionalAuth } = require('../middleware/requireAuth');
const { checkScanQuota, recordScanUsage } = require('../middleware/scanQuota');
const { enforcePageLimit } = require('../middleware/entitlementGuard');
const usageService = require('../services/usageService');
const { PRICING } = require('../config/pricing');
const { toISODate } = require('../utils/formatHelpers');

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const createScanSchema = z.object({
  url: z.string().url('Invalid URL format'),
  options: z.object({
    maxPages: z.number().int().min(1).max(250).default(10),
    maxDepth: z.number().int().min(1).max(5).default(3),
    includeSitemap: z.boolean().default(true),
    analyzers: z.array(z.enum(['font', 'seo', 'security', 'accessibility', 'performance', 'tags'])).optional()
  }).optional().default({})
});

// ============================================================
// MIDDLEWARE
// ============================================================

/**
 * Validate request body against schema
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.validatedData = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors
        });
      }
      next(error);
    }
  };
}

// Note: checkScanQuota middleware is imported from '../middleware/scanQuota'
// It provides better quota tracking with user-based and anonymous ID support

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/scans
 * Create a new scan job
 * Uses optionalAuth to identify user, checkScanQuota to enforce limits
 */
router.post('/', optionalAuth, checkScanQuota, validate(createScanSchema), enforcePageLimit, async (req, res) => {
  const db = getDatabase();
  const queue = getQueue();

  try {
    const { url, options } = req.validatedData;
    const scanId = uuidv4();
    const userId = req.user?.id || null;
    const anonId = req.anonId || null;
    const ip = req.ip || req.connection.remoteAddress;

    // Create scan record with user_id if authenticated
    await db.run(
      `INSERT INTO scans (id, target_url, status, options_json, user_id)
       VALUES (?, ?, 'queued', ?, ?)`,
      [scanId, url, JSON.stringify(options), userId]
    );

    // Track usage for legacy rate limiting (IP-based backup)
    await db.run(
      `INSERT INTO scan_usage (scan_id, ip_address, user_id)
       VALUES (?, ?, ?)`,
      [scanId, ip, userId]
    );

    // Increment usage in the new tracking system
    await usageService.incrementScanUsage(userId, anonId);

    // Enqueue scan job
    await queue.enqueue(scanId, { url, options });

    // Build response with usage info
    const response = {
      scanId,
      status: 'queued',
      message: 'Scan created successfully',
      pollUrl: `/api/scans/${scanId}`
    };

    // Include usage info if quota check was successful
    if (req.scanQuota) {
      response.usage = {
        scansRemaining: req.scanQuota.isUnlimited ? -1 : Math.max(0, req.scanQuota.remaining - 1),
        scansLimit: req.scanQuota.limit,
        scansResetAt: req.scanQuota.resetAt,
        isUnlimited: req.scanQuota.isUnlimited
      };
    }

    res.status(202).json(response);

  } catch (error) {
    logger.error('Error creating scan', { error: error.message });
    res.status(500).json({
      error: 'Failed to create scan',
      message: error.message
    });
  }
});

/**
 * GET /api/scans/:scanId
 * Get scan status and results
 */
router.get('/:scanId', async (req, res) => {
  const db = getDatabase();
  const { scanId } = req.params;

  try {
    // Get scan record
    const scan = await db.get(
      `SELECT id, target_url, status, progress, started_at, finished_at,
              error_message, pages_crawled, created_at, updated_at
       FROM scans WHERE id = ?`,
      [scanId]
    );

    if (!scan) {
      return res.status(404).json({
        error: 'Scan not found',
        scanId
      });
    }

    const response = {
      scanId: scan.id,
      url: scan.target_url,
      status: scan.status,
      progress: scan.progress,
      createdAt: toISODate(scan.created_at),
      startedAt: toISODate(scan.started_at),
      finishedAt: toISODate(scan.finished_at),
      pagesCrawled: scan.pages_crawled
    };

    // If scan is done, include results
    if (scan.status === 'done') {
      const results = await db.all(
        `SELECT result_type, result_json, page_url
         FROM scan_results WHERE scan_id = ?`,
        [scanId]
      );

      response.results = results.reduce((acc, row) => {
        const data = JSON.parse(row.result_json);
        if (row.result_type === 'aggregate') {
          Object.assign(acc, data);
        } else {
          if (!acc[row.result_type]) {
            acc[row.result_type] = [];
          }
          acc[row.result_type].push({
            page: row.page_url,
            data
          });
        }
        return acc;
      }, {});
    }

    // If scan failed, include error
    if (scan.status === 'failed') {
      response.error = scan.error_message;
    }

    res.json(response);

  } catch (error) {
    logger.error('Error fetching scan', { error: error.message });
    res.status(500).json({
      error: 'Failed to fetch scan',
      message: error.message
    });
  }
});

/**
 * DELETE /api/scans/:scanId
 * Cancel a queued scan
 */
router.delete('/:scanId', async (req, res) => {
  const db = getDatabase();
  const queue = getQueue();
  const { scanId } = req.params;

  try {
    // Get scan
    const scan = await db.get('SELECT status FROM scans WHERE id = ?', [scanId]);

    if (!scan) {
      return res.status(404).json({
        error: 'Scan not found',
        scanId
      });
    }

    if (scan.status !== 'queued') {
      return res.status(400).json({
        error: 'Cannot cancel scan',
        message: `Scan is already ${scan.status}`,
        scanId
      });
    }

    // Cancel in queue
    const cancelled = queue.cancel(scanId);

    if (cancelled) {
      await db.run(
        `UPDATE scans SET status = 'cancelled', updated_at = DATETIME('now')
         WHERE id = ?`,
        [scanId]
      );

      res.json({
        message: 'Scan cancelled successfully',
        scanId
      });
    } else {
      res.status(400).json({
        error: 'Failed to cancel scan',
        scanId
      });
    }

  } catch (error) {
    logger.error('Error cancelling scan', { error: error.message });
    res.status(500).json({
      error: 'Failed to cancel scan',
      message: error.message
    });
  }
});

/**
 * GET /api/scans/:scanId/pdf
 * Export scan results as PDF
 * Uses optionalAuth to check user tier for watermarking
 */
router.get('/:scanId/pdf', optionalAuth, async (req, res) => {
  const db = getDatabase();
  const pdfGenerator = require('../reports/pdfGenerator');
  const { scanId } = req.params;

  try {
    // Get scan data
    const scan = await db.get(
      `SELECT id, target_url, status, created_at, pages_crawled
       FROM scans WHERE id = ?`,
      [scanId]
    );

    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }

    if (scan.status !== 'done') {
      return res.status(400).json({
        error: 'Scan not complete',
        message: 'PDF export only available for completed scans'
      });
    }

    // Get scan results
    const results = await db.all(
      `SELECT result_type, result_json
       FROM scan_results WHERE scan_id = ?`,
      [scanId]
    );

    // Build scan data object
    const scanData = {
      scanId: scan.id,
      url: scan.target_url,
      createdAt: toISODate(scan.created_at),
      summary: {
        totalPages: scan.pages_crawled || 1,
        analyzersRun: results.filter(r => r.result_type !== 'aggregate').length
      },
      results: {}
    };

    // Organize results by type
    results.forEach(row => {
      const data = JSON.parse(row.result_json);
      if (row.result_type === 'aggregate') {
        Object.assign(scanData, data);
      } else {
        if (!scanData.results[row.result_type]) {
          scanData.results[row.result_type] = [];
        }
        scanData.results[row.result_type].push({ result: data });
      }
    });

    // Check user tier (for watermarking)
    // Pro users get unwatermarked PDFs
    const isProUser = req.user && stripeService.isPro(req.user);
    const watermark = !isProUser;

    // Generate PDF
    const pdfBuffer = await pdfGenerator.generatePDF(scanData, {
      watermark,
      includeAllPages: true
    });

    // Send PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="scan-${scanId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (error) {
    logger.error('Error generating PDF', { error: error.message });
    res.status(500).json({
      error: 'Failed to generate PDF',
      message: error.message
    });
  }
});

/**
 * GET /api/queue/status
 * Get queue status (admin only)
 */
router.get('/queue/status', (req, res) => {
  const queue = getQueue();
  res.json(queue.getStatus());
});

// ============================================================
// LANGUAGE AUDIT ROUTES
// ============================================================

const languageAuditService = require('../services/languageAuditService');

const languageAuditSchema = z.object({
  url: z.string().url('Invalid URL format')
});

/**
 * POST /api/scans/language-audit
 * Audit a URL for language/i18n configuration
 * Returns score, issues, and recommendations for SEO language signals
 */
router.post('/language-audit', validate(languageAuditSchema), optionalAuth, async (req, res) => {
  try {
    const { url } = req.validatedData;

    const result = await languageAuditService.audit(url);

    // Add locale info from request if available
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      result.requestLocale = acceptLanguage.split(',')[0].trim();
    }

    res.json(result);

  } catch (error) {
    logger.error('Language audit error', { error: error.message });
    res.status(500).json({
      error: 'Language audit failed',
      message: error.message
    });
  }
});

module.exports = router;
