const { createLogger } = require('../utils/logger');
const fs = require('fs').promises;
const path = require('path');

const logger = createLogger('FontLicensingDetector');

/**
 * Font Licensing Detection Service
 * Detects font licenses and provides compliance information
 */
class FontLicensingDetector {
  constructor() {
    this.licensingDatabase = this.initializeLicensingDatabase();
    this.commercialFonts = this.initializeCommercialFonts();
    this.freeFonts = this.initializeFreeFonts();
    this.restrictedFonts = this.initializeRestrictedFonts();
  }

  /**
   * Analyze font licensing for a website
   */
  async analyzeFontLicensing(fonts, url) {
    try {
      const analysis = {
        timestamp: new Date().toISOString(),
        url: url,
        fonts: [],
        summary: {
          total: 0,
          commercial: 0,
          free: 0,
          restricted: 0,
          unknown: 0,
          violations: 0
        },
        violations: [],
        recommendations: [],
        complianceScore: 0,
        legalRisk: 'unknown'
      };

      // Analyze each font
      for (const font of fonts) {
        const fontAnalysis = await this.analyzeFontLicense(font, url);
        analysis.fonts.push(fontAnalysis);
        
        // Update summary
        analysis.summary.total++;
        analysis.summary[fontAnalysis.category]++;
        
        if (fontAnalysis.violations.length > 0) {
          analysis.summary.violations++;
          analysis.violations.push(...fontAnalysis.violations);
        }
      }

      // Calculate compliance score and risk
      analysis.complianceScore = this.calculateComplianceScore(analysis);
      analysis.legalRisk = this.assessLegalRisk(analysis);
      analysis.recommendations = this.generateLicensingRecommendations(analysis);

      return analysis;

    } catch (error) {
      logger.error('Error analyzing font licensing:', error);
      return this.getErrorResult(error);
    }
  }

  /**
   * Analyze individual font license
   */
  async analyzeFontLicense(font, url) {
    const analysis = {
      family: font.family,
      source: font.source || 'unknown',
      category: 'unknown',
      license: null,
      compliance: {
        webUse: false,
        commercial: false,
        embedding: false,
        modification: false
      },
      violations: [],
      alternatives: [],
      cost: null,
      riskLevel: 'unknown'
    };

    // Determine font category and license
    const licenseInfo = this.identifyFontLicense(font);
    analysis.category = licenseInfo.category;
    analysis.license = licenseInfo.license;
    analysis.compliance = licenseInfo.compliance;

    // Check for violations
    analysis.violations = await this.checkLicenseViolations(font, url, licenseInfo);
    
    // Suggest alternatives if needed
    if (analysis.violations.length > 0) {
      analysis.alternatives = this.suggestAlternatives(font);
    }

    // Assess risk level
    analysis.riskLevel = this.assessFontRiskLevel(analysis);

    return analysis;
  }

  /**
   * Identify font license information
   */
  identifyFontLicense(font) {
    const fontFamily = font.family.toLowerCase();
    
    // Check Google Fonts (free for web use)
    if (font.source === 'google' || this.isGoogleFont(fontFamily)) {
      return {
        category: 'free',
        license: {
          name: 'Open Font License (OFL)',
          type: 'open-source',
          commercial: true,
          webUse: true,
          embedding: true,
          modification: true,
          attribution: false,
          url: 'https://scripts.sil.org/OFL'
        },
        compliance: {
          webUse: true,
          commercial: true,
          embedding: true,
          modification: true
        }
      };
    }

    // Check system fonts
    if (this.isSystemFont(fontFamily)) {
      return this.getSystemFontLicense(fontFamily);
    }

    // Check commercial fonts database
    const commercialFont = this.findCommercialFont(fontFamily);
    if (commercialFont) {
      return {
        category: 'commercial',
        license: commercialFont.license,
        compliance: commercialFont.compliance
      };
    }

    // Check restricted fonts
    const restrictedFont = this.findRestrictedFont(fontFamily);
    if (restrictedFont) {
      return {
        category: 'restricted',
        license: restrictedFont.license,
        compliance: restrictedFont.compliance
      };
    }

    // Check free font databases
    const freeFont = this.findFreeFont(fontFamily);
    if (freeFont) {
      return {
        category: 'free',
        license: freeFont.license,
        compliance: freeFont.compliance
      };
    }

    // Unknown font - assume restricted for safety
    return {
      category: 'unknown',
      license: {
        name: 'Unknown License',
        type: 'unknown',
        commercial: false,
        webUse: false,
        embedding: false,
        modification: false
      },
      compliance: {
        webUse: false,
        commercial: false,
        embedding: false,
        modification: false
      }
    };
  }

