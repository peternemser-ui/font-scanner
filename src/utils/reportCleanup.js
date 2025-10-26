/**
 * Report Cleanup Service
 * 
 * Automatically deletes old PDF reports based on retention policy.
 * Implements GDPR-compliant data retention with:
 * - Configurable retention period
 * - Scheduled cleanup jobs
 * - Detailed logging and metrics
 * - Statistics endpoint
 * 
 * @module reportCleanup
 */

const fs = require('fs').promises;
const path = require('path');
const { createLogger } = require('./logger');
const config = require('../config');

const logger = createLogger('ReportCleanup');

// Track cleanup interval for graceful shutdown
let cleanupInterval = null;

/**
 * Get list of files in reports directory with their stats
 * @returns {Promise<Array>} Array of file objects with name, path, and stats
 */
async function getReportFiles() {
  try {
    const reportsDir = config.reports.dir;
    
    // Ensure directory exists
    await fs.mkdir(reportsDir, { recursive: true });
    
    const files = await fs.readdir(reportsDir);
    
    // Get stats for each file
    const fileStats = await Promise.all(
      files
        .filter(file => file.endsWith('.pdf')) // Only PDF files
        .map(async (file) => {
          const filePath = path.join(reportsDir, file);
          try {
            const stats = await fs.stat(filePath);
            return {
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime,
              age: Date.now() - stats.mtime.getTime(),
            };
          } catch (error) {
            logger.warn(`Failed to stat file ${file}:`, error);
            return null;
          }
        })
    );
    
    return fileStats.filter(f => f !== null);
  } catch (error) {
    logger.error('Failed to read reports directory:', error);
    return [];
  }
}

/**
 * Delete old reports based on retention policy
 * @returns {Promise<Object>} Cleanup statistics
 */
async function cleanupOldReports() {
  const startTime = Date.now();
  logger.info('Starting report cleanup', {
    retentionDays: config.reports.retentionDays,
    reportsDir: config.reports.dir,
  });
  
  const retentionMs = config.reports.retentionDays * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - retentionMs;
  
  const files = await getReportFiles();
  
  const stats = {
    total: files.length,
    deleted: 0,
    kept: 0,
    freed: 0,
    errors: 0,
    deletedFiles: [],
  };
  
  for (const file of files) {
    if (file.modified.getTime() < cutoffTime) {
      // File is older than retention period, delete it
      try {
        await fs.unlink(file.path);
        stats.deleted++;
        stats.freed += file.size;
        stats.deletedFiles.push({
          name: file.name,
          age: Math.floor(file.age / (24 * 60 * 60 * 1000)), // Age in days
          size: file.size,
        });
        
        logger.info('Deleted old report', {
          file: file.name,
          ageDays: Math.floor(file.age / (24 * 60 * 60 * 1000)),
          sizeMB: (file.size / (1024 * 1024)).toFixed(2),
        });
      } catch (error) {
        stats.errors++;
        logger.error('Failed to delete report', {
          file: file.name,
          error: error.message,
        });
      }
    } else {
      stats.kept++;
    }
  }
  
  const duration = Date.now() - startTime;
  
  logger.info('Report cleanup completed', {
    duration: `${duration}ms`,
    total: stats.total,
    deleted: stats.deleted,
    kept: stats.kept,
    freedMB: (stats.freed / (1024 * 1024)).toFixed(2),
    errors: stats.errors,
  });
  
  return stats;
}

/**
 * Get statistics about reports directory
 * @returns {Promise<Object>} Report statistics
 */
async function getCleanupStats() {
  const files = await getReportFiles();
  const retentionMs = config.reports.retentionDays * 24 * 60 * 60 * 1000;
  const cutoffTime = Date.now() - retentionMs;
  
  const oldFiles = files.filter(f => f.modified.getTime() < cutoffTime);
  const recentFiles = files.filter(f => f.modified.getTime() >= cutoffTime);
  
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const oldSize = oldFiles.reduce((sum, f) => sum + f.size, 0);
  const recentSize = recentFiles.reduce((sum, f) => sum + f.size, 0);
  
  return {
    total: files.length,
    old: oldFiles.length,
    recent: recentFiles.length,
    totalSize: totalSize,
    totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
    oldSize: oldSize,
    oldSizeMB: (oldSize / (1024 * 1024)).toFixed(2),
    recentSize: recentSize,
    recentSizeMB: (recentSize / (1024 * 1024)).toFixed(2),
    retentionDays: config.reports.retentionDays,
    reportsDir: config.reports.dir,
  };
}

/**
 * Start scheduled cleanup job
 * Runs cleanup at specified interval
 * @param {number} intervalMs - Interval in milliseconds (default: 24 hours)
 * @returns {NodeJS.Timeout} Interval handle for stopping the job
 */
function startScheduledCleanup(intervalMs = 24 * 60 * 60 * 1000) {
  if (cleanupInterval) {
    logger.warn('Cleanup scheduler already running');
    return cleanupInterval;
  }
  
  logger.info('Starting report cleanup scheduler', {
    intervalHours: intervalMs / (60 * 60 * 1000),
    retentionDays: config.reports.retentionDays,
  });
  
  // Run cleanup immediately on start
  cleanupOldReports().catch(error => {
    logger.error('Initial cleanup failed:', error);
  });
  
  // Schedule recurring cleanup
  cleanupInterval = setInterval(async () => {
    try {
      await cleanupOldReports();
    } catch (error) {
      logger.error('Scheduled cleanup failed:', error);
    }
  }, intervalMs);
  
  return cleanupInterval;
}

/**
 * Stop scheduled cleanup job
 * @param {NodeJS.Timeout} interval - Interval handle from startScheduledCleanup
 */
function stopScheduledCleanup(interval = cleanupInterval) {
  if (interval) {
    clearInterval(interval);
    if (interval === cleanupInterval) {
      cleanupInterval = null;
    }
    logger.info('Report cleanup scheduler stopped');
  }
}

/**
 * Get the current cleanup interval (for testing/monitoring)
 * @returns {NodeJS.Timeout|null} Current interval or null
 */
function getCleanupInterval() {
  return cleanupInterval;
}

module.exports = {
  cleanupOldReports,
  getCleanupStats,
  startScheduledCleanup,
  stopScheduledCleanup,
  getCleanupInterval,
  getReportFiles, // Exported for testing
};
