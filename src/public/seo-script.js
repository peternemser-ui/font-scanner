/**
 * SEO Analyzer Frontend
 * Handles SEO scan submissions and results display
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'seo';

function t(key, fallback, params) {
  try {
    const translate = (k) => {
      if (window.i18n && typeof window.i18n.t === 'function') {
        const translated = window.i18n.t(k, params || {});
        if (translated && translated !== k) return translated;
      }
      return null;
    };

    const direct = translate(key);
    if (direct) return direct;

    // Back-compat: some locales haven't been migrated to `seo.report.*` yet.
    // Try a few known legacy namespaces before falling back to English.
    if (key.startsWith('seo.report.')) {
      const suffix = key.slice('seo.report.'.length);
      const candidates = [`seo.${suffix}`, `common.report.${suffix}`, `brandConsistency.steps.report.${suffix}`];
      for (const candidateKey of candidates) {
        const alt = translate(candidateKey);
        if (alt) return alt;
      }
    }
  } catch (e) {
    // ignore and fall back
  }
  return typeof fallback === 'string' ? fallback : key;
}

function getSeoSectionTitle(sectionKey, fallback) {
  return t(`seo.sections.${sectionKey}`, fallback);
}

function formatStatus(icon, labelKey, fallback) {
  return `${icon} ${t(labelKey, fallback)}`;
}

/**
 * MEMORY MANAGEMENT: Clean up previous scan data to prevent memory leaks
 */
function cleanupPreviousSeoData(container) {
  // Clear report metadata from previous scans
  document.body.removeAttribute('data-report-id');
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');
  
  // Clear global results cache
  if (window._seoFullResults) {
    window._seoFullResults = null;
  }
  
  // Clear results container
  if (container) {
    container.innerHTML = '';
  }
  
  // Clear loading container
  const loadingContainer = document.getElementById('loadingContainer');
  if (loadingContainer) {
    loadingContainer.innerHTML = '';
  }
  
  // Destroy any Chart.js instances
  if (window.Chart && Chart.instances) {
    Object.values(Chart.instances).forEach(chart => {
      try { chart.destroy(); } catch (e) { /* ignore */ }
    });
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const urlInput = document.getElementById('seoUrlInput');
  const submitButton = document.getElementById('seoAnalyzeButton');
  const resultsContainer = document.getElementById('seoResults');
  
  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    resultsContainer.parentNode.insertBefore(loadingContainer, resultsContainer);
  }

  // Handle button click
  submitButton.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showError(t('errors.urlRequired', 'Please enter a valid URL'));
      return;
    }

    // MEMORY CLEANUP: Clear previous scan data
    cleanupPreviousSeoData(resultsContainer);

    // Disable button during scan
    window.SM_IS_SCANNING = true;
    submitButton.disabled = true;
    const buttonText = submitButton.querySelector('#buttonText') || submitButton;
    buttonText.textContent = t('seo.analyzing', 'ANALYZING...');
    submitButton.style.opacity = '0.6';
    urlInput.disabled = true;

    // Show loading state with new animation
    resultsContainer.hidden = true;
    const loader = new AnalyzerLoader('loadingContainer');
    
    // Add ASCII art patience message
    const loaderMessageEl = document.createElement('div');
    loaderMessageEl.id = 'patience-message';
    loaderMessageEl.style.cssText = `
      margin: 0 0 1.5rem 0;
      padding: 1rem;
      background: rgba(var(--accent-primary-rgb), 0.05);
      border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    loaderMessageEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\\\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\\\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em;">
        ${t('seo.loadingTitle', 'Analysis in progress...')}
      </p>
      <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(var(--accent-primary-rgb), 0.7);">
        ${t('seo.mayTake', 'This usually takes 10-20 seconds')}
      </p>
    `;

    // Add color cycling style if not already added
    if (!document.getElementById('ascii-art-style')) {
      const style = document.createElement('style');
      style.id = 'ascii-art-style';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: var(--accent-primary); }
          20% { color: #00ffff; }
          40% { color: #0099ff; }
          60% { color: #9933ff; }
          80% { color: #ff33cc; }
          100% { color: var(--accent-primary); }
        }
        .ascii-art-responsive {
          font-size: clamp(0.35rem, 1.2vw, 0.65rem);
          white-space: pre;
          max-width: 100%;
        }
        #patience-message {
          overflow: visible;
        }
        #patience-message > div {
          -webkit-overflow-scrolling: touch;
        }
      `;
      document.head.appendChild(style);
    }
    
    loader.start([
      { label: t('seo.steps.running', 'Running SEO analysis'), detail: t('seo.steps.initializing', 'Initializing scan engine...') },
      { label: t('seo.steps.metaTags', 'Checking meta tags'), detail: t('seo.steps.metaTagsDetail', 'Analyzing title, description, keywords...') },
      { label: t('seo.steps.content', 'Analyzing content quality'), detail: t('seo.steps.contentDetail', 'Evaluating headings, text, readability...') },
      { label: t('seo.steps.mobile', 'Testing mobile responsiveness'), detail: t('seo.steps.mobileDetail', 'Checking viewport and layout...') },
      { label: t('seo.steps.performance', 'Measuring performance'), detail: t('seo.steps.performanceDetail', 'Testing load speed and optimization...') }
    ], '[SEO ANALYZER]', 25);
    
    // Insert ASCII art after loader starts
    setTimeout(() => {
      const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
      if (analyzerLoading && !document.getElementById('patience-message')) {
        analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
      }
    }, 100);

    try {
      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      // Set up AbortController with 60 second timeout (increased from 45s)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      const response = await fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, scanStartedAt }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        data = {};
      }

      if (!response.ok || data.success === false) {
        throw new Error(data.message || data.error || 'SEO analysis failed');
      }

      if (data.success) {
        // Complete the loader first
        loader.complete();

        setTimeout(() => {
          // Preserve report identity + artifacts for downstream paywall / screenshot UI
          displaySEOResults({
            ...(data.results || {}),
            reportId: data.reportId || data.results?.reportId,
            startedAt: data.startedAt || data.results?.startedAt,
            screenshotUrl: data.screenshotUrl || data.results?.screenshotUrl
          });
        }, 1000);
      } else {
        loader.showError(data.message || data.error || 'SEO analysis failed');
      }

    } catch (error) {
      console.error('SEO scan error:', error);

      // Provide better error messages based on error type
      let errorMessage = 'Failed to analyze website. Please try again.';

      if (error.name === 'AbortError' || error.message.includes('aborted')) {
        errorMessage = 'Analysis timed out after 45 seconds. This website may be too slow or complex to analyze. Please try a different website or try again later.';
      } else if (error.message.includes('bot protection') || error.message.includes('cloudflare')) {
        errorMessage = 'This website blocks automated analysis. Try a different website.';
      } else if (error.message.includes('not accessible') || error.message.includes('unreachable')) {
        errorMessage = 'Website is not accessible. Please check the URL and ensure the website is online.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      loader.showError(errorMessage);
    } finally {
      window.SM_IS_SCANNING = false;
      submitButton.disabled = false;
      const buttonText = submitButton.querySelector('#buttonText') || submitButton;
      buttonText.textContent = t('seo.analyze', 'ANALYZE SEO');
      submitButton.style.opacity = '1';
    }
  });

  // Allow Enter key to submit
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      submitButton.click();
    }
  });

  // Check for stored report or auto-start scan
  (async function initFromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report_id') || '';
    const autoUrl = params.get('url') || (typeof window.getUrlParameter === 'function' ? window.getUrlParameter() : '');
    const autoScan = params.get('auto_scan') === 'true';
    const billingSuccess = params.get('billing_success') === 'true';

    // If we have a report_id, set it immediately so hasAccess checks work
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
    }

    // If returning from billing, wait for billing return processing to complete
    // This ensures the purchase is verified before we try to display the report
    if (billingSuccess && !window.__smBillingReturnComplete) {
      console.log('[SEO] Waiting for billing return processing...');
      await new Promise((resolve) => {
        // Check if already complete
        if (window.__smBillingReturnComplete) {
          resolve();
          return;
        }
        // Wait for the event
        const handler = () => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        };
        window.addEventListener('sm:billingReturnComplete', handler);
        // Timeout fallback in case event is missed
        setTimeout(() => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        }, 5000);
      });
      console.log('[SEO] Billing return processing complete');
      // After billing return, don't auto-load stored report - it was already displayed by handleBillingReturnIfPresent
      return;
    }

    // If we have a report_id, try to load the stored report first
    if (reportId && window.ReportStorage) {
      console.log('[SEO] Checking for stored report:', reportId);

      // CRITICAL: Fetch billing status BEFORE displaying the report
      // Force refresh to ensure we have the latest purchase data (e.g., coming from dashboard)
      if (window.ProReportBlock?.fetchBillingStatus) {
        console.log('[SEO] Fetching billing status (force refresh for report recall)...');
        await window.ProReportBlock.fetchBillingStatus(true);
        console.log('[SEO] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId), 'for reportId:', reportId);
      }

      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displaySEOResults);
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
        submitButton.click();
      }, 500);
    }
  })();

  // Re-render results when language changes
  window.addEventListener('languageChanged', () => {
    if (window.SM_IS_SCANNING) return;
    if (window.currentSeoResults) {
      try {
        displaySEOResults(window.currentSeoResults);
      } catch (e) {
        // ignore
      }
    }
  });

  // Listen for restore scan results event (after payment return)
  window.addEventListener('sm:restoreScanResults', (e) => {
    const { results, url, analyzer } = e.detail || {};
    if (results && analyzer?.includes('seo')) {
      // Fill URL input
      if (url && urlInput) {
        urlInput.value = url;
      }
      // Display results
      window.currentSeoResults = results;
      displaySEOResults(results);
    }
  });

  // Expose displaySEOResults globally for billing return handler
  window.displaySEOResults = displaySEOResults;
});

/**
 * Display SEO analysis results
 */
function displaySEOResults(results) {
  const container = document.getElementById('seoResults');

  // Store results globally for PDF generation + follow-up UI updates
  window.currentSeoResults = results;

  // Get reportId with fallback chain:
  // 1. From results object
  // 2. From body attribute (may be set from URL param on billing return)
  // 3. From URL params
  let reportId = results && results.reportId ? String(results.reportId) : '';
  if (!reportId) {
    reportId = document.body.getAttribute('data-report-id') || '';
  }
  if (!reportId) {
    const params = new URLSearchParams(window.location.search);
    reportId = params.get('report_id') || params.get('reportId') || '';
  }
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    // Also update results object for consistency
    if (results) results.reportId = reportId;
  }
  
  // Set screenshot URL from API response (body attribute set after screenshotUrl is built later)

  // Ensure shared PaidUnlockCard handlers are active (if included)
  if (window.SmEntitlements && typeof window.SmEntitlements.init === 'function') {
    window.SmEntitlements.init({ reportId: reportId || undefined });
  }

  // Clear container
  container.innerHTML = '';
  container.hidden = false;

  const startedAt = results.startedAt || results.timestamp || '';

  // Summary donuts (standard shell)
  const summary = [];
  if (results && results.score && typeof results.score.overall === 'number') {
    summary.push({ label: t('seo.overall', 'Overall'), score: results.score.overall });
  }
  if (results && results.score && results.score.breakdown) {
    Object.entries(results.score.breakdown).forEach(([key, data]) => {
      let score = null;
      if (typeof data === 'number') score = data;
      else if (data && typeof data.score === 'number') score = data.score;
      const translatedLabel = t(`seo.components.${key}`, null);
      summary.push({ label: translatedLabel && translatedLabel !== `seo.components.${key}` ? translatedLabel : formatComponentName(key), score });
    });
  }

  // Gated Fix Code + Recommendations (reference implementation)
  // Check both new billing model (ProReportBlock) and legacy (CreditsManager)
  const isUnlocked = !!(
    reportId && (
      // New billing model: Pro subscription or purchased single report
      (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function' && window.ProReportBlock.hasAccess(reportId)) ||
      // Legacy CreditsManager
      (window.CreditsManager && (
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
      ))
    )
  );

  const proFixesPreview = renderSeoFixesPreview([
    t('seo.proPreview.metaTags', 'Meta tags improvements'),
    t('seo.proPreview.structuredData', 'Structured data quick wins')
  ]);

  const sections = [
    {
      id: 'meta-tags',
      title: getSeoSectionTitle('metaTags', 'Meta Tags'),
      scoreTextRight: results.metaTags?.score,
      contentHTML: renderMetaTagsContent(results.metaTags)
    },
    {
      id: 'heading-structure',
      title: getSeoSectionTitle('headings', 'Headings'),
      scoreTextRight: results.headingStructure?.score,
      contentHTML: renderHeadingStructureContent(results.headingStructure)
    },
    {
      id: 'content-analysis',
      title: getSeoSectionTitle('content', 'Content'),
      scoreTextRight: results.contentAnalysis?.score,
      contentHTML: renderContentAnalysisContent(results.contentAnalysis)
    },
    {
      id: 'image-analysis',
      title: getSeoSectionTitle('images', 'Images'),
      scoreTextRight: results.imageAnalysis?.score,
      contentHTML: renderImageAnalysisContent(results.imageAnalysis)
    },
    {
      id: 'link-analysis',
      title: getSeoSectionTitle('links', 'Link Analysis'),
      scoreTextRight: results.linkAnalysis?.score,
      contentHTML: renderLinkAnalysisContent(results.linkAnalysis)
    },
    {
      id: 'mobile-responsive',
      title: getSeoSectionTitle('mobile', 'Mobile Responsiveness'),
      scoreTextRight: results.mobileResponsive?.score,
      contentHTML: renderMobileResponsivenessContent(results.mobileResponsive)
    },
    {
      id: 'performance',
      title: getSeoSectionTitle('performance', 'Performance Metrics'),
      scoreTextRight: results.performanceMetrics?.score,
      contentHTML: renderPerformanceMetricsContent(results.performanceMetrics)
    },
    {
      id: 'security',
      title: getSeoSectionTitle('security', 'Security'),
      scoreTextRight: results.securityHeaders?.score,
      isPro: true,
      locked: !isUnlocked,
      context: 'seo',
      reportId,
      contentHTML: isUnlocked ? renderSecurityHeadersContent(results.securityHeaders) : getProPreviewContent('security')
    },
    {
      id: 'structured-data',
      title: getSeoSectionTitle('structuredData', 'Structured Data'),
      scoreTextRight: results.structuredData?.score,
      isPro: true,
      locked: !isUnlocked,
      context: 'seo',
      reportId,
      contentHTML: isUnlocked ? renderStructuredDataContent(results.structuredData) : getProPreviewContent('structuredData')
    },
    {
      id: 'additional-checks',
      title: getSeoSectionTitle('additional', 'Additional Checks'),
      scoreTextRight: results.additionalChecks?.score,
      isPro: true,
      locked: !isUnlocked,
      context: 'seo',
      reportId,
      contentHTML: isUnlocked ? renderAdditionalChecksContent(results.additionalChecks) : getProPreviewContent('additionalChecks')
    },
    {
      id: 'report-recommendations',
      title: getSeoSectionTitle('fixCode', 'Report and Recommendations'),
      scoreTextRight: results.score?.overall,
      isPro: true,
      locked: !isUnlocked,
      context: 'seo',
      reportId,
      contentHTML: isUnlocked ? renderProFixes(results) : proFixesPreview
    }
  ];

  const screenshotUrl =
    results.screenshotUrl ||
    (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');

  // Set screenshot URL body attribute for report-ui.js
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }

  const screenshots = screenshotUrl
    ? [{ src: screenshotUrl, alt: 'Page screenshot', device: '' }]
    : [];

  if (screenshots.length) {
    screenshots[0].alt = t('common.pageScreenshotAlt', screenshots[0].alt);
  }

  const reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
    ? window.ReportContainer.create({
        url: results.url,
        timestamp: startedAt,
        mode: 'seo',
        title: `${t('seo.reportTitle', 'SEO Report')}: ${t('seo.reportSubtitle', 'SEO Analysis')}`,
        subtitle: '',
        summary,
        sections,
        screenshots,
        proBlock: true,
        proBlockOptions: {
          context: 'seo',
          features: ['pdf', 'excel', 'csv', 'share'],
          title: t('pricing.unlockReportTitle', 'Unlock Report'),
          subtitle: t('pricing.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
          reportId
        }
      })
    : `
      ${(window.ReportShell && typeof window.ReportShell.renderReportHeader === 'function')
        ? window.ReportShell.renderReportHeader({
            title: `${t('seo.reportTitle', 'SEO Report')}: ${t('seo.reportSubtitle', 'SEO Analysis')}`,
            url: results.url,
            timestamp: startedAt,
            badgeText: '',
            mode: 'seo'
          })
        : `<h2>SEO Report</h2>`
      }
    `;

  container.innerHTML = `<div class="report-scope">${reportHTML}</div>`;

  // Screenshot can be generated shortly after the scan finishes.
  // If the image 404s briefly (background generation / filesystem lag), retry a few times.
  if (reportId) {
    const img = container.querySelector('.screenshot-item__img');
    if (img && img.getAttribute('src')) {
      attachScreenshotRetry(img, img.getAttribute('src'));
    }
  }

  if (window.ReportAccordion && typeof window.ReportAccordion.initInteractions === 'function') {
    window.ReportAccordion.initInteractions();
  }

  // Refresh paywall UI (PaidUnlockCard + ProReportBlock) now that markup exists
  if (reportId && window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
    window.CreditsManager.renderPaywallState(reportId);
  }

  // If already unlocked, remove any lock overlays in this report
  if (isUnlocked) {
    revealSeoProContent();
  }

  // When the report is unlocked (credit/single), reveal the Fix Code section content.
  if (!window.__seoUnlockListenerAttached) {
    window.__seoUnlockListenerAttached = true;
    window.addEventListener('reportUnlocked', (e) => {
      const unlockedId = e && e.detail ? e.detail.reportId : '';
      if (!unlockedId || unlockedId !== document.body.getAttribute('data-report-id')) return;

      // Replace the Fix Code section body with the full content.
      const body = document.querySelector('[data-accordion-body="pro-fixes"]');
      if (body) {
        body.innerHTML = renderProFixes(window.currentSeoResults || results);
      }

      revealSeoProContent();

      if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
        window.CreditsManager.renderPaywallState(unlockedId);
      }
    });
  }

  // Auto-save report snapshot if user has access (Pro or purchased)
  if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportId, results, {
      siteUrl: results.url || results.siteUrl || '',
      analyzerType: 'seo',
      scannedAt: results.startedAt || results.timestamp
    });
  }
}

function attachScreenshotRetry(imgEl, baseUrl, options = {}) {
  if (!imgEl || !baseUrl) return;
  const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 6;
  const baseDelayMs = Number.isFinite(options.baseDelayMs) ? options.baseDelayMs : 750;

  let attempts = 0;
  let settled = false;

  const cacheBust = (url) => {
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}cb=${Date.now()}`;
  };

  const showFallback = () => {
    const wrapper = imgEl.closest('.screenshot-item') || imgEl.parentElement;
    if (!wrapper) return;
    imgEl.style.display = 'none';
    if (wrapper.querySelector('[data-sm-screenshot-fallback]')) return;

    const msg = document.createElement('div');
    msg.setAttribute('data-sm-screenshot-fallback', 'true');
    msg.textContent = t('common.screenshotUnavailable', 'Screenshot unavailable');
    msg.style.cssText = 'padding: 12px; border: 1px dashed var(--border-color); border-radius: 10px; color: var(--text-secondary); text-align: center;';
    wrapper.appendChild(msg);
  };

  const tryReload = () => {
    if (settled) return;
    attempts += 1;
    imgEl.src = cacheBust(baseUrl);
  };

  const onLoad = () => {
    settled = true;
  };

  const onError = () => {
    if (settled) return;
    if (attempts >= maxAttempts) {
      settled = true;
      showFallback();
      return;
    }
    const delay = baseDelayMs * Math.min(attempts + 1, 6);
    window.setTimeout(tryReload, delay);
  };

  imgEl.addEventListener('load', onLoad, { once: true });
  imgEl.addEventListener('error', onError);

  // First attempt: force a fresh fetch (avoids caching a transient 404).
  tryReload();
}

