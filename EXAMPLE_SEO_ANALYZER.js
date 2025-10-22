// Example: SEO Analyzer Service
// This demonstrates how to add a new analysis module to the platform

const { createLogger } = require('../../utils/logger');
const cheerio = require('cheerio');

const logger = createLogger('SEOAnalyzer');

class SEOAnalyzer {
  constructor() {
    this.weights = {
      metaTags: 0.25,
      structuredData: 0.20,
      technical: 0.30,
      content: 0.25
    };
  }

  /**
   * Main analysis function - follows same pattern as fontScannerService
   */
  async analyze(url, page) {
    logger.info(`Starting SEO analysis for: ${url}`);
    const startTime = Date.now();

    try {
      // Get page content
      const html = await page.content();
      const $ = cheerio.load(html);

      // Run all analyzers in parallel (like font scanner does)
      const [metaTags, structuredData, technical, content] = await Promise.all([
        this.analyzeMetaTags($, page, url),
        this.analyzeStructuredData($),
        this.analyzeTechnicalSEO(url, page),
        this.analyzeContentSEO($, page)
      ]);

      const results = {
        url,
        scannedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        metaTags,
        structuredData,
        technical,
        content
      };

      // Calculate overall score
      results.score = this.calculateScore(results);

      logger.info(`SEO analysis completed in ${results.processingTime}ms`);
      return results;

    } catch (error) {
      logger.error('SEO analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze meta tags (title, description, OG tags, etc.)
   */
  async analyzeMetaTags($, page, url) {
    const title = $('title').text() || '';
    const description = $('meta[name="description"]').attr('content') || '';
    const canonical = $('link[rel="canonical"]').attr('href') || '';
    const robots = $('meta[name="robots"]').attr('content') || '';

    // Open Graph tags
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogDescription = $('meta[property="og:description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';
    const ogType = $('meta[property="og:type"]').attr('content') || '';

    // Twitter Card tags
    const twitterCard = $('meta[name="twitter:card"]').attr('content') || '';
    const twitterSite = $('meta[name="twitter:site"]').attr('content') || '';

    const issues = [];
    const recommendations = [];

    // Validate title
    if (!title) {
      issues.push({ type: 'error', field: 'title', message: 'Missing page title' });
    } else if (title.length < 30) {
      issues.push({ type: 'warning', field: 'title', message: 'Title too short (< 30 chars)' });
      recommendations.push('Expand title to 50-60 characters for better SEO');
    } else if (title.length > 60) {
      issues.push({ type: 'warning', field: 'title', message: 'Title too long (> 60 chars), may be truncated' });
      recommendations.push('Shorten title to 50-60 characters');
    }

    // Validate description
    if (!description) {
      issues.push({ type: 'error', field: 'description', message: 'Missing meta description' });
      recommendations.push('Add meta description (150-160 characters)');
    } else if (description.length < 120) {
      issues.push({ type: 'warning', field: 'description', message: 'Description too short (< 120 chars)' });
    } else if (description.length > 160) {
      issues.push({ type: 'warning', field: 'description', message: 'Description too long (> 160 chars)' });
    }

    // Check canonical
    if (!canonical) {
      recommendations.push('Add canonical URL to avoid duplicate content issues');
    }

    // Check Open Graph
    if (!ogTitle || !ogDescription || !ogImage) {
      recommendations.push('Add Open Graph tags for better social media sharing');
    }

    return {
      title: {
        value: title,
        length: title.length,
        optimal: title.length >= 30 && title.length <= 60
      },
      description: {
        value: description,
        length: description.length,
        optimal: description.length >= 120 && description.length <= 160
      },
      canonical: {
        value: canonical,
        present: !!canonical
      },
      robots: {
        value: robots,
        present: !!robots
      },
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        image: ogImage,
        type: ogType,
        complete: !!(ogTitle && ogDescription && ogImage)
      },
      twitter: {
        card: twitterCard,
        site: twitterSite,
        configured: !!(twitterCard && twitterSite)
      },
      issues,
      recommendations,
      score: this.calculateMetaTagsScore(issues)
    };
  }

  /**
   * Analyze structured data (Schema.org, JSON-LD)
   */
  analyzeStructuredData($) {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const structuredData = [];
    const issues = [];

    jsonLdScripts.each((i, script) => {
      try {
        const data = JSON.parse($(script).html());
        structuredData.push({
          type: data['@type'] || 'Unknown',
          valid: true,
          data
        });
      } catch (error) {
        issues.push({
          type: 'error',
          message: 'Invalid JSON-LD syntax',
          index: i
        });
      }
    });

    return {
      present: structuredData.length > 0,
      count: structuredData.length,
      types: structuredData.map(d => d.type),
      data: structuredData,
      issues,
      score: structuredData.length > 0 ? 100 : 50
    };
  }

  /**
   * Analyze technical SEO (URLs, redirects, sitemap, robots.txt)
   */
  async analyzeTechnicalSEO(url, page) {
    const parsedUrl = new URL(url);
    const issues = [];
    const recommendations = [];

    // Check HTTPS
    const isHttps = parsedUrl.protocol === 'https:';
    if (!isHttps) {
      issues.push({
        type: 'critical',
        message: 'Site not using HTTPS',
        impact: 'Security risk and SEO penalty'
      });
      recommendations.push('Enable HTTPS with SSL certificate');
    }

    // Check URL structure
    const hasParameters = parsedUrl.search.length > 0;
    const hasFragments = parsedUrl.hash.length > 0;
    const pathLength = parsedUrl.pathname.length;

    if (pathLength > 100) {
      issues.push({
        type: 'warning',
        message: 'URL too long (> 100 chars)',
        impact: 'May be truncated in search results'
      });
    }

    // Check for www vs non-www consistency
    const hasWww = parsedUrl.hostname.startsWith('www.');

    // Check response headers
    const responseHeaders = page._response ? page._response.headers() : {};
    const hasHSTS = !!responseHeaders['strict-transport-security'];

    return {
      protocol: {
        https: isHttps,
        hsts: hasHSTS,
        secure: isHttps && hasHSTS
      },
      url: {
        structure: parsedUrl.pathname,
        length: pathLength,
        hasParameters,
        hasFragments,
        optimal: pathLength <= 100 && !hasFragments
      },
      domain: {
        hostname: parsedUrl.hostname,
        hasWww,
        length: parsedUrl.hostname.length
      },
      issues,
      recommendations,
      score: this.calculateTechnicalScore(isHttps, pathLength, issues)
    };
  }

  /**
   * Analyze content SEO (headings, keywords, images, links)
   */
  async analyzeContentSEO($, page) {
    const issues = [];
    const recommendations = [];

    // Analyze headings
    const h1Tags = $('h1');
    const h1Count = h1Tags.length;
    const h1Text = h1Tags.first().text() || '';

    if (h1Count === 0) {
      issues.push({ type: 'error', message: 'Missing H1 tag' });
    } else if (h1Count > 1) {
      issues.push({ type: 'warning', message: `Multiple H1 tags found (${h1Count})` });
      recommendations.push('Use only one H1 tag per page');
    }

    const headingStructure = {
      h1: $('h1').length,
      h2: $('h2').length,
      h3: $('h3').length,
      h4: $('h4').length,
      h5: $('h5').length,
      h6: $('h6').length
    };

    // Analyze images
    const images = $('img');
    const imagesWithoutAlt = images.filter((i, img) => !$(img).attr('alt')).length;
    const totalImages = images.length;

    if (imagesWithoutAlt > 0) {
      issues.push({
        type: 'warning',
        message: `${imagesWithoutAlt} of ${totalImages} images missing alt text`,
        impact: 'Hurts accessibility and image SEO'
      });
      recommendations.push('Add descriptive alt text to all images');
    }

    // Analyze links
    const internalLinks = $('a[href^="/"], a[href^="' + $('base').attr('href') + '"]').length;
    const externalLinks = $('a[href^="http"]').not('[href^="' + $('base').attr('href') + '"]').length;
    const brokenLinks = []; // Would need actual link checking

    // Analyze content
    const bodyText = $('body').text().trim();
    const wordCount = bodyText.split(/\s+/).length;

    if (wordCount < 300) {
      issues.push({
        type: 'warning',
        message: `Low word count (${wordCount})`,
        impact: 'May be considered thin content'
      });
      recommendations.push('Add more content (aim for 500+ words)');
    }

    return {
      headings: {
        h1: { count: h1Count, text: h1Text, optimal: h1Count === 1 },
        structure: headingStructure,
        total: Object.values(headingStructure).reduce((a, b) => a + b, 0)
      },
      images: {
        total: totalImages,
        withAlt: totalImages - imagesWithoutAlt,
        withoutAlt: imagesWithoutAlt,
        altCoverage: totalImages > 0 ? ((totalImages - imagesWithoutAlt) / totalImages * 100).toFixed(1) : 0
      },
      links: {
        internal: internalLinks,
        external: externalLinks,
        broken: brokenLinks.length,
        total: internalLinks + externalLinks
      },
      content: {
        wordCount,
        adequate: wordCount >= 300
      },
      issues,
      recommendations,
      score: this.calculateContentScore(h1Count, wordCount, imagesWithoutAlt, totalImages)
    };
  }

  /**
   * Calculate overall SEO score (weighted average)
   */
  calculateScore(results) {
    const scores = {
      metaTags: results.metaTags.score || 0,
      structuredData: results.structuredData.score || 0,
      technical: results.technical.score || 0,
      content: results.content.score || 0
    };

    const overall = Math.round(
      scores.metaTags * this.weights.metaTags +
      scores.structuredData * this.weights.structuredData +
      scores.technical * this.weights.technical +
      scores.content * this.weights.content
    );

    return {
      overall,
      breakdown: scores,
      rating: this.getScoreRating(overall)
    };
  }

  calculateMetaTagsScore(issues) {
    let score = 100;
    issues.forEach(issue => {
      if (issue.type === 'error') score -= 20;
      if (issue.type === 'warning') score -= 10;
    });
    return Math.max(0, score);
  }

  calculateTechnicalScore(isHttps, pathLength, issues) {
    let score = 100;
    if (!isHttps) score -= 30;
    if (pathLength > 100) score -= 10;
    issues.forEach(issue => {
      if (issue.type === 'critical') score -= 30;
      if (issue.type === 'warning') score -= 10;
    });
    return Math.max(0, score);
  }

  calculateContentScore(h1Count, wordCount, imagesWithoutAlt, totalImages) {
    let score = 100;
    if (h1Count === 0) score -= 30;
    if (h1Count > 1) score -= 15;
    if (wordCount < 300) score -= 20;
    if (totalImages > 0) {
      const altCoverage = (totalImages - imagesWithoutAlt) / totalImages;
      score -= (1 - altCoverage) * 20;
    }
    return Math.max(0, Math.round(score));
  }

  getScoreRating(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }
}

module.exports = new SEOAnalyzer();
