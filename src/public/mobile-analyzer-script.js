/**
 * Mobile Analyzer Script
 * Multi-device testing with performance, accessibility, and readability analysis
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'mobile-analyzer';

// Translation helper - evaluates at runtime to ensure i18n is loaded
function t(key, fallback, params = {}) {
  let value = fallback;
  if (window.i18n && typeof window.i18n.t === 'function') {
    const translated = window.i18n.t(key);
    if (translated !== key) {
      value = translated;
    }
  }
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{\\{?${param}\\}?\\}`, 'g');
      value = value.replace(regex, params[param]);
    });
  }
  return value;
}

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  
  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');
  // Initialize AnalyzerLoader
  let loader = null;
  if (typeof AnalyzerLoader !== 'undefined') {
    loader = new AnalyzerLoader('loadingContainer');
  }

  // Device name mapping for display
  const deviceNames = {
    'iphone-14': 'iPhone 14',
    'iphone-15-pro': 'iPhone 15 Pro',
    'iphone-se': 'iPhone SE',
    'pixel-7': 'Pixel 7',
    'pixel-8': 'Pixel 8',
    'galaxy-s23': 'Galaxy S23',
    'galaxy-s24': 'Galaxy S24',
    'ipad': 'iPad',
    'ipad-pro': 'iPad Pro'
  };

  // Build dynamic analysis steps based on selected devices
  function buildAnalysisSteps(devices) {
    const steps = [
      { label: t('loader.connectingToWebsite', 'Connecting to website'), detail: t('loader.loadingMultipleDevices', 'Loading page on multiple devices...') }
    ];

    devices.forEach((deviceId, index) => {
      const name = deviceNames[deviceId] || deviceId;
      steps.push({
        label: t('loader.testingDevice', 'Testing {{device}}', { device: name }),
        detail: index === 0 ? t('loader.analyzingPerformanceLayout', 'Analyzing performance and layout...') :
                index === devices.length - 1 ? t('loader.finalDeviceChecks', 'Final device checks...') :
                t('loader.checkingTouchTargets', 'Checking touch targets and readability...')
      });
    });
    
    steps.push({ label: t('loader.compilingResults', 'Compiling results and recommendations...'), detail: t('loader.generatingDeviceComparison', 'Generating device comparison report...') });
    return steps;
  }

  // Handle analysis
  analyzeButton.addEventListener('click', analyzeUrl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeUrl();
  });

  // Handle URL parameters for report loading and billing return
  (async function initFromUrlParams() {
    // Ensure i18n translations are loaded before rendering any report content
    if (window.i18n && typeof window.i18n.init === 'function' && !window.i18n.initialized) {
      try { await window.i18n.init(); } catch (e) { /* i18n will use fallback */ }
    }

    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report_id') || '';
    const autoUrl = params.get('url') || '';
    const autoScan = params.get('auto_scan') === 'true';
    const billingSuccess = params.get('billing_success') === 'true';

    // If we have a report_id, set it immediately so hasAccess checks work
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
      console.log('[Mobile] Set report ID from URL:', reportId);
    }

    // If returning from billing, wait for billing return processing to complete
    if (billingSuccess && !window.__smBillingReturnComplete) {
      console.log('[Mobile] Waiting for billing return processing...');

      // CRITICAL: Clear fresh scan flag - user paid for this report
      console.log('[Mobile] Billing return detected - clearing fresh scan flag');
      window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;

      await new Promise((resolve) => {
        if (window.__smBillingReturnComplete) {
          resolve();
          return;
        }
        const handler = () => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        };
        window.addEventListener('sm:billingReturnComplete', handler);
        setTimeout(() => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        }, 5000);
      });
      console.log('[Mobile] Billing return processing complete');
      return;
    }

    // If we have a report_id, try to load the stored report first
    if (reportId && window.ReportStorage) {
      console.log('[Mobile] Checking for stored report:', reportId);

      // CRITICAL: Fetch billing status BEFORE displaying the report
      // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
      if (window.ProReportBlock?.fetchBillingStatus) {
        console.log('[Mobile] Fetching billing status (force refresh for report recall)...');
        await window.ProReportBlock.fetchBillingStatus(true);
        console.log('[Mobile] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId), 'for reportId:', reportId);
      }

      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
      if (loaded) {
        // Stored report was loaded - fill URL input for context
        if (autoUrl) urlInput.value = autoUrl;
        return; // Don't auto-scan
      }
    }

    // No stored report found - pre-fill URL but only auto-scan if explicitly requested
    if (autoUrl) {
      urlInput.value = autoUrl;
    }
    // Only auto-scan if explicitly requested with auto_scan=true
    if (autoScan) {
      setTimeout(() => {
        analyzeUrl();
      }, 500);
    }
  })();

  // Listen for restore scan results event (after payment return)
  window.addEventListener('sm:restoreScanResults', (e) => {
    const { results: restoredResults, url, analyzer } = e.detail || {};
    if (restoredResults && analyzer?.includes('mobile')) {
      console.log('[Mobile] Restoring scan results after payment - clearing fresh scan flag');
      // Clear fresh scan flag since user paid for this report
      window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
      if (url && urlInput) {
        urlInput.value = url;
      }
      displayResults(restoredResults);
    }
  });

  // Handle billing re-scan: user returned from Stripe but cached results weren't available
  window.addEventListener('sm:billingRescan', (e) => {
    const { reportId: purchasedReportId, url: scanUrl } = e.detail || {};
    const analyzerKey = window.SM_ANALYZER_KEY || '';
    if (!analyzerKey.includes('mobile')) return;
    console.log('[Mobile] Billing re-scan requested:', { purchasedReportId, scanUrl });
    window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
    window.__smBillingRescanHandled = true;
    if (scanUrl && urlInput) urlInput.value = scanUrl;
    if (purchasedReportId) document.body.setAttribute('data-report-id', purchasedReportId);
    analyzeUrl({ preserveReportId: true, billingRescan: true });
  });

  /**
   * @param {Object} options - Optional settings
   * @param {boolean} options.preserveReportId - If true, preserve the existing report_id (for billing return re-scans)
   */
  async function analyzeUrl(options = {}) {
    const { preserveReportId = false, billingRescan = false } = options;
    const url = urlInput.value.trim();
    if (!url) {
      showError(t('reports.common.pleaseEnterUrl', 'Please enter a valid URL'));
      return;
    }

    // CRITICAL: Mark this as a FRESH SCAN that requires payment
    // VERSION: 20260201h - This flag ensures new scans are LOCKED until paid
    console.log('[Mobile] NEW SCAN v20260201h: Marking as fresh unpaid scan');
    window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = true;
    window.__SM_CURRENT_SCAN_URL__ = url;

    // NOTE: Auto-preserve is ONLY used when explicitly requested via options.preserveReportId
    // (e.g., sm:billingRescan handler passes preserveReportId: true).
    const existingReportId = document.body.getAttribute('data-report-id');

    // Clear billing cache and session markers — but KEEP markers if preserving
    if (window.ProReportBlock?.clearBillingCache) {
      window.ProReportBlock.clearBillingCache();
    }
    if (!preserveReportId) {
      sessionStorage.removeItem('sm_payment_completed_session');
      sessionStorage.removeItem('sm_purchased_report_id');
    } else {
      console.log('[Mobile] Keeping session markers for post-billing re-scan');
    }

    // CRITICAL: Save the existing report_id BEFORE cleanup if we need to preserve it
    // This is used for billing return re-scans where the purchased report_id must be kept
    const preservedReportId = preserveReportId ? existingReportId : null;
    if (preservedReportId) {
      console.log('[Mobile] Preserving purchased report_id:', preservedReportId);
    }

    // Clear report metadata from previous scans
    // IMPORTANT: Don't clear report_id when re-scanning after billing return,
    // otherwise the purchased report_id gets lost and replaced with a new one
    if (!preserveReportId) {
      document.body.removeAttribute('data-report-id');
    }
    document.body.removeAttribute('data-sm-screenshot-url');
    document.body.removeAttribute('data-sm-scan-started-at');

    // Get selected devices
    const devices = [];
    document.querySelectorAll('.device-selector input[type="checkbox"]:checked').forEach(checkbox => {
      const deviceId = checkbox.id.replace('device-', '');
      devices.push(deviceId);
    });

    if (devices.length === 0) {
      showError(t('reports.common.selectDevice', 'Please select at least one device to test'));
      return;
    }

    // Show loading
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;
    
    // Update button text
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = t('reports.common.analyzing', 'Analyzing...');

    // Build dynamic steps based on selected devices
    const analysisSteps = buildAnalysisSteps(devices);
    
    if (loader) {
      loader.start(analysisSteps, '📱 ' + t('loader.testingMobile', 'TESTING MOBILE'), 45);
      
      // Add ASCII art patience message
      addPatienceMessage(loadingContainer);
    }

    try {
      if (loader) loader.nextStep(1);

      // Simulate progression through device testing steps
      const totalDeviceSteps = devices.length;
      let currentStep = 2; // Start after "Connecting to website"
      
      // Progress through device steps during API call
      const stepInterval = setInterval(() => {
        if (loader && currentStep <= totalDeviceSteps) {
          loader.nextStep(currentStep);
          currentStep++;
        } else {
          clearInterval(stepInterval);
        }
      }, 3000); // Every 3 seconds advance to next device

      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/mobile-analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url,
          scanStartedAt,
          lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en',
          ...(billingRescan && { billingRescan: true }),
          options: {
            devices,
            includePerformance: true,
            includeAccessibility: true,
            includeReadability: true,
            checkTouchTargets: true
          }
        })
      });

      // Clear the interval and jump to final step
      clearInterval(stepInterval);
      if (loader) loader.nextStep(totalDeviceSteps + 1); // "Compiling results"

      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'SCAN_QUOTA_EXCEEDED') {
          const limit = error.scansLimit || 10;
          if (loader) {
            loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
          }
          return;
        }
        throw new Error(error.message || error.error || t('reports.common.analysisFailed', 'Analysis failed'));
      }

      const data = await response.json();
      // CRITICAL: Use preserved report_id if this is a billing return re-scan
      // The API returns a NEW report_id with new timestamp, but we must keep the purchased one
      const apiReportId = data && data.reportId ? String(data.reportId) : '';
      const reportId = preservedReportId || apiReportId;
      const screenshotUrl = data && data.screenshotUrl ? String(data.screenshotUrl) : '';

      if (reportId) {
        if (preservedReportId) {
          console.log('[Mobile] Using preserved report_id instead of API response:', reportId);
        }
        if (window.ReportUI && typeof window.ReportUI.setCurrentReportId === 'function') {
          window.ReportUI.setCurrentReportId(reportId);
        } else {
          document.body.setAttribute('data-report-id', reportId);
        }
      }
      if (screenshotUrl) {
        document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
      }
      
      // Re-fetch billing status before displaying results so Pro/Day Pass sections unlock
      if (window.ProReportBlock?.fetchBillingStatus) {
        try {
          await window.ProReportBlock.fetchBillingStatus(true);
          if (window.ProReportBlock.isProSubscriber?.()) {
            console.log('[Mobile] Pro/Day Pass user - clearing fresh scan payment flag');
            window.__SM_FRESH_SCAN_PENDING_PAYMENT__ = false;
          }
        } catch (e) {
          console.warn('[Mobile] Failed to fetch billing status:', e);
        }
      }

      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          displayResults(data.results, { reportId });
          window.__REPORT_READY__ = true;
          window.dispatchEvent(new CustomEvent('scan:completed'));
          window.dispatchEvent(new CustomEvent('report:ready'));
        }, 800);
      } else {
        displayResults(data.results, { reportId });
        window.__REPORT_READY__ = true;
        window.dispatchEvent(new CustomEvent('scan:completed'));
        window.dispatchEvent(new CustomEvent('report:ready'));
      }

    } catch (error) {
      if (loader) {
        loadingContainer.style.display = 'none';
      }
      showError(error.message);
    } finally {
      analyzeButton.disabled = false;
      const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
      buttonText.textContent = t('reports.common.analyze', 'Analyze');
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  async function displayResults(data, meta = {}) {
    // Ensure i18n is loaded before rendering (prevents English fallback on fast stored-report loads)
    if (window.i18n && !window.i18n.initialized) {
      try { await window.i18n.init(); } catch (e) { /* fallback */ }
    }

    if (!data || typeof data !== 'object') { console.error('[Mobile] displayResults received invalid data:', data); return; }
    if (!data.devices || typeof data.devices !== 'object') { console.error('[Mobile] displayResults missing devices field'); return; }
    // Ensure results container is visible (may be hidden if called directly without scan flow)
    if (results) {
      results.classList.remove('hidden');
    }

    // Defensive defaults for required objects to prevent crashes on missing data
    data.devices = data.devices || {};
    data.mobileScore = data.mobileScore ?? 0;
    data.performanceSummary = data.performanceSummary || { average: 0 };
    data.readabilitySummary = data.readabilitySummary || { average: 0 };
    data.accessibilitySummary = data.accessibilitySummary || { average: 0 };

    const url = document.getElementById('urlInput').value;
    const timestamp = window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString();
    const reportId = (meta && meta.reportId) ? String(meta.reportId) : (document.body.getAttribute('data-report-id') || '');

    // Check if shared components are loaded
    if (typeof ReportShell === 'undefined' || typeof ReportAccordion === 'undefined') {
      console.error('Shared report components not loaded');
      resultsContent.innerHTML = `<div style="color: red; padding: 2rem;">${t('reports.common.reportComponentsError', 'Error: Report components failed to load. Please refresh the page.')}</div>`;
      return;
    }

    // Get first device data for advanced features
    const firstDevice = Object.values(data.devices).find(d => !d.error) || {};
    
    // Page Screenshot section - consistent with other analyzers (invariant: every report MUST have .screenshot-section)
    const screenshotUrl = data.screenshotUrl
      || document.body.getAttribute('data-sm-screenshot-url')
      || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');

    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    const pageScreenshotLabel = t('reports.common.pageScreenshot', 'Page Screenshot');
    const screenshotUnavailableLabel = t('reports.common.screenshotUnavailable', 'Screenshot unavailable');
    const screenshotHtml = screenshotUrl ? `
      <div class="screenshot-section" style="margin-bottom: 1.5rem;">
        <h3 style="color: var(--text-primary, #fff); font-size: 1rem; margin: 0 0 0.75rem 0; font-weight: 600;">
          ${pageScreenshotLabel}
        </h3>
        <div class="screenshot-item" style="background: var(--bg-secondary, #1a1a1a); border: 1px solid var(--border-color, #333); border-radius: 8px; overflow: hidden;">
          <img
            src="${screenshotUrl}"
            alt="${t('reports.common.screenshotAlt', 'Screenshot of')} ${url}"
            class="screenshot-item__img"
            style="width: 100%; max-height: 300px; object-fit: cover; object-position: top; cursor: pointer; display: block;"
            data-action="open-lightbox"
            data-screenshot-url="${screenshotUrl}"
            data-screenshot-title="${pageScreenshotLabel}"
          />
        </div>
      </div>
    ` : '';

    // Summary donuts — derive overall from the 3 visible component donuts so scores stay consistent.
    // The API mobileScore also includes touchTargets (a 4th hidden component), which can pull the
    // overall away from what the visible donuts suggest.
    const perfAvg = data.performanceSummary.average;
    const readAvg = data.readabilitySummary.average;
    const a11yAvg = data.accessibilitySummary.average;
    const derivedMobileScore = Math.round((perfAvg + readAvg + a11yAvg) / 3);
    const summaryDonuts = ReportShell.renderSummaryDonuts([
      { label: t('reports.mobile.mobileScore', 'Mobile Score'), score: derivedMobileScore },
      { label: t('reports.mobile.performance', 'Performance'), score: perfAvg },
      { label: t('reports.mobile.readability', 'Readability'), score: readAvg },
      { label: t('reports.mobile.accessibility', 'Accessibility'), score: a11yAvg }
    ]);
    
    // Device Screenshots Section
    const screenshotsContent = `
      <div class="report-shell__card">
        ${Object.entries(data.devices).map(([key, device]) => {
          if (device.error) {
            return `
              <div style="margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border-primary, rgba(255,255,255,0.1));">
                <h4 style="margin-bottom: 1rem;">${device.device || key}</h4>
                <div style="color: #ff6b6b; padding: 1rem; background: rgba(255,107,107,0.1); border-radius: 8px;">
                  ${t('reports.mobile.errorCapturingDevice', 'Error capturing this device')}: ${device.error}
                </div>
              </div>
            `;
          }
          const portraitSrc = device.portraitScreenshot || device.screenshot || '';
          const landscapeSrc = device.landscapeScreenshot || '';
          const deviceWidth = device.viewport?.width || device.width || '';
          const deviceHeight = device.viewport?.height || device.height || '';
          return `
            <div style="margin-bottom: 2rem;">
              <h4 style="margin-bottom: 1rem;">${device.device}</h4>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                ${portraitSrc ? `
                  <div style="text-align: center;">
                    <img src="${portraitSrc}" alt="${device.device} portrait" class="device-screenshot" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); cursor: pointer;" data-action="open-image">
                    <div style="margin-top: 0.5rem; color: var(--text-muted, #888); font-size: 0.85rem;">📱 ${deviceWidth}x${deviceHeight}</div>
                    <a href="${portraitSrc}" download="${device.device}-portrait.png" style="color: #60a5fa; font-size: 0.85rem; text-decoration: none;">${t('reports.mobile.clickToEnlarge', 'Click to enlarge')}</a>
                  </div>
                ` : ''}
                ${landscapeSrc ? `
                  <div style="text-align: center;">
                    <img src="${landscapeSrc}" alt="${device.device} landscape" class="device-screenshot" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border-primary, rgba(255,255,255,0.1)); cursor: pointer;" data-action="open-image">
                    <div style="margin-top: 0.5rem; color: var(--text-muted, #888); font-size: 0.85rem;">🖥️ ${deviceHeight}x${deviceWidth}</div>
                    <a href="${landscapeSrc}" download="${device.device}-landscape.png" style="color: #60a5fa; font-size: 0.85rem; text-decoration: none;">${t('reports.mobile.clickToEnlarge', 'Click to enlarge')}</a>
                  </div>
                ` : ''}
                ${!portraitSrc && !landscapeSrc ? `
                  <div style="padding: 1rem; border: 1px dashed var(--border-primary, rgba(255,255,255,0.1)); border-radius: 8px; color: var(--text-muted, #888);">
                    ${t('reports.mobile.screenshotNotAvailable', 'Screenshot not available for this device.')}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
    
    // Other diagnostic sections (viewport, PWA, dark mode, etc.)
    const diagnosticsContent = createAllDiagnosticSections(data, firstDevice);
    
    // Recommendations - use same accordion pattern as SEO
    const recommendationsContent = renderMobileFixes(data.recommendations);

    const isReportUnlocked = (id) => {
      const reportId = String(id || '').trim();

      // PRIMARY CHECK: Use ProReportBlock.hasAccess() - this is the main access check
      // It handles: Pro subscriptions, purchased reports, session purchases, demo domains
      if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
        const hasAccess = window.ProReportBlock.hasAccess(reportId || null);
        console.log('[Mobile] isReportUnlocked via hasAccess:', hasAccess, 'reportId:', reportId);
        return hasAccess;
      }

      // FALLBACK: Legacy checks
      // Subscription-style Pro (or ProReportBlock helper)
      if (window.ProReportBlock && typeof window.ProReportBlock.isPro === 'function') {
        if (window.ProReportBlock.isPro(reportId || null)) return true;
      }

      // Per-report unlock via credits
      if (reportId && window.CreditsManager) {
        if (typeof window.CreditsManager.isUnlocked === 'function') return window.CreditsManager.isUnlocked(reportId);
        if (typeof window.CreditsManager.isReportUnlocked === 'function') return window.CreditsManager.isReportUnlocked(reportId);
      }

      return false;
    };

    const proLocked = !isReportUnlocked(reportId);
    
    const majorScoreSections = [
      ReportAccordion.createSection({
        id: 'mobile-performance-summary',
        title: t('reports.mobile.performance', 'Performance'),
        scoreTextRight: `${data.performanceSummary?.average || 0}/100`,
        contentHTML: renderScoreSectionContent(
          data.devices,
          'performance',
          'score',
          data.recommendations,
          t('reports.mobile.performance', 'Performance'),
          [t('reports.mobile.loadTime', 'Load time'), t('reports.mobile.domContentLoaded', 'DOM content loaded'), t('reports.mobile.firstPaint', 'First paint')],
          data.performanceSummary?.average || 0
        )
      }),
      ReportAccordion.createSection({
        id: 'mobile-readability-summary',
        title: t('reports.mobile.readability', 'Readability'),
        scoreTextRight: `${data.readabilitySummary?.average || 0}/100`,
        contentHTML: renderScoreSectionContent(
          data.devices,
          'readability',
          'readabilityScore',
          data.recommendations,
          t('reports.mobile.readability', 'Readability'),
          [t('reports.mobile.bodyFontSize', 'Body font size'), t('reports.mobile.lineHeight', 'Line height'), t('reports.mobile.textContrast', 'Text contrast')],
          data.readabilitySummary?.average || 0
        )
      }),
      ReportAccordion.createSection({
        id: 'mobile-accessibility-summary',
        title: t('reports.mobile.accessibility', 'Accessibility'),
        scoreTextRight: `${data.accessibilitySummary?.average || 0}/100`,
        contentHTML: renderScoreSectionContent(
          data.devices,
          'accessibility',
          'a11yScore',
          data.recommendations,
          t('reports.mobile.accessibility', 'Accessibility'),
          [t('reports.mobile.altTextCoverage', 'Alt text coverage'), t('reports.mobile.headingHierarchy', 'Heading hierarchy'), t('reports.mobile.contrastChecks', 'Contrast checks')],
          data.accessibilitySummary?.average || 0
        )
      })
    ];

    // Build accordions
    const accordions = [
      ReportAccordion.createSection({ id: 'mobile-screenshots', title: t('reports.mobile.deviceScreenshots', 'Device Screenshots'), scoreTextRight: `${Object.keys(data.devices).length} ${t('reports.mobile.devices', 'Devices')}`, contentHTML: screenshotsContent }),
      ...majorScoreSections,
      ...diagnosticsContent,
      ReportAccordion.createSection({
        id: 'report-recommendations',
        title: t('reports.common.reportRecommendations', 'Recommendations'),
        scoreTextRight: null,
        isPro: true,
        locked: proLocked,
        context: 'mobile',
        reportId,
        contentHTML: recommendationsContent
      }),
      ReportAccordion.createSection({
        id: 'ai-strategic-analysis',
        title: t('reports.ai.strategicTitle', 'AI Strategic Analysis'),
        isPro: true, locked: proLocked, context: 'mobile', reportId,
        scoreTextRight: null,
        contentHTML: '<div id="ai-strategic-content">' + (window.AIRecommendations && window.AIRecommendations.renderLoadingAnimation ? window.AIRecommendations.renderLoadingAnimation() : '<div style="padding:1.5rem;text-align:center;color:var(--r-text-muted,#6B7280);">' + t('reports.ai.loading', 'Analyzing your results...') + '</div>') + '</div>'
      })
    ].join('');
    
    // Summary stats
    const issuesCount = data.recommendations.filter(r => r.severity === 'high').length;
    const summaryStats = {
      issues: issuesCount,
      recommendations: data.recommendations.length,
      checks: Object.keys(data.devices).length
    };
    
    const html = `
      ${ReportShell.renderReportHeader({ title: t('reports.mobile.title', 'Mobile Testing Report'), url, timestamp, badgeText: t('reports.mobile.badge', 'Mobile'), mode: 'mobile' })}
      ${screenshotHtml}
      ${summaryDonuts}
      ${accordions}
      ${renderMobileSummarySection(summaryStats)}
      ${renderMobileTakeActionSection(url, reportId)}
    `;
    
    resultsContent.innerHTML = `<div class="report-scope">${html}</div>`;
    window.mobileData = data;
    window.currentMobileResults = data;  // For billing return restoration

    // Attach screenshot onerror and lightbox handlers (CSP-safe, no inline handlers)
    const ssImg = resultsContent.querySelector('.screenshot-section .screenshot-item__img');
    if (ssImg) {
      ssImg.addEventListener('error', function () {
        this.parentElement.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted, #666);">' + screenshotUnavailableLabel + '</div>';
      });
      ssImg.addEventListener('click', function () {
        const ssUrl = this.getAttribute('data-screenshot-url');
        const ssTitle = this.getAttribute('data-screenshot-title');
        if (ssUrl && window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
          window.ScreenshotLightbox.open(ssUrl, ssTitle || t('reports.common.screenshot', 'Screenshot'));
        }
      });
    }

    // Fetch AI strategic analysis content
    if (window.AIRecommendations) {
      const locale = document.documentElement.lang || (window.i18n && window.i18n.locale) || 'en';
      window.AIRecommendations.fetchAndRender('ai-strategic-content', reportId, 'mobile', data, locale, { skipHeader: true });
    }
    if (window.SelfImprovement) {
      window.SelfImprovement.integrate({ data: data, analyzerType: 'mobile', donutLabels: {}, resultsContent: resultsContent, reportId: reportId });
    }

    ReportAccordion.initInteractions();

    if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function' && reportId) {
      window.CreditsManager.renderPaywallState(reportId);
    }

    // Auto-save report if user has access (purchased or Pro)
    if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
      window.ReportStorage.autoSaveIfEligible(reportId, data, {
        siteUrl: url,
        analyzerType: 'mobile-analyzer',
        scannedAt: window.SM_SCAN_STARTED_AT || new Date().toISOString()
      });
    }
  }

  // Expose display function globally for billing return handler
  window.displayMobileResults = displayResults;

  function formatScore(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return '0.00';
    return numeric.toFixed(2);
  }

  function renderDeviceScoreBreakdown(devices = {}, metricKey, scoreKey, averageScore = 0) {
    const items = Object.entries(devices)
      .filter(([, device]) => device?.[metricKey]?.[scoreKey] !== undefined)
      .map(([, device]) => ({
        name: device.device || t('reports.mobile.device', 'Device'),
        score: device[metricKey][scoreKey]
      }));

    const scores = items.map(item => Number(item.score) || 0);
    const avg = scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length) : 0;
    const min = scores.length ? Math.min(...scores) : 0;
    const max = scores.length ? Math.max(...scores) : 0;

    if (items.length === 0) {
      return `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            ${t('reports.mobile.noPerDeviceScores', 'No per-device scores available. Using overall average for this category:')} <strong>${formatScore(averageScore)}/100</strong>.
          </div>
        </div>
      `;
    }

    return `
      <div class="report-shell__card">
        <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px; display: grid; gap: 0.75rem;">
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
            <div>${t('reports.mobile.avg', 'Avg')}: <strong style="color: var(--text-primary);">${formatScore(avg)}/100</strong></div>
            <div>${t('reports.mobile.best', 'Best')}: <strong style="color: var(--text-primary);">${formatScore(max)}/100</strong></div>
            <div>${t('reports.mobile.lowest', 'Lowest')}: <strong style="color: var(--text-primary);">${formatScore(min)}/100</strong></div>
          </div>
          ${items.map(item => {
            const safeScore = Math.max(0, Math.min(100, Number(item.score) || 0));
            const barColor = safeScore >= 90 ? '#22c55e' : safeScore >= 70 ? '#eab308' : '#ef4444';
            return `
              <div style="display: grid; grid-template-columns: 120px 1fr 48px; gap: 0.75rem; align-items: center;">
                <span>${item.name}</span>
                <div style="height: 8px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden;">
                  <div style="width: ${safeScore}%; height: 100%; background: ${barColor};"></div>
                </div>
                <strong>${formatScore(safeScore)}/100</strong>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderScoreSectionContent(devices, metricKey, scoreKey, recommendations = [], categoryLabel, criteria = [], summaryAverage = 0) {
    const deviceEntries = Object.entries(devices || {});
    const items = deviceEntries
      .filter(([, device]) => device?.[metricKey]?.[scoreKey] !== undefined)
      .map(([, device]) => ({
        name: device.device || t('reports.mobile.device', 'Device'),
        score: device[metricKey][scoreKey]
      }));
    const scores = items.map(item => Number(item.score) || 0);
    const avg = scores.length ? (scores.reduce((sum, value) => sum + value, 0) / scores.length) : Number(summaryAverage) || 0;
    const min = scores.length ? Math.min(...scores) : 0;
    const max = scores.length ? Math.max(...scores) : 0;
    const spread = scores.length ? Math.max(0, max - min) : 0;
    const missingCount = Math.max(0, deviceEntries.length - items.length);
    const lowestDevices = items
      .slice()
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 2);
    const highestDevices = items
      .slice()
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 2);

    const breakdown = renderDeviceScoreBreakdown(devices, metricKey, scoreKey, avg);
    const categoryRecs = recommendations.filter(rec => rec.category === categoryLabel).slice(0, 3);

    const criteriaList = criteria.length
      ? `<ul style="margin: 0.25rem 0 0.75rem 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
          ${criteria.map(item => `<li>${item}</li>`).join('')}
        </ul>`
      : '';

    const recList = categoryRecs.length
      ? `<div style="display: grid; gap: 0.4rem;">
           ${categoryRecs.map(rec => `
             <div style="padding: 0.5rem 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.04);">
               <div style="font-weight: 600;">${rec.title}</div>
               <div style="color: var(--text-tertiary); font-size: 0.85rem;">${rec.suggestion}</div>
             </div>
           `).join('')}
         </div>`
      : `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${t('reports.mobile.noMajorIssues', 'No major issues flagged for this category.')}</div>`;

    let extraInsights = '';
    if (metricKey === 'readability') {
      const readabilityItems = deviceEntries
        .map(([, device]) => ({
          name: device.device || t('reports.mobile.device', 'Device'),
          data: device.readability
        }))
        .filter(item => item.data && !item.data.error && item.data.totalElements);

      if (!readabilityItems.length) {
        extraInsights = `
          <div style="margin-top: 0.75rem; color: var(--text-tertiary); font-size: 0.85rem;">
            ${t('reports.mobile.readabilityNotAvailable', 'Readability details were not available for this scan. We will retry on the next run.')}
          </div>
        `;
      } else {
        const avgSmallFont = Math.round(readabilityItems.reduce((sum, item) => sum + (item.data.smallFontPercentage || 0), 0) / readabilityItems.length);
        const avgLineHeight = Math.round(readabilityItems.reduce((sum, item) => sum + (item.data.goodLineHeightPercentage || 0), 0) / readabilityItems.length);
        const totalElements = readabilityItems.reduce((sum, item) => sum + (item.data.totalElements || 0), 0);
        const worst = readabilityItems.slice().sort((a, b) => (b.data.smallFontPercentage || 0) - (a.data.smallFontPercentage || 0))[0];

        extraInsights = `
          <div style="margin-top: 0.75rem; display: grid; gap: 0.5rem;">
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
              <div>${t('reports.mobile.smallText', 'Small text')}: <strong style="color: var(--text-primary);">${avgSmallFont}%</strong></div>
              <div>${t('reports.mobile.goodLineHeight', 'Good line height')}: <strong style="color: var(--text-primary);">${avgLineHeight}%</strong></div>
              <div>${t('reports.mobile.elementsChecked', 'Elements checked')}: <strong style="color: var(--text-primary);">${totalElements}</strong></div>
            </div>
            ${worst ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${t('reports.mobile.mostSmallTextOn', 'Most small text on')}: <strong style="color: var(--text-primary);">${worst.name}</strong> (${Math.round(worst.data.smallFontPercentage || 0)}%).</div>` : ''}
          </div>
        `;
      }
    }

    if (metricKey === 'performance') {
      const perfItems = deviceEntries
        .map(([, device]) => ({
          name: device.device || t('reports.mobile.device', 'Device'),
          data: device.performance
        }))
        .filter(item => item.data && !item.data.error);

      if (!perfItems.length) {
        extraInsights = `
          <div style="margin-top: 0.75rem; color: var(--text-tertiary); font-size: 0.85rem;">
            ${t('reports.mobile.performanceNotCaptured', 'Performance timing metrics were not captured. Using score-only analysis.')}
          </div>
        `;
      } else {
        const avgDom = Math.round(perfItems.reduce((sum, item) => sum + (item.data.domContentLoaded || 0), 0) / perfItems.length);
        const avgLoad = Math.round(perfItems.reduce((sum, item) => sum + (item.data.loadComplete || 0), 0) / perfItems.length);
        const avgFcp = Math.round(perfItems.reduce((sum, item) => sum + (item.data.firstContentfulPaint || 0), 0) / perfItems.length);
        const slowest = perfItems.slice().sort((a, b) => (b.data.loadComplete || 0) - (a.data.loadComplete || 0))[0];

        extraInsights = `
          <div style="margin-top: 0.75rem; display: grid; gap: 0.5rem;">
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
              <div>${t('reports.mobile.avgDomReady', 'Avg DOM ready')}: <strong style="color: var(--text-primary);">${avgDom}ms</strong></div>
              <div>${t('reports.mobile.avgLoad', 'Avg load')}: <strong style="color: var(--text-primary);">${avgLoad}ms</strong></div>
              <div>${t('reports.mobile.avgFcp', 'Avg FCP')}: <strong style="color: var(--text-primary);">${avgFcp}ms</strong></div>
            </div>
            ${slowest ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${t('reports.mobile.slowestLoad', 'Slowest load')}: <strong style="color: var(--text-primary);">${slowest.name}</strong> (${Math.round(slowest.data.loadComplete || 0)}ms).</div>` : ''}
          </div>
        `;
      }
    }

    if (metricKey === 'accessibility') {
      const a11yItems = deviceEntries
        .map(([, device]) => ({
          name: device.device || t('reports.mobile.device', 'Device'),
          data: device.accessibility
        }))
        .filter(item => item.data && !item.data.error);

      if (!a11yItems.length) {
        extraInsights = `
          <div style="margin-top: 0.75rem; color: var(--text-tertiary); font-size: 0.85rem;">
            ${t('reports.mobile.accessibilityNotCaptured', 'Accessibility detail checks were not captured. Using score-only analysis.')}
          </div>
        `;
      } else {
        const totalImages = a11yItems.reduce((sum, item) => sum + (item.data.totalImages || 0), 0);
        const missingAlt = a11yItems.reduce((sum, item) => sum + (item.data.missingAlt || 0), 0);
        const headingIssues = a11yItems.filter(item => item.data.headingIssues).length;
        const altCoverage = totalImages ? Math.round(((totalImages - missingAlt) / totalImages) * 100) : 0;

        extraInsights = `
          <div style="margin-top: 0.75rem; display: grid; gap: 0.5rem;">
            <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.75rem; font-size: 0.85rem; color: var(--text-tertiary);">
              <div>${t('reports.mobile.altCoverage', 'Alt coverage')}: <strong style="color: var(--text-primary);">${altCoverage}%</strong></div>
              <div>${t('reports.mobile.imagesMissingAlt', 'Images missing alt')}: <strong style="color: var(--text-primary);">${missingAlt}</strong></div>
              <div>${t('reports.mobile.headingIssues', 'Heading issues')}: <strong style="color: var(--text-primary);">${headingIssues}</strong></div>
            </div>
          </div>
        `;
      }
    }

    const coverageLine = deviceEntries.length
      ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${t('reports.mobile.coverage', 'Coverage')}: ${items.length}/${deviceEntries.length} ${t('reports.mobile.devicesScored', 'devices scored')}${missingCount ? ` (${t('reports.mobile.missing', 'missing')} ${missingCount})` : ''}.</div>`
      : '';

    const varianceLine = scores.length
      ? `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${t('reports.mobile.scoreSpread', 'Score spread')}: ${formatScore(spread)} ${t('reports.mobile.points', 'points')} (${t('reports.mobile.best', 'Best')} ${formatScore(max)}/100, ${t('reports.mobile.lowest', 'Lowest')} ${formatScore(min)}/100).</div>`
      : `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${t('reports.mobile.scoreSpreadNotAvailable', 'Score spread not available. Using summary average')} ${formatScore(avg)}/100.</div>`;

    const deviceHighlights = scores.length
      ? `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.5rem; margin-top: 0.5rem;">
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${t('reports.mobile.lowestScoring', 'Lowest scoring')}</div>
            ${lowestDevices.map(item => `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${item.name}: ${formatScore(item.score || 0)}/100</div>`).join('')}
          </div>
          <div>
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${t('reports.mobile.highestScoring', 'Highest scoring')}</div>
            ${highestDevices.map(item => `<div style="color: var(--text-tertiary); font-size: 0.85rem;">${item.name}: ${formatScore(item.score || 0)}/100</div>`).join('')}
          </div>
        </div>`
      : '';

    return `
      <div style="display: grid; gap: 0.75rem;">
        ${breakdown}
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <div style="font-weight: 600; margin-bottom: 0.35rem;">${t('reports.mobile.whyThisScore', 'Why this score?')}</div>
            <div style="color: var(--text-tertiary); font-size: 0.9rem;">${t('reports.mobile.measuredOnDevice', 'Measured on-device using the selected viewport(s).')}</div>
            ${coverageLine}
            ${varianceLine}
            ${deviceHighlights}
            ${extraInsights}
            ${criteriaList}
            <div style="font-weight: 600; margin: 0.75rem 0 0.35rem;">${t('reports.mobile.topFactors', 'Top factors')}</div>
            ${recList}
          </div>
        </div>
      </div>
    `;
  }

  function createAllDiagnosticSections(data, firstDevice) {
    const sections = [];
    
    // Viewport Meta Tag
    sections.push(ReportAccordion.createSection({
      id: 'mobile-viewport',
      title: t('reports.mobile.viewportMetaTag', 'Viewport Meta Tag'),
      scoreTextRight: `${firstDevice.viewportMetaTag?.score || 0}/100`,
      contentHTML: `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <strong>${t('reports.mobile.status', 'Status')}:</strong> ${firstDevice.viewportMetaTag?.present ? `✅ ${t('reports.mobile.present', 'Present')}` : `❌ ${t('reports.mobile.missingStatus', 'Missing')}`}<br>
            ${firstDevice.viewportMetaTag?.content ? `<strong>${t('reports.mobile.content', 'Content')}:</strong> <code style="background: var(--r-surface-2, #F8FAFC); padding: 0.25rem 0.5rem; border-radius: 4px;">${firstDevice.viewportMetaTag.content}</code>` : ''}
          </div>
        </div>
      `
    }));
    
    // PWA Readiness
    sections.push(ReportAccordion.createSection({
      id: 'mobile-pwa',
      title: t('reports.mobile.pwaReadiness', 'PWA Readiness'),
      scoreTextRight: `${firstDevice.pwaReadiness?.score || 0}/100`,
      contentHTML: `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            ${firstDevice.pwaReadiness?.manifest ? '✅' : '❌'} ${t('reports.mobile.manifest', 'Manifest')}: ${firstDevice.pwaReadiness?.manifest || t('reports.mobile.missingStatus', 'Missing')}<br>
            ${firstDevice.pwaReadiness?.serviceWorker ? '✅' : '❌'} ${t('reports.mobile.serviceWorker', 'Service Worker')}: ${firstDevice.pwaReadiness?.serviceWorker || t('reports.mobile.notRegistered', 'Not registered')}
          </div>
        </div>
      `
    }));
    
    // Dark Mode Support
    sections.push(ReportAccordion.createSection({
      id: 'mobile-darkmode',
      title: t('reports.mobile.darkModeSupport', 'Dark Mode Support'),
      scoreTextRight: `${firstDevice.darkModeSupport?.score || 0}/100`,
      contentHTML: `
        <div class="report-shell__card">
          <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <strong>${t('reports.mobile.support', 'Support')}:</strong> ${firstDevice.darkModeSupport?.supported ? `✅ ${t('reports.mobile.supported', 'Supported')}` : `❌ ${t('reports.mobile.notDetected', 'Not detected')}`}
          </div>
        </div>
      `
    }));
    
    // Above the fold content
    if (firstDevice.aboveTheFoldContent) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-fold',
        title: t('reports.mobile.aboveTheFold', 'Above the Fold'),
        scoreTextRight: `${firstDevice.aboveTheFoldContent.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>${t('reports.mobile.visibleContent', 'Visible Content')}:</strong> ${firstDevice.aboveTheFoldContent.visibleElements || 0} ${t('reports.mobile.elements', 'elements')}<br>
              <strong>${t('reports.mobile.images', 'Images')}:</strong> ${firstDevice.aboveTheFoldContent.images || 0}<br>
              <strong>${t('reports.mobile.textElements', 'Text Elements')}:</strong> ${firstDevice.aboveTheFoldContent.textElements || 0}
            </div>
          </div>
        `
      }));
    }
    
    // Mobile SEO
    if (firstDevice.mobileSeo) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-seo',
        title: t('reports.mobile.mobileSeo', 'Mobile SEO'),
        scoreTextRight: `${firstDevice.mobileSeo.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              ${firstDevice.mobileSeo.canonical ? '✅' : '❌'} ${t('reports.mobile.canonicalUrl', 'Canonical URL')}<br>
              ${firstDevice.mobileSeo.robotsMeta ? '✅' : '❌'} ${t('reports.mobile.robotsMeta', 'Robots Meta')}<br>
              ${firstDevice.mobileSeo.structuredData ? '✅' : '❌'} ${t('reports.mobile.structuredData', 'Structured Data')}
            </div>
          </div>
        `
      }));
    }
    
    // Input Fields
    if (firstDevice.inputFields) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-inputs',
        title: t('reports.mobile.inputFields', 'Input Fields'),
        scoreTextRight: `${firstDevice.inputFields.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>${t('reports.mobile.total', 'Total')}:</strong> ${firstDevice.inputFields.total || 0}<br>
              <strong>${t('reports.mobile.withAutocomplete', 'With autocomplete')}:</strong> ${firstDevice.inputFields.withAutocomplete || 0}<br>
              <strong>${t('reports.mobile.withLabels', 'With labels')}:</strong> ${firstDevice.inputFields.withLabels || 0}
            </div>
          </div>
        `
      }));
    }
    
    // Touch Targets
    if (firstDevice.touchTargets) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-touch',
        title: t('reports.mobile.touchTargets', 'Touch Targets'),
        scoreTextRight: `${Math.round((firstDevice.touchTargets.compliant || 0) / (firstDevice.touchTargets.total || 1) * 100)}%`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>${t('reports.mobile.totalElements', 'Total elements')}:</strong> ${firstDevice.touchTargets.total || 0}<br>
              <strong>${t('reports.mobile.compliant', 'Compliant')} (≥48px):</strong> ${firstDevice.touchTargets.compliant || 0}<br>
              <strong>${t('reports.mobile.nonCompliant', 'Non-compliant')}:</strong> ${firstDevice.touchTargets.nonCompliant || 0}
            </div>
          </div>
        `
      }));
    }
    
    // Performance Metrics
    if (firstDevice.performanceMetrics) {
      sections.push(ReportAccordion.createSection({
        id: 'mobile-performance',
        title: t('reports.mobile.performanceMetrics', 'Performance Metrics'),
        scoreTextRight: `${firstDevice.performanceMetrics.score || 0}/100`,
        contentHTML: `
          <div class="report-shell__card">
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
              <strong>${t('reports.mobile.loadTimeLabel', 'Load Time')}:</strong> ${firstDevice.performanceMetrics.loadTime || 'N/A'}<br>
              <strong>${t('reports.mobile.domContentLoadedLabel', 'DOM Content Loaded')}:</strong> ${firstDevice.performanceMetrics.domContentLoaded || 'N/A'}<br>
              <strong>${t('reports.mobile.firstPaintLabel', 'First Paint')}:</strong> ${firstDevice.performanceMetrics.firstPaint || 'N/A'}
            </div>
          </div>
        `
      }));
    }
    
    return sections;
  }
  
  function renderMobileSummarySection(stats) {
    return `
      <div class="section">
        <h2>${t('reports.common.summary', 'Summary')}</h2>
        <div class="seo-summary">
          <div class="summary-stats">
            <div class="stat-item">
              <span class="stat-value">${stats.issues}</span>
              <span class="stat-label">${t('reports.common.issuesFound', 'Issues Found')}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.recommendations}</span>
              <span class="stat-label">${t('reports.common.recommendations', 'Recommendations')}</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">${stats.checks}</span>
              <span class="stat-label">${t('reports.common.checksPassed', 'Checks Passed')}</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  function renderMobileTakeActionSection(url, reportId = '') {
    // Use new ProReportBlock component if available
    if (window.ProReportBlock && window.ProReportBlock.render) {
      return `
        <div class="section">
          ${window.ProReportBlock.render({
            context: 'mobile',
            features: ['pdf', 'excel', 'csv', 'share'],
            title: t('reports.common.purchaseReport', 'Purchase Report'),
            subtitle: t('reports.common.purchaseReportSubtitle', 'Client-ready exports (PDF/share/data) for this scan.'),
            reportId: reportId || null
          })}
        </div>
      `;
    } else {
      const opts = { context: 'mobile', features: ['pdf', 'excel', 'csv', 'share'], title: 'Purchase Report', subtitle: 'Client-ready exports (PDF/share/data) for this scan.' };
      const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
      return '<div class="section"><div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div></div>';
    }
  }
  
  // Export functions using unified PDF export (server-side Puppeteer)
  window.exportMobilePDF = async function() {
    if (typeof window.exportReportPDF === 'function') {
      const button = document.querySelector('[data-export="pdf"]') ||
                     document.querySelector('button[onclick*="exportMobilePDF"]');
      await window.exportReportPDF({
        reportType: 'mobile',
        buttonElement: button
      });
    } else {
      console.error('PDF export utility not loaded');
      alert(t('reports.common.pdfNotAvailable', 'PDF export is not available. Please refresh the page.'));
    }
  };
  window.copyMobileShareLink = function() { alert(t('reports.common.shareLinkComingSoon', 'Share link coming soon')); };
  window.downloadMobileCSV = function() { alert(t('reports.common.csvExportComingSoon', 'CSV export coming soon')); };

  function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'warning';
    return 'error';
  }

  function getScoreColor(score) {
    const stops = [
      [0,'#E53935'],[5,'#E14127'],[10,'#DD4E1A'],[15,'#DA5B0E'],
      [20,'#D96A06'],[25,'#E07E00'],[30,'#E89200'],[35,'#F0A400'],
      [40,'#F5B300'],[45,'#FAC200'],[50,'#FFD000'],[55,'#FFD600'],
      [60,'#FFDC00'],[65,'#FFE100'],[70,'#F0DD00'],[75,'#D2D400'],
      [80,'#A0C800'],[85,'#6BBD28'],[90,'#38B249'],[95,'#1FAD4F'],
      [100,'#0AA64F']
    ];
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const idx = Math.min(Math.floor(s / 5), 19);
    const [s1, c1] = stops[idx];
    const [, c2] = stops[Math.min(idx + 1, 20)];
    const t = (s - s1) / 5;
    const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = p(c1);
    const [r2,g2,b2] = p(c2);
    const r = Math.round(r1+(r2-r1)*t);
    const g = Math.round(g1+(g2-g1)*t);
    const b = Math.round(b1+(b2-b1)*t);
    return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
  }

  function getScoreRGB(score) {
    if (score >= 80) return '16, 185, 129';
    if (score >= 60) return '245, 158, 11';
    return '239, 68, 68';
  }

  /**
   * Add ASCII art patience message to loading container
                          <div style="border: 4px solid #333; border-radius: 12px; padding: 4px; background: #1a1a1a;">
                            <img src="${device.screenshot}" alt="${device.device} portrait" 
                                 style="width: 120px; height: auto; border-radius: 12px; cursor: zoom-in;"
                                 class="device-screenshot" />
                          </div>
                          <div class="orientation-label">${t('reports.mobile.portrait', 'Portrait')}<br>${device.viewport.width}×${device.viewport.height}</div>
                          <div class="screenshot-zoom-hint" style="margin-top: 0.5rem; cursor: pointer; color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;" data-action="click-screenshot">
                            🔍 <span style="text-decoration: underline;">${t('reports.mobile.clickToEnlarge', 'Click to enlarge')}</span>
                          </div>
                        </div>
                      ` : ''}
                      ${device.landscapeScreenshot ? `
                        <div class="orientation-item">
                          <div style="border: 4px solid #333; border-radius: 12px; padding: 4px; background: #1a1a1a;">
                            <img src="${device.landscapeScreenshot}" alt="${device.device} landscape" 
                                 style="width: 180px; height: auto; border-radius: 12px; cursor: zoom-in;"
                                 class="device-screenshot" />
                          </div>
                          <div class="orientation-label">${t('reports.mobile.landscape', 'Landscape')}<br>${device.viewport.height}×${device.viewport.width}</div>
                          <div class="screenshot-zoom-hint" style="margin-top: 0.5rem; cursor: pointer; color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;" data-action="click-screenshot">
                            🔍 <span style="text-decoration: underline;">${t('reports.mobile.clickToEnlarge', 'Click to enlarge')}</span>
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 2. Viewport Meta Tag Analysis -->
        ${firstDevice.viewportMeta ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">📐</span>
              <span class="accordion-title">${t('reports.mobile.viewportMetaTag', 'Viewport Meta Tag')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.viewportMeta.score)}">${firstDevice.viewportMeta.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.metaTagPresent', 'Meta Tag Present')}:</span>
                <span class="metric-value">${firstDevice.viewportMeta.exists ? `✅ ${t('reports.common.yes', 'Yes')}` : `❌ ${t('reports.common.no', 'No')}`}</span>
              </div>
              ${firstDevice.viewportMeta.content ? `
                <div style="background: var(--r-surface-2, #F8FAFC); padding: 0.75rem; border-radius: 4px; margin: 0.5rem 0; font-family: monospace; font-size: 0.85rem;">
                  ${firstDevice.viewportMeta.content}
                </div>
              ` : ''}
              ${firstDevice.viewportMeta.issues?.length > 0 ? `
                <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">${t('reports.common.issuesFound', 'Issues Found')}:</h5>
                ${firstDevice.viewportMeta.issues.map(issue => `
                  <div class="issue-item issue-${issue.severity}">${issue.message}</div>
                `).join('')}
              ` : `<p style="color: #10b981;">✅ ${t('reports.mobile.noViewportIssues', 'No viewport issues detected')}</p>`}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 3. PWA Readiness -->
        ${firstDevice.pwaReadiness ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">📲</span>
              <span class="accordion-title">${t('reports.mobile.pwaReadiness', 'PWA Readiness')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.pwaReadiness.score)}">${firstDevice.pwaReadiness.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.installable', 'Installable')}:</span>
                <span class="metric-value">${firstDevice.pwaReadiness.installable ? `✅ ${t('reports.common.yes', 'Yes')}` : `❌ ${t('reports.common.no', 'No')}`}</span>
              </div>
              <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">${t('reports.mobile.pwaChecklist', 'PWA Checklist')}:</h5>
              ${firstDevice.pwaReadiness.checklist?.map(item => `
                <div class="checklist-item">
                  <span class="${item.status === 'pass' ? 'checklist-pass' : 'checklist-fail'}">
                    ${item.status === 'pass' ? '✓' : '✗'}
                  </span>
                  <span>${item.item}</span>
                </div>
              `).join('') || ''}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 4. Dark Mode Support -->
        ${firstDevice.darkModeSupport ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">🌙</span>
              <span class="accordion-title">${t('reports.mobile.darkModeSupport', 'Dark Mode Support')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.darkModeSupport.score)}">${firstDevice.darkModeSupport.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.darkModeSupported', 'Dark Mode Supported')}:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.supported ? `✅ ${t('reports.common.yes', 'Yes')}` : `❌ ${t('reports.common.no', 'No')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.prefersColorScheme', 'prefers-color-scheme')}:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.hasMediaQuery ? `✅ ${t('reports.mobile.detected', 'Detected')}` : `❌ ${t('reports.mobile.notFound', 'Not found')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.colorSchemeMeta', 'color-scheme meta')}:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.hasColorSchemeMeta ? `✅ ${firstDevice.darkModeSupport.colorSchemeValue || t('reports.mobile.present', 'Present')}` : `❌ ${t('reports.mobile.missingStatus', 'Missing')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.themeToggle', 'Theme Toggle')}:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.hasThemeToggle ? `✅ ${t('reports.mobile.found', 'Found')}` : `❌ ${t('reports.mobile.notFound', 'Not found')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.cssVariables', 'CSS Variables')}:</span>
                <span class="metric-value">${firstDevice.darkModeSupport.cssVariablesCount || 0} ${t('reports.mobile.defined', 'defined')}</span>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 5. Above the Fold Analysis -->
        ${firstDevice.aboveTheFold ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">👁️</span>
              <span class="accordion-title">${t('reports.mobile.aboveTheFold', 'Above the Fold')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.aboveTheFold.criticalContentScore)}">${firstDevice.aboveTheFold.criticalContentScore}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.headlineH1H2', 'Headline (H1/H2)')}:</span>
                <span class="metric-value">${firstDevice.aboveTheFold.hasHeadline ? `✅ ${t('reports.mobile.present', 'Present')}` : `❌ ${t('reports.mobile.missingStatus', 'Missing')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.heroImage', 'Hero Image')}:</span>
                <span class="metric-value">${firstDevice.aboveTheFold.hasHeroImage ? `✅ ${t('reports.mobile.present', 'Present')}` : `❌ ${t('reports.mobile.missingStatus', 'Missing')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.callToAction', 'Call-to-Action')}:</span>
                <span class="metric-value">${firstDevice.aboveTheFold.hasCTA ? `✅ ${t('reports.mobile.found', 'Found')}` : `⚠️ ${t('reports.mobile.notDetected', 'Not detected')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.imagesAboveFold', 'Images Above Fold')}:</span>
                <span class="metric-value">${firstDevice.aboveTheFold.imageCount || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.renderBlockingScripts', 'Render-blocking Scripts')}:</span>
                <span class="metric-value ${firstDevice.aboveTheFold.renderBlockingScripts > 3 ? 'color: #ef4444' : ''}">${firstDevice.aboveTheFold.renderBlockingScripts || 0}</span>
              </div>
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 6. Mobile SEO -->
        ${firstDevice.mobileSEO ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">🔍</span>
              <span class="accordion-title">${t('reports.mobile.mobileSeo', 'Mobile SEO')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.mobileSEO.score)}">${firstDevice.mobileSEO.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.titleTag', 'Title Tag')}:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasTitle ? `✅ ${firstDevice.mobileSEO.titleLength} ${t('reports.mobile.chars', 'chars')}` : `❌ ${t('reports.mobile.missingStatus', 'Missing')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.metaDescription', 'Meta Description')}:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasMetaDescription ? `✅ ${firstDevice.mobileSEO.descriptionLength} ${t('reports.mobile.chars', 'chars')}` : `❌ ${t('reports.mobile.missingStatus', 'Missing')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.viewportMeta', 'Viewport Meta')}:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasViewport ? `✅ ${t('reports.mobile.present', 'Present')}` : `❌ ${t('reports.mobile.missingStatus', 'Missing')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.canonicalUrl', 'Canonical URL')}:</span>
                <span class="metric-value">${firstDevice.mobileSEO.hasCanonical ? `✅ ${t('reports.mobile.set', 'Set')}` : `⚠️ ${t('reports.mobile.missingStatus', 'Missing')}`}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.structuredData', 'Structured Data')}:</span>
                <span class="metric-value">${firstDevice.mobileSEO.structuredDataCount || 0} ${t('reports.mobile.schemas', 'schemas')}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.clickToCallLinks', 'Click-to-Call Links')}:</span>
                <span class="metric-value">${firstDevice.mobileSEO.clickToCallLinks || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.h1Tags', 'H1 Tags')}:</span>
                <span class="metric-value">${firstDevice.mobileSEO.h1Count === 1 ? `✅ 1 (${t('reports.mobile.good', 'good')})` : `${firstDevice.mobileSEO.h1Count || 0} (${t('reports.mobile.shouldBeOne', 'should be 1')})`}</span>
              </div>
              ${firstDevice.mobileSEO.issues?.length > 0 ? `
                <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">${t('reports.common.issues', 'issues')}:</h5>
                ${firstDevice.mobileSEO.issues.map(issue => `
                  <div class="issue-item issue-${issue.type}">${issue.item}</div>
                `).join('')}
              ` : ''}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 7. Input Field Analysis -->
        ${firstDevice.inputAnalysis ? `
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">⌨️</span>
              <span class="accordion-title">${t('reports.mobile.inputFields', 'Input Fields')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(firstDevice.inputAnalysis.score)}">${firstDevice.inputAnalysis.score}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.totalInputs', 'Total Inputs')}:</span>
                <span class="metric-value">${firstDevice.inputAnalysis.total || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.emailInputs', 'Email Inputs (type=email)')}:</span>
                <span class="metric-value">${firstDevice.inputAnalysis.emailInputs || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.phoneInputs', 'Phone Inputs (type=tel)')}:</span>
                <span class="metric-value">${firstDevice.inputAnalysis.telInputs || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.autocompleteEnabled', 'Autocomplete Enabled')}:</span>
                <span class="metric-value">${firstDevice.inputAnalysis.autocompleteEnabled || 0}</span>
              </div>
              <div class="metric-row">
                <span class="metric-label">${t('reports.mobile.missingLabels', 'Missing Labels')}:</span>
                <span class="metric-value ${firstDevice.inputAnalysis.missingLabels > 0 ? 'color: #ef4444' : ''}">${firstDevice.inputAnalysis.missingLabels || 0}</span>
              </div>
              ${firstDevice.inputAnalysis.issues?.length > 0 ? `
                <h5 style="margin-top: 1rem; margin-bottom: 0.5rem;">${t('reports.mobile.optimizationSuggestions', 'Optimization Suggestions')}:</h5>
                ${firstDevice.inputAnalysis.issues.map(issue => `
                  <div class="issue-item issue-warning">${issue.field}: ${issue.issue}</div>
                `).join('')}
              ` : `<p style="color: #10b981; margin-top: 1rem;">✅ ${t('reports.mobile.inputFieldsWellOptimized', 'Input fields are well-optimized for mobile')}</p>`}
            </div>
          </div>
        </div>
        ` : ''}

        <!-- 8. Touch Targets -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">👆</span>
              <span class="accordion-title">${t('reports.mobile.touchTargets', 'Touch Targets')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(data.touchTargetsSummary.average)}">${data.touchTargetsSummary.average}%</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              <p style="color: var(--r-text-faint, #9CA3AF); margin-bottom: 1rem;">${t('reports.mobile.wcagTouchTargetRequirement', 'WCAG AAA requires touch targets to be at least 44x44 pixels.')}</p>
              ${Object.entries(data.devices).map(([key, device]) => {
                if (device.error || !device.touchTargets) return '';
                return `
                  <div style="margin-bottom: 1rem;">
                    <strong>${device.device}</strong>: ${device.touchTargets.compliancePercentage}% ${t('reports.mobile.compliant', 'Compliant')}
                    ${device.touchTargets.issues > 0 ? `<span style="color: #ef4444;"> (${device.touchTargets.issues} ${t('reports.mobile.undersized', 'undersized')})</span>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- 9. Performance Metrics -->
        <div class="accordion-item">
          <div class="accordion-header">
            <div class="accordion-header-left">
              <span class="accordion-icon">⚡</span>
              <span class="accordion-title">${t('reports.mobile.performanceMetrics', 'Performance Metrics')}</span>
            </div>
            <div class="accordion-header-right">
              <span class="accordion-score ${getScoreClass(data.performanceSummary.average)}">${data.performanceSummary.average}/100</span>
              <span class="accordion-chevron">▼</span>
            </div>
          </div>
          <div class="accordion-content">
            <div class="accordion-body">
              ${Object.entries(data.devices).map(([key, device]) => {
                if (device.error || !device.performance) return '';
                return `
                  <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
                    <strong style="color: #22c55e;">${device.device}</strong>
                    <div class="metric-row">
                      <span class="metric-label">${t('reports.mobile.firstPaintLabel', 'First Paint')}:</span>
                      <span class="metric-value">${device.performance.firstPaint}ms</span>
                    </div>
                    <div class="metric-row">
                      <span class="metric-label">${t('reports.mobile.firstContentfulPaint', 'First Contentful Paint')}:</span>
                      <span class="metric-value">${device.performance.firstContentfulPaint}ms</span>
                    </div>
                    <div class="metric-row">
                      <span class="metric-label">${t('reports.mobile.domContentLoadedLabel', 'DOM Content Loaded')}:</span>
                      <span class="metric-value">${device.performance.domContentLoaded}ms</span>
                    </div>
                    <div class="metric-row">
                      <span class="metric-label">${t('reports.mobile.pageLoadComplete', 'Page Load Complete')}:</span>
                      <span class="metric-value">${device.performance.loadComplete}ms</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

      </div>

      <!-- Recommendations -->
      ${data.recommendations.length > 0 ? `
        <h3 style="margin-top: 2rem; margin-bottom: 1rem;">💡 ${t('reports.common.recommendations', 'Recommendations')}</h3>
        ${data.recommendations.map(rec => `
          <div class="recommendation-card ${rec.severity}">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <strong>${rec.title}</strong>
              <span class="score-badge score-${rec.severity}" style="margin: 0;">
                ${rec.category}
              </span>
            </div>
            <div style="font-size: 0.9rem; color: var(--r-text-faint, #9CA3AF);">${rec.suggestion}</div>
          </div>
        `).join('')}
      ` : `<p style="color: var(--r-text-faint, #9CA3AF);">✅ ${t('reports.mobile.noSignificantIssues', 'Your site handles mobile devices well. See the device details above for fine-tuning opportunities.')}</p>`}
    `;

    resultsContent.innerHTML = html;
    window.mobileData = data;

    // Setup accordion using event delegation on resultsContent
    resultsContent.addEventListener('click', function(e) {
      // Find if we clicked on or inside an accordion-header
      const header = e.target.closest('.accordion-header');
      if (header) {
        // Don't toggle if clicking on a screenshot
        if (e.target.classList.contains('device-screenshot')) return;
        
        const item = header.closest('.accordion-item');
        if (item) {
          e.preventDefault();
          e.stopPropagation();
          item.classList.toggle('open');
        }
      }
    });

    // Setup screenshot modal click handlers
    const modal = document.getElementById('screenshotModal');
    const modalImage = document.getElementById('modalImage');
    const closeBtn = document.getElementById('screenshotModalClose');

    if (modal && modalImage) {
      const previousFocus = { el: null };

      const closeModal = () => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        modalImage.src = '';
        if (previousFocus.el && typeof previousFocus.el.focus === 'function' && document.contains(previousFocus.el)) {
          previousFocus.el.focus();
        }
      };

      const openModal = (imgEl) => {
        previousFocus.el = document.activeElement;
        modalImage.src = imgEl.src;
        modalImage.alt = imgEl.alt || t('reports.mobile.fullSizeScreenshot', 'Full size screenshot');
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        window.requestAnimationFrame(() => {
          if (closeBtn) closeBtn.focus();
          else modal.focus();
        });
      };

      // Avoid stacking duplicate handlers across rerenders
      if (modal.dataset.smWired !== 'true') {
        modal.dataset.smWired = 'true';

        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });

        document.addEventListener('keydown', (e) => {
          if (!modal.classList.contains('active')) return;

          if (e.key === 'Escape') {
            e.preventDefault();
            closeModal();
            return;
          }

          if (e.key !== 'Tab') return;

          const focusables = [closeBtn].filter(Boolean);
          if (!focusables.length) {
            e.preventDefault();
            modal.focus();
            return;
          }

          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        });
      }

      document.querySelectorAll('.device-screenshot img').forEach((imgEl) => {
        imgEl.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent accordion toggle
          openModal(imgEl);
        });
      });
    }
  }

  function getScoreClass(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'warning';
    return 'error';
  }

  function getScoreColor(score) {
    const stops = [
      [0,'#E53935'],[5,'#E14127'],[10,'#DD4E1A'],[15,'#DA5B0E'],
      [20,'#D96A06'],[25,'#E07E00'],[30,'#E89200'],[35,'#F0A400'],
      [40,'#F5B300'],[45,'#FAC200'],[50,'#FFD000'],[55,'#FFD600'],
      [60,'#FFDC00'],[65,'#FFE100'],[70,'#F0DD00'],[75,'#D2D400'],
      [80,'#A0C800'],[85,'#6BBD28'],[90,'#38B249'],[95,'#1FAD4F'],
      [100,'#0AA64F']
    ];
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const idx = Math.min(Math.floor(s / 5), 19);
    const [s1, c1] = stops[idx];
    const [, c2] = stops[Math.min(idx + 1, 20)];
    const t = (s - s1) / 5;
    const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = p(c1);
    const [r2,g2,b2] = p(c2);
    const r = Math.round(r1+(r2-r1)*t);
    const g = Math.round(g1+(g2-g1)*t);
    const b = Math.round(b1+(b2-b1)*t);
    return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
  }

  function getScoreRGB(score) {
    if (score >= 80) return '16, 185, 129';
    if (score >= 60) return '245, 158, 11';
    return '239, 68, 68';
  }

  /**
   * Add ASCII art patience message to loading container
   */
  function addPatienceMessage(container) {
    // Remove existing patience message if any
    const existing = document.getElementById('patience-message');
    if (existing) existing.remove();
    
    const patienceEl = document.createElement('div');
    patienceEl.id = 'patience-message';
    patienceEl.style.cssText = `
      margin: 0 0 1.5rem 0;
      padding: 1rem;
      background: rgba(var(--accent-primary-rgb), 0.05);
      border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    patienceEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: var(--accent-primary);">
        📱 ${t('reports.mobile.emulatingDevices', 'Emulating multiple mobile devices...')}<br>
        <span style="font-size: 0.75rem; color: rgba(var(--accent-primary-rgb), 0.8);">${t('reports.mobile.mayTake45to90', 'This may take 45-90 seconds')}</span>
      </div>
    `;
    
    // Add animations if not already added
    if (!document.getElementById('patience-animations')) {
      const style = document.createElement('style');
      style.id = 'patience-animations';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: var(--accent-primary); }
          20% { color: #00ffaa; }
          40% { color: #00aaff; }
          60% { color: #aa00ff; }
          80% { color: #ff00aa; }
          100% { color: var(--accent-primary); }
        }
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .ascii-art-responsive {
          font-size: clamp(0.35rem, 1.2vw, 0.65rem);
          white-space: pre;
          max-width: 100%;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Insert at the beginning of the loading container
    const loaderDiv = container.querySelector('.analyzer-loading');
    if (loaderDiv) {
      loaderDiv.insertBefore(patienceEl, loaderDiv.firstChild);
    } else {
      container.insertBefore(patienceEl, container.firstChild);
    }
  }

  // =========================================================================
  // Mobile Fix Accordion Functions - mirrors SEO pattern for consistency
  // =========================================================================

  function renderMobileFixes(recommendations) {
    if (!recommendations || recommendations.length === 0) {
      return `
        <div style="margin-top: 1rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 2rem;">
          <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
            <span style="font-size: 1.5rem;">✓</span> ${t('reports.mobile.excellentMobileExperience', 'Excellent Mobile Experience!')}
          </h3>
          <p style="color: #86efac; margin: 0;">${t('reports.mobile.followsBestPractices', 'Your site follows mobile best practices. Keep monitoring for continued success.')}</p>
        </div>
      `;
    }

    // Map severity to consistent format (error->High, warning->Medium, info->Low)
    const normalizedRecs = recommendations.map((rec, idx) => ({
      ...rec,
      id: `mobile-fix-${idx}`,
      severity: rec.severity === 'error' || rec.severity === 'high' ? 'High' :
                rec.severity === 'warning' || rec.severity === 'medium' ? 'Medium' : 'Low'
    }));

    // Group by severity
    const high = normalizedRecs.filter(r => r.severity === 'High');
    const medium = normalizedRecs.filter(r => r.severity === 'Medium');
    const low = normalizedRecs.filter(r => r.severity === 'Low');

    let html = `
      <div class="mobile-fixes-container" style="margin-top: 1rem;">
        <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
          <span style="font-size: 1.75rem;">📱</span> ${t('reports.mobile.mobileFixes', 'Mobile Fixes')}
          <span style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); font-weight: normal;">(${recommendations.length} ${t('reports.mobile.improvementsFound', 'improvements found')})</span>
        </h3>
        <div class="mobile-fixes-list">
    `;

    // Render all fixes grouped by severity
    const allFixes = [...high, ...medium, ...low];
    allFixes.forEach((fix, index) => {
      html += renderMobileFixAccordion(fix, index);
    });

    html += `</div></div>`;
    return html;
  }

  function renderMobileFixAccordion(fix, index) {
    const accordionId = `mobilefix-${fix.id || index}`;
    const severityColors = {
      High: { bg: 'rgba(255,68,68,0.1)', border: '#ef4444', color: '#ef4444', icon: '🔴' },
      Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
      Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
    };
    const style = severityColors[fix.severity] || severityColors.Medium;

    return `
      <div class="mobile-fix-accordion" data-fix-id="${accordionId}" style="
        border: 1px solid ${style.border}33;
        border-radius: 12px;
        margin-bottom: 1rem;
        overflow: hidden;
        background: ${style.bg};
      ">
        <div class="mobile-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          cursor: pointer;
          transition: background 0.2s;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-size: 1.25rem;">${style.icon}</span>
            <div>
              <h4 style="margin: 0; font-size: 1rem; color: var(--r-text, #111827);">${fix.title}</h4>
              <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${fix.category || t('reports.mobile.mobileOptimization', 'Mobile Optimization')}</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="
              padding: 0.25rem 0.75rem;
              border-radius: 999px;
              font-size: 0.75rem;
              font-weight: 600;
              background: ${style.color}20;
              color: ${style.color};
              border: 1px solid ${style.color}40;
            ">${t('reports.common.severity.' + fix.severity.toLowerCase(), fix.severity.toUpperCase())}</span>
            <span class="mobile-fix-expand-icon" style="color: var(--r-text-faint, #9CA3AF); transition: transform 0.3s;">▼</span>
          </div>
        </div>

        <div class="mobile-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
          <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
            ${renderMobileFixTabs(fix, accordionId)}
          </div>
        </div>
      </div>
    `;
  }

  function renderMobileFixTabs(fix, accordionId) {
    const codeExamples = getMobileFixCode(fix);

    return `
      <div class="mobile-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
        <button class="mobile-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
          padding: 0.5rem 1rem;
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 6px;
          background: rgba(255,255,255,0.1);
          color: var(--r-text, #111827);
          cursor: pointer;
          font-size: 0.85rem;
        ">📋 ${t('reports.common.tabs.summary', 'Summary')}</button>
        <button class="mobile-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="code" style="
          padding: 0.5rem 1rem;
          border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
          border-radius: 6px;
          background: transparent;
          color: var(--r-text-faint, #9CA3AF);
          cursor: pointer;
          font-size: 0.85rem;
        ">💻 ${t('reports.common.tabs.code', 'Code')}</button>
        <button class="mobile-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
          padding: 0.5rem 1rem;
          border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
          border-radius: 6px;
          background: transparent;
          color: var(--r-text-faint, #9CA3AF);
          cursor: pointer;
          font-size: 0.85rem;
        ">🔧 ${t('reports.common.tabs.fixGuide', 'Fix Guide')}</button>
      </div>

      <!-- Summary Tab -->
      <div class="mobile-fix-tab-content active" id="${accordionId}-summary">
        <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin: 0 0 1rem 0;">
          ${fix.suggestion || fix.description || t('reports.mobile.reviewAndAddress', 'Review and address this mobile optimization issue.')}
        </p>
        <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #22c55e; padding: 0.75rem; border-radius: 4px;">
          <div style="color: #22c55e; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('reports.common.fix.expectedImpact', 'Expected Impact')}</div>
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${getMobileFixImpact(fix)}</div>
        </div>
      </div>

      <!-- Code Tab -->
      <div class="mobile-fix-tab-content" id="${accordionId}-code" style="display: none;">
        <div style="display: grid; gap: 1rem;">
          <!-- Current Issue -->
          <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
              <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ ${t('reports.common.fix.currentIssue', 'Current Issue')}</span>
              <button data-action="copy-code" data-copy-target="${accordionId}-problem" style="
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.05);
                color: var(--r-text, #111827);
                cursor: pointer;
                font-size: 0.75rem;
              ">📋 ${t('reports.common.copy', 'Copy')}</button>
            </div>
            <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlForMobile(codeExamples.problem)}</pre>
          </div>

          <!-- Fixed Code -->
          <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
              <span style="color: #22c55e; font-weight: 600; font-size: 0.85rem;">✅ ${t('reports.common.fix.recommendedFix', 'Recommended Fix')}</span>
              <button data-action="copy-code" data-copy-target="${accordionId}-solution" style="
                padding: 0.25rem 0.75rem;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.2);
                background: rgba(255,255,255,0.05);
                color: var(--r-text, #111827);
                cursor: pointer;
                font-size: 0.75rem;
              ">📋 ${t('reports.common.copy', 'Copy')}</button>
            </div>
            <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlForMobile(codeExamples.solution)}</pre>
          </div>
        </div>
      </div>

      <!-- Fix Guide Tab -->
      <div class="mobile-fix-tab-content" id="${accordionId}-guide" style="display: none;">
        <h5 style="margin: 0 0 1rem 0; color: var(--r-text, #111827);">${t('reports.common.fix.stepByStepFix', 'Step-by-Step Fix:')}</h5>
        <ol style="margin: 0; padding-left: 1.5rem; color: var(--r-text-muted, #6B7280); line-height: 1.8;">
          ${getMobileFixSteps(fix).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
        </ol>
      </div>
    `;
  }

  function escapeHtmlForMobile(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getMobileFixCode(fix) {
    const codeMap = {
      'Touch targets below WCAG minimum': {
        problem: `/* Current: Touch targets too small */
.button, .link {
  padding: 4px 8px;
  font-size: 12px;
}

/* Issues: */
/* ✗ Touch target smaller than 44×44px */
/* ✗ Difficult to tap on mobile devices */
/* ✗ Fails WCAG 2.5.5 Target Size */`,
        solution: `/* Fixed: Proper touch target sizing */
.button, .link {
  min-height: 44px;
  min-width: 44px;
  padding: 12px 16px;
  font-size: 16px;
}

/* Best practices: */
/* ✓ Minimum 44×44px touch targets */
/* ✓ 48×48px recommended for primary actions */
/* ✓ 8px minimum spacing between targets */`
      },
      'Some text is too small on mobile': {
        problem: `/* Current: Text too small for mobile */
body {
  font-size: 12px;
}

p, span {
  font-size: 10px;
  line-height: 1.2;
}

/* Issues: */
/* ✗ Base font under 16px causes zoom on iOS */
/* ✗ Poor readability at arm's length */`,
        solution: `/* Fixed: Mobile-friendly typography */
body {
  font-size: 16px; /* Prevents iOS zoom */
  -webkit-text-size-adjust: 100%;
}

p, span {
  font-size: 1rem; /* 16px base */
  line-height: 1.5;
}

@media (max-width: 768px) {
  body { font-size: 16px; }
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.5rem; }
}`
      },
      'Mobile performance is below recommended': {
        problem: `<!-- Current: Unoptimized resources -->
<head>
  <link rel="stylesheet" href="/all-styles.css">
  <script src="/bundle.js"></script>
</head>

<img src="/hero.png" width="1920">

<!-- Issues: -->
<!-- ✗ Render-blocking resources -->
<!-- ✗ Unoptimized images -->
<!-- ✗ No lazy loading -->`,
        solution: `<!-- Fixed: Optimized for mobile -->
<head>
  <link rel="preload" as="image" href="/hero.webp">
  <link rel="stylesheet" href="/critical.css">
  <link rel="stylesheet" href="/styles.css" media="print" onload="this.media='all'">
  <script src="/bundle.js" defer></script>
</head>

<img src="/hero.webp"
     srcset="/hero-400.webp 400w, /hero-800.webp 800w"
     sizes="(max-width: 768px) 100vw, 800px"
     loading="lazy"
     decoding="async">`
      },
      'Accessibility issues detected': {
        problem: `<!-- Current: Accessibility issues -->
<img src="/photo.jpg">
<div onclick="navigate()">Click here</div>
<div class="heading">Important Title</div>

<!-- Issues: -->
<!-- ✗ Missing alt text on images -->
<!-- ✗ Non-semantic clickable elements -->
<!-- ✗ Incorrect heading structure -->`,
        solution: `<!-- Fixed: Accessible markup -->
<img src="/photo.jpg" alt="Description of image content">

<button type="button" onclick="navigate()">
  Navigate to section
</button>

<h2>Important Title</h2>

<!-- Best practices: -->
<!-- ✓ Descriptive alt text -->
<!-- ✓ Semantic HTML elements -->
<!-- ✓ Proper heading hierarchy -->`
      }
    };

    return codeMap[fix.title] || {
      problem: `/* Current implementation */
/* Review your ${fix.category || 'mobile'} setup */

/* Issues detected: */
/* ✗ ${fix.title || 'Optimization needed'}`,
      solution: `/* Recommended implementation */
/* Apply ${fix.category || 'mobile'} best practices */

/* Benefits: */
/* ✓ Improved mobile experience */
/* ✓ Better performance scores */
/* ✓ Enhanced usability */`
    };
  }

  function getMobileFixImpact(fix) {
    const impactMap = {
      'Performance': t('reports.mobile.impact.performance', 'Faster page load and improved Core Web Vitals scores'),
      'Readability': t('reports.mobile.impact.readability', 'Better user experience with improved text legibility'),
      'Touch Targets': t('reports.mobile.impact.touchTargets', 'Easier tap interactions for mobile users'),
      'Accessibility': t('reports.mobile.impact.accessibility', 'Better support for users with disabilities and assistive tech'),
      'Viewport': t('reports.mobile.impact.viewport', 'Proper scaling and layout on all device sizes'),
      'PWA': t('reports.mobile.impact.pwa', 'Enhanced mobile experience with app-like features')
    };
    return impactMap[fix.category] || t('reports.mobile.impact.default', 'Improved mobile user experience and engagement');
  }

  function getMobileFixSteps(fix) {
    const stepsMap = {
      'Mobile performance is below recommended': [
        t('reports.mobile.steps.auditImages', 'Audit images and use modern formats (WebP, AVIF)'),
        t('reports.mobile.steps.minimizeJs', 'Minimize and defer non-critical JavaScript'),
        t('reports.mobile.steps.enableCompression', 'Enable compression and browser caching'),
        t('reports.mobile.steps.useCdn', 'Use a Content Delivery Network (CDN)')
      ],
      'Some text is too small on mobile': [
        t('reports.mobile.steps.setFontSize', 'Set body font-size to at least 16px'),
        t('reports.mobile.steps.useRelativeUnits', 'Use relative units (rem/em) instead of fixed pixels'),
        t('reports.mobile.steps.testOnDevices', 'Test on actual devices at arm\\')
      ],
      'Touch targets below WCAG minimum': [
        t('reports.mobile.steps.increaseButtonSize', 'Increase button/link size to at least 44x44 pixels'),
        t('reports.mobile.steps.addPadding', 'Add padding around interactive elements'),
        t('reports.mobile.steps.ensureSpacing', 'Ensure adequate spacing between tap targets')
      ],
      'Accessibility issues detected': [
        t('reports.mobile.steps.addAltText', 'Add descriptive alt text to all images'),
        t('reports.mobile.steps.ensureHeadingHierarchy', 'Ensure proper heading hierarchy (h1, h2, h3)'),
        t('reports.mobile.steps.checkContrast', 'Check color contrast meets WCAG AA standards (4.5:1)')
      ]
    };
    return stepsMap[fix.title] || [
      t('reports.mobile.steps.reviewImplementation', 'Review current implementation'),
      t('reports.mobile.steps.applyChanges', 'Apply the recommended changes'),
      t('reports.mobile.steps.testMultipleDevices', 'Test on multiple mobile devices'),
      t('reports.mobile.steps.verifyImprovement', 'Verify the improvement')
    ];
  }

  // Toggle mobile fix accordion
  function toggleMobileFixAccordion(accordionId) {
    const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
    const content = document.getElementById(`${accordionId}-content`);
    const icon = accordion?.querySelector('.mobile-fix-expand-icon');

    if (!accordion || !content) return;

    const isExpanded = accordion.classList.contains('expanded');

    if (isExpanded) {
      accordion.classList.remove('expanded');
      content.style.maxHeight = '0';
      if (icon) icon.style.transform = 'rotate(0deg)';
    } else {
      accordion.classList.add('expanded');
      content.style.maxHeight = content.scrollHeight + 'px';
      if (icon) icon.style.transform = 'rotate(180deg)';
    }
  }
  window.toggleMobileFixAccordion = toggleMobileFixAccordion;

  // Switch mobile fix tabs
  function switchMobileFixTab(accordionId, tabName) {
    const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
    if (!accordion) return;

    const tabs = accordion.querySelectorAll('.mobile-fix-tab');
    const contents = accordion.querySelectorAll('.mobile-fix-tab-content');

    tabs.forEach(tab => {
      tab.style.background = 'transparent';
      tab.style.color = '#aaa';
      tab.style.borderColor = 'rgba(255,255,255,0.1)';
      tab.classList.remove('active');
    });
    contents.forEach(content => {
      content.style.display = 'none';
      content.classList.remove('active');
    });

    const activeTab = Array.from(tabs).find(tab => tab.getAttribute('data-tab') === tabName);
    const activeContent = document.getElementById(`${accordionId}-${tabName}`);

    if (activeTab) {
      activeTab.style.background = 'rgba(255,255,255,0.1)';
      activeTab.style.color = '#fff';
      activeTab.style.borderColor = 'rgba(255,255,255,0.2)';
      activeTab.classList.add('active');
    }
    if (activeContent) {
      activeContent.style.display = 'block';
      activeContent.classList.add('active');
    }

    // Update accordion height
    const content = document.getElementById(`${accordionId}-content`);
    if (content && accordion.classList.contains('expanded')) {
      setTimeout(() => {
        content.style.maxHeight = content.scrollHeight + 'px';
      }, 50);
    }
  }
  window.switchMobileFixTab = switchMobileFixTab;

  // Copy code function
  function copyMobileCode(elementId) {
    const codeElement = document.getElementById(elementId);
    if (!codeElement) return;

    const text = codeElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = codeElement.parentElement.querySelector('button');
      if (btn) {
        const originalText = btn.textContent;
        btn.textContent = '✓ ' + t('common.copied', 'Copied!');
        setTimeout(() => { btn.textContent = originalText; }, 2000);
      }
    });
  }
  window.copyMobileCode = copyMobileCode;

  // Event delegation for mobile fix accordions and tabs
  document.addEventListener('click', function(e) {
    // Handle tab clicks
    const tab = e.target.closest('.mobile-fix-tab');
    if (tab) {
      const accordion = tab.closest('.mobile-fix-accordion');
      if (accordion) {
        const fixId = accordion.getAttribute('data-fix-id');
        const tabName = tab.getAttribute('data-tab') || 'summary';
        if (fixId && typeof window.switchMobileFixTab === 'function') {
          e.preventDefault();
          e.stopPropagation();
          window.switchMobileFixTab(fixId, tabName);
        }
      }
      return;
    }

    // Handle header clicks
    const header = e.target.closest('.mobile-fix-header');
    if (header) {
      const accordion = header.closest('.mobile-fix-accordion');
      if (accordion) {
        const fixId = accordion.getAttribute('data-fix-id');
        if (fixId && typeof window.toggleMobileFixAccordion === 'function') {
          e.preventDefault();
          window.toggleMobileFixAccordion(fixId);
        }
      }
    }
  });
});
