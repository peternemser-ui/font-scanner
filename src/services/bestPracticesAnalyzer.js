const { createLogger } = require('../utils/logger');
const { roundTo, formatNumber } = require('../utils/formatHelpers');

const logger = createLogger('BestPracticesAnalyzer');

class BestPracticesAnalyzer {
  async analyzeBestPractices(page, fontAnalysis) {
    logger.info('Analyzing font best practices');

    const bestPractices = {
      fontDisplay: await this.analyzeFontDisplay(page, fontAnalysis),
      fontLoading: await this.analyzeFontLoadingStrategy(page),
      fontOptimization: this.analyzeFontOptimization(fontAnalysis),
      accessibility: await this.analyzeAccessibility(page),
      performance: this.analyzePerformanceBestPractices(fontAnalysis),
      fallbacks: await this.analyzeFontFallbacks(page),
      caching: await this.analyzeFontCaching(page),
      security: await this.analyzeFontSecurity(page),
      sustainability: this.analyzeFontSustainability(fontAnalysis),
      webVitals: await this.analyzeFontWebVitals(page),
    };

    const overallScore = this.calculateOverallScore(bestPractices);
    const recommendations = this.generateRecommendations(bestPractices);
    const detailedAnalysis = this.generateDetailedAnalysis(bestPractices);

    return {
      score: overallScore,
      categories: bestPractices,
      recommendations,
      detailedAnalysis,
      summary: this.generateSummary(bestPractices, overallScore),
      metrics: this.calculateMetrics(bestPractices),
    };
  }

  async analyzeFontDisplay(page, fontAnalysis) {
    const analysis = {
      score: 0,
      total: 0,
      issues: [],
      good: [],
    };

    fontAnalysis.fontFaces.forEach((fontFace) => {
      analysis.total++;

      const fontDisplay = fontFace.fontDisplay;

      if (!fontDisplay || fontDisplay === 'auto') {
        analysis.issues.push({
          type: 'warning',
          message: `Font "${fontFace.fontFamily}" uses default font-display (auto). Consider using "swap" for better loading performance.`,
          fontFamily: fontFace.fontFamily,
        });
      } else if (fontDisplay === 'block') {
        analysis.issues.push({
          type: 'warning',
          message: `Font "${fontFace.fontFamily}" uses font-display: block, which can cause invisible text during font loading.`,
          fontFamily: fontFace.fontFamily,
        });
      } else if (fontDisplay === 'swap') {
        analysis.score++;
        analysis.good.push({
          message: `Font "${fontFace.fontFamily}" correctly uses font-display: swap.`,
          fontFamily: fontFace.fontFamily,
        });
      } else if (fontDisplay === 'fallback' || fontDisplay === 'optional') {
        analysis.score++;
        analysis.good.push({
          message: `Font "${fontFace.fontFamily}" uses font-display: ${fontDisplay}, which is good for performance.`,
          fontFamily: fontFace.fontFamily,
        });
      }
    });

    return {
      ...analysis,
      percentage: analysis.total > 0 ? (analysis.score / analysis.total) * 100 : 100,
    };
  }

  async analyzeFontLoadingStrategy(page) {
    const strategies = await page.evaluate(() => {
      const analysis = {
        preload: [],
        prefetch: [],
        async: false,
        defer: false,
        resourceHints: [],
        webFontLoader: false,
      };

      // Check for preload/prefetch
      const linkElements = document.querySelectorAll('link');
      linkElements.forEach((link) => {
        if (link.rel === 'preload' && link.as === 'font') {
          analysis.preload.push(link.href);
        }
        if (link.rel === 'prefetch' && link.href.includes('font')) {
          analysis.prefetch.push(link.href);
        }
        if (link.rel === 'dns-prefetch' || link.rel === 'preconnect') {
          analysis.resourceHints.push({
            rel: link.rel,
            href: link.href,
          });
        }
      });

      // Check for web font loader
      if (window.WebFont || document.querySelector('script[src*="webfont"]')) {
        analysis.webFontLoader = true;
      }

      return analysis;
    });

    const score = this.calculateLoadingStrategyScore(strategies);

    return {
      strategies,
      score,
      recommendations: this.generateLoadingStrategyRecommendations(strategies),
    };
  }

