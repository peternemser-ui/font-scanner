/**
 * PDF Export Integration Helper
 *
 * Sets up click handlers for PDF export buttons.
 * All exports go through the unified exportReportPDF function in pdf-export-utility.js.
 *
 * Usage:
 * 1. Include pdf-export-utility.js first
 * 2. Include this script
 * 3. Buttons with data-export="pdf" will automatically trigger PDF export
 */

(function(window, document) {
  'use strict';

  // Track if a PDF export is currently in progress to prevent duplicates
  let pdfExportInProgress = false;

  /**
   * Set up click handlers for export buttons
   */
  function setupExportHandlers() {
    document.addEventListener('click', async (e) => {
      const button = e.target.closest('[data-export]');
      if (!button) return;

      const exportType = button.getAttribute('data-export');

      // Check if button is locked/disabled
      if (button.disabled || button.classList.contains('pro-report-block__action--locked')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling that could cause duplicate calls

      if (exportType === 'pdf') {
        // Prevent duplicate PDF generation
        if (pdfExportInProgress) {
          console.log('[PDF Export] Export already in progress, ignoring click');
          return;
        }

        // Use the unified PDF export function
        if (typeof window.exportReportPDF === 'function') {
          pdfExportInProgress = true;
          try {
            await window.exportReportPDF({ buttonElement: button });
          } finally {
            pdfExportInProgress = false;
          }
        } else {
          console.error('PDF export utility not loaded. Include pdf-export-utility.js first.');
          alert('PDF export is not available. Please refresh the page and try again.');
        }
      } else if (exportType === 'csv') {
        // CSV export - call page-specific function if available
        if (typeof window.downloadCSV === 'function') {
          window.downloadCSV();
        } else if (typeof window.downloadPerformanceCSV === 'function') {
          window.downloadPerformanceCSV();
        } else {
          alert('CSV export is not available for this report type.');
        }
      } else if (exportType === 'share') {
        // Share link - call page-specific function or fallback to clipboard
        if (typeof window.copyShareLink === 'function') {
          window.copyShareLink();
        } else if (typeof window.copyPerformanceShareLink === 'function') {
          window.copyPerformanceShareLink();
        } else {
          // Fallback: copy current URL
          navigator.clipboard.writeText(window.location.href).then(() => {
            alert('Share link copied to clipboard');
          });
        }
      } else if (exportType === 'excel') {
        // Excel export
        if (typeof window.downloadExcel === 'function') {
          window.downloadExcel();
        } else {
          alert('Excel export is not available for this report type.');
        }
      } else if (exportType === 'json') {
        // JSON export
        if (typeof window.downloadJSON === 'function') {
          window.downloadJSON();
        } else {
          alert('JSON export is not available for this report type.');
        }
      }
    });
  }

  /**
   * Legacy initPDFExport function for backwards compatibility
   * @deprecated Export handlers are now set up automatically
   */
  function initPDFExport(config = {}) {
    console.warn('initPDFExport is deprecated. Export handlers are set up automatically.');
    return true;
  }

  /**
   * Legacy exportCurrentPage function for backwards compatibility
   * @deprecated Use window.exportReportPDF() instead
   */
  async function exportCurrentPage(config = {}) {
    console.warn('exportCurrentPage is deprecated. Use window.exportReportPDF() instead.');
    await window.exportReportPDF({
      buttonElement: config.buttonSelector ? document.querySelector(config.buttonSelector) : null
    });
  }

  // Set up handlers when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupExportHandlers);
  } else {
    setupExportHandlers();
  }

  // Export for module systems and backwards compatibility
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { initPDFExport, exportCurrentPage };
  } else {
    window.initPDFExport = initPDFExport;
    window.exportCurrentPage = exportCurrentPage;
  }

})(window, document);
