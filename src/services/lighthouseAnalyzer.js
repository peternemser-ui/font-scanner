const lighthouse = require('lighthouse').default;
const chromeLauncher = require('chrome-launcher');
const { createLogger } = require('../utils/logger');

const logger = createLogger('LighthouseAnalyzer');

class LighthouseAnalyzer {
  constructor() {
    this.chrome = null;
  }

  async launchChrome() {
    if (!this.chrome) {
      try {
        this.chrome = await chromeLauncher.launch({
          chromeFlags: [
            '--headless=new',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-gpu',
            '--no-first-run',
            '--disable-default-apps',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
          ],
          logLevel: 'info',
        });
        logger.info(`Chrome launched on port ${this.chrome.port}`);
      } catch (error) {
        logger.error('Failed to launch Chrome:', error);
        throw new Error(`Chrome launch failed: ${error.message}`);
      }
    }
    return this.chrome;
  }

  async analyzeWithLighthouse(url, options = {}) {
    logger.info(`Running Lighthouse analysis for: ${url}`, {
      formFactor: options.formFactor || 'desktop',
      throttling: options.formFactor === 'mobile' ? 'Mobile preset (4x CPU, Slow 4G)' : 'Desktop (no throttling, full performance)'
    });

    // Retry logic for Lighthouse failures (NO_FCP, Chrome errors)
    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this._runLighthouse(url, options, attempt);
      } catch (error) {
        const isRetriableError = error.message.includes('NO_FCP') || 
                                 error.message.includes('Chrome internal error') ||
                                 error.message.includes('performance mark');
        
        if (attempt < maxRetries && isRetriableError) {
          logger.warn(`Lighthouse attempt ${attempt} failed (${error.message}), retrying...`);
          // Wait 5 seconds before retry to let Chrome fully settle and resources free
          await new Promise(resolve => setTimeout(resolve, 5000));
          continue;
        }
        
        // Last attempt or non-retriable error - return fallback
        throw error;
      }
    }
  }

  async _runLighthouse(url, options = {}, attempt = 1) {
    let chrome;
    try {
      chrome = await this.launchChrome();

      const lighthouseOptions = {
        logLevel: 'error',
        output: 'json',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        port: chrome.port,
        disableStorageReset: true,
        maxWaitForLoad: 35000, // Increased timeout for better reliability
        // Critical settings to prevent NO_FCP errors in headless mode
        waitForFullyLoaded: true,
        emulatedUserAgent: options.formFactor === 'mobile' 
          ? 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
          : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ...options,
      };

      // Use Lighthouse's exact CLI presets for mobile, default config for desktop
      let config;
      if (options.formFactor === 'mobile') {
        // Use very aggressive mobile throttling for realistic scores
        config = {
          extends: 'lighthouse:default',
          settings: {
            formFactor: 'mobile',
            // Prevent NO_FCP errors
            skipAudits: ['uses-http2'], // Skip flaky audits
            pauseAfterFcpMs: 1000, // Wait 1s after FCP to ensure paint
            pauseAfterLoadMs: 1000, // Wait 1s after load
            throttling: {
              rttMs: 300, // Very high latency
              throughputKbps: 400, // Very slow connection
              cpuSlowdownMultiplier: 8, // Very aggressive CPU throttling
              requestLatencyMs: 1000, // Very high request latency
              downloadThroughputKbps: 380,
              uploadThroughputKbps: 200
            },
            screenEmulation: {
              mobile: true,
              width: 375,
              height: 667,
              deviceScaleFactor: 2,
              disabled: false
            }
          }
        };
        lighthouseOptions.formFactor = 'mobile';
      } else {
        // Desktop: Use minimal configuration to avoid conflicts
        config = {
          extends: 'lighthouse:default',
          settings: {
            formFactor: 'desktop',
            // Prevent NO_FCP errors
            skipAudits: ['uses-http2'], // Skip flaky audits
            pauseAfterFcpMs: 500, // Wait 500ms after FCP
            pauseAfterLoadMs: 500, // Wait 500ms after load
            throttling: {
              rttMs: 40,
              throughputKbps: 10240,
              cpuSlowdownMultiplier: 1,
              requestLatencyMs: 0,
              downloadThroughputKbps: 0,
              uploadThroughputKbps: 0
            },
            screenEmulation: {
              mobile: false,
              width: 1350,
              height: 940,
              deviceScaleFactor: 1,
              disabled: false
            }
          }
        };
        lighthouseOptions.formFactor = 'desktop';
        // Remove any mobile-specific options that might conflict
        delete lighthouseOptions.preset;
      }

      // Add timeout wrapper to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Lighthouse analysis timed out after 45 seconds')), 45000);
      });
      
      const runnerResult = await Promise.race([
        lighthouse(url, lighthouseOptions, config),
        timeoutPromise
      ]);
      
      // Log the actual configuration that was used
      if (runnerResult?.lhr?.configSettings) {
        logger.info(`Lighthouse configuration applied:`, {
          formFactor: runnerResult.lhr.configSettings.formFactor,
          throttling: runnerResult.lhr.configSettings.throttling,
          screenEmulation: runnerResult.lhr.configSettings.screenEmulation?.mobile,
          deviceScaleFactor: runnerResult.lhr.configSettings.screenEmulation?.deviceScaleFactor
        });
      }

      if (!runnerResult || !runnerResult.lhr) {
        throw new Error('Lighthouse analysis returned no results');
      }

      if (runnerResult.lhr.runtimeError) {
        throw new Error(`Lighthouse runtime error: ${runnerResult.lhr.runtimeError.message}`);
      }

      return this.processLighthouseResults(runnerResult.lhr, options.formFactor);
    } catch (error) {
      logger.error('Lighthouse analysis error:', {
        message: error.message,
        stack: error.stack,
        url: url,
        formFactor: options.formFactor,
      });

      // Return a fallback result with error flag instead of throwing
      // NOTE: Scores are set to 0 to indicate failure - caller should use alternative metrics
      const formFactor = options.formFactor || 'desktop';
      return {
        formFactor: formFactor,
        score: 0, // Set to 0 to indicate Lighthouse failure
        performance: 0,
        metrics: {
          firstContentfulPaint: 0,
          largestContentfulPaint: 0,
          cumulativeLayoutShift: 0.1,
          totalBlockingTime: 0,
          coreWebVitals: {
            lcp: 0,
            fid: 0,
            cls: 0.1
          }
        },
        fontAudits: {
          fontDisplay: { score: 0.5, description: 'Unable to analyze (Lighthouse failed)' },
          preloadFonts: { score: 0.5, description: 'Unable to analyze (Lighthouse failed)' }
        },
        accessibility: 0,
        bestPractices: 0,
        seo: 0,
        opportunities: [],
        diagnostics: [],
        error: `Lighthouse analysis failed (${error.message})`,
        failed: true
      };
    } finally {
      // CRITICAL: Always kill Chrome after EVERY run to prevent resource exhaustion
      await this.closeLighthouse();
      
      // Add a small delay between runs to let system resources settle
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  processLighthouseResults(lhr, formFactor) {
    const fontRelatedAudits = this.extractFontAudits(lhr);
    const performanceMetrics = this.extractPerformanceMetrics(lhr);
    const accessibilityData = this.extractAccessibilityIssues(lhr);
    const bestPracticesData = this.extractBestPractices(lhr);
    const seoData = this.extractSEOIssues(lhr);

    return {
      formFactor: formFactor || 'desktop',
      score: Math.round(lhr.categories.performance.score * 100),
      performance: Math.round(lhr.categories.performance.score * 100), // Add explicit performance score
      metrics: performanceMetrics,
      fontAudits: fontRelatedAudits,
      // Expose scores at root level for easy frontend access
      accessibility: accessibilityData.score,
      bestPractices: bestPracticesData.score,
      seo: seoData.score,
      // Keep detailed data nested
      accessibilityDetails: accessibilityData,
      bestPracticesDetails: bestPracticesData,
      seoDetails: seoData,
      opportunities: this.extractOpportunities(lhr),
      diagnostics: this.extractDiagnostics(lhr),
    };
  }

  extractFontAudits(lhr) {
    const fontAudits = {};

    // Font display
    if (lhr.audits['font-display']) {
      fontAudits.fontDisplay = {
        score: lhr.audits['font-display'].score,
        description: lhr.audits['font-display'].description,
        details: lhr.audits['font-display'].details || {},
      };
    }

    // Preload key requests (fonts)
    if (lhr.audits['uses-rel-preload']) {
      fontAudits.preloadFonts = {
        score: lhr.audits['uses-rel-preload'].score,
        description: lhr.audits['uses-rel-preload'].description,
        details: lhr.audits['uses-rel-preload'].details || {},
      };
    }

    // Web fonts during layout
    if (lhr.audits['web-fonts-layout']) {
      fontAudits.webFontsLayout = {
        score: lhr.audits['web-fonts-layout'].score,
        description: lhr.audits['web-fonts-layout'].description,
        details: lhr.audits['web-fonts-layout'].details || {},
      };
    }

    return fontAudits;
  }

  extractPerformanceMetrics(lhr) {
    const metrics = {};

    if (lhr.audits.metrics && lhr.audits.metrics.details) {
      const items = lhr.audits.metrics.details.items[0];
      metrics.firstContentfulPaint = items.firstContentfulPaint;
      metrics.largestContentfulPaint = items.largestContentfulPaint;
      metrics.firstInputDelay = items.maxPotentialFID;
      metrics.cumulativeLayoutShift = items.cumulativeLayoutShift;
      metrics.speedIndex = items.speedIndex;
      metrics.totalBlockingTime = items.totalBlockingTime;
    }

    // Core Web Vitals
    metrics.coreWebVitals = {
      lcp: lhr.audits['largest-contentful-paint']?.numericValue || 0,
      fid: lhr.audits['max-potential-fid']?.numericValue || 0,
      cls: lhr.audits['cumulative-layout-shift']?.numericValue || 0,
    };

    return metrics;
  }

  extractAccessibilityIssues(lhr) {
    const issues = [];

    Object.keys(lhr.audits).forEach((auditKey) => {
      const audit = lhr.audits[auditKey];
      if (
        audit.score < 1 &&
        lhr.categories.accessibility.auditRefs.some((ref) => ref.id === auditKey)
      ) {
        issues.push({
          id: auditKey,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          impact: this.getImpactLevel(audit.score),
          details: audit.details || {},
        });
      }
    });

    return {
      score: Math.round(lhr.categories.accessibility.score * 100),
      issues: issues.slice(0, 10), // Top 10 issues
    };
  }

  extractBestPractices(lhr) {
    const issues = [];

    Object.keys(lhr.audits).forEach((auditKey) => {
      const audit = lhr.audits[auditKey];
      if (
        audit.score < 1 &&
        lhr.categories['best-practices'].auditRefs.some((ref) => ref.id === auditKey)
      ) {
        issues.push({
          id: auditKey,
          title: audit.title,
          description: audit.description,
          score: audit.score,
          impact: this.getImpactLevel(audit.score),
        });
      }
    });

    return {
      score: Math.round(lhr.categories['best-practices'].score * 100),
      issues: issues.slice(0, 10),
    };
  }

  extractSEOIssues(lhr) {
    const issues = [];

    Object.keys(lhr.audits).forEach((auditKey) => {
      const audit = lhr.audits[auditKey];
      if (audit.score < 1 && lhr.categories.seo.auditRefs.some((ref) => ref.id === auditKey)) {
        issues.push({
          id: auditKey,
          title: audit.title,
          description: audit.description,
          score: audit.score,
        });
      }
    });

    return {
      score: Math.round(lhr.categories.seo.score * 100),
      issues: issues.slice(0, 10),
    };
  }

  extractOpportunities(lhr) {
    const opportunities = [];

    Object.keys(lhr.audits).forEach((auditKey) => {
      const audit = lhr.audits[auditKey];
      if (audit.details && audit.details.type === 'opportunity' && audit.numericValue > 0) {
        opportunities.push({
          id: auditKey,
          title: audit.title,
          description: audit.description,
          savings: audit.numericValue,
          impact: this.getImpactLevel(audit.score),
        });
      }
    });

    return opportunities.sort((a, b) => b.savings - a.savings).slice(0, 10);
  }

  extractDiagnostics(lhr) {
    const diagnostics = [];

    Object.keys(lhr.audits).forEach((auditKey) => {
      const audit = lhr.audits[auditKey];
      if (audit.details && audit.details.type === 'diagnostic' && audit.score < 1) {
        diagnostics.push({
          id: auditKey,
          title: audit.title,
          description: audit.description,
          score: audit.score,
        });
      }
    });

    return diagnostics.slice(0, 10);
  }

  getImpactLevel(score) {
    if (score >= 0.9) return 'low';
    if (score >= 0.6) return 'medium';
    return 'high';
  }

  async closeLighthouse() {
    if (this.chrome) {
      try {
        await this.chrome.kill();
        logger.info('Chrome instance closed successfully');
      } catch (error) {
        logger.warn('Error closing Chrome instance:', error.message);
        // Try force kill
        try {
          process.kill(this.chrome.pid, 'SIGKILL');
        } catch (killError) {
          logger.warn('Force kill failed:', killError.message);
        }
      } finally {
        this.chrome = null;
      }
    }
  }
}

module.exports = new LighthouseAnalyzer();
