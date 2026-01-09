/**
 * Pro Report Snapshot Storage Utilities
 * Handles disk-based storage for paid report snapshots
 * @module proReportStorage
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { createLogger } = require('./logger');

const logger = createLogger('ProReportStorage');

/**
 * Get the base storage directory for pro report snapshots
 * - Production: /var/lib/sitemechanic/reports/ (or REPORT_STORAGE_DIR env var)
 * - Development: ./data/reports (configurable via REPORT_STORAGE_DIR)
 * @returns {string} Absolute path to storage directory
 */
function getStorageDir() {
  const isProduction = process.env.NODE_ENV === 'production';
  const envDir = process.env.REPORT_STORAGE_DIR;
  
  if (envDir) {
    return path.resolve(envDir);
  }
  
  if (isProduction) {
    return '/var/lib/sitemechanic/reports';
  }
  
  // Development default
  return path.resolve(process.cwd(), 'data', 'reports');
}

/**
 * Generate a unique purchase ID
 * Uses crypto-safe random bytes formatted as a ULID-like string
 * @returns {string} Unique purchase ID (26 chars, URL-safe)
 */
function generatePurchaseId() {
  // Generate timestamp component (first 10 chars, base32-encoded)
  const timestamp = Date.now();
  const timeBytes = Buffer.alloc(6);
  timeBytes.writeUIntBE(timestamp, 0, 6);
  
  // Generate random component (16 bytes = 80 bits of randomness)
  const randomBytes = crypto.randomBytes(10);
  
  // Combine and encode as base32 (Crockford's alphabet, lowercase for URLs)
  const combined = Buffer.concat([timeBytes, randomBytes]);
  const base32Chars = '0123456789abcdefghjkmnpqrstvwxyz';
  
  let result = '';
  for (let i = 0; i < combined.length; i++) {
    result += base32Chars[combined[i] % 32];
  }
  
  return result;
}

/**
 * Get the folder path for a specific purchase
 * @param {string} purchaseId - The purchase ID
 * @returns {string} Absolute path to purchase folder
 */
function getPurchaseFolderPath(purchaseId) {
  const storageDir = getStorageDir();
  // Validate purchaseId format to prevent directory traversal
  if (!purchaseId || !/^[a-z0-9]{10,32}$/i.test(purchaseId)) {
    throw new Error('Invalid purchase ID format');
  }
  return path.join(storageDir, purchaseId);
}

/**
 * Create the purchase folder and return its path
 * Ensures all parent directories exist with safe permissions
 * @param {string} purchaseId - The purchase ID
 * @returns {Promise<string>} Absolute path to created folder
 */
async function createPurchaseFolder(purchaseId) {
  const folderPath = getPurchaseFolderPath(purchaseId);
  
  try {
    await fs.mkdir(folderPath, { recursive: true, mode: 0o750 });
    logger.info('Created purchase folder', { purchaseId, path: folderPath });
    return folderPath;
  } catch (error) {
    logger.error('Failed to create purchase folder', { purchaseId, error: error.message });
    throw error;
  }
}

/**
 * Check if a purchase folder exists
 * @param {string} purchaseId - The purchase ID
 * @returns {Promise<boolean>} True if folder exists
 */
async function purchaseFolderExists(purchaseId) {
  try {
    const folderPath = getPurchaseFolderPath(purchaseId);
    await fs.access(folderPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Write the purchase metadata file
 * @param {string} purchaseId - The purchase ID
 * @param {object} metadata - Metadata object to write
 * @returns {Promise<void>}
 */
async function writeMetadata(purchaseId, metadata) {
  const folderPath = getPurchaseFolderPath(purchaseId);
  const metaPath = path.join(folderPath, 'meta.json');
  
  try {
    const content = JSON.stringify(metadata, null, 2);
    await fs.writeFile(metaPath, content, { encoding: 'utf8', mode: 0o640 });
    logger.info('Wrote purchase metadata', { purchaseId });
  } catch (error) {
    logger.error('Failed to write metadata', { purchaseId, error: error.message });
    throw error;
  }
}

/**
 * Read the purchase metadata file
 * @param {string} purchaseId - The purchase ID
 * @returns {Promise<object|null>} Metadata object or null if not found
 */
async function readMetadata(purchaseId) {
  const folderPath = getPurchaseFolderPath(purchaseId);
  const metaPath = path.join(folderPath, 'meta.json');
  
  try {
    const content = await fs.readFile(metaPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    logger.error('Failed to read metadata', { purchaseId, error: error.message });
    throw error;
  }
}

/**
 * Write the scan snapshot file
 * @param {string} purchaseId - The purchase ID
 * @param {object} snapshotObj - The full snapshot object to write
 * @returns {Promise<void>}
 */
async function writeSnapshot(purchaseId, snapshotObj) {
  const folderPath = getPurchaseFolderPath(purchaseId);
  const snapshotPath = path.join(folderPath, 'snapshot.json');
  
  try {
    const content = JSON.stringify(snapshotObj, null, 2);
    await fs.writeFile(snapshotPath, content, { encoding: 'utf8', mode: 0o640 });
    logger.info('Wrote snapshot', { purchaseId, size: content.length });
  } catch (error) {
    logger.error('Failed to write snapshot', { purchaseId, error: error.message });
    throw error;
  }
}

/**
 * Read the scan snapshot file
 * @param {string} purchaseId - The purchase ID
 * @returns {Promise<object|null>} Snapshot object or null if not found
 */
async function readSnapshot(purchaseId) {
  const folderPath = getPurchaseFolderPath(purchaseId);
  const snapshotPath = path.join(folderPath, 'snapshot.json');
  
  try {
    const content = await fs.readFile(snapshotPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    logger.error('Failed to read snapshot', { purchaseId, error: error.message });
    throw error;
  }
}

/**
 * List all purchase folders in storage
 * @returns {Promise<string[]>} Array of purchase IDs
 */
async function listPurchases() {
  const storageDir = getStorageDir();
  
  try {
    await fs.access(storageDir);
    const entries = await fs.readdir(storageDir, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Delete a purchase folder and all its contents
 * @param {string} purchaseId - The purchase ID
 * @returns {Promise<boolean>} True if deleted, false if not found
 */
async function deletePurchase(purchaseId) {
  const folderPath = getPurchaseFolderPath(purchaseId);
  
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
    logger.info('Deleted purchase folder', { purchaseId });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    logger.error('Failed to delete purchase', { purchaseId, error: error.message });
    throw error;
  }
}

module.exports = {
  getStorageDir,
  generatePurchaseId,
  getPurchaseFolderPath,
  createPurchaseFolder,
  purchaseFolderExists,
  writeMetadata,
  readMetadata,
  writeSnapshot,
  readSnapshot,
  listPurchases,
  deletePurchase
};
