/**
 * Site Mechanic - Breadcrumb Component
 * Accessible, semantic breadcrumb navigation
 *
 * Features:
 * - Semantic nav + aria-label="Breadcrumb"
 * - Consistent styling via CSS classes
 * - Supports dynamic rendering
 * - Swiss design system compatible
 *
 * Usage:
 *   window.SiteMechanic.Breadcrumb.render('#breadcrumb-container', [
 *     { label: 'Dashboard', href: '/' },
 *     { label: 'Performance Hub', href: '/performance-hub.html' },
 *     { label: 'Core Web Vitals' } // Current page (no href)
 *   ]);
 */

(function(window) {
  'use strict';

  /**
   * Render breadcrumb navigation
   * @param {string|HTMLElement} container - Container selector or element
   * @param {Array<{label: string, href?: string}>} items - Breadcrumb items
   * @param {Object} options - Optional configuration
   * @param {string} options.separator - Separator character (default: '/')
   * @param {string} options.homeLabel - Label for home link (default: 'Home')
   * @param {string} options.homeHref - Href for home link (default: '/')
   * @param {boolean} options.includeHome - Include home as first item (default: false)
   */
  function render(container, items = [], options = {}) {
    const {
      separator = '/',
      homeLabel = 'Home',
      homeHref = '/',
      homeI18nKey = 'nav.dashboard',
      includeHome = false
    } = options;

    const el = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!el) {
      console.warn('[Breadcrumb] Container not found:', container);
      return;
    }

    // Prepend home if requested and not already present
    let breadcrumbItems = [...items];
    if (includeHome && (!items.length || items[0].href !== homeHref)) {
      breadcrumbItems.unshift({ label: homeLabel, href: homeHref, i18nKey: homeI18nKey });
    }

    // Build breadcrumb HTML
    const html = buildHTML(breadcrumbItems, separator);
    el.innerHTML = html;
  }

  /**
   * Build breadcrumb HTML string
   * @param {Array} items - Breadcrumb items
   * @param {string} separator - Separator character
   * @returns {string} HTML string
   */
  function buildHTML(items, separator) {
    if (!items || items.length === 0) {
      return '';
    }

    const resolveLabel = (item) => {
      if (item && item.i18nKey && window.i18n && typeof window.i18n.t === 'function') {
        const translated = window.i18n.t(item.i18nKey);
        if (translated !== item.i18nKey) {
          return translated;
        }
      }
      return item.label || '';
    };

    const listItems = items.map((item, index) => {
      const isLast = index === items.length - 1;
      const sep = !isLast
        ? `<span class="breadcrumb-separator" aria-hidden="true">${separator}</span>`
        : '';

      const label = resolveLabel(item);
      if (isLast || !item.href) {
        // Current page - no link, aria-current
        return `
          <li class="breadcrumb-item">
            <span class="breadcrumb-current" aria-current="page">${escapeHTML(label)}</span>
          </li>
        `;
      }

      // Link to another page
      return `
        <li class="breadcrumb-item">
          <a href="${escapeHTML(item.href)}" class="breadcrumb-link">${escapeHTML(label)}</a>
          ${sep}
        </li>
      `;
    }).join('');

    return `
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol class="breadcrumb-list">
          ${listItems}
        </ol>
      </nav>
    `;
  }

  /**
   * Parse current page breadcrumb from URL/DOM
   * Attempts to auto-detect breadcrumb path from page structure
   * @returns {Array} Breadcrumb items
   */
  function parseFromPage() {
    const items = [];
    let pathname = window.location.pathname;
    const supported = (window.i18n && Array.isArray(window.i18n.supportedLanguages))
      ? window.i18n.supportedLanguages
      : ['en', 'es', 'fr', 'de', 'pt', 'ja', 'zh'];

    const pathParts = pathname.split('/').filter(Boolean);
    if (pathParts.length && supported.includes(pathParts[0])) {
      pathname = '/' + pathParts.slice(1).join('/');
    }

    // Always start with Dashboard (home)
    items.push({ label: 'Dashboard', href: '/', i18nKey: 'nav.dashboard' });

    // Map known analyzer pages to their parent hubs
    const pageMap = {
      '/performance-hub.html': { label: 'Speed & UX', i18nKey: 'nav.performance' },
      '/core-web-vitals.html': { label: 'Core Web Vitals', i18nKey: 'nav.coreWebVitals', parent: '/performance-hub.html', parentLabel: 'Speed & UX', parentI18nKey: 'nav.performance' },
      '/performance-analyzer.html': { label: 'Performance', i18nKey: 'nav.lighthouseMetrics', parent: '/performance-hub.html', parentLabel: 'Speed & UX', parentI18nKey: 'nav.performance' },
      '/seo-analyzer.html': { label: 'SEO & Indexing', i18nKey: 'nav.seoAnalysis' },
      '/security-analyzer.html': { label: 'Security & Trust', i18nKey: 'nav.security' },
      '/accessibility-analyzer.html': { label: 'Accessibility', i18nKey: 'nav.accessibility' },
      '/mobile-analyzer.html': { label: 'Mobile UX', i18nKey: 'nav.mobileTesting' },
      '/hosting-analyzer.html': { label: 'Hosting Analysis', i18nKey: 'nav.hostingGuide' },
      '/broken-links.html': { label: 'Broken Links', i18nKey: 'nav.brokenLinks' },
      '/brand-consistency.html': { label: 'Brand Consistency', i18nKey: 'nav.brandAudit' },
      '/enhanced-fonts.html': { label: 'Font Analysis', i18nKey: 'nav.typography' },
      '/cro-analyzer.html': { label: 'CRO Analysis', i18nKey: 'nav.croAnalysis' },
      '/competitive-analysis.html': { label: 'Competitive Analysis', i18nKey: 'nav.rankCompetition' },
      '/local-seo.html': { label: 'Local SEO', i18nKey: 'nav.localSeo' },
      '/gdpr-compliance.html': { label: 'GDPR Compliance', i18nKey: 'nav.gdprCheck' },
      '/ip-reputation-analyzer.html': { label: 'IP Reputation', i18nKey: 'nav.ipReputation' },
      '/tag-intelligence.html': { label: 'Tag Intelligence', i18nKey: 'nav.tagIntelligence' },
      '/site-crawler.html': { label: 'Site Crawler', i18nKey: 'nav.siteCrawler' },
      '/results.html': { label: 'Results', i18nKey: 'reports.common.results' }
    };

    const page = pageMap[pathname];
    if (page) {
      // Add parent if exists
      if (page.parent && page.parentLabel) {
        items.push({ label: page.parentLabel, href: page.parent, i18nKey: page.parentI18nKey });
      }
      // Add current page (no href = current)
      items.push({ label: page.label, i18nKey: page.i18nKey });
    }

    return items;
  }

  /**
   * Auto-render breadcrumb on page load
   * Looks for element with id="breadcrumb" or data-breadcrumb
   * @param {Object} options - Render options
   */
  function autoRender(options = {}) {
    const container = document.getElementById('breadcrumb')
      || document.querySelector('[data-breadcrumb]')
      || document.querySelector('.breadcrumb-container');

    if (!container) {
      return;
    }

    const items = parseFromPage();
    if (items.length > 1) { // Only render if more than just home
      render(container, items, options);
    }

    // Re-render on language changes to prevent mixed-language breadcrumbs
    window.addEventListener('languageChanged', () => {
      const updatedItems = parseFromPage();
      if (updatedItems.length > 1) {
        render(container, updatedItems, options);
      }
    });
  }

  /**
   * Escape HTML entities
   * @param {string} str - String to escape
   * @returns {string} Escaped string
   */
  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Export to global namespace
  window.SiteMechanic = window.SiteMechanic || {};
  window.SiteMechanic.Breadcrumb = {
    render,
    buildHTML,
    parseFromPage,
    autoRender
  };

  // Auto-initialize on DOMContentLoaded if data-breadcrumb-auto exists
  document.addEventListener('DOMContentLoaded', function() {
    if (document.querySelector('[data-breadcrumb-auto]')) {
      autoRender();
    }
  });

})(window);
