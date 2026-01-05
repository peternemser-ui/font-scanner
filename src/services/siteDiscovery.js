const axios = require('axios');
const cheerio = require('cheerio');
const xml2js = require('xml2js');
const URL = require('url-parse');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SiteDiscovery');

class SiteDiscovery {
  constructor() {
    this.maxPages = 10;
    this.timeout = 10000;
  }

  async discoverPages(baseUrl) {
    logger.info(`Discovering pages for: ${baseUrl}`);

    const discovered = new Set([baseUrl]); // Always include base URL
    const parsedUrl = new URL(baseUrl);
    const baseHost = parsedUrl.hostname;

    try {
      // Method 1: Check sitemap
      const sitemapPages = await this.getSitemapPages(baseUrl);
      sitemapPages.forEach((page) => discovered.add(page));

      // Method 2: Crawl popular pages from homepage
      if (discovered.size < 3) {
        const crawledPages = await this.crawlHomepage(baseUrl);
        crawledPages.forEach((page) => discovered.add(page));
      }

      // Method 3: Check robots.txt for additional sitemaps
      if (discovered.size < 3) {
        const robotsPages = await this.getRobotsPages(baseUrl);
        robotsPages.forEach((page) => discovered.add(page));
      }

      // Method 4: Use common page patterns as fallback
      if (discovered.size === 1) {
        logger.info('All discovery methods failed, using common page patterns');
        const commonPages = this.getCommonPagePatterns(baseUrl);
        commonPages.forEach((page) => discovered.add(page));
      }

      // Filter and prioritize pages
      const pages = Array.from(discovered)
        .filter((url) => {
          try {
            const pageUrl = new URL(url);
            return pageUrl.hostname === baseHost && this.isValidPage(url);
          } catch {
            return false;
          }
        })
        .slice(0, this.maxPages);

      logger.info(`Discovered ${pages.length} pages to analyze`);
      return pages;
    } catch (error) {
      logger.error('Page discovery error:', error);
      return [baseUrl]; // Fallback to just the main page
    }
  }

  getCommonPagePatterns(baseUrl) {
    const patterns = [
      `${baseUrl}/about`,
      `${baseUrl}/contact`,
      `${baseUrl}/services`,
      `${baseUrl}/products`,
      `${baseUrl}/blog`,
    ];
    return patterns;
  }

  async getSitemapPages(baseUrl) {
    const pages = [];
    const sitemapUrls = [
      `${baseUrl}/sitemap.xml`,
      `${baseUrl}/sitemap_index.xml`,
      `${baseUrl}/sitemaps/sitemap.xml`,
    ];

    for (const sitemapUrl of sitemapUrls) {
      try {
        logger.info(`Checking sitemap: ${sitemapUrl}`);
        const response = await axios.get(sitemapUrl, {
          timeout: this.timeout,
          headers: {
            'User-Agent': 'FontScanner/1.0',
          },
        });

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        if (result.urlset && result.urlset.url) {
          const urls = result.urlset.url
            .map((urlObj) => urlObj.loc[0])
            .filter((url) => url && this.isValidPage(url))
            .slice(0, 8);

          pages.push(...urls);
          break; // Use first successful sitemap
        }
      } catch (error) {
        logger.info(`Sitemap ${sitemapUrl} not accessible:`, error.message);
      }
    }

    return pages;
  }

  async crawlHomepage(baseUrl) {
    const pages = [];

    try {
      logger.info(`Crawling homepage: ${baseUrl}`);
      const response = await axios.get(baseUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
      });

      const $ = cheerio.load(response.data);
      const parsedBase = new URL(baseUrl);
      const foundLinks = new Set();

      // Look for navigation links, important pages
      const selectors = [
        'nav a[href]',
        'header a[href]',
        'footer a[href]',
        '.menu a[href]',
        '.navigation a[href]',
        'a[href*="about"]',
        'a[href*="service"]',
        'a[href*="product"]',
        'a[href*="blog"]',
        'a[href*="contact"]',
      ];

      selectors.forEach((selector) => {
        $(selector).each((i, element) => {
          const href = $(element).attr('href');
          if (href) {
            const absoluteUrl = this.resolveUrl(href, baseUrl);
            if (absoluteUrl && this.isValidPage(absoluteUrl)) {
              const pageUrl = new URL(absoluteUrl);
              if (pageUrl.hostname === parsedBase.hostname) {
                foundLinks.add(absoluteUrl);
              }
            }
          }
        });
      });

      // Prioritize important pages
      const priorityKeywords = ['about', 'services', 'products', 'blog', 'news', 'contact'];
      const prioritized = Array.from(foundLinks).sort((a, b) => {
        const aScore = this.getPagePriorityScore(a, priorityKeywords);
        const bScore = this.getPagePriorityScore(b, priorityKeywords);
        return bScore - aScore;
      });

      pages.push(...prioritized.slice(0, 6));
    } catch (error) {
      logger.error('Homepage crawling error:', error.message);
    }

    return pages;
  }

  async getRobotsPages(baseUrl) {
    const pages = [];

    try {
      const robotsUrl = `${baseUrl}/robots.txt`;
      logger.info(`Checking robots.txt: ${robotsUrl}`);

      const response = await axios.get(robotsUrl, {
        timeout: this.timeout,
        headers: {
          'User-Agent': 'FontScanner/1.0',
        },
      });

      const robotsContent = response.data;
      const sitemapMatches = robotsContent.match(/^Sitemap:\s*(.+)$/gim);

      if (sitemapMatches) {
        for (const match of sitemapMatches.slice(0, 2)) {
          const sitemapUrl = match.replace(/^Sitemap:\s*/i, '').trim();
          try {
            const sitemapPages = await this.getSitemapPages(sitemapUrl);
            pages.push(...sitemapPages.slice(0, 3));
          } catch (error) {
            logger.info(`Sitemap from robots.txt failed: ${sitemapUrl}`);
          }
        }
      }
    } catch (error) {
      logger.info('Robots.txt not accessible:', error.message);
    }

    return pages;
  }

  resolveUrl(href, baseUrl) {
    try {
      if (href.startsWith('http')) {
        return href;
      }

      const base = new URL(baseUrl);
      if (href.startsWith('/')) {
        return `${base.protocol}//${base.host}${href}`;
      }

      return `${baseUrl.replace(/\/$/, '')}/${href}`;
    } catch (error) {
      return null;
    }
  }

  isValidPage(url) {
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname.toLowerCase();

      // Skip files, APIs, admin pages
      const skipPatterns = [
        /\.(pdf|jpg|jpeg|png|gif|css|js|ico|xml|txt)$/,
        /\/(api|admin|wp-admin|login|register|logout)\//,
        /\/(download|file|attachment)\//,
        /#/,
        /\?.*download/,
      ];

      return !skipPatterns.some((pattern) => pattern.test(path));
    } catch (error) {
      return false;
    }
  }

  getPagePriorityScore(url, keywords) {
    const path = url.toLowerCase();
    let score = 0;

    keywords.forEach((keyword, index) => {
      if (path.includes(keyword)) {
        score += (keywords.length - index) * 10;
      }
    });

    // Boost homepage
    if (path === '/' || path === '') {
      score += 100;
    }

    // Boost shorter URLs (usually more important)
    const depth = (path.match(/\//g) || []).length;
    score += Math.max(0, 20 - depth * 5);

    return score;
  }
}

module.exports = new SiteDiscovery();