  /**
   * Check for license violations
   */
  async checkLicenseViolations(font, url, licenseInfo) {
    const violations = [];

    // Web use violation
    if (!licenseInfo.compliance.webUse) {
      violations.push({
        type: 'web-use',
        severity: 'high',
        description: `Font "${font.family}" may not be licensed for web use`,
        recommendation: 'Verify web font license or find alternative'
      });
    }

    // Commercial use violation (if this is a commercial site)
    const isCommercialSite = await this.isCommercialWebsite(url);
    if (isCommercialSite && !licenseInfo.compliance.commercial) {
      violations.push({
        type: 'commercial-use',
        severity: 'high',
        description: `Font "${font.family}" may not be licensed for commercial use`,
        recommendation: 'Purchase commercial license or find alternative'
      });
    }

    // Embedding violation
    if (!licenseInfo.compliance.embedding) {
      violations.push({
        type: 'embedding',
        severity: 'medium',
        description: `Font "${font.family}" may not allow web embedding`,
        recommendation: 'Check embedding permissions in font license'
      });
    }

    // Attribution requirement
    if (licenseInfo.license?.attribution && !await this.hasAttributionNotice(url, font)) {
      violations.push({
        type: 'attribution',
        severity: 'medium',
        description: `Font "${font.family}" requires attribution notice`,
        recommendation: 'Add proper attribution as required by license'
      });
    }

    return violations;
  }

  /**
   * Initialize licensing database
   */
  initializeLicensingDatabase() {
    return {
      // This would be populated from external licensing databases
      googleFonts: 'https://fonts.google.com',
      adobeFonts: 'https://fonts.adobe.com',
      fontSquirrel: 'https://www.fontsquirrel.com',
      myFonts: 'https://www.myfonts.com'
    };
  }

  /**
   * Initialize commercial fonts database
   */
  initializeCommercialFonts() {
    return [
      {
        families: ['helvetica neue', 'helvetica', 'futura'],
        foundry: 'Monotype',
        license: {
          name: 'Commercial Font License',
          type: 'commercial',
          webUse: false, // Requires web license
          commercial: false, // Requires commercial license
          embedding: false,
          cost: '$29-199'
        },
        compliance: {
          webUse: false,
          commercial: false,
          embedding: false,
          modification: false
        }
      },
      {
        families: ['proxima nova', 'museo'],
        foundry: 'Mark Simonson Studio',
        license: {
          name: 'Font License',
          type: 'commercial',
          webUse: false,
          commercial: false,
          embedding: false,
          cost: '$35-175'
        },
        compliance: {
          webUse: false,
          commercial: false,
          embedding: false,
          modification: false
        }
      },
      {
        families: ['brandon grotesque', 'brandon text'],
        foundry: 'HVD Fonts',
        license: {
          name: 'Font License',
          type: 'commercial',
          webUse: false,
          commercial: false,
          embedding: false,
          cost: '$40-200'
        },
        compliance: {
          webUse: false,
          commercial: false,
          embedding: false,
          modification: false
        }
      }
    ];
  }

  /**
   * Initialize free fonts database
   */
  initializeFreeFonts() {
    return [
      {
        families: ['open sans', 'roboto', 'lato', 'source sans pro', 'montserrat'],
        source: 'Google Fonts',
        license: {
          name: 'Open Font License (OFL)',
          type: 'open-source',
          webUse: true,
          commercial: true,
          embedding: true,
          attribution: false
        },
        compliance: {
          webUse: true,
          commercial: true,
          embedding: true,
          modification: true
        }
      },
      {
        families: ['liberation serif', 'liberation sans', 'liberation mono'],
        source: 'Red Hat',
        license: {
          name: 'Liberation Font License',
          type: 'open-source',
          webUse: true,
          commercial: true,
          embedding: true,
          attribution: false
        },
        compliance: {
          webUse: true,
          commercial: true,
          embedding: true,
          modification: true
        }
      }
    ];
  }

  /**
   * Initialize restricted fonts database
   */
  initializeRestrictedFonts() {
    return [
      {
        families: ['arial', 'times new roman', 'courier new', 'comic sans ms'],
        foundry: 'Microsoft',
        license: {
          name: 'Microsoft Font License',
          type: 'proprietary',
          webUse: false,
          commercial: false,
          embedding: false,
          restriction: 'System fonts not licensed for web distribution'
        },
        compliance: {
          webUse: false,
          commercial: false,
          embedding: false,
          modification: false
        }
      },
      {
        families: ['sf pro display', 'sf pro text', 'helvetica neue'],
        foundry: 'Apple',
        license: {
          name: 'Apple Font License',
          type: 'proprietary',
          webUse: false,
          commercial: false,
          embedding: false,
          restriction: 'System fonts not licensed for web distribution'
        },
        compliance: {
          webUse: false,
          commercial: false,
          embedding: false,
          modification: false
        }
      }
    ];
  }