  analyzeFontOptimization(fontAnalysis) {
    const analysis = {
      woff2Support: 0,
      woffSupport: 0,
      legacyFormats: 0,
      subsetting: 0,
      variableFonts: 0,
      issues: [],
      good: [],
    };

    // Analyze font sources if available
    if (fontAnalysis.fontSources && fontAnalysis.fontSources.length > 0) {
      fontAnalysis.fontSources.forEach((source) => {
        if (source.includes('.woff2')) {
          analysis.woff2Support++;
          analysis.good.push(`WOFF2 format detected: ${source}`);
        } else if (source.includes('.woff')) {
          analysis.woffSupport++;
          analysis.good.push(`WOFF format detected: ${source}`);
        } else if (source.includes('.ttf') || source.includes('.otf')) {
          analysis.legacyFormats++;
          analysis.issues.push({
            type: 'warning',
            message: `Legacy font format detected: ${source}. Consider using WOFF2 for better compression.`,
          });
        }

        // Check for variable fonts
        if (source.includes('variable') || source.includes('var')) {
          analysis.variableFonts++;
          analysis.good.push(`Variable font detected: ${source}`);
        }

        // Check for potential subsetting
        if (source.includes('subset') || source.includes('latin')) {
          analysis.subsetting++;
          analysis.good.push(`Font subsetting detected: ${source}`);
        }
      });

      const totalFonts = fontAnalysis.fontSources.length;
      const score =
        totalFonts > 0
          ? ((analysis.woff2Support * 2 +
              analysis.woffSupport +
              analysis.subsetting +
              analysis.variableFonts) /
              (totalFonts * 2)) *
            100
          : 100;

      return {
        ...analysis,
        score: Math.min(score, 100),
        percentage: Math.min(score, 100),
      };
    } else {
      // No explicit font sources found - likely using system fonts
      const systemFontsCount = fontAnalysis.categorizedFonts?.system?.length || 0;
      const totalFontsUsed = fontAnalysis.totalFonts || 0;
      
      if (systemFontsCount > 0) {
        analysis.good.push(`Using ${systemFontsCount} system fonts for optimal performance`);
        // System fonts are inherently "optimized" since they don't require downloads
        return {
          ...analysis,
          score: 85, // Good score for system fonts
          percentage: 85,
        };
      } else if (totalFontsUsed > 0) {
        analysis.issues.push({
          type: 'info',
          message: `${totalFontsUsed} fonts detected but no explicit web font sources found. This may indicate system fonts or embedded fonts.`,
        });
        return {
          ...analysis,
          score: 70, // Decent score when fonts are detected but sources unclear
          percentage: 70,
        };
      } else {
        // No fonts detected at all
        analysis.issues.push({
          type: 'warning',
          message: 'No fonts detected. This may indicate a scanning issue or a very minimal page.',
        });
        return {
          ...analysis,
          score: 50, // Neutral score when no fonts detected
          percentage: 50,
        };
      }
    }
  }

