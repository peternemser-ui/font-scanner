/**
 * PDF Report — Shared Rendering Engine
 * Provides cover page, TOC, executive summary, and utility renderers
 * for all PDF report templates.
 *
 * Usage:
 *   1. Include this script in the PDF template HTML
 *   2. Call PdfReport.register(reportType, renderFn) from the report-specific script
 *   3. Call PdfReport.init() after DOM is ready
 *   4. Sets window.__PDF_READY__ = true when rendering is complete
 */
(function (window, document) {
  'use strict';

  /* ---------------------------------------------------------------------------
     Helpers
     --------------------------------------------------------------------------- */

  /** Translation helper — uses page's i18n if available */
  function t(key, fallback, params) {
    let val = fallback;
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key);
      if (translated && translated !== key) val = translated;
    }
    if (params && typeof val === 'string') {
      Object.keys(params).forEach(function (p) {
        val = val.replace(new RegExp('\\{\\{' + p + '\\}\\}', 'g'), params[p]);
      });
    }
    return val;
  }

  /** Score → color class */
  function scoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  /** Score → hex color */
  function scoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 65) return '#22c55e';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  }

  /** Score → letter grade */
  function scoreGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /** Format date for current locale */
  function formatDate(date, lang) {
    const localeMap = {
      ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR', de: 'de-DE',
      fr: 'fr-FR', es: 'es-ES', pt: 'pt-BR', ru: 'ru-RU'
    };
    return date.toLocaleDateString(localeMap[lang] || 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  }

  /** Insert <wbr> at "/" and "-" for URL wrapping */
  function wrapUrl(url) {
    return (url || '').replace(/([/\-])/g, '$1<wbr>');
  }

  /** Escape HTML */
  function esc(str) {
    if (!str) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  /** Truncate string */
  function truncate(str, maxLen) {
    if (!str) return '';
    str = String(str);
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
  }

  /* ---------------------------------------------------------------------------
     REPORT LABEL MAP (resolved via i18n at render time)
     --------------------------------------------------------------------------- */
  function getReportLabel(reportType) {
    var labelKeys = {
      seo: t('common.pdf.reportLabel.seo', 'SEO'),
      cro: t('common.pdf.reportLabel.cro', 'CRO'),
      gdpr: t('common.pdf.reportLabel.gdpr', 'GDPR'),
      cwv: t('common.pdf.reportLabel.cwv', 'CWV'),
      security: t('common.pdf.reportLabel.security', 'Security'),
      performance: t('common.pdf.reportLabel.performance', 'Performance'),
      accessibility: t('common.pdf.reportLabel.accessibility', 'Accessibility'),
      fonts: t('common.pdf.reportLabel.fonts', 'Fonts'),
      'tag-intelligence': t('common.pdf.reportLabel.tag-intelligence', 'Tag Intelligence'),
      'enhanced-fonts': t('common.pdf.reportLabel.enhanced-fonts', 'Enhanced Fonts'),
      'brand-consistency': t('common.pdf.reportLabel.brand-consistency', 'Brand Consistency'),
      'broken-links': t('common.pdf.reportLabel.broken-links', 'Broken Links'),
      'ip-reputation': t('common.pdf.reportLabel.ip-reputation', 'IP Reputation'),
      'local-seo': t('common.pdf.reportLabel.local-seo', 'Local SEO'),
      'mobile-analyzer': t('common.pdf.reportLabel.mobile-analyzer', 'Mobile'),
      competitive: t('common.pdf.reportLabel.competitive', 'Competitive'),
      'hosting-analyzer': t('common.pdf.reportLabel.hosting', 'Hosting'),
      'site-crawler': t('common.pdf.reportLabel.site-crawler', 'Site Crawler'),
      'core-web-vitals': t('common.pdf.reportLabel.core-web-vitals', 'Core Web Vitals')
    };
    return labelKeys[reportType] || reportType;
  }

  /** Translate impact level */
  function translateImpact(impact) {
    var impactLabels = {
      critical: t('common.pdf.impact.critical', 'Critical'),
      serious: t('common.pdf.impact.serious', 'Serious'),
      moderate: t('common.pdf.impact.moderate', 'Moderate'),
      minor: t('common.pdf.impact.minor', 'Minor')
    };
    return impactLabels[(impact || '').toLowerCase()] || impact;
  }

  /** Translate status value */
  function translateStatus(status) {
    var statusLabels = {
      pass: t('common.pdf.status.pass', 'Pass'),
      fail: t('common.pdf.status.fail', 'Fail'),
      optimal: t('common.pdf.status.optimal', 'Optimal'),
      review: t('common.pdf.status.review', 'Review'),
      missing: t('common.pdf.status.missing', 'Missing'),
      warning: t('common.pdf.status.warning', 'Warning'),
      good: t('common.pdf.status.good', 'Good'),
      configured: t('common.pdf.status.configured', 'Configured'),
      'not configured': t('common.pdf.status.notConfigured', 'Not Configured')
    };
    return statusLabels[(status || '').toLowerCase()] || status;
  }

  /* ---------------------------------------------------------------------------
     PdfReport API
     --------------------------------------------------------------------------- */
  var _renderer = null;
  var _reportType = '';
  var _lang = 'en';

  var PdfReport = {

    /** Register a report-specific renderer */
    register: function (reportType, renderFn) {
      _renderer = renderFn;
      _reportType = reportType;
    },

    /** Main initialization — call after DOMContentLoaded + i18n ready */
    init: async function () {
      var params = new URLSearchParams(window.location.search);
      var reportId = params.get('report_id');
      _lang = params.get('locale') || document.documentElement.lang || 'en';
      document.documentElement.setAttribute('lang', _lang);

      // Wait for i18n
      if (window.i18n && !window.i18n.initialized) {
        await new Promise(function (resolve) {
          var check = setInterval(function () {
            if (window.i18n.initialized) { clearInterval(check); resolve(); }
          }, 50);
          setTimeout(function () { clearInterval(check); resolve(); }, 8000);
        });
      }

      // Load report data
      var reportData = null;
      if (window.ReportStorage) {
        var record = window.ReportStorage.loadReport(reportId);
        if (record && record.data) reportData = record.data;
      }
      // Fallback: check for injected global
      if (!reportData && window.__PDF_INJECT_DATA__) {
        reportData = window.__PDF_INJECT_DATA__;
      }

      if (!reportData) {
        console.error('[PdfReport] No report data available for', reportId);
        document.body.innerHTML = '<p style="padding:40px;text-align:center;color:#ef4444;">Report data unavailable. Please re-run the scan.</p>';
        window.__PDF_READY__ = true;
        return;
      }

      var reportLabel = getReportLabel(_reportType);
      var analyzedUrl = reportData.url || reportData.normalizedUrl || reportData.baseUrl || '';

      // Render shared pages
      this.renderCoverPage(reportData, reportLabel, analyzedUrl);
      this.renderExecSummary(reportData, reportLabel);

      // Call report-specific renderer
      if (typeof _renderer === 'function') {
        _renderer(reportData, { t: t, esc: esc, truncate: truncate, scoreClass: scoreClass, scoreColor: scoreColor, scoreGrade: scoreGrade, lang: _lang, translateImpact: translateImpact, translateStatus: translateStatus });
      }

      // Generate TOC from rendered sections
      this.renderTOC();

      // Signal ready
      console.log('[PdfReport] Rendering complete');
      window.__PDF_READY__ = true;
    },

    /* -------------------------------------------------------------------------
       Cover Page
       ------------------------------------------------------------------------- */
    renderCoverPage: function (data, reportLabel, analyzedUrl) {
      var el = document.getElementById('cover-page');
      if (!el) return;

      var overall = data.score ? data.score.overall
        : (data.overallScore || data.accessibilityScore || data.healthScore
           || data.performanceScore || data.mobileScore || (data.yourSite && data.yourSite.scores && data.yourSite.scores.overall) || null);
      var grade = data.score ? data.score.grade : (overall !== null ? scoreGrade(overall) : '');

      el.innerHTML =
        '<div class="pdf-cover__logo" id="cover-logo"></div>' +
        '<div class="pdf-cover__subtitle">' + esc(t('common.pdf.cover.subtitle', 'web diagnostics & performance analysis')) + '</div>' +
        '<h1 class="pdf-cover__title">' + esc(t('common.pdf.cover.reportTitle', '{{type}} Analysis Report', { type: reportLabel })) + '</h1>' +
        '<div class="pdf-cover__accent-bar"></div>' +
        '<div class="pdf-cover__url">' + wrapUrl(analyzedUrl) + '</div>' +
        '<div class="pdf-cover__meta">' +
          '<div>' + formatDate(new Date(), _lang) + '</div>' +
        '</div>' +
        (overall !== null ? (
          '<div class="pdf-cover__score-box">' +
            '<div class="pdf-cover__score-label">' + esc(t('common.pdf.cover.overallScore', 'Overall Score')) + '</div>' +
            '<div class="pdf-cover__score-value score-' + scoreClass(overall) + '">' +
              overall + '<span class="pdf-cover__score-max">/100</span>' +
            '</div>' +
            (grade ? '<div class="pdf-cover__score-hero-grade" style="color:' + scoreColor(overall) + ';">' + t('common.grade', 'Grade') + ': ' + grade + '</div>' : '') +
          '</div>'
        ) : '');

      // Load logo SVG
      this._loadLogo(document.getElementById('cover-logo'));
    },

    /* -------------------------------------------------------------------------
       Table of Contents (generated from rendered sections)
       ------------------------------------------------------------------------- */
    renderTOC: function () {
      var el = document.getElementById('toc-page');
      if (!el) return;

      // Calculate page numbers based on section heights.
      // A4 content area: viewport 900px maps to 186mm width (A4 210 - 12 - 12 margins).
      // Content height per page: 269mm (A4 297 - 12 top - 16 bottom).
      // In viewport px: 269mm / (186mm / 900px) = 269 * (900/186) ≈ 1302px per page.
      var PAGE_HEIGHT = 1300;

      // Fixed pages: Cover (1), TOC (2), Exec Summary (3)
      var currentPage = 4;

      var sections = document.querySelectorAll('.pdf-section');
      var tocEntries = [];

      sections.forEach(function (sec) {
        var header = sec.querySelector('.pdf-section__title');
        if (!header) return;
        var text = header.textContent.trim();
        if (!text) return;

        // Only count visible sections
        if (sec.style.display === 'none') return;

        tocEntries.push({ text: text, page: currentPage });

        // Estimate how many pages this section spans
        var h = sec.scrollHeight || 0;
        var pages = Math.max(1, Math.ceil(h / PAGE_HEIGHT));
        currentPage += pages;
      });

      // Also add fixed pages to the TOC
      var html = '<h2 class="pdf-toc__heading">' + esc(t('common.pdf.toc.title', 'Table of Contents')) + '</h2>';
      html += '<ul class="pdf-toc__list">';

      // Executive Summary entry
      html +=
        '<li class="pdf-toc__item pdf-toc__item--h2">' +
          '<span class="pdf-toc__number"></span>' +
          '<span class="pdf-toc__label">' + esc(t('common.pdf.execSummary.title', 'Executive Summary')) + '</span>' +
          '<span class="pdf-toc__dots"></span>' +
          '<span class="pdf-toc__page">3</span>' +
        '</li>';

      // Section entries
      tocEntries.forEach(function (entry, i) {
        html +=
          '<li class="pdf-toc__item pdf-toc__item--h2">' +
            '<span class="pdf-toc__number">' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span class="pdf-toc__label">' + esc(entry.text) + '</span>' +
            '<span class="pdf-toc__dots"></span>' +
            '<span class="pdf-toc__page">' + entry.page + '</span>' +
          '</li>';
      });

      html += '</ul>';
      el.innerHTML = html;
    },

    /* -------------------------------------------------------------------------
       Executive Summary
       ------------------------------------------------------------------------- */
    renderExecSummary: function (data, reportLabel) {
      var el = document.getElementById('exec-summary');
      if (!el) return;

      var overall = data.score ? data.score.overall
        : (data.overallScore || data.accessibilityScore || data.healthScore || data.performanceScore || 0);
      var grade = data.score ? data.score.grade : scoreGrade(overall);

      var html = '<h2 class="pdf-exec__heading">' + esc(t('common.pdf.execSummary.title', 'Executive Summary')) + '</h2>';

      // Overall score hero
      html +=
        '<div class="pdf-exec__score-hero">' +
          '<div class="pdf-exec__score-hero-value score-' + scoreClass(overall) + '">' +
            overall + '<span class="pdf-exec__score-hero-max">/100</span>' +
          '</div>' +
          '<div class="pdf-exec__score-hero-grade" style="color:' + scoreColor(overall) + ';">' +
            t('common.grade', 'Grade') + ': ' + grade +
          '</div>' +
          '<div class="pdf-exec__score-hero-label">' + esc(t('common.pdf.cover.overallScore', 'Overall Score')) + '</div>' +
        '</div>';

      // --- CATEGORY_CONFIGS per report type ---
      var CATEGORY_CONFIGS = {
        seo: {
          categories: {
            metaTags: t('seo.sections.metaTags', 'Meta Tags'),
            headingStructure: t('seo.sections.headings', 'Headings'),
            contentAnalysis: t('seo.sections.content', 'Content'),
            imageAnalysis: t('seo.sections.images', 'Images'),
            linkAnalysis: t('seo.sections.links', 'Links'),
            mobileResponsive: t('seo.sections.mobile', 'Mobile'),
            structuredData: t('seo.sections.structuredData', 'Structured Data'),
            additionalChecks: t('seo.sections.additional', 'Additional Checks')
          },
          sectionKeys: ['metaTags', 'headingStructure', 'contentAnalysis', 'imageAnalysis',
                         'linkAnalysis', 'mobileResponsive', 'structuredData', 'additionalChecks'],
          hiddenBreakdown: ['performanceMetrics', 'securityHeaders']
        },
        security: {
          categories: {
            ssl: t('security.sslTlsSecurity', 'SSL/TLS Security'),
            headers: t('security.headers', 'Security Headers'),
            vulnerabilities: t('security.vulnerabilities', 'Vulnerabilities'),
            cookies: t('security.cookies', 'Cookie Security'),
            thirdPartyScripts: t('security.thirdParty', 'Third-Party Scripts')
          },
          sectionKeys: ['ssl', 'headers', 'vulnerabilities', 'cookies', 'thirdPartyScripts'],
          hiddenBreakdown: []
        },
        accessibility: {
          categories: {
            wcag: t('accessibility.wcagCompliance', 'WCAG Compliance'),
            contrast: t('accessibility.colorContrast', 'Color Contrast'),
            keyboard: t('accessibility.keyboardNav', 'Keyboard Navigation'),
            aria: t('accessibility.ariaLabels', 'ARIA & Semantics')
          },
          sectionKeys: ['contrast', 'keyboard', 'aria'],
          hiddenBreakdown: []
        },
        performance: {
          categories: {
            coreWebVitals: t('performance.coreWebVitals', 'Core Web Vitals'),
            resources: t('performance.resourceAnalysis', 'Resource Analysis'),
            network: t('performance.networkPerformance', 'Network Performance'),
            caching: t('performance.cachingOptimization', 'Caching & Optimization')
          },
          sectionKeys: ['coreWebVitals', 'resources', 'network', 'caching'],
          hiddenBreakdown: []
        },
        fonts: {
          categories: {
            fontDelivery: t('fonts.fontDelivery', 'Font Delivery'),
            fallbackStability: t('fonts.fallbackLayoutStability', 'Fallback & Stability'),
            performance: t('fonts.fontLoadingPerformance', 'Loading Performance')
          },
          sectionKeys: ['fontDelivery', 'fallbackStability', 'performance'],
          hiddenBreakdown: []
        },
        'tag-intelligence': {
          categories: {
            performanceImpact: t('tagIntelligence.scriptPerformanceImpact', 'Script Performance'),
            cookies: t('tagIntelligence.cookieAudit', 'Cookie Audit'),
            dataLayer: t('tagIntelligence.dataLayerAnalysis', 'DataLayer Analysis'),
            thirdPartyScripts: t('tagIntelligence.thirdPartyScripts', 'Third-Party Scripts')
          },
          sectionKeys: ['tags', 'issues', 'performanceImpact', 'cookies', 'thirdPartyScripts', 'dataLayer'],
          hiddenBreakdown: []
        },
        hosting: {
          categories: {
            hosting: t('hosting.hostingInfrastructure', 'Hosting & Infrastructure'),
            cms: t('hosting.cmsTechnology', 'CMS & Technology'),
            performance: t('hosting.hostingPerformance', 'Hosting Performance')
          },
          sectionKeys: ['hosting', 'cms'],
          hiddenBreakdown: []
        },
        'core-web-vitals': {
          categories: {
            desktop: t('cwv.desktop', 'Desktop'),
            mobile: t('cwv.mobile', 'Mobile')
          },
          sectionKeys: ['desktop', 'mobile'],
          hiddenBreakdown: []
        },
        'ip-reputation': {
          categories: {
            reputation: t('ipReputation.ipReputation', 'IP Reputation'),
            security: t('ipReputation.securityAssessment', 'Security Assessment'),
            infrastructure: t('ipReputation.infrastructure', 'Infrastructure')
          },
          sectionKeys: ['reputation', 'security', 'infrastructure'],
          hiddenBreakdown: []
        },
        'broken-links': {
          categories: {
            broken: t('brokenLinks.brokenLinks', 'Broken Links'),
            redirects: t('brokenLinks.redirects', 'Redirects'),
            anchors: t('brokenLinks.anchorAnalysis', 'Anchor Analysis')
          },
          sectionKeys: ['broken', 'redirects', 'anchors'],
          hiddenBreakdown: []
        },
        'local-seo': {
          categories: {
            nap: t('localSeo.napConsistency', 'NAP Consistency'),
            schema: t('localSeo.schemaMarkup', 'Schema Markup'),
            presence: t('localSeo.localPresence', 'Local Presence')
          },
          sectionKeys: ['nap', 'schema', 'presence'],
          hiddenBreakdown: []
        },
        gdpr: {
          categories: {
            cookieConsent: t('gdpr.cookieConsent', 'Cookie Consent'),
            privacyPolicy: t('gdpr.privacyPolicy', 'Privacy Policy'),
            dataSubjectRights: t('gdpr.dataSubjectRights', 'Data Subject Rights'),
            cookies: t('gdpr.cookieAudit', 'Cookie Audit')
          },
          sectionKeys: ['cookieConsent', 'privacyPolicy', 'dataSubjectRights', 'cookies'],
          hiddenBreakdown: []
        },
        mobile: {
          categories: {
            performance: t('mobile.performance', 'Performance'),
            touchTargets: t('mobile.touchTargets', 'Touch Targets'),
            readability: t('mobile.readability', 'Readability'),
            responsiveness: t('mobile.responsiveness', 'Responsiveness')
          },
          sectionKeys: ['performance', 'touchTargets', 'readability', 'responsiveness'],
          hiddenBreakdown: []
        },
        cro: {
          categories: {
            cta: t('cro.callsToAction', 'Calls to Action'),
            form: t('cro.formAnalysis', 'Form Analysis'),
            trust: t('cro.trustSignals', 'Trust Signals'),
            mobile: t('cro.mobileUx', 'Mobile UX')
          },
          sectionKeys: ['cta', 'form', 'trust', 'mobile'],
          hiddenBreakdown: []
        },
        'site-crawler': {
          categories: {
            structure: t('siteCrawler.siteStructure', 'Site Structure'),
            pages: t('siteCrawler.pagesCrawled', 'Pages Crawled'),
            issues: t('siteCrawler.issuesDetected', 'Issues Detected')
          },
          sectionKeys: ['structure', 'pages', 'issues'],
          hiddenBreakdown: []
        },
        'brand-consistency': {
          categories: {
            consistency: t('brandConsistency.consistency', 'Consistency'),
            colorAnalysis: t('brandConsistency.colorAnalysis', 'Color Analysis'),
            typographyAnalysis: t('brandConsistency.typography', 'Typography')
          },
          sectionKeys: ['consistency', 'colorAnalysis', 'typographyAnalysis'],
          hiddenBreakdown: []
        },
        competitive: {
          categories: {
            seo: t('competitive.seo', 'SEO'),
            performance: t('competitive.performance', 'Performance'),
            security: t('competitive.security', 'Security'),
            accessibility: t('competitive.accessibility', 'Accessibility')
          },
          sectionKeys: ['seo', 'performance', 'security', 'accessibility'],
          hiddenBreakdown: []
        }
      };

      var config = CATEGORY_CONFIGS[_reportType] || CATEGORY_CONFIGS.seo;
      var categoryNameMap = config.categories;

      // Narrative paragraph
      var analyzedUrl = data.url || data.normalizedUrl || data.baseUrl || '';
      var shortUrl = analyzedUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');

      var narrativeKey;
      if (overall >= 80) narrativeKey = 'overallExcellent';
      else if (overall >= 60) narrativeKey = 'overallGood';
      else if (overall >= 40) narrativeKey = 'overallFair';
      else narrativeKey = 'overallPoor';

      // Find strongest and weakest from breakdown or data sub-objects
      var breakdownForNarrative = data.score ? data.score.breakdown : null;
      var strongest = null;
      var weakest = null;

      if (breakdownForNarrative) {
        Object.keys(breakdownForNarrative).forEach(function (key) {
          var cat = breakdownForNarrative[key];
          if (!cat || cat.score === undefined) return;
          if (!strongest || cat.score > strongest.score) strongest = { key: key, score: cat.score };
          if (!weakest || cat.score < weakest.score) weakest = { key: key, score: cat.score };
        });
      } else {
        // Build breakdown from data sub-objects with .score
        Object.keys(categoryNameMap).forEach(function (key) {
          var section = data[key];
          if (!section || section.score === undefined) return;
          if (!strongest || section.score > strongest.score) strongest = { key: key, score: section.score };
          if (!weakest || section.score < weakest.score) weakest = { key: key, score: section.score };
        });
      }

      // Count issues and passes
      var narrativeIssueCount = 0;
      var narrativePassCount = 0;
      var narrativeSectionKeys = config.sectionKeys;
      narrativeSectionKeys.forEach(function (key) {
        var section = data[key];
        if (!section) return;
        if (section.issues && section.issues.length > 0) narrativeIssueCount += section.issues.length;
        if (section.passed || (section.score !== undefined && section.score >= 80)) narrativePassCount++;
      });
      // Also count top-level issues/recommendations arrays
      if (data.issues && Array.isArray(data.issues)) narrativeIssueCount += data.issues.length;
      if (data.recommendations && Array.isArray(data.recommendations)) narrativeIssueCount += data.recommendations.length;

      var sentences = [];
      sentences.push(t('common.pdf.execSummary.narrative.' + narrativeKey,
        'The analysis resulted in an overall score of {{score}}/100 (Grade: {{grade}}).',
        { url: shortUrl, score: overall, grade: grade }));

      if (strongest) {
        sentences.push(t('common.pdf.execSummary.narrative.strongestArea',
          'The strongest performing area was {{category}} with a score of {{score}}/100.',
          { category: categoryNameMap[strongest.key] || strongest.key, score: strongest.score }));
      }
      if (weakest && (!strongest || weakest.key !== strongest.key)) {
        sentences.push(t('common.pdf.execSummary.narrative.weakestArea',
          'The area requiring the most attention is {{category}}, which scored {{score}}/100.',
          { category: categoryNameMap[weakest.key] || weakest.key, score: weakest.score }));
      }
      if (narrativeIssueCount > 0) {
        sentences.push(t('common.pdf.execSummary.narrative.issuesSummary',
          'The audit identified {{issueCount}} issues across {{categoryCount}} categories.',
          { issueCount: narrativeIssueCount, categoryCount: narrativeSectionKeys.length, passCount: narrativePassCount }));
      } else {
        sentences.push(t('common.pdf.execSummary.narrative.noIssues',
          'No critical issues were identified during this analysis.'));
      }
      if (weakest && narrativeIssueCount > 0) {
        sentences.push(t('common.pdf.execSummary.narrative.recommendation',
          'Priority should be given to improving {{category}}.',
          { category: categoryNameMap[weakest.key] || weakest.key }));
      }

      html += '<div class="pdf-exec__narrative" style="font-size:0.85rem;line-height:1.7;color:#374151;margin:20px 0 24px;text-align:justify;">' +
        '<p>' + sentences.map(esc).join(' ') + '</p>' +
      '</div>';

      // Page screenshot
      var screenshotUrl = data.screenshotUrl || '';
      if (!screenshotUrl && data.reportId) {
        screenshotUrl = '/reports/' + encodeURIComponent(data.reportId) + '/screenshot.jpg';
      }
      if (screenshotUrl) {
        html += '<div class="pdf-exec__screenshot">' +
          '<img src="' + esc(screenshotUrl) + '" alt="' + esc(t('common.pageScreenshot', 'Page screenshot')) + '" class="pdf-exec__screenshot-img" onerror="this.parentElement.style.display=\'none\'" />' +
        '</div>';
      }

      // Category breakdown grid
      var breakdown = data.score ? data.score.breakdown : null;
      var hiddenBreakdown = config.hiddenBreakdown || [];

      if (breakdown) {
        html += '<div class="pdf-exec__subheading">' + esc(t('common.pdf.execSummary.categoryBreakdown', 'Category Breakdown')) + '</div>';
        html += '<div class="pdf-score-grid">';
        Object.keys(breakdown).forEach(function (key) {
          if (hiddenBreakdown.indexOf(key) !== -1) return;
          var cat = breakdown[key];
          if (!cat || cat.score === undefined) return;
          var name = categoryNameMap[key] || key;
          html +=
            '<div class="pdf-score-card">' +
              '<div class="pdf-score-card__label">' + esc(name) + '</div>' +
              '<div class="pdf-score-card__value score-' + scoreClass(cat.score) + '">' + cat.score + '</div>' +
              (cat.weight ? '<div class="pdf-score-card__weight">' + cat.weight + '%</div>' : '') +
            '</div>';
        });
        html += '</div>';
      } else {
        // Build category grid from data sub-objects
        var hasAnyScore = false;
        Object.keys(categoryNameMap).forEach(function (key) {
          var section = data[key];
          if (section && section.score !== undefined) hasAnyScore = true;
        });
        if (hasAnyScore) {
          html += '<div class="pdf-exec__subheading">' + esc(t('common.pdf.execSummary.categoryBreakdown', 'Category Breakdown')) + '</div>';
          html += '<div class="pdf-score-grid">';
          Object.keys(categoryNameMap).forEach(function (key) {
            var section = data[key];
            if (!section || section.score === undefined) return;
            html +=
              '<div class="pdf-score-card">' +
                '<div class="pdf-score-card__label">' + esc(categoryNameMap[key]) + '</div>' +
                '<div class="pdf-score-card__value score-' + scoreClass(section.score) + '">' + section.score + '</div>' +
              '</div>';
          });
          html += '</div>';
        }
      }

      // Key findings
      var allIssues = [];
      var allPasses = [];
      config.sectionKeys.forEach(function (key) {
        var section = data[key];
        if (!section) return;
        if (section.issues && section.issues.length > 0) {
          section.issues.forEach(function (issue) {
            allIssues.push(typeof issue === 'string' ? issue
              : (issue.message || issue.title || issue.text
                 || ((issue.type || '') + (issue.description ? ' — ' + issue.description : ''))
                 || JSON.stringify(issue)));
          });
        }
        if (section.passed || (section.score !== undefined && section.score >= 80)) allPasses.push(key);
      });
      // Also gather top-level issues
      if (data.issues && Array.isArray(data.issues)) {
        data.issues.forEach(function (issue) {
          allIssues.push(typeof issue === 'string' ? issue : (issue.message || issue.title || issue.text || JSON.stringify(issue)));
        });
      }

      if (allIssues.length > 0 || allPasses.length > 0) {
        html += '<div class="pdf-exec__subheading">' + esc(t('common.pdf.execSummary.keyFindings', 'Key Findings')) + '</div>';
        html += '<ul class="pdf-findings-list">';

        allIssues.slice(0, 8).forEach(function (issue) {
          html +=
            '<li class="pdf-finding">' +
              '<span class="pdf-finding__icon pdf-finding__icon--warning">!</span>' +
              '<span class="pdf-finding__text">' + esc(issue) + '</span>' +
            '</li>';
        });
        if (allIssues.length > 8) {
          html +=
            '<li class="pdf-finding">' +
              '<span class="pdf-finding__icon pdf-finding__icon--info">+</span>' +
              '<span class="pdf-finding__text">' +
                t('seo.report.common.moreCount', '... {{count}} more', { count: allIssues.length - 8 }) +
              '</span>' +
            '</li>';
        }

        if (allPasses.length > 0) {
          allPasses.forEach(function (key) {
            html +=
              '<li class="pdf-finding">' +
                '<span class="pdf-finding__icon pdf-finding__icon--pass">\u2713</span>' +
                '<span class="pdf-finding__text">' + esc(categoryNameMap[key] || key) + ' — ' + t('common.pdf.status.pass', 'Pass') + '</span>' +
              '</li>';
          });
        }

        html += '</ul>';
      }

      // Summary stats
      html += '<div class="pdf-metrics-row" style="margin-top:20px;">';
      html += '<div class="pdf-metric">' +
        '<div class="pdf-metric__value">' + allIssues.length + '</div>' +
        '<div class="pdf-metric__label">' + esc(t('common.pdf.execSummary.issuesFound', 'Issues Found')) + '</div>' +
      '</div>';
      html += '<div class="pdf-metric">' +
        '<div class="pdf-metric__value">' + allPasses.length + '</div>' +
        '<div class="pdf-metric__label">' + esc(t('common.pdf.execSummary.passedChecks', 'Passed Checks')) + '</div>' +
      '</div>';
      html += '<div class="pdf-metric">' +
        '<div class="pdf-metric__value">' + config.sectionKeys.length + '</div>' +
        '<div class="pdf-metric__label">' + esc(t('common.pdf.execSummary.categoriesAnalyzed', 'Categories Analyzed')) + '</div>' +
      '</div>';
      html += '</div>';

      el.innerHTML = html;
    },

    /* -------------------------------------------------------------------------
       Utility Renderers (for use by report-specific scripts)
       ------------------------------------------------------------------------- */

    /** Render a data table */
    renderTable: function (headers, rows, opts) {
      opts = opts || {};
      var html = '<table class="pdf-table' + (opts.striped ? ' pdf-table--striped' : '') + '">';
      html += '<thead><tr>';
      headers.forEach(function (h) {
        html += '<th' + (h.width ? ' style="width:' + h.width + '"' : '') + '>' + esc(h.label) + '</th>';
      });
      html += '</tr></thead><tbody>';
      rows.forEach(function (row) {
        html += '<tr>';
        row.forEach(function (cell, i) {
          var cls = headers[i] && headers[i].cls ? ' class="' + headers[i].cls + '"' : '';
          html += '<td' + cls + '>' + (cell || '') + '</td>';
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      return html;
    },

    /** Render a status badge */
    renderStatus: function (status, label) {
      var cls = 'pdf-status pdf-status--';
      // Check negative/fail patterns FIRST to prevent "notFound" matching "found"
      if (/not\s*found|not\s*detected|not\s*configured|not\s*present|not\s*set|not\s*enabled|fail|missing|critical|\bno\b/i.test(status)) cls += 'fail';
      else if (/pass|optimal|valid|good|configured|present|set|found|detected|enabled|yes/i.test(status)) cls += 'pass';
      else if (/warn|review|fair|multiple/i.test(status)) cls += 'warn';
      else if (/info|none|na|n\/a/i.test(status)) cls += 'na';
      else cls += 'info';
      return '<span class="' + cls + '">' + esc(label || status) + '</span>';
    },

    /** Render a progress bar */
    renderProgress: function (label, value, max, color) {
      var pct = max > 0 ? Math.round((value / max) * 100) : 0;
      color = color || scoreColor(pct);
      return '<div class="pdf-progress">' +
        '<div class="pdf-progress__label-row">' +
          '<span class="pdf-progress__label">' + esc(label) + '</span>' +
          '<span class="pdf-progress__value">' + value + '/' + max + ' (' + pct + '%)</span>' +
        '</div>' +
        '<div class="pdf-progress__bar">' +
          '<div class="pdf-progress__fill" style="width:' + pct + '%;background:' + color + ';"></div>' +
        '</div>' +
      '</div>';
    },

    /** Render an issue card */
    renderIssue: function (text, severity) {
      severity = severity || 'info';
      var label = translateImpact(severity) || translateStatus(severity) || severity.toUpperCase();
      return '<div class="pdf-issue pdf-issue--' + severity + '">' +
        '<span class="pdf-issue__severity pdf-issue__severity--' + severity + '">' + label + '</span>' +
        '<span class="pdf-issue__text">' + esc(text) + '</span>' +
      '</div>';
    },

    /** Render a callout box */
    renderCallout: function (title, body, type) {
      type = type || 'tip';
      return '<div class="pdf-callout pdf-callout--' + type + '">' +
        '<div class="pdf-callout__title">' + esc(title) + '</div>' +
        '<div class="pdf-callout__body">' + esc(body) + '</div>' +
      '</div>';
    },

    /** Render a metrics row */
    renderMetrics: function (metrics) {
      var html = '<div class="pdf-metrics-row">';
      metrics.forEach(function (m) {
        html += '<div class="pdf-metric">' +
          '<div class="pdf-metric__value" style="' + (m.color ? 'color:' + m.color : '') + '">' + esc(String(m.value)) + '</div>' +
          '<div class="pdf-metric__label">' + esc(m.label) + '</div>' +
        '</div>';
      });
      html += '</div>';
      return html;
    },

    /** Build a section header HTML */
    renderSectionHeader: function (number, title, score) {
      var scoreBadge = '';
      if (score !== undefined && score !== null) {
        var cls = scoreClass(score);
        scoreBadge = '<span class="pdf-section__score pdf-section__score--' + cls + '">' + score + '/100</span>';
      }
      return '<div class="pdf-section__header">' +
        '<span class="pdf-section__number">' + String(number).padStart(2, '0') + '</span>' +
        '<h2 class="pdf-section__title">' + esc(title) + '</h2>' +
        scoreBadge +
      '</div>';
    },

    /* -------------------------------------------------------------------------
       Logo Loader
       ------------------------------------------------------------------------- */
    _loadLogo: function (container) {
      if (!container) return;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', '/assets/logo-pdf.svg', true);
      xhr.onload = function () {
        if (xhr.status === 200) {
          container.innerHTML = xhr.responseText;
        } else {
          container.innerHTML = '<div style="font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#dd3838;font-weight:700;">Site Mechanic</div>';
        }
      };
      xhr.onerror = function () {
        container.innerHTML = '<div style="font-size:14px;text-transform:uppercase;letter-spacing:3px;color:#dd3838;font-weight:700;">Site Mechanic</div>';
      };
      xhr.send();
    },

    /* Expose helpers for report renderers */
    helpers: {
      t: t, esc: esc, truncate: truncate,
      scoreClass: scoreClass, scoreColor: scoreColor, scoreGrade: scoreGrade,
      wrapUrl: wrapUrl, formatDate: formatDate,
      translateImpact: translateImpact, translateStatus: translateStatus
    }
  };

  window.PdfReport = PdfReport;

})(window, document);
