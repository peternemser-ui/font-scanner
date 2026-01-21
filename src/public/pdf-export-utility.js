/**
 * Universal PDF Export Utility
 * Handles PDF generation for all analyzer pages with:
 * - Automatic accordion expansion
 * - Print-friendly styling
 * - Multi-page support
 * - Consistent branding
 */

/* global html2canvas */

// Site Mechanic logo as PNG data URL (red text logo)
// This is pre-rendered for consistent PDF output
const SITE_MECHANIC_LOGO_BASE64 = null; // Will use styled text instead

class PDFExportUtility {
  constructor(options = {}) {
    this.options = {
      filename: options.filename || 'report.pdf',
      reportTitle: options.reportTitle || 'Site Mechanic Report',
      reportSubtitle: options.reportSubtitle || 'Web Analysis',
      url: options.url || '',
      brandColor: options.brandColor || '#dd3838',
      scale: options.scale || 2,
      pageFormat: options.pageFormat || 'a4',
      ...options
    };
    
    // Cache for logo image
    this._logoImageData = null;
    this._logoLoaded = false;
  }

  /**
   * Pre-load the Site Mechanic logo SVG and convert to PNG for PDF embedding
   * @private
   */
  async _loadLogo() {
    if (this._logoLoaded) return this._logoImageData;
    
    try {
      // Fetch the SVG logo
      const response = await fetch('/assets/logo-pdf.svg');
      if (!response.ok) throw new Error('Logo not found');
      
      const svgText = await response.text();
      
      // Create an image from SVG
      const img = new Image();
      const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
      });
      
      // Render to canvas
      const canvas = document.createElement('canvas');
      const scale = 2; // Higher resolution
      canvas.width = img.width * scale || 300;
      canvas.height = img.height * scale || 50;
      
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      
      URL.revokeObjectURL(url);
      
      this._logoImageData = canvas.toDataURL('image/png');
      this._logoLoaded = true;
      
