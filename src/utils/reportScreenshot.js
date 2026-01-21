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

async function ensureReportScreenshot({ url, reportId, requestId }) {
  if (!url || !reportId) return null;
  if (!isSafeReportId(reportId)) {
    logger.warn('Refusing to write screenshot for unsafe reportId', { reportId, requestId });
    return null;
  }

  logger.info('Screenshot request', { url, reportId, requestId });

  const reportsDir = getReportsDirAbsolute();
  const reportDir = path.join(reportsDir, reportId);
  const screenshotPath = path.join(reportDir, 'screenshot.jpg');

  // If already present, return URL immediately.
  if (await fileExists(screenshotPath)) {
    logger.info('Screenshot already exists, returning cached', { url, reportId });
    return `/reports/${encodeURIComponent(reportId)}/screenshot.jpg`;
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

        // Keep screenshot capture lightweight: don't wait on long-lived network activity.
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Small settle for late styles/layout
        await page.waitForTimeout(250);

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

    return `/reports/${encodeURIComponent(reportId)}/screenshot.jpg`;
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
