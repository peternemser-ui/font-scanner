/**
 * Universal PDF Export Utility
 * Handles PDF generation for all analyzer pages with:
 * - Automatic accordion expansion
 * - Print-friendly styling
 * - Multi-page support
 * - Consistent branding
 */

class PDFExportUtility {
  constructor(options = {}) {
    this.options = {
      filename: options.filename || 'report.pdf',
      reportTitle: options.reportTitle || 'Site Mechanic Report',
      reportSubtitle: options.reportSubtitle || 'Web Analysis',
      url: options.url || '',
      brandColor: options.brandColor || '#00ff41',
      scale: options.scale || 2,
      pageFormat: options.pageFormat || 'a4',
      ...options
    };
  }

  /**
   * Main export function
   * @param {string} contentSelector - CSS selector for content to export
   * @param {HTMLElement} buttonElement - The button that triggered the export (for loading state)
   * @returns {Promise<void>}
   */
  async export(contentSelector, buttonElement = null) {
    // PAYMENT GATE: Check if user has Pro status before exporting
    // Use shared ExportGate if available, otherwise fallback to proManager check
    const isPaid = window.ExportGate ? window.ExportGate.isPro() : (window.proManager && window.proManager.isPro());
    if (!isPaid) {
      if (window.ExportGate) {
        window.ExportGate.showPaywall();
      } else {
        // Fallback paywall if ExportGate not loaded
        alert('Pro Report required for PDF export. Visit /upgrade.html to unlock exports.');
      }
      return;
    }
    
    const content = document.querySelector(contentSelector);

    if (!content) {
      throw new Error(`Content element not found: ${contentSelector}`);
    }

    // Show loading state
    const originalButtonState = this._setButtonLoading(buttonElement, true);

    try {
      // Step 1: Prepare content (expand accordions, apply print styles)
      const restoreContent = await this._prepareContentForPDF(content);

      // Step 2: Generate PDF
      await this._generatePDF(content);

      // Step 3: Restore original content state
      restoreContent();

      console.log('PDF generated successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      alert('Failed to generate PDF. Please try again.');
      throw error;
    } finally {
      // Restore button state
      this._setButtonLoading(buttonElement, false, originalButtonState);
    }
  }

  /**
   * Prepare content for PDF export
   * - Expands all accordions
   * - Shows all hidden sections
   * - Applies print-friendly classes
   * @private
   */
  async _prepareContentForPDF(content) {
    const originalStates = {
      accordions: [],
      details: [],
      hidden: [],
      styles: []
    };

    // Clone content for manipulation
    content.classList.add('pdf-export-mode');

    // 1. Expand all <details> elements
    const detailsElements = content.querySelectorAll('details');
    detailsElements.forEach((details, index) => {
      originalStates.details[index] = details.open;
      details.open = true;
      details.setAttribute('data-pdf-expanded', 'true');
    });

    // 2. Expand all accordion-style elements (common patterns)
    const accordionSelectors = [
      '.accordion__content',
      '.collapsible__content',
      '.expandable__content',
      '[data-accordion-content]',
      '.card__body.hidden',
      '.card__body[style*="display: none"]',
      '.section__content.collapsed'
    ];

    accordionSelectors.forEach(selector => {
      const elements = content.querySelectorAll(selector);
      elements.forEach((el, index) => {
        const state = {
          selector,
          index,
          display: el.style.display,
          className: el.className,
          maxHeight: el.style.maxHeight
        };
        originalStates.accordions.push(state);

        // Force visibility
        el.style.display = 'block';
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
        el.classList.remove('hidden', 'collapsed');
        el.setAttribute('data-pdf-expanded', 'true');
      });
    });

    // 3. Show hidden issues/recommendations sections
    const hiddenSections = content.querySelectorAll('[style*="display: none"], .hidden:not([data-pdf-expanded])');
    hiddenSections.forEach((el, index) => {
      // Skip navigation, modals, and UI controls
      if (el.closest('nav, .modal, .tabs, button, [role="button"]')) {
        return;
      }

      originalStates.hidden.push({
        element: el,
        display: el.style.display,
        className: el.className
      });

      el.style.display = 'block';
      el.classList.remove('hidden');
    });

    // 4. Expand all collapsible cards that have a toggle button
    const toggleButtons = content.querySelectorAll('[data-toggle], .toggle-button, .expand-button');
    toggleButtons.forEach(button => {
      const targetId = button.getAttribute('data-toggle') || button.getAttribute('aria-controls');
      if (targetId) {
        const target = document.getElementById(targetId);
        if (target) {
          target.style.display = 'block';
          target.style.maxHeight = 'none';
          target.classList.add('expanded');
        }
      }
      // Hide toggle buttons in PDF
      button.style.display = 'none';
    });

    // 5. Force expand any elements with aria-expanded="false"
    const collapsedElements = content.querySelectorAll('[aria-expanded="false"]');
    collapsedElements.forEach(el => {
      const controls = el.getAttribute('aria-controls');
      if (controls) {
        const target = document.getElementById(controls);
        if (target) {
          target.style.display = 'block';
          target.style.maxHeight = 'none';
        }
      }
    });

    // Wait for any animations/transitions to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return restore function
    return () => {
      content.classList.remove('pdf-export-mode');

      // Restore details elements
      detailsElements.forEach((details, index) => {
        details.open = originalStates.details[index];
        details.removeAttribute('data-pdf-expanded');
      });

      // Restore accordions
      originalStates.accordions.forEach(state => {
        const elements = content.querySelectorAll(state.selector);
        const el = elements[state.index];
        if (el) {
          el.style.display = state.display;
          el.className = state.className;
          el.style.maxHeight = state.maxHeight;
          el.removeAttribute('data-pdf-expanded');
        }
      });

      // Restore hidden sections
      originalStates.hidden.forEach(({ element, display, className }) => {
        element.style.display = display;
        element.className = className;
      });

      // Restore toggle buttons
      toggleButtons.forEach(button => {
        button.style.display = '';
      });
    };
  }

  /**
   * Generate PDF from content
   * @private
   */
  async _generatePDF(content) {
    if (!window.jspdf || !window.html2canvas) {
      throw new Error('Required libraries not loaded. Please include jsPDF and html2canvas.');
    }

    const { jsPDF } = window.jspdf;

    // Capture content as canvas with high quality
    const canvas = await html2canvas(content, {
      scale: this.options.scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200, // Fixed width for consistency
      onclone: (clonedDoc) => {
        // Apply additional print styles to cloned document
        const clonedContent = clonedDoc.querySelector(content.tagName);
        if (clonedContent) {
          clonedContent.style.width = '1200px';
          clonedContent.style.padding = '20px';
        }
        // Hide elements marked as no-print (e.g., "Want More Detailed Analysis?" sections)
        const noPrintElements = clonedDoc.querySelectorAll('.no-print, .pdf-exclude');
        noPrintElements.forEach(el => {
          el.style.display = 'none';
        });
      }
    });

    const imgData = canvas.toDataURL('image/png');

    // Create PDF
    const pdf = new jsPDF('p', 'mm', this.options.pageFormat);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Header height (only on first page)
    const headerHeight = 60; // Increased for new minimal header design
    const footerHeight = 10;
    const margin = 10;

    // Add professional header (only on first page)
    this._addPDFHeader(pdf, pageWidth);

    // Calculate image dimensions
    const contentWidth = pageWidth - (2 * margin);
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    // Handle multi-page content
    let remainingHeight = contentHeight;
    let yOffset = 0;
    let currentPage = 1;

    while (remainingHeight > 0) {
      if (currentPage > 1) {
        pdf.addPage();
        // Header only on first page - don't add it here
      }

      // First page has header, subsequent pages start from top
      const topMargin = currentPage === 1 ? headerHeight : margin;
      const availableHeight = pageHeight - topMargin - footerHeight - margin;
      const sliceHeight = Math.min(remainingHeight, availableHeight);

      // Calculate the portion of the canvas to use
      const canvasSliceHeight = (sliceHeight / contentWidth) * canvas.width;
      const canvasYOffset = (yOffset / contentWidth) * canvas.width;

      // Create a temporary canvas for this slice
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = canvasSliceHeight;
      const sliceContext = sliceCanvas.getContext('2d');

      sliceContext.drawImage(
        canvas,
        0, canvasYOffset,
        canvas.width, canvasSliceHeight,
        0, 0,
        canvas.width, canvasSliceHeight
      );

      const sliceImgData = sliceCanvas.toDataURL('image/png');

      // Add to PDF - adjust Y position based on whether this is first page
      const yPosition = currentPage === 1 ? headerHeight : margin;
      pdf.addImage(
        sliceImgData,
        'PNG',
        margin,
        yPosition,
        contentWidth,
        sliceHeight
      );

      remainingHeight -= sliceHeight;
      yOffset += sliceHeight;
      currentPage++;
    }

    // Add footers to all pages
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      this._addPDFFooter(pdf, pageWidth, pageHeight, i, totalPages);
    }

    // Save the PDF
    pdf.save(this.options.filename);
  }

