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
  
  // Auto-start scan if URL parameter is present
  if (typeof window.getUrlParameter === 'function') {
    const autoUrl = window.getUrlParameter();
    if (autoUrl) {
      urlInput.value = autoUrl;
      // Trigger scan after a short delay to ensure all scripts are loaded
      setTimeout(() => {
        submitButton.click();
      }, 500);
    }
  }

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
});

/**
 * Display SEO analysis results
 */
function displaySEOResults(results) {
  const container = document.getElementById('seoResults');

  // Store results globally for PDF generation + follow-up UI updates
  window.currentSeoResults = results;

  const reportId = results && results.reportId ? String(results.reportId) : '';
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
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
  const isUnlocked = !!(
    reportId &&
    window.CreditsManager &&
    (
      (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
      (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
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
          features: ['pdf', 'csv', 'share'],
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
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.seo-fix-expand-icon');

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

// Switch tabs
function switchSeoFixTab(accordionId, tabName) {
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
