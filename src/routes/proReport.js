/**
 * Pro Report Snapshot API Routes
 * Handles purchase initialization, snapshot capture, and retrieval
 */

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { createLogger } = require('../utils/logger');
const { asyncHandler } = require('../utils/errorHandler');
const {
  generatePurchaseId,
  createPurchaseFolder,
  purchaseFolderExists,
  writeMetadata,
  readMetadata,
  writeSnapshot,
  readSnapshot
} = require('../utils/proReportStorage');

const logger = createLogger('ProReportRoutes');

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const initPurchaseSchema = z.object({
  domain: z.string()
    .min(1, 'Domain is required')
    .max(255, 'Domain too long')
    .refine(
      (val) => /^[a-zA-Z0-9][a-zA-Z0-9-_.]*\.[a-zA-Z]{2,}$/.test(val.replace(/^https?:\/\//, '').split('/')[0]),
      { message: 'Invalid domain format' }
    )
});

const snapshotCaptureSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  selectedUrls: z.array(z.string().url())
    .min(1, 'At least one URL required')
    .max(10, 'Maximum 10 URLs allowed'),
  selectedModules: z.array(z.string()).default([]),
  scanResult: z.object({}).passthrough().refine(
    (obj) => Object.keys(obj).length > 0,
    { message: 'Scan result cannot be empty' }
  )
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
 * Security middleware for snapshot retrieval in production
 * Requires X-Internal-Report-Key header matching REPORT_INTERNAL_KEY env var
 */
function requireInternalKey(req, res, next) {
  const isProduction = process.env.NODE_ENV === 'production';
  const internalKey = process.env.REPORT_INTERNAL_KEY;
  
  // In development without key set, allow access
  if (!isProduction && !internalKey) {
    return next();
  }
  
  // In production without key set, block access
  if (isProduction && !internalKey) {
    logger.warn('REPORT_INTERNAL_KEY not set in production, blocking snapshot access');
    return res.status(503).json({
      error: 'Service not configured',
      message: 'Internal report key not configured'
    });
  }
  
  // Validate the header
  const providedKey = req.headers['x-internal-report-key'];
  if (!providedKey || providedKey !== internalKey) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Invalid or missing internal key'
    });
  }
  
  next();
}

// ============================================================
// ROUTES
// ============================================================

/**
 * POST /api/pro-report/purchase/init
 * Initialize a new purchase and create folder structure
 * 
 * Input: { domain: string }
 * Output: { purchaseId: string, expiresAt: ISO string }
 */
router.post('/purchase/init', validate(initPurchaseSchema), asyncHandler(async (req, res) => {
  const { domain } = req.validatedData;
  
  // Extract clean domain from potential URL
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  
  // Generate unique purchase ID
  const purchaseId = generatePurchaseId();
  
  // Calculate expiration (7 days from now)
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  
  // Create purchase folder
  await createPurchaseFolder(purchaseId);
  
  // Write metadata
  const metadata = {
    purchaseId,
    domain: cleanDomain,
    createdAt,
    expiresAt
  };
  await writeMetadata(purchaseId, metadata);
  
  logger.info('Purchase initialized', { purchaseId, domain: cleanDomain });
  
  res.status(201).json({
    purchaseId,
    expiresAt
  });
}));

/**
 * POST /api/pro-report/purchase/:purchaseId/snapshot
 * Capture and store a scan snapshot for a purchase
 * 
 * Input: { domain, selectedUrls, selectedModules, scanResult }
 * Output: { ok: true }
 */
