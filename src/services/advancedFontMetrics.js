const axios = require('axios');
const { createLogger } = require('../utils/logger');
const { formatNumber } = require('../utils/formatHelpers');

const logger = createLogger('AdvancedFontMetrics');

/**
 * Advanced Font Metrics Analyzer
 * Provides deep analysis of font characteristics, metrics, and quality
 */
class AdvancedFontMetrics {
  /**
   * Analyze font metrics from CSS and computed styles
   */
  async analyzeFontMetrics(fontData, page) {
    try {
      const metrics = {
        basicMetrics: await this.extractBasicMetrics(fontData, page),
        advancedMetrics: await this.extractAdvancedMetrics(fontData, page),
        opticalMetrics: await this.analyzeOpticalMetrics(fontData, page),
        renderingQuality: await this.analyzeRenderingQuality(fontData, page),
        performanceMetrics: this.analyzePerformanceImpact(fontData),
      };

      return metrics;
    } catch (error) {
      logger.error('Error analyzing font metrics:', error);
      return null;
    }
  }

  /**
   * Extract basic font metrics (size, weight, style)
   */
  async extractBasicMetrics(fontData, page) {
    try {
      const metrics = await page.evaluate((font) => {
        const testElement = document.createElement('div');
        testElement.style.fontFamily = font.family;
        testElement.style.fontSize = '100px';
        testElement.style.position = 'absolute';
        testElement.style.visibility = 'hidden';
        testElement.textContent = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        document.body.appendChild(testElement);

        const computed = window.getComputedStyle(testElement);
        const rect = testElement.getBoundingClientRect();

        const result = {
          computedFontSize: computed.fontSize,
          computedFontWeight: computed.fontWeight,
          computedFontStyle: computed.fontStyle,
          computedLineHeight: computed.lineHeight,
          computedLetterSpacing: computed.letterSpacing,
          actualHeight: rect.height,
          actualWidth: rect.width,
        };

        document.body.removeChild(testElement);
        return result;
      }, fontData);

      return metrics;
    } catch (error) {
      logger.error('Error extracting basic metrics:', error);
      return {};
    }
  }

  /**
   * Extract advanced typographic metrics
   */
  async extractAdvancedMetrics(fontData, page) {
    try {
      const metrics = await page.evaluate((font) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = `100px ${font.family}`;

        // Measure different character sets
        const measurements = {
          uppercase: ctx.measureText('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
          lowercase: ctx.measureText('abcdefghijklmnopqrstuvwxyz'),
          numbers: ctx.measureText('0123456789'),
          xHeight: ctx.measureText('x'),
          capHeight: ctx.measureText('H'),
          ascender: ctx.measureText('h'),
          descender: ctx.measureText('g'),
        };

        // Calculate ratios and proportions
        const xHeightRatio = measurements.xHeight.width / measurements.capHeight.width;
        const aspectRatio = measurements.uppercase.width / measurements.lowercase.width;

        return {
          xHeight: measurements.xHeight.width,
          capHeight: measurements.capHeight.width,
          xHeightRatio: xHeightRatio,
          aspectRatio: aspectRatio,
          uppercaseWidth: measurements.uppercase.width,
          lowercaseWidth: measurements.lowercase.width,
          numberWidth: measurements.numbers.width,
          // Advanced metrics from TextMetrics API
          actualBoundingBoxAscent: measurements.xHeight.actualBoundingBoxAscent,
          actualBoundingBoxDescent: measurements.xHeight.actualBoundingBoxDescent,
          actualBoundingBoxLeft: measurements.xHeight.actualBoundingBoxLeft,
          actualBoundingBoxRight: measurements.xHeight.actualBoundingBoxRight,
          fontBoundingBoxAscent: measurements.xHeight.fontBoundingBoxAscent,
          fontBoundingBoxDescent: measurements.xHeight.fontBoundingBoxDescent,
        };
      }, fontData);

      return metrics;
    } catch (error) {
      logger.error('Error extracting advanced metrics:', error);
      return {};
    }
  }

  /**
   * Analyze optical metrics and readability
   */
  async analyzeOpticalMetrics(fontData, page) {
    try {
      const analysis = await page.evaluate((font) => {
        const testTexts = {
          body: 'The quick brown fox jumps over the lazy dog',
          heading: 'Typography Matters',
          small: 'Fine print details',
          large: 'BOLD STATEMENT',
        };

        const results = {};

        Object.entries(testTexts).forEach(([key, text]) => {
          const testElement = document.createElement('div');
          testElement.style.fontFamily = font.family;
          testElement.style.fontSize = key === 'body' ? '16px' : key === 'small' ? '12px' : key === 'large' ? '48px' : '24px';
          testElement.style.position = 'absolute';
          testElement.style.visibility = 'hidden';
          testElement.textContent = text;
          document.body.appendChild(testElement);

          const computed = window.getComputedStyle(testElement);
          const rect = testElement.getBoundingClientRect();

          results[key] = {
            fontSize: computed.fontSize,
            width: rect.width,
            height: rect.height,
            lineHeight: computed.lineHeight,
            letterSpacing: computed.letterSpacing,
            wordSpacing: computed.wordSpacing,
          };

          document.body.removeChild(testElement);
        });

        return results;
      }, fontData);

      // Calculate readability scores
      const readabilityScore = this.calculateReadabilityScore(analysis);

      return {
        ...analysis,
        readabilityScore,
      };
    } catch (error) {
      logger.error('Error analyzing optical metrics:', error);
      return {};
    }
  }

