const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');

const config = require('../config');
const browserPool = require('./browserPool');
const { createLogger } = require('./logger');
const { isSafeReportId } = require('./reportId');
const { setDeviceProfile, detectBotProtection } = require('./browserHelpers');

const logger = createLogger('ReportScreenshot');

function getReportsDirAbsolute() {
  // config.reports.dir is repo-relative by default ('./reports')
  return path.resolve(process.cwd(), config.reports.dir);
}

/**
 * Build a fallback screenshot URL via WordPress mShots.
 *
 * Some sites (e.g. cars.com and other Akamai/PerimeterX-protected domains)
 * return HTTP 403 to our servers, so our own headless capture is blocked.
 * mShots renders the page from WordPress.com infrastructure that these sites
 * generally do not block, giving users a real thumbnail instead of an empty
 * placeholder. The generated image is served over HTTPS, which the app CSP
 * (`imgSrc: 'self' data: https:`) already permits.
 *
 * @param {string} url - Public URL of the analyzed page
 * @returns {string|null} mShots image URL, or null if url is missing
 */
function buildMshotsFallbackUrl(url) {
  if (!url) return null;
  return `https://s0.wp.com/mshots/v1/${encodeURIComponent(url)}?w=1200&h=675`;
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

  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        try {
          await setDeviceProfile(page, 'desktop');

          // Navigate and capture HTTP response for status checking
          const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

          // Check if the page is blocked (403, captcha, bot protection)
          // Skip screenshot — a placeholder is better than a misleading error page
          const botCheck = await detectBotProtection(page, response);
          if (botCheck.isDetected) {
            logger.warn('Screenshot blocked by site — using mShots fallback', {
              reportId, url, reason: botCheck.reason,
            });
            return { blocked: true };
          }

          // Additional settle time for late styles/layout/images
          await new Promise(r => setTimeout(r, 500));

          await page.screenshot({
            path: screenshotPath,
            type: 'jpeg',
            quality: 78,
            fullPage: false,
          });

          return { blocked: false };
        } finally {
          try {
            await page.close();
          } catch {
            // ignore
          }
        }
      });

      // If site actively blocked us, don't retry — it won't change.
      // Fall back to an mShots thumbnail rendered from external infra.
      if (result && result.blocked) {
        return buildMshotsFallbackUrl(url);
      }

      // Guard: sometimes puppeteer returns without writing (rare). Ensure file exists.
      if (!fsSync.existsSync(screenshotPath)) {
        if (attempt < maxAttempts) {
          logger.warn('Screenshot file not written, retrying', { reportId, attempt });
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return buildMshotsFallbackUrl(url);
      }

      return `/reports/${encodeURIComponent(reportId)}/${encodeURIComponent(filename)}`;
    } catch (e) {
      logger.warn('Screenshot capture failed', {
        reportId,
        url,
        requestId,
        attempt,
        error: e.message,
      });
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      return buildMshotsFallbackUrl(url);
    }
  }
  return buildMshotsFallbackUrl(url);
}

module.exports = {
  ensureReportScreenshot,
  getReportsDirAbsolute,
  buildMshotsFallbackUrl,
};
