const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const config = require('../config');
const browserPool = require('./browserPool');
const { createLogger } = require('./logger');
const { isSafeReportId } = require('./reportId');

const logger = createLogger('ReportScreenshot');

function getReportsDirAbsolute() {
  // config.reports.dir is repo-relative by default ('./reports')
  return path.resolve(process.cwd(), config.reports.dir);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureReportScreenshot({ url, reportId, requestId, filename = 'screenshot.jpg' }) {
  if (!url || !reportId) return null;
  if (!isSafeReportId(reportId)) {
    logger.warn('Refusing to write screenshot for unsafe reportId', { reportId, requestId });
    return null;
  }

  logger.info('Screenshot request', { url, reportId, filename, requestId });

  const reportsDir = getReportsDirAbsolute();
  const reportDir = path.join(reportsDir, reportId);
  const screenshotPath = path.join(reportDir, filename);

  // If already present, return URL immediately.
  if (await fileExists(screenshotPath)) {
    logger.info('Screenshot already exists, returning cached', { url, reportId, filename });
    return `/reports/${encodeURIComponent(reportId)}/${encodeURIComponent(filename)}`;
  }

  logger.info('Capturing new screenshot', { url, reportId });

  try {
    await fs.mkdir(reportDir, { recursive: true });
  } catch (e) {
    logger.error('Failed to create report directory for screenshot', {
      reportId,
      reportDir,
      requestId,
      error: e.message,
    });
    return null;
  }

  try {
    await browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1280, height: 720 });

        // Wait for network to be mostly idle for better screenshots
        // Use 'networkidle2' which waits until there are no more than 2 network connections for 500ms
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });

        // Additional settle time for late styles/layout/images
        await page.waitForTimeout(500);

        await page.screenshot({
          path: screenshotPath,
          type: 'jpeg',
          quality: 78,
          fullPage: false,
        });
      } finally {
        try {
          await page.close();
        } catch {
          // ignore
        }
      }
    });

    // Guard: sometimes puppeteer returns without writing (rare). Ensure file exists.
    if (!fsSync.existsSync(screenshotPath)) {
      return null;
    }

    return `/reports/${encodeURIComponent(reportId)}/${encodeURIComponent(filename)}`;
  } catch (e) {
    logger.warn('Screenshot capture failed', {
      reportId,
      url,
      requestId,
      error: e.message,
    });
    return null;
  }
}

module.exports = {
  ensureReportScreenshot,
  getReportsDirAbsolute,
};
