/**
 * PDF Export Integration Helper
 * Easy integration for all analyzer pages
 *
 * Usage:
 * 1. Include this script after pdf-export-utility.js
 * 2. Call initPDFExport() with configuration
 * 3. Or use the default setup by calling initPDFExport() with no arguments
 */

/**
 * Initialize PDF export for current page
 * @param {Object} config - Configuration options
 * @param {string} config.contentSelector - Selector for content to export (default: '#results, #resultsContent, .results-container')
 * @param {string} config.buttonSelector - Selector for export button (default: '#exportPdfBtn, .export-pdf-btn')
 * @param {string} config.reportSubtitle - Report subtitle (auto-detected from page)
 * @param {string} config.urlInputSelector - Selector for URL input (default: '#urlInput, input[type="url"]')
 * @param {Function} config.onBeforeExport - Callback before export starts
 * @param {Function} config.onAfterExport - Callback after export completes
 */
function initPDFExport(config = {}) {
  // Detect page type from URL or data attribute
  const pageType = detectPageType();

  // Default configuration
  const defaultConfig = {
    contentSelector: config.contentSelector || detectContentSelector(),
    buttonSelector: config.buttonSelector || '#exportPdfBtn, .export-pdf-btn, #downloadPdfButton',
    reportSubtitle: config.reportSubtitle || getReportSubtitle(pageType),
    urlInputSelector: config.urlInputSelector || '#urlInput, #cwvUrlInput, #seoUrlInput, #securityUrlInput, #accessibilityUrlInput, input[type="url"]',
    filename: config.filename || `${pageType}-report-${new Date().toISOString().split('T')[0]}.pdf`,
    onBeforeExport: config.onBeforeExport || null,
    onAfterExport: config.onAfterExport || null
  };

  // Find export button(s)
  const buttons = document.querySelectorAll(defaultConfig.buttonSelector);

  if (buttons.length === 0) {
    console.warn('PDF Export: No export button found. Looking for:', defaultConfig.buttonSelector);
    return false;
  }

  // Attach click handler to all export buttons
  buttons.forEach(button => {
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      await exportCurrentPage(defaultConfig);
    });
  });

  console.log('PDF Export initialized for:', pageType);
  return true;
}

/**
 * Export current page to PDF
 */
async function exportCurrentPage(config) {
  // Get URL from input
  const urlInput = document.querySelector(config.urlInputSelector);
  const url = urlInput ? urlInput.value : window.location.href;

  // Get content element
  const contentElement = document.querySelector(config.contentSelector);
  if (!contentElement) {
    alert(`Could not find content to export. Selector: ${config.contentSelector}`);
    return;
  }

  // Check if content is visible and has results
  if (contentElement.style.display === 'none' || !contentElement.querySelector('*')) {
    alert('Please run an analysis first before exporting to PDF.');
    return;
  }

  // Get button for loading state
  const button = document.querySelector(config.buttonSelector);

  // Call onBeforeExport callback
  if (config.onBeforeExport) {
    await config.onBeforeExport();
  }

  try {
    // Create PDF exporter
    const exporter = new PDFExportUtility({
      filename: config.filename,
      reportTitle: 'Site Mechanic',
      reportSubtitle: config.reportSubtitle,
      url: url,
      scale: 2,
      pageFormat: 'a4'
    });

    // Export with automatic accordion expansion
    await exporter.export(config.contentSelector, button);

    // Call onAfterExport callback
    if (config.onAfterExport) {
      await config.onAfterExport();
    }

  } catch (error) {
    console.error('PDF export failed:', error);
    alert('Failed to generate PDF. Please try again.');
  }
}

/**
 * Detect page type from URL or data attributes
 */
function detectPageType() {
  const path = window.location.pathname;
  const pageAttr = document.body.getAttribute('data-page');

  if (pageAttr) return pageAttr;

  // Detect from URL
  if (path.includes('performance') || path.includes('speed') || path.includes('cwv')) return 'performance';
  if (path.includes('seo')) return 'seo';
  if (path.includes('security')) return 'security';
  if (path.includes('accessibility') || path.includes('a11y')) return 'accessibility';
  if (path.includes('mobile')) return 'mobile';
  if (path.includes('font')) return 'fonts';
  if (path.includes('broken-link')) return 'broken-links';
  if (path.includes('brand')) return 'brand-consistency';
  if (path.includes('competitive')) return 'competitive-analysis';
  if (path.includes('cro')) return 'cro';
  if (path.includes('local-seo')) return 'local-seo';
  if (path.includes('ip-reputation')) return 'ip-reputation';
  if (path.includes('gdpr')) return 'gdpr-compliance';
  if (path.includes('tag-intelligence')) return 'tag-intelligence';
  if (path.includes('hosting')) return 'hosting';

  return 'analysis';
}

/**
 * Detect content selector based on page structure
 */
function detectContentSelector() {
  // Try common selectors in order of preference
  const selectors = [
    '#resultsContent',
    '#results',
    '#cwvResults',
    '#seoResults',
    '#securityResults',
    '#accessibilityResults',
    '.results-container',
    '.analysis-results',
    'main .card:has(.metric, .score)',
    'main'
  ];

  for (const selector of selectors) {
    if (document.querySelector(selector)) {
      return selector;
    }
  }

  return 'main';
}

/**
 * Get report subtitle based on page type
 */
function getReportSubtitle(pageType) {
  const subtitles = {
    'performance': 'Speed & UX Report',
    'performance-hub': 'Speed & UX Report',
    'seo': 'SEO Analysis Report',
    'security': 'Security Analysis Report',
    'accessibility': 'Accessibility Analysis Report',
    'mobile': 'Mobile Optimization Report',
    'fonts': 'Font Analysis Report',
    'broken-links': 'Broken Links Report',
    'brand-consistency': 'Brand Consistency Report',
    'competitive-analysis': 'Competitive Analysis Report',
    'cro': 'Conversion Rate Optimization Report',
    'local-seo': 'Local SEO Report',
    'ip-reputation': 'IP Reputation Report',
    'gdpr-compliance': 'GDPR Compliance Report',
    'tag-intelligence': 'Tag Intelligence Report',
    'hosting': 'Hosting Analysis Report'
  };

  return subtitles[pageType] || 'Web Analysis Report';
}

/**
 * Auto-initialize if configured via data attribute
 * Usage: <body data-pdf-export="auto">
 */
document.addEventListener('DOMContentLoaded', () => {
  const autoInit = document.body.getAttribute('data-pdf-export') === 'auto';

  if (autoInit) {
    // Wait for other scripts to load
    setTimeout(() => {
      if (typeof PDFExportUtility !== 'undefined') {
        initPDFExport();
      } else {
        console.warn('PDF Export: PDFExportUtility not loaded. Make sure pdf-export-utility.js is included.');
      }
    }, 500);
  }
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { initPDFExport, exportCurrentPage };
} else {
  window.initPDFExport = initPDFExport;
  window.exportCurrentPage = exportCurrentPage;
}
