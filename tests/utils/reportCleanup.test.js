/**
 * Tests for Report Cleanup Service
 */

const fs = require('fs').promises;
const path = require('path');

// Define test directory path before mocking
const testReportsDir = path.join(__dirname, '../fixtures/test-reports');

const { 
  cleanupOldReports, 
  getCleanupStats,
  startScheduledCleanup,
  stopScheduledCleanup 
} = require('../../src/utils/reportCleanup');

// Mock config
jest.mock('../../src/config', () => ({
  reports: {
    dir: require('path').join(__dirname, '../fixtures/test-reports'),
    retentionDays: 7,
  },
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Report Cleanup Service', () => {
  beforeEach(async () => {
    // Create test reports directory
    await fs.mkdir(testReportsDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      const files = await fs.readdir(testReportsDir);
      for (const file of files) {
        await fs.unlink(path.join(testReportsDir, file));
      }
      await fs.rmdir(testReportsDir);
    } catch (error) {
      // Directory might not exist, ignore
    }
  });

  describe('cleanupOldReports', () => {
    it('should delete reports older than retention period', async () => {
      // Create old report (10 days old)
      const oldFile = path.join(testReportsDir, 'old-report.pdf');
      await fs.writeFile(oldFile, 'old content');
      
      // Set file modification time to 10 days ago
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await fs.utimes(oldFile, tenDaysAgo, tenDaysAgo);

      // Create recent report (2 days old)
      const recentFile = path.join(testReportsDir, 'recent-report.pdf');
      await fs.writeFile(recentFile, 'recent content');
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await fs.utimes(recentFile, twoDaysAgo, twoDaysAgo);

      // Run cleanup
      const result = await cleanupOldReports();

      // Verify results
      expect(result.deleted).toBe(1);
      expect(result.kept).toBe(1);
      expect(result.errors).toBe(0);

      // Verify old file deleted
      await expect(fs.access(oldFile)).rejects.toThrow();

      // Verify recent file kept
      await expect(fs.access(recentFile)).resolves.not.toThrow();
    });

    it('should handle empty directory', async () => {
      const result = await cleanupOldReports();

      expect(result.deleted).toBe(0);
      expect(result.kept).toBe(0);
      expect(result.errors).toBe(0);
    });

    it('should only process PDF files', async () => {
      // Create non-PDF files
      const txtFile = path.join(testReportsDir, 'readme.txt');
      await fs.writeFile(txtFile, 'text content');
      
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await fs.utimes(txtFile, oldDate, oldDate);

      // Run cleanup
      const result = await cleanupOldReports();

      // Non-PDF should not be counted or deleted
      expect(result.deleted).toBe(0);
      expect(result.kept).toBe(0);
      
      // Verify file still exists
      await expect(fs.access(txtFile)).resolves.not.toThrow();
    });

    it('should track freed disk space', async () => {
      // Create old report with known size
      const oldFile = path.join(testReportsDir, 'old-report.pdf');
      const content = 'x'.repeat(1024); // 1 KB
      await fs.writeFile(oldFile, content);
      
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await fs.utimes(oldFile, tenDaysAgo, tenDaysAgo);

      // Run cleanup
      const result = await cleanupOldReports();

      // Verify freed space is tracked
      expect(result.freed).toBeGreaterThan(0);
      expect(result.freed).toBeGreaterThanOrEqual(1024);
    });

    it('should handle file deletion errors gracefully', async () => {
      // Create a report
      const report = path.join(testReportsDir, 'report.pdf');
      await fs.writeFile(report, 'content');
      
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await fs.utimes(report, tenDaysAgo, tenDaysAgo);

      // Skip this test on Windows as file permissions work differently
      if (process.platform === 'win32') {
        // Just verify cleanup runs without throwing
        const result = await cleanupOldReports();
        expect(result).toHaveProperty('deleted');
        return;
      }

      // Make directory read-only (permission issue) - Unix only
      await fs.chmod(testReportsDir, 0o444);

      // Run cleanup
      const result = await cleanupOldReports();

      // Should track as error
      expect(result.errors).toBeGreaterThan(0);
      expect(result.deleted).toBe(0);

      // Restore permissions for cleanup
      await fs.chmod(testReportsDir, 0o755);
    });
  });

  describe('getCleanupStats', () => {
    it('should return accurate statistics', async () => {
      // Create mix of old and recent reports
      const oldFile1 = path.join(testReportsDir, 'old1.pdf');
      const oldFile2 = path.join(testReportsDir, 'old2.pdf');
      const recentFile = path.join(testReportsDir, 'recent.pdf');

      await fs.writeFile(oldFile1, 'old content 1');
      await fs.writeFile(oldFile2, 'old content 2');
      await fs.writeFile(recentFile, 'recent content');

      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      await fs.utimes(oldFile1, tenDaysAgo, tenDaysAgo);
      await fs.utimes(oldFile2, tenDaysAgo, tenDaysAgo);

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await fs.utimes(recentFile, twoDaysAgo, twoDaysAgo);

      // Get stats
      const stats = await getCleanupStats();

      // Verify stats
      expect(stats.total).toBe(3);
      expect(stats.old).toBe(2);
      expect(stats.recent).toBe(1);
      expect(typeof stats.totalSize).toBe('number');
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.retentionDays).toBe(7);
    });

    it('should handle non-existent directory', async () => {
      // Remove directory
      await fs.rmdir(testReportsDir);

      const stats = await getCleanupStats();

      expect(stats.total).toBe(0);
      expect(stats.old).toBe(0);
      expect(stats.recent).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('startScheduledCleanup', () => {
    it('should return interval timer', () => {
      const interval = startScheduledCleanup(10000); // 10 seconds

      expect(interval).toBeDefined();
      expect(typeof interval).toBe('object');

      // Clean up
      stopScheduledCleanup(interval);
    });

    it('should use default interval if not specified', () => {
      const interval = startScheduledCleanup();

      expect(interval).toBeDefined();

      stopScheduledCleanup(interval);
    });
  });

  describe('stopScheduledCleanup', () => {
    it('should stop cleanup job', () => {
      const interval = startScheduledCleanup(10000);
      
      // Should not throw
      expect(() => stopScheduledCleanup(interval)).not.toThrow();
    });

    it('should handle null interval', () => {
      expect(() => stopScheduledCleanup(null)).not.toThrow();
    });
  });
});
