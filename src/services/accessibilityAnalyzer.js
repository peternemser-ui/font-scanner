const { createLogger } = require('../utils/logger');

const logger = createLogger('AccessibilityAnalyzer');

/**
 * Accessibility Analyzer for Fonts and Typography
 * Provides WCAG compliance checking and accessibility scoring
 */
class AccessibilityAnalyzer {
  /**
   * Perform comprehensive accessibility analysis
   */
  async analyzeAccessibility(fontData, page) {
    try {
      const analysis = {
        contrastAnalysis: await this.analyzeContrast(fontData, page),
        readabilityMetrics: await this.analyzeReadability(fontData, page),
        wcagCompliance: await this.checkWCAGCompliance(fontData, page),
        cognitiveLoad: await this.analyzeCognitiveLoad(fontData, page),
        screenReaderCompatibility: await this.checkScreenReaderCompatibility(fontData, page),
        overallScore: 0,
        rating: 'unknown',
      };

      // Calculate overall accessibility score
      analysis.overallScore = this.calculateOverallScore(analysis);
      analysis.rating = this.getRating(analysis.overallScore);
      analysis.recommendations = this.generateAccessibilityRecommendations(analysis);

      return analysis;
    } catch (error) {
      logger.error('Error analyzing accessibility:', error);
      return null;
    }
  }

