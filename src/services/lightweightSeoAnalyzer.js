/**
 * Lightweight SEO Analyzer - Fallback for bot-protected sites
 * Uses simple HTTP requests instead of Puppeteer
 * Limited analysis but works on sites that block headless browsers
 */

const https = require('https');
const http = require('http');
const { JSDOM } = require('jsdom');
const zlib = require('zlib');
const { createLogger } = require('../utils/logger');

const logger = createLogger('LightweightSEOAnalyzer');

class LightweightSEOAnalyzer {
  constructor() {
    this.timeout = 15000; // 15 seconds
  }

  /**
   * Fetch HTML content using simple HTTP request
   */
  async fetchHTML(url) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;

      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        timeout: this.timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          // Request compressed content but we will transparently decompress
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache'
        }
      };

      const req = client.request(options, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirects
          // Support relative redirects
          const redirectUrl = new URL(res.headers.location, url).toString();
          return this.fetchHTML(redirectUrl).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: Unable to fetch page (likely bot protection)`));
        }

        // Buffer the response body to handle gzip/deflate/brotli
        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          try {
            const buffer = Buffer.concat(chunks);
            const encoding = (res.headers['content-encoding'] || '').toLowerCase();

            let decoded;
            if (encoding.includes('br')) {
              decoded = zlib.brotliDecompressSync(buffer).toString('utf8');
            } else if (encoding.includes('gzip')) {
              decoded = zlib.gunzipSync(buffer).toString('utf8');
            } else if (encoding.includes('deflate')) {
              decoded = zlib.inflateSync(buffer).toString('utf8');
            } else {
              decoded = buffer.toString('utf8');
            }
            resolve(decoded);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Perform lightweight SEO analysis
   */
  async analyzeSEO(url) {
    logger.info('Starting lightweight SEO analysis (fallback mode)', { url });

    try {
      // Fetch HTML
      const html = await this.fetchHTML(url);
      
      // Parse with JSDOM
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Extract meta tags
      const metaTags = this.analyzeMetaTags(document);

      // Extract heading structure
      const headingStructure = this.analyzeHeadingStructure(document);

      // Extract content analysis
      const contentAnalysis = this.analyzeContent(document);

      // Extract image analysis
      const imageAnalysis = this.analyzeImages(document);

      // Extract link analysis
      const linkAnalysis = this.analyzeLinks(document, url);

      // Extract structured data
      const structuredData = this.analyzeStructuredData(document);

      // Calculate score
      const score = this.calculateScore({
        metaTags,
        headingStructure,
        contentAnalysis,
        imageAnalysis,
        linkAnalysis,
        structuredData
      });

      logger.info('Lightweight SEO analysis completed', { url, score });

      return {
        url,
        timestamp: new Date().toISOString(),
        mode: 'lightweight',
        warning: 'Limited analysis - site may block automated tools. Some metrics unavailable.',
        score,
        metaTags,
        headingStructure,
        contentAnalysis,
        imageAnalysis,
        linkAnalysis,
        structuredData,
        limitations: [
          'No Core Web Vitals (requires real browser)',
          'No JavaScript rendering (static HTML only)',
          'No performance metrics',
          'No security headers analysis',
          'Limited accuracy on dynamic sites'
        ]
      };

    } catch (error) {
      logger.error('Lightweight SEO analysis failed', { url, error: error.message });
      throw error;
    }
  }

  /**
   * Analyze meta tags
   */
  analyzeMetaTags(document) {
    const getMetaContent = (selector) => {
      const element = document.querySelector(selector);
      return element ? (element.content || element.textContent || null) : null;
    };

    const title = document.title || null;
    const description = getMetaContent('meta[name="description"]');

    return {
      title: {
        content: title,
        length: title ? title.length : 0,
        optimal: title && title.length >= 30 && title.length <= 60
      },
      description: {
        content: description,
        length: description ? description.length : 0,
        optimal: description && description.length >= 120 && description.length <= 160
      },
      keywords: getMetaContent('meta[name="keywords"]'),
      robots: getMetaContent('meta[name="robots"]'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || null,
      openGraph: {
        title: getMetaContent('meta[property="og:title"]'),
        description: getMetaContent('meta[property="og:description"]'),
        image: getMetaContent('meta[property="og:image"]'),
        url: getMetaContent('meta[property="og:url"]'),
        type: getMetaContent('meta[property="og:type"]')
      },
      twitter: {
        card: getMetaContent('meta[name="twitter:card"]'),
        title: getMetaContent('meta[name="twitter:title"]'),
        description: getMetaContent('meta[name="twitter:description"]'),
        image: getMetaContent('meta[name="twitter:image"]')
      }
    };
  }

  /**
   * Analyze heading structure
   */
  analyzeHeadingStructure(document) {
    const headings = {
      h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim()),
      h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()),
      h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim()),
      h4: Array.from(document.querySelectorAll('h4')).map(h => h.textContent.trim()),
      h5: Array.from(document.querySelectorAll('h5')).map(h => h.textContent.trim()),
      h6: Array.from(document.querySelectorAll('h6')).map(h => h.textContent.trim())
    };

    return {
      ...headings,
      h1Count: headings.h1.length,
      h2Count: headings.h2.length,
      totalHeadings: Object.values(headings).flat().length,
      hasMultipleH1: headings.h1.length > 1,
      hasProperHierarchy: headings.h1.length >= 1
    };
  }

  /**
   * Analyze content
   */
  analyzeContent(document) {
    const bodyText = document.body?.textContent || '';
    const wordCount = bodyText.trim().split(/\s+/).length;
    const paragraphs = document.querySelectorAll('p').length;

    return {
      wordCount,
      paragraphCount: paragraphs,
      hasMinimumContent: wordCount >= 300,
      textToHTMLRatio: bodyText.length / document.documentElement.outerHTML.length
    };
  }

  /**
   * Analyze images
   */
  analyzeImages(document) {
    const images = Array.from(document.querySelectorAll('img'));
    
    const withAlt = images.filter(img => img.alt && img.alt.trim()).length;
    const withoutAlt = images.length - withAlt;

    return {
      totalImages: images.length,
      withAlt,
      withoutAlt,
      altTextCompliance: images.length > 0 ? (withAlt / images.length * 100).toFixed(1) : 100
    };
  }

  /**
   * Analyze links
   */
  analyzeLinks(document, baseUrl) {
    const links = Array.from(document.querySelectorAll('a'));
    
    const internal = links.filter(a => {
      try {
        return a.href && new URL(a.href, baseUrl).hostname === new URL(baseUrl).hostname;
      } catch {
        return false;
      }
    }).length;

    const external = links.filter(a => {
      try {
        return a.href && new URL(a.href, baseUrl).hostname !== new URL(baseUrl).hostname;
      } catch {
        return false;
      }
    }).length;

    const broken = links.filter(a => !a.href || a.href === '#' || a.href === '').length;

    return {
      totalLinks: links.length,
      internal,
      external,
      broken
    };
  }

  /**
   * Analyze structured data
   */
  analyzeStructuredData(document) {
    const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    
    const schemas = scripts.map(script => {
      try {
        return JSON.parse(script.textContent);
      } catch {
        return null;
      }
    }).filter(Boolean);

    return {
      hasStructuredData: schemas.length > 0,
      schemaCount: schemas.length,
      types: schemas.map(s => s['@type']).filter(Boolean)
    };
  }

  /**
   * Calculate SEO score
   */
  calculateScore(data) {
  let score = 0;
  const maxScore = 100;

    // Meta tags (30 points)
    if (data.metaTags.title.optimal) score += 10;
    else if (data.metaTags.title.content) score += 5;

    if (data.metaTags.description.optimal) score += 10;
    else if (data.metaTags.description.content) score += 5;

    if (data.metaTags.canonical) score += 5;
    if (data.metaTags.openGraph.title && data.metaTags.openGraph.description) score += 5;

    // Headings (20 points)
    if (data.headingStructure.h1Count === 1) score += 10;
    else if (data.headingStructure.h1Count > 1) score += 5;

    if (data.headingStructure.hasProperHierarchy) score += 5;
    if (data.headingStructure.h2Count > 0) score += 5;

    // Content (20 points)
    if (data.contentAnalysis.hasMinimumContent) score += 10;
    if (data.contentAnalysis.paragraphCount > 3) score += 5;
    if (data.contentAnalysis.textToHTMLRatio > 0.1) score += 5;

    // Images (15 points)
    const altCompliance = parseFloat(data.imageAnalysis.altTextCompliance);
    if (altCompliance === 100) score += 15;
    else if (altCompliance >= 80) score += 10;
    else if (altCompliance >= 50) score += 5;

    // Links (10 points)
    if (data.linkAnalysis.broken === 0) score += 5;
    if (data.linkAnalysis.internal > 5) score += 5;

    // Structured Data (5 points)
    if (data.structuredData.hasStructuredData) score += 5;

    return {
      overall: Math.round((score / maxScore) * 100),
      breakdown: {
        metaTags: Math.round((Math.min(score, 30) / 30) * 100),
        headings: Math.round((Math.min(score, 20) / 20) * 100),
        content: Math.round((Math.min(score, 20) / 20) * 100),
        images: Math.round((Math.min(score, 15) / 15) * 100),
        links: Math.round((Math.min(score, 10) / 10) * 100),
        structuredData: data.structuredData.hasStructuredData ? 100 : 0
      }
    };
  }
}

module.exports = new LightweightSEOAnalyzer();