  /**
   * Check if font is a Google Font
   */
  isGoogleFont(fontFamily) {
    const googleFonts = [
      'open sans', 'roboto', 'lato', 'source sans pro', 'oswald',
      'montserrat', 'raleway', 'ubuntu', 'nunito', 'playfair display',
      'merriweather', 'poppins', 'inter', 'work sans', 'fira sans'
    ];
    return googleFonts.some(gf => fontFamily.includes(gf));
  }

  /**
   * Check if font is a system font
   */
  isSystemFont(fontFamily) {
    const systemFonts = [
      'arial', 'helvetica', 'times', 'times new roman', 'courier',
      'courier new', 'verdana', 'georgia', 'trebuchet ms', 'comic sans ms',
      'impact', 'lucida grande', 'tahoma', 'palatino', 'garamond',
      'sf pro display', 'sf pro text', 'system-ui', '-apple-system',
      'segoe ui', 'roboto', 'oxygen', 'ubuntu', 'cantarell'
    ];
    return systemFonts.some(sf => fontFamily.includes(sf));
  }

  /**
   * Get system font license information
   */
  getSystemFontLicense(fontFamily) {
    // Most system fonts are not licensed for web distribution
    return {
      category: 'restricted',
      license: {
        name: 'System Font License',
        type: 'proprietary',
        webUse: false,
        commercial: false,
        embedding: false,
        restriction: 'System fonts may not be licensed for web use'
      },
      compliance: {
        webUse: false,
        commercial: false,
        embedding: false,
        modification: false
      }
    };
  }

  /**
   * Find commercial font in database
   */
  findCommercialFont(fontFamily) {
    for (const font of this.commercialFonts) {
      if (font.families.some(f => fontFamily.includes(f))) {
        return font;
      }
    }
    return null;
  }

  /**
   * Find free font in database
   */
  findFreeFont(fontFamily) {
    for (const font of this.freeFonts) {
      if (font.families.some(f => fontFamily.includes(f))) {
        return font;
      }
    }
    return null;
  }

  /**
   * Find restricted font in database
   */
  findRestrictedFont(fontFamily) {
    for (const font of this.restrictedFonts) {
      if (font.families.some(f => fontFamily.includes(f))) {
        return font;
      }
    }
    return null;
  }

  /**
   * Check if website is commercial
   */
  async isCommercialWebsite(url) {
    // Simple heuristics - in real implementation, this could be more sophisticated
    const commercialIndicators = [
      'shop', 'store', 'buy', 'purchase', 'cart', 'checkout',
      'price', 'payment', 'billing', 'subscription', 'premium'
    ];
    
    // For now, assume commercial if not clearly non-commercial
    const nonCommercialIndicators = [
      'blog', 'personal', 'portfolio', 'github', 'nonprofit',
      '.edu', '.org', 'open source', 'free'
    ];
    
    const urlLower = url.toLowerCase();
    const hasNonCommercial = nonCommercialIndicators.some(indicator => 
      urlLower.includes(indicator)
    );
    
    return !hasNonCommercial; // Default to commercial unless clearly non-commercial
  }

  /**
   * Check if attribution notice exists
   */
  async hasAttributionNotice(url, font) {
    // In real implementation, this would check the page content for attribution
    // For now, return false to be safe
    return false;
  }

  /**
   * Suggest font alternatives
   */
  suggestAlternatives(font) {
    const alternatives = [];
    const fontFamily = font.family.toLowerCase();

    // Suggest Google Fonts alternatives
    const suggestions = {
      'helvetica': ['Open Sans', 'Source Sans Pro', 'Roboto'],
      'arial': ['Open Sans', 'Lato', 'Source Sans Pro'],
      'times': ['Merriweather', 'Playfair Display', 'Crimson Text'],
      'georgia': ['Merriweather', 'Lora', 'Crimson Text'],
      'futura': ['Montserrat', 'Raleway', 'Nunito Sans'],
      'proxima nova': ['Montserrat', 'Source Sans Pro', 'Open Sans'],
      'brandon grotesque': ['Oswald', 'Raleway', 'Montserrat']
    };

    for (const [original, alts] of Object.entries(suggestions)) {
      if (fontFamily.includes(original)) {
        alternatives.push(...alts.map(alt => ({
          family: alt,
          source: 'Google Fonts',
          license: 'Open Font License (OFL)',
          reason: `Free alternative to ${font.family}`,
          similarity: 'high'
        })));
        break;
      }
    }

    // If no specific alternatives found, suggest general safe alternatives
    if (alternatives.length === 0) {
      alternatives.push(
        {
          family: 'Open Sans',
          source: 'Google Fonts',
          license: 'Open Font License (OFL)',
          reason: 'Versatile, highly readable sans-serif',
          similarity: 'medium'
        },
        {
          family: 'Merriweather',
          source: 'Google Fonts',
          license: 'Open Font License (OFL)',
          reason: 'Professional serif alternative',
          similarity: 'medium'
        }
      );
    }

    return alternatives.slice(0, 3); // Return top 3 alternatives
  }

