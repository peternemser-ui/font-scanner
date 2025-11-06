const { createLogger } = require('../utils/logger');

const logger = createLogger('FontPairingAnalyzer');

/**
 * Font Pairing Quality Analyzer
 * Analyzes font combinations and provides pairing recommendations
 */
class FontPairingAnalyzer {
  constructor() {
    // Font classification database
    this.fontCategories = {
      serif: ['georgia', 'times', 'garamond', 'baskerville', 'palatino', 'merriweather', 'playfair', 'crimson'],
      sansSerif: ['arial', 'helvetica', 'roboto', 'open sans', 'lato', 'montserrat', 'poppins', 'inter', 'system-ui'],
      monospace: ['courier', 'monaco', 'consolas', 'menlo', 'source code', 'fira code', 'jetbrains mono'],
      display: ['impact', 'lobster', 'pacifico', 'bebas', 'alfa slab'],
      handwriting: ['comic sans', 'brush script', 'dancing script', 'sacramento'],
    };

    // Pairing rules (scores from 0-100)
    this.pairingRules = [
      { from: 'serif', to: 'sansSerif', score: 95, rule: 'Classic pairing - serif for headings, sans-serif for body' },
      { from: 'sansSerif', to: 'serif', score: 90, rule: 'Modern twist - sans-serif for headings, serif for body' },
      { from: 'sansSerif', to: 'sansSerif', score: 75, rule: 'Monochromatic - use different weights/sizes' },
      { from: 'serif', to: 'serif', score: 70, rule: 'Serif combination - ensure sufficient contrast' },
      { from: 'sansSerif', to: 'monospace', score: 85, rule: 'Technical content - good for code + text' },
      { from: 'serif', to: 'monospace', score: 80, rule: 'Editorial style - works for tech writing' },
      { from: 'display', to: 'sansSerif', score: 85, rule: 'Display for headlines, sans-serif for readability' },
      { from: 'display', to: 'serif', score: 80, rule: 'Display + serif can work with careful sizing' },
      { from: 'display', to: 'display', score: 30, rule: 'Avoid using multiple display fonts' },
      { from: 'handwriting', to: 'sansSerif', score: 60, rule: 'Use handwriting sparingly for accent' },
      { from: 'handwriting', to: 'handwriting', score: 20, rule: 'Never use multiple handwriting fonts' },
    ];
  }

  /**
   * Analyze font pairings on the page
   */
  async analyzeFontPairings(fonts, page) {
    try {
      if (!fonts || fonts.length < 2) {
        return {
          pairings: [],
          score: 100,
          rating: 'good',
          message: 'Single font family used - consistent typography',
        };
      }

      // Classify fonts
      const classifiedFonts = fonts.map(font => ({
        ...font,
        category: this.classifyFont(font.family),
        usage: this.detectFontUsage(font),
      }));

      // Analyze all pairings
      const pairings = [];
      for (let i = 0; i < classifiedFonts.length; i++) {
        for (let j = i + 1; j < classifiedFonts.length; j++) {
          const pairing = this.analyzePairing(classifiedFonts[i], classifiedFonts[j]);
          if (pairing) {
            pairings.push(pairing);
          }
        }
      }

      // Calculate overall pairing score
      const avgScore = pairings.length > 0
        ? pairings.reduce((sum, p) => sum + p.score, 0) / pairings.length
        : 100;

      // Generate recommendations
      const recommendations = this.generatePairingRecommendations(classifiedFonts, pairings);

      return {
        fonts: classifiedFonts,
        pairings,
        totalFonts: fonts.length,
        score: Math.round(avgScore),
        rating: this.getRating(avgScore),
        recommendations,
        harmony: this.assessHarmony(classifiedFonts, pairings),
      };
    } catch (error) {
      logger.error('Error analyzing font pairings:', error);
      return null;
    }
  }

  /**
   * Classify font into category
   */
  classifyFont(fontFamily) {
    if (!fontFamily || typeof fontFamily !== 'string') {
      return 'serif'; // Safe default when unknown
    }
    const familyLower = fontFamily.toLowerCase();

    for (const [category, keywords] of Object.entries(this.fontCategories)) {
      if (keywords.some(keyword => familyLower.includes(keyword))) {
        return category;
      }
    }

    // Default classification based on common patterns
    if (familyLower.includes('mono') || familyLower.includes('code')) {
      return 'monospace';
    } else if (familyLower.includes('script') || familyLower.includes('cursive')) {
      return 'handwriting';
    } else if (familyLower.includes('sans') || familyLower === 'arial' || familyLower === 'helvetica') {
      return 'sansSerif';
    } else {
      return 'serif'; // Default to serif
    }
  }

  /**
   * Detect how a font is being used (headings, body, UI, etc.)
   */
  detectFontUsage(font) {
    const usagePatterns = [];

    // Analyze where the font is used (this would need to be populated from page analysis)
    if (font.elements) {
      const hasHeadings = font.elements.some(el => /^h[1-6]$/i.test(el.tagName));
      const hasBody = font.elements.some(el => /^(p|div|span|article)$/i.test(el.tagName));
      const hasUI = font.elements.some(el => /^(button|a|input|label)$/i.test(el.tagName));

      if (hasHeadings) usagePatterns.push('headings');
      if (hasBody) usagePatterns.push('body');
      if (hasUI) usagePatterns.push('UI');
    }

    return usagePatterns.length > 0 ? usagePatterns : ['unknown'];
  }