  /**
   * Analyze rendering quality
   */
  async analyzeRenderingQuality(fontData, page) {
    try {
      const quality = await page.evaluate((font) => {
        const testElement = document.createElement('div');
        testElement.style.fontFamily = font.family;
        testElement.style.fontSize = '16px';
        testElement.textContent = 'Rendering Quality Test AaBbCc123';
        document.body.appendChild(testElement);

        const computed = window.getComputedStyle(testElement);

        const result = {
          fontSmoothing: computed.webkitFontSmoothing || computed.fontSmooth || 'default',
          textRendering: computed.textRendering || 'auto',
          fontKerning: computed.fontKerning || 'auto',
          fontVariantLigatures: computed.fontVariantLigatures || 'normal',
          fontFeatureSettings: computed.fontFeatureSettings || 'normal',
          textSizeAdjust: computed.textSizeAdjust || computed.webkitTextSizeAdjust || '100%',
        };

        document.body.removeChild(testElement);
        return result;
      }, fontData);

      return quality;
    } catch (error) {
      logger.error('Error analyzing rendering quality:', error);
      return {};
    }
  }

  /**
   * Analyze performance impact of font
   */
  analyzePerformanceImpact(fontData) {
    const impact = {
      fileSize: fontData.fileSize || 0,
      loadTime: fontData.loadTime || 0,
      cacheability: fontData.cacheControl || 'unknown',
      compressionUsed: fontData.contentEncoding || 'none',
    };

    // Calculate performance score
    let score = 100;
    if (impact.fileSize > 200000) score -= 20; // > 200KB
    if (impact.fileSize > 100000) score -= 10; // > 100KB
    if (impact.loadTime > 1000) score -= 20; // > 1s
    if (impact.loadTime > 500) score -= 10; // > 500ms
    if (impact.compressionUsed === 'none') score -= 15;
    if (!impact.cacheability.includes('max-age')) score -= 10;

    impact.performanceScore = Math.max(0, score);
    impact.rating = score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor';

    return impact;
  }

  /**
   * Calculate readability score based on metrics
   */
  calculateReadabilityScore(metrics) {
    let score = 100;

    // Check if metrics exist for body text
    if (!metrics.body) return 50;

    const bodyMetrics = metrics.body;
    const fontSize = parseFloat(bodyMetrics.fontSize);
    const lineHeight = parseFloat(bodyMetrics.lineHeight);
    const letterSpacing = parseFloat(bodyMetrics.letterSpacing) || 0;

    // Font size check (optimal: 16-18px)
    if (fontSize < 14) score -= 20;
    else if (fontSize < 16) score -= 10;
    else if (fontSize > 20) score -= 5;

    // Line height check (optimal: 1.4-1.6)
    const lineHeightRatio = lineHeight / fontSize;
    if (lineHeightRatio < 1.2) score -= 15;
    else if (lineHeightRatio < 1.4) score -= 5;
    else if (lineHeightRatio > 2) score -= 10;

    // Letter spacing check
    if (letterSpacing < -0.05) score -= 10; // Too tight
    if (letterSpacing > 0.1) score -= 5; // Too loose

    return {
      score: Math.max(0, score),
      rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
      recommendations: this.generateReadabilityRecommendations(fontSize, lineHeightRatio, letterSpacing),
    };
  }

  /**
   * Generate readability recommendations
   */
  generateReadabilityRecommendations(fontSize, lineHeightRatio, letterSpacing) {
    const recommendations = [];

    if (fontSize < 16) {
      recommendations.push({
        type: 'fontSize',
        severity: 'high',
        message: `Font size ${formatNumber(fontSize, 1)}px is too small. Increase to at least 16px for better readability.`,
        suggestion: 'font-size: 16px;',
      });
    }

    if (lineHeightRatio < 1.4) {
      recommendations.push({
        type: 'lineHeight',
        severity: 'medium',
        message: `Line height ratio ${formatNumber(lineHeightRatio, 2)} is too tight. Increase for better readability.`,
        suggestion: `line-height: ${formatNumber(fontSize * 1.5, 1)}px;`,
      });
    }

    if (letterSpacing < -0.05) {
      recommendations.push({
        type: 'letterSpacing',
        severity: 'medium',
        message: 'Letter spacing is too tight, making text harder to read.',
        suggestion: 'letter-spacing: 0.01em;',
      });
    }

    return recommendations;
  }

  /**
   * Analyze font for variable font capabilities
   */
  async analyzeVariableFontCapabilities(fontData, page) {
    try {
      const variableInfo = await page.evaluate((font) => {
        const testElement = document.createElement('div');
        testElement.style.fontFamily = font.family;
        document.body.appendChild(testElement);

        const computed = window.getComputedStyle(testElement);
        const variationSettings = computed.fontVariationSettings || 'none';

        document.body.removeChild(testElement);

        return {
          isVariable: variationSettings !== 'none',
          variationSettings: variationSettings,
          supportsVariations: CSS.supports && CSS.supports('font-variation-settings', '"wght" 400'),
        };
      }, fontData);

      return variableInfo;
    } catch (error) {
      logger.error('Error analyzing variable font capabilities:', error);
      return { isVariable: false };
    }
  }
}

module.exports = new AdvancedFontMetrics();
