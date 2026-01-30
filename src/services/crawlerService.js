/**
 * Multi-Page Crawler Service
 * Crawls websites with configurable limits and sitemap support
 * Uses Puppeteer for better bot protection bypass
 *
 * OPTIMIZED: Parallel page processing for 5-10x faster crawling
 */

const axios = require('axios');
const { URL } = require('url');
const xml2js = require('xml2js');
const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

const logger = createLogger('CrawlerService');

class CrawlerService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // Performance tuning
    this.concurrency = 5;           // Process 5 pages at once
    this.pageTimeout = 10000;       // 10 second page load timeout
    this.crawlTimeout = 120000;     // 2 minute overall crawl timeout
    this.sitemapTimeout = 8000;     // 8 second sitemap fetch timeout
  }

  /**
   * Crawl a website starting from the given URL
   * OPTIMIZED: Uses parallel processing for much faster crawling
   * @param {string} startUrl - Starting URL
   * @param {Object} options - Crawl options
   * @returns {Promise<Array<string>>} - Array of discovered URLs
   */
  async crawl(startUrl, options = {}) {
    const {
      maxPages = 10,
      maxDepth = 3,
      includeSitemap = true,
      respectRobotsTxt = true,
      concurrency = this.concurrency
    } = options;

    const crawlStart = Date.now();

    try {
      const baseUrl = new URL(startUrl);
      const discovered = new Set();
      const visited = new Set();
      const queue = [{ url: startUrl, depth: 0 }];

      // Try sitemap first if enabled (fast way to discover pages)
      if (includeSitemap) {
        try {
          const sitemapUrls = await this.parseSitemap(baseUrl.origin);
          logger.info(`Sitemap discovered ${sitemapUrls.length} URLs`);

          for (const url of sitemapUrls) {
            if (discovered.size >= maxPages) break;
            if (this.isSameHostname(url, baseUrl.hostname)) {
              discovered.add(url);
            }
          }

          // If sitemap gave us enough pages, we're done
          if (discovered.size >= maxPages) {
            logger.info(`Sitemap provided ${discovered.size} pages, skipping crawl`);
            return Array.from(discovered).slice(0, maxPages);
          }
        } catch (error) {
          logger.debug('Sitemap parsing failed, falling back to crawling');
        }
      }

      // Check robots.txt if enabled
      let disallowedPaths = [];
      if (respectRobotsTxt) {
        disallowedPaths = await this.parseRobotsTxt(baseUrl.origin);
      }

      // PARALLEL BFS crawl - process multiple pages at once
      while (queue.length > 0 && discovered.size < maxPages) {
        // Check overall timeout
        if (Date.now() - crawlStart > this.crawlTimeout) {
          logger.warn(`Crawl timeout reached after ${(Date.now() - crawlStart) / 1000}s`);
          break;
        }

        // Take a batch of URLs to process in parallel
        const batch = [];
        while (batch.length < concurrency && queue.length > 0) {
          const item = queue.shift();

          // Skip if already visited or too deep
          if (visited.has(item.url) || item.depth > maxDepth) {
            continue;
          }

          // Skip if disallowed by robots.txt
          if (this.isDisallowed(item.url, disallowedPaths)) {
            continue;
          }

          visited.add(item.url);
          discovered.add(item.url);

          // Only add to batch if we need more pages and aren't at max depth
          if (discovered.size < maxPages && item.depth < maxDepth) {
            batch.push(item);
          }
        }

        if (batch.length === 0) continue;

        // Process batch in parallel
        logger.debug(`Processing batch of ${batch.length} pages in parallel`);
        const batchResults = await Promise.allSettled(
          batch.map(item => this.extractLinksWithTimeout(item.url, baseUrl.hostname))
        );

        // Collect all discovered links
        for (let i = 0; i < batchResults.length; i++) {
          const result = batchResults[i];
          const item = batch[i];

          if (result.status === 'fulfilled' && result.value) {
            for (const link of result.value) {
              if (!visited.has(link) && !discovered.has(link)) {
                queue.push({ url: link, depth: item.depth + 1 });
              }
            }
          } else if (result.status === 'rejected') {
            logger.debug(`Failed to crawl ${item.url}: ${result.reason?.message || 'Unknown error'}`);
          }
        }
      }

      const duration = (Date.now() - crawlStart) / 1000;
      logger.info(`Crawl completed: ${discovered.size} pages in ${duration.toFixed(1)}s`);

      return Array.from(discovered).slice(0, maxPages);

    } catch (error) {
      logger.error('Crawler error:', error);
      return [startUrl];
    }
  }

  /**
   * Extract links with timeout wrapper
   */
  async extractLinksWithTimeout(url, hostname) {
    return Promise.race([
      this.extractLinks(url, hostname),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Link extraction timeout')), this.pageTimeout + 5000)
      )
    ]);
  }

  /**
   * Extract links using Puppeteer (better bot protection bypass)
   * OPTIMIZED: Shorter timeouts, faster page loads
   */
  async extractLinksWithPuppeteer(url, hostname) {
    const links = new Set();

    try {
      const extractedLinks = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        try {
          await page.setUserAgent(this.userAgent);

          // Optimize page loading - skip images, fonts, media
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'font', 'media', 'stylesheet'].includes(resourceType)) {
              req.abort();
            } else {
              req.continue();
            }
          });

          // Try faster domcontentloaded first, only use networkidle0 if needed
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.pageTimeout });
          } catch (navError) {
            if (navError.message.includes('timeout') || navError.message.includes('Navigation')) {
              // Already timed out, don't retry
              throw navError;
            }
            throw navError;
          }

          // Extract all links from the page
          const pageLinks = await page.evaluate(() => {
            const anchors = document.querySelectorAll('a[href]');
            return Array.from(anchors).map(a => a.href).filter(href => href && !href.startsWith('javascript:'));
          });
          return pageLinks;
        } finally {
          await page.close();
        }
      });

      // Filter and normalize links
      for (const href of extractedLinks) {
        try {
          if (href.startsWith('#') ||
              href.startsWith('javascript:') ||
              href.startsWith('mailto:') ||
              href.startsWith('tel:') ||
              href.startsWith('data:')) {
            continue;
          }

          if (this.isSameHostname(href, hostname)) {
            const normalized = this.normalizeUrl(href);
            links.add(normalized);
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      logger.debug(`Puppeteer extraction failed for ${url}: ${error.message}`);
      throw error;
    }

    return Array.from(links);
  }

  /**
   * Extract links using axios (fallback method)
   * OPTIMIZED: Shorter timeout
   */
  async extractLinksWithAxios(url, hostname) {
    const links = new Set();

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: this.pageTimeout,
        maxRedirects: 3,
        validateStatus: (status) => status < 400
      });

      // Simple regex to extract href attributes
      const hrefRegex = /href=["']([^"']+)["']/gi;
      let match;

      while ((match = hrefRegex.exec(response.data)) !== null) {
        try {
          const href = match[1];

          if (href.startsWith('#') ||
              href.startsWith('javascript:') ||
              href.startsWith('mailto:') ||
              href.startsWith('tel:')) {
            continue;
          }

          const absoluteUrl = new URL(href, url).href;

          if (this.isSameHostname(absoluteUrl, hostname)) {
            const normalized = this.normalizeUrl(absoluteUrl);
            links.add(normalized);
          }

        } catch (error) {
          continue;
        }
      }

    } catch (error) {
      logger.debug(`Axios extraction failed for ${url}: ${error.message}`);
      throw error;
    }

    return Array.from(links);
  }

  /**
   * Parse sitemap.xml and extract URLs
   * OPTIMIZED: Parallel child sitemap fetching, shorter timeouts
   */
  async parseSitemap(origin) {
    const sitemapUrls = [];
    const possibleSitemaps = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap1.xml`
    ];

    for (const sitemapUrl of possibleSitemaps) {
      try {
        const response = await axios.get(sitemapUrl, {
          headers: { 'User-Agent': this.userAgent },
          timeout: this.sitemapTimeout,
          maxRedirects: 3
        });

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        // Handle sitemap index - fetch child sitemaps IN PARALLEL
        if (result.sitemapindex) {
          const childSitemaps = result.sitemapindex.sitemap || [];
          const childUrls = childSitemaps.map(s => s.loc?.[0]).filter(Boolean);

          // Fetch all child sitemaps in parallel (limit to 5 concurrent)
          const chunks = [];
          for (let i = 0; i < childUrls.length; i += 5) {
            chunks.push(childUrls.slice(i, i + 5));
          }

          for (const chunk of chunks) {
            const results = await Promise.allSettled(
              chunk.map(url => this.fetchSitemapUrls(url))
            );

            for (const result of results) {
              if (result.status === 'fulfilled') {
                sitemapUrls.push(...result.value);
              }
            }

            // Stop if we have enough URLs
            if (sitemapUrls.length > 100) break;
          }
        }

        // Handle regular sitemap
        if (result.urlset) {
          for (const url of result.urlset.url || []) {
            const loc = url.loc?.[0];
            if (loc) {
              sitemapUrls.push(loc);
            }
          }
        }

        if (sitemapUrls.length > 0) {
          break;
        }

      } catch (error) {
        continue;
      }
    }

    return sitemapUrls;
  }

  /**
   * Fetch URLs from a single sitemap file
   */
  async fetchSitemapUrls(sitemapUrl) {
    const urls = [];

    try {
      const response = await axios.get(sitemapUrl, {
        headers: { 'User-Agent': this.userAgent },
        timeout: this.sitemapTimeout,
        maxRedirects: 3
      });

      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(response.data);

      if (result.urlset) {
        for (const url of result.urlset.url || []) {
          const loc = url.loc?.[0];
          if (loc) {
            urls.push(loc);
          }
        }
      }
    } catch (error) {
      // Silently fail for individual sitemaps
    }

    return urls;
  }

  /**
   * Parse robots.txt and extract disallowed paths
   */
  async parseRobotsTxt(origin) {
    const disallowedPaths = [];

    try {
      const response = await axios.get(`${origin}/robots.txt`, {
        headers: { 'User-Agent': this.userAgent },
        timeout: 5000
      });

      const lines = response.data.split('\n');
      let isRelevantAgent = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.toLowerCase().startsWith('user-agent:')) {
          const agent = trimmed.substring(11).trim();
          isRelevantAgent = agent === '*' || agent.toLowerCase().includes('fontscanner');
        }

        if (isRelevantAgent && trimmed.toLowerCase().startsWith('disallow:')) {
          const path = trimmed.substring(9).trim();
          if (path) {
            disallowedPaths.push(path);
          }
        }
      }

    } catch (error) {
      // If robots.txt doesn't exist, assume everything is allowed
    }

    return disallowedPaths;
  }

  /**
   * Check if a URL is disallowed by robots.txt
   */
  isDisallowed(url, disallowedPaths) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      for (const disallowedPath of disallowedPaths) {
        if (pathname.startsWith(disallowedPath)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract links from a page (uses Puppeteer with axios fallback)
   */
  async extractLinks(url, hostname) {
    try {
      return await this.extractLinksWithPuppeteer(url, hostname);
    } catch (error) {
      try {
        return await this.extractLinksWithAxios(url, hostname);
      } catch (axiosError) {
        logger.debug(`Both methods failed for ${url}`);
        return [];
      }
    }
  }

  /**
   * Check if URL belongs to the same hostname
   */
  isSameHostname(url, hostname) {
    try {
      const urlObj = new URL(url);
      const urlHost = urlObj.hostname.replace(/^www\./, '');
      const targetHost = hostname.replace(/^www\./, '');
      return urlHost === targetHost;
    } catch (error) {
      return false;
    }
  }

  /**
   * Normalize URL (remove fragments, trailing slashes, etc.)
   */
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      urlObj.hash = '';

      if (urlObj.pathname !== '/' && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }

      return urlObj.href;
    } catch (error) {
      return url;
    }
  }

  /**
   * Validate URL and check for SSRF vulnerabilities
   */
  validateUrl(url) {
    try {
      const urlObj = new URL(url);

      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
      }

      const hostname = urlObj.hostname;

      const privateRanges = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2\d|3[01])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\./
      ];

      for (const range of privateRanges) {
        if (range.test(hostname)) {
          throw new Error('Private IP addresses are not allowed');
        }
      }

      if (hostname === 'localhost' ||
          hostname.endsWith('.local') ||
          hostname.endsWith('.localhost')) {
        throw new Error('Localhost addresses are not allowed');
      }

      return true;
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
  }
}

module.exports = new CrawlerService();
