// Performance Hub page initialization: PDF export, tab mode selector, navigation

// PDF Export Function using improved utility
async function exportToPDF() {
  var urlInput = document.getElementById('urlInput');
  var url = urlInput ? urlInput.value : '';
  var exportBtn = document.getElementById('exportPdfBtn');

  // Create PDF exporter with Speed & UX configuration
  var exporter = new PDFExportUtility({
    filename: 'speed-ux-report-' + new Date().toISOString().split('T')[0] + '.pdf',
    reportTitle: 'Site Mechanic',
    reportSubtitle: 'Speed & UX Report',
    url: url,
    scale: 2,
    pageFormat: 'a4'
  });

  try {
    // Export with automatic accordion expansion
    await exporter.export('#resultsContent', exportBtn);
  } catch (error) {
    console.error('PDF export failed:', error);
  }
}

// Tab mode selector with mode indicator update
document.querySelectorAll('.tabs__item').forEach(function(tab) {
  tab.addEventListener('click', function() {
    document.querySelectorAll('.tabs__item').forEach(function(t) {
      t.classList.remove('tabs__item--active');
    });
    this.classList.add('tabs__item--active');

    var mode = this.dataset.mode;
    if (window.setPerformanceMode) {
      window.setPerformanceMode(mode);
      return;
    }

    var translate = function(key, fallback) {
      if (window.i18n && typeof window.i18n.t === 'function') {
        var result = window.i18n.t(key);
        if (result !== key) return result;
      }
      return fallback;
    };

    var modeLabels = {
      quick: translate('reports.modeLabels.quick', 'Quick scan'),
      cwv: translate('reports.modeLabels.cwv', 'Core Web Vitals'),
      full: translate('reports.modeLabels.full', 'Lighthouse Audit')
    };

    var modeDescriptions = {
      quick: translate('performanceHub.modes.quickDesc', 'Resource analysis focusing on requests, page weight, blocking assets, and server response time.'),
      cwv: translate('performanceHub.modes.cwvDescLong', 'Core Web Vitals deep dive: LCP, CLS, INP/TBT with risk flags and pass/fail indicators.'),
      full: translate('performanceHub.modes.fullDescLong', 'Complete Lighthouse Audit across Performance, Accessibility, Best Practices, and SEO (desktop + mobile).')
    };

    var selectedMode = document.getElementById('selectedMode');
    if (selectedMode) selectedMode.textContent = modeLabels[mode] || mode;
    var modeDescription = document.getElementById('modeDescription');
    if (modeDescription) modeDescription.textContent = modeDescriptions[mode] || modeDescriptions.quick;
  });
});

// Initialize navigation
document.addEventListener('DOMContentLoaded', function() {
  initializeNavigation('performance-hub', 'SITE MECHANIC', '> speed & ux');
});