  async analyzeAccessibility(page) {
    const accessibility = await page.evaluate(() => {
      // Helper function must be defined inside evaluate (browser context)
      const formatNumber = (num, decimals = 2) => {
        if (typeof num !== 'number' || isNaN(num)) return '0';
        return num.toFixed(decimals);
      };
      
      const analysis = {
        minFontSize: Infinity,
        contrastIssues: 0,
        readabilityIssues: [],
        goodPractices: [],
      };

      const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, li');

      textElements.forEach((element) => {
        const styles = window.getComputedStyle(element);
        const fontSize = parseFloat(styles.fontSize);
        const fontWeight = styles.fontWeight;
        const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.2;

        // Check minimum font size
        if (fontSize < analysis.minFontSize && element.textContent.trim()) {
          analysis.minFontSize = fontSize;
        }

        // Check line height
        const lineHeightRatio = lineHeight / fontSize;
        if (lineHeightRatio < 1.2) {
          analysis.readabilityIssues.push(
            `Poor line height ratio (${formatNumber(lineHeightRatio, 2)}) for element with font-size ${fontSize}px`
          );
        }

        // Check for very light font weights on small text
        if (fontSize < 14 && (fontWeight === '100' || fontWeight === '200')) {
          analysis.readabilityIssues.push(
            `Very light font weight (${fontWeight}) on small text (${fontSize}px) may harm readability`
          );
        }
      });

      if (analysis.minFontSize >= 16) {
        analysis.goodPractices.push(
          `Minimum font size is ${analysis.minFontSize}px, which meets accessibility guidelines`
        );
      }

      return analysis;
    });

    const score = this.calculateAccessibilityScore(accessibility);

    return {
      ...accessibility,
      score,
      percentage: score,
    };
  }

  analyzePerformanceBestPractices(fontAnalysis) {
    const analysis = {
      score: 0,
      issues: [],
      good: [],
      checks: [],
    };

    // Check number of font requests
    const fontRequests = fontAnalysis.fontSources.length;
    analysis.checks.push({
      name: 'Font Requests',
      value: fontRequests,
      threshold: 4,
    });

    if (fontRequests <= 2) {
      analysis.score += 30;
      analysis.good.push(`Excellent: Only ${fontRequests} font requests`);
    } else if (fontRequests <= 4) {
      analysis.score += 20;
      analysis.good.push(`Good: ${fontRequests} font requests`);
    } else {
      analysis.issues.push({
        type: 'warning',
        message: `Too many font requests (${fontRequests}). Consider reducing font variations.`,
      });
    }

    // Check for font variations
    const fontFamilies = new Set(fontAnalysis.fontFaces.map((f) => f.fontFamily));
    const uniqueFamilies = fontFamilies.size;

    analysis.checks.push({
      name: 'Font Families',
      value: uniqueFamilies,
      threshold: 3,
    });

    if (uniqueFamilies <= 2) {
      analysis.score += 25;
      analysis.good.push(`Good: Using ${uniqueFamilies} font families`);
    } else if (uniqueFamilies <= 3) {
      analysis.score += 15;
      analysis.good.push(`Acceptable: Using ${uniqueFamilies} font families`);
    } else {
      analysis.issues.push({
        type: 'warning',
        message: `Too many font families (${uniqueFamilies}). Consider reducing for better performance.`,
      });
    }

    // Check for system fonts usage
    const systemFontsCount = fontAnalysis.categorizedFonts.system.length;
    if (systemFontsCount > 0) {
      analysis.score += 25;
      analysis.good.push(`Good: Using ${systemFontsCount} system fonts for better performance`);
    }

    // Check for web font optimization
    const hasWoff2 = fontAnalysis.fontSources.some((src) => src.includes('.woff2'));
    if (hasWoff2) {
      analysis.score += 20;
      analysis.good.push('Excellent: Using WOFF2 format for optimal compression');
    }

    return {
      ...analysis,
      percentage: Math.min(analysis.score, 100),
    };
  }