function revealSeoProContent() {
  // Mirror the behavior in report-ui.js, but scoped for the SEO page.
  const overlays = document.querySelectorAll('.report-shell__lock-overlay');
  overlays.forEach((overlay) => {
    const locked = overlay.querySelector('.is-locked');
    if (!locked) return;

    const fragment = document.createDocumentFragment();
    while (locked.firstChild) {
      fragment.appendChild(locked.firstChild);
    }
    overlay.replaceWith(fragment);
  });
}
function renderSeoFixesPreview(previewLines = []) {
  const lines = Array.isArray(previewLines) && previewLines.length
    ? previewLines
    : [t('seo.proPreview.metaTags', 'Meta tags improvements'), t('seo.proPreview.structuredData', 'Structured data quick wins')];

  return `
    <div>
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        ${t('seo.fixes.previewIntro', 'Preview of fix packs:')}
      </p>
      <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
        ${lines.slice(0, 2).map(line => `<li>${line}</li>`).join('')}
      </ul>
    </div>
  `;
}

/**
 * Get preview content for PRO sections when locked
 */
function getProPreviewContent(sectionType) {
  const previews = {
    security: {
      title: 'Security Analysis',
      items: ['HTTPS configuration', 'Security headers audit', 'Cookie security settings']
    },
    structuredData: {
      title: 'Structured Data',
      items: ['Schema.org validation', 'Rich snippet eligibility', 'JSON-LD recommendations']
    },
    additionalChecks: {
      title: 'Additional Checks',
      items: ['Robots.txt analysis', 'Sitemap validation', 'Canonical URL check']
    }
  };
  
  const preview = previews[sectionType] || { title: 'Pro Analysis', items: ['Detailed analysis', 'Recommendations'] };
  
  return `
    <div style="padding: 1rem;">
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        Unlock to view:
      </p>
      <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
        ${preview.items.map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `;
}

function getAnalyzedDomain(results) {
  const rawUrl = results && results.url ? String(results.url) : '';
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || window.location.hostname;
  } catch {
    return window.location.hostname;
  }
}

