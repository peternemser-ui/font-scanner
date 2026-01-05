/**
 * Scan Worker - Processes scan jobs from the queue
 */

const { getDatabase } = require('../db');
const { v4: uuidv4 } = require('uuid');

class ScanWorker {
  constructor(queue) {
    this.queue = queue;
    this.db = getDatabase();
    this.setupEventHandlers();
  }

  /**
   * Set up queue event handlers
   */
  setupEventHandlers() {
    this.queue.on('job:process', async (job) => {
      try {
        await this.processJob(job);
      } catch (error) {
        console.error(`Worker error for ${job.scanId}:`, error);
        await this.queue.fail(job.scanId, error);
      }
    });
  }

  /**
   * Process a scan job
   */
  async processJob(job) {
    const { scanId, payload } = job;
    const { url, options = {} } = payload;

    console.log(`🔨 Worker processing: ${scanId} - ${url}`);

    try {
      // Update scan status to 'running'
      await this.updateScanStatus(scanId, 'running', 0);

      // Step 1: Crawl pages (if multi-page scan enabled)
      const pagesToScan = await this.crawlPages(scanId, url, options);
      await this.updateScanProgress(scanId, 20);

      // Step 2: Run analyzers on each page
      const analyzers = options.analyzers || ['font', 'seo', 'security', 'accessibility', 'performance', 'tags'];
      const results = {};

      for (const analyzer of analyzers) {
        console.log(`🔍 Running ${analyzer} analyzer for ${scanId}...`);
        results[analyzer] = await this.runAnalyzer(analyzer, pagesToScan, scanId);

        // Update progress
        const progress = 20 + ((analyzers.indexOf(analyzer) + 1) / analyzers.length) * 70;
        await this.updateScanProgress(scanId, Math.floor(progress));
      }

      // Step 3: Aggregate results
      const aggregatedResults = await this.aggregateResults(scanId, results, pagesToScan);
      await this.updateScanProgress(scanId, 95);

      // Step 4: Save results to database
      await this.saveResults(scanId, aggregatedResults);

      // Step 5: Mark scan as complete
      await this.updateScanStatus(scanId, 'done', 100);
      await this.db.run(
        'UPDATE scans SET finished_at = DATETIME("now"), pages_crawled = ? WHERE id = ?',
        [pagesToScan.length, scanId]
      );

      console.log(`✅ Worker completed: ${scanId}`);

      // Notify queue
      await this.queue.complete(scanId, aggregatedResults);

    } catch (error) {
      console.error(`❌ Worker failed for ${scanId}:`, error);

      // Update scan status to failed
      await this.updateScanStatus(scanId, 'failed', 0, error.message);
      await this.db.run(
        'UPDATE scans SET finished_at = DATETIME("now") WHERE id = ?',
        [scanId]
      );

      throw error;
    }
  }

  /**
   * Crawl pages using the crawler service
   */
  async crawlPages(scanId, url, options) {
    const crawlerService = require('../services/crawlerService');

    // Validate URL for SSRF protection
    try {
      crawlerService.validateUrl(url);
    } catch (error) {
      throw new Error(`URL validation failed: ${error.message}`);
    }

    console.log(`🕷️ Starting crawl for ${scanId}: ${url}`);

    // Crawl with configured limits
    const pages = await crawlerService.crawl(url, {
      maxPages: options.maxPages || 10,
      maxDepth: options.maxDepth || 3,
      includeSitemap: options.includeSitemap !== false,
      respectRobotsTxt: true
    });

    // Save crawled pages to database
    for (const pageUrl of pages) {
      try {
        await this.db.run(
          'INSERT INTO crawled_pages (scan_id, url, status_code, crawled_at) VALUES (?, ?, ?, DATETIME("now"))',
          [scanId, pageUrl, 200]
        );
      } catch (error) {
        console.error(`Failed to save crawled page ${pageUrl}:`, error);
      }
    }

    console.log(`✅ Crawled ${pages.length} page(s) for ${scanId}`);
    return pages;
  }

  /**
   * Run specific analyzer
   */
  async runAnalyzer(analyzerType, pages, scanId) {
    // Import analyzer modules (use enhanced versions where available)
    const analyzers = {
      font: require('../services/enhancedFontAnalyzer'),
      seo: require('../services/seoAnalyzer'),
      security: require('../services/securityAnalyzer'),
      accessibility: require('../services/accessibilityAnalyzer'),
      performance: require('../services/performanceSnapshotAnalyzer'),
      tags: require('../services/tagAnalyzer')
    };

    const analyzer = analyzers[analyzerType];
    if (!analyzer) {
      console.warn(`⚠️ Unknown analyzer: ${analyzerType}`);
      return null;
    }

    const results = [];

    for (const pageUrl of pages) {
      try {
        // Call the appropriate analyzer method
        let result;
        switch (analyzerType) {
          case 'font':
            // Enhanced font analyzer
            result = await analyzer.analyzeFont(pageUrl);
            break;
          case 'seo':
            result = await analyzer.analyzeSEO(pageUrl);
            break;
          case 'security':
            result = await analyzer.analyzeSecurity(pageUrl);
            break;
          case 'accessibility':
            result = await analyzer.analyzeAccessibility(pageUrl);
            break;
          case 'performance':
            // Performance snapshot analyzer (lightweight)
            result = await analyzer.analyzePerformance(pageUrl);
            break;
          case 'tags':
            // Tag & analytics analyzer
            result = await analyzer.analyzeTags(pageUrl);
            break;
        }

        results.push({
          page: pageUrl,
          result
        });

        // Save intermediate result
        await this.db.run(
          'INSERT INTO scan_results (scan_id, result_type, result_json, page_url) VALUES (?, ?, ?, ?)',
          [scanId, analyzerType, JSON.stringify(result), pageUrl]
        );

      } catch (error) {
        console.error(`Error analyzing ${pageUrl} with ${analyzerType}:`, error);
        results.push({
          page: pageUrl,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Aggregate results from all pages and analyzers
   */
  async aggregateResults(scanId, results, pages) {
    return {
      scanId,
      summary: {
        totalPages: pages.length,
        analyzersRun: Object.keys(results).length,
        timestamp: new Date().toISOString()
      },
      pages: pages.map(url => ({ url })),
      results
    };
  }

  /**
   * Save aggregated results to database
   */
  async saveResults(scanId, results) {
    await this.db.run(
      'INSERT INTO scan_results (scan_id, result_type, result_json) VALUES (?, ?, ?)',
      [scanId, 'aggregate', JSON.stringify(results)]
    );
  }

  /**
   * Update scan status
   */
  async updateScanStatus(scanId, status, progress, errorMessage = null) {
    await this.db.run(
      `UPDATE scans
       SET status = ?, progress = ?, error_message = ?, updated_at = DATETIME("now")
       WHERE id = ?`,
      [status, progress, errorMessage, scanId]
    );
  }

  /**
   * Update scan progress
   */
  async updateScanProgress(scanId, progress) {
    await this.db.run(
      'UPDATE scans SET progress = ?, updated_at = DATETIME("now") WHERE id = ?',
      [progress, scanId]
    );
  }
}

module.exports = ScanWorker;