  /**
   * Add professional header to PDF (minimal, clean style)
   * @private
   */
  _addPDFHeader(pdf, pageWidth) {
    let yPos = 15;

    // Title - SITE MECHANIC (large, bold, black)
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('SITE MECHANIC', 15, yPos);
    yPos += 8;

    // Subtitle - Web Diagnostics & Performance Analysis
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(60, 60, 60);
    pdf.text('Web Diagnostics & Performance Analysis', 15, yPos);
    yPos += 5;

    // Horizontal line separator
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.8);
    pdf.line(15, yPos, 85, yPos);
    yPos += 8;

    // Report Type
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(this.options.reportSubtitle, 15, yPos);
    yPos += 6;

    // URL
    if (this.options.url) {
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80, 80, 80);
      pdf.text(`URL: ${this.options.url}`, 15, yPos);
      yPos += 5;
    }

    // Generated date and time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(80, 80, 80);
    pdf.text(`Generated: ${dateStr} at ${timeStr}`, 15, yPos);
  }

  /**
   * Add footer to PDF (minimal style)
   * @private
   */
  _addPDFFooter(pdf, pageWidth, pageHeight, currentPage, totalPages) {
    // Subtle top line
    pdf.setDrawColor(220, 220, 220);
    pdf.setLineWidth(0.3);
    pdf.line(15, pageHeight - 12, pageWidth - 15, pageHeight - 12);

    // Footer text
    pdf.setTextColor(140, 140, 140);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text('Site Mechanic - Professional Web Analysis', 15, pageHeight - 6);

    // Page numbers (right aligned)
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'bold');
    const pageText = `Page ${currentPage} of ${totalPages}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    pdf.text(pageText, pageWidth - pageTextWidth - 15, pageHeight - 6);
  }

  /**
   * Set button loading state
   * @private
   */
  _setButtonLoading(button, isLoading, originalState = null) {
    if (!button) return null;

    if (isLoading) {
      const state = {
        text: button.textContent,
        disabled: button.disabled,
        className: button.className
      };

      button.textContent = '⏳ Generating PDF...';
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'wait';

      return state;
    } else if (originalState) {
      button.textContent = originalState.text;
      button.disabled = originalState.disabled;
      button.style.opacity = '';
      button.style.cursor = '';
    }

    return null;
  }

  /**
   * Static helper to create and export in one call
   */
  static async quickExport(contentSelector, options = {}) {
    const exporter = new PDFExportUtility(options);
    const button = document.querySelector(options.buttonSelector);
    await exporter.export(contentSelector, button);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFExportUtility;
} else {
  window.PDFExportUtility = PDFExportUtility;
}
