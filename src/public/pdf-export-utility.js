/**
 * Unified PDF Export Utility
 *
 * SINGLE SOURCE OF TRUTH for all PDF exports in Site Mechanic.
 * Uses server-side Puppeteer rendering for consistent, professional PDFs.
 *
 * Features:
 * - Logo on every page
 * - Table of contents
 * - Executive summary
 * - Page numbers (X / Y format)
 * - Monospace font throughout
 *
 * Usage:
 *   await window.exportReportPDF({ reportType: 'seo', reportId: 'abc123' });
 */

(function(window) {
  'use strict';

  // Track active export to prevent duplicate generation
  let activeExportPromise = null;

  /**
   * Unified PDF Export Function
   * This is the ONLY function that should be used for PDF exports.
   *
   * @param {Object} options - Export options
   * @param {string} options.reportType - Type of report (seo, performance, security, etc.)
   * @param {string} options.reportId - Optional report ID for tracking
   * @param {HTMLElement} options.buttonElement - Optional button to show loading state
   * @returns {Promise<void>}
   */
  async function exportReportPDF(options = {}) {
    // Prevent duplicate exports - return existing promise if one is active
    if (activeExportPromise) {
      console.log('[PDF Export] Export already in progress, returning existing promise');
      return activeExportPromise;
    }

    const {
      reportType = detectReportType(),
      reportId = getReportId(),
      buttonElement = null
    } = options;

    // Get auth token
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token') || '';

    // Show loading state
    const originalButtonState = setButtonLoading(buttonElement, true);

    // Create and store the export promise
    activeExportPromise = (async () => {
    try {
      // Check if user has access (Pro or purchased report)
      const hasAccess = await checkExportAccess(reportId);

      if (!hasAccess) {
        // Reset button before showing modal
        setButtonLoading(buttonElement, false, originalButtonState);

        // Show pricing modal
        if (window.PricingModal && typeof window.PricingModal.open === 'function') {
          window.PricingModal.open({ reportId });
        } else {
          alert('Pro access required for PDF export.');
        }
        return;
      }

      // CRITICAL: Save the current report to storage before PDF export
      // This ensures Puppeteer can load the same results when it renders the page
      const currentResults = window.currentSeoResults ||
                             window.currentPerformanceResults ||
                             window.currentPerformanceHubResults?.data ||
                             window.currentResults;

      if (currentResults && window.ReportStorage?.saveReport) {
        try {
          const analyzedUrl = getAnalyzedUrl();
          const analyzerKey = reportType === 'seo' ? 'seo' :
                             reportType === 'performance' ? 'performance-hub' :
                             reportType;
          const scanStartedAt = document.body.getAttribute('data-sm-scan-started-at') ||
                                window.SM_SCAN_STARTED_AT ||
                                new Date().toISOString();

          await window.ReportStorage.saveReport(reportId, currentResults, {
            siteUrl: analyzedUrl,
            analyzerType: analyzerKey,
            scannedAt: scanStartedAt
          });
          console.log('[PDF Export] Saved report to storage for PDF rendering:', reportId);
        } catch (saveError) {
          console.warn('[PDF Export] Could not save report to storage:', saveError);
          // Continue anyway - the PDF might still work if results are in memory
        }
      }

      // Build URL with report_id param so Puppeteer can load the stored report
      const currentUrl = new URL(window.location.href);
      if (reportId && !currentUrl.searchParams.has('report_id')) {
        currentUrl.searchParams.set('report_id', reportId);
      }
      const pdfUrl = currentUrl.toString();

      // Call server-side Puppeteer PDF renderer
      // IMPORTANT: Send the report data directly so Puppeteer can inject it
      const analyzedUrlValue = getAnalyzedUrl();
      console.log('[PDF Export] Sending to server:', {
        url: pdfUrl,
        reportType: reportType,
        reportId: reportId,
        hasReportData: !!currentResults,
        reportDataKeys: currentResults ? Object.keys(currentResults).slice(0, 5) : [],
        analyzedUrl: analyzedUrlValue
      });

      const response = await fetch('/api/pdf/render', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          url: pdfUrl,
          reportType: reportType,
          reportId: reportId,
          // Send report data directly so Puppeteer can inject it
          reportData: currentResults,
          analyzedUrl: analyzedUrlValue
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 403) {
          // Reset button before showing modal
          setButtonLoading(buttonElement, false, originalButtonState);

          // Show pricing modal for unpaid users
          if (window.PricingModal && typeof window.PricingModal.open === 'function') {
            window.PricingModal.open({ reportId });
          } else {
            alert(errorData.message || 'Pro access required for PDF export.');
          }
          return;
        }

        throw new Error(errorData.error || errorData.message || 'Failed to generate PDF');
      }

      // Download the PDF
      const blob = await response.blob();
      const url = getAnalyzedUrl();
      const hostname = url ? new URL(url).hostname : 'report';
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${reportType}-report-${hostname}-${timestamp}.pdf`;

      downloadBlob(blob, filename);

      // Show success message
      if (window.ReportUI?.toast) {
        window.ReportUI.toast('PDF downloaded successfully!');
      }

    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to generate PDF: ' + (error.message || 'Unknown error. Please try again.'));
    } finally {
      setButtonLoading(buttonElement, false, originalButtonState);
      activeExportPromise = null;
    }
    })();

    return activeExportPromise;
  }

  /**
   * Check if user has access to export (Pro subscription or purchased report)
   * Only trusts server-side billing status via ProReportBlock
   */
  async function checkExportAccess(reportId) {
    // Check ProReportBlock access (this checks server-side billing status)
    if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
      if (window.ProReportBlock.hasAccess(reportId)) return true;
    }

    // Check demo domains (only vail.com)
    if (window.ProAccess?.isDemoDomain?.()) return true;

    // Note: Removed legacy localStorage checks (proManager, ProGate, CreditsManager)
    // for security. Subscription status must come from server.

    return false;
  }

  /**
   * Detect report type from current page
   */
  function detectReportType() {
    const path = window.location.pathname.toLowerCase();
    const pageAttr = document.body.getAttribute('data-page');

    if (pageAttr) return pageAttr;

    if (path.includes('seo')) return 'seo';
    if (path.includes('performance') || path.includes('speed') || path.includes('cwv')) return 'performance';
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
    if (path.includes('dashboard')) return 'dashboard';

    return 'report';
  }

  /**
   * Get report ID from various sources
   */
  function getReportId() {
    // Check body attribute
    const bodyId = document.body.getAttribute('data-report-id');
    if (bodyId) return bodyId;

    // Check URL params
    const params = new URLSearchParams(window.location.search);
    const urlId = params.get('report_id') || params.get('reportId');
    if (urlId) return urlId;

    // Generate from timestamp and report type
    return `${detectReportType()}-${Date.now()}`;
  }

  /**
   * Get the URL that was analyzed (from input field or results)
   */
  function getAnalyzedUrl() {
    // Try various URL input selectors
    const urlInputSelectors = [
      '#seoUrlInput', '#urlInput', '#cwvUrlInput', '#securityUrlInput',
      '#accessibilityUrlInput', '#performanceUrlInput', 'input[type="url"]'
    ];

    for (const selector of urlInputSelectors) {
      const input = document.querySelector(selector);
      if (input && input.value) {
        try {
          return input.value.startsWith('http') ? input.value : `https://${input.value}`;
        } catch (e) {
          // Invalid URL
        }
      }
    }

    // Try to get from current results - check multiple sources
    if (window.currentSeoResults?.url) return window.currentSeoResults.url;
    if (window.currentPerformanceResults?.url) return window.currentPerformanceResults.url;
    if (window.currentPerformanceHubResults?.url) return window.currentPerformanceHubResults.url;
    if (window.currentResults?.url) return window.currentResults.url;

    // Try to get from URL params
    const params = new URLSearchParams(window.location.search);
    const urlParam = params.get('url');
    if (urlParam) {
      try {
        return urlParam.startsWith('http') ? urlParam : `https://${urlParam}`;
      } catch (e) {
        // Invalid URL
      }
    }

    return window.location.href;
  }

  /**
   * Download a blob as a file
   */
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Inject CSS animation styles (only once)
   */
  function injectLoadingStyles() {
    if (document.getElementById('pdf-export-loading-styles')) return;

    const style = document.createElement('style');
    style.id = 'pdf-export-loading-styles';
    style.textContent = `
      @keyframes pdf-spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes pdf-progress {
        0% { width: 0%; }
        15% { width: 15%; }
        35% { width: 40%; }
        55% { width: 65%; }
        75% { width: 80%; }
        90% { width: 90%; }
        100% { width: 95%; }
      }
      @keyframes pdf-shimmer {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }

      /* Full overlay for larger buttons (ProReportBlock) */
      .pdf-generating-overlay {
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.97);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        border-radius: inherit;
        z-index: 10;
        padding: 12px;
      }
      .pdf-generating-spinner {
        width: 28px;
        height: 28px;
        border: 3px solid rgba(221, 56, 56, 0.15);
        border-top-color: #dd3838;
        border-radius: 50%;
        animation: pdf-spin 0.7s linear infinite;
      }
      .pdf-generating-text {
        font-size: 13px;
        font-weight: 600;
        color: #1f2937;
        text-align: center;
        line-height: 1.3;
      }
      .pdf-generating-subtext {
        font-size: 11px;
        color: #6b7280;
        margin-top: 2px;
      }
      .pdf-generating-progress {
        width: 100%;
        max-width: 120px;
        height: 5px;
        background: rgba(221, 56, 56, 0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 6px;
      }
      .pdf-generating-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #dd3838 0%, #ef4444 50%, #dd3838 100%);
        background-size: 200% 100%;
        border-radius: 3px;
        animation: pdf-progress 12s ease-out forwards, pdf-shimmer 1.5s linear infinite;
      }
      .pdf-generating-btn {
        position: relative;
        pointer-events: none;
      }
      .pdf-generating-btn > *:not(.pdf-generating-overlay):not(.pdf-inline-loading) {
        opacity: 0.2;
      }

      /* Inline loading for smaller/simpler buttons */
      .pdf-inline-loading {
        display: inline-flex !important;
        align-items: center;
        gap: 8px;
        color: #374151;
        font-weight: 600;
      }
      .pdf-inline-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(221, 56, 56, 0.2);
        border-top-color: #dd3838;
        border-radius: 50%;
        animation: pdf-spin 0.7s linear infinite;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Set button loading state with animated progress
   */
  function setButtonLoading(button, isLoading, originalState = null) {
    if (!button) {
      console.warn('setButtonLoading: no button provided');
      return null;
    }

    if (isLoading) {
      injectLoadingStyles();

      const state = {
        innerHTML: button.innerHTML,
        disabled: button.disabled,
        className: button.className,
        style: button.getAttribute('style') || ''
      };

      // Store state on the button itself as backup
      button._pdfExportOriginalState = state;

      button.disabled = true;
      button.classList.add('pdf-generating-btn');

      // Detect if this is a ProReportBlock action button (larger) or inline button (smaller)
      const isProReportBlock = button.classList.contains('pro-report-block__action') ||
                               button.closest('.pro-report-block__action') ||
                               button.querySelector('.pro-report-block__action-label');
      const buttonRect = button.getBoundingClientRect();
      const isLargeButton = buttonRect.height > 50 || isProReportBlock;

      if (isLargeButton) {
        // Full animated overlay for larger buttons
        button.style.position = 'relative';
        button.style.overflow = 'hidden';

        const overlay = document.createElement('div');
        overlay.className = 'pdf-generating-overlay';
        overlay.innerHTML = `
          <div class="pdf-generating-spinner"></div>
          <div class="pdf-generating-text">
            Generating PDF
            <div class="pdf-generating-subtext">Creating client-ready report...</div>
          </div>
          <div class="pdf-generating-progress">
            <div class="pdf-generating-progress-bar"></div>
          </div>
        `;
        button.appendChild(overlay);
      } else {
        // Simple inline spinner for smaller buttons
        const inlineLoader = document.createElement('span');
        inlineLoader.className = 'pdf-inline-loading';
        inlineLoader.innerHTML = `
          <span class="pdf-inline-spinner"></span>
          <span>Generating...</span>
        `;
        button.innerHTML = '';
        button.appendChild(inlineLoader);
        button.style.opacity = '1';
        button.style.cursor = 'wait';
      }

      return state;
    } else {
      // Restore button state - use provided state or backup from button
      const stateToRestore = originalState || button._pdfExportOriginalState;

      // Always try to remove overlay/loader elements
      const overlay = button.querySelector('.pdf-generating-overlay');
      if (overlay) overlay.remove();

      const inlineLoader = button.querySelector('.pdf-inline-loading');
      if (inlineLoader) inlineLoader.remove();

      if (stateToRestore) {
        button.innerHTML = stateToRestore.innerHTML;
        button.disabled = stateToRestore.disabled;
        button.className = stateToRestore.className;
        button.setAttribute('style', stateToRestore.style || '');
      }

      // Clean up
      button.classList.remove('pdf-generating-btn');
      delete button._pdfExportOriginalState;
    }

    return null;
  }

  // ============================================================
  // LEGACY COMPATIBILITY LAYER
  // These functions exist to maintain backwards compatibility
  // with existing page-specific export calls.
  // They all redirect to the unified exportReportPDF function.
  // ============================================================

  /**
   * @deprecated Use exportReportPDF({ reportType: 'seo' }) instead
   */
  window.exportSEOPDF = async function() {
    const button = document.querySelector('[data-export="pdf"]');
    await exportReportPDF({ reportType: 'seo', buttonElement: button });
  };

  /**
   * @deprecated Use exportReportPDF({ reportType: 'performance' }) instead
   */
  window.exportPerformancePDF = async function() {
    const button = document.querySelector('[data-export="pdf"]');
    await exportReportPDF({ reportType: 'performance', buttonElement: button });
  };

  /**
   * @deprecated Use exportReportPDF({ reportType: 'security' }) instead
   */
  window.exportSecurityPDF = async function() {
    const button = document.querySelector('[data-export="pdf"]');
    await exportReportPDF({ reportType: 'security', buttonElement: button });
  };

  /**
   * @deprecated Use exportReportPDF({ reportType: 'accessibility' }) instead
   */
  window.exportAccessibilityPDF = async function() {
    const button = document.querySelector('[data-export="pdf"]');
    await exportReportPDF({ reportType: 'accessibility', buttonElement: button });
  };

  /**
   * @deprecated Use exportReportPDF({ reportType: 'mobile' }) instead
   */
  window.exportMobilePDF = async function() {
    const button = document.querySelector('[data-export="pdf"]');
    await exportReportPDF({ reportType: 'mobile', buttonElement: button });
  };

  /**
   * @deprecated Use exportReportPDF({ reportType: 'cro' }) instead
   */
  window.exportCROPDF = async function() {
    const button = document.querySelector('[data-export="pdf"]');
    await exportReportPDF({ reportType: 'cro', buttonElement: button });
  };

  /**
   * @deprecated Use exportReportPDF({ reportType: 'dashboard' }) instead
   */
  window.exportDashboardPDF = async function() {
    const button = document.querySelector('[data-export="pdf"]');
    await exportReportPDF({ reportType: 'dashboard', buttonElement: button });
  };

  /**
   * Generic exportPDF function for backwards compatibility
   * @deprecated Use exportReportPDF() instead
   */
  window.exportPDF = async function(format, buttonEl) {
    await exportReportPDF({ buttonElement: buttonEl });
  };

  /**
   * Legacy PDFExportUtility class for backwards compatibility
   * @deprecated Use exportReportPDF() instead
   */
  class PDFExportUtility {
    constructor(options = {}) {
      this.options = options;
      console.warn('PDFExportUtility is deprecated. Use window.exportReportPDF() instead.');
    }

    async export(contentSelector, buttonElement = null) {
      await exportReportPDF({
        reportType: this.options.reportType || detectReportType(),
        reportId: this.options.reportId,
        buttonElement: buttonElement
      });
    }

    static async quickExport(contentSelector, options = {}) {
      await exportReportPDF(options);
    }
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  // Main export function
  window.exportReportPDF = exportReportPDF;

  // Legacy class (for backwards compatibility)
  window.PDFExportUtility = PDFExportUtility;

  // Helper functions (exposed for advanced usage)
  window.PDFExport = {
    export: exportReportPDF,
    detectReportType,
    getReportId,
    checkAccess: checkExportAccess
  };

})(window);
