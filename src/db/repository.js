/**
 * Repository Layer - Abstracts database operations
 *
 * Single source of truth for all DB access patterns.
 * SQLite implementation now; can be swapped for Postgres later.
 */

const { getDatabase } = require('./index');
const { createLogger } = require('../utils/logger');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const logger = createLogger('Repository');

// Artifacts directory (configurable via env)
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.join(process.cwd(), 'data', 'artifacts');

/**
 * Ensure artifacts directory exists
 */
function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

// ============================================================
// REPORT/SCAN OPERATIONS
// ============================================================

/**
 * Create a new report run (scan)
 * @param {Object} params
 * @param {string} params.id - UUID for the scan
 * @param {string} params.targetUrl - URL being scanned
 * @param {string} params.userId - Optional user ID
 * @param {Object} params.options - Scan options (maxPages, analyzers, etc.)
 * @param {string} params.analyzerVersion - Version of analyzer code
 * @param {string} params.schemaVersion - Version of result schema
 * @param {string} params.rendererVersion - Version of report renderer
 * @returns {Promise<Object>} Created scan record
 */
async function createReportRun({
  id,
  targetUrl,
  userId = null,
  options = {},
  analyzerVersion = null,
  schemaVersion = '1.0',
  rendererVersion = null
}) {
  const db = getDatabase();

  await db.run(
    `INSERT INTO scans (
      id, target_url, user_id, options_json, status,
      analyzer_version, schema_version, renderer_version,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [id, targetUrl, userId, JSON.stringify(options), analyzerVersion, schemaVersion, rendererVersion]
  );

  logger.info('Report run created', { scanId: id, targetUrl, userId });

  return { id, targetUrl, userId, status: 'queued', analyzerVersion, schemaVersion, rendererVersion };
}

/**
 * Update report run status and progress
 * @param {string} scanId
 * @param {Object} updates
 */
async function updateReportRun(scanId, updates) {
  const db = getDatabase();
  const fields = [];
  const values = [];

  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?');
    values.push(updates.progress);
  }
  if (updates.startedAt !== undefined) {
    fields.push('started_at = ?');
    values.push(updates.startedAt);
  }
  if (updates.finishedAt !== undefined) {
    fields.push('finished_at = ?');
    values.push(updates.finishedAt);
  }
  if (updates.errorMessage !== undefined) {
    fields.push('error_message = ?');
    values.push(updates.errorMessage);
  }
  if (updates.pagesCrawled !== undefined) {
    fields.push('pages_crawled = ?');
    values.push(updates.pagesCrawled);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(scanId);

  await db.run(
    `UPDATE scans SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/**
 * Get report run by ID
 * @param {string} scanId
 * @returns {Promise<Object|null>}
 */
async function getReportRun(scanId) {
  const db = getDatabase();
  return db.get('SELECT * FROM scans WHERE id = ?', [scanId]);
}

/**
 * List reports for a user
 * @param {string} userId
 * @param {Object} options
 * @param {number} options.limit
 * @param {number} options.offset
 * @returns {Promise<Array>}
 */
async function listReports(userId, { limit = 50, offset = 0 } = {}) {
  const db = getDatabase();
  return db.all(
    `SELECT * FROM scans WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
}

// ============================================================
// SCAN RESULT OPERATIONS
// ============================================================

/**
 * Save scan result
 * @param {Object} params
 * @param {string} params.scanId
 * @param {string} params.resultType - font, seo, security, etc.
 * @param {Object} params.data - Result data (will be JSON stringified)
 * @param {string} params.pageUrl - Optional specific page URL
 * @returns {Promise<number>} Result ID
 */
async function saveScanResult({ scanId, resultType, data, pageUrl = null }) {
  const db = getDatabase();

  const result = await db.run(
    `INSERT INTO scan_results (scan_id, result_type, result_json, page_url, created_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [scanId, resultType, JSON.stringify(data), pageUrl]
  );

  return result.lastID;
}

/**
 * Get scan results by scan ID
 * @param {string} scanId
 * @param {string} resultType - Optional filter by type
 * @returns {Promise<Array>}
 */
async function getScanResults(scanId, resultType = null) {
  const db = getDatabase();

  if (resultType) {
    return db.all(
      'SELECT * FROM scan_results WHERE scan_id = ? AND result_type = ?',
      [scanId, resultType]
    );
  }

  return db.all('SELECT * FROM scan_results WHERE scan_id = ?', [scanId]);
}

// ============================================================
// ARTIFACT OPERATIONS (FILESYSTEM STORAGE)
// ============================================================

/**
 * Save artifact to filesystem and record in DB
 * @param {Object} params
 * @param {string} params.scanId
 * @param {string} params.artifactType - screenshot, lighthouse_json, pdf, etc.
 * @param {Buffer|string} params.data - File content
 * @param {string} params.mimeType
 * @param {Object} params.metadata - Extra info (dimensions, etc.)
 * @returns {Promise<Object>} Artifact record with file_path
 */
async function saveArtifact({ scanId, artifactType, data, mimeType = 'application/octet-stream', metadata = {} }) {
  ensureArtifactsDir();
  const db = getDatabase();

  // Generate unique filename: scanId/artifactType_timestamp_random.ext
  const ext = mimeType.split('/')[1] || 'bin';
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex');
  const filename = `${artifactType}_${timestamp}_${random}.${ext}`;
  const scanDir = path.join(ARTIFACTS_DIR, scanId);

  if (!fs.existsSync(scanDir)) {
    fs.mkdirSync(scanDir, { recursive: true });
  }

  const filePath = path.join(scanDir, filename);
  const relativePath = path.join(scanId, filename);

  // Write file
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  fs.writeFileSync(filePath, buffer);

  const fileSize = buffer.length;

  // Record in DB
  const result = await db.run(
    `INSERT INTO report_artifacts (scan_id, artifact_type, file_path, file_size, mime_type, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [scanId, artifactType, relativePath, fileSize, mimeType, JSON.stringify(metadata)]
  );

  logger.info('Artifact saved', { scanId, artifactType, filePath: relativePath, fileSize });

  return {
    id: result.lastID,
    scanId,
    artifactType,
    filePath: relativePath,
    fileSize,
    mimeType,
    metadata
  };
}

/**
 * Get artifact metadata by scan ID and type
 * @param {string} scanId
 * @param {string} artifactType
 * @returns {Promise<Object|null>}
 */
async function getArtifact(scanId, artifactType) {
  const db = getDatabase();
  return db.get(
    'SELECT * FROM report_artifacts WHERE scan_id = ? AND artifact_type = ?',
    [scanId, artifactType]
  );
}

/**
 * Get all artifacts for a scan
 * @param {string} scanId
 * @returns {Promise<Array>}
 */
async function getArtifacts(scanId) {
  const db = getDatabase();
  return db.all('SELECT * FROM report_artifacts WHERE scan_id = ?', [scanId]);
}

/**
 * Read artifact file content
 * @param {string} relativePath - Path from artifact record
 * @returns {Buffer|null}
 */
function readArtifactFile(relativePath) {
  const fullPath = path.join(ARTIFACTS_DIR, relativePath);
  if (fs.existsSync(fullPath)) {
    return fs.readFileSync(fullPath);
  }
  return null;
}

/**
 * Delete artifact file and DB record
 * @param {number} artifactId
 */
async function deleteArtifact(artifactId) {
  const db = getDatabase();

  const artifact = await db.get('SELECT * FROM report_artifacts WHERE id = ?', [artifactId]);
  if (!artifact) return;

  // Delete file
  const fullPath = path.join(ARTIFACTS_DIR, artifact.file_path);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }

  // Delete DB record
  await db.run('DELETE FROM report_artifacts WHERE id = ?', [artifactId]);

  logger.info('Artifact deleted', { artifactId, filePath: artifact.file_path });
}

// ============================================================
// ENTITLEMENT OPERATIONS
// ============================================================

/**
 * Set user entitlement
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.plan - free, starter, pro
 * @param {Object} params.options - scansRemaining, maxPagesPerScan, etc.
 */
async function setEntitlement({
  userId,
  plan,
  scansRemaining = 0,
  maxPagesPerScan = 10,
  pdfExportEnabled = false,
  validUntil = null,
  stripeSubscriptionId = null
}) {
  const db = getDatabase();

  await db.run(
    `INSERT INTO entitlements (
      user_id, plan, scans_remaining, max_pages_per_scan, pdf_export_enabled,
      valid_until, stripe_subscription_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      plan = excluded.plan,
      scans_remaining = excluded.scans_remaining,
      max_pages_per_scan = excluded.max_pages_per_scan,
      pdf_export_enabled = excluded.pdf_export_enabled,
      valid_until = excluded.valid_until,
      stripe_subscription_id = excluded.stripe_subscription_id,
      updated_at = CURRENT_TIMESTAMP`,
    [userId, plan, scansRemaining, maxPagesPerScan, pdfExportEnabled ? 1 : 0, validUntil, stripeSubscriptionId]
  );

  logger.info('Entitlement set', { userId, plan });
}

/**
 * Get user entitlements
 * @param {string} userId
 * @returns {Promise<Object|null>}
 */
async function getEntitlements(userId) {
  const db = getDatabase();
  return db.get('SELECT * FROM entitlements WHERE user_id = ?', [userId]);
}

/**
 * Decrement scans remaining for a user
 * @param {string} userId
 * @returns {Promise<boolean>} True if decremented, false if no scans remaining
 */
async function decrementScansRemaining(userId) {
  const db = getDatabase();

  const result = await db.run(
    `UPDATE entitlements SET scans_remaining = scans_remaining - 1, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ? AND (scans_remaining > 0 OR scans_remaining = -1)`,
    [userId]
  );

  return result.changes > 0;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  // Report/Scan operations
  createReportRun,
  updateReportRun,
  getReportRun,
  listReports,

  // Scan result operations
  saveScanResult,
  getScanResults,

  // Artifact operations
  saveArtifact,
  getArtifact,
  getArtifacts,
  readArtifactFile,
  deleteArtifact,
  ARTIFACTS_DIR,

  // Entitlement operations
  setEntitlement,
  getEntitlements,
  decrementScansRemaining
};