function renderProFixes(results) {
  ensureSeoFixStyles();
  const fixes = buildFixCards(results);
  
  if (fixes.length === 0) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> Excellent SEO!
        </h3>
        <p style="color: #86efac; margin: 0;">Your site follows SEO best practices. Keep monitoring for continued success.</p>
      </div>
    `;
  }

  // Group by severity
  const high = fixes.filter(f => f.severity === 'High');
  const medium = fixes.filter(f => f.severity === 'Medium');
  const low = fixes.filter(f => f.severity === 'Low');

  let html = `
    <div class="seo-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔍</span> SEO Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixes.length} improvements found)</span>
      </h3>
      <div class="seo-fixes-list">
  `;

  // Render all fixes grouped by severity
  const allFixes = [...high, ...medium, ...low];
  allFixes.forEach((fix, index) => {
    html += renderSeoFixAccordion(fix, index);
  });

  html += `</div></div>`;

  return html;
}

function renderSeoFixAccordion(fix, index) {
  const accordionId = `seofix-${fix.id || index}`;
  const severityColors = {
    High: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[fix.severity] || severityColors.Medium;

  return `
    <div class="seo-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="seo-fix-header" onclick="toggleSeoFixAccordion('${accordionId}')" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${fix.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${fix.category || 'SEO Optimization'}</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            background: ${style.color}20;
            color: ${style.color};
            border: 1px solid ${style.color}40;
          ">${fix.severity.toUpperCase()}</span>
          <span class="seo-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="seo-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
          ${renderSeoFixTabs(fix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderSeoFixTabs(fix, accordionId) {
  return `
    <div class="seo-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="seo-fix-tab active" onclick="switchSeoFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="seo-fix-tab" onclick="switchSeoFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="seo-fix-tab" onclick="switchSeoFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 Fix Guide</button>
    </div>

    <!-- Summary Tab -->
    <div class="seo-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${fix.description}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${fix.impact}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="seo-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ Current Issue</span>
            <button onclick="copySeoCode('${accordionId}-problem')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtml(fix.problematicCode || fix.currentIssue || '<!-- Missing or incorrect implementation -->')}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Fix</span>
            <button onclick="copySeoCode('${accordionId}-solution')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtml(fix.snippet || fix.fixedCode)}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="seo-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${(fix.steps || getDefaultSeoSteps(fix)).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function getDefaultSeoSteps(fix) {
  const stepsMap = {
    'Tune your title tag': [
      'Keep title between 50-60 characters',
      'Place primary keyword near the beginning',
      'Make it compelling and unique for each page'
    ],
    'Write a compelling meta description': [
      'Write 150-160 characters that summarize page content',
      'Include a clear call-to-action',
      'Ensure uniqueness across all pages'
    ],
    'Add canonical + sitemap refs': [
      'Add canonical link pointing to preferred URL',
      'Create and submit XML sitemap to search engines',
      'Reference sitemap in robots.txt'
    ],
    'Add JSON-LD (Article/Product)': [
      'Identify the primary content type (Article, Product, etc.)',
      'Add JSON-LD script with required properties',
      'Test with Google Rich Results Test'
    ],
    'Preload critical assets': [
      'Identify above-the-fold critical resources',
      'Add preload hints for hero image and fonts',
      'Verify with browser DevTools Network panel'
    ],
    'Defer non-critical JS': [
      'Add defer attribute to non-essential scripts',
      'Move analytics to async loading',
      'Test that functionality still works correctly'
    ]
  };
  return stepsMap[fix.title] || ['Review current implementation', 'Apply the recommended fix', 'Test and verify changes'];
}

// Toggle accordion
function toggleSeoFixAccordion(accordionId) {
  console.log('[SEO] toggleSeoFixAccordion called:', accordionId);
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.seo-fix-expand-icon');

  console.log('[SEO] accordion:', accordion, 'content:', content);

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
// Expose immediately to window for inline onclick handlers
window.toggleSeoFixAccordion = toggleSeoFixAccordion;

// Switch tabs
function switchSeoFixTab(accordionId, tabName) {
  console.log('[SEO] switchSeoFixTab called:', accordionId, tabName);
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.seo-fix-tab');
  const contents = accordion.querySelectorAll('.seo-fix-tab-content');

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

  const activeTab = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(tabName));
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

// Copy code
function copySeoCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.parentElement.querySelector('button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  });
}
// Expose functions to window immediately for inline onclick handlers
window.switchSeoFixTab = switchSeoFixTab;
window.copySeoCode = copySeoCode;

// Expose render functions for PDF generation (Puppeteer needs these)
window.renderSecurityHeadersContent = renderSecurityHeadersContent;
window.renderStructuredDataContent = renderStructuredDataContent;
window.renderAdditionalChecksContent = renderAdditionalChecksContent;
window.renderProFixes = renderProFixes;
window.buildFixCards = buildFixCards;

// Add click event delegation for fix accordions and tabs
document.addEventListener('click', function(e) {
  // Handle tab clicks first (more specific)
  const tab = e.target.closest('.seo-fix-tab');
  if (tab) {
    const accordion = tab.closest('.seo-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      // Determine which tab was clicked based on text content
      const tabText = tab.textContent.toLowerCase();
      let tabName = 'summary';
      if (tabText.includes('code')) tabName = 'code';
      else if (tabText.includes('guide')) tabName = 'guide';

      if (fixId && typeof window.switchSeoFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchSeoFixTab(fixId, tabName);
      }
    }
    return;
  }

  // Handle accordion header clicks
  const header = e.target.closest('.seo-fix-header');
  if (header) {
    const accordion = header.closest('.seo-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleSeoFixAccordion === 'function') {
        window.toggleSeoFixAccordion(fixId);
      }
    }
  }
});

function ensureSeoFixStyles() {
  if (document.getElementById('seo-fixes-styles')) return;
  const style = document.createElement('style');
  style.id = 'seo-fixes-styles';
  style.textContent = `
    .seo-fix-accordion.expanded .seo-fix-expand-icon {
      transform: rotate(180deg);
    }
    .seo-fix-header:hover {
      background: rgba(255,255,255,0.03);
    }
  `;
  document.head.appendChild(style);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildFixCards(results) {
  const analyzedDomain = getAnalyzedDomain(results);
  const cards = [];
  const meta = results.metaTags || {};
  const structured = results.structuredData || {};
  const performance = results.performanceMetrics || {};

  cards.push({
    title: 'Tune your title tag',
    severity: 'High',
    category: 'Meta Tags',
    impact: 'Improves CTR in SERPs by 15-30%',
    description: meta.title ? 'Adjust title length to 50-60 chars and front-load the keyword.' : 'Add a clear, unique <title> for this page.',
    problematicCode: meta.title 
      ? `<!-- Current title: ${meta.titleLength || 0} characters -->\n<title>${meta.title}</title>\n\n<!-- Issues: -->\n<!-- ${meta.titleLength < 50 ? '✗ Too short - missing keyword opportunity' : meta.titleLength > 60 ? '✗ Too long - will be truncated in SERPs' : '~ Could be optimized'} -->`
      : `<!-- No title tag found -->\n<head>\n  <!-- ✗ Missing <title> tag -->\n</head>`,
    snippet: `<title>${meta.title || 'Primary Keyword | Brand Name'}</title>\n\n<!-- Best practices: -->\n<!-- ✓ 50-60 characters -->\n<!-- ✓ Primary keyword near the start -->\n<!-- ✓ Brand name at the end -->`,
    steps: [
      'Keep title between 50-60 characters',
      'Place primary keyword near the beginning',
      'Make it compelling and unique for each page'
    ]
  });

  cards.push({
    title: 'Write a compelling meta description',
    severity: 'Medium',
    category: 'Meta Tags',
    impact: 'Higher click-through and relevance signals',
    description: 'Keep 150-160 chars, include a CTA, and ensure uniqueness.',
    problematicCode: meta.description 
      ? `<!-- Current: ${meta.descriptionLength || 0} characters -->\n<meta name="description" content="${meta.description?.substring(0, 80)}..." />\n\n<!-- Issues: -->\n<!-- ${meta.descriptionLength < 150 ? '✗ Too short - not fully utilizing SERP space' : meta.descriptionLength > 160 ? '✗ Too long - will be truncated' : '~ Review for CTA'} -->`
      : `<!-- No meta description found -->\n<head>\n  <!-- ✗ Missing meta description -->\n</head>`,
    snippet: `<meta name="description" content="Describe the main value proposition in 150-160 characters. Include a clear call to action." />\n\n<!-- Best practices: -->\n<!-- ✓ 150-160 characters -->\n<!-- ✓ Include call-to-action -->\n<!-- ✓ Unique for each page -->`,
    steps: [
      'Write 150-160 characters that summarize page content',
      'Include a clear call-to-action',
      'Ensure uniqueness across all pages'
    ]
  });

  cards.push({
    title: 'Add canonical + sitemap refs',
    severity: 'Medium',
    category: 'Technical SEO',
    impact: 'Prevents duplicate indexing issues',
    description: 'Declare the preferred URL and list all discoverable URLs.',
    problematicCode: `<!-- Common issues: -->\n<!-- ✗ No canonical URL declared -->\n<!-- ✗ Multiple versions indexed (www, non-www, http, https) -->\n<!-- ✗ Sitemap not referenced -->\n\n<head>\n  <!-- Missing canonical and sitemap links -->\n</head>`,
    snippet: `<link rel="canonical" href="https://${analyzedDomain}/" />\n<link rel="sitemap" type="application/xml" title="Sitemap" href="https://${analyzedDomain}/sitemap.xml" />\n\n<!-- In robots.txt: -->\nSitemap: https://${analyzedDomain}/sitemap.xml`,
    steps: [
      'Add canonical link pointing to preferred URL',
      'Create and submit XML sitemap to search engines',
      'Reference sitemap in robots.txt'
    ]
  });

  cards.push({
    title: 'Add JSON-LD (Article/Product)',
    severity: 'High',
    category: 'Structured Data',
    impact: 'Rich results eligibility - up to 30% more visibility',
    description: 'Provide structured data for the primary page type.',
    problematicCode: structured.hasStructuredData 
      ? `<!-- Structured data found but may need enhancement -->\n<!-- Current types: ${structured.types?.join(', ') || 'Unknown'} -->\n\n<!-- Check for: -->\n<!-- ~ Required properties -->\n<!-- ~ Recommended properties -->\n<!-- ~ Valid JSON-LD syntax -->`
      : `<!-- No structured data found -->\n<head>\n  <!-- ✗ Missing JSON-LD structured data -->\n  <!-- ✗ Not eligible for rich results -->\n</head>`,
    snippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "${meta.title || 'Page Title'}",\n  "description": "${meta.description || 'Page description'}",\n  "url": "https://${analyzedDomain}/"\n}\n</script>`,
    steps: [
      'Identify the primary content type (Article, Product, etc.)',
      'Add JSON-LD script with required properties',
      'Test with Google Rich Results Test'
    ]
  });

  cards.push({
    title: 'Preload critical assets',
    severity: 'Medium',
    category: 'Performance',
    impact: 'Faster LCP and render - improves Core Web Vitals',
    description: 'Preload hero image, main font, and critical CSS.',
    problematicCode: `<!-- Common issues: -->\n<!-- ✗ Hero image not preloaded -->\n<!-- ✗ Web fonts cause layout shift -->\n<!-- ✗ Critical CSS not prioritized -->\n\n<head>\n  <!-- No preload hints -->\n  <link rel="stylesheet" href="/styles.css">\n</head>`,
    snippet: `<link rel="preload" as="image" href="/hero.webp" />\n<link rel="preload" as="style" href="/critical.css" />\n<link rel="preload" as="font" type="font/woff2" href="/fonts/main.woff2" crossorigin />\n\n<!-- Best practices: -->\n<!-- ✓ Preload LCP image -->\n<!-- ✓ Preload critical fonts -->\n<!-- ✓ Use crossorigin for fonts -->`,
    steps: [
      'Identify above-the-fold critical resources',
      'Add preload hints for hero image and fonts',
      'Verify with browser DevTools Network panel'
    ]
  });

  cards.push({
    title: 'Defer non-critical JS',
    severity: 'Low',
    category: 'Performance',
    impact: 'Reduces blocking time - faster interactivity',
    description: 'Use defer for scripts that can wait until DOM is parsed.',
    problematicCode: `<!-- Common issues: -->\n<!-- ✗ Scripts blocking page render -->\n<!-- ✗ Analytics loading synchronously -->\n\n<head>\n  <script src="/app.js"></script>\n  <script src="/analytics.js"></script>\n</head>`,
    snippet: `<head>\n  <!-- Defer non-essential scripts -->\n  <script src="/app.js" defer></script>\n  <script src="/analytics.js" defer></script>\n</head>\n\n<!-- Or load at end of body: -->\n<body>\n  <!-- content -->\n  <script src="/app.js"></script>\n</body>`,
    steps: [
      'Add defer attribute to non-essential scripts',
      'Move analytics to async loading',
      'Test that functionality still works correctly'
    ]
  });

  return cards;
}

/**
 * Render Meta Tags section content
 */
function renderMetaTagsContent(metaTags) {
  const charsUnit = t('seo.report.units.chars', 'chars');
  const missing = t('seo.report.status.missing', 'Missing');
  const review = t('seo.report.status.review', 'Review');
  const optimal = t('seo.report.status.optimal', 'Optimal');
  const configured = t('seo.report.status.configured', 'Configured');
  const present = t('seo.report.status.present', 'Present');
  const set = t('seo.report.status.set', 'Set');
  const valid = t('seo.report.status.valid', 'Valid');
  const none = t('seo.report.status.none', 'None');

  const titleLabel = t('seo.report.metaTags.rows.title', 'Title');
  const descriptionLabel = t('seo.report.metaTags.rows.description', 'Description');
  const openGraphLabel = t('seo.report.metaTags.rows.openGraph', 'Open Graph');
  const twitterCardLabel = t('seo.report.metaTags.rows.twitterCard', 'Twitter Card');
  const viewportLabel = t('seo.report.metaTags.rows.viewport', 'Viewport');
  const canonicalLabel = t('seo.report.metaTags.rows.canonical', 'Canonical');

  // Create meta tags data table
  const metaTableData = [
    [
      titleLabel,
      metaTags.title || `✗ ${missing}`,
      `${metaTags.titleLength || 0} ${charsUnit}`,
      metaTags.titleLength >= 50 && metaTags.titleLength <= 60
        ? `✓ ${optimal}`
        : `~ ${review}`,
      t(
        'seo.report.metaTags.bestPractice.title',
        '50-60 chars, include primary keyword near start'
      )
    ],
    [
      descriptionLabel,
      metaTags.description
        ? `${metaTags.description.substring(0, 50)}...`
        : `✗ ${missing}`,
      `${metaTags.descriptionLength || 0} ${charsUnit}`,
      metaTags.descriptionLength >= 150 && metaTags.descriptionLength <= 160
        ? `✓ ${optimal}`
        : `~ ${review}`,
      t(
        'seo.report.metaTags.bestPractice.description',
        '150-160 chars, compelling CTA, unique per page'
      )
    ],
    [
      openGraphLabel,
      metaTags.ogTitle ? `✓ ${configured}` : `✗ ${missing}`,
      metaTags.ogTitle ? 'og:title, og:description' : none,
      metaTags.ogTitle ? `✓ ${valid}` : `✗ ${missing}`,
      t(
        'seo.report.metaTags.bestPractice.openGraph',
        'og:title, og:description, og:image (1200x630px)'
      )
    ],
    [
      twitterCardLabel,
      metaTags.twitterCard || `✗ ${missing}`,
      metaTags.twitterCard ? configured : none,
      metaTags.twitterCard ? `✓ ${valid}` : `✗ ${missing}`,
      t(
        'seo.report.metaTags.bestPractice.twitterCard',
        'summary_large_image, twitter:title, twitter:image'
      )
    ],
    [
      viewportLabel,
      metaTags.viewport ? `✓ ${present}` : `✗ ${missing}`,
      metaTags.viewport || none,
      metaTags.viewport ? `✓ ${valid}` : `✗ ${missing}`,
      t(
        'seo.report.metaTags.bestPractice.viewport',
        'width=device-width, initial-scale=1'
      )
    ],
    [
      canonicalLabel,
      metaTags.canonical ? `✓ ${set}` : `✗ ${missing}`,
      metaTags.canonical || none,
      metaTags.canonical ? `✓ ${valid}` : `~ ${review}`,
      t(
        'seo.report.metaTags.bestPractice.canonical',
        'Prevents duplicate content, use absolute URLs'
      )
    ]
  ];

  // Meta tags health metrics
  const healthMetrics = {
    [titleLabel]: metaTags.title
      ? metaTags.titleLength >= 50 && metaTags.titleLength <= 60
        ? 100
        : 70
      : 0,
    [descriptionLabel]: metaTags.description
      ? metaTags.descriptionLength >= 150 && metaTags.descriptionLength <= 160
        ? 100
        : 70
      : 0,
    [t('seo.report.metaTags.rows.ogTags', 'OG Tags')]: metaTags.ogTitle ? 100 : 0,
    [t('seo.report.metaTags.rows.twitter', 'Twitter')]: metaTags.twitterCard
      ? 100
      : 0,
    [viewportLabel]: metaTags.viewport ? 100 : 0,
    [canonicalLabel]: metaTags.canonical ? 100 : 0
  };

  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(var(--accent-primary-rgb), 0.1); border-left: 4px solid var(--accent-primary); padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: var(--accent-primary);">${t('seo.report.metaTags.calloutTitle', '🏷️ Meta Tags are Your First Impression')}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          ${t(
            'seo.report.metaTags.calloutBody',
            'These tags control how your site appears in search results and social media. Optimizing them can increase click-through rates by 30-50%.'
          )}
        </p>
      </div>
      
      <h3 style="color: var(--accent-primary); margin: 1rem 0 1rem 0;">>> ${t('seo.report.metaTags.overviewHeading', 'Meta Tags Overview')}</h3>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(var(--accent-primary-rgb), 0.3);">
          <thead>
            <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary);">${t('seo.report.table.property', 'Property')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary);">${t('seo.report.table.value', 'Value')}</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary);">${t('seo.report.table.length', 'Length')}</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary);">${t('seo.report.table.status', 'Status')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary);">${t('seo.report.table.bestPractice', 'Best Practice')}</th>
            </tr>
          </thead>
          <tbody>
            ${metaTableData.map((row) => `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${row[3].includes('✗') ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                <td style="padding: 0.75rem; font-weight: 500;">${row[0]}</td>
                <td style="padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.9rem; word-break: break-word; max-width: 300px;">${row[1]}</td>
                <td style="padding: 0.75rem; text-align: center;">${row[2]}</td>
                <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: ${row[3].includes('✓') ? 'var(--accent-primary)' : row[3].includes('~') ? '#ffa500' : '#ff4444'};">${row[3]}</td>
                <td style="padding: 0.75rem; color: var(--accent-primary); font-size: 0.85rem;">${row[4]}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0;">>> ${t('seo.report.metaTags.healthHeading', 'Meta Tags Health')}</h3>
      ${createHeatmap(healthMetrics)}

      ${renderIssuesAndRecommendations(metaTags)}
    </div>
  `;
}

/**
 * Render Heading Structure section content
 */
function renderHeadingStructureContent(headings) {
  const optimal = t('seo.report.status.optimal', 'Optimal');
  const missing = t('seo.report.status.missing', 'Missing');
  const multiple = t('seo.report.status.multiple', 'Multiple');
  const present = t('seo.report.status.present', 'Present');
  const none = t('seo.report.status.none', 'None');
  const na = t('dashboard.na', 'N/A');

  // Heading distribution data for bar chart
  const headingCounts = {
    'H1': headings.h1.length,
    'H2': headings.h2.length,
    'H3': headings.h3.length,
    'H4': headings.h4.length,
    'H5': headings.h5?.length || 0,
    'H6': headings.h6?.length || 0
  };

  // Create heading hierarchy table
  const headingTable = [
    [
      'H1',
      headings.h1.length,
      headings.h1.length === 1
        ? `✓ ${optimal}`
        : headings.h1.length === 0
          ? `✗ ${missing}`
          : `~ ${multiple}`,
      headings.h1[0] ? `"${headings.h1[0].substring(0, 40)}..."` : na
    ],
    [
      'H2',
      headings.h2.length,
      headings.h2.length > 0 ? `✓ ${present}` : `~ ${none}`,
      headings.h2[0] ? `"${headings.h2[0].substring(0, 40)}..."` : na
    ],
    [
      'H3',
      headings.h3.length,
      headings.h3.length > 0 ? `✓ ${present}` : `~ ${none}`,
      headings.h3[0] ? `"${headings.h3[0].substring(0, 40)}..."` : na
    ],
    [
      'H4',
      headings.h4.length,
      headings.h4.length > 0 ? `✓ ${present}` : `~ ${none}`,
      headings.h4[0] ? `"${headings.h4[0].substring(0, 40)}..."` : na
    ]
  ];

  return `
    <div style="padding-left: 1rem;">
      
      <h3 style="color: var(--accent-primary); margin: 1rem 0 0.5rem 0;">>> ${t('seo.report.headings.distributionHeading', 'Heading Distribution')}</h3>
      ${createBarChart(headingCounts, { height: 180, colorScheme: 'gradient', animated: true })}

      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0;">>> ${t('seo.report.headings.hierarchyHeading', 'Heading Hierarchy')}</h3>
      ${createDataTable(
        [
          t('seo.report.headings.table.level', 'Level'),
          t('seo.report.headings.table.count', 'Count'),
          t('seo.report.table.status', 'Status'),
          t('seo.report.headings.table.firstInstance', 'First Instance')
        ],
        headingTable,
        { striped: true }
      )}

      <p>>> ${t('seo.report.headings.totalHeadingsLabel', 'total_headings')}: ${headings.total}</p>
      ${headings.h1.length > 0 ? `<p>>> ${t('seo.report.headings.primaryH1Label', 'primary_h1')}: "${headings.h1[0]}"</p>` : ''}

      ${headings.hierarchy.length > 3 ? `
        <p>>> ${t('seo.report.headings.hierarchySampleLabel', 'hierarchy_sample')}:</p>
        ${headings.hierarchy.slice(0, 5).map(h => `<p style="margin-left: 1rem; color: #808080;">${h.level.toUpperCase()}: ${h.text.substring(0, 80)}${h.text.length > 80 ? '...' : ''}</p>`).join('')}
        ${headings.hierarchy.length > 5 ? `<p style="margin-left: 1rem; color: #808080;">${t('seo.report.common.moreCount', '... {{count}} more', { count: headings.hierarchy.length - 5 })}</p>` : ''}
      ` : ''}

      ${renderIssuesAndRecommendations(headings)}
    </div>
  `;
}

/**
 * Render Content Analysis section content
 */
function renderContentAnalysisContent(content) {
  const wordStatus = content.wordCount >= 600 ? '✓' : content.wordCount >= 300 ? '~' : '✗';
  const sentenceStatus = content.averageWordsPerSentence <= 20 ? '✓' : '~';
  
  // Content quality metrics
  const contentMetrics = {
    [t('seo.report.content.metrics.wordCount', 'Word Count')]: content.wordCount >= 600
      ? 100
      : content.wordCount >= 300
        ? 70
        : 40,
    [t('seo.report.content.metrics.readability', 'Readability')]: content.averageWordsPerSentence <= 20
      ? 100
      : content.averageWordsPerSentence <= 25
        ? 70
        : 40,
    [t('seo.report.content.metrics.textRatio', 'Text Ratio')]: content.textToHTMLRatio >= 0.25
      ? 100
      : content.textToHTMLRatio >= 0.15
        ? 70
        : 40,
    [t('seo.report.content.metrics.paragraphs', 'Paragraphs')]: content.paragraphCount >= 5
      ? 100
      : content.paragraphCount >= 3
        ? 70
        : 40
  };

  return `
    <div style="padding-left: 1rem;">
      
      <h3 style="color: var(--accent-primary); margin: 1rem 0 0.5rem 0;">>> ${t('seo.report.content.qualityMetricsHeading', 'Content Quality Metrics')}</h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
        <div>
          ${createProgressBar(
            Math.min((content.wordCount / 1000) * 100, 100),
            t('seo.report.content.wordCountLabel', 'Word Count: {{count}}', { count: content.wordCount }),
            { threshold: { good: 60, warning: 30 } }
          )}
          ${createProgressBar(
            Math.min(100, Math.max(0, 100 - (content.averageWordsPerSentence - 15) * 5)),
            t('seo.report.content.readabilityScoreLabel', 'Readability Score'),
            { threshold: { good: 70, warning: 50 } }
          )}
        </div>
        <div>
          ${createProgressBar(
            content.textToHTMLRatio * 100,
            t('seo.report.content.textToHtmlLabel', 'Text-to-HTML: {{percent}}%', {
              percent: (content.textToHTMLRatio * 100).toFixed(1)
            }),
            { threshold: { good: 25, warning: 15 } }
          )}
          ${createProgressBar(
            Math.min((content.paragraphCount / 10) * 100, 100),
            t('seo.report.content.paragraphsLabel', 'Paragraphs: {{count}}', { count: content.paragraphCount }),
            { threshold: { good: 50, warning: 30 } }
          )}
        </div>
      </div>

      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0;">>> ${t('seo.report.content.healthHeading', 'Content Health')}</h3>
      ${createHeatmap(contentMetrics)}

      <p>>> ${t('seo.report.content.wordCountLineLabel', 'word_count')}: ${content.wordCount} ${wordStatus}</p>
      <p>>> ${t('seo.report.content.sentencesLineLabel', 'sentences')}: ${content.sentenceCount}</p>
      <p>>> ${t('seo.report.content.avgWordsPerSentenceLineLabel', 'avg_words_per_sentence')}: ${content.averageWordsPerSentence} ${sentenceStatus}</p>

      ${renderIssuesAndRecommendations(content)}
    </div>
  `;
}

/**
 * Render Image Analysis section content
 */
function renderImageAnalysisContent(images) {
  const altStatus = images.withAlt === images.total ? '✓' : images.withoutAlt === 0 ? '~' : '✗';
  const altPercentage = images.total > 0 ? ((images.withAlt / images.total) * 100).toFixed(1) : 0;
  
  // Image optimization data
  const imageData = {
    'With Alt': images.withAlt,
    'Missing Alt': images.withoutAlt,
    'Total Images': images.total
  };

  const missing = t('seo.report.status.missing', 'Missing');

  // Create image rows
  const imageRows = images.images.slice(0, 10).map(img => {
    const hasAlt = Boolean(img.alt);
    return {
      url: truncateUrl(img.src, 40),
      dimensions: `${img.width}x${img.height}`,
      altText: hasAlt
        ? `✓ "${img.alt.substring(0, 30)}${img.alt.length > 30 ? '...' : ''}"`
        : `✗ ${missing}`,
      pass: hasAlt,
      recommendation: hasAlt
        ? t(
            'seo.report.images.recommendation.pass',
            'Descriptive, helps SEO and accessibility'
          )
        : t(
            'seo.report.images.recommendation.fail',
            'Add descriptive alt text for SEO + screen readers'
          )
    };
  });

  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(255, 140, 0, 0.1); border-left: 4px solid #ff8c00; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #ff8c00;">${t('seo.report.images.calloutTitle', 'I Image SEO: Alt Text is Critical')}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          ${t(
            'seo.report.images.calloutBody',
            'Alt text helps search engines understand images and improves accessibility. Google Image Search drives 20-30% of web traffic for many sites.'
          )}
        </p>
      </div>
      
      <h3 style="color: var(--accent-primary); margin: 1rem 0 0.5rem 0;">>> ${t('seo.report.images.overviewHeading', 'Image Optimization Overview')}</h3>
      ${images.total > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0;">
          ${createRadialProgress(parseFloat(altPercentage), t('seo.report.images.radial.altCoverage', 'Alt Text Coverage'))}
          ${createRadialProgress(images.total, t('seo.report.images.radial.imagesFound', 'Images Found'))}
          ${createRadialProgress(images.score, t('seo.report.images.radial.overallScore', 'Overall Score'))}
        </div>
      ` : `
        <p style="color: #ff6600; margin: 1rem 0;">>> ${t('seo.report.images.noImagesFound', 'No images found on this page')}</p>
      `}

      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0;">>> ${t('seo.report.images.statsHeading', 'Image Statistics')}</h3>
      ${createBarChart(imageData, { height: 150, horizontal: true, colorScheme: 'score' })}

      ${images.images.length > 0 ? `
        <h3 style="color: var(--accent-primary); margin: 1.5rem 0 1rem 0;">>> ${t('seo.report.images.detailsHeading', 'Image Details')}</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(var(--accent-primary-rgb), 0.3);">
            <thead>
              <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary);">${t('seo.report.images.table.imageUrl', 'Image URL')}</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary);">${t('seo.report.images.table.dimensions', 'Dimensions')}</th>
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary);">${t('seo.report.images.table.altText', 'Alt Text')}</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary);">${t('seo.report.table.status', 'Status')}</th>
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary);">${t('seo.report.table.recommendation', 'Recommendation')}</th>
              </tr>
            </thead>
            <tbody>
              ${imageRows.map((row) => {
                const passLabel = t('seo.report.status.pass', 'Pass');
                const failLabel = t('seo.report.status.fail', 'Fail');
                return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${row.pass ? '' : 'background: rgba(255, 68, 68, 0.05);'}">
                  <td style="padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.85rem; word-break: break-all;">${row.url}</td>
                  <td style="padding: 0.75rem; text-align: center; font-family: monospace;">${row.dimensions}</td>
                  <td style="padding: 0.75rem; color: ${row.altText.includes('✓') ? 'var(--accent-primary)' : '#ff4444'}; font-size: 0.9rem;">${row.altText}</td>
                  <td style="padding: 0.75rem; text-align: center; font-weight: 600; color: ${row.pass ? 'var(--accent-primary)' : '#ff4444'};">${row.pass ? passLabel : failLabel}</td>
                  <td style="padding: 0.75rem; color: var(--accent-primary); font-size: 0.85rem;">${row.recommendation}</td>
                </tr>
              `;
              }).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}

      <p>>> ${t('seo.report.images.totalImagesLabel', 'total_images')}: ${images.total}</p>
      <p>>> ${t('seo.report.images.withAltLabel', 'with_alt')}: ${images.withAlt} / ${images.total} ${altStatus} (${altPercentage}%)</p>

      ${renderIssuesAndRecommendations(images)}
    </div>
  `;
}

/**
 * Render Link Analysis section content
 */
function renderLinkAnalysisContent(links) {
  const brokenStatus = links.brokenFormat === 0 ? '✓' : '~';
  
  return `
    <div style="padding-left: 1rem;">
      
      <h3 style="color: var(--accent-primary); margin: 1rem 0 0.5rem 0;">>> ${t('seo.report.links.networkDiagramHeading', 'Link Network Diagram')}</h3>
      ${createLinkDiagram({
        internal: links.internal,
        external: links.external,
        nofollow: links.noFollow,
        broken: links.brokenFormat
      })}

      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0;">>> ${t('seo.report.links.healthSummaryHeading', 'Link Health Summary')}</h3>
      <p>>> ${t('seo.report.links.totalLinksLabel', 'total_links')}: ${links.total}</p>
      <p>>> ${t('seo.report.links.internalLinksLabel', 'internal_links')}: ${links.internal} (${((links.internal / links.total) * 100).toFixed(1)}%)</p>
      <p>>> ${t('seo.report.links.externalLinksLabel', 'external_links')}: ${links.external} (${((links.external / links.total) * 100).toFixed(1)}%)</p>
      <p>>> ${t('seo.report.links.nofollowLinksLabel', 'nofollow_links')}: ${links.noFollow}</p>
      <p>>> ${t('seo.report.links.brokenFormatLabel', 'broken_format')}: ${links.brokenFormat} ${brokenStatus}</p>

      ${renderIssuesAndRecommendations(links)}
    </div>
  `;
}

/**
 * Render Mobile Responsiveness section content
 */
function renderMobileResponsivenessContent(mobile) {
  const deviceLabel = (device) => {
    if (device === 'Mobile') return t('seo.report.mobile.devices.mobile', 'Mobile');
    if (device === 'Tablet') return t('seo.report.mobile.devices.tablet', 'Tablet');
    if (device === 'Desktop') return t('seo.report.mobile.devices.desktop', 'Desktop');
    return device;
  };

  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(0, 150, 255, 0.1); border-left: 4px solid #0096ff; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #0096ff;">${t('seo.report.mobile.calloutTitle', 'M Mobile-First Indexing')}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          ${t(
            'seo.report.mobile.calloutBody',
            'Google now uses the mobile version of your site for indexing and ranking. Mobile responsiveness is critical for SEO.'
          )}
        </p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.mobile.table.deviceType', 'Device Type')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.mobile.table.width', 'Width')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.mobile.table.noHorizontalScroll', 'No Horizontal Scroll')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.mobile.table.viewportMeta', 'Viewport Meta')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.mobile.table.readableFontSize', 'Readable Font Size')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.recommended', 'Recommended')}</th>
          </tr>
        </thead>
        <tbody>
          ${mobile.viewports.map(vp => {
            const recommended = vp.viewport === 'Mobile' 
              ? t('seo.report.mobile.recommendations.mobile', '≥ 16px fonts, no horizontal scroll')
              : vp.viewport === 'Tablet' 
              ? t('seo.report.mobile.recommendations.tablet', 'Responsive layout, touch-friendly')
              : t('seo.report.mobile.recommendations.desktop', 'Desktop fallback');
            
            return `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${deviceLabel(vp.viewport)}</td>
                <td style="padding: 0.75rem; text-align: center; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.width}px</td>
                <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.hasHorizontalScroll ? '✗' : '✓'}</td>
                <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.hasViewportMeta ? '✓' : '✗'}</td>
                <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${vp.fontSizeReadable ? '✓' : '✗'}</td>
                <td style="padding: 0.75rem; color: var(--accent-primary); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin: 1rem 0;">
        <div style="background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 4px; border-left: 3px solid ${mobile.viewports.every(vp => !vp.hasHorizontalScroll) ? 'var(--accent-primary)' : '#ff4444'};">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('seo.report.mobile.cards.horizontalScroll', 'Horizontal Scroll')}</div>
          <div style="font-size: 1.5rem; font-weight: bold; color: ${mobile.viewports.every(vp => !vp.hasHorizontalScroll) ? 'var(--accent-primary)' : '#ff4444'};">
            ${mobile.viewports.every(vp => !vp.hasHorizontalScroll)
              ? formatStatus('✓', 'seo.report.mobile.cards.none', 'None')
              : formatStatus('✗', 'seo.report.mobile.cards.detected', 'Detected')}
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 4px; border-left: 3px solid ${mobile.viewports.every(vp => vp.hasViewportMeta) ? 'var(--accent-primary)' : '#ff8c00'};">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('seo.report.mobile.cards.viewportMetaTag', 'Viewport Meta Tag')}</div>
          <div style="font-size: 1.5rem; font-weight: bold; color: ${mobile.viewports.every(vp => vp.hasViewportMeta) ? 'var(--accent-primary)' : '#ff8c00'};">
            ${mobile.viewports.every(vp => vp.hasViewportMeta)
              ? formatStatus('✓', 'seo.report.status.present', 'Present')
              : formatStatus('~', 'seo.report.status.missing', 'Missing')}
          </div>
        </div>
        
        <div style="background: rgba(255, 255, 255, 0.03); padding: 1rem; border-radius: 4px; border-left: 3px solid ${mobile.viewports.filter(vp => vp.fontSizeReadable).length === mobile.viewports.length ? 'var(--accent-primary)' : '#ff8c00'};">
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">${t('seo.report.mobile.cards.fontReadability', 'Font Readability')}</div>
          <div style="font-size: 1.5rem; font-weight: bold; color: ${mobile.viewports.filter(vp => vp.fontSizeReadable).length === mobile.viewports.length ? 'var(--accent-primary)' : '#ff8c00'};">
            ${t('seo.report.mobile.cards.devicesFraction', '{{count}}/{{total}} Devices', {
              count: mobile.viewports.filter(vp => vp.fontSizeReadable).length,
              total: mobile.viewports.length
            })}
          </div>
        </div>
      </div>

      ${renderIssuesAndRecommendations(mobile)}
    </div>
  `;
}

/**
 * Render Performance Metrics section content
 */
function renderPerformanceMetricsContent(perf) {
  const loadStatus = perf.loadComplete < 3000 ? '✓' : perf.loadComplete < 5000 ? '~' : '✗';
  const sizeStatus = parseFloat(perf.transferSizeMB) < 3 ? '✓' : '~';
  const resourceStatus = perf.resources < 150 ? '✓' : perf.resources < 300 ? '~' : '✗';
  const domStatus = perf.domNodes < 1500 ? '✓' : perf.domNodes < 3000 ? '~' : '✗';
  
  const metrics = [
    {
      metric: t('seo.report.performance.metrics.pageLoadTime', 'Page Load Time'),
      value: `${perf.loadCompleteSeconds}s`,
      status: loadStatus,
      description: t('seo.report.performance.desc.pageLoadTime', 'Time until page fully loaded'),
      recommended: t('seo.report.performance.recommended.pageLoadTime', '< 3s (Good) | < 5s (Fair)')
    },
    {
      metric: t('seo.report.performance.metrics.domContentLoaded', 'DOM Content Loaded'),
      value: `${(perf.domContentLoaded / 1000).toFixed(2)}s`,
      status: perf.domContentLoaded < 2000 ? '✓' : '~',
      description: t('seo.report.performance.desc.domContentLoaded', 'Time until DOM is ready'),
      recommended: t('seo.report.performance.recommended.domContentLoaded', '< 2s (Good)')
    },
    {
      metric: t('seo.report.performance.metrics.totalResources', 'Total Resources'),
      value: perf.resources,
      status: resourceStatus,
      description: t('seo.report.performance.desc.totalResources', 'Number of HTTP requests'),
      recommended: t('seo.report.performance.recommended.totalResources', '< 150 (Good) | < 300 (Fair)')
    },
    {
      metric: t('seo.report.performance.metrics.pageSize', 'Page Size'),
      value: `${perf.transferSizeMB} MB`,
      status: sizeStatus,
      description: t('seo.report.performance.desc.pageSize', 'Total transfer size'),
      recommended: t('seo.report.performance.recommended.pageSize', '< 3 MB (Good)')
    },
    {
      metric: t('seo.report.performance.metrics.domNodes', 'DOM Nodes'),
      value: perf.domNodes,
      status: domStatus,
      description: t('seo.report.performance.desc.domNodes', 'Total HTML elements'),
      recommended: t('seo.report.performance.recommended.domNodes', '< 1,500 (Good) | < 3,000 (Fair)')
    }
  ];
  
  return `
    <div style="padding-left: 1rem;">
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.metric', 'Metric')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.value', 'Value')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.status', 'Status')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.recommended', 'Recommended')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.description', 'Description')}</th>
          </tr>
        </thead>
        <tbody>
          ${metrics.map(({ metric, value, status, description, recommended }) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${metric}</td>
              <td style="padding: 0.75rem; text-align: center; color: #c0c0c0; font-family: 'Courier New', monospace; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">${value}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; text-align: center; color: var(--accent-primary); font-size: 0.85rem; font-weight: 500; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.05);">${description}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(perf)}
    </div>
  `;
}

/**
 * Render Security Headers section content
 */
function renderSecurityHeadersContent(security) {
  const yes = t('seo.report.status.yes', 'Yes');
  const no = t('seo.report.status.no', 'No');
  const present = t('seo.report.status.present', 'Present');
  const missing = t('seo.report.status.missing', 'Missing');
  const configured = t('seo.report.status.configured', 'Configured');
  const enabled = t('seo.report.status.enabled', 'Enabled');
  const notConfigured = t('seo.report.status.notConfigured', 'Not configured - browsers can connect via HTTP');

  const securityChecks = [
    {
      header: t('seo.report.security.headers.httpsEnabled', 'HTTPS Enabled'),
      status: security.hasHTTPS ? `✓ ${yes}` : `✗ ${no}`,
      purpose: t('seo.report.security.purpose.encryptedConnection', 'Encrypted connection'),
      details: security.hasHTTPS
        ? t('seo.report.security.details.sslEnabled', 'Secure SSL/TLS enabled')
        : t('seo.report.security.details.noHttps', 'No HTTPS detected'),
      recommended: t(
        'seo.report.security.recommended.https',
        'Required - Always use HTTPS in production'
      )
    },
    {
      header: t('seo.report.security.headers.hsts', 'HSTS Header'),
      status: security.strictTransportSecurity
        ? `✓ ${present}`
        : `~ ${missing}`,
      purpose: t('seo.report.security.purpose.forceHttps', 'Force HTTPS'),
      details:
        security.strictTransportSecurity ||
        t('seo.report.security.details.hstsNotConfigured', notConfigured),
      recommended: 'max-age=31536000; includeSubDomains; preload'
    },
    {
      header: t('seo.report.security.headers.csp', 'Content Security Policy'),
      status: security.contentSecurityPolicy ? `✓ ${present}` : `~ ${missing}`,
      purpose: t('seo.report.security.purpose.xssProtection', 'XSS Protection'),
      details: security.contentSecurityPolicy
        ? configured
        : t('seo.report.security.details.injectionRisk', 'Vulnerable to injection attacks'),
      recommended: "default-src 'self'; script-src 'self'"
    },
    {
      header: t('seo.report.security.headers.xFrameOptions', 'X-Frame-Options'),
      status: security.xFrameOptions ? `✓ ${present}` : `~ ${missing}`,
      purpose: t('seo.report.security.purpose.clickjacking', 'Clickjacking Protection'),
      details:
        security.xFrameOptions ||
        t('seo.report.security.details.canEmbed', 'Can be embedded in iframes'),
      recommended: 'DENY or SAMEORIGIN'
    },
    {
      header: t('seo.report.security.headers.xContentTypeOptions', 'X-Content-Type-Options'),
      status: security.xContentTypeOptions ? `✓ ${present}` : `~ ${missing}`,
      purpose: t('seo.report.security.purpose.mimeSniffing', 'MIME Sniffing Protection'),
      details: security.xContentTypeOptions
        ? enabled
        : t('seo.report.security.details.misinterpret', 'Browser may misinterpret content'),
      recommended: 'nosniff'
    }
  ];
  
  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(255, 68, 68, 0.1); border-left: 4px solid #ff4444; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #ff4444;">${t('seo.report.security.calloutTitle', '◈ Security Headers Critical for SEO')}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          ${t(
            'seo.report.security.calloutBody',
            'Google prioritizes secure sites in rankings. Missing security headers can harm SEO and user trust. HTTPS is a direct ranking factor.'
          )}
        </p>
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.security.table.securityHeader', 'Security Header')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.status', 'Status')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.purpose', 'Purpose')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.details', 'Details')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.security.table.recommendedValue', 'Recommended Value')}</th>
          </tr>
        </thead>
        <tbody>
          ${securityChecks.map(({ header, status, purpose, details, recommended }) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${header}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.1rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${purpose}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; font-family: 'Courier New', monospace; word-break: break-all; border: 1px solid rgba(255, 255, 255, 0.05);">${details}</td>
              <td style="padding: 0.75rem; color: var(--accent-primary); font-size: 0.85rem; font-family: 'Courier New', monospace; border: 1px solid rgba(255, 255, 255, 0.05);">${recommended}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(security)}
    </div>
  `;
}