  /**
   * Assess font risk level
   */
  assessFontRiskLevel(analysis) {
    if (analysis.violations.length === 0) {
      return 'low';
    }

    const highRiskViolations = analysis.violations.filter(v => v.severity === 'high');
    if (highRiskViolations.length > 0) {
      return 'high';
    }

    return 'medium';
  }

  /**
   * Calculate compliance score
   */
  calculateComplianceScore(analysis) {
    if (analysis.summary.total === 0) return 100;

    const compliantFonts = analysis.summary.free + 
      (analysis.fonts.filter(f => 
        f.category === 'commercial' && f.violations.length === 0
      ).length);

    return Math.round((compliantFonts / analysis.summary.total) * 100);
  }

  /**
   * Assess legal risk
   */
  assessLegalRisk(analysis) {
    if (analysis.summary.violations === 0) {
      return 'low';
    }

    const highRiskViolations = analysis.violations.filter(v => 
      v.severity === 'high' && (v.type === 'web-use' || v.type === 'commercial-use')
    );

    if (highRiskViolations.length > 0) {
      return 'high';
    }

    if (analysis.summary.violations > analysis.summary.total * 0.5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate licensing recommendations
   */
  generateLicensingRecommendations(analysis) {
    const recommendations = [];

    // High-priority violations
    if (analysis.summary.violations > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Address font licensing violations',
        description: `${analysis.summary.violations} fonts may have licensing issues`,
        actions: [
          'Review font licenses for web use permissions',
          'Consider switching to Google Fonts for safer licensing',
          'Purchase appropriate commercial licenses if needed'
        ]
      });
    }

    // Unknown fonts
    if (analysis.summary.unknown > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Verify unknown font licenses',
        description: `${analysis.summary.unknown} fonts have unknown licensing`,
        actions: [
          'Research licensing for unknown fonts',
          'Replace with known free fonts if licensing unclear',
          'Document font licensing for compliance records'
        ]
      });
    }

    // Commercial fonts without proper licensing
    const commercialViolations = analysis.fonts.filter(f => 
      f.category === 'commercial' && f.violations.length > 0
    );
    if (commercialViolations.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Purchase commercial font licenses',
        description: 'Commercial fonts detected without proper web licensing',
        actions: [
          'Purchase web font licenses from font foundries',
          'Consider font subscription services',
          'Replace with free alternatives if budget constrained'
        ]
      });
    }

    // Attribution requirements
    const attributionNeeded = analysis.violations.filter(v => v.type === 'attribution');
    if (attributionNeeded.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Add required font attribution',
        description: 'Some fonts require attribution notices',
        actions: [
          'Add attribution notices to website footer',
          'Include font credits in colophon page',
          'Ensure attribution meets license requirements'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Get licensing summary for display
   */
  async getLicensingSummary(fonts, url) {
    try {
      const analysis = await this.analyzeFontLicensing(fonts, url);
      
      return {
        complianceScore: analysis.complianceScore,
        legalRisk: analysis.legalRisk,
        totalFonts: analysis.summary.total,
        violations: analysis.summary.violations,
        breakdown: {
          free: analysis.summary.free,
          commercial: analysis.summary.commercial,
          restricted: analysis.summary.restricted,
          unknown: analysis.summary.unknown
        },
        topRecommendations: analysis.recommendations.slice(0, 3)
      };
    } catch (error) {
      logger.error('Error generating licensing summary:', error);
      return {
        complianceScore: 0,
        legalRisk: 'unknown',
        error: 'Licensing analysis failed'
      };
    }
  }

  /**
   * Get error result
   */
  getErrorResult(error) {
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      summary: {
        total: 0,
        commercial: 0,
        free: 0,
        restricted: 0,
        unknown: 0,
        violations: 0
      },
      complianceScore: 0,
      legalRisk: 'unknown',
      recommendations: [{
        priority: 'high',
        title: 'Licensing analysis failed',
        description: 'Could not complete font licensing analysis',
        actions: ['Retry analysis', 'Manual license review recommended']
      }]
    };
  }
}

module.exports = new FontLicensingDetector();