  async analyzeFontFallbacks(page) {
    const fallbacks = await page.evaluate(() => {
      const analysis = {
        withFallbacks: 0,
        withoutFallbacks: 0,
        systemFallbacks: 0,
        details: [],
      };

      const elements = document.querySelectorAll('*');
      const fontFamilies = new Set();

      elements.forEach((element) => {
        const fontFamily = window.getComputedStyle(element).fontFamily;
        if (fontFamily && fontFamily !== 'initial') {
          fontFamilies.add(fontFamily);
        }
      });

      fontFamilies.forEach((fontFamily) => {
        const fonts = fontFamily.split(',').map((f) => f.trim().replace(/['"]/g, ''));

        analysis.details.push({
          fontStack: fontFamily,
          fontCount: fonts.length,
          hasGenericFallback: fonts.some((f) =>
            ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'].includes(f.toLowerCase())
          ),
          hasSystemFallback: fonts.some((f) =>
            ['Arial', 'Helvetica', 'Times', 'Georgia', 'Verdana'].includes(f)
          ),
        });

        if (fonts.length > 1) {
          analysis.withFallbacks++;
          if (
            fonts.some((f) => ['Arial', 'Helvetica', 'Times', 'Georgia', 'Verdana'].includes(f))
          ) {
            analysis.systemFallbacks++;
          }
        } else {
          analysis.withoutFallbacks++;
        }
      });

      return analysis;
    });

    const total = fallbacks.withFallbacks + fallbacks.withoutFallbacks;
    const score = total > 0 ? (fallbacks.withFallbacks / total) * 100 : 100;

    return {
      ...fallbacks,
      score,
      percentage: score,
    };
  }

  calculateOverallScore(bestPractices) {
    const weights = {
      fontDisplay: 20,
      fontLoading: 15,
      fontOptimization: 20,
      accessibility: 20,
      performance: 15,
      fallbacks: 10,
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([category, weight]) => {
      if (bestPractices[category] && typeof bestPractices[category].score === 'number') {
        totalScore += bestPractices[category].score * weight;
        totalWeight += weight;
      }
    });

    const calculatedScore = totalWeight > 0 ? roundTo(totalScore / totalWeight, 0) : 0;

    // Apply minimum score adjustment for system fonts or minimal detection
    if (calculatedScore < 50 && bestPractices.fontOptimization?.good?.length > 0) {
      // If we have some positive indicators but low score, boost it slightly
      return Math.max(calculatedScore, 60);
    }

    return calculatedScore;
  }

  calculateLoadingStrategyScore(strategies) {
    let score = 0;

    if (strategies.preload.length > 0) score += 30;
    if (strategies.resourceHints.some((hint) => hint.rel === 'preconnect')) score += 20;
    if (strategies.resourceHints.some((hint) => hint.rel === 'dns-prefetch')) score += 10;
    if (strategies.webFontLoader) score += 20;

    return Math.min(score, 100);
  }

  calculateAccessibilityScore(accessibility) {
    let score = 100;

    if (accessibility.minFontSize < 12) score -= 40;
    else if (accessibility.minFontSize < 14) score -= 20;
    else if (accessibility.minFontSize < 16) score -= 10;

    score -= Math.min(accessibility.readabilityIssues.length * 10, 40);

    return Math.max(score, 0);
  }

  generateLoadingStrategyRecommendations(strategies) {
    const recommendations = [];

    if (strategies.preload.length === 0) {
      recommendations.push({
        type: 'suggestion',
        message: 'Consider preloading critical fonts using <link rel="preload" as="font">',
        priority: 'medium',
      });
    }

    if (!strategies.resourceHints.some((hint) => hint.rel === 'preconnect')) {
      recommendations.push({
        type: 'suggestion',
        message: 'Add <link rel="preconnect"> for external font providers like Google Fonts',
        priority: 'medium',
      });
    }

    return recommendations;
  }

  generateRecommendations(bestPractices) {
    const recommendations = [];

    // Font Display Recommendations
    if (bestPractices.fontDisplay && bestPractices.fontDisplay.percentage < 80) {
      recommendations.push({
        type: 'Font Display Optimization',
        priority: 'high',
        category: 'Performance',
        message: 'Implement font-display: swap for better loading performance',
        details: `Only ${roundTo(bestPractices.fontDisplay.percentage, 0)}% of fonts use optimal display strategy`,
        action: 'Add font-display: swap to @font-face declarations',
        impact: 'Reduces invisible text during font loading',
        codeExample:
          '@font-face { font-family: "MyFont"; src: url("font.woff2"); font-display: swap; }',
      });
    }

    // Font Loading Strategy
    if (bestPractices.fontLoading && bestPractices.fontLoading.score < 70) {
      recommendations.push({
        type: 'Font Loading Strategy',
        priority: 'high',
        category: 'Performance',
        message: 'Optimize font loading with preload and proper resource hints',
        details: 'Current font loading strategy could be improved',
        action: 'Add rel="preload" for critical fonts and dns-prefetch for font CDNs',
        impact: 'Faster font loading and better perceived performance',
        codeExample:
          '<link rel="preload" href="font.woff2" as="font" type="font/woff2" crossorigin>',
      });
    }

    // Font Optimization
    if (bestPractices.fontOptimization && bestPractices.fontOptimization.percentage < 70) {
      if (bestPractices.fontOptimization.woff2Support === 0) {
        recommendations.push({
          type: 'Font Format Optimization',
          priority: 'high',
          category: 'Performance',
          message: 'Convert fonts to WOFF2 format for better compression',
          details: 'No WOFF2 fonts detected. WOFF2 provides 30% better compression than WOFF',
          action: 'Convert TTF/OTF fonts to WOFF2 format',
          impact: 'Reduces font file sizes by 30-50%',
          codeExample: 'Use tools like fonttools or online converters to generate WOFF2 files',
        });
      }

      if (bestPractices.fontOptimization.subsetting === 0) {
        recommendations.push({
          type: 'Font Subsetting',
          priority: 'medium',
          category: 'Performance',
          message: 'Implement font subsetting to reduce file sizes',
          details: 'No font subsetting detected. Subsetting removes unused characters',
          action: 'Create subsets for specific language support (Latin, Cyrillic, etc.)',
          impact: 'Reduces font file sizes by 40-60%',
          codeExample:
            'Use Google Fonts with &subset=latin parameter or fonttools for custom fonts',
        });
      }
    }

    // Accessibility Issues
    if (bestPractices.accessibility && bestPractices.accessibility.percentage < 80) {
      recommendations.push({
        type: 'Font Accessibility',
        priority: 'high',
        category: 'Accessibility',
        message: 'Improve font accessibility and readability',
        details: `Accessibility score: ${roundTo(bestPractices.accessibility.percentage, 0)}%`,
        action: 'Ensure minimum font sizes (16px) and adequate line heights (1.4+)',
        impact: 'Better readability for users with visual impairments',
        codeExample: 'body { font-size: 16px; line-height: 1.5; }',
      });
    }

    // Performance Issues
    if (bestPractices.performance && bestPractices.performance.percentage < 70) {
      recommendations.push({
        type: 'Font Performance',
        priority: 'medium',
        category: 'Performance',
        message: 'Optimize font loading performance',
        details: 'Font loading is impacting page performance',
        action: 'Reduce number of font variations and implement font loading best practices',
        impact: 'Faster page load times and better user experience',
        codeExample: 'Limit to 2-3 font weights and use system fonts as fallbacks',
      });
    }

    // Security Issues
    if (bestPractices.security && bestPractices.security.percentage < 90) {
      recommendations.push({
        type: 'Font Security',
        priority: 'medium',
        category: 'Security',
        message: 'Ensure secure font loading',
        details: 'Some fonts are loaded over insecure connections',
        action: 'Use HTTPS for all font resources and add crossorigin attributes',
        impact: 'Prevents mixed content warnings and improves security',
        codeExample:
          '<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet" crossorigin>',
      });
    }

    // Sustainability
    if (bestPractices.sustainability && bestPractices.sustainability.percentage < 70) {
      recommendations.push({
        type: 'Environmental Impact',
        priority: 'low',
        category: 'Sustainability',
        message: 'Reduce carbon footprint of font loading',
        details: `Current carbon footprint: ${formatNumber(bestPractices.sustainability.carbonFootprint || 0, 2)}g CO₂`,
        action: 'Use variable fonts and aggressive font subsetting',
        impact: 'Reduces bandwidth usage and environmental impact',
        codeExample: 'Consider using system fonts or single variable font files',
      });
    }

    // Web Vitals Impact
    if (bestPractices.webVitals && bestPractices.webVitals.score < 80) {
      recommendations.push({
        type: 'Core Web Vitals',
        priority: 'high',
        category: 'Performance',
        message: 'Minimize font impact on Core Web Vitals',
        details: 'Font loading is affecting Cumulative Layout Shift and rendering',
        action: 'Use font-display: optional for non-critical fonts and proper fallbacks',
        impact: 'Improves CLS and FCP scores',
        codeExample: 'Use size-adjust property in @font-face to match fallback metrics',
      });
    }

    // Always add some general best practice recommendations
    if (recommendations.length === 0) {
      recommendations.push({
        type: 'Font Loading Excellence',
        priority: 'low',
        category: 'Performance',
        message: 'Great job! Your font implementation follows best practices',
        details: 'All major font loading optimizations are in place',
        action: 'Consider monitoring font performance over time',
        impact: 'Maintaining excellent user experience',
        codeExample: 'Use tools like WebPageTest to monitor font loading performance',
      });
    }

    // Sort by priority
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    recommendations.sort(
      (a, b) => (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0)
    );

    return recommendations.slice(0, 8); // Limit to top 8 recommendations
  }

  generateSummary(bestPractices, overallScore) {
    const issues = [];
    const strengths = [];

    if (bestPractices.fontDisplay.percentage < 50) {
      issues.push('Font-display strategy needs improvement');
    } else {
      strengths.push('Good font-display implementation');
    }

    if (bestPractices.performance.percentage < 60) {
      issues.push('Font performance optimization needed');
    } else {
      strengths.push('Good font performance practices');
    }

    if (bestPractices.accessibility.percentage < 70) {
      issues.push('Font accessibility could be improved');
    } else {
      strengths.push('Good font accessibility practices');
    }

    return {
      overallScore,
      grade: this.getGrade(overallScore),
      mainIssues: issues.slice(0, 3),
      mainStrengths: strengths.slice(0, 3),
    };
  }

  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  async analyzeFontCaching(page) {
    const caching = await page.evaluate(() => {
      const analysis = {
        cacheableResources: 0,
        nonCacheableResources: 0,
        longTermCaching: 0,
        issues: [],
        recommendations: [],
      };

      const fontLinks = document.querySelectorAll('link[href*="font"], link[as="font"]');
      fontLinks.forEach((link) => {
        analysis.cacheableResources++;

        // Check for cache-control headers (would need server-side info)
        const url = new URL(link.href);
        if (
          url.hostname.includes('fonts.googleapis.com') ||
          url.hostname.includes('fonts.gstatic.com')
        ) {
          analysis.longTermCaching++;
        } else {
          analysis.issues.push(`Custom font ${link.href} may not have optimal caching headers`);
        }
      });

      return analysis;
    });

    const score =
      caching.cacheableResources > 0
        ? (caching.longTermCaching / caching.cacheableResources) * 100
        : 100;

    return {
      ...caching,
      score: roundTo(score, 0),
      percentage: roundTo(score, 0),
    };
  }

  async analyzeFontSecurity(page) {
    const security = await page.evaluate(() => {
      const analysis = {
        httpsUsage: 0,
        httpUsage: 0,
        cdnUsage: 0,
        crossOriginIssues: [],
        secureConnections: 0,
        issues: [],
        good: [],
      };

      const fontLinks = document.querySelectorAll('link[href*="font"], link[as="font"]');
      fontLinks.forEach((link) => {
        const url = new URL(link.href);

        if (url.protocol === 'https:') {
          analysis.httpsUsage++;
          analysis.secureConnections++;
          analysis.good.push(`Secure HTTPS connection for ${url.hostname}`);
        } else {
          analysis.httpUsage++;
          analysis.issues.push(`Insecure HTTP connection for font: ${link.href}`);
        }

        if (url.hostname !== window.location.hostname) {
          if (url.hostname.includes('googleapis.com') || url.hostname.includes('typekit.net')) {
            analysis.cdnUsage++;
            analysis.good.push(`Trusted CDN usage: ${url.hostname}`);
          } else {
            analysis.crossOriginIssues.push(`Cross-origin font loading from: ${url.hostname}`);
          }
        }
      });

      return analysis;
    });

    const totalFonts = security.httpsUsage + security.httpUsage;
    const score = totalFonts > 0 ? (security.secureConnections / totalFonts) * 100 : 100;

    return {
      ...security,
      score: roundTo(score, 0),
      percentage: roundTo(score, 0),
    };
  }

  analyzeFontSustainability(fontAnalysis) {
    const analysis = {
      variableFonts: 0,
      subsettedFonts: 0,
      compressedFormats: 0,
      totalSize: 0,
      carbonFootprint: 0,
      issues: [],
      good: [],
    };

    fontAnalysis.fontSources.forEach((source) => {
      // Estimate file size based on format
      let estimatedSize = 50; // KB base estimate

      if (source.includes('.woff2')) {
        estimatedSize = 25; // WOFF2 is highly compressed
        analysis.compressedFormats++;
        analysis.good.push('WOFF2 format reduces bandwidth usage');
      } else if (source.includes('.woff')) {
        estimatedSize = 35;
        analysis.compressedFormats++;
      } else if (source.includes('.ttf') || source.includes('.otf')) {
        estimatedSize = 80;
        analysis.issues.push('Uncompressed font format increases carbon footprint');
      }

      if (source.includes('variable')) {
        analysis.variableFonts++;
        estimatedSize *= 1.5; // Variable fonts are larger but replace multiple fonts
        analysis.good.push('Variable font reduces number of requests');
      }

      if (source.includes('subset') || source.includes('latin')) {
        analysis.subsettedFonts++;
        estimatedSize *= 0.6; // Subsetting reduces size
        analysis.good.push('Font subsetting reduces data transfer');
      }

      analysis.totalSize += estimatedSize;
    });

    // Estimate carbon footprint (rough calculation)
    analysis.carbonFootprint = (analysis.totalSize / 1000) * 0.5; // grams CO2

    const sustainabilityScore = Math.max(0, 100 - analysis.totalSize / 10);

    return {
      ...analysis,
      score: roundTo(sustainabilityScore, 0),
      percentage: roundTo(sustainabilityScore, 0),
      recommendations: this.generateSustainabilityRecommendations(analysis),
    };
  }

  async analyzeFontWebVitals(page) {
    const webVitals = await page.evaluate(() => {
      const analysis = {
        layoutShifts: 0,
        renderBlockingFonts: 0,
        flashOfInvisibleText: false,
        flashOfUnstyledText: false,
        issues: [],
        good: [],
      };

      // Check for potential CLS issues
      const textElements = document.querySelectorAll('h1, h2, h3, p');
      textElements.forEach((element) => {
        const styles = window.getComputedStyle(element);
        const fontFamily = styles.fontFamily;

        if (fontFamily.includes('serif') || fontFamily.includes('sans-serif')) {
          analysis.good.push('Proper fallback fonts help prevent layout shifts');
        } else if (!fontFamily.includes('system-ui') && !fontFamily.includes('Arial')) {
          analysis.issues.push('Missing fallback fonts may cause layout shifts');
        }
      });

      // Check for render-blocking fonts
      const fontLinks = document.querySelectorAll('link[href*="font"]');
      fontLinks.forEach((link) => {
        if (!link.hasAttribute('crossorigin')) {
          analysis.renderBlockingFonts++;
          analysis.issues.push('Font without crossorigin attribute may block rendering');
        }
      });

      return analysis;
    });

    const score = Math.max(
      0,
      100 - webVitals.renderBlockingFonts * 20 - webVitals.layoutShifts * 15
    );

    return {
      ...webVitals,
      score: roundTo(score, 0),
      percentage: roundTo(score, 0),
    };
  }

  generateDetailedAnalysis(bestPractices) {
    const analysis = {
      criticalIssues: [],
      warnings: [],
      optimizations: [],
      strengths: [],
    };

    // Analyze each category
    Object.entries(bestPractices).forEach(([category, data]) => {
      if (data.issues) {
        data.issues.forEach((issue) => {
          if (issue.type === 'critical' || data.percentage < 30) {
            analysis.criticalIssues.push({ category, ...issue });
          } else {
            analysis.warnings.push({ category, ...issue });
          }
        });
      }

      if (data.good) {
        data.good.forEach((good) => {
          analysis.strengths.push({ category, message: good.message || good });
        });
      }

      if (data.recommendations) {
        data.recommendations.forEach((rec) => {
          analysis.optimizations.push({ category, ...rec });
        });
      }
    });

    return analysis;
  }

  calculateMetrics(bestPractices) {
    const metrics = {
      totalFonts: 0,
      optimizedFonts: 0,
      accessibilityScore: 0,
      performanceScore: 0,
      securityScore: 0,
      sustainabilityScore: 0,
    };

    // Count fonts from font optimization analysis
    if (bestPractices.fontOptimization) {
      const fontSourceCount = 
        bestPractices.fontOptimization.woff2Support +
        bestPractices.fontOptimization.woffSupport +
        bestPractices.fontOptimization.legacyFormats;
      
      // If we have font sources, use that count
      if (fontSourceCount > 0) {
        metrics.totalFonts = fontSourceCount;
        metrics.optimizedFonts =
          bestPractices.fontOptimization.woff2Support + bestPractices.fontOptimization.woffSupport;
      } else if (bestPractices.fontDisplay && bestPractices.fontDisplay.total > 0) {
        // Fall back to font-face count from fontDisplay analysis
        metrics.totalFonts = bestPractices.fontDisplay.total;
        // Calculate optimized fonts based on the optimization percentage
        const optimizationPercentage = bestPractices.fontOptimization.percentage || 0;
        metrics.optimizedFonts = roundTo((optimizationPercentage / 100) * bestPractices.fontDisplay.total, 0);
      } else {
        // Default assumption: if no explicit fonts detected, assume 1 system font
        metrics.totalFonts = 1;
        // Calculate optimized fonts based on the optimization percentage
        const optimizationPercentage = bestPractices.fontOptimization.percentage || 0;
        metrics.optimizedFonts = optimizationPercentage >= 80 ? 1 : 0;
      }
    }

    metrics.accessibilityScore = bestPractices.accessibility?.percentage || 0;
    metrics.performanceScore = bestPractices.performance?.percentage || 0;
    metrics.securityScore = bestPractices.security?.percentage || 0;
    metrics.sustainabilityScore = bestPractices.sustainability?.percentage || 0;

    return metrics;
  }

  generateSustainabilityRecommendations(analysis) {
    const recommendations = [];

    if (analysis.compressedFormats === 0) {
      recommendations.push({
        priority: 'high',
        action: 'Use WOFF2 format',
        impact: 'Reduce bandwidth by 30-50%',
      });
    }

    if (analysis.subsettedFonts === 0) {
      recommendations.push({
        priority: 'medium',
        action: 'Implement font subsetting',
        impact: 'Reduce file size by 40-60%',
      });
    }

    if (analysis.totalSize > 100) {
      recommendations.push({
        priority: 'high',
        action: 'Reduce total font payload',
        impact: 'Lower carbon footprint and faster loading',
      });
    }

    return recommendations;
  }
}

module.exports = new BestPracticesAnalyzer();
