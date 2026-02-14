/**
 * Site Mechanic - Report Container Component
 * Provides clean, branded report structure
 *
 * Replaces raw debug labels like [PERFORMANCE_ANALYSIS_RESULTS]
 * with professional, user-friendly headers
 */

(function(window) {
  // Translation helper - evaluates at runtime to ensure i18n is loaded
  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const translated = window.i18n.t(key);
      if (translated !== key) {
        return translated;
      }
    }
    return fallback;
  }

  /**
   * Mode display labels - now uses translation function for i18n support
   */
  function getModeLabels() {
    return {
      full: t('reports.modeLabels.full', 'Lighthouse Audit'),
      cwv: t('reports.modeLabels.cwv', 'Core Web Vitals'),
      quick: t('reports.modeLabels.quick', 'Quick Scan'),
      performance: t('reports.modeLabels.performance', 'Performance Analysis'),
      seo: t('reports.modeLabels.seo', 'SEO Analysis'),
      accessibility: t('reports.modeLabels.accessibility', 'Accessibility Audit'),
      security: t('reports.modeLabels.security', 'Security Analysis'),
      mobile: t('reports.modeLabels.mobile', 'Mobile Testing'),
      cro: t('reports.modeLabels.cro', 'Conversion Optimization'),
      fonts: t('reports.modeLabels.fonts', 'Font Analysis'),
      brand: t('reports.modeLabels.brand', 'Brand Consistency'),
      competitive: t('reports.modeLabels.competitive', 'Competitive Analysis'),
      hosting: t('reports.modeLabels.hosting', 'Hosting Analysis'),
      crawler: t('reports.modeLabels.crawler', 'Site Crawler'),
      'broken-links': t('reports.modeLabels.brokenLinks', 'Broken Links'),
      gdpr: t('reports.modeLabels.gdpr', 'GDPR Compliance'),
      'local-seo': t('reports.modeLabels.localSeo', 'Local SEO'),
      'tag-intelligence': t('reports.modeLabels.tagIntelligence', 'Tag Intelligence'),
      'ip-reputation': t('reports.modeLabels.ipReputation', 'IP Reputation')
    };
  }

  /**
   * Format timestamp in user's local timezone
   */
  function formatTimestamp(timestamp) {
    if (!timestamp) return '';

    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;

      // Use i18n locale if available, otherwise fallback to browser default
      const locale = window.i18n?.currentLanguage || navigator.language || 'en-US';

      return date.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: locale.startsWith('en'), // 12-hour format for English, 24-hour for others
        timeZoneName: 'short'
      });
    } catch (e) {
      return timestamp;
    }
  }

  function formatUrlForDisplay(inputUrl) {
    const raw = (inputUrl || '').trim();
    if (!raw) return '';

    const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try {
      const u = new URL(withProto);
      return u.hostname || raw;
    } catch (e) {
      return raw.replace(/^https?:\/\//i, '').split('/')[0];
    }
  }

  /**
   * Render clean, branded report header
   * Replaces raw labels like [PERFORMANCE_ANALYSIS_RESULTS]
   */
  function renderHeader(options = {}) {
    const {
      url,
      timestamp,
      mode = 'performance',
      title,
      subtitle,
      showModeBadge = true,
      showModeMeta = true
    } = options;

    const modeLabels = getModeLabels();
    const modeLabel = modeLabels[mode] || modeLabels.performance;
    const displayTitle = title || t('reports.common.analysisResults', 'Analysis Results');
    const formattedTimestamp = formatTimestamp(timestamp);
    const displayUrl = formatUrlForDisplay(url);

    const isRedundant =
      typeof displayTitle === 'string' &&
      displayTitle.trim() &&
      typeof modeLabel === 'string' &&
      modeLabel.trim() &&
      displayTitle.toLowerCase().includes(modeLabel.toLowerCase());

    const effectiveSubtitle = isRedundant ? '' : subtitle;
    const effectiveShowModeBadge = Boolean(showModeBadge) && !isRedundant;
    const effectiveShowModeMeta = Boolean(showModeMeta) && !isRedundant;

    return `
      <div class="print-header">
        <span class="print-header__left">Site Mechanic Report</span>
        <span class="print-header__right">${displayUrl || ''} | ${formattedTimestamp || ''}</span>
      </div>
      <div class="report-header">
        <h1 class="report-header__title" data-results-heading>${displayTitle}</h1>
        ${effectiveShowModeBadge && modeLabel ? `<div class="report-header__badge">${modeLabel}</div>` : ''}
        ${effectiveSubtitle ? `<p class="report-header__subtitle">${effectiveSubtitle}</p>` : ''}
        <div class="report-header__meta">
          ${displayUrl ? `
            <span class="meta-item">
              <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
              </svg>
              <span class="meta-item__text">${displayUrl}</span>
            </span>
          ` : ''}
          ${timestamp ? `
            <span class="meta-item">
              <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <span class="meta-item__text">${formattedTimestamp}</span>
            </span>
          ` : ''}
          ${effectiveShowModeMeta && mode ? `
            <span class="meta-item meta-item--mode">
              <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
              <span class="meta-item__text">${modeLabel}</span>
            </span>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Render summary metrics section
   * Uses existing ReportShell donut rendering
   */
  function renderSummary(metrics = []) {
    if (!metrics || metrics.length === 0) return '';

    // Delegate to existing ReportShell if available
    if (window.ReportShell && window.ReportShell.renderSummaryDonuts) {
      return window.ReportShell.renderSummaryDonuts(metrics);
    }

    // Fallback simple rendering
    return `
      <div class="report-shell__summary">
        ${metrics.map(metric => `
          <div class="report-shell__summary-card">
            <div class="report-shell__summary-label">${metric.label}</div>
            <div class="report-shell__summary-value">${metric.score || '—'}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render Pro Report block
   * Delegates to ProReportBlock component
   */
  function renderProBlock(options = {}) {
    if (window.ProReportBlock && window.ProReportBlock.render) {
      return window.ProReportBlock.render(options);
    }

    // Fallback: render placeholder that ProReportBlock will replace once it loads
    // Add locked class to prevent accent border flash before content renders
    const safeOptions = JSON.stringify(options).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    return `
      <div class="pro-report-block pro-report-block--locked" data-locked data-pro-block-pending data-pro-block-options="${safeOptions}">
      </div>
    `;
  }

  /**
   * Render screenshot gallery section
   * Delegates to ScreenshotLightbox component
   */
  function renderScreenshots(screenshots = [], options = {}) {
    if (!screenshots || screenshots.length === 0) return '';

    const {
      title = 'Screenshots',
      showDeviceLabels = true
    } = options;

    return `
      <div class="screenshot-section">
        <h3 class="screenshot-section__title">${title}</h3>
        <div class="screenshot-grid" data-screenshot-gallery>
          ${screenshots.map((screenshot, index) => `
            <div class="screenshot-item" data-screenshot="${index}" ${screenshot.device ? `data-device="${screenshot.device}"` : ''}>
              <img src="${screenshot.src || screenshot}" alt="${screenshot.alt || `Screenshot ${index + 1}`}" class="screenshot-item__img">
              ${showDeviceLabels && screenshot.device ? `
                <div class="screenshot-item__label">${screenshot.device}</div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Create complete report container
   * Combines all sections into unified report structure
   */
  function create(options = {}) {
    const {
      url,
      timestamp,
      mode,
      title,
      subtitle,
      summary,
      sections = [],
      screenshots,
      proBlock = true,
      proBlockOptions = {},
      customHeaderContent = '' // Custom content to inject after summary (e.g., charts, special sections)
    } = options;

    let html = '';

    // Header
    html += renderHeader({ url, timestamp, mode, title, subtitle });

    // Screenshots (keep near the top, consistent with other reports)
    if (screenshots && screenshots.length > 0) {
      html += renderScreenshots(screenshots, { title: t('reports.common.pageScreenshot', 'Page Screenshot'), showDeviceLabels: true });
    }

    // Summary metrics
    if (summary && summary.length > 0) {
      html += renderSummary(summary);
    }

    // Custom header content (for specialized reports like competitive analysis)
    if (customHeaderContent) {
      html += customHeaderContent;
    }

    // Main content sections (accordions)
    if (sections && sections.length > 0) {
      sections.forEach(section => {
        if (window.ReportAccordion && window.ReportAccordion.createSection) {
          html += window.ReportAccordion.createSection(section);
        }
      });
    }

    // Pro Report block
    if (proBlock) {
      html += renderProBlock(proBlockOptions);
    }

    // Print footer (visible only when printing)
    html += renderPrintFooter();

    return html;
  }

  /**
   * Render print footer (visible only when printing)
   */
  function renderPrintFooter() {
    const currentYear = new Date().getFullYear();
    return `
      <div class="print-footer">
        <span class="print-footer__left">© ${currentYear} Site Mechanic</span>
        <span class="print-footer__center">sitemechanic.io</span>
        <span class="print-footer__right">Confidential</span>
      </div>
    `;
  }

  /**
   * Print the report
   * Delegates to ReportUI.printReport if available, otherwise falls back to direct implementation
   */
  function printReport() {
    // Prefer ReportUI.printReport for consistency
    if (window.ReportUI && typeof window.ReportUI.printReport === 'function') {
      window.ReportUI.printReport();
      return;
    }

    // Fallback implementation for pages without report-ui.js
    const hasPro = (
      (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
      (typeof window.userHasPro === 'function' && window.userHasPro())
    );

    document.body.classList.add('printing-report');

    if (!hasPro) {
      document.body.classList.add('print-free-tier');
    }

    window.print();

    // Cleanup after print
    const cleanup = () => {
      document.body.classList.remove('printing-report');
      document.body.classList.remove('print-free-tier');
    };

    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 2000);
  }

  // Public API
  window.ReportContainer = {
    create,
    renderHeader,
    renderSummary,
    renderProBlock,
    renderScreenshots,
    printReport,

    // Utility
    formatTimestamp,
    getModeLabels
  };

})(window);