      return this._logoImageData;
    } catch (error) {
      console.warn('Could not load logo for PDF:', error.message);
      this._logoLoaded = true;
      return null;
    }
  }

  /**
   * Main export function
   * @param {string} contentSelector - CSS selector for content to export
   * @param {HTMLElement} buttonElement - The button that triggered the export (for loading state)
   * @returns {Promise<void>}
   */
  async export(contentSelector, buttonElement = null) {
    const reportId =
      (buttonElement && buttonElement.dataset && buttonElement.dataset.reportId) ||
      document.body.getAttribute('data-report-id') ||
      null;

    // PAYMENT GATE: allow export for Pro OR for an unlocked single report.
    const isPaid = (function isExportAllowed() {
      const hasPro = window.ExportGate
        ? window.ExportGate.isPro()
        : (window.proManager && typeof window.proManager.isPro === 'function' && window.proManager.isPro());
      if (hasPro) return true;

      if (reportId && window.CreditsManager) {
        if (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) return true;
        if (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId)) return true;
      }

      return false;
    })();

    if (!isPaid) {
      if (window.ExportGate && typeof window.ExportGate.showPaywall === 'function') {
        window.ExportGate.showPaywall();
      } else {
        alert('Pro access required for PDF export.');
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
      // Ensure paywall/unlock UI is up to date before we snapshot.
      if (reportId && window.CreditsManager) {
        const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
        if (typeof render === 'function') {
          try {
            render(reportId);
          } catch (e) {
            // best-effort only
          }
        }
      }

      // Step 1: Prepare content (expand accordions, apply print styles)
      const restoreContent = await this._prepareContentForPDF(content);

      // Step 2: Generate PDF
      await this._generatePDF(content);

      // Step 3: Restore original content state
      restoreContent();
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

    // Mark export root so html2canvas.onclone can reliably find the right element.
    content.setAttribute('data-pdf-export-root', 'true');

    // Apply print-friendly CSS
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
      '.report-accordion__body',
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
        if (el.hasAttribute('hidden')) el.removeAttribute('hidden');
        el.setAttribute('data-pdf-expanded', 'true');
      });
    });

    // 3. Show hidden issues/recommendations sections
    const hiddenSections = content.querySelectorAll('[style*="display: none"], .hidden:not([data-pdf-expanded])');
    hiddenSections.forEach((el) => {
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

    // 4. Ensure images are loaded (so screenshots render in the PDF)
    await this._waitForImages(content);

    // Ensure fonts are ready (helps avoid missing icon glyphs / layout shifts)
    if (document.fonts && typeof document.fonts.ready === 'object' && typeof document.fonts.ready.then === 'function') {
      try {
        await document.fonts.ready;
      } catch (e) {
        // ignore
      }
    }

    // 5. Force expand any elements with aria-expanded="false"
    const collapsedElements = content.querySelectorAll('[aria-expanded="false"]');
    collapsedElements.forEach(el => {
      const controls = el.getAttribute('aria-controls');
      if (controls) {
        const target = document.getElementById(controls);
        if (target) {
          target.style.display = 'block';
          target.style.maxHeight = 'none';
          target.style.overflow = 'visible';
          if (target.hasAttribute('hidden')) target.removeAttribute('hidden');
          target.classList.add('expanded');
        }
      }
    });

    // Wait for any animations/transitions to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Return restore function
    return () => {
      content.classList.remove('pdf-export-mode');
      content.removeAttribute('data-pdf-export-root');

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
   * Wait for images to finish loading so html2canvas captures them.
   * @private
   */
  async _waitForImages(content) {
    const images = Array.from(content.querySelectorAll('img'));
    if (images.length === 0) return;

    const waiters = images.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve();

      return new Promise((resolve) => {
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    });

    // Don't hang forever if some images are slow.
    await Promise.race([
      Promise.all(waiters),
      new Promise((resolve) => setTimeout(resolve, 4000))
    ]);
  }

  /**
   * Generate PDF from content with intelligent page breaks
   * Prevents charts, cards, and sections from being cut in the middle
   * @private
   */
  async _generatePDF(content) {
    if (!window.jspdf || !window.html2canvas) {
      throw new Error('Required libraries not loaded. Please include jsPDF and html2canvas.');
    }

    // Pre-load logo for header
    const logoImageData = await this._loadLogo();

    const { jsPDF } = window.jspdf;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', this.options.pageFormat);
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Layout constants
    const headerHeight = 60;
    const footerHeight = 10;
    const margin = 10;
    const contentWidth = pageWidth - (2 * margin);

    // Add professional header with logo (only on first page)
    this._addPDFHeader(pdf, pageWidth, logoImageData);

    // Find content sections that should not be split
    const keepTogetherElements = this._findKeepTogetherElements(content);

    if (keepTogetherElements.length > 0) {
      // Use intelligent section-based rendering
      await this._renderSectionsIntelligently(pdf, content, keepTogetherElements, {
        pageWidth,
        pageHeight,
        headerHeight,
        footerHeight,
        margin,
        contentWidth
      });
    } else {
      // Fallback to improved canvas slicing with smart break points
      await this._renderWithSmartSlicing(pdf, content, {
        pageWidth,
        pageHeight,
        headerHeight,
        footerHeight,
        margin,
        contentWidth
      });
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
   * Find elements that should be kept together (not split across pages)
   * @private
   */
  _findKeepTogetherElements(content) {
    // Selectors for elements that should never be split
    const keepTogetherSelectors = [
      '.pdf-keep-together',
      '.card',
      '.metric-card',
      '.chart-container',
      '.gauge-chart',
      '.score-card',
      '.recommendation-card',
      '.result-section',
      '.analysis-card',
      'canvas',
      'svg',
      '.report-accordion',
      '.accordion-item',
      '[data-pdf-keep-together]',
      '.metric-grid',
      '.cwv-metric',
      '.performance-metric',
      '.issue-card',
      '.finding-card',
      'table',
      '.data-table',
      // Screenshot containers - should not be split across pages
      '.screenshot-container',
      '.report-shell__screenshot-wrapper',
      '.page-screenshot'
    ];

    const elements = [];
    const selector = keepTogetherSelectors.join(', ');
    const candidates = content.querySelectorAll(selector);

    candidates.forEach(el => {
      // Skip nested elements - only process top-level keepable elements
      const hasKeepableParent = el.parentElement?.closest(selector);
      if (!hasKeepableParent) {
        const rect = el.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        elements.push({
          element: el,
          top: rect.top - contentRect.top,
          height: rect.height,
          bottom: rect.bottom - contentRect.top
        });
      }
    });

    // Sort by top position
    return elements.sort((a, b) => a.top - b.top);
  }

  /**
   * Render content using intelligent section-based approach
   * @private
   */
  async _renderSectionsIntelligently(pdf, content, sections, layout) {
    const { pageWidth, pageHeight, headerHeight, footerHeight, margin, contentWidth } = layout;
    const scale = this.options.scale;

    // Capture full content
    const fullCanvas = await html2canvas(content, {
      scale: scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
      onclone: (clonedDoc) => this._prepareClonedContent(clonedDoc)
    });

    const canvasToMM = (pixels) => (pixels / scale) * (contentWidth / (fullCanvas.width / scale));

    let currentPage = 1;
    let currentY = headerHeight; // Start after header on first page
    let processedHeight = 0;
    const contentHeightMM = canvasToMM(fullCanvas.height);

    // Group sections into pages, respecting keep-together boundaries
    while (processedHeight < contentHeightMM) {
      if (currentPage > 1) {
        pdf.addPage();
        currentY = margin;
      }

      const availableHeight = pageHeight - currentY - footerHeight - margin;

      // Find the best break point
      let sliceHeightMM = availableHeight;
      let breakAtSectionBoundary = false;

      // Check if any section would be cut
      for (const section of sections) {
        const sectionTopMM = canvasToMM(section.top);
        const sectionBottomMM = canvasToMM(section.bottom);
        const sectionHeightMM = canvasToMM(section.height);

        const sliceEndMM = processedHeight + sliceHeightMM;

        // If section starts before slice end but ends after, we're cutting it
        if (sectionTopMM < sliceEndMM && sectionBottomMM > sliceEndMM) {
          // Check if section fits on current page entirely
          if (sectionHeightMM <= availableHeight) {
            // Move break point to before this section
            sliceHeightMM = Math.max(10, sectionTopMM - processedHeight);
            breakAtSectionBoundary = true;
          } else if (sectionHeightMM > pageHeight - margin * 2 - footerHeight) {
            // Section is too tall to fit on any page - let it be split
            // but try to break at a sensible point within it
            sliceHeightMM = availableHeight;
          } else {
            // Section can fit on next page - break before it
            sliceHeightMM = Math.max(10, sectionTopMM - processedHeight);
            breakAtSectionBoundary = true;
          }
          break;
        }
      }

      // Ensure we make progress
      sliceHeightMM = Math.max(20, Math.min(sliceHeightMM, contentHeightMM - processedHeight));

      // Calculate canvas coordinates
      const canvasYStart = (processedHeight / contentHeightMM) * fullCanvas.height;
      const canvasSliceHeight = (sliceHeightMM / contentHeightMM) * fullCanvas.height;

      // Create slice canvas
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = fullCanvas.width;
      sliceCanvas.height = Math.max(1, Math.round(canvasSliceHeight));
      const ctx = sliceCanvas.getContext('2d');

      ctx.drawImage(
        fullCanvas,
        0, Math.round(canvasYStart),
        fullCanvas.width, Math.round(canvasSliceHeight),
        0, 0,
        sliceCanvas.width, sliceCanvas.height
      );

      // Add to PDF
      const imgData = sliceCanvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', margin, currentY, contentWidth, sliceHeightMM);

      processedHeight += sliceHeightMM;
      currentPage++;
    }
  }

  /**
   * Render with smart slicing - finds natural break points
   * @private
   */
  async _renderWithSmartSlicing(pdf, content, layout) {
    const { pageWidth, pageHeight, headerHeight, footerHeight, margin, contentWidth } = layout;

    // Capture content as canvas with high quality
    const canvas = await html2canvas(content, {
      scale: this.options.scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1200,
      onclone: (clonedDoc) => this._prepareClonedContent(clonedDoc)
    });

    const imgData = canvas.toDataURL('image/png');
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    // Check if fits on single page
    const firstPageAvailableHeight = pageHeight - headerHeight - footerHeight - margin;
    if (contentHeight <= firstPageAvailableHeight) {
      pdf.addImage(imgData, 'PNG', margin, headerHeight, contentWidth, contentHeight);
      return;
    }

    // Multi-page: find smart break points
    const breakPoints = this._findSmartBreakPoints(canvas, contentHeight, layout);
    let currentPage = 1;
    let yOffset = 0;

    for (let i = 0; i < breakPoints.length; i++) {
      if (currentPage > 1) {
        pdf.addPage();
      }

      const topMargin = currentPage === 1 ? headerHeight : margin;
      const sliceHeight = breakPoints[i] - yOffset;

      // Calculate canvas slice
      const canvasSliceHeight = (sliceHeight / contentWidth) * canvas.width;
      const canvasYOffset = (yOffset / contentWidth) * canvas.width;

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = Math.max(1, Math.round(canvasSliceHeight));
      const ctx = sliceCanvas.getContext('2d');

      ctx.drawImage(
        canvas,
        0, Math.round(canvasYOffset),
        canvas.width, Math.round(canvasSliceHeight),
        0, 0,
        sliceCanvas.width, sliceCanvas.height
      );

      const sliceImgData = sliceCanvas.toDataURL('image/png');
      pdf.addImage(sliceImgData, 'PNG', margin, topMargin, contentWidth, sliceHeight);

      yOffset = breakPoints[i];
      currentPage++;
    }
  }

  /**
   * Find smart break points by analyzing canvas for natural breaks
   * Looks for horizontal bands of consistent color (whitespace/borders)
   * @private
   */
  _findSmartBreakPoints(canvas, contentHeightMM, layout) {
    const { pageHeight, headerHeight, footerHeight, margin } = layout;
    const breakPoints = [];
    let currentY = 0;

    const firstPageAvailable = pageHeight - headerHeight - footerHeight - margin;
    const subsequentPageAvailable = pageHeight - margin - footerHeight - margin;

    while (currentY < contentHeightMM) {
      const isFirstPage = breakPoints.length === 0;
      const availableHeight = isFirstPage ? firstPageAvailable : subsequentPageAvailable;
      let targetBreak = currentY + availableHeight;

      if (targetBreak >= contentHeightMM) {
        breakPoints.push(contentHeightMM);
        break;
      }

      // Look for a good break point within a tolerance zone
      const tolerance = Math.min(30, availableHeight * 0.15); // 15% or 30mm max
      const searchStart = targetBreak - tolerance;
      const searchEnd = targetBreak;

      // Scan canvas for whitespace rows in the tolerance zone
      const bestBreak = this._findWhitespaceBreak(canvas, contentHeightMM, searchStart, searchEnd);

      breakPoints.push(bestBreak || targetBreak);
      currentY = breakPoints[breakPoints.length - 1];
    }

    return breakPoints;
  }

  /**
   * Find a row of whitespace/consistent color in the canvas
   * @private
   */
  _findWhitespaceBreak(canvas, contentHeightMM, searchStartMM, searchEndMM) {
    const ctx = canvas.getContext('2d');
    const scale = canvas.width / 1200; // Based on windowWidth: 1200

    // Convert mm to canvas pixels
    const mmToCanvasY = (mm) => (mm / contentHeightMM) * canvas.height;

    const startY = Math.floor(mmToCanvasY(searchStartMM));
    const endY = Math.floor(mmToCanvasY(searchEndMM));

    // Sample every few pixels for performance
    const sampleStep = Math.max(1, Math.floor((endY - startY) / 50));

    let bestBreakY = null;
    let bestScore = -1;

    for (let y = endY; y >= startY; y -= sampleStep) {
      // Get a row of pixels
      const rowData = ctx.getImageData(0, y, canvas.width, 1).data;

      // Check if row is mostly uniform (whitespace or border)
      let uniformScore = 0;
      let prevR = rowData[0], prevG = rowData[1], prevB = rowData[2];

      for (let x = 0; x < canvas.width; x += 10) {
        const i = x * 4;
        const r = rowData[i], g = rowData[i + 1], b = rowData[i + 2];

        // Check if similar to previous pixel
        const diff = Math.abs(r - prevR) + Math.abs(g - prevG) + Math.abs(b - prevB);
        if (diff < 30) uniformScore++;

        // Bonus for white/light colors (likely spacing)
        if (r > 240 && g > 240 && b > 240) uniformScore += 2;

        prevR = r; prevG = g; prevB = b;
      }

      if (uniformScore > bestScore) {
        bestScore = uniformScore;
        bestBreakY = y;
      }
    }

    if (bestBreakY !== null && bestScore > canvas.width / 20) {
      // Convert back to mm
      return (bestBreakY / canvas.height) * contentHeightMM;
    }

    return null;
  }

  /**
   * Prepare cloned content for html2canvas
   * @private
   */
  _prepareClonedContent(clonedDoc) {
    const clonedContent = clonedDoc.querySelector('[data-pdf-export-root="true"]');
    if (clonedContent) {
      clonedContent.style.width = '1200px';
      clonedContent.style.padding = '20px';
    }
    // Hide elements marked as no-print
    const noPrintElements = clonedDoc.querySelectorAll('.no-print, .pdf-exclude, [data-hide-in-pdf]');
    noPrintElements.forEach(el => {
      el.style.display = 'none';
    });
  }

  /**
   * Add professional header to PDF with Site Mechanic branding
   * @param {Object} pdf - jsPDF instance
   * @param {number} pageWidth - Page width in mm
   * @param {string|null} logoImageData - Logo as base64 PNG data URL, or null for text fallback
   * @private
   */
  _addPDFHeader(pdf, pageWidth, logoImageData = null) {
    let yPos = 12;

    // Try to add logo image if available
    if (logoImageData) {
      try {
        // Logo dimensions: roughly 50mm wide, proportional height
        const logoWidth = 50;
        const logoHeight = 8; // Approximate height based on SVG aspect ratio
        pdf.addImage(logoImageData, 'PNG', 15, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 3;
      } catch (error) {
        console.warn('Could not add logo image to PDF:', error.message);
        // Fall back to text logo
        pdf.setTextColor(221, 56, 56);
        pdf.setFontSize(22);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Site Mechanic', 15, yPos + 5);
        yPos += 10;
      }
    } else {
      // Text logo fallback - styled text in brand red (#dd3838)
      pdf.setTextColor(221, 56, 56); // #dd3838 brand red
      pdf.setFontSize(22);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Site Mechanic', 15, yPos + 5);
      yPos += 10;
    }

    // Subtitle - Web Diagnostics & Performance Analysis
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text('Web Diagnostics & Performance Analysis', 15, yPos);
    yPos += 5;

    // Brand accent line in red
    pdf.setDrawColor(221, 56, 56);
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