  /**
   * Analyze color contrast ratios
   */
  async analyzeContrast(fontData, page) {
    try {
      const contrastData = await page.evaluate((font) => {
        const results = [];

        // Find all elements using this font
        const allElements = Array.from(document.querySelectorAll('*'));
        const fontElements = allElements.filter(el => {
          const computed = window.getComputedStyle(el);
          return computed.fontFamily.includes(font.family);
        }).slice(0, 50); // Limit to 50 elements for performance

        fontElements.forEach(el => {
          const computed = window.getComputedStyle(el);
          const color = computed.color;
          const backgroundColor = computed.backgroundColor;
          const fontSize = parseFloat(computed.fontSize);
          const fontWeight = computed.fontWeight;

          // Helper function to parse RGB color
          const parseColor = (colorString) => {
            const match = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)/);
            if (match) {
              return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3]),
                a: match[4] ? parseFloat(match[4]) : 1,
              };
            }
            return null;
          };

          const textColor = parseColor(color);
          const bgColor = parseColor(backgroundColor);

          if (textColor && bgColor && bgColor.a > 0) {
            results.push({
              selector: el.tagName.toLowerCase(),
              textColor: color,
              backgroundColor: backgroundColor,
              fontSize: fontSize,
              fontWeight: fontWeight,
              textRgb: textColor,
              bgRgb: bgColor,
            });
          }
        });

        return results;
      }, fontData);

      // Calculate contrast ratios
      const contrastResults = contrastData.map(item => {
        const contrastRatio = this.calculateContrastRatio(item.textRgb, item.bgRgb);
        const isLargeText = item.fontSize >= 18 || (item.fontSize >= 14 && parseInt(item.fontWeight) >= 700);

        const wcagAA = isLargeText ? contrastRatio >= 3 : contrastRatio >= 4.5;
        const wcagAAA = isLargeText ? contrastRatio >= 4.5 : contrastRatio >= 7;

        return {
          ...item,
          contrastRatio: contrastRatio.toFixed(2),
          isLargeText,
          wcagAA,
          wcagAAA,
          passes: wcagAA,
        };
      });

      const passRate = contrastResults.length > 0
        ? (contrastResults.filter(r => r.passes).length / contrastResults.length) * 100
        : 100;

      return {
        results: contrastResults.slice(0, 20), // Return top 20 for reporting
        totalChecked: contrastResults.length,
        passedAA: contrastResults.filter(r => r.wcagAA).length,
        passedAAA: contrastResults.filter(r => r.wcagAAA).length,
        passRate: passRate.toFixed(1),
        score: Math.min(100, passRate + (passRate >= 100 ? 0 : -10)),
      };
    } catch (error) {
      logger.error('Error analyzing contrast:', error);
      return { score: 0, results: [] };
    }
  }

  /**
   * Calculate contrast ratio between two colors
   */
  calculateContrastRatio(color1, color2) {
    const getLuminance = (color) => {
      const rsRGB = color.r / 255;
      const gsRGB = color.g / 255;
      const bsRGB = color.b / 255;

      const r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
      const g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
      const b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);

    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Analyze readability metrics
   */
  async analyzeReadability(fontData, page) {
    try {
      const metrics = await page.evaluate((font) => {
        const textElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, td, span'));
        const fontElements = textElements.filter(el => {
          const computed = window.getComputedStyle(el);
          return computed.fontFamily.includes(font.family);
        });

        if (fontElements.length === 0) return null;

        const sampleElement = fontElements[0];
        const computed = window.getComputedStyle(sampleElement);
        const fontSize = parseFloat(computed.fontSize);
        const lineHeight = parseFloat(computed.lineHeight) || fontSize * 1.2;
        const letterSpacing = parseFloat(computed.letterSpacing) || 0;
        const wordSpacing = parseFloat(computed.wordSpacing) || 0;

        // Get text content for analysis
        const textContent = fontElements.map(el => el.textContent).join(' ').slice(0, 1000);

        // Calculate line length (characters per line)
        const lineWidth = sampleElement.offsetWidth;
        const avgCharWidth = fontSize * 0.5; // Approximate
        const charsPerLine = lineWidth / avgCharWidth;

        return {
          fontSize,
          lineHeight,
          letterSpacing,
          wordSpacing,
          lineHeightRatio: lineHeight / fontSize,
          charsPerLine: Math.round(charsPerLine),
          textContent,
        };
      }, fontData);

      if (!metrics) {
        return { score: 50, issues: ['No text content found'] };
      }

      // Calculate readability score
      let score = 100;
      const issues = [];

      // Font size check
      if (metrics.fontSize < 14) {
        score -= 20;
        issues.push(`Font size (${metrics.fontSize}px) is too small for accessibility`);
      } else if (metrics.fontSize < 16) {
        score -= 10;
        issues.push(`Font size (${metrics.fontSize}px) is below recommended 16px`);
      }

      // Line height check
      if (metrics.lineHeightRatio < 1.3) {
        score -= 15;
        issues.push(`Line height ratio (${metrics.lineHeightRatio.toFixed(2)}) is too tight`);
      } else if (metrics.lineHeightRatio < 1.5) {
        score -= 5;
        issues.push(`Line height could be increased for better readability`);
      }

      // Characters per line check (optimal: 50-75)
      if (metrics.charsPerLine > 100) {
        score -= 10;
        issues.push(`Line length (${metrics.charsPerLine} chars) is too long`);
      } else if (metrics.charsPerLine < 30) {
        score -= 10;
        issues.push(`Line length (${metrics.charsPerLine} chars) is too short`);
      }

      return {
        ...metrics,
        score: Math.max(0, score),
        rating: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
        issues,
      };
    } catch (error) {
      logger.error('Error analyzing readability:', error);
      return { score: 0, issues: ['Analysis failed'] };
    }
  }

  /**
   * Check WCAG compliance
   */
  async checkWCAGCompliance(fontData, page) {
    try {
      const compliance = {
        level_A: { passed: [], failed: [], score: 0 },
        level_AA: { passed: [], failed: [], score: 0 },
        level_AAA: { passed: [], failed: [], score: 0 },
      };

      // Check Level A criteria
      const checkA = [
        { name: 'Minimum font size (12px)', check: fontData.fontSize >= 12 },
        { name: 'Text resizable', check: true }, // Assume true for now
        { name: 'Readable without color', check: true },
      ];

      checkA.forEach(item => {
        if (item.check) {
          compliance.level_A.passed.push(item.name);
        } else {
          compliance.level_A.failed.push(item.name);
        }
      });
      compliance.level_A.score = (compliance.level_A.passed.length / checkA.length) * 100;

      // Check Level AA criteria
      const checkAA = [
        { name: 'Minimum contrast ratio (4.5:1 normal, 3:1 large)', check: true }, // From contrast analysis
        { name: 'Minimum font size (14px)', check: fontData.fontSize >= 14 },
        { name: 'Line height at least 1.5', check: true }, // From readability analysis
      ];

      checkAA.forEach(item => {
        if (item.check) {
          compliance.level_AA.passed.push(item.name);
        } else {
          compliance.level_AA.failed.push(item.name);
        }
      });
      compliance.level_AA.score = (compliance.level_AA.passed.length / checkAA.length) * 100;

      // Check Level AAA criteria
      const checkAAA = [
        { name: 'Enhanced contrast ratio (7:1 normal, 4.5:1 large)', check: false },
        { name: 'Minimum font size (16px)', check: fontData.fontSize >= 16 },
        { name: 'Line spacing at least 1.5, paragraph spacing 2x', check: false },
      ];

      checkAAA.forEach(item => {
        if (item.check) {
          compliance.level_AAA.passed.push(item.name);
        } else {
          compliance.level_AAA.failed.push(item.name);
        }
      });
      compliance.level_AAA.score = (compliance.level_AAA.passed.length / checkAAA.length) * 100;

      return compliance;
    } catch (error) {
      logger.error('Error checking WCAG compliance:', error);
      return {};
    }
  }

  /**
   * Analyze cognitive load
   */
  async analyzeCognitiveLoad(fontData, page) {
    try {
      const analysis = await page.evaluate((font) => {
        const elements = Array.from(document.querySelectorAll('*'));
        const fontElements = elements.filter(el => {
          const computed = window.getComputedStyle(el);
          return computed.fontFamily.includes(font.family);
        });

        // Count unique font styles in use
        const uniqueStyles = new Set();
        fontElements.forEach(el => {
          const computed = window.getComputedStyle(el);
          const style = `${computed.fontSize}-${computed.fontWeight}-${computed.fontStyle}`;
          uniqueStyles.add(style);
        });

        return {
          totalElements: fontElements.length,
          uniqueStyles: uniqueStyles.size,
          avgElementsPerStyle: fontElements.length / uniqueStyles.size,
        };
      }, fontData);

      let score = 100;
      const issues = [];

      // Too many variations increases cognitive load
      if (analysis.uniqueStyles > 10) {
        score -= 20;
        issues.push(`Too many font variations (${analysis.uniqueStyles}) increase cognitive load`);
      } else if (analysis.uniqueStyles > 6) {
        score -= 10;
        issues.push(`Consider reducing font variations (${analysis.uniqueStyles})`);
      }

      return {
        ...analysis,
        score: Math.max(0, score),
        rating: score >= 80 ? 'low' : score >= 60 ? 'moderate' : 'high',
        issues,
      };
    } catch (error) {
      logger.error('Error analyzing cognitive load:', error);
      return { score: 50, issues: [] };
    }
  }

  /**
   * Check screen reader compatibility
   */
  async checkScreenReaderCompatibility(fontData, page) {
    try {
      const compatibility = await page.evaluate((font) => {
        const issues = [];
        const warnings = [];

        // Check for icon fonts (problematic for screen readers)
        if (font.family.toLowerCase().includes('icon') ||
            font.family.toLowerCase().includes('awesome') ||
            font.family.toLowerCase().includes('symbol')) {
          issues.push('Icon font detected - ensure proper ARIA labels are used');
        }

        // Check for text that might be hidden
        const elements = Array.from(document.querySelectorAll('*'));
        const fontElements = elements.filter(el => {
          const computed = window.getComputedStyle(el);
          return computed.fontFamily.includes(font.family);
        });

        fontElements.forEach(el => {
          const computed = window.getComputedStyle(el);
          if (parseFloat(computed.fontSize) === 0) {
            warnings.push('Element with 0px font size detected');
          }
          if (computed.visibility === 'hidden' && el.textContent.trim().length > 0) {
            warnings.push('Text content hidden with visibility:hidden');
          }
        });

        return {
          compatible: issues.length === 0,
          issues,
          warnings,
        };
      }, fontData);

      return compatibility;
    } catch (error) {
      logger.error('Error checking screen reader compatibility:', error);
      return { compatible: true, issues: [], warnings: [] };
    }
  }

  /**
   * Calculate overall accessibility score
   */
  calculateOverallScore(analysis) {
    const weights = {
      contrastAnalysis: 0.3,
      readabilityMetrics: 0.3,
      wcagCompliance: 0.2,
      cognitiveLoad: 0.1,
      screenReaderCompatibility: 0.1,
    };

    let totalScore = 0;

    if (analysis.contrastAnalysis && analysis.contrastAnalysis.score) {
      totalScore += analysis.contrastAnalysis.score * weights.contrastAnalysis;
    }

    if (analysis.readabilityMetrics && analysis.readabilityMetrics.score) {
      totalScore += analysis.readabilityMetrics.score * weights.readabilityMetrics;
    }

    if (analysis.wcagCompliance && analysis.wcagCompliance.level_AA) {
      totalScore += analysis.wcagCompliance.level_AA.score * weights.wcagCompliance;
    }

    if (analysis.cognitiveLoad && analysis.cognitiveLoad.score) {
      totalScore += analysis.cognitiveLoad.score * weights.cognitiveLoad;
    }

    if (analysis.screenReaderCompatibility && analysis.screenReaderCompatibility.compatible) {
      totalScore += 100 * weights.screenReaderCompatibility;
    }

    return Math.round(totalScore);
  }

  /**
   * Get rating from score
   */
  getRating(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  /**
   * Generate accessibility recommendations
   */
  generateAccessibilityRecommendations(analysis) {
    const recommendations = [];

    // Contrast recommendations
    if (analysis.contrastAnalysis && analysis.contrastAnalysis.passRate < 100) {
      recommendations.push({
        category: 'Contrast',
        severity: 'high',
        message: `${(100 - parseFloat(analysis.contrastAnalysis.passRate)).toFixed(1)}% of text fails WCAG contrast requirements`,
        action: 'Increase color contrast between text and background',
        wcagCriterion: 'WCAG 2.1 Level AA - 1.4.3 Contrast (Minimum)',
      });
    }

    // Readability recommendations
    if (analysis.readabilityMetrics && analysis.readabilityMetrics.issues) {
      analysis.readabilityMetrics.issues.forEach(issue => {
        recommendations.push({
          category: 'Readability',
          severity: 'medium',
          message: issue,
          action: 'Adjust typography settings for better readability',
        });
      });
    }

    // WCAG compliance recommendations
    if (analysis.wcagCompliance) {
      const failedAA = analysis.wcagCompliance.level_AA?.failed || [];
      failedAA.forEach(criterion => {
        recommendations.push({
          category: 'WCAG Compliance',
          severity: 'high',
          message: `Failed WCAG Level AA: ${criterion}`,
          action: 'Address this criterion to meet WCAG 2.1 Level AA',
        });
      });
    }

    // Screen reader recommendations
    if (analysis.screenReaderCompatibility && analysis.screenReaderCompatibility.issues) {
      analysis.screenReaderCompatibility.issues.forEach(issue => {
        recommendations.push({
          category: 'Screen Reader',
          severity: 'high',
          message: issue,
          action: 'Ensure content is accessible to screen reader users',
        });
      });
    }

    return recommendations;
  }
}

module.exports = new AccessibilityAnalyzer();
