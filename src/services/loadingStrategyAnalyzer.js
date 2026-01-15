const { createLogger } = require('../utils/logger');
const { formatNumber } = require('../utils/formatHelpers');

const logger = createLogger('LoadingStrategyAnalyzer');

/**
 * Font Loading Strategy Analyzer
 * Analyzes and recommends optimal font loading strategies
 */
class LoadingStrategyAnalyzer {
  /**
   * Analyze font loading strategies
   */
  async analyzeLoadingStrategy(fonts, page) {
    try {
      const analysis = {
        currentStrategy: await this.detectCurrentStrategy(fonts, page),
        loadingPerformance: await this.analyzeLoadingPerformance(fonts, page),
        foitFoutAnalysis: await this.analyzeFOITFOUT(fonts, page),
        resourceHints: await this.analyzeResourceHints(page),
        recommendations: [],
        optimizationScore: 0,
      };

      // Generate recommendations
      analysis.recommendations = this.generateRecommendations(analysis);
      analysis.optimizationScore = this.calculateOptimizationScore(analysis);
      analysis.rating = this.getRating(analysis.optimizationScore);

      return analysis;
    } catch (error) {
      logger.error('Error analyzing loading strategy:', error);
      return null;
    }
  }

  /**
   * Detect current loading strategy
   */
  async detectCurrentStrategy(fonts, page) {
    try {
      const strategy = await page.evaluate(() => {
        const strategies = {
          preload: [],
          prefetch: [],
          preconnect: [],
          fontDisplay: {},
          inlineCSS: false,
          externalCSS: [],
        };

        // Check for resource hints
        const links = Array.from(document.querySelectorAll('link'));
        links.forEach(link => {
          if (link.rel === 'preload' && link.as === 'font') {
            strategies.preload.push({
              href: link.href,
              crossorigin: link.crossOrigin,
              type: link.type,
            });
          } else if (link.rel === 'prefetch' && link.href.match(/\.(woff2?|ttf|otf|eot)$/)) {
            strategies.prefetch.push(link.href);
          } else if (link.rel === 'preconnect') {
            strategies.preconnect.push(link.href);
          } else if (link.rel === 'stylesheet') {
            strategies.externalCSS.push({
              href: link.href,
              media: link.media,
              loaded: link.sheet !== null,
            });
          }
        });

        // Check for inline CSS
        const styles = Array.from(document.querySelectorAll('style'));
        strategies.inlineCSS = styles.length > 0;

        // Check font-display property
        try {
          const sheets = Array.from(document.styleSheets);
          sheets.forEach(sheet => {
            try {
              const rules = Array.from(sheet.cssRules || sheet.rules || []);
              rules.forEach(rule => {
                if (rule.style && rule.style.fontDisplay) {
                  const fontFamily = rule.style.fontFamily || 'unknown';
                  strategies.fontDisplay[fontFamily] = rule.style.fontDisplay;
                }
              });
            } catch (e) {
              // CORS or other access errors
            }
          });
        } catch (e) {
          // Stylesheet access error
        }

        return strategies;
      });

      return {
        ...strategy,
        hasPreload: strategy.preload.length > 0,
        hasPreconnect: strategy.preconnect.length > 0,
        hasFontDisplay: Object.keys(strategy.fontDisplay).length > 0,
        externalCSSCount: strategy.externalCSS.length,
      };
    } catch (error) {
      logger.error('Error detecting current strategy:', error);
      return {};
    }
  }

  /**
   * Analyze loading performance
   */
  async analyzeLoadingPerformance(fonts, page) {
    try {
      const performance = await page.evaluate(() => {
        const perfEntries = performance.getEntriesByType('resource');
        const fontEntries = perfEntries.filter(entry =>
          entry.name.match(/\.(woff2?|ttf|otf|eot)$/) ||
          entry.initiatorType === 'css' && entry.name.includes('font')
        );

        return fontEntries.map(entry => ({
          name: entry.name,
          duration: entry.duration,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize,
          startTime: entry.startTime,
          responseEnd: entry.responseEnd,
          cached: entry.transferSize === 0 && entry.decodedBodySize > 0,
        }));
      });

      // Calculate metrics
      const totalLoadTime = performance.reduce((max, entry) => Math.max(max, entry.responseEnd), 0);
      const totalSize = performance.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
      const avgLoadTime = performance.length > 0
        ? performance.reduce((sum, entry) => sum + entry.duration, 0) / performance.length
        : 0;
      const cachedCount = performance.filter(entry => entry.cached).length;

      return {
        fonts: performance,
        totalFonts: performance.length,
        totalLoadTime: formatNumber(totalLoadTime, 2),
        totalSize: totalSize,
        totalSizeKB: formatNumber(totalSize / 1024, 2),
        avgLoadTime: formatNumber(avgLoadTime, 2),
        cachedFonts: cachedCount,
        cacheRate: performance.length > 0 ? formatNumber((cachedCount / performance.length) * 100, 1) : 0,
      };
    } catch (error) {
      logger.error('Error analyzing loading performance:', error);
      return {};
    }
  }