router.post('/purchase/:purchaseId/snapshot', validate(snapshotCaptureSchema), asyncHandler(async (req, res) => {
  const { purchaseId } = req.params;
  const { domain, selectedUrls, selectedModules, scanResult } = req.validatedData;
  
  // Validate purchaseId format
  if (!purchaseId || !/^[a-z0-9]{10,32}$/i.test(purchaseId)) {
    return res.status(400).json({
      error: 'Invalid purchase ID format'
    });
  }
  
  // Check if purchase folder exists
  const exists = await purchaseFolderExists(purchaseId);
  if (!exists) {
    return res.status(404).json({
      error: 'Purchase not found',
      message: 'Purchase ID does not exist or has expired'
    });
  }
  
  // Read and validate metadata
  const metadata = await readMetadata(purchaseId);
  if (!metadata) {
    return res.status(404).json({
      error: 'Purchase metadata not found'
    });
  }
  
  // Extract clean domain for comparison
  const cleanDomain = domain.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  if (metadata.domain !== cleanDomain) {
    return res.status(400).json({
      error: 'Domain mismatch',
      message: 'Snapshot domain does not match purchase domain'
    });
  }
  
  // Check expiration
  if (new Date(metadata.expiresAt) < new Date()) {
    return res.status(410).json({
      error: 'Purchase expired',
      message: 'This purchase has expired'
    });
  }
  
  // Build snapshot object
  const snapshot = {
    meta: {
      domain: cleanDomain,
      selectedUrls,
      selectedModules,
      createdAt: new Date().toISOString(),
      expiresAt: metadata.expiresAt
    },
    scanResult
  };
  
  // Write snapshot
  await writeSnapshot(purchaseId, snapshot);
  
  logger.info('Snapshot captured', { 
    purchaseId, 
    domain: cleanDomain, 
    urlCount: selectedUrls.length,
    moduleCount: selectedModules.length 
  });
  
  res.json({ ok: true });
}));

/**
 * GET /api/pro-report/purchase/:purchaseId/snapshot
 * Retrieve a stored snapshot (for debugging and report rendering)
 * 
 * In production: requires X-Internal-Report-Key header
 * Output: snapshot JSON or 404
 */
router.get('/purchase/:purchaseId/snapshot', requireInternalKey, asyncHandler(async (req, res) => {
  const { purchaseId } = req.params;
  
  // Validate purchaseId format
  if (!purchaseId || !/^[a-z0-9]{10,32}$/i.test(purchaseId)) {
    return res.status(400).json({
      error: 'Invalid purchase ID format'
    });
  }
  
  // Check if purchase folder exists
  const exists = await purchaseFolderExists(purchaseId);
  if (!exists) {
    return res.status(404).json({
      error: 'Purchase not found'
    });
  }
  
  // Read snapshot
  const snapshot = await readSnapshot(purchaseId);
  if (!snapshot) {
    return res.status(404).json({
      error: 'Snapshot not found',
      message: 'Snapshot has not been captured yet'
    });
  }
  
  logger.info('Snapshot retrieved', { purchaseId });
  
  res.json(snapshot);
}));

/**
 * GET /api/pro-report/purchase/:purchaseId/status
 * Get purchase status and metadata (for debugging)
 */
router.get('/purchase/:purchaseId/status', asyncHandler(async (req, res) => {
  const { purchaseId } = req.params;
  
  // Validate purchaseId format
  if (!purchaseId || !/^[a-z0-9]{10,32}$/i.test(purchaseId)) {
    return res.status(400).json({
      error: 'Invalid purchase ID format'
    });
  }
  
  // Check if purchase folder exists
  const exists = await purchaseFolderExists(purchaseId);
  if (!exists) {
    return res.status(404).json({
      error: 'Purchase not found'
    });
  }
  
  // Read metadata
  const metadata = await readMetadata(purchaseId);
  if (!metadata) {
    return res.status(404).json({
      error: 'Purchase metadata not found'
    });
  }
  
  // Check if snapshot exists
  const snapshot = await readSnapshot(purchaseId);
  const hasSnapshot = !!snapshot;
  
  // Check expiration
  const isExpired = new Date(metadata.expiresAt) < new Date();
  
  res.json({
    purchaseId: metadata.purchaseId,
    domain: metadata.domain,
    createdAt: metadata.createdAt,
    expiresAt: metadata.expiresAt,
    isExpired,
    hasSnapshot
  });
}));

module.exports = router;
