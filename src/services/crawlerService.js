/**
 * Multi-Page Crawler Service
 * Crawls websites with configurable limits and sitemap support
 * Uses Puppeteer for better bot protection bypass
 */

const axios = require('axios');
const { URL } = require('url');
const xml2js = require('xml2js');
const browserPool = require('../utils/browserPool');

class CrawlerService {
  constructor() {
    this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }

  /**
   * Crawl a website starting from the given URL
   * @param {string} startUrl - Starting URL
   * @param {Object} options - Crawl options
   * @returns {Promise<Array<string>>} - Array of discovered URLs
   */
  async crawl(startUrl, options = {}) {
    const {
      maxPages = 10,
      maxDepth = 3,
      includeSitemap = true,
      respectRobotsTxt = true
    } = options;

    try {
      const baseUrl = new URL(startUrl);
      const discovered = new Set();
      const visited = new Set();
      const queue = [{ url: startUrl, depth: 0 }];

      // Try sitemap first if enabled
      if (includeSitemap) {
        const sitemapUrls = await this.parseSitemap(baseUrl.origin);
        sitemapUrls.forEach(url => {
          if (discovered.size < maxPages && this.isSameHostname(url, baseUrl.hostname)) {
            discovered.add(url);
          }
        });

        console.log(`🗺️ Found ${sitemapUrls.length} URLs from sitemap`);
      }

      // Check robots.txt if enabled
      let disallowedPaths = [];
      if (respectRobotsTxt) {
        disallowedPaths = await this.parseRobotsTxt(baseUrl.origin);
        console.log(`🤖 robots.txt: ${disallowedPaths.length} disallowed paths`);
      }

      // BFS crawl using Puppeteer for better bot protection bypass
      while (queue.length > 0 && discovered.size < maxPages) {
        const { url, depth } = queue.shift();

        // Skip if already visited or too deep
        if (visited.has(url) || depth > maxDepth) {
          continue;
        }

        // Skip if disallowed by robots.txt
        if (this.isDisallowed(url, disallowedPaths)) {
          console.log(`🚫 Skipping (robots.txt): ${url}`);
          continue;
        }

        visited.add(url);
        discovered.add(url);

        console.log(`🕷️ Crawling [${discovered.size}/${maxPages}]: ${url}`);

        // Only continue crawling links if we haven't hit max pages
        if (discovered.size < maxPages && depth < maxDepth) {
          try {
            const links = await this.extractLinksWithPuppeteer(url, baseUrl.hostname);

            // Add new links to queue
            for (const link of links) {
              if (!visited.has(link) && !discovered.has(link)) {
                queue.push({ url: link, depth: depth + 1 });
              }
            }
          } catch (error) {
            console.error(`Error crawling ${url}:`, error.message);
            // Try fallback to axios if Puppeteer fails
            try {
              const links = await this.extractLinksWithAxios(url, baseUrl.hostname);
              for (const link of links) {
                if (!visited.has(link) && !discovered.has(link)) {
                  queue.push({ url: link, depth: depth + 1 });
                }
              }
            } catch (fallbackError) {
              console.error(`Fallback also failed for ${url}:`, fallbackError.message);
            }
          }
        }
      }

      console.log(`✅ Crawl complete: ${discovered.size} pages discovered`);
      return Array.from(discovered).slice(0, maxPages);

    } catch (error) {
      console.error('Crawler error:', error);
      // Return at least the start URL if crawling fails
      return [startUrl];
    }
  }

