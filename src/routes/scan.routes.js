/**
 * Scan API Routes
 */

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const { getDatabase } = require('../db');
const { getQueue } = require('../queue/scanQueue');

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

/**
 * Check scan entitlement (for authenticated users)
 */
async function checkEntitlement(req, res, next) {
  // TODO: Implement actual auth
  // For now, use IP-based anonymous rate limiting
  const db = getDatabase();
  const ip = req.ip || req.connection.remoteAddress;

  try {
    // Check usage in last 24 hours
    const usage = await db.get(
      `SELECT COUNT(*) as count FROM scan_usage
       WHERE ip_address = ? AND created_at > DATETIME('now', '-24 hours')`,
      [ip]
    );

    const freeLimit = 3; // 3 scans per day for anonymous users

    if (usage && usage.count >= freeLimit) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Free tier allows ${freeLimit} scans per 24 hours. Please upgrade or try again later.`,
        resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    }

    next();
  } catch (error) {
    console.error('Entitlement check error:', error);
    next(error);
  }
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/scans
 * Create a new scan job
 */
router.post('/', validate(createScanSchema), checkEntitlement, async (req, res) => {
  const db = getDatabase();
  const queue = getQueue();

  try {
    const { url, options } = req.validatedData;
    const scanId = uuidv4();
    const ip = req.ip || req.connection.remoteAddress;

    // Create scan record
    await db.run(
      `INSERT INTO scans (id, target_url, status, options_json, user_id)
       VALUES (?, ?, 'queued', ?, NULL)`,
      [scanId, url, JSON.stringify(options)]
    );

    // Track usage for rate limiting
    await db.run(
      `INSERT INTO scan_usage (scan_id, ip_address)
       VALUES (?, ?)`,
      [scanId, ip]
    );

    // Enqueue scan job
    await queue.enqueue(scanId, { url, options });

    res.status(202).json({
      scanId,
      status: 'queued',
      message: 'Scan created successfully',
      pollUrl: `/api/scans/${scanId}`
    });

  } catch (error) {
    console.error('Error creating scan:', error);
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
      createdAt: scan.created_at,
      startedAt: scan.started_at,
      finishedAt: scan.finished_at,
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
    console.error('Error fetching scan:', error);
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
    console.error('Error cancelling scan:', error);
    res.status(500).json({
      error: 'Failed to cancel scan',
      message: error.message
    });
  }
});

/**
 * GET /api/scans/:scanId/pdf
 * Export scan results as PDF
 */
router.get('/:scanId/pdf', async (req, res) => {
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
      createdAt: scan.created_at,
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
    // TODO: Implement actual user tier checking
    const isFreeTier = true; // Default to free tier for now
    const watermark = isFreeTier;

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
    console.error('Error generating PDF:', error);
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

module.exports = router;
