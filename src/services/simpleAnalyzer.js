const axios = require('axios');
const cheerio = require('cheerio');
const { createLogger } = require('../utils/logger');

const logger = createLogger('SimpleAnalyzer');

class SimpleAnalyzer {
  async analyzeUrl(url) {
    logger.info(`Simple analyzer: fetching ${url}`);

    const startTime = Date.now();

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      const loadTime = Date.now() - startTime;
      const $ = cheerio.load(response.data);

      const analysis = {
        fonts: this.analyzeFonts($),
        performance: { initialLoadTime: loadTime },
        bestPractices: this.analyzeBestPractices($),
        loadTime,
      };

      logger.info(`Simple analysis completed in ${loadTime}ms`);
      return analysis;
    } catch (error) {
      logger.error('Simple analyzer error:', error.message);
      throw new Error(`Could not fetch website: ${error.message}`);
    }
  }

  analyzeFonts($) {
    const fonts = new Set();
    const fontSources = new Set();
    const googleFonts = new Set();
    const webFonts = new Set();
    const systemFonts = new Set();

    // Check for Google Fonts links
    $('link[href*="fonts.googleapis.com"], link[href*="fonts.gstatic.com"]').each((i, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        fontSources.add(href);

        // Extract font family names from Google Fonts URLs
        const familyMatch = href.match(/family=([^&:]+)/);
        if (familyMatch) {
          const families = familyMatch[1].split('|');
          families.forEach((family) => {
            const cleanFamily = family.replace(/\+/g, ' ').split(':')[0];
            googleFonts.add(cleanFamily);
            fonts.add(cleanFamily);
          });
        }
      }
    });

    // Check for @font-face rules in style elements
    $('style').each((i, elem) => {
      const styleContent = $(elem).html();
      if (styleContent) {
        const fontFaceMatches = styleContent.match(/@font-face\s*{[^}]+}/g);
        if (fontFaceMatches) {
          fontFaceMatches.forEach((match) => {
            const familyMatch = match.match(/font-family:\s*['"]?([^'";]+)['"]?/);
            if (familyMatch) {
              const fontFamily = familyMatch[1].trim();
              fonts.add(fontFamily);
              webFonts.add(fontFamily);
            }
          });
        }
      }
    });

    // Check for common system fonts in CSS
    const commonSystemFonts = [
      'Arial',
      'Helvetica',
      'Times New Roman',
      'Times',
      'Courier New',
      'Courier',
      'Verdana',
      'Georgia',
      'Palatino',
      'Garamond',
      'Trebuchet MS',
      'Impact',
      'sans-serif',
      'serif',
      'monospace',
    ];

    $('*').each((i, elem) => {
      const style = $(elem).attr('style');
      if (style && style.includes('font-family')) {
        const fontMatch = style.match(/font-family:\s*([^;]+)/);
        if (fontMatch) {
          const fontFamily = fontMatch[1].replace(/['"]/g, '').trim();
          fonts.add(fontFamily);

          commonSystemFonts.forEach((sysFont) => {
            if (fontFamily.toLowerCase().includes(sysFont.toLowerCase())) {
              systemFonts.add(sysFont);
            }
          });
        }
      }
    });

    return {
      totalFonts: fonts.size,
      fonts: Array.from(fonts),
      fontSources: Array.from(fontSources),
      categorizedFonts: {
        system: Array.from(systemFonts),
        webFonts: Array.from(webFonts),
        googleFonts: Array.from(googleFonts),
        customFonts: [],
      },
      fontFaces: Array.from(fonts).map((font) => ({
        fontFamily: font,
        fontWeight: 'normal',
        fontStyle: 'normal',
        fontDisplay: 'auto',
        src: '',
      })),
    };
  }

  analyzeBestPractices($) {
    let score = 50; // Base score
    const recommendations = [];

    // Check for Google Fonts preconnect
    const hasPreconnect = $('link[rel="preconnect"][href*="fonts.g"]').length > 0;
    if (hasPreconnect) {
      score += 20;
    } else {
      recommendations.push({
        type: 'suggestion',
        message:
          'Add <link rel="preconnect" href="https://fonts.googleapis.com"> to improve Google Fonts loading',
        priority: 'medium',
      });
    }

    // Check for font preloading
    const hasFontPreload = $('link[rel="preload"][as="font"]').length > 0;
    if (hasFontPreload) {
      score += 15;
    } else {
      recommendations.push({
        type: 'suggestion',
        message: 'Consider preloading critical fonts with <link rel="preload" as="font">',
        priority: 'low',
      });
    }

    // Check for inline styles (potential optimization opportunity)
    const hasInlineStyles = $('[style*="font"]').length;
    if (hasInlineStyles > 10) {
      score -= 10;
      recommendations.push({
        type: 'warning',
        message: 'Consider moving inline font styles to CSS files for better performance',
        priority: 'medium',
      });
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      recommendations,
      categories: {
        fontDisplay: { score, percentage: score },
        fontLoading: { score, percentage: score },
        accessibility: { score, percentage: score },
      },
    };
  }
}

module.exports = new SimpleAnalyzer();