  /**
   * Analyze a specific font pairing
   */
  analyzePairing(font1, font2) {
    // Find applicable rule
    const rule = this.pairingRules.find(
      r => (r.from === font1.category && r.to === font2.category) ||
           (r.from === font2.category && r.to === font1.category)
    );

    if (!rule) {
      return {
        font1: font1.family,
        font2: font2.family,
        category1: font1.category,
        category2: font2.category,
        score: 50,
        rating: 'neutral',
        analysis: 'Uncommon pairing - proceed with caution',
      };
    }

    return {
      font1: font1.family,
      font2: font2.family,
      category1: font1.category,
      category2: font2.category,
      score: rule.score,
      rating: this.getRating(rule.score),
      analysis: rule.rule,
      recommendation: this.getPairingRecommendation(font1, font2, rule),
    };
  }

  /**
   * Get pairing recommendation
   */
  getPairingRecommendation(font1, font2, rule) {
    if (rule.score >= 85) {
      return `Excellent pairing. ${rule.rule}`;
    } else if (rule.score >= 70) {
      return `Good pairing. ${rule.rule}. Ensure sufficient contrast in weight and size.`;
    } else if (rule.score >= 50) {
      return `Acceptable pairing. ${rule.rule}. Consider alternatives for better harmony.`;
    } else {
      return `Problematic pairing. ${rule.rule}. Strongly consider using different fonts.`;
    }
  }

  /**
   * Generate pairing recommendations
   */
  generatePairingRecommendations(fonts, pairings) {
    const recommendations = [];

    // Too many fonts
    if (fonts.length > 3) {
      recommendations.push({
        type: 'warning',
        severity: 'high',
        message: `Using ${fonts.length} different font families. Limit to 2-3 for better consistency.`,
        suggestion: 'Consolidate font usage to 2-3 maximum families',
      });
    }

    // Multiple display/handwriting fonts
    const displayCount = fonts.filter(f => f.category === 'display').length;
    const handwritingCount = fonts.filter(f => f.category === 'handwriting').length;

    if (displayCount > 1) {
      recommendations.push({
        type: 'error',
        severity: 'high',
        message: 'Multiple display fonts detected. This creates visual chaos.',
        suggestion: 'Use only one display font for headlines/accents',
      });
    }

    if (handwritingCount > 1) {
      recommendations.push({
        type: 'error',
        severity: 'high',
        message: 'Multiple handwriting fonts detected. This looks unprofessional.',
        suggestion: 'Use maximum one handwriting font, and sparingly',
      });
    }

    // Low scoring pairings
    const badPairings = pairings.filter(p => p.score < 60);
    if (badPairings.length > 0) {
      badPairings.forEach(pairing => {
        recommendations.push({
          type: 'warning',
          severity: 'medium',
          message: `Problematic pairing: ${pairing.font1} + ${pairing.font2}`,
          suggestion: pairing.recommendation,
        });
      });
    }

    // Suggest better pairings
    if (fonts.length === 2) {
      recommendations.push({
        type: 'info',
        severity: 'low',
        message: 'Consider these proven pairing strategies:',
        suggestions: [
          'Use contrasting styles (serif + sans-serif)',
          'Ensure clear hierarchy through size and weight',
          'Maintain consistent x-heights for harmony',
          'Use same font family with different weights as alternative',
        ],
      });
    }

    return recommendations;
  }

  /**
   * Assess overall typography harmony
   */
  assessHarmony(fonts, pairings) {
    let harmonyScore = 100;
    const factors = [];

    // Font count factor
    if (fonts.length > 4) {
      harmonyScore -= 30;
      factors.push('Too many fonts reduce harmony');
    } else if (fonts.length > 3) {
      harmonyScore -= 15;
      factors.push('High font count may affect consistency');
    }

    // Pairing quality factor
    if (pairings.length > 0) {
      const avgPairingScore = pairings.reduce((sum, p) => sum + p.score, 0) / pairings.length;
      if (avgPairingScore < 60) {
        harmonyScore -= 20;
        factors.push('Poor font pairings detected');
      } else if (avgPairingScore < 75) {
        harmonyScore -= 10;
        factors.push('Font pairings could be improved');
      }
    }

    // Category diversity factor
    const categories = new Set(fonts.map(f => f.category));
    if (categories.has('display') && categories.has('handwriting')) {
      harmonyScore -= 20;
      factors.push('Mixing display and handwriting fonts');
    }

    // Multiple monospace factor
    const monospaceCount = fonts.filter(f => f.category === 'monospace').length;
    if (monospaceCount > 1) {
      harmonyScore -= 10;
      factors.push('Multiple monospace fonts unnecessary');
    }

    return {
      score: Math.max(0, harmonyScore),
      rating: this.getRating(harmonyScore),
      factors: factors.length > 0 ? factors : ['Good typography harmony'],
    };
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

  /**
   * Get suggested font pairings (curated list)
   */
  getSuggestedPairings() {
    return [
      {
        heading: 'Playfair Display',
        body: 'Source Sans Pro',
        category: 'Classic Elegance',
        usage: 'Editorial, blogs, luxury brands',
      },
      {
        heading: 'Montserrat',
        body: 'Merriweather',
        category: 'Modern Professional',
        usage: 'Corporate, business, portfolios',
      },
      {
        heading: 'Oswald',
        body: 'Open Sans',
        category: 'Bold & Clean',
        usage: 'Tech, startups, modern apps',
      },
      {
        heading: 'Raleway',
        body: 'Lato',
        category: 'Geometric Harmony',
        usage: 'Design agencies, creative portfolios',
      },
      {
        heading: 'Roboto',
        body: 'Roboto',
        category: 'Monochromatic',
        usage: 'Material Design, Android apps',
        note: 'Use different weights (700 for headings, 400 for body)',
      },
    ];
  }
}

module.exports = new FontPairingAnalyzer();