  /**
   * Extract links using Puppeteer (better bot protection bypass)
   */
  async extractLinksWithPuppeteer(url, hostname) {
    const links = new Set();

    try {
      const extractedLinks = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        try {
          await page.setUserAgent(this.userAgent);
          
          // Try networkidle2 first, fallback to domcontentloaded
          try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
          } catch (navError) {
            if (navError.message.includes('timeout') || navError.message.includes('Navigation')) {
              console.log(`⏳ Timeout on networkidle2, falling back to domcontentloaded for ${url}`);
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            } else {
              throw navError;
            }
          }

          // Check if we were redirected to a different URL
          const finalUrl = page.url();
          console.log(`📍 Final URL after navigation: ${finalUrl}`);

          // Extract all links from the page
          const pageLinks = await page.evaluate(() => {
            const anchors = document.querySelectorAll('a[href]');
            return Array.from(anchors).map(a => a.href).filter(href => href && !href.startsWith('javascript:'));
          });

          console.log(`🔗 Raw links extracted: ${pageLinks.length}`);
          return pageLinks;
        } finally {
          await page.close();
        }
      });

      // Filter and normalize links
      for (const href of extractedLinks) {
        try {
          // Skip anchors, javascript, mailto, tel, etc.
          if (href.startsWith('#') ||
              href.startsWith('javascript:') ||
              href.startsWith('mailto:') ||
              href.startsWith('tel:') ||
              href.startsWith('data:')) {
            continue;
          }

          // Only include same-hostname links (handles www vs non-www)
          if (this.isSameHostname(href, hostname)) {
            const normalized = this.normalizeUrl(href);
            links.add(normalized);
          }
        } catch (error) {
          // Invalid URL, skip
          continue;
        }
      }

      console.log(`✅ Filtered links for ${hostname}: ${links.size}`);

    } catch (error) {
      console.error(`Failed to extract links with Puppeteer from ${url}:`, error.message);
      throw error;
    }

    return Array.from(links);
  }

  /**
   * Extract links using axios (fallback method)
   */
  async extractLinksWithAxios(url, hostname) {
    const links = new Set();

    try {
      const response = await axios.get(url, {
        headers: { 
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400
      });

      // Simple regex to extract href attributes
      const hrefRegex = /href=["']([^"']+)["']/gi;
      let match;

      while ((match = hrefRegex.exec(response.data)) !== null) {
        try {
          const href = match[1];

          // Skip anchors, javascript, mailto, tel, etc.
          if (href.startsWith('#') ||
              href.startsWith('javascript:') ||
              href.startsWith('mailto:') ||
              href.startsWith('tel:')) {
            continue;
          }

          // Resolve relative URLs
          const absoluteUrl = new URL(href, url).href;

          // Only include same-hostname links
          if (this.isSameHostname(absoluteUrl, hostname)) {
            const normalized = this.normalizeUrl(absoluteUrl);
            links.add(normalized);
          }

        } catch (error) {
          // Invalid URL, skip
          continue;
        }
      }

    } catch (error) {
      console.error(`Failed to extract links with axios from ${url}:`, error.message);
      throw error;
    }

    return Array.from(links);
  }

  /**
   * Parse sitemap.xml and extract URLs
   */
  async parseSitemap(origin) {
    const sitemapUrls = [];
    const possibleSitemaps = [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
      `${origin}/sitemap.xml.gz`,
      `${origin}/sitemap1.xml`
    ];

    for (const sitemapUrl of possibleSitemaps) {
      try {
        const response = await axios.get(sitemapUrl, {
          headers: { 'User-Agent': this.userAgent },
          timeout: 10000,
          maxRedirects: 5
        });

        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(response.data);

        // Handle sitemap index (contains links to other sitemaps)
        if (result.sitemapindex) {
          for (const sitemap of result.sitemapindex.sitemap || []) {
            const loc = sitemap.loc?.[0];
            if (loc) {
              const childUrls = await this.parseSitemap(loc);
              sitemapUrls.push(...childUrls);
            }
          }
        }

        // Handle regular sitemap (contains actual page URLs)
        if (result.urlset) {
          for (const url of result.urlset.url || []) {
            const loc = url.loc?.[0];
            if (loc) {
              sitemapUrls.push(loc);
            }
          }
        }

        // If we found a working sitemap, stop looking
        if (sitemapUrls.length > 0) {
          break;
        }

      } catch (error) {
        // Silently continue to next sitemap URL
        continue;
      }
    }

    return sitemapUrls;
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

        // Check if this section applies to us
        if (trimmed.toLowerCase().startsWith('user-agent:')) {
          const agent = trimmed.substring(11).trim();
          isRelevantAgent = agent === '*' || agent.toLowerCase().includes('fontscanner');
        }

        // Parse disallow rules
        if (isRelevantAgent && trimmed.toLowerCase().startsWith('disallow:')) {
          const path = trimmed.substring(9).trim();
          if (path) {
            disallowedPaths.push(path);
          }
        }
      }

    } catch (error) {
      // If robots.txt doesn't exist or can't be fetched, assume everything is allowed
      console.log(`No robots.txt found at ${origin}`);
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
        // Simple prefix match (proper implementation would support wildcards)
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
      // Try Puppeteer first (better bot protection bypass)
      return await this.extractLinksWithPuppeteer(url, hostname);
    } catch (error) {
      console.log(`Puppeteer failed, trying axios fallback for ${url}`);
      // Fallback to axios
      try {
        return await this.extractLinksWithAxios(url, hostname);
      } catch (axiosError) {
        console.error(`Both methods failed for ${url}:`, axiosError.message);
        return [];
      }
    }
  }

  /**
   * Check if URL belongs to the same hostname (handles www vs non-www)
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

      // Remove fragment
      urlObj.hash = '';

      // Remove trailing slash (except for root)
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

      // Only allow HTTP and HTTPS
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are allowed');
      }

      // Block private IP ranges (SSRF protection)
      const hostname = urlObj.hostname;

      // IPv4 private ranges
      const privateRanges = [
        /^127\./,           // localhost
        /^10\./,            // 10.0.0.0/8
        /^172\.(1[6-9]|2\d|3[01])\./,  // 172.16.0.0/12
        /^192\.168\./,      // 192.168.0.0/16
        /^169\.254\./,      // link-local
        /^0\./              // reserved
      ];

      for (const range of privateRanges) {
        if (range.test(hostname)) {
          throw new Error('Private IP addresses are not allowed');
        }
      }

      // Block localhost variations
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