/**
 * Render Structured Data section content
 */
function renderStructuredDataContent(data) {
  const detected = t('seo.report.status.detected', 'Detected');
  const notFound = t('seo.report.status.notFound', 'Not found');

  const schemaMeta = (type, icon, descFallback, benefitFallback, fields) => ({
    icon,
    desc: t(`seo.report.structuredData.schemas.${type}.desc`, descFallback),
    benefit: t(`seo.report.structuredData.schemas.${type}.benefit`, benefitFallback),
    fields
  });

  // Common schema types with descriptions and benefits
  const commonSchemas = {
    Organization: schemaMeta(
      'Organization',
      '🏢',
      'Company/Brand information',
      'Establishes brand identity in Knowledge Graph',
      ['name', 'logo', 'url', 'contactPoint', 'sameAs']
    ),
    Person: schemaMeta(
      'Person',
      '👤',
      'Individual profile data',
      'Powers author rich snippets and Knowledge Panel',
      ['name', 'image', 'jobTitle', 'worksFor', 'sameAs']
    ),
    Product: schemaMeta(
      'Product',
      '🛍️',
      'Product listings & details',
      'Shows price, availability, and reviews in search',
      ['name', 'image', 'description', 'sku', 'offers', 'aggregateRating']
    ),
    Article: schemaMeta(
      'Article',
      '📰',
      'Blog posts & articles',
      'Enables article snippets with author and publish date',
      ['headline', 'author', 'datePublished', 'image']
    ),
    WebSite: schemaMeta(
      'WebSite',
      'W',
      'Website metadata',
      'Enables sitelinks search box in Google',
      ['name', 'url', 'potentialAction']
    ),
    BreadcrumbList: schemaMeta(
      'BreadcrumbList',
      '🍞',
      'Navigation breadcrumbs',
      'Shows breadcrumb trail in search results',
      ['itemListElement', 'position', 'name', 'item']
    ),
    LocalBusiness: schemaMeta(
      'LocalBusiness',
      '🏪',
      'Local business info',
      'Appears in local search and Google Maps',
      ['name', 'address', 'telephone', 'openingHours', 'geo']
    ),
    Event: schemaMeta(
      'Event',
      '📅',
      'Event information',
      'Shows event details in search with "Add to Calendar"',
      ['name', 'startDate', 'location', 'description', 'offers']
    ),
    Recipe: schemaMeta(
      'Recipe',
      '🍳',
      'Recipe content',
      'Rich recipe cards with ratings, cook time, calories',
      ['name', 'image', 'author', 'recipeIngredient', 'recipeInstructions']
    ),
    Review: schemaMeta(
      'Review',
      '*',
      'User reviews',
      'Display star ratings directly in search results',
      ['itemReviewed', 'reviewRating', 'author', 'reviewBody']
    ),
    VideoObject: schemaMeta(
      'VideoObject',
      '🎥',
      'Video content',
      'Video snippets with thumbnails and key moments',
      ['name', 'description', 'thumbnailUrl', 'uploadDate', 'duration']
    ),
    FAQPage: schemaMeta(
      'FAQPage',
      '?',
      'FAQ content',
      'Expandable FAQ sections in search results',
      ['mainEntity', 'name', 'acceptedAnswer']
    ),
    HowTo: schemaMeta(
      'HowTo',
      '📋',
      'Step-by-step guides',
      'Numbered steps with images in search',
      ['name', 'step', 'totalTime', 'tool', 'supply']
    ),
    SoftwareApplication: schemaMeta(
      'SoftwareApplication',
      'C',
      'Software/app details',
      'App install buttons and ratings in search',
      ['name', 'operatingSystem', 'applicationCategory', 'offers', 'aggregateRating']
    ),
    JobPosting: schemaMeta(
      'JobPosting',
      '💼',
      'Job listings',
      'Appears in Google for Jobs with salary and location',
      ['title', 'description', 'datePosted', 'employmentType', 'hiringOrganization']
    )
  };

  return `
    <div style="padding-left: 1rem;">
      
      <!-- What is Structured Data Info Box -->
      <div style="
        background: linear-gradient(135deg, rgba(0, 204, 255, 0.1) 0%, rgba(0, 204, 255, 0.05) 100%);
        border-left: 4px solid #00ccff;
        padding: 1.5rem;
        margin: 1rem 0;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,204,255,0.15);
      ">
        <div style="color: #00ccff; font-weight: bold; margin-bottom: 0.75rem; font-size: 1.1rem;">${t('seo.report.structuredData.info.title', 'ⓘ What is Structured Data Schema?')}</div>
        <div style="color: #c0c0c0; font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">
          ${t(
            'seo.report.structuredData.info.body',
            'Structured data (also called schema markup) is code that helps search engines understand your content better, enabling rich search results like star ratings, product prices, event dates, FAQ dropdowns, and more. It uses the Schema.org vocabulary in JSON-LD, Microdata, or RDFa formats.'
          )}
        </div>
        <div style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        ">
          <div style="padding: 0.75rem; background: rgba(var(--accent-primary-rgb), 0.1); border-radius: 6px; border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">
            <div style="color: var(--accent-primary); font-weight: bold; font-size: 0.85rem; margin-bottom: 0.3rem;">${t('seo.report.structuredData.info.cards.ctr.title', 'U Improved CTR')}</div>
            <div style="color: #b0b0b0; font-size: 0.8rem;">${t('seo.report.structuredData.info.cards.ctr.body', 'Rich results stand out and attract more clicks')}</div>
          </div>
          <div style="padding: 0.75rem; background: rgba(var(--accent-primary-rgb), 0.1); border-radius: 6px; border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">
            <div style="color: var(--accent-primary); font-weight: bold; font-size: 0.85rem; margin-bottom: 0.3rem;">${t('seo.report.structuredData.info.cards.targeting.title', 'T Better Targeting')}</div>
            <div style="color: #b0b0b0; font-size: 0.8rem;">${t('seo.report.structuredData.info.cards.targeting.body', 'Helps search engines understand your niche')}</div>
          </div>
          <div style="padding: 0.75rem; background: rgba(var(--accent-primary-rgb), 0.1); border-radius: 6px; border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">
            <div style="color: var(--accent-primary); font-weight: bold; font-size: 0.85rem; margin-bottom: 0.3rem;">${t('seo.report.structuredData.info.cards.advantage.title', 'W SEO Advantage')}</div>
            <div style="color: #b0b0b0; font-size: 0.8rem;">${t('seo.report.structuredData.info.cards.advantage.body', 'Competitive edge in search results')}</div>
          </div>
        </div>
      </div>

      <!-- Summary Table -->
      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> ${t('seo.report.structuredData.summary.heading', 'Summary')}</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.metric', 'Metric')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.status', 'Status')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.value', 'Value')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.structuredData.summary.table.impact', 'Impact')}</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${t('seo.report.structuredData.summary.rows.found.metric', 'Structured Data Found')}</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${data.hasStructuredData ? '✓' : '✗'}</td>
            <td style="padding: 0.75rem; color: ${data.hasStructuredData ? 'var(--accent-primary)' : '#ff6600'}; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.hasStructuredData ? detected : notFound}
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.hasStructuredData
                ? t('seo.report.structuredData.summary.rows.found.impact.detected', 'Enables rich search results')
                : t('seo.report.structuredData.summary.rows.found.impact.notFound', 'Missing enhanced search appearances')}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${t('seo.report.structuredData.summary.rows.types.metric', 'Schema Types Implemented')}</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">C</td>
            <td style="padding: 0.75rem; color: #00ccff; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.count} ${data.count === 1
                ? t('seo.report.structuredData.summary.rows.types.value.singular', 'Type')
                : t('seo.report.structuredData.summary.rows.types.value.plural', 'Types')}
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.count >= 3
                ? t('seo.report.structuredData.summary.rows.types.impact.great', 'Great coverage')
                : data.count >= 1
                  ? t('seo.report.structuredData.summary.rows.types.impact.good', 'Good start')
                  : t('seo.report.structuredData.summary.rows.types.impact.none', 'None implemented')}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${t('seo.report.structuredData.summary.rows.score.metric', 'Overall Score')}</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">T</td>
            <td style="padding: 0.75rem; color: #bb86fc; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.score}/100
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.score >= 80
                ? t('seo.report.structuredData.summary.rows.score.impact.excellent', 'Excellent implementation')
                : data.score >= 60
                  ? t('seo.report.structuredData.summary.rows.score.impact.room', 'Room for improvement')
                  : t('seo.report.structuredData.summary.rows.score.impact.critical', 'Critical gap')}
            </td>
          </tr>
        </tbody>
      </table>

      ${data.hasStructuredData ? `
        <!-- Detected Schema Types Table -->
        <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> ${t('seo.report.structuredData.detected.heading', 'Detected Schema Types')}</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <thead>
            <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); width: 30%;">${t('seo.report.structuredData.detected.table.schemaType', 'Schema Type')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); width: 45%;">${t('seo.report.structuredData.detected.table.seoBenefit', 'SEO Benefit')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); width: 25%;">${t('seo.report.structuredData.detected.table.keyFields', 'Key Fields')}</th>
            </tr>
          </thead>
          <tbody>
            ${data.types.map(type => {
              const schema = commonSchemas[type] || { 
                icon: 'R', 
                desc: t('seo.report.structuredData.detected.unknown.desc', 'Schema markup'),
                benefit: t('seo.report.structuredData.detected.unknown.benefit', 'Structured data implementation'),
                fields: []
              };
              return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.5rem;">${schema.icon}</span>
                      <div>
                        <div style="color: var(--accent-primary); font-weight: 600; font-size: 0.95rem;">${type}</div>
                        <div style="color: #808080; font-size: 0.75rem;">${schema.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; line-height: 1.5; border: 1px solid rgba(255, 255, 255, 0.05);">
                    ${schema.benefit}
                  </td>
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    ${schema.fields && schema.fields.length > 0 ? `
                      <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                        ${schema.fields.slice(0, 3).map(field => `
                          <span style="
                            background: rgba(0,204,255,0.15);
                            color: #00ccff;
                            padding: 0.15rem 0.4rem;
                            border-radius: 3px;
                            font-size: 0.7rem;
                            font-family: 'Courier New', monospace;
                            border: 1px solid rgba(0,204,255,0.3);
                          ">${field}</span>
                        `).join('')}
                        ${schema.fields.length > 3 ? `<span style="color: #808080; font-size: 0.7rem;">${t('seo.report.structuredData.detected.moreFields', '+{{count}} more', { count: schema.fields.length - 3 })}</span>` : ''}
                      </div>
                    ` : `<span style="color: #808080; font-size: 0.8rem;">${t('seo.report.structuredData.detected.na', 'N/A')}</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- Validation Tip -->
        <div style="
          background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.1) 0%, rgba(var(--accent-primary-rgb), 0.05) 100%);
          border-left: 4px solid var(--accent-primary);
          padding: 1rem;
          margin: 1rem 0;
          border-radius: 4px;
        ">
          <div style="color: var(--accent-primary); font-weight: bold; margin-bottom: 0.5rem;">${t('seo.report.structuredData.validation.title', '✓ Next Step: Validate Your Schema')}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6;">
            ${t('seo.report.structuredData.validation.body.beforeLink', 'Use')}
            <a href="https://search.google.com/test/rich-results" target="_blank" style="color: #00ccff; text-decoration: underline;">${t('seo.report.structuredData.validation.body.linkText', "Google's Rich Results Test")}</a>
            ${t('seo.report.structuredData.validation.body.afterLink', 'to ensure your structured data is error-free and eligible for rich snippets. Monitor Search Console for structured data errors.')}
          </div>
        </div>
      ` : `
        <!-- No Structured Data - Show Benefits and Guide -->
        <h3 style="color: #ff6600; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> ${t('seo.report.structuredData.missing.heading', 'Missing Critical SEO Opportunity')}</h3>
        <div style="
          padding: 1rem;
          background: rgba(255,102,0,0.05);
          border-left: 4px solid #ff6600;
          border-radius: 4px;
          margin-bottom: 1rem;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="font-size: 1.5rem;">~</div>
            <div>
              <div style="color: #ff6600; font-weight: bold; font-size: 1rem;">${t('seo.report.structuredData.missing.card.title', 'No Structured Data Detected')}</div>
              <div style="color: #c0c0c0; font-size: 0.85rem;">${t('seo.report.structuredData.missing.card.body', "You're missing enhanced search appearances that boost visibility and click-through rates")}</div>
            </div>
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <thead>
            <tr style="background: rgba(255, 102, 0, 0.1); border-bottom: 2px solid rgba(255, 102, 0, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff6600; border: 1px solid rgba(255, 102, 0, 0.2); width: 25%;">${t('seo.report.structuredData.missing.table.richResultType', 'Rich Result Type')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff6600; border: 1px solid rgba(255, 102, 0, 0.2); width: 50%;">${t('seo.report.structuredData.missing.table.whatMissing', "What You're Missing")}</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ff6600; border: 1px solid rgba(255, 102, 0, 0.2); width: 25%;">${t('seo.report.structuredData.missing.table.ctrImpact', 'CTR Impact')}</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">*</span>
                  <span style="color: #ffd700; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.starRatings.title', 'Star Ratings')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.starRatings.body', 'Display review stars and ratings directly in search results')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: var(--accent-primary); font-weight: bold; font-size: 0.9rem;">+35%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">💰</span>
                  <span style="color: var(--accent-primary); font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.productInfo.title', 'Product Info')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.productInfo.body', 'Show prices, availability, and special offers inline')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: var(--accent-primary); font-weight: bold; font-size: 0.9rem;">+25%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">📅</span>
                  <span style="color: #00ccff; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.eventDetails.title', 'Event Details')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.eventDetails.body', 'Event dates, locations, and ticket info with calendar integration')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+20%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">I</span>
                  <span style="color: #bb86fc; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.richMedia.title', 'Rich Media')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.richMedia.body', 'Enhanced thumbnails, carousels, and video snippets')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+18%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">?</span>
                  <span style="color: #ff8c00; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.faq.title', 'FAQ Dropdowns')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.faq.body', 'Expandable Q&A sections directly in search results')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+15%</span>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div style="
          padding: 0.75rem;
          background: rgba(var(--accent-primary-rgb), 0.05);
          border-left: 3px solid var(--accent-primary);
          border-radius: 4px;
          margin: 1rem 0;
        ">
          <div style="color: #c0c0c0; font-size: 0.85rem; line-height: 1.6;">
            <strong style="color: var(--accent-primary);">${t('seo.report.structuredData.proTip.label', 'ⓘ Pro Tip:')}</strong> ${t(
              'seo.report.structuredData.proTip.body',
              'Rich results can increase click-through rates by 15-35% according to Google research. Start with the foundational schemas below to unlock these benefits.'
            )}
          </div>
        </div>

        <!-- Recommended Schema Types for Your Site -->
        <h3 style="color: #00ccff; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> ${t('seo.report.structuredData.recommended.heading', 'Recommended Schema Types to Implement')}</h3>
        <div style="
          padding: 1rem;
          background: rgba(0,204,255,0.05);
          border-left: 4px solid #00ccff;
          border-radius: 4px;
          margin-bottom: 1rem;
        ">
          <div style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6;">
            <strong style="color: #00ccff;">${t('seo.report.structuredData.recommended.box.title', 'Start with these foundational schemas')}</strong>
            ${t('seo.report.structuredData.recommended.box.body', 'that work for almost every website. You can add more specific schemas based on your content type later.')}
          </div>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <thead>
            <tr style="background: rgba(0, 204, 255, 0.1); border-bottom: 2px solid rgba(0, 204, 255, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 25%;">${t('seo.report.structuredData.recommended.table.schemaType', 'Schema Type')}</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 12%;">${t('seo.report.structuredData.recommended.table.priority', 'Priority')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 40%;">${t('seo.report.structuredData.recommended.table.seoBenefit', 'SEO Benefit')}</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 23%;">${t('seo.report.structuredData.recommended.table.requiredFields', 'Required Fields')}</th>
            </tr>
          </thead>
          <tbody>
            ${[
              { type: 'Organization', priority: t('seo.report.structuredData.priority.high', 'HIGH'), color: '#ff6600' },
              { type: 'WebSite', priority: t('seo.report.structuredData.priority.high', 'HIGH'), color: '#ff6600' },
              { type: 'BreadcrumbList', priority: t('seo.report.structuredData.priority.medium', 'MEDIUM'), color: '#ffd700' },
              { type: 'Article', priority: t('seo.report.structuredData.priority.medium', 'MEDIUM'), color: '#ffd700' }
            ].map(item => {
              const schema = commonSchemas[item.type];
              return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.5rem;">${schema.icon}</span>
                      <div>
                        <div style="color: #00ccff; font-weight: 600; font-size: 0.95rem;">${item.type}</div>
                        <div style="color: #808080; font-size: 0.75rem;">${schema.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <span style="
                      background: ${item.color}30;
                      color: ${item.color};
                      padding: 0.25rem 0.6rem;
                      border-radius: 4px;
                      font-size: 0.7rem;
                      font-weight: bold;
                      border: 1px solid ${item.color}50;
                    ">${item.priority}</span>
                  </td>
                  <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; line-height: 1.5; border: 1px solid rgba(255, 255, 255, 0.05);">
                    ${schema.benefit}
                  </td>
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                      ${schema.fields.slice(0, 4).map(field => `
                        <span style="
                          background: rgba(0,204,255,0.15);
                          color: #00ccff;
                          padding: 0.15rem 0.4rem;
                          border-radius: 3px;
                          font-size: 0.7rem;
                          font-family: 'Courier New', monospace;
                          border: 1px solid rgba(0,204,255,0.3);
                        ">${field}</span>
                      `).join('')}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}

      <!-- Implementation Formats -->
      <h3 style="color: #bb86fc; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> ${t('seo.report.structuredData.formats.heading', 'Implementation Formats')}</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin: 1rem 0;">
        <div style="
          padding: 1.25rem;
          background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.08) 0%, rgba(var(--accent-primary-rgb), 0.02) 100%);
          border: 2px solid rgba(var(--accent-primary-rgb), 0.3);
          border-radius: 10px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">📝</div>
            <div>
              <div style="color: var(--accent-primary); font-weight: bold; font-size: 1rem;">JSON-LD</div>
              <div style="color: var(--accent-primary); font-size: 0.7rem; background: rgba(var(--accent-primary-rgb), 0.2); padding: 0.2rem 0.4rem; border-radius: 3px; display: inline-block; margin-top: 0.2rem;">${t('seo.report.structuredData.formats.jsonld.badge', 'RECOMMENDED')}</div>
            </div>
          </div>
          <div style="color: #b0b0b0; font-size: 0.85rem; line-height: 1.6; margin-bottom: 0.75rem;">
            ${t(
              'seo.report.structuredData.formats.jsonld.body',
              "JavaScript Object Notation for Linked Data. Google's preferred format - clean, separate from HTML, easy to maintain."
            )}
          </div>
          <div style="
            background: rgba(0,0,0,0.4);
            padding: 0.75rem;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #00ccff;
            border: 1px solid rgba(0,204,255,0.2);
          ">
            &lt;script type="application/ld+json"&gt;<br/>
            { "@context": "https://schema.org", ... }<br/>
            &lt;/script&gt;
          </div>
        </div>

        <div style="
          padding: 1.25rem;
          background: rgba(0,204,255,0.05);
          border: 2px solid rgba(0,204,255,0.2);
          border-radius: 10px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">🏷️</div>
            <div>
              <div style="color: #00ccff; font-weight: bold; font-size: 1rem;">Microdata</div>
              <div style="color: #808080; font-size: 0.7rem;">${t('seo.report.structuredData.formats.microdata.subtitle', 'HTML Attributes')}</div>
            </div>
          </div>
          <div style="color: #b0b0b0; font-size: 0.85rem; line-height: 1.6; margin-bottom: 0.75rem;">
            ${t(
              'seo.report.structuredData.formats.microdata.body',
              'Embedded directly in HTML tags. More complex to maintain but tightly couples markup with content.'
            )}
          </div>
          <div style="
            background: rgba(0,0,0,0.4);
            padding: 0.75rem;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #00ccff;
            border: 1px solid rgba(0,204,255,0.2);
          ">
            &lt;div itemscope itemtype="..."&gt;<br/>
            &nbsp;&nbsp;&lt;span itemprop="name"&gt;...&lt;/span&gt;<br/>
            &lt;/div&gt;
          </div>
        </div>

        <div style="
          padding: 1.25rem;
          background: rgba(187,134,252,0.05);
          border: 2px solid rgba(187,134,252,0.2);
          border-radius: 10px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">K</div>
            <div>
              <div style="color: #bb86fc; font-weight: bold; font-size: 1rem;">RDFa</div>
              <div style="color: #808080; font-size: 0.7rem;">${t('seo.report.structuredData.formats.rdfa.subtitle', 'Resource Description')}</div>
            </div>
          </div>
          <div style="color: #b0b0b0; font-size: 0.85rem; line-height: 1.6; margin-bottom: 0.75rem;">
            ${t(
              'seo.report.structuredData.formats.rdfa.body',
              'Resource Description Framework in Attributes. Similar to Microdata, uses different attribute names.'
            )}
          </div>
          <div style="
            background: rgba(0,0,0,0.4);
            padding: 0.75rem;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #bb86fc;
            border: 1px solid rgba(187,134,252,0.2);
          ">
            &lt;div vocab="..." typeof="..."&gt;<br/>
            &nbsp;&nbsp;&lt;span property="..."&gt;...&lt;/span&gt;<br/>
            &lt;/div&gt;
          </div>
        </div>
      </div>

      <!-- Resources Section -->
      <h3 style="color: #00ccff; margin: 1.5rem 0 0.5rem 0; font-size: 1.2rem;">>> ${t('seo.report.structuredData.resources.heading', 'Essential Resources & Tools')}</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(0, 204, 255, 0.1); border-bottom: 2px solid rgba(0, 204, 255, 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 25%;">${t('seo.report.structuredData.resources.table.tool', 'Tool')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 50%;">${t('seo.report.table.purpose', 'Purpose')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #00ccff; border: 1px solid rgba(0, 204, 255, 0.2); width: 25%;">${t('seo.report.structuredData.resources.table.link', 'Link')}</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">🔧</span>
                <span style="color: #00ccff; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.schemaDocs.title', 'Schema.org Docs')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.schemaDocs.purpose',
                'Official vocabulary reference with complete documentation for all schema types and properties'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://schema.org" target="_blank" style="color: #00ccff; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #00ccff;">${t('seo.report.structuredData.resources.rows.schemaDocs.linkText', 'schema.org →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">✓</span>
                <span style="color: var(--accent-primary); font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.richResultsTest.title', 'Rich Results Test')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.richResultsTest.purpose',
                'Test your structured data markup and see which Google rich results can be generated from it'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://search.google.com/test/rich-results" target="_blank" style="color: var(--accent-primary); text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted var(--accent-primary);">${t('seo.report.structuredData.resources.rows.richResultsTest.linkText', 'Test Markup →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">C</span>
                <span style="color: #ffd700; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.validator.title', 'Schema Validator')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.validator.purpose',
                'Comprehensive validation tool for all structured data formats including JSON-LD, Microdata, and RDFa'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://validator.schema.org/" target="_blank" style="color: #ffd700; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #ffd700;">${t('seo.report.structuredData.resources.rows.validator.linkText', 'Validate →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">📚</span>
                <span style="color: #bb86fc; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.googleGuide.title', 'Google Guide')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.googleGuide.purpose',
                'Step-by-step guide from Google on implementing structured data with code examples and best practices'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" target="_blank" style="color: #bb86fc; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #bb86fc;">${t('seo.report.structuredData.resources.rows.googleGuide.linkText', 'Read Guide →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">🔧</span>
                <span style="color: #ff8c00; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.generator.title', 'Markup Generator')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.generator.purpose',
                'Free tool to generate JSON-LD structured data markup for various schema types quickly and easily'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://technicalseo.com/tools/schema-markup-generator/" target="_blank" style="color: #ff8c00; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #ff8c00;">${t('seo.report.structuredData.resources.rows.generator.linkText', 'Generate →')}</a>
            </td>
          </tr>
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(data)}
    </div>
  `;
}

/**
 * Render Additional Checks section content
 */
function renderAdditionalChecksContent(checks) {
  const found = t('seo.report.status.found', 'Found');
  const notFound = t('seo.report.status.notFound', 'Not found');
  const present = t('seo.report.status.present', 'Present');
  const missing = t('seo.report.status.missing', 'Missing');
  const detected = t('seo.report.status.detected', 'Detected');
  const notDetected = t('seo.report.status.notDetected', 'Not detected');

  const additionalMetrics = [
    {
      check: 'robots.txt',
      status: checks.hasRobotsTxt ? `✓ ${found}` : `~ ${notFound}`,
      purpose: t('seo.report.additional.purpose.robots', 'Controls search engine crawling'),
      details: checks.hasRobotsTxt
        ? t('seo.report.additional.details.robotsPresent', 'File is present and accessible')
        : t('seo.report.additional.details.robotsMissing', 'Missing - create /robots.txt'),
      bestPractice: t(
        'seo.report.additional.bestPractice.robots',
        'Allow crawlers, disallow admin/private pages'
      )
    },
    {
      check: t('seo.report.additional.checks.sitemap', 'XML Sitemap'),
      status: checks.hasSitemap ? `✓ ${found}` : `~ ${notFound}`,
      purpose: t('seo.report.additional.purpose.sitemap', 'Helps search engines discover pages'),
      details: checks.hasSitemap
        ? t('seo.report.additional.details.sitemapDetected', 'Sitemap detected')
        : t('seo.report.additional.details.sitemapMissing', 'Missing - improves indexing'),
      bestPractice: t(
        'seo.report.additional.bestPractice.sitemap',
        'Submit to Google Search Console, update weekly'
      )
    },
    {
      check: t('seo.report.additional.checks.favicon', 'Favicon'),
      status: checks.hasFavicon ? `✓ ${present}` : `~ ${missing}`,
      purpose: t('seo.report.additional.purpose.favicon', 'Browser tab icon'),
      details: checks.hasFavicon
        ? t('seo.report.status.configured', 'Configured')
        : t('seo.report.additional.details.faviconMissing', 'No favicon found'),
      bestPractice: t(
        'seo.report.additional.bestPractice.favicon',
        '32x32 PNG or ICO, helps brand recognition'
      )
    },
    {
      check: t('seo.report.additional.checks.googleAnalytics', 'Google Analytics'),
      status: checks.googleAnalytics ? `✓ ${detected}` : `~ ${notDetected}`,
      purpose: t('seo.report.additional.purpose.analytics', 'Traffic tracking'),
      details: checks.googleAnalytics
        ? t('seo.report.additional.details.analyticsEnabled', 'Analytics tracking enabled')
        : t('seo.report.additional.details.analyticsMissing', 'No analytics detected'),
      bestPractice: t(
        'seo.report.additional.bestPractice.analytics',
        'GA4 recommended, track user behavior for SEO insights'
      )
    }
  ];

  const socialPlatforms = [
    {
      platform: 'Facebook',
      status: checks.socialLinks.facebook ? '✓' : '✗',
      value: t('seo.report.additional.social.value.openGraph', 'Meta Open Graph tags'),
      details: checks.socialLinks.facebook
        ? t('seo.report.additional.social.details.linkPresent', 'Link present')
        : t('seo.report.additional.social.details.facebookMissing', 'No Facebook link found'),
      tip: t(
        'seo.report.additional.social.tip.openGraph',
        'Add og:image, og:title, og:description tags'
      )
    },
    {
      platform: 'Twitter/X',
      status: checks.socialLinks.twitter ? '✓' : '✗',
      value: t('seo.report.additional.social.value.twitterCard', 'Twitter Card tags'),
      details: checks.socialLinks.twitter
        ? t('seo.report.additional.social.details.linkPresent', 'Link present')
        : t('seo.report.additional.social.details.twitterMissing', 'No Twitter link found'),
      tip: t(
        'seo.report.additional.social.tip.twitterCard',
        'Add twitter:card, twitter:image meta tags'
      )
    },
    {
      platform: 'LinkedIn',
      status: checks.socialLinks.linkedin ? '✓' : '✗',
      value: t('seo.report.additional.social.value.professional', 'Professional network'),
      details: checks.socialLinks.linkedin
        ? t('seo.report.additional.social.details.linkPresent', 'Link present')
        : t('seo.report.additional.social.details.linkedinMissing', 'No LinkedIn link found'),
      tip: t(
        'seo.report.additional.social.tip.linkedin',
        'Add to company footer, improves B2B credibility'
      )
    },
    {
      platform: 'Instagram',
      status: checks.socialLinks.instagram ? '✓' : '✗',
      value: t('seo.report.additional.social.value.visual', 'Visual content'),
      details: checks.socialLinks.instagram
        ? t('seo.report.additional.social.details.linkPresent', 'Link present')
        : t('seo.report.additional.social.details.instagramMissing', 'No Instagram link found'),
      tip: t(
        'seo.report.additional.social.tip.instagram',
        'Link to business profile, helps visual branding'
      )
    }
  ];
  
  return `
    <div style="padding-left: 1rem;">
      <div style="background: rgba(0, 150, 255, 0.1); border-left: 4px solid #0096ff; padding: 1rem; margin: 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #0096ff;">${t('seo.report.additional.calloutTitle', '🔧 Technical SEO Essentials')}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          ${t(
            'seo.report.additional.calloutBody',
            'These technical elements help search engines crawl, index, and understand your site. Missing items can significantly impact discoverability.'
          )}
        </p>
      </div>
      
      <h3 style="color: var(--accent-primary); margin: 1rem 0 0.5rem 0;">>> ${t('seo.report.additional.technicalHeading', 'Technical SEO')}</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.check', 'Check')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.status', 'Status')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.purpose', 'Purpose')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.details', 'Details')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.bestPractice', 'Best Practice')}</th>
          </tr>
        </thead>
        <tbody>
          ${additionalMetrics.map(({ check, status, purpose, details, bestPractice }) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${check}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.1rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${purpose}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.05);">${details}</td>
              <td style="padding: 0.75rem; color: var(--accent-primary); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">${bestPractice}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div style="background: rgba(138, 43, 226, 0.1); border-left: 4px solid #8a2be2; padding: 1rem; margin: 1.5rem 0 1rem 0; border-radius: 4px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #8a2be2;">${t('seo.report.additional.social.calloutTitle', 'M Social Signals & SEO')}</h4>
        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
          ${t(
            'seo.report.additional.social.calloutBody',
            'While not direct ranking factors, social links increase brand visibility, drive traffic, and improve Open Graph previews when content is shared.'
          )}
        </p>
      </div>

      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 0.5rem 0;">>> ${t('seo.report.additional.social.heading', 'Social Media Presence')}</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(var(--accent-primary-rgb), 0.1); border-bottom: 2px solid rgba(var(--accent-primary-rgb), 0.3);">
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.platform', 'Platform')}</th>
            <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.status', 'Status')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.seoValue', 'SEO Value')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.details', 'Details')}</th>
            <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); border: 1px solid rgba(var(--accent-primary-rgb), 0.2);">${t('seo.report.table.implementationTip', 'Implementation Tip')}</th>
          </tr>
        </thead>
        <tbody>
          ${socialPlatforms.map(({ platform, status, value, details, tip }) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 600; color: #e0e0e0; border: 1px solid rgba(255, 255, 255, 0.05);">${platform}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: #c0c0c0; border: 1px solid rgba(255, 255, 255, 0.05);">${value}</td>
              <td style="padding: 0.75rem; color: #909090; font-size: 0.9rem; border: 1px solid rgba(255, 255, 255, 0.05);">${details}</td>
              <td style="padding: 0.75rem; color: var(--accent-primary); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">${tip}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${renderIssuesAndRecommendations(checks)}
    </div>
  `;
}

/**
 * Render issues and recommendations
 */
function renderIssuesAndRecommendations(section) {
  let html = '';

  if (section.issues && section.issues.length > 0) {
    html += `<p style="color: #ff6600; margin-top: 0.5rem;">>> ${t('seo.report.issues.issuesHeading', 'issues')}:</p>`;
    section.issues.forEach(issue => {
      html += `<p style="margin-left: 1rem; color: #ff6600;">✗ ${issue}</p>`;
    });
  }

  if (section.recommendations && section.recommendations.length > 0) {
    html += `<p style="color: #00ccff; margin-top: 0.5rem;">>> ${t('seo.report.issues.recommendationsHeading', 'recommendations')}:</p>`;
    section.recommendations.forEach(rec => {
      html += `<p style="margin-left: 1rem; color: #00ccff;">ⓘ ${rec}</p>`;
    });
  }

  return html;
}

// Helper functions
function formatComponentName(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function getAccentPrimaryHex() {
  try {
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent-primary')
      .trim();
    if (accent) return accent;
  } catch (e) {
    // Ignore
  }

  const isLightTheme = document.body && document.body.classList.contains('white-theme');
  return isLightTheme ? '#dd3838' : '#5bf4e7';
}

// Get score color - Traditional traffic light system
// A grades (90-100): Green
// B grades (70-89): Yellow
// C grades (50-69): Orange
// Below C (<50): Red
function getScoreColor(score) {
  if (score >= 90) return getAccentPrimaryHex();
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
}

function truncateUrl(url, maxLength) {
  if (url.length <= maxLength) return url;
  return url.substring(0, maxLength) + '...';
}

function countTotalIssues(results) {
  let count = 0;
  for (const key in results) {
    if (results[key] && results[key].issues) {
      count += results[key].issues.length;
    }
  }
  return count;
}

function countTotalRecommendations(results) {
  let count = 0;
  for (const key in results) {
    if (results[key] && results[key].recommendations) {
      count += results[key].recommendations.length;
    }
  }
  return count;
}

function countPassedChecks(results) {
  let count = 0;
  for (const key in results) {
    if (results[key] && results[key].passed === true) {
      count++;
    }
  }
  return count;
}

function animateScoreCircle(score) {
  const circle = document.querySelector('.seo-score-circle');
  if (!circle) return;

  // Add color based on score
  if (score >= 90) circle.classList.add('score-a');
  else if (score >= 80) circle.classList.add('score-b');
  else if (score >= 70) circle.classList.add('score-c');
  else if (score >= 60) circle.classList.add('score-d');
  else circle.classList.add('score-f');

  // Animate number counting up
  const numberEl = circle.querySelector('.score-number');
  let current = 0;
  const increment = score / 50; // 50 frames
  const timer = setInterval(() => {
    current += increment;
    if (current >= score) {
      current = score;
      clearInterval(timer);
    }
    numberEl.textContent = Math.round(current);
  }, 20);
}

function getLoadingHTML() {
  return `
    <div class="section">
      <h2>[${t('seo.report.loading.title', 'ANALYZING')}]</h2>
      <div style="padding-left: 1rem;">
        <p>>> ${t('seo.report.loading.running', 'running comprehensive seo analysis...')}</p>
        <p>>> ${t('seo.report.loading.metaTags', 'checking meta tags...')}</p>
        <p>>> ${t('seo.report.loading.content', 'analyzing content quality...')}</p>
        <p>>> ${t('seo.report.loading.mobile', 'testing mobile responsiveness...')}</p>
        <p>>> ${t('seo.report.loading.performance', 'measuring performance...')}</p>
        <div class="loading-bar" style="margin-top: 1rem;"></div>
      </div>
    </div>
  `;
}

function showError(message) {
  const container = document.getElementById('seoResults');
  container.innerHTML = `
    <div class="section">
      <h2 style="color: #ff0000;">[${t('seo.report.error.title', 'ERROR')}]</h2>
      <div style="padding-left: 1rem;">
        <p>>> ${t('seo.report.error.analysisFailed', 'analysis_failed')}</p>
        <p style="color: #ff6600;">>> ${message}</p>
        <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ff6600; color: #000; border: none; cursor: pointer; font-family: 'Courier New', monospace; font-weight: bold;">${t('seo.report.error.retry', 'RETRY')}</button>
      </div>
    </div>
  `;
  container.style.display = 'block';
}

/**
 * Open PDF purchase modal
 */
// PDF purchase modal removed - monetization disabled

// Note: Accordion functions are exposed to window immediately after their definitions
// See toggleSeoFixAccordion, switchSeoFixTab, copySeoCode above

/**
 * Export SEO results as comprehensive CSV
 * Includes all scan data: meta tags, headings, content, images, links,
 * performance, security, structured data, and recommendations
 */
window.exportSeoCSV = function() {
  const results = window.currentSeoResults;
  if (!results) {
    alert('No scan results to export. Run a scan first.');
    return;
  }

  const rows = [];

  // Helper to add a row
  const addRow = (category, item, value, status = '', details = '') => {
    rows.push([category, item, String(value ?? ''), status, details]);
  };

  // Helper to check status
  const checkStatus = (condition, goodText = 'Good', badText = 'Issue') => condition ? goodText : badText;

  // Header
  rows.push(['Category', 'Item', 'Value', 'Status', 'Details']);

  // ============ OVERVIEW ============
  addRow('Overview', 'URL', results.url || '');
  addRow('Overview', 'Scan Date', results.timestamp || new Date().toISOString());
  if (results.score) {
    addRow('Overview', 'Overall SEO Score', results.score.overall || '', results.score.overall >= 80 ? 'Good' : results.score.overall >= 50 ? 'Needs Work' : 'Poor');
    addRow('Overview', 'Grade', results.score.grade || '');
  }

  // ============ META TAGS ============
  if (results.metaTags) {
    const meta = results.metaTags;
    addRow('Meta Tags', 'Section Score', meta.score || '', checkStatus(meta.score >= 80));

    // Title
    addRow('Meta Tags', 'Title', meta.title || '', checkStatus(meta.title, 'Present', 'Missing'));
    addRow('Meta Tags', 'Title Length', meta.titleLength || 0,
      meta.titleLength >= 50 && meta.titleLength <= 60 ? 'Optimal' :
      meta.titleLength >= 30 && meta.titleLength <= 70 ? 'Acceptable' : 'Needs Work',
      'Recommended: 50-60 characters');

    // Description
    addRow('Meta Tags', 'Description', meta.description || '', checkStatus(meta.description, 'Present', 'Missing'));
    addRow('Meta Tags', 'Description Length', meta.descriptionLength || 0,
      meta.descriptionLength >= 120 && meta.descriptionLength <= 160 ? 'Optimal' :
      meta.descriptionLength >= 80 && meta.descriptionLength <= 200 ? 'Acceptable' : 'Needs Work',
      'Recommended: 120-160 characters');

    // Technical meta tags
    addRow('Meta Tags', 'Canonical URL', meta.canonical || '', checkStatus(meta.canonical, 'Present', 'Missing'));
    addRow('Meta Tags', 'Robots', meta.robots || 'Not set', meta.robots ? 'Present' : 'Default');
    addRow('Meta Tags', 'Viewport', meta.viewport || '', checkStatus(meta.viewport, 'Present', 'Missing'));
    addRow('Meta Tags', 'Language', meta.language || '', checkStatus(meta.language, 'Present', 'Missing'));
    addRow('Meta Tags', 'Charset', meta.charset || '', checkStatus(meta.charset, 'Present', 'Missing'));
    addRow('Meta Tags', 'Author', meta.author || '', meta.author ? 'Present' : 'Not set');
    addRow('Meta Tags', 'Keywords', meta.keywords || '', meta.keywords ? 'Present' : 'Not set');

    // Open Graph tags
    addRow('Meta Tags', 'OG:Title', meta.ogTitle || '', checkStatus(meta.ogTitle, 'Present', 'Missing'));
    addRow('Meta Tags', 'OG:Description', meta.ogDescription || '', checkStatus(meta.ogDescription, 'Present', 'Missing'));
    addRow('Meta Tags', 'OG:Image', meta.ogImage || '', checkStatus(meta.ogImage, 'Present', 'Missing'));
    addRow('Meta Tags', 'OG:URL', meta.ogUrl || '', checkStatus(meta.ogUrl, 'Present', 'Missing'));
    addRow('Meta Tags', 'OG:Type', meta.ogType || '', meta.ogType ? 'Present' : 'Not set');
    addRow('Meta Tags', 'OG:Site Name', meta.ogSiteName || '', meta.ogSiteName ? 'Present' : 'Not set');

    // Twitter Card tags
    addRow('Meta Tags', 'Twitter:Card', meta.twitterCard || '', checkStatus(meta.twitterCard, 'Present', 'Missing'));
    addRow('Meta Tags', 'Twitter:Title', meta.twitterTitle || '', meta.twitterTitle ? 'Present' : 'Not set');
    addRow('Meta Tags', 'Twitter:Description', meta.twitterDescription || '', meta.twitterDescription ? 'Present' : 'Not set');
    addRow('Meta Tags', 'Twitter:Image', meta.twitterImage || '', meta.twitterImage ? 'Present' : 'Not set');
    addRow('Meta Tags', 'Twitter:Site', meta.twitterSite || '', meta.twitterSite ? 'Present' : 'Not set');

    // Meta tag issues
    if (meta.issues && meta.issues.length > 0) {
      meta.issues.forEach((issue, i) => addRow('Meta Tags', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (meta.recommendations && meta.recommendations.length > 0) {
      meta.recommendations.forEach((rec, i) => addRow('Meta Tags', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ HEADINGS ============
  if (results.headingStructure) {
    const h = results.headingStructure;
    addRow('Headings', 'Section Score', h.score || '', checkStatus(h.score >= 80));
    addRow('Headings', 'H1 Count', h.h1?.length || h.h1Count || 0, (h.h1?.length || h.h1Count) === 1 ? 'Good' : 'Issue', 'Should have exactly 1 H1');
    addRow('Headings', 'H2 Count', h.h2?.length || h.h2Count || 0);
    addRow('Headings', 'H3 Count', h.h3?.length || h.h3Count || 0);
    addRow('Headings', 'H4 Count', h.h4?.length || h.h4Count || 0);
    addRow('Headings', 'H5 Count', h.h5?.length || h.h5Count || 0);
    addRow('Headings', 'H6 Count', h.h6?.length || h.h6Count || 0);
    addRow('Headings', 'Total Headings', h.total || h.totalCount || 0, (h.total || h.totalCount) >= 3 ? 'Good' : 'Low');

    // H1 texts
    if (h.h1 && Array.isArray(h.h1)) {
      h.h1.forEach((text, i) => addRow('Headings', `H1 Text ${i + 1}`, text));
    }

    // Heading hierarchy
    if (h.hierarchy && Array.isArray(h.hierarchy)) {
      h.hierarchy.slice(0, 20).forEach((item, i) => {
        addRow('Headings', `Hierarchy ${i + 1}`, item.text || '', item.level || '');
      });
    }

    if (h.issues && h.issues.length > 0) {
      h.issues.forEach((issue, i) => addRow('Headings', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (h.recommendations && h.recommendations.length > 0) {
      h.recommendations.forEach((rec, i) => addRow('Headings', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ CONTENT ANALYSIS ============
  if (results.contentAnalysis) {
    const c = results.contentAnalysis;
    addRow('Content', 'Section Score', c.score || '', checkStatus(c.score >= 80));
    addRow('Content', 'Word Count', c.wordCount || 0, c.wordCount >= 300 ? 'Good' : c.wordCount >= 150 ? 'Low' : 'Very Low', 'Recommended: 300+ words');
    addRow('Content', 'Sentence Count', c.sentenceCount || 0);
    addRow('Content', 'Paragraph Count', c.paragraphCount || 0);
    addRow('Content', 'Character Count', c.characterCount || 0);
    addRow('Content', 'Avg Words/Sentence', c.averageWordsPerSentence || 0, c.averageWordsPerSentence <= 25 ? 'Good' : 'Too Long', 'Recommended: 15-25 words');
    addRow('Content', 'Text-to-HTML Ratio', ((c.textToHTMLRatio || 0) * 100).toFixed(1) + '%', c.textToHTMLRatio >= 0.1 ? 'Good' : 'Low', 'Recommended: 10%+');

    if (c.readabilityScore !== undefined) {
      addRow('Content', 'Readability Score', c.readabilityScore);
    }
    if (c.readingLevel) {
      addRow('Content', 'Reading Level', c.readingLevel);
    }

    if (c.issues && c.issues.length > 0) {
      c.issues.forEach((issue, i) => addRow('Content', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (c.recommendations && c.recommendations.length > 0) {
      c.recommendations.forEach((rec, i) => addRow('Content', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ IMAGES ============
  if (results.imageAnalysis || results.images) {
    const img = results.imageAnalysis || results.images;
    addRow('Images', 'Section Score', img.score || '', checkStatus(img.score >= 80));
    addRow('Images', 'Total Images', img.total || img.totalCount || 0);
    addRow('Images', 'With Alt Text', img.withAlt || 0, 'Good');
    addRow('Images', 'Without Alt Text', img.withoutAlt || img.missingAlt || 0, (img.withoutAlt || img.missingAlt) === 0 ? 'Good' : 'Issue', 'All images need alt text');

    // Count lazy loaded
    if (img.images && Array.isArray(img.images)) {
      const lazyCount = img.images.filter(i => i.loading === 'lazy').length;
      const eagerCount = img.images.filter(i => i.loading !== 'lazy').length;
      addRow('Images', 'Lazy Loaded', lazyCount);
      addRow('Images', 'Eager Loaded', eagerCount, eagerCount > 5 ? 'Consider lazy loading' : 'OK');

      // Large images
      const largeImages = img.images.filter(i => (i.width * i.height) > 1920 * 1080);
      addRow('Images', 'Large Images (>1080p)', largeImages.length, largeImages.length === 0 ? 'Good' : 'Optimize');

      // List first 20 images
      img.images.slice(0, 20).forEach((image, i) => {
        const altStatus = image.alt ? 'Has alt' : 'Missing alt';
        addRow('Images', `Image ${i + 1}`, image.src || '', altStatus, `${image.width || '?'}x${image.height || '?'}`);
      });
    }

    if (img.issues && img.issues.length > 0) {
      img.issues.forEach((issue, i) => addRow('Images', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (img.recommendations && img.recommendations.length > 0) {
      img.recommendations.forEach((rec, i) => addRow('Images', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ LINKS ============
  if (results.linkAnalysis || results.links) {
    const l = results.linkAnalysis || results.links;
    addRow('Links', 'Section Score', l.score || '', checkStatus(l.score >= 80));
    addRow('Links', 'Total Links', l.total || l.totalCount || 0);
    addRow('Links', 'Internal Links', l.internal || l.internalCount || 0);
    addRow('Links', 'External Links', l.external || l.externalCount || 0);
    addRow('Links', 'NoFollow Links', l.noFollow || l.nofollowCount || 0);
    addRow('Links', 'Broken Format Links', l.brokenFormat || l.brokenCount || 0, (l.brokenFormat || l.brokenCount) === 0 ? 'Good' : 'Issue');

    // List first 30 links
    if (l.links && Array.isArray(l.links)) {
      const emptyAnchors = l.links.filter(link => !link.text || link.text.length === 0).length;
      addRow('Links', 'Empty Anchor Text', emptyAnchors, emptyAnchors === 0 ? 'Good' : 'Issue');

      l.links.slice(0, 30).forEach((link, i) => {
        const type = link.isExternal ? 'External' : 'Internal';
        const flags = [
          link.hasNoFollow ? 'nofollow' : '',
          link.hasNoOpener ? 'noopener' : '',
          link.target === '_blank' ? 'new tab' : ''
        ].filter(Boolean).join(', ');
        addRow('Links', `Link ${i + 1}`, link.href || '', type, flags || link.text?.substring(0, 50) || '');
      });
    }

    if (l.issues && l.issues.length > 0) {
      l.issues.forEach((issue, i) => addRow('Links', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (l.recommendations && l.recommendations.length > 0) {
      l.recommendations.forEach((rec, i) => addRow('Links', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ MOBILE RESPONSIVENESS ============
  if (results.mobileResponsive) {
    const m = results.mobileResponsive;
    addRow('Mobile', 'Section Score', m.score || '', checkStatus(m.score >= 80));
    addRow('Mobile', 'Mobile Friendly', m.isMobileFriendly ? 'Yes' : 'No', checkStatus(m.isMobileFriendly));
    addRow('Mobile', 'Has Viewport Meta', m.hasViewport ? 'Yes' : 'No', checkStatus(m.hasViewport));
    addRow('Mobile', 'Touch Friendly', m.isTouchFriendly ? 'Yes' : 'No', checkStatus(m.isTouchFriendly));
    addRow('Mobile', 'Responsive Design', m.isResponsive ? 'Yes' : 'No', checkStatus(m.isResponsive));

    if (m.issues && m.issues.length > 0) {
      m.issues.forEach((issue, i) => addRow('Mobile', `Issue ${i + 1}`, issue, 'Issue'));
    }
  }

  // ============ PERFORMANCE METRICS ============
  if (results.performanceMetrics) {
    const p = results.performanceMetrics;
    addRow('Performance', 'Section Score', p.score || '', checkStatus(p.score >= 80));

    if (p.fcp) addRow('Performance', 'First Contentful Paint (FCP)', p.fcp + 'ms', p.fcp < 1800 ? 'Good' : p.fcp < 3000 ? 'Moderate' : 'Poor');
    if (p.lcp) addRow('Performance', 'Largest Contentful Paint (LCP)', p.lcp + 'ms', p.lcp < 2500 ? 'Good' : p.lcp < 4000 ? 'Moderate' : 'Poor');
    if (p.cls !== undefined) addRow('Performance', 'Cumulative Layout Shift (CLS)', p.cls, p.cls < 0.1 ? 'Good' : p.cls < 0.25 ? 'Moderate' : 'Poor');
    if (p.tbt) addRow('Performance', 'Total Blocking Time (TBT)', p.tbt + 'ms', p.tbt < 200 ? 'Good' : p.tbt < 600 ? 'Moderate' : 'Poor');
    if (p.tti) addRow('Performance', 'Time to Interactive (TTI)', p.tti + 'ms');
    if (p.ttfb) addRow('Performance', 'Time to First Byte (TTFB)', p.ttfb + 'ms', p.ttfb < 800 ? 'Good' : 'Slow');
    if (p.domContentLoaded) addRow('Performance', 'DOM Content Loaded', p.domContentLoaded + 'ms');
    if (p.load) addRow('Performance', 'Page Load Time', p.load + 'ms');
    if (p.pageSize) addRow('Performance', 'Page Size', (p.pageSize / 1024).toFixed(1) + ' KB');
    if (p.requestCount) addRow('Performance', 'Total Requests', p.requestCount);

    if (p.issues && p.issues.length > 0) {
      p.issues.forEach((issue, i) => addRow('Performance', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (p.recommendations && p.recommendations.length > 0) {
      p.recommendations.forEach((rec, i) => addRow('Performance', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ SECURITY HEADERS ============
  if (results.securityHeaders) {
    const s = results.securityHeaders;
    addRow('Security', 'Section Score', s.score || '', checkStatus(s.score >= 80));
    addRow('Security', 'HTTPS', s.isHttps ? 'Yes' : 'No', checkStatus(s.isHttps));

    // Individual headers
    const headers = s.headers || s;
    if (headers.contentSecurityPolicy !== undefined) {
      addRow('Security', 'Content-Security-Policy', headers.contentSecurityPolicy ? 'Present' : 'Missing', checkStatus(headers.contentSecurityPolicy));
    }
    if (headers.xFrameOptions !== undefined) {
      addRow('Security', 'X-Frame-Options', headers.xFrameOptions || 'Missing', checkStatus(headers.xFrameOptions));
    }
    if (headers.xContentTypeOptions !== undefined) {
      addRow('Security', 'X-Content-Type-Options', headers.xContentTypeOptions || 'Missing', checkStatus(headers.xContentTypeOptions));
    }
    if (headers.strictTransportSecurity !== undefined) {
      addRow('Security', 'Strict-Transport-Security', headers.strictTransportSecurity ? 'Present' : 'Missing', checkStatus(headers.strictTransportSecurity));
    }
    if (headers.referrerPolicy !== undefined) {
      addRow('Security', 'Referrer-Policy', headers.referrerPolicy || 'Missing', checkStatus(headers.referrerPolicy));
    }
    if (headers.permissionsPolicy !== undefined) {
      addRow('Security', 'Permissions-Policy', headers.permissionsPolicy ? 'Present' : 'Missing', headers.permissionsPolicy ? 'Good' : 'Optional');
    }

    if (s.issues && s.issues.length > 0) {
      s.issues.forEach((issue, i) => addRow('Security', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (s.recommendations && s.recommendations.length > 0) {
      s.recommendations.forEach((rec, i) => addRow('Security', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ STRUCTURED DATA ============
  if (results.structuredData) {
    const sd = results.structuredData;
    addRow('Structured Data', 'Section Score', sd.score || '', checkStatus(sd.score >= 80));
    addRow('Structured Data', 'Has Structured Data', sd.hasStructuredData ? 'Yes' : 'No', checkStatus(sd.hasStructuredData, 'Good', 'Missing'));
    addRow('Structured Data', 'JSON-LD Found', sd.jsonLdCount || 0);
    addRow('Structured Data', 'Microdata Found', sd.microdataCount || 0);

    // Schema types
    if (sd.schemaTypes && sd.schemaTypes.length > 0) {
      addRow('Structured Data', 'Schema Types', sd.schemaTypes.join(', '));
    }

    // JSON-LD details
    if (sd.jsonLd && Array.isArray(sd.jsonLd)) {
      sd.jsonLd.slice(0, 5).forEach((item, i) => {
        addRow('Structured Data', `JSON-LD ${i + 1} Type`, item['@type'] || 'Unknown');
      });
    }

    if (sd.issues && sd.issues.length > 0) {
      sd.issues.forEach((issue, i) => addRow('Structured Data', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (sd.recommendations && sd.recommendations.length > 0) {
      sd.recommendations.forEach((rec, i) => addRow('Structured Data', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ ADDITIONAL CHECKS ============
  if (results.additionalChecks) {
    const ac = results.additionalChecks;
    addRow('Additional Checks', 'Section Score', ac.score || '', checkStatus(ac.score >= 80));

    // Common additional checks
    if (ac.hasRobotsTxt !== undefined) addRow('Additional Checks', 'robots.txt', ac.hasRobotsTxt ? 'Found' : 'Missing', checkStatus(ac.hasRobotsTxt));
    if (ac.hasSitemap !== undefined) addRow('Additional Checks', 'Sitemap', ac.hasSitemap ? 'Found' : 'Missing', checkStatus(ac.hasSitemap));
    if (ac.hasFavicon !== undefined) addRow('Additional Checks', 'Favicon', ac.hasFavicon ? 'Found' : 'Missing', checkStatus(ac.hasFavicon));
    if (ac.hasAppleTouchIcon !== undefined) addRow('Additional Checks', 'Apple Touch Icon', ac.hasAppleTouchIcon ? 'Found' : 'Missing');
    if (ac.has404Page !== undefined) addRow('Additional Checks', 'Custom 404 Page', ac.has404Page ? 'Yes' : 'No');
    if (ac.hasSSL !== undefined) addRow('Additional Checks', 'SSL Certificate', ac.hasSSL ? 'Valid' : 'Issue', checkStatus(ac.hasSSL));
    if (ac.mixedContent !== undefined) addRow('Additional Checks', 'Mixed Content', ac.mixedContent ? 'Issue Found' : 'None', checkStatus(!ac.mixedContent));
    if (ac.hasAMP !== undefined) addRow('Additional Checks', 'AMP Version', ac.hasAMP ? 'Yes' : 'No');
    if (ac.hasPWA !== undefined) addRow('Additional Checks', 'PWA Ready', ac.hasPWA ? 'Yes' : 'No');

    // Checks array
    if (ac.checks && Array.isArray(ac.checks)) {
      ac.checks.forEach((check, i) => {
        addRow('Additional Checks', check.name || `Check ${i + 1}`, check.value || '', check.passed ? 'Pass' : 'Fail');
      });
    }

    if (ac.issues && ac.issues.length > 0) {
      ac.issues.forEach((issue, i) => addRow('Additional Checks', `Issue ${i + 1}`, issue, 'Issue'));
    }
    if (ac.recommendations && ac.recommendations.length > 0) {
      ac.recommendations.forEach((rec, i) => addRow('Additional Checks', `Recommendation ${i + 1}`, rec, 'Suggestion'));
    }
  }

  // ============ SCORE BREAKDOWN ============
  if (results.score && results.score.breakdown) {
    const breakdown = results.score.breakdown;
    Object.entries(breakdown).forEach(([category, data]) => {
      const score = typeof data === 'number' ? data : data?.score;
      if (score !== undefined) {
        addRow('Score Breakdown', category, score, score >= 80 ? 'Good' : score >= 50 ? 'Needs Work' : 'Poor');
      }
    });
  }

  // Convert to CSV string with proper escaping
  const csvContent = rows.map(row =>
    row.map(cell => {
      const cellStr = String(cell ?? '');
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') || cellStr.includes('\r')) {
        return '"' + cellStr.replace(/"/g, '""') + '"';
      }
      return cellStr;
    }).join(',')
  ).join('\n');

  // Add BOM for Excel UTF-8 compatibility
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const hostname = results.url ? new URL(results.url).hostname : 'site';
  const filename = `seo-report-${hostname}-${new Date().toISOString().split('T')[0]}.csv`;

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Show confirmation
  if (window.ReportUI?.toast) {
    window.ReportUI.toast(`CSV exported: ${rows.length - 1} data points`);
  }
};

/**
 * Export SEO results as professionally designed Excel workbook
 * Uses ExcelJS for full styling support (colors, fonts, borders)
 */
window.exportSeoExcel = async function() {
  const results = window.currentSeoResults;
  if (!results) {
    alert('No scan results to export. Run a scan first.');
    return;
  }

  // Check if ExcelJS is loaded
  if (typeof ExcelJS === 'undefined') {
    alert('Excel export library not loaded. Please try again or use CSV export.');
    return;
  }

  // Show loading toast
  if (window.ReportUI?.toast) {
    window.ReportUI.toast('Generating Excel report...');
  }

  // Brand colors
  const COLORS = {
    brand: 'DD3838',        // Site Mechanic red
    brandDark: 'B82E2E',
    headerBg: '1a1a2e',     // Dark header
    headerText: 'FFFFFF',
    good: '22C55E',         // Green
    goodBg: 'DCFCE7',
    warning: 'F59E0B',      // Orange
    warningBg: 'FEF3C7',
    bad: 'EF4444',          // Red
    badBg: 'FEE2E2',
    neutral: '6B7280',      // Gray
    neutralBg: 'F3F4F6',
    white: 'FFFFFF',
    lightGray: 'F9FAFB',
    borderColor: 'E5E7EB',
    textDark: '1F2937',
    textMuted: '6B7280',
  };

  // Style presets
  const styles = {
    title: { font: { bold: true, size: 18, color: { argb: COLORS.brand } } },
    subtitle: { font: { bold: true, size: 14, color: { argb: COLORS.textDark } } },
    sectionHeader: {
      font: { bold: true, size: 11, color: { argb: COLORS.headerText } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.headerBg } },
      alignment: { vertical: 'middle', horizontal: 'left' },
      border: { bottom: { style: 'thin', color: { argb: COLORS.borderColor } } }
    },
    tableHeader: {
      font: { bold: true, size: 10, color: { argb: COLORS.headerText } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.brand } },
      alignment: { vertical: 'middle', horizontal: 'center' },
      border: {
        top: { style: 'thin', color: { argb: COLORS.borderColor } },
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } }
      }
    },
    dataRow: {
      font: { size: 10, color: { argb: COLORS.textDark } },
      alignment: { vertical: 'middle', wrapText: true },
      border: {
        bottom: { style: 'thin', color: { argb: COLORS.borderColor } },
        left: { style: 'thin', color: { argb: COLORS.borderColor } },
        right: { style: 'thin', color: { argb: COLORS.borderColor } }
      }
    },
    altRow: {
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.lightGray } }
    },
    goodStatus: {
      font: { bold: true, color: { argb: COLORS.good } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.goodBg } }
    },
    warningStatus: {
      font: { bold: true, color: { argb: COLORS.warning } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.warningBg } }
    },
    badStatus: {
      font: { bold: true, color: { argb: COLORS.bad } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.badBg } }
    },
    score: (score) => ({
      font: { bold: true, size: 12, color: { argb: score >= 80 ? COLORS.good : score >= 50 ? COLORS.warning : COLORS.bad } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: score >= 80 ? COLORS.goodBg : score >= 50 ? COLORS.warningBg : COLORS.badBg } },
      alignment: { horizontal: 'center', vertical: 'middle' }
    }),
    codeBlock: {
      font: { name: 'Consolas', size: 9, color: { argb: COLORS.textDark } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.neutralBg } },
      alignment: { wrapText: true, vertical: 'top' }
    }
  };

  // Helper functions
  const applyStyle = (cell, style) => {
    if (style.font) cell.font = style.font;
    if (style.fill) cell.fill = style.fill;
    if (style.alignment) cell.alignment = style.alignment;
    if (style.border) cell.border = style.border;
  };

  const getStatusStyle = (status) => {
    if (!status) return null;
    const s = String(status).toLowerCase();
    if (s.includes('good') || s.includes('pass') || s.includes('present') || s.includes('valid') || s.includes('optimal') || s === 'yes') {
      return styles.goodStatus;
    } else if (s.includes('issue') || s.includes('fail') || s.includes('missing') || s.includes('poor') || s.includes('bad') || s === 'no') {
      return styles.badStatus;
    } else if (s.includes('warning') || s.includes('moderate') || s.includes('needs') || s.includes('low') || s.includes('review')) {
      return styles.warningStatus;
    }
    return null;
  };

  const addStyledRow = (ws, data, isHeader = false, isAlt = false) => {
    const row = ws.addRow(data);
    row.eachCell((cell, colNumber) => {
      if (isHeader) {
        applyStyle(cell, styles.tableHeader);
      } else {
        applyStyle(cell, styles.dataRow);
        if (isAlt) applyStyle(cell, styles.altRow);
        // Check for status column styling
        const statusStyle = getStatusStyle(cell.value);
        if (statusStyle && colNumber >= 3) {
          applyStyle(cell, statusStyle);
        }
      }
    });
    row.height = isHeader ? 22 : 18;
    return row;
  };

  const addSectionTitle = (ws, title, colspan = 4) => {
    ws.addRow([]);
    const row = ws.addRow([title]);
    ws.mergeCells(row.number, 1, row.number, colspan);
    const cell = ws.getCell(row.number, 1);
    applyStyle(cell, styles.sectionHeader);
    row.height = 26;
    return row;
  };

  // Create workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Site Mechanic';
  wb.created = new Date();

  // ============ OVERVIEW SHEET ============
  const wsOverview = wb.addWorksheet('Overview', {
    properties: { tabColor: { argb: COLORS.brand } }
  });
  wsOverview.columns = [
    { width: 25 }, { width: 50 }, { width: 15 }, { width: 30 }
  ];

  // Title row
  const titleRow = wsOverview.addRow(['SEO Analysis Report']);
  wsOverview.mergeCells(1, 1, 1, 4);
  applyStyle(wsOverview.getCell('A1'), styles.title);
  titleRow.height = 30;

  // Subtitle with branding
  const brandRow = wsOverview.addRow(['Powered by Site Mechanic']);
  applyStyle(wsOverview.getCell('A2'), { font: { size: 10, italic: true, color: { argb: COLORS.textMuted } } });

  wsOverview.addRow([]);

  // URL and Date
  const urlRow = wsOverview.addRow(['Analyzed URL:', results.url || '']);
  applyStyle(wsOverview.getCell('A4'), { font: { bold: true } });

  const dateRow = wsOverview.addRow(['Scan Date:', new Date(results.timestamp || Date.now()).toLocaleString()]);
  applyStyle(wsOverview.getCell('A5'), { font: { bold: true } });

  wsOverview.addRow([]);

  // Overall Score - Big and prominent
  const scoreLabel = wsOverview.addRow(['OVERALL SEO SCORE']);
  wsOverview.mergeCells(scoreLabel.number, 1, scoreLabel.number, 4);
  applyStyle(wsOverview.getCell(`A${scoreLabel.number}`), styles.subtitle);

  const overallScore = results.score?.overall || 0;
  const scoreRow = wsOverview.addRow([overallScore, '/100', results.score?.grade || '']);
  applyStyle(wsOverview.getCell(`A${scoreRow.number}`), {
    font: { bold: true, size: 36, color: { argb: overallScore >= 80 ? COLORS.good : overallScore >= 50 ? COLORS.warning : COLORS.bad } }
  });
  applyStyle(wsOverview.getCell(`B${scoreRow.number}`), { font: { size: 14, color: { argb: COLORS.textMuted } } });
  applyStyle(wsOverview.getCell(`C${scoreRow.number}`), styles.score(overallScore));
  scoreRow.height = 45;

  wsOverview.addRow([]);

  // Score Breakdown
  addSectionTitle(wsOverview, '📊 Score Breakdown', 4);
  addStyledRow(wsOverview, ['Category', 'Score', 'Status', 'Grade'], true);

  if (results.score?.breakdown) {
    let rowIdx = 0;
    Object.entries(results.score.breakdown).forEach(([category, data]) => {
      const score = typeof data === 'number' ? data : data?.score;
      if (score !== undefined) {
        const status = score >= 80 ? 'Good' : score >= 50 ? 'Needs Work' : 'Poor';
        const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
        const row = addStyledRow(wsOverview, [category, score, status, grade], false, rowIdx % 2 === 1);
        // Style the score cell
        applyStyle(row.getCell(2), styles.score(score));
        rowIdx++;
      }
    });
  }

  // ============ META TAGS SHEET ============
  if (results.metaTags) {
    const meta = results.metaTags;
    const wsMeta = wb.addWorksheet('Meta Tags');
    wsMeta.columns = [{ width: 22 }, { width: 60 }, { width: 12 }, { width: 35 }];

    // Title with score
    const metaTitle = wsMeta.addRow(['🏷️ Meta Tags Analysis', '', `Score: ${meta.score || 0}`, '']);
    wsMeta.mergeCells(1, 1, 1, 2);
    applyStyle(wsMeta.getCell('A1'), styles.title);
    applyStyle(wsMeta.getCell('C1'), styles.score(meta.score || 0));
    metaTitle.height = 28;
    wsMeta.addRow([]);

    // Basic Meta Tags section
    addSectionTitle(wsMeta, '📝 Basic Meta Tags', 4);
    addStyledRow(wsMeta, ['Tag', 'Value', 'Status', 'Notes'], true);
    const basicTags = [
      ['Title', meta.title || '', meta.title ? 'Present' : 'Missing', `${meta.titleLength || 0} chars`],
      ['Description', (meta.description || '').substring(0, 80) + '...', meta.description ? 'Present' : 'Missing', `${meta.descriptionLength || 0} chars`],
      ['Canonical URL', meta.canonical || '', meta.canonical ? 'Present' : 'Missing', ''],
      ['Robots', meta.robots || 'Not set', meta.robots ? 'Present' : 'Default', ''],
      ['Viewport', meta.viewport ? 'Configured' : '', meta.viewport ? 'Present' : 'Missing', ''],
      ['Language', meta.language || '', meta.language ? 'Present' : 'Missing', ''],
      ['Charset', meta.charset || '', meta.charset ? 'Present' : 'Missing', ''],
    ];
    basicTags.forEach((row, i) => addStyledRow(wsMeta, row, false, i % 2 === 1));

    wsMeta.addRow([]);

    // Open Graph section
    addSectionTitle(wsMeta, '📘 Open Graph Tags', 4);
    addStyledRow(wsMeta, ['Tag', 'Value', 'Status', 'Notes'], true);
    const ogTags = [
      ['og:title', meta.ogTitle || '', meta.ogTitle ? 'Present' : 'Missing', ''],
      ['og:description', (meta.ogDescription || '').substring(0, 60) + '...', meta.ogDescription ? 'Present' : 'Missing', ''],
      ['og:image', meta.ogImage ? 'Set' : '', meta.ogImage ? 'Present' : 'Missing', 'Recommended: 1200x630px'],
      ['og:url', meta.ogUrl || '', meta.ogUrl ? 'Present' : 'Missing', ''],
      ['og:type', meta.ogType || '', meta.ogType ? 'Present' : 'Not set', ''],
    ];
    ogTags.forEach((row, i) => addStyledRow(wsMeta, row, false, i % 2 === 1));

    wsMeta.addRow([]);

    // Twitter Card section
    addSectionTitle(wsMeta, '🐦 Twitter Card Tags', 4);
    addStyledRow(wsMeta, ['Tag', 'Value', 'Status', 'Notes'], true);
    const twitterTags = [
      ['twitter:card', meta.twitterCard || '', meta.twitterCard ? 'Present' : 'Missing', ''],
      ['twitter:title', meta.twitterTitle || '', meta.twitterTitle ? 'Present' : 'Not set', ''],
      ['twitter:description', (meta.twitterDescription || '').substring(0, 60), meta.twitterDescription ? 'Present' : 'Not set', ''],
      ['twitter:image', meta.twitterImage ? 'Set' : '', meta.twitterImage ? 'Present' : 'Not set', ''],
    ];
    twitterTags.forEach((row, i) => addStyledRow(wsMeta, row, false, i % 2 === 1));

    // Issues and recommendations
    if (meta.issues?.length > 0) {
      wsMeta.addRow([]);
      addSectionTitle(wsMeta, '⚠️ Issues Found', 4);
      meta.issues.forEach(issue => {
        const row = wsMeta.addRow([issue]);
        wsMeta.mergeCells(row.number, 1, row.number, 4);
        applyStyle(row.getCell(1), { font: { color: { argb: COLORS.bad } } });
      });
    }
  }

  // ============ HEADINGS SHEET ============
  if (results.headingStructure) {
    const h = results.headingStructure;
    const wsHead = wb.addWorksheet('Headings');
    wsHead.columns = [{ width: 15 }, { width: 70 }, { width: 12 }];

    const headTitle = wsHead.addRow(['📑 Headings Analysis', '', `Score: ${h.score || 0}`]);
    applyStyle(wsHead.getCell('A1'), styles.title);
    applyStyle(wsHead.getCell('C1'), styles.score(h.score || 0));
    headTitle.height = 28;
    wsHead.addRow([]);

    addSectionTitle(wsHead, 'Heading Counts', 3);
    addStyledRow(wsHead, ['Level', 'Count', 'Status'], true);
    const h1Count = h.h1?.length || h.h1Count || 0;
    addStyledRow(wsHead, ['H1', h1Count, h1Count === 1 ? 'Good' : 'Issue'], false, false);
    addStyledRow(wsHead, ['H2', h.h2?.length || h.h2Count || 0, ''], false, true);
    addStyledRow(wsHead, ['H3', h.h3?.length || h.h3Count || 0, ''], false, false);
    addStyledRow(wsHead, ['H4', h.h4?.length || h.h4Count || 0, ''], false, true);
    addStyledRow(wsHead, ['H5', h.h5?.length || h.h5Count || 0, ''], false, false);
    addStyledRow(wsHead, ['H6', h.h6?.length || h.h6Count || 0, ''], false, true);
    addStyledRow(wsHead, ['Total', h.total || h.totalCount || 0, (h.total || h.totalCount) >= 3 ? 'Good' : 'Low'], false, false);

    if (h.h1 && Array.isArray(h.h1) && h.h1.length > 0) {
      wsHead.addRow([]);
      addSectionTitle(wsHead, 'H1 Content', 3);
      h.h1.forEach((text, i) => addStyledRow(wsHead, [`H1 #${i + 1}`, text, ''], false, i % 2 === 1));
    }
  }

  // ============ CONTENT SHEET ============
  if (results.contentAnalysis) {
    const c = results.contentAnalysis;
    const wsContent = wb.addWorksheet('Content');
    wsContent.columns = [{ width: 25 }, { width: 20 }, { width: 12 }, { width: 30 }];

    const contTitle = wsContent.addRow(['📄 Content Analysis', '', `Score: ${c.score || 0}`, '']);
    applyStyle(wsContent.getCell('A1'), styles.title);
    applyStyle(wsContent.getCell('C1'), styles.score(c.score || 0));
    contTitle.height = 28;
    wsContent.addRow([]);

    addSectionTitle(wsContent, 'Content Metrics', 4);
    addStyledRow(wsContent, ['Metric', 'Value', 'Status', 'Target'], true);
    addStyledRow(wsContent, ['Word Count', c.wordCount || 0, c.wordCount >= 300 ? 'Good' : 'Low', '300+ recommended'], false, false);
    addStyledRow(wsContent, ['Sentences', c.sentenceCount || 0, '', ''], false, true);
    addStyledRow(wsContent, ['Paragraphs', c.paragraphCount || 0, '', ''], false, false);
    addStyledRow(wsContent, ['Avg Words/Sentence', c.averageWordsPerSentence || 0, c.averageWordsPerSentence <= 25 ? 'Good' : 'Long', '15-25 words'], false, true);
    addStyledRow(wsContent, ['Text-to-HTML Ratio', ((c.textToHTMLRatio || 0) * 100).toFixed(1) + '%', c.textToHTMLRatio >= 0.1 ? 'Good' : 'Low', '10%+'], false, false);
  }

  // ============ IMAGES SHEET ============
  if (results.imageAnalysis || results.images) {
    const img = results.imageAnalysis || results.images;
    const wsImg = wb.addWorksheet('Images');
    wsImg.columns = [{ width: 8 }, { width: 55 }, { width: 35 }, { width: 15 }, { width: 10 }];

    const imgTitle = wsImg.addRow(['🖼️ Images Analysis', '', '', `Score: ${img.score || 0}`, '']);
    applyStyle(wsImg.getCell('A1'), styles.title);
    applyStyle(wsImg.getCell('D1'), styles.score(img.score || 0));
    imgTitle.height = 28;
    wsImg.addRow([]);

    addSectionTitle(wsImg, 'Image Statistics', 5);
    addStyledRow(wsImg, ['', 'Metric', 'Value', 'Status', ''], true);
    addStyledRow(wsImg, ['', 'Total Images', img.total || 0, '', ''], false, false);
    addStyledRow(wsImg, ['', 'With Alt Text', img.withAlt || 0, 'Good', ''], false, true);
    addStyledRow(wsImg, ['', 'Missing Alt Text', img.withoutAlt || img.missingAlt || 0, (img.withoutAlt || img.missingAlt) === 0 ? 'Good' : 'Issue', ''], false, false);

    if (img.images && img.images.length > 0) {
      wsImg.addRow([]);
      addSectionTitle(wsImg, 'Image Details (first 30)', 5);
      addStyledRow(wsImg, ['#', 'Source', 'Alt Text', 'Size', 'Loading'], true);
      img.images.slice(0, 30).forEach((image, i) => {
        addStyledRow(wsImg, [
          i + 1,
          (image.src || '').substring(0, 60),
          image.alt || '(missing)',
          `${image.width || '?'}x${image.height || '?'}`,
          image.loading || 'eager'
        ], false, i % 2 === 1);
      });
    }
  }

  // ============ LINKS SHEET ============
  if (results.linkAnalysis || results.links) {
    const l = results.linkAnalysis || results.links;
    const wsLinks = wb.addWorksheet('Links');
    wsLinks.columns = [{ width: 8 }, { width: 55 }, { width: 35 }, { width: 12 }, { width: 20 }];

    const linkTitle = wsLinks.addRow(['🔗 Links Analysis', '', '', `Score: ${l.score || 0}`, '']);
    applyStyle(wsLinks.getCell('A1'), styles.title);
    applyStyle(wsLinks.getCell('D1'), styles.score(l.score || 0));
    linkTitle.height = 28;
    wsLinks.addRow([]);

    addSectionTitle(wsLinks, 'Link Statistics', 5);
    addStyledRow(wsLinks, ['', 'Metric', 'Value', 'Status', ''], true);
    addStyledRow(wsLinks, ['', 'Total Links', l.total || 0, '', ''], false, false);
    addStyledRow(wsLinks, ['', 'Internal', l.internal || 0, '', ''], false, true);
    addStyledRow(wsLinks, ['', 'External', l.external || 0, '', ''], false, false);
    addStyledRow(wsLinks, ['', 'Broken/Empty', l.brokenFormat || 0, (l.brokenFormat || 0) === 0 ? 'Good' : 'Issue', ''], false, true);

    if (l.links && l.links.length > 0) {
      wsLinks.addRow([]);
      addSectionTitle(wsLinks, 'Link Details (first 50)', 5);
      addStyledRow(wsLinks, ['#', 'URL', 'Anchor Text', 'Type', 'Attributes'], true);
      l.links.slice(0, 50).forEach((link, i) => {
        addStyledRow(wsLinks, [
          i + 1,
          (link.href || '').substring(0, 60),
          (link.text || '').substring(0, 40),
          link.isExternal ? 'External' : 'Internal',
          [link.hasNoFollow ? 'nofollow' : '', link.target === '_blank' ? 'new tab' : ''].filter(Boolean).join(', ') || '-'
        ], false, i % 2 === 1);
      });
    }
  }

  // ============ PERFORMANCE SHEET ============
  if (results.performanceMetrics) {
    const p = results.performanceMetrics;
    const wsPerf = wb.addWorksheet('Performance');
    wsPerf.columns = [{ width: 35 }, { width: 20 }, { width: 12 }, { width: 15 }];

    const perfTitle = wsPerf.addRow(['⚡ Performance Metrics', '', `Score: ${p.score || 0}`, '']);
    applyStyle(wsPerf.getCell('A1'), styles.title);
    applyStyle(wsPerf.getCell('C1'), styles.score(p.score || 0));
    perfTitle.height = 28;
    wsPerf.addRow([]);

    addSectionTitle(wsPerf, 'Core Web Vitals', 4);
    addStyledRow(wsPerf, ['Metric', 'Value', 'Status', 'Target'], true);
    if (p.fcp) addStyledRow(wsPerf, ['First Contentful Paint', p.fcp + 'ms', p.fcp < 1800 ? 'Good' : p.fcp < 3000 ? 'Moderate' : 'Poor', '< 1.8s'], false, false);
    if (p.lcp) addStyledRow(wsPerf, ['Largest Contentful Paint', p.lcp + 'ms', p.lcp < 2500 ? 'Good' : p.lcp < 4000 ? 'Moderate' : 'Poor', '< 2.5s'], false, true);
    if (p.cls !== undefined) addStyledRow(wsPerf, ['Cumulative Layout Shift', p.cls, p.cls < 0.1 ? 'Good' : p.cls < 0.25 ? 'Moderate' : 'Poor', '< 0.1'], false, false);
    if (p.tbt) addStyledRow(wsPerf, ['Total Blocking Time', p.tbt + 'ms', p.tbt < 200 ? 'Good' : p.tbt < 600 ? 'Moderate' : 'Poor', '< 200ms'], false, true);
    if (p.ttfb) addStyledRow(wsPerf, ['Time to First Byte', p.ttfb + 'ms', p.ttfb < 800 ? 'Good' : 'Slow', '< 800ms'], false, false);
  }

  // ============ SECURITY SHEET ============
  if (results.securityHeaders) {
    const s = results.securityHeaders;
    const wsSec = wb.addWorksheet('Security');
    wsSec.columns = [{ width: 30 }, { width: 40 }, { width: 12 }];

    const secTitle = wsSec.addRow(['🔒 Security Analysis', '', `Score: ${s.score || 0}`]);
    applyStyle(wsSec.getCell('A1'), styles.title);
    applyStyle(wsSec.getCell('C1'), styles.score(s.score || 0));
    secTitle.height = 28;
    wsSec.addRow([]);

    addSectionTitle(wsSec, 'Security Headers', 3);
    addStyledRow(wsSec, ['Header', 'Value', 'Status'], true);
    addStyledRow(wsSec, ['HTTPS', s.isHttps ? 'Yes' : 'No', s.isHttps ? 'Good' : 'Issue'], false, false);
    const headers = s.headers || s;
    if (headers.contentSecurityPolicy !== undefined)
      addStyledRow(wsSec, ['Content-Security-Policy', headers.contentSecurityPolicy ? 'Present' : 'Missing', headers.contentSecurityPolicy ? 'Good' : 'Issue'], false, true);
    if (headers.xFrameOptions !== undefined)
      addStyledRow(wsSec, ['X-Frame-Options', headers.xFrameOptions || 'Missing', headers.xFrameOptions ? 'Good' : 'Issue'], false, false);
    if (headers.strictTransportSecurity !== undefined)
      addStyledRow(wsSec, ['Strict-Transport-Security', headers.strictTransportSecurity ? 'Present' : 'Missing', headers.strictTransportSecurity ? 'Good' : 'Issue'], false, true);
  }

  // ============ FIX CODE SHEET ============
  if (typeof buildFixCards === 'function') {
    try {
      const fixCards = buildFixCards(results);
      if (fixCards && fixCards.length > 0) {
        const wsFix = wb.addWorksheet('Fix Code', { properties: { tabColor: { argb: COLORS.good } } });
        wsFix.columns = [{ width: 100 }];

        const fixTitle = wsFix.addRow(['🔧 Fix Code + Recommendations']);
        applyStyle(wsFix.getCell('A1'), styles.title);
        fixTitle.height = 30;
        wsFix.addRow(['Actionable fixes to improve your SEO score']);
        applyStyle(wsFix.getCell('A2'), { font: { italic: true, color: { argb: COLORS.textMuted } } });
        wsFix.addRow([]);

        fixCards.forEach((fix, index) => {
          // Fix header
          const headerRow = wsFix.addRow([`FIX ${index + 1}: ${fix.title}`]);
          applyStyle(headerRow.getCell(1), {
            font: { bold: true, size: 12, color: { argb: COLORS.white } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fix.severity === 'High' ? COLORS.bad : fix.severity === 'Medium' ? COLORS.warning : COLORS.neutral } }
          });
          headerRow.height = 24;

          wsFix.addRow([`Severity: ${fix.severity || 'Medium'} | Category: ${fix.category || 'General'}`]);
          wsFix.addRow([`Impact: ${fix.impact || ''}`]);
          wsFix.addRow([]);
          wsFix.addRow([fix.description || '']);
          wsFix.addRow([]);

          // Problem code
          const probHeader = wsFix.addRow(['❌ CURRENT ISSUE:']);
          applyStyle(probHeader.getCell(1), { font: { bold: true, color: { argb: COLORS.bad } } });
          (fix.problematicCode || '').split('\n').forEach(line => {
            const row = wsFix.addRow([line]);
            applyStyle(row.getCell(1), styles.codeBlock);
          });
          wsFix.addRow([]);

          // Solution code
          const solHeader = wsFix.addRow(['✅ RECOMMENDED FIX:']);
          applyStyle(solHeader.getCell(1), { font: { bold: true, color: { argb: COLORS.good } } });
          (fix.snippet || '').split('\n').forEach(line => {
            const row = wsFix.addRow([line]);
            applyStyle(row.getCell(1), styles.codeBlock);
          });
          wsFix.addRow([]);

          // Steps
          if (fix.steps && fix.steps.length > 0) {
            const stepsHeader = wsFix.addRow(['📋 IMPLEMENTATION STEPS:']);
            applyStyle(stepsHeader.getCell(1), { font: { bold: true } });
            fix.steps.forEach((step, i) => wsFix.addRow([`${i + 1}. ${step}`]));
          }
          wsFix.addRow([]);
          wsFix.addRow(['─'.repeat(80)]);
          wsFix.addRow([]);
        });
      }
    } catch (e) {
      console.warn('Could not generate Fix Code sheet:', e);
    }
  }

  // ============ GENERATE FILE ============
  const hostname = results.url ? new URL(results.url).hostname : 'site';
  const filename = `seo-report-${hostname}-${new Date().toISOString().split('T')[0]}.xlsx`;

  try {
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    if (window.ReportUI?.toast) {
      window.ReportUI.toast(`Excel exported: ${wb.worksheets.length} sheets`);
    }
  } catch (err) {
    console.error('Excel export error:', err);
    alert('Failed to export Excel. Try CSV export instead.');
  }
};

/**
 * Copy shareable link to clipboard
 */
window.copyShareLink = function() {
  const reportId = document.body.getAttribute('data-report-id') || '';
  const url = window.currentSeoResults?.url || '';

  if (!reportId) {
    alert('No report to share. Run a scan first.');
    return;
  }

  // Build share URL with report_id
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set('report_id', reportId);
  if (url) {
    shareUrl.searchParams.set('url', url);
  }
  shareUrl.searchParams.delete('billing_success');
  shareUrl.searchParams.delete('session_id');
  shareUrl.searchParams.delete('auto_scan');

  navigator.clipboard.writeText(shareUrl.toString()).then(() => {
    if (window.ReportUI?.toast) {
      window.ReportUI.toast('Share link copied to clipboard!');
    } else {
      alert('Share link copied to clipboard!');
    }
  }).catch(() => {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = shareUrl.toString();
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      if (window.ReportUI?.toast) {
        window.ReportUI.toast('Share link copied to clipboard!');
      } else {
        alert('Share link copied to clipboard!');
      }
    } catch (e) {
      alert('Failed to copy link. URL: ' + shareUrl.toString());
    }
    document.body.removeChild(textArea);
  });
};

/**
 * Export SEO results as PDF
 * Uses the unified PDF export utility (pdf-export-utility.js)
 * @deprecated Direct calls should use window.exportReportPDF() instead
 */
window.exportSEOPDF = async function() {
  const results = window.currentSeoResults;
  if (!results) {
    alert('No scan results to export. Run a scan first.');
    return;
  }

  const container = document.getElementById('seoResults');
  if (!container || container.hidden) {
    alert('No results to export. Run a scan first.');
    return;
  }

  // Use the unified PDF export utility
  if (typeof window.exportReportPDF === 'function') {
    const button = document.querySelector('[data-export="pdf"]');
    await window.exportReportPDF({
      reportType: 'seo',
      buttonElement: button
    });
  } else {
    console.error('PDF export utility not loaded');
    alert('PDF export is not available. Please refresh the page.');
  }
};