  /**
   * Analyze FOIT/FOUT (Flash of Invisible/Unstyled Text)
   */
  async analyzeFOITFOUT(fonts, page) {
    try {
      const analysis = await page.evaluate(() => {
        const result = {
          hasFOIT: false,
          hasFOUT: false,
          fontDisplaySettings: {},
          riskLevel: 'low',
        };

        // Check for font-display settings
        try {
          const sheets = Array.from(document.styleSheets);
          sheets.forEach(sheet => {
            try {
              const rules = Array.from(sheet.cssRules || sheet.rules || []);
              rules.forEach(rule => {
                if (rule instanceof CSSFontFaceRule) {
                  const fontFamily = rule.style.getPropertyValue('font-family').replace(/['"]/g, '');
                  const fontDisplay = rule.style.getPropertyValue('font-display') || 'auto';
                  result.fontDisplaySettings[fontFamily] = fontDisplay;

                  // Determine FOIT/FOUT risk
                  if (fontDisplay === 'block') {
                    result.hasFOIT = true;
                  } else if (fontDisplay === 'swap') {
                    result.hasFOUT = true;
                  } else if (fontDisplay === 'auto' || fontDisplay === '') {
                    result.hasFOIT = true; // Default browser behavior (usually block for 3s)
                  }
                }
              });
            } catch (e) {
              // CORS error
            }
          });
        } catch (e) {
          // Stylesheet access error
        }

        // Determine overall risk
        const displayValues = Object.values(result.fontDisplaySettings);
        const hasBlock = displayValues.includes('block');
        const hasAuto = displayValues.includes('auto') || displayValues.length === 0;
        const hasSwap = displayValues.includes('swap');
        const hasFallback = displayValues.includes('fallback');
        const hasOptional = displayValues.includes('optional');

        if (hasBlock || hasAuto) {
          result.riskLevel = 'high';
          result.risk = 'High risk of FOIT (Flash of Invisible Text)';
        } else if (hasSwap) {
          result.riskLevel = 'medium';
          result.risk = 'Medium risk of FOUT (Flash of Unstyled Text)';
        } else if (hasFallback || hasOptional) {
          result.riskLevel = 'low';
          result.risk = 'Low risk - good font-display strategy';
        }

        return result;
      });

      return analysis;
    } catch (error) {
      logger.error('Error analyzing FOIT/FOUT:', error);
      return { riskLevel: 'unknown' };
    }
  }

  /**
   * Analyze resource hints (preload, prefetch, preconnect)
   */
  async analyzeResourceHints(page) {
    try {
      const hints = await page.evaluate(() => {
        const result = {
          preload: [],
          prefetch: [],
          preconnect: [],
          dnsPrefetch: [],
        };

        const links = Array.from(document.querySelectorAll('link'));
        links.forEach(link => {
          const info = {
            href: link.href,
            crossorigin: link.crossOrigin,
            type: link.type,
            as: link.as,
          };

          if (link.rel === 'preload') {
            result.preload.push(info);
          } else if (link.rel === 'prefetch') {
            result.prefetch.push(info);
          } else if (link.rel === 'preconnect') {
            result.preconnect.push(info);
          } else if (link.rel === 'dns-prefetch') {
            result.dnsPrefetch.push(info);
          }
        });

        return result;
      });

      // Analyze effectiveness
      const fontPreloads = hints.preload.filter(p => p.as === 'font');
      const hasGoogleFontsPreconnect = hints.preconnect.some(p =>
        p.href.includes('fonts.googleapis.com') || p.href.includes('fonts.gstatic.com')
      );

      return {
        ...hints,
        fontPreloads: fontPreloads.length,
        hasGoogleFontsPreconnect,
        effectiveness: this.assessHintEffectiveness(hints, fontPreloads.length),
      };
    } catch (error) {
      logger.error('Error analyzing resource hints:', error);
      return {};
    }
  }

  /**
   * Assess effectiveness of resource hints
   */
  assessHintEffectiveness(hints, fontPreloadCount) {
    let score = 0;
    const issues = [];

    if (fontPreloadCount > 0) {
      score += 30;
      if (fontPreloadCount > 2) {
        issues.push('Preloading too many fonts (> 2) can hurt performance');
        score -= 10;
      }
    } else {
      issues.push('No fonts preloaded - consider preloading critical fonts');
    }

    if (hints.preconnect.length > 0) {
      score += 20;
    }

    // Check for crossorigin attribute on preloads
    const preloadsWithCrossorigin = hints.preload.filter(p => p.crossorigin).length;
    if (preloadsWithCrossorigin < hints.preload.length) {
      issues.push('Preload links missing crossorigin attribute');
      score -= 15;
    }

    return {
      score: Math.min(100, score),
      rating: score >= 70 ? 'good' : score >= 40 ? 'fair' : 'poor',
      issues,
    };
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(analysis) {
    const recommendations = [];

    // Resource hints recommendations
    if (!analysis.currentStrategy.hasPreload) {
      recommendations.push({
        priority: 'high',
        category: 'Resource Hints',
        title: 'Add font preload hints',
        description: 'Preload critical fonts to improve initial render time',
        implementation: '<link rel="preload" href="/fonts/your-font.woff2" as="font" type="font/woff2" crossorigin>',
        impact: 'Can reduce font loading time by 100-300ms',
      });
    }

    if (!analysis.currentStrategy.hasPreconnect && analysis.loadingPerformance.fonts?.some(f => f.name.includes('googleapis'))) {
      recommendations.push({
        priority: 'high',
        category: 'Resource Hints',
        title: 'Add preconnect for Google Fonts',
        description: 'Establish early connection to Google Fonts servers',
        implementation:
          '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
        impact: 'Can reduce Google Fonts loading time by 200-500ms',
      });
    }

    // Font-display recommendations
    if (analysis.foitFoutAnalysis.riskLevel === 'high') {
      recommendations.push({
        priority: 'high',
        category: 'Font Loading',
        title: 'Add font-display: swap',
        description: 'Prevent invisible text by showing fallback font immediately',
        implementation: '@font-face { font-family: "YourFont"; src: url(...); font-display: swap; }',
        impact: 'Eliminates FOIT, improves perceived performance',
      });
    }

    // Performance recommendations
    if (analysis.loadingPerformance.totalSize > 200000) {
      recommendations.push({
        priority: 'medium',
        category: 'Performance',
        title: 'Reduce font file sizes',
        description: `Total font size: ${analysis.loadingPerformance.totalSizeKB}KB. Consider subsetting or using variable fonts`,
        implementation: 'Use tools like glyphhanger or Font Squirrel to subset fonts',
        impact: `Could reduce ${formatNumber((analysis.loadingPerformance.totalSize - 150000) / 1024, 0)}KB of transfer size`,
      });
    }

    // Format recommendations
    recommendations.push({
      priority: 'medium',
      category: 'Format',
      title: 'Use WOFF2 format exclusively',
      description: 'WOFF2 has 99%+ browser support and provides best compression',
      implementation: 'Convert fonts to WOFF2 and remove other formats',
      impact: 'Can reduce font size by 30-50% vs WOFF or TTF',
    });

    // Caching recommendations
    if (analysis.loadingPerformance.cacheRate < 80) {
      recommendations.push({
        priority: 'high',
        category: 'Caching',
        title: 'Implement long-term caching',
        description: 'Fonts rarely change - cache them for 1 year',
        implementation: 'Cache-Control: public, max-age=31536000, immutable',
        impact: 'Near-instant loading for return visitors',
      });
    }

    // Advanced: variable fonts
    if (analysis.currentStrategy.fontDisplay && Object.keys(analysis.currentStrategy.fontDisplay).length > 3) {
      recommendations.push({
        priority: 'low',
        category: 'Advanced',
        title: 'Consider variable fonts',
        description: 'Replace multiple font weights with a single variable font',
        implementation: 'Use @font-face with font-variation-settings',
        impact: 'Can reduce multiple font files to a single file',
      });
    }

    // Self-hosting recommendation
    if (analysis.loadingPerformance.fonts?.some(f => f.name.includes('googleapis'))) {
      recommendations.push({
        priority: 'medium',
        category: 'Hosting',
        title: 'Consider self-hosting fonts',
        description: 'Self-hosting gives you full control over caching and loading',
        implementation: 'Download fonts and serve from your own domain',
        impact: 'Reduces DNS lookup time and allows better optimization',
      });
    }

    return recommendations;
  }

  /**
   * Calculate optimization score
   */
  calculateOptimizationScore(analysis) {
    let score = 100;

    // Deductions for missing optimizations
    if (!analysis.currentStrategy.hasPreload) score -= 20;
    if (!analysis.currentStrategy.hasFontDisplay) score -= 15;
    if (analysis.foitFoutAnalysis.riskLevel === 'high') score -= 20;
    if (analysis.foitFoutAnalysis.riskLevel === 'medium') score -= 10;
    if (analysis.loadingPerformance.totalSize > 200000) score -= 15;
    if (analysis.loadingPerformance.totalSize > 400000) score -= 15;
    if (analysis.loadingPerformance.cacheRate < 50) score -= 10;
    if (!analysis.resourceHints.hasGoogleFontsPreconnect &&
        analysis.loadingPerformance.fonts?.some(f => f.name.includes('googleapis'))) {
      score -= 10;
    }

    return Math.max(0, score);
  }

  /**
   * Get rating from score
   */
  getRating(score) {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    if (score >= 30) return 'poor';
    return 'critical';
  }
}

module.exports = new LoadingStrategyAnalyzer();
