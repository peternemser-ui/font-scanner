/**
 * Competitive Accessibility Analyzer
 * Fast, Lighthouse-free accessibility analysis optimized for competitive analysis
 * Uses only Puppeteer for reliable results
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('CompetitiveAccessibilityAnalyzer');

class CompetitiveAccessibilityAnalyzer {
  /**
   * Fast accessibility analysis without Lighthouse
   * @param {string} url - URL to analyze
   * @returns {Object} Accessibility score and issues
   */
  async analyzeAccessibility(url) {
    const startTime = Date.now();
    logger.info(`Fast accessibility analysis for: ${url}`);

    try {
      const metrics = await this.collectMetrics(url);
      const score = this.calculateScore(metrics);
      
      const duration = formatDuration(Date.now() - startTime, 2);
      logger.info(`Accessibility completed in ${duration}s: ${score}`);
      
      return {
        url,
        accessibilityScore: score,
        desktop: { accessibilityScore: score },
        mobile: { accessibilityScore: Math.max(score - 5, 0) }, // Mobile slightly harder
        metrics,
        duration: `${duration}s`,
        method: 'puppeteer-only'
      };
    } catch (error) {
      logger.error(`Accessibility analysis failed: ${error.message}`);
      throw error;
    }
  }

  async collectMetrics(url) {
    return browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      
      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

        const metrics = await page.evaluate(() => {
          const results = {
            contrastIssues: 0,
            missingAlt: 0,
            ariaIssues: 0,
            headingStructure: { valid: true },
            formLabels: { total: 0, missing: 0 },
            lang: document.documentElement.lang ? 1 : 0
          };

          // Check images for alt text
          const images = document.querySelectorAll('img');
          results.totalImages = images.length;
          results.missingAlt = Array.from(images).filter(img => !img.alt && !img.getAttribute('aria-label')).length;

          // Check form inputs for labels
          const inputs = document.querySelectorAll('input:not([type="hidden"]), textarea, select');
          results.formLabels.total = inputs.length;
          results.formLabels.missing = Array.from(inputs).filter(input => {
            const id = input.id;
            const hasLabel = id && document.querySelector(`label[for="${id}"]`);
            const hasAriaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
            return !hasLabel && !hasAriaLabel;
          }).length;

          // Check ARIA roles
          const invalidRoles = document.querySelectorAll('[role]:not([role="navigation"]):not([role="main"]):not([role="banner"]):not([role="contentinfo"]):not([role="complementary"]):not([role="search"]):not([role="button"]):not([role="link"])');
          results.ariaIssues = invalidRoles.length;

          // Check heading structure
          const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
          results.headingStructure.count = headings.length;
          results.headingStructure.hasH1 = document.querySelector('h1') !== null;

          // Basic contrast check (simple heuristic)
          const textElements = document.querySelectorAll('p, span, a, button, h1, h2, h3, h4, h5, h6, li');
          let lowContrastCount = 0;
          
          Array.from(textElements).slice(0, 50).forEach(el => {
            const style = window.getComputedStyle(el);
            const color = style.color;
            const bgColor = style.backgroundColor;
            
            // Simple check: if text is light gray on white-ish background
            if (color.includes('rgb')) {
              const rgb = color.match(/\d+/g);
              if (rgb && rgb.length >= 3) {
                const luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
                if (luminance > 0.6) lowContrastCount++; // Light text
              }
            }
          });
          
          results.contrastIssues = lowContrastCount;

          return results;
        });

        await page.close();
        return metrics;
      } catch (error) {
        await page.close();
        throw error;
      }
    });
  }

  calculateScore(metrics) {
    let score = 100;

    // Penalize missing alt text (max -25 points)
    if (metrics.totalImages > 0) {
      const altPercentage = ((metrics.totalImages - metrics.missingAlt) / metrics.totalImages) * 100;
      score -= Math.max(0, (100 - altPercentage) * 0.25);
    }

    // Penalize missing form labels (max -20 points)
    if (metrics.formLabels.total > 0) {
      const labelPercentage = ((metrics.formLabels.total - metrics.formLabels.missing) / metrics.formLabels.total) * 100;
      score -= Math.max(0, (100 - labelPercentage) * 0.20);
    }

    // Penalize ARIA issues (max -15 points)
    score -= Math.min(metrics.ariaIssues * 3, 15);

    // Penalize contrast issues (max -20 points)
    score -= Math.min(metrics.contrastIssues, 20);

    // Penalize missing h1 (-10 points)
    if (!metrics.headingStructure.hasH1) score -= 10;

    // Penalize missing lang attribute (-10 points)
    if (!metrics.lang) score -= 10;

    return Math.max(roundTo(score, 0), 0);
  }
}

module.exports = new CompetitiveAccessibilityAnalyzer();
