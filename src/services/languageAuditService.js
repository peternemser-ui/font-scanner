/**
 * Language Audit Service
 * Analyzes pages for proper internationalization (i18n) configuration
 * Checks html lang, hreflang tags, Content-Language headers, and language consistency
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { createLogger } = require('../utils/logger');

const logger = createLogger('LanguageAuditService');

// Valid BCP 47 language codes (common ones)
const VALID_LANGUAGE_CODES = new Set([
  'en', 'en-US', 'en-GB', 'en-AU', 'en-CA',
  'es', 'es-ES', 'es-MX', 'es-AR',
  'fr', 'fr-FR', 'fr-CA',
  'de', 'de-DE', 'de-AT', 'de-CH',
  'pt', 'pt-BR', 'pt-PT',
  'it', 'it-IT',
  'nl', 'nl-NL',
  'ru', 'ru-RU',
  'zh', 'zh-CN', 'zh-TW', 'zh-Hans', 'zh-Hant',
  'ja', 'ja-JP',
  'ko', 'ko-KR',
  'ar', 'ar-SA',
  'hi', 'hi-IN',
  'pl', 'pl-PL',
  'tr', 'tr-TR',
  'vi', 'vi-VN',
  'th', 'th-TH',
  'sv', 'sv-SE',
  'da', 'da-DK',
  'fi', 'fi-FI',
  'no', 'nb', 'nn', 'no-NO',
  'cs', 'cs-CZ',
  'el', 'el-GR',
  'he', 'he-IL',
  'hu', 'hu-HU',
  'id', 'id-ID',
  'ms', 'ms-MY',
  'ro', 'ro-RO',
  'sk', 'sk-SK',
  'uk', 'uk-UA'
]);

// BCP 47 language code pattern
const BCP47_PATTERN = /^[a-z]{2,3}(-[A-Z]{2}|-[A-Za-z]{4}|-[A-Z][a-z]{3})?$/;

class LanguageAuditService {
  /**
   * Audit a URL for language/i18n configuration
   * @param {string} url - URL to audit
   * @returns {Promise<Object>} Audit results with score and issues
   */
  async audit(url) {
    logger.info(`Language audit: analyzing ${url}`);
    const startTime = Date.now();

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        validateStatus: status => status < 500
      });

      const $ = cheerio.load(response.data);
      const issues = [];
      const checks = {};

      // Check 1: HTML lang attribute
      const htmlLangCheck = this.checkHtmlLang($);
      checks.htmlLang = htmlLangCheck;
      if (htmlLangCheck.issues) {
        issues.push(...htmlLangCheck.issues);
      }

      // Check 2: Content-Language header
      const contentLangCheck = this.checkContentLanguageHeader(response.headers);
      checks.contentLanguage = contentLangCheck;
      if (contentLangCheck.issues) {
        issues.push(...contentLangCheck.issues);
      }

      // Check 3: Hreflang tags
      const hreflangCheck = this.checkHreflang($);
      checks.hreflang = hreflangCheck;
      if (hreflangCheck.issues) {
        issues.push(...hreflangCheck.issues);
      }

      // Check 4: Meta language tags
      const metaLangCheck = this.checkMetaLanguageTags($);
      checks.metaLanguage = metaLangCheck;
      if (metaLangCheck.issues) {
        issues.push(...metaLangCheck.issues);
      }

      // Check 5: Language consistency
      const consistencyCheck = this.checkLanguageConsistency(checks);
      checks.consistency = consistencyCheck;
      if (consistencyCheck.issues) {
        issues.push(...consistencyCheck.issues);
      }

      // Check 6: Direction (dir) attribute for RTL languages
      const dirCheck = this.checkDirAttribute($, checks.htmlLang.value);
      checks.direction = dirCheck;
      if (dirCheck.issues) {
        issues.push(...dirCheck.issues);
      }

      // Calculate score
      const score = this.calculateScore(checks, issues);

      const auditTime = Date.now() - startTime;
      logger.info(`Language audit completed in ${auditTime}ms with score ${score}`);

      return {
        url,
        score,
        grade: this.getGrade(score),
        issues,
        checks,
        recommendations: this.generateRecommendations(checks, issues),
        auditTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Language audit error:', error.message);
      throw new Error(`Could not audit URL: ${error.message}`);
    }
  }

  /**
   * Check HTML lang attribute
   */
  checkHtmlLang($) {
    const htmlElement = $('html');
    const langAttr = htmlElement.attr('lang');
    const xmlLang = htmlElement.attr('xml:lang');

    const result = {
      present: !!langAttr,
      value: langAttr || null,
      xmlLang: xmlLang || null,
      valid: false,
      issues: []
    };

    if (!langAttr) {
      result.issues.push({
        code: 'MISSING_HTML_LANG',
        severity: 'critical',
        message: 'Missing html lang attribute',
        description: 'The <html> element should have a lang attribute to specify the page language.',
        recommendation: 'Add lang="en" (or appropriate language code) to your <html> tag.'
      });
      return result;
    }

    // Validate language code
    if (!this.isValidLanguageCode(langAttr)) {
      result.issues.push({
        code: 'INVALID_HTML_LANG',
        severity: 'high',
        message: `Invalid html lang value: "${langAttr}"`,
        description: 'The lang attribute value does not match BCP 47 format.',
        recommendation: `Use a valid BCP 47 language code like "en", "en-US", "es", etc.`
      });
    } else {
      result.valid = true;
    }

    // Check xml:lang consistency
    if (xmlLang && xmlLang !== langAttr) {
      result.issues.push({
        code: 'MISMATCHED_XML_LANG',
        severity: 'medium',
        message: `xml:lang (${xmlLang}) differs from lang (${langAttr})`,
        description: 'When both lang and xml:lang are present, they should have the same value.',
        recommendation: 'Ensure lang and xml:lang attributes have identical values.'
      });
    }

    return result;
  }

  /**
   * Check Content-Language HTTP header
   */
  checkContentLanguageHeader(headers) {
    const contentLang = headers['content-language'];

    const result = {
      present: !!contentLang,
      value: contentLang || null,
      valid: false,
      issues: []
    };

    if (!contentLang) {
      // This is informational, not critical
      result.issues.push({
        code: 'MISSING_CONTENT_LANGUAGE_HEADER',
        severity: 'info',
        message: 'No Content-Language HTTP header',
        description: 'The Content-Language header helps browsers and crawlers understand the page language.',
        recommendation: 'Consider adding a Content-Language header to your server responses.'
      });
      return result;
    }

    // Validate
    const langCode = contentLang.split(',')[0].trim();
    if (!this.isValidLanguageCode(langCode)) {
      result.issues.push({
        code: 'INVALID_CONTENT_LANGUAGE',
        severity: 'medium',
        message: `Invalid Content-Language header value: "${contentLang}"`,
        description: 'The Content-Language header should contain valid BCP 47 language codes.',
        recommendation: 'Use valid BCP 47 language codes in the Content-Language header.'
      });
    } else {
      result.valid = true;
    }

    return result;
  }

  /**
   * Check hreflang tags for multilingual sites
   */
  checkHreflang($) {
    const hreflangTags = $('link[rel="alternate"][hreflang]');
    const tags = [];
    const result = {
      present: hreflangTags.length > 0,
      count: hreflangTags.length,
      tags: [],
      hasXDefault: false,
      hasSelfReference: false,
      issues: []
    };

    if (hreflangTags.length === 0) {
      // Not having hreflang is only an issue if you have multilingual content
      result.issues.push({
        code: 'NO_HREFLANG_TAGS',
        severity: 'info',
        message: 'No hreflang tags found',
        description: 'Hreflang tags help search engines serve the correct language version to users.',
        recommendation: 'If you have multilingual content, add hreflang tags for each language version.'
      });
      return result;
    }

    hreflangTags.each((i, elem) => {
      const hreflang = $(elem).attr('hreflang');
      const href = $(elem).attr('href');

      const tag = {
        hreflang,
        href,
        valid: hreflang === 'x-default' || this.isValidLanguageCode(hreflang)
      };

      tags.push(tag);

      if (hreflang === 'x-default') {
        result.hasXDefault = true;
      }

      if (!tag.valid) {
        result.issues.push({
          code: 'INVALID_HREFLANG',
          severity: 'medium',
          message: `Invalid hreflang value: "${hreflang}"`,
          description: 'Hreflang values must be valid BCP 47 language codes or "x-default".',
          recommendation: `Fix the hreflang value for ${href}`
        });
      }

      if (!href) {
        result.issues.push({
          code: 'MISSING_HREFLANG_HREF',
          severity: 'high',
          message: `Hreflang tag for "${hreflang}" missing href attribute`,
          description: 'Each hreflang tag must have a valid href pointing to the alternate language version.',
          recommendation: 'Add the href attribute with the full URL of the alternate version.'
        });
      }
    });

    result.tags = tags;

    // Check for x-default
    if (tags.length > 1 && !result.hasXDefault) {
      result.issues.push({
        code: 'MISSING_X_DEFAULT',
        severity: 'medium',
        message: 'Missing x-default hreflang',
        description: 'When using multiple hreflang tags, you should include x-default for fallback.',
        recommendation: 'Add <link rel="alternate" hreflang="x-default" href="..."> for the default version.'
      });
    }

    return result;
  }

  /**
   * Check meta language tags
   */
  checkMetaLanguageTags($) {
    const ogLocale = $('meta[property="og:locale"]').attr('content');
    const ogLocaleAlternate = $('meta[property="og:locale:alternate"]').map((i, el) => $(el).attr('content')).get();
    const dcLanguage = $('meta[name="DC.language"]').attr('content') || $('meta[name="dc.language"]').attr('content');

    const result = {
      ogLocale: ogLocale || null,
      ogLocaleAlternate: ogLocaleAlternate,
      dcLanguage: dcLanguage || null,
      issues: []
    };

    // Check og:locale format (should be language_TERRITORY like en_US)
    if (ogLocale) {
      const ogLocalePattern = /^[a-z]{2}_[A-Z]{2}$/;
      if (!ogLocalePattern.test(ogLocale)) {
        result.issues.push({
          code: 'INVALID_OG_LOCALE',
          severity: 'low',
          message: `og:locale format may be incorrect: "${ogLocale}"`,
          description: 'Open Graph locale should use format like "en_US", "es_ES", etc.',
          recommendation: 'Update og:locale to use underscore format (e.g., en_US).'
        });
      }
    }

    return result;
  }

  /**
   * Check language consistency across all signals
   */
  checkLanguageConsistency(checks) {
    const result = {
      consistent: true,
      languages: [],
      issues: []
    };

    const detectedLanguages = new Set();

    // Collect all detected languages
    if (checks.htmlLang.value) {
      const baseLang = checks.htmlLang.value.split('-')[0].toLowerCase();
      detectedLanguages.add(baseLang);
    }

    if (checks.contentLanguage.value) {
      const baseLang = checks.contentLanguage.value.split(',')[0].split('-')[0].trim().toLowerCase();
      detectedLanguages.add(baseLang);
    }

    if (checks.metaLanguage.ogLocale) {
      const baseLang = checks.metaLanguage.ogLocale.split('_')[0].toLowerCase();
      detectedLanguages.add(baseLang);
    }

    result.languages = Array.from(detectedLanguages);

    // Check for inconsistency
    if (detectedLanguages.size > 1) {
      result.consistent = false;
      result.issues.push({
        code: 'INCONSISTENT_LANGUAGE_SIGNALS',
        severity: 'high',
        message: `Multiple languages detected: ${result.languages.join(', ')}`,
        description: 'The html lang, Content-Language header, and og:locale should all indicate the same language.',
        recommendation: 'Ensure all language signals are consistent and match your page content.'
      });
    }

    return result;
  }

  /**
   * Check dir attribute for RTL languages
   */
  checkDirAttribute($, langValue) {
    const result = {
      present: false,
      value: null,
      needsRTL: false,
      issues: []
    };

    if (!langValue) return result;

    const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'yi', 'ps', 'sd'];
    const baseLang = langValue.split('-')[0].toLowerCase();

    result.needsRTL = rtlLanguages.includes(baseLang);

    const dirAttr = $('html').attr('dir');
    result.present = !!dirAttr;
    result.value = dirAttr || null;

    if (result.needsRTL && dirAttr !== 'rtl') {
      result.issues.push({
        code: 'MISSING_RTL_DIR',
        severity: 'high',
        message: `RTL language (${baseLang}) detected but dir attribute is not "rtl"`,
        description: 'Right-to-left languages require dir="rtl" on the html element for proper text rendering.',
        recommendation: 'Add dir="rtl" to your <html> tag for RTL languages.'
      });
    }

    return result;
  }

  /**
   * Validate a language code against BCP 47
   */
  isValidLanguageCode(code) {
    if (!code) return false;

    // Check against known codes first
    if (VALID_LANGUAGE_CODES.has(code)) {
      return true;
    }

    // Check pattern match for less common codes
    return BCP47_PATTERN.test(code);
  }

  /**
   * Calculate overall score (0-100)
   */
  calculateScore(checks, issues) {
    let score = 100;

    // Deduct points based on issue severity
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
        case 'info':
          score -= 2;
          break;
      }
    }

    // Bonus points
    if (checks.htmlLang.present && checks.htmlLang.valid) {
      score += 5;
    }
    if (checks.hreflang.present && checks.hreflang.hasXDefault) {
      score += 5;
    }
    if (checks.consistency.consistent) {
      score += 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get letter grade from score
   */
  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations based on issues
   */
  generateRecommendations(checks, issues) {
    const recommendations = [];

    // Priority recommendations
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');

    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Add HTML lang attribute',
        description: 'Every page must have a lang attribute on the <html> element.',
        example: '<html lang="en">'
      });
    }

    if (!checks.hreflang.present && highIssues.length === 0) {
      recommendations.push({
        priority: 'optional',
        title: 'Consider adding hreflang for multilingual SEO',
        description: 'If you plan to add translated versions of your content, hreflang tags help search engines serve the right version.',
        example: '<link rel="alternate" hreflang="es" href="https://example.com/es/page">'
      });
    }

    if (!checks.contentLanguage.present) {
      recommendations.push({
        priority: 'low',
        title: 'Add Content-Language header',
        description: 'Set the Content-Language HTTP header for additional language clarity.',
        example: 'Content-Language: en-US'
      });
    }

    return recommendations;
  }
}

module.exports = new LanguageAuditService();
