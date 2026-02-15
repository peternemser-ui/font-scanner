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
  let result = typeof fallback === 'string' ? fallback : key;
  // Replace params in fallback string too (fixes {{count}} etc.)
  if (params && typeof result === 'string') {
    Object.keys(params).forEach(p => {
      result = result.replace(new RegExp('\\{\\{' + p + '\\}\\}', 'g'), params[p]);
    });
  }
  return result;
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
  // Initialize PageShell for unified page structure
  const shell = window.PageShell.init('#page-container', {
    pageId: 'seo-analyzer',
    pageTitle: t('seo.title', 'SEO Analyzer'),
    pageDescription: t('seo.subtitle', 'Search Engine Optimization Audit'),
    analyzerType: 'seo',
    apiEndpoint: '/api/seo',

    i18n: {
      title: 'seo.title',
      subtitle: 'seo.subtitle'
    },

    urlInput: {
      placeholder: 'https://yoursite.com',
      label: t('common.websiteUrl', 'Website URL'),
      i18nPlaceholder: 'common.enterUrl',
      i18nLabel: 'common.websiteUrl'
    },

    scanButton: {
      text: t('seo.analyze', 'ANALYZE SEO'),
      loadingText: t('seo.analyzing', 'ANALYZING...'),
      i18nText: 'seo.analyze'
    },

    loadingSteps: () => [
      { label: t('seo.steps.running', 'Running SEO analysis'), detail: t('seo.steps.initializing', 'Initializing scan engine...') },
      { label: t('seo.steps.metaTags', 'Checking meta tags'), detail: t('seo.steps.metaTagsDetail', 'Analyzing title, description, keywords...') },
      { label: t('seo.steps.content', 'Analyzing content quality'), detail: t('seo.steps.contentDetail', 'Evaluating headings, text, readability...') },
      { label: t('seo.steps.mobile', 'Testing mobile responsiveness'), detail: t('seo.steps.mobileDetail', 'Checking viewport and layout...') },
      { label: t('seo.steps.performance', 'Measuring performance'), detail: t('seo.steps.performanceDetail', 'Testing load speed and optimization...') }
    ],

    legacyIds: {
      urlInput: 'seoUrlInput',
      scanButton: 'seoAnalyzeButton',
      results: 'seoResults'
    },

    timeout: 60000,

    onScanComplete: (results) => {
      displaySEOResults(results);
    },

    onScanError: (error, errorMessage) => {
      console.error('SEO scan error:', error);
      shell.showError(errorMessage);
    }
  });

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

  // Re-render when entitlements arrive/change (handles race conditions
  // where sections rendered before billing status was available)
  window.addEventListener('entitlements:updated', () => {
    if (window.SM_IS_SCANNING) return;
    if (window.currentSeoResults) {
      try {
        console.log('[SEO] Entitlements updated, re-rendering results');
        displaySEOResults(window.currentSeoResults);
      } catch (e) {
        // ignore
      }
    }
  });

  // Listen for restore scan results event (after payment return)
  window.addEventListener('sm:restoreScanResults', async (e) => {
    const { results, url, analyzer } = e.detail || {};
    if (results && analyzer?.includes('seo')) {
      // Fill URL input
      if (url) {
        shell.setUrl(url);
      }

      // CRITICAL: Fetch billing status BEFORE displaying results so Pro sections unlock correctly
      const reportId = document.body?.getAttribute('data-report-id') || '';
      if (reportId && window.ProReportBlock?.fetchBillingStatus) {
        console.log('[SEO] Fetching billing status before display (payment return)...');
        await window.ProReportBlock.fetchBillingStatus(true); // Force refresh
        console.log('[SEO] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId));
      }

      // Display results
      window.currentSeoResults = results;
      displaySEOResults(results);
    }
  });

  // Handle billing re-scan: user returned from Stripe but cached results weren't available.
  // Re-scan with the purchased reportId preserved so pro sections render unlocked.
  window.addEventListener('sm:billingRescan', (e) => {
    const { reportId: purchasedReportId, url: scanUrl } = e.detail || {};
    const analyzerKey = window.SM_ANALYZER_KEY || '';
    if (!analyzerKey.includes('seo')) return; // Not for this analyzer
    console.log('[SEO] Billing re-scan requested:', { purchasedReportId, scanUrl });
    window.__smBillingRescanHandled = true;

    // Pre-fill URL input
    if (scanUrl) {
      shell.setUrl(scanUrl);
    }

    // Ensure the purchased reportId is set on the body so preserveReportId logic picks it up
    if (purchasedReportId) {
      document.body.setAttribute('data-report-id', purchasedReportId);
    }

    // Trigger re-scan with preserveReportId to keep the purchased reportId
    shell.startScan({ preserveReportId: true });
  });

  // Expose displaySEOResults globally for billing return handler
  window.displaySEOResults = displaySEOResults;
});

/**
 * Display SEO analysis results
 */
function displaySEOResults(results) {
  console.log('[SEO] displaySEOResults called with:', results);

  // Validate data - ignore cached error responses
  if (!results || results.error || typeof results === 'string') {
    console.warn('[SEO] Ignoring invalid/error data:', results?.error || results);
    return;
  }

  const container = document.getElementById('seoResults');
  console.log('[SEO] Results container found:', !!container);
  console.log('[SEO] ReportContainer available:', !!window.ReportContainer, typeof window.ReportContainer?.create);
  console.log('[SEO] ReportAccordion available:', !!window.ReportAccordion, typeof window.ReportAccordion?.createSection);

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

  // Clear container and ensure it's visible
  container.innerHTML = '';
  container.hidden = false;
  container.removeAttribute('hidden');
  container.classList.remove('hidden');
  container.style.display = 'block';

  const startedAt = results.startedAt || results.timestamp || '';

  // Gated Recommendations (reference implementation)
  // Pro/Day Pass users get global access; single-report purchases need reportId
  const isUnlocked = !!(
    // Pro/Day Pass: global access regardless of reportId
    (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
    // Report-specific access checks (need reportId)
    (reportId && (
      (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function' && window.ProReportBlock.hasAccess(reportId)) ||
      (window.CreditsManager && (
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
      ))
    ))
  );

  let reportHTML = '';
  try {
    // Summary donuts (standard shell)
    const summary = [];
    if (results && results.score && typeof results.score.overall === 'number') {
      summary.push({ label: t('seo.overall', 'Overall'), score: results.score.overall });
    }
    if (results && results.score && results.score.breakdown) {
      const hiddenSeoSections = ['performanceMetrics', 'securityHeaders'];
      Object.entries(results.score.breakdown).forEach(([key, data]) => {
        if (hiddenSeoSections.includes(key)) return;
        let score = null;
        if (typeof data === 'number') score = data;
        else if (data && typeof data.score === 'number') score = data.score;
        const translatedLabel = t(`seo.components.${key}`, null);
        summary.push({ label: translatedLabel && translatedLabel !== `seo.components.${key}` ? translatedLabel : formatComponentName(key), score });
      });
    }

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
        contentHTML: results.mobileResponsive
          ? renderMobileResponsivenessContent(results.mobileResponsive)
          : renderUnavailableSection(t('seo.report.unavailable.mobile', 'Mobile responsiveness data requires full headless analysis. This scan used lightweight mode.'))
      },
      {
        id: 'structured-data',
        title: getSeoSectionTitle('structuredData', 'Structured Data'),
        scoreTextRight: results.structuredData?.score,
        isPro: true,
        locked: !isUnlocked,
        context: 'seo',
        reportId,
        contentHTML: results.structuredData ? renderStructuredDataContent(results.structuredData)
          : renderUnavailableSection(t('seo.report.unavailable.structuredData', 'Structured data analysis unavailable.'))
      },
      {
        id: 'additional-checks',
        title: getSeoSectionTitle('additional', 'Additional Checks'),
        scoreTextRight: results.additionalChecks?.score,
        isPro: true,
        locked: !isUnlocked,
        context: 'seo',
        reportId,
        contentHTML: results.additionalChecks ? renderAdditionalChecksContent(results.additionalChecks)
          : renderUnavailableSection(t('seo.report.unavailable.additional', 'Additional checks require full headless analysis.'))
      },
      {
        id: 'report-recommendations',
        title: getSeoSectionTitle('fixCode', 'Recommendations'),
        scoreTextRight: results.score?.overall,
        isPro: true,
        locked: !isUnlocked,
        context: 'seo',
        reportId,
        contentHTML: renderProFixes(results)
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
      ? [{ src: screenshotUrl, alt: t('common.pageScreenshotAlt', 'Page screenshot'), device: '' }]
      : [];

    if (screenshots.length) {
      screenshots[0].alt = t('common.pageScreenshotAlt', screenshots[0].alt);
    }

    console.log('[SEO] Building report HTML, sections count:', sections.length);
    console.log('[SEO] Summary items:', summary.length);
    console.log('[SEO] Screenshots:', screenshots.length);

    reportHTML = (window.ReportContainer && typeof window.ReportContainer.create === 'function')
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
        : `<h2>${t('seo.reportTitle', 'SEO Report')}</h2>`
      }
    `;
  } catch (renderErr) {
    console.error('[SEO] Error building report HTML:', renderErr);
    reportHTML = `<div class="error-message"><h2>${t('seo.report.error.renderingTitle', 'Error Rendering Report')}</h2><p>${renderErr.message || t('seo.report.error.unknownError', 'Unknown error')}</p></div>`;
  }

  console.log('[SEO] Report HTML length:', reportHTML?.length || 0);
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

  // Dispatch report:ready for PDF export and ReportJump triggers
  window.__REPORT_READY__ = true;
  window.dispatchEvent(new CustomEvent('report:ready'));
}

/**
 * Render a placeholder for sections unavailable in lightweight mode
 */
function renderUnavailableSection(message) {
  return `
    <div style="padding: 1.5rem; text-align: center; color: var(--text-secondary); background: rgba(0,0,0,0.03); border-radius: 8px; margin: 1rem 0;">
      <p style="margin: 0; font-size: 0.95rem;">${message}</p>
      <p style="margin: 0.5rem 0 0; font-size: 0.85rem; opacity: 0.7;">${t('seo.report.unavailable.retryHint', 'Try scanning again — full analysis may succeed on retry.')}</p>
    </div>`;
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
    msg.style.cssText = 'padding: 12px; border: 1px dashed var(--border-color); border-radius: 12px; color: var(--text-secondary); text-align: center;';
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

  // Remove locked state from Pro Report Blocks (show accent border after unlock)
  document.querySelectorAll('.pro-report-block--locked, .pro-report-block[data-locked]').forEach((block) => {
    block.classList.remove('pro-report-block--locked');
    block.removeAttribute('data-locked');
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
      title: t('seo.proPreview.security.title', 'Security Analysis'),
      items: [
        t('seo.proPreview.security.items.https', 'HTTPS configuration'),
        t('seo.proPreview.security.items.headers', 'Security headers audit'),
        t('seo.proPreview.security.items.cookies', 'Cookie security settings')
      ]
    },
    structuredData: {
      title: t('seo.proPreview.structuredData.title', 'Structured Data'),
      items: [
        t('seo.proPreview.structuredData.items.schema', 'Schema.org validation'),
        t('seo.proPreview.structuredData.items.richSnippets', 'Rich snippet eligibility'),
        t('seo.proPreview.structuredData.items.jsonld', 'JSON-LD recommendations')
      ]
    },
    additionalChecks: {
      title: t('seo.proPreview.additionalChecks.title', 'Additional Checks'),
      items: [
        t('seo.proPreview.additionalChecks.items.robots', 'Robots.txt analysis'),
        t('seo.proPreview.additionalChecks.items.sitemap', 'Sitemap validation'),
        t('seo.proPreview.additionalChecks.items.canonical', 'Canonical URL check')
      ]
    }
  };

  const preview = previews[sectionType] || {
    title: t('seo.proPreview.default.title', 'Pro Analysis'),
    items: [
      t('seo.proPreview.default.items.analysis', 'Detailed analysis'),
      t('seo.proPreview.default.items.recommendations', 'Recommendations')
    ]
  };

  return `
    <div style="padding: 1rem;">
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        ${t('seo.proPreview.unlockToView', 'Unlock to view:')}
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
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 12px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> ${t('seo.fixes.excellentSeo', 'Excellent SEO!')}
        </h3>
        <p style="color: #86efac; margin: 0;">${t('seo.fixes.excellentSeoDesc', 'Your site follows SEO best practices. Keep monitoring for continued success.')}</p>
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
        <span style="font-size: 1.75rem;">🔍</span> ${t('seo.fixes.title', 'SEO Fixes')}
        <span style="font-size: 0.875rem; color: var(--r-text-faint, #9CA3AF); font-weight: normal;">(${t('seo.fixes.improvementsFound', '{{count}} improvements found', { count: fixes.length })})</span>
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
      <div class="seo-fix-header" data-action="toggle-accordion" data-accordion-id="${accordionId}" style="
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
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${fix.category || t('seo.fixes.defaultCategory', 'SEO Optimization')}</p>
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
          ">${t(`seo.fixes.severity.${fix.severity.toLowerCase()}`, fix.severity).toUpperCase()}</span>
          <span class="seo-fix-expand-icon" style="color: var(--r-text-faint, #9CA3AF); transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="seo-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderSeoFixTabs(fix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderSeoFixTabs(fix, accordionId) {
  return `
    <div class="seo-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); padding-bottom: 0.75rem;">
      <button class="seo-fix-tab active" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: var(--r-text, #111827);
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('seo.fixes.tabs.summary', 'Summary')}</button>
      <button class="seo-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 ${t('seo.fixes.tabs.code', 'Code')}</button>
      <button class="seo-fix-tab" data-action="switch-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));
        border-radius: 6px;
        background: transparent;
        color: var(--r-text-faint, #9CA3AF);
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 ${t('seo.fixes.tabs.fixGuide', 'Fix Guide')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="seo-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin: 0 0 1rem 0;">
        ${fix.description}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ ${t('seo.fixes.expectedImpact', 'Expected Impact')}</div>
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${fix.impact}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="seo-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ ${t('seo.fixes.currentIssue', 'Current Issue')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-problem" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeHtml(fix.problematicCode || fix.currentIssue || t('seo.fixes.missingImplementation', '<!-- Missing or incorrect implementation -->'))}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: var(--r-surface-2, #F8FAFC); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ ${t('seo.fixes.recommendedFix', 'Recommended Fix')}</span>
            <button data-action="copy-code" data-copy-target="${accordionId}-solution" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: var(--r-text, #111827);
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; white-space: pre-wrap;">${escapeHtml(fix.snippet || fix.fixedCode)}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="seo-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: var(--r-text, #111827);">${t('seo.fixes.stepByStepFix', 'Step-by-Step Fix:')}</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: var(--r-text-muted, #6B7280); line-height: 1.8;">
        ${(fix.steps || getDefaultSeoSteps(fix)).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function getDefaultSeoSteps(fix) {
  // Steps are now embedded directly in each card in buildFixCards(),
  // so this fallback only applies to edge cases.
  return fix.steps || [
    t('seo.fixes.steps.default.step1', 'Review current implementation'),
    t('seo.fixes.steps.default.step2', 'Apply the recommended fix'),
    t('seo.fixes.steps.default.step3', 'Test and verify changes'),
    t('seo.fixes.steps.default.step4', 'Validate with Google Search Console or Lighthouse'),
    t('seo.fixes.steps.default.step5', 'Monitor rankings and performance after deployment')
  ];
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

// Copy code
function copySeoCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.parentElement.querySelector('button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = t('common.copied', 'Copied!');
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
      const tabName = tab.getAttribute('data-tab') || 'summary';

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
  const images = results.imageAnalysis || {};
  const headings = results.headingStructure || {};
  const content = results.contentAnalysis || {};
  const links = results.linkAnalysis || {};

  // --- 1. Title tag (only if actually problematic) ---
  const titleLen = meta.titleLength || 0;
  const titleNeeds = !meta.title || titleLen < 30 || titleLen > 60;
  if (titleNeeds) {
    const titleIssueDetail = !meta.title
      ? t('seo.fixCards.title.missingDetail', 'The page has no <title> tag at all. Search engines use the title as the primary clickable headline in results. Without one, Google will auto-generate a title from page content, which is almost always worse than a well-crafted one.')
      : titleLen < 30
        ? t('seo.fixCards.title.tooShortDetail', 'Your title is only {{len}} characters. Titles under 30 characters waste valuable SERP real estate and miss keyword opportunities. Google displays up to ~60 characters, so you have room to add descriptive, keyword-rich phrasing that improves click-through rate.', { len: titleLen })
        : t('seo.fixCards.title.tooLongDetail', 'Your title is {{len}} characters. Google truncates titles beyond ~60 characters with an ellipsis, hiding your brand name or call-to-action. Shortening it ensures the full title is visible and compelling in search results.', { len: titleLen });

    cards.push({
      title: t('seo.fixCards.title.title', 'Tune your title tag'),
      severity: !meta.title ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.metaTags', 'Meta Tags'),
      impact: t('seo.fixCards.title.impact', 'Improves CTR in SERPs by 15-30%'),
      description: titleIssueDetail,
      problematicCode: meta.title
        ? `<!-- ${t('seo.fixCards.comments.currentTitle', 'Current title')}: ${titleLen} ${t('seo.fixCards.comments.characters', 'characters')} -->\n<title>${meta.title}</title>\n\n<!-- ${t('seo.fixCards.comments.issues', 'Issues')}: -->\n<!-- ${titleLen < 30 ? t('seo.fixCards.comments.tooShort', '✗ Too short - missing keyword opportunity') : t('seo.fixCards.comments.tooLong', '✗ Too long - will be truncated in SERPs')} -->\n<!-- ${t('seo.fixCards.comments.titlePixelWidth', '✗ Ideal pixel width is 460-580 px on desktop SERPs')} -->`
        : `<!-- ${t('seo.fixCards.comments.noTitleFound', 'No title tag found')} -->\n<head>\n  <!-- ${t('seo.fixCards.comments.missingTitle', '✗ Missing <title> tag')} -->\n  <!-- ${t('seo.fixCards.comments.googleWillGenerate', '✗ Google will auto-generate a title from page content')} -->\n</head>`,
      snippet: `<title>${meta.title ? meta.title.substring(0, 50) + ' | Brand' : t('seo.fixCards.snippets.titlePlaceholder', 'Primary Keyword | Brand Name')}</title>\n\n<!-- ${t('seo.fixCards.comments.bestPractices', 'Best practices')}: -->\n<!-- ${t('seo.fixCards.comments.title50to60', '✓ 50-60 characters')} -->\n<!-- ${t('seo.fixCards.comments.keywordNearStart', '✓ Primary keyword near the start')} -->\n<!-- ${t('seo.fixCards.comments.brandAtEnd', '✓ Brand name at the end')} -->\n<!-- ${t('seo.fixCards.comments.uniquePerPage2', '✓ Unique per page - no duplicate titles across the site')} -->\n<!-- ${t('seo.fixCards.comments.avoidKeywordStuffing', '✓ Avoid keyword stuffing - read naturally')} -->`,
      steps: [
        t('seo.fixes.steps.title.step1', 'Keep title between 50-60 characters'),
        t('seo.fixes.steps.title.step2', 'Place primary keyword near the beginning'),
        t('seo.fixes.steps.title.step3', 'Make it compelling and unique for each page'),
        t('seo.fixes.steps.title.step4', 'Append your brand name after a pipe separator (e.g. "Topic | Brand")'),
        t('seo.fixes.steps.title.step5', 'Test in Google SERP preview tool to verify it displays correctly')
      ]
    });
  }

  // --- 2. Meta description (only if problematic) ---
  const descLen = meta.descriptionLength || 0;
  const descNeeds = !meta.description || descLen < 120 || descLen > 160;
  if (descNeeds) {
    const descIssueDetail = !meta.description
      ? t('seo.fixCards.description.missingDetail', 'No meta description was found. Without one, search engines pull a random snippet from your page, which often reads poorly and hurts click-through rate. A well-written description acts as ad copy for your page in search results.')
      : descLen < 120
        ? t('seo.fixCards.description.tooShortDetail', 'Your description is {{len}} characters. Google displays up to ~160 characters in search results. A short description wastes this free advertising space and signals less relevance to searchers.', { len: descLen })
        : t('seo.fixCards.description.tooLongDetail', 'Your description is {{len}} characters and will be truncated in search results. The trailing text, which often includes a call-to-action, will be hidden behind an ellipsis.', { len: descLen });

    cards.push({
      title: t('seo.fixCards.description.title', 'Write a compelling meta description'),
      severity: !meta.description ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.metaTags', 'Meta Tags'),
      impact: t('seo.fixCards.description.impact', 'Higher click-through and relevance signals'),
      description: descIssueDetail,
      problematicCode: meta.description
        ? `<!-- ${t('seo.fixCards.comments.current', 'Current')}: ${descLen} ${t('seo.fixCards.comments.characters', 'characters')} -->\n<meta name="description" content="${meta.description?.substring(0, 80)}..." />\n\n<!-- ${t('seo.fixCards.comments.issues', 'Issues')}: -->\n<!-- ${descLen < 120 ? t('seo.fixCards.comments.descTooShort', '✗ Too short - not fully utilizing SERP space') : t('seo.fixCards.comments.descTooLong', '✗ Too long - will be truncated')} -->\n<!-- ${t('seo.fixCards.comments.checkForCta', '✗ Check for a clear call-to-action')} -->\n<!-- ${t('seo.fixCards.comments.checkUniqueDesc', '✗ Ensure this description is not duplicated across pages')} -->`
        : `<!-- ${t('seo.fixCards.comments.noDescriptionFound', 'No meta description found')} -->\n<head>\n  <!-- ${t('seo.fixCards.comments.missingDescription', '✗ Missing meta description')} -->\n  <!-- ${t('seo.fixCards.comments.googleAutoSnippet', '✗ Google will pick a random page snippet instead')} -->\n</head>`,
      snippet: `<meta name="description"\n  content="${t('seo.fixCards.snippets.descriptionPlaceholder', 'Describe the main value proposition in 150-160 characters. Include a clear call to action.')}" />\n\n<!-- ${t('seo.fixCards.comments.bestPractices', 'Best practices')}: -->\n<!-- ${t('seo.fixCards.comments.desc150to160', '✓ 150-160 characters')} -->\n<!-- ${t('seo.fixCards.comments.includeCta', '✓ Include call-to-action')} -->\n<!-- ${t('seo.fixCards.comments.uniquePerPage', '✓ Unique for each page')} -->\n<!-- ${t('seo.fixCards.comments.matchSearchIntent', "✓ Match the searcher's intent with accurate language")} -->\n<!-- ${t('seo.fixCards.comments.avoidDuplicateDesc', '✓ Avoid duplicating the title - add new information')} -->`,
      steps: [
        t('seo.fixes.steps.description.step1', 'Write 150-160 characters that summarize page content'),
        t('seo.fixes.steps.description.step2', 'Include a clear call-to-action (e.g. "Learn more", "Get started")'),
        t('seo.fixes.steps.description.step3', 'Ensure uniqueness across all pages'),
        t('seo.fixes.steps.description.step4', 'Front-load the most important information in the first 120 characters'),
        t('seo.fixes.steps.description.step5', 'Avoid duplicating the title tag - use the description to add detail')
      ]
    });
  }

  // --- 3. Open Graph tags (only if missing) ---
  const ogMissing = !meta.ogTitle && !meta.ogDescription;
  const twitterMissing = !meta.twitterCard;
  if (ogMissing || twitterMissing) {
    const socialIssues = [];
    if (ogMissing) socialIssues.push(t('seo.fixCards.comments.missingOg', '✗ Missing Open Graph tags (og:title, og:description, og:image)'));
    if (twitterMissing) socialIssues.push(t('seo.fixCards.comments.missingTwitter', '✗ Missing Twitter Card tags'));

    cards.push({
      title: t('seo.fixCards.openGraph.title', 'Add Open Graph & social meta tags'),
      severity: 'Medium',
      category: t('seo.fixCards.categories.socialSeo', 'Social & Sharing'),
      impact: t('seo.fixCards.openGraph.impact', 'Rich previews on social platforms drive 2-3x more engagement'),
      description: t('seo.fixCards.openGraph.description', 'When your page is shared on Facebook, LinkedIn, Twitter/X, or messaging apps, the platform looks for Open Graph and Twitter Card meta tags to build a rich preview card. Without them, shares show a plain URL or an auto-selected image that often looks wrong. Adding these tags takes minutes and dramatically improves how your content appears when shared.'),
      problematicCode: `<!-- ${t('seo.fixCards.comments.commonIssues', 'Common issues')}: -->\n${socialIssues.map(i => `<!-- ${i} -->`).join('\n')}\n\n<head>\n  <!-- ${t('seo.fixCards.comments.noSocialTags', 'No social sharing meta tags found')} -->\n</head>`,
      snippet: `<!-- Open Graph -->\n<meta property="og:type" content="website" />\n<meta property="og:title" content="${meta.title || t('seo.fixCards.snippets.pageTitle', 'Page Title')}" />\n<meta property="og:description" content="${meta.description || t('seo.fixCards.snippets.pageDescription', 'Page description')}" />\n<meta property="og:image" content="https://${analyzedDomain}/og-image.jpg" />\n<meta property="og:url" content="https://${analyzedDomain}/" />\n\n<!-- Twitter Card -->\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${meta.title || t('seo.fixCards.snippets.pageTitle', 'Page Title')}" />\n<meta name="twitter:description" content="${meta.description || t('seo.fixCards.snippets.pageDescription', 'Page description')}" />\n<meta name="twitter:image" content="https://${analyzedDomain}/og-image.jpg" />`,
      steps: [
        t('seo.fixes.steps.openGraph.step1', 'Create a 1200x630 px share image for your page'),
        t('seo.fixes.steps.openGraph.step2', 'Add og:title, og:description, og:image, and og:url meta tags'),
        t('seo.fixes.steps.openGraph.step3', 'Add twitter:card, twitter:title, twitter:description, and twitter:image'),
        t('seo.fixes.steps.openGraph.step4', 'Test with Facebook Sharing Debugger and Twitter Card Validator'),
        t('seo.fixes.steps.openGraph.step5', 'Ensure each page has its own unique OG tags - do not reuse the same image everywhere')
      ]
    });
  }

  // --- 4. Image alt text (only if images are missing alt) ---
  const missingAlt = images.withoutAlt || 0;
  const totalImages = images.total || 0;
  if (missingAlt > 0) {
    const sampleBadImages = (images.images || []).filter(img => !img.alt).slice(0, 3);
    const sampleSnippets = sampleBadImages.map(img => {
      const shortSrc = img.src ? img.src.split('/').pop().substring(0, 40) : 'image.jpg';
      return `<img src="${shortSrc}" alt="" />  <!-- ${t('seo.fixCards.comments.needsAltText', '✗ needs descriptive alt text')} -->`;
    }).join('\n');

    cards.push({
      title: t('seo.fixCards.images.title', 'Add missing image alt text'),
      severity: missingAlt > 5 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.accessibility', 'Accessibility & Images'),
      impact: t('seo.fixCards.images.impact', 'Improves accessibility, image search rankings, and overall SEO score'),
      description: t('seo.fixCards.images.description', '{{count}} of {{total}} images are missing alt attributes. Alt text serves three purposes: it describes the image to screen-reader users (required for WCAG compliance), it appears when the image fails to load, and search engines use it to understand image content for Google Image Search rankings. Missing alt text is one of the most common SEO and accessibility issues.', { count: missingAlt, total: totalImages }),
      problematicCode: sampleSnippets || `<!-- ${t('seo.fixCards.comments.imagesNoAlt', '✗ {{count}} images missing alt text', { count: missingAlt })} -->\n<img src="hero.jpg" />\n<img src="product.png" />\n<!-- ${t('seo.fixCards.comments.screenReaderSkip', '✗ Screen readers will skip or announce filename')} -->`,
      snippet: `<!-- ${t('seo.fixCards.comments.goodAltExamples', 'Examples of effective alt text')}: -->\n<img src="hero.jpg" alt="${t('seo.fixCards.snippets.altExample1', 'Team collaborating around a whiteboard in a modern office')}" />\n<img src="product.png" alt="${t('seo.fixCards.snippets.altExample2', 'Blue wireless headphones with noise-cancelling feature')}" />\n<img src="chart.svg" alt="${t('seo.fixCards.snippets.altExample3', 'Bar chart showing 40% revenue growth from Q1 to Q4 2024')}" />\n\n<!-- ${t('seo.fixCards.comments.decorativeImages', 'For purely decorative images, use empty alt')}: -->\n<img src="divider.svg" alt="" role="presentation" />`,
      steps: [
        t('seo.fixes.steps.images.step1', 'Audit all images: run "img:not([alt])" in DevTools Console to find them'),
        t('seo.fixes.steps.images.step2', 'Write concise, descriptive alt text (under 125 characters) for each image'),
        t('seo.fixes.steps.images.step3', 'For decorative images (borders, spacers), use alt="" with role="presentation"'),
        t('seo.fixes.steps.images.step4', 'Avoid phrases like "image of" or "picture of" - describe the content directly'),
        t('seo.fixes.steps.images.step5', 'Test with a screen reader or browser accessibility inspector to verify')
      ]
    });
  }

  // --- 5. Heading structure (only if issues found) ---
  const h1Count = headings.h1 ? headings.h1.length : 0;
  const headingIssue = h1Count === 0 || h1Count > 1 || headings.total < 3;
  if (headingIssue) {
    const headingProblems = [];
    if (h1Count === 0) headingProblems.push(t('seo.fixCards.comments.noH1', '✗ No H1 heading found'));
    if (h1Count > 1) headingProblems.push(t('seo.fixCards.comments.multipleH1', '✗ Multiple H1 headings ({{count}}) - use exactly one', { count: h1Count }));
    if (headings.total < 3) headingProblems.push(t('seo.fixCards.comments.fewHeadings', '✗ Only {{count}} headings total - page lacks structure', { count: headings.total || 0 }));

    const headingIssueDetail = h1Count === 0
      ? t('seo.fixCards.headings.missingH1Detail', 'Your page is missing an H1 heading. The H1 is the primary heading that tells both search engines and users what the page is about. It carries the most weight of any heading tag and should contain your primary target keyword. Every page should have exactly one H1.')
      : h1Count > 1
        ? t('seo.fixCards.headings.multipleH1Detail', 'Your page has {{count}} H1 headings. Multiple H1 tags dilute the primary keyword signal and confuse search engines about the page topic. Keep one H1 as the main heading and demote others to H2 or H3.', { count: h1Count })
        : t('seo.fixCards.headings.lowHeadingsDetail', 'Your page has very few headings ({{count}} total). Headings create a scannable outline for users and help search engines understand content hierarchy. Well-structured headings improve both readability and SEO.', { count: headings.total || 0 });

    cards.push({
      title: t('seo.fixCards.headings.title', 'Fix heading structure'),
      severity: h1Count === 0 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.contentStructure', 'Content Structure'),
      impact: t('seo.fixCards.headings.impact', 'Clearer page structure improves crawlability and user engagement'),
      description: headingIssueDetail,
      problematicCode: `<!-- ${t('seo.fixCards.comments.currentHeadings', 'Current heading structure')}: -->\n<!-- H1: ${h1Count} | H2: ${headings.h2?.length || 0} | H3: ${headings.h3?.length || 0} -->\n${headingProblems.map(p => `<!-- ${p} -->`).join('\n')}\n\n${h1Count > 1 ? (headings.h1 || []).map(h => `<h1>${h.text?.substring(0, 60) || '...'}</h1>  <!-- ${t('seo.fixCards.comments.duplicateH1', 'duplicate')} -->`).join('\n') : h1Count === 0 ? `<body>\n  <!-- ${t('seo.fixCards.comments.noH1InPage', 'No H1 found in page')} -->\n  <div class="content">...</div>\n</body>` : `<!-- ${t('seo.fixCards.comments.addMoreHeadings', 'Add more H2/H3 headings to structure content')} -->`}`,
      snippet: `<!-- ${t('seo.fixCards.comments.idealStructure', 'Ideal heading hierarchy')}: -->\n<h1>${meta.title ? meta.title.substring(0, 50) : t('seo.fixCards.snippets.h1Placeholder', 'Primary Page Topic with Keyword')}</h1>\n\n  <h2>${t('seo.fixCards.snippets.h2Placeholder1', 'Key Section About Subtopic A')}</h2>\n    <h3>${t('seo.fixCards.snippets.h3Placeholder', 'Supporting Detail')}</h3>\n\n  <h2>${t('seo.fixCards.snippets.h2Placeholder2', 'Key Section About Subtopic B')}</h2>\n\n  <h2>${t('seo.fixCards.snippets.h2Placeholder3', 'Summary / Call-to-Action')}</h2>\n\n<!-- ${t('seo.fixCards.comments.headingRules', 'Rules')}: -->\n<!-- ${t('seo.fixCards.comments.oneH1', '✓ Exactly one H1 per page')} -->\n<!-- ${t('seo.fixCards.comments.sequentialHeadings', '✓ Sequential levels (H1→H2→H3, never skip)')} -->\n<!-- ${t('seo.fixCards.comments.descriptiveHeadings', '✓ Descriptive text, not generic ("Section 1")')} -->`,
      steps: [
        t('seo.fixes.steps.headings.step1', 'Ensure exactly one H1 tag exists - it should be the main page title'),
        t('seo.fixes.steps.headings.step2', 'Use H2 tags for major sections and H3 for subsections within them'),
        t('seo.fixes.steps.headings.step3', 'Never skip heading levels (e.g. H1 directly to H3)'),
        t('seo.fixes.steps.headings.step4', 'Write headings that describe the content below - avoid generic text'),
        t('seo.fixes.steps.headings.step5', 'Use Chrome DevTools "Elements" panel to audit all heading tags on the page')
      ]
    });
  }

  // --- 6. Content quality (only if thin content) ---
  const wordCount = content.wordCount || 0;
  if (wordCount < 600) {
    cards.push({
      title: t('seo.fixCards.content.title', 'Improve content depth'),
      severity: wordCount < 300 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.contentQuality', 'Content Quality'),
      impact: t('seo.fixCards.content.impact', 'Pages with 600+ words rank higher on average and earn more backlinks'),
      description: wordCount < 300
        ? t('seo.fixCards.content.veryThinDetail', 'Your page has only {{count}} words. Search engines consider this "thin content," which rarely ranks well. Pages competing in search typically have 800-2000+ words. Thin content also increases bounce rate because visitors find insufficient information and leave.', { count: wordCount })
        : t('seo.fixCards.content.thinDetail', 'Your page has {{count}} words. While not critically thin, pages with 600+ words tend to rank better because they provide more value, answer more user questions, and naturally include more relevant keywords. Consider expanding key sections.', { count: wordCount }),
      problematicCode: `<!-- ${t('seo.fixCards.comments.contentAnalysis', 'Content analysis')}: -->\n<!-- ${t('seo.fixCards.comments.wordCount', 'Word count')}: ${wordCount} -->\n<!-- ${t('seo.fixCards.comments.paragraphs', 'Paragraphs')}: ${content.paragraphCount || 0} -->\n<!-- ${t('seo.fixCards.comments.textHtmlRatio', 'Text-to-HTML ratio')}: ${content.textToHTMLRatio ? (content.textToHTMLRatio * 100).toFixed(1) + '%' : 'N/A'} -->\n\n<!-- ${t('seo.fixCards.comments.thinContentWarning', '✗ Content is below recommended threshold for competitive ranking')} -->`,
      snippet: `<!-- ${t('seo.fixCards.comments.contentStrategy', 'Recommended content structure for this page')}: -->\n\n<h1>${t('seo.fixCards.snippets.contentH1', 'Main Topic (with primary keyword)')}</h1>\n<p>${t('seo.fixCards.snippets.contentIntro', 'Introduction paragraph (50-100 words) - hook the reader')}</p>\n\n<h2>${t('seo.fixCards.snippets.contentH2a', 'What / Why Section')}</h2>\n<p>${t('seo.fixCards.snippets.contentBody1', '150-200 words explaining the topic in depth')}</p>\n\n<h2>${t('seo.fixCards.snippets.contentH2b', 'How-To / Details Section')}</h2>\n<p>${t('seo.fixCards.snippets.contentBody2', '150-200 words with actionable detail')}</p>\n\n<h2>${t('seo.fixCards.snippets.contentH2c', 'FAQ / Common Questions')}</h2>\n<p>${t('seo.fixCards.snippets.contentBody3', 'Answer 3-5 related questions (great for featured snippets)')}</p>`,
      steps: [
        t('seo.fixes.steps.content.step1', 'Research what competitors cover for the same topic and identify gaps'),
        t('seo.fixes.steps.content.step2', 'Add an FAQ section answering 3-5 common questions (helps win featured snippets)'),
        t('seo.fixes.steps.content.step3', 'Expand existing sections with examples, data, or step-by-step instructions'),
        t('seo.fixes.steps.content.step4', 'Break content into scannable sections with descriptive H2/H3 headings'),
        t('seo.fixes.steps.content.step5', 'Aim for at least 800 words while keeping every sentence valuable - avoid filler')
      ]
    });
  }

  // --- 7. Canonical + sitemap (only if missing) ---
  const canonicalMissing = !meta.canonical;
  if (canonicalMissing) {
    cards.push({
      title: t('seo.fixCards.canonical.title', 'Add canonical + sitemap refs'),
      severity: 'Medium',
      category: t('seo.fixCards.categories.technicalSeo', 'Technical SEO'),
      impact: t('seo.fixCards.canonical.impact', 'Prevents duplicate indexing issues'),
      description: t('seo.fixCards.canonical.fullDescription', 'No canonical URL was detected. Without a canonical tag, search engines may index multiple versions of the same page (www vs non-www, HTTP vs HTTPS, with/without trailing slash) and split your ranking power between them. A canonical tag declares the single preferred URL for each page.'),
      problematicCode: `<!-- ${t('seo.fixCards.comments.commonIssues', 'Common issues')}: -->\n<!-- ${t('seo.fixCards.comments.noCanonical', '✗ No canonical URL declared')} -->\n<!-- ${t('seo.fixCards.comments.multipleVersions', '✗ Multiple versions indexed (www, non-www, http, https)')} -->\n<!-- ${t('seo.fixCards.comments.sitemapNotReferenced', '✗ Sitemap not referenced')} -->\n\n<head>\n  <!-- ${t('seo.fixCards.comments.missingCanonicalSitemap', 'Missing canonical and sitemap links')} -->\n</head>`,
      snippet: `<link rel="canonical" href="https://${analyzedDomain}/" />\n<link rel="sitemap" type="application/xml"\n  title="Sitemap" href="https://${analyzedDomain}/sitemap.xml" />\n\n<!-- ${t('seo.fixCards.comments.inRobotsTxt', 'In robots.txt')}: -->\nSitemap: https://${analyzedDomain}/sitemap.xml\n\n<!-- ${t('seo.fixCards.comments.bestPractices', 'Best practices')}: -->\n<!-- ${t('seo.fixCards.comments.canonicalSelfRef', '✓ Every page should self-reference its canonical URL')} -->\n<!-- ${t('seo.fixCards.comments.canonicalAbsolute', '✓ Always use absolute URLs, not relative')} -->`,
      steps: [
        t('seo.fixes.steps.canonical.step1', 'Add canonical link pointing to preferred URL'),
        t('seo.fixes.steps.canonical.step2', 'Create and submit XML sitemap to search engines'),
        t('seo.fixes.steps.canonical.step3', 'Reference sitemap in robots.txt'),
        t('seo.fixes.steps.canonical.step4', 'Ensure every page has a self-referencing canonical tag'),
        t('seo.fixes.steps.canonical.step5', 'Use Google Search Console to monitor indexing and duplicate issues')
      ]
    });
  }

  // --- 8. Structured data (only if missing or minimal) ---
  if (!structured.hasStructuredData) {
    cards.push({
      title: t('seo.fixCards.jsonld.title', 'Add JSON-LD (Article/Product)'),
      severity: 'High',
      category: t('seo.fixCards.categories.structuredData', 'Structured Data'),
      impact: t('seo.fixCards.jsonld.impact', 'Rich results eligibility - up to 30% more visibility'),
      description: t('seo.fixCards.jsonld.fullDescription', 'No structured data was found on this page. Structured data (JSON-LD) helps search engines understand your content type and enables rich results like star ratings, FAQ dropdowns, product prices, and breadcrumbs directly in search results. Pages with rich results get significantly higher click-through rates.'),
      problematicCode: `<!-- ${t('seo.fixCards.comments.noStructuredData', 'No structured data found')} -->\n<head>\n  <!-- ${t('seo.fixCards.comments.missingJsonLd', '✗ Missing JSON-LD structured data')} -->\n  <!-- ${t('seo.fixCards.comments.notEligible', '✗ Not eligible for rich results')} -->\n  <!-- ${t('seo.fixCards.comments.noRichSnippets', '✗ No star ratings, FAQs, or breadcrumbs in SERPs')} -->\n</head>`,
      snippet: `<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "${meta.title || t('seo.fixCards.snippets.pageTitle', 'Page Title')}",\n  "description": "${meta.description || t('seo.fixCards.snippets.pageDescription', 'Page description')}",\n  "url": "https://${analyzedDomain}/",\n  "publisher": {\n    "@type": "Organization",\n    "name": "${analyzedDomain}",\n    "logo": {\n      "@type": "ImageObject",\n      "url": "https://${analyzedDomain}/logo.png"\n    }\n  }\n}\n</script>`,
      steps: [
        t('seo.fixes.steps.jsonld.step1', 'Identify the primary content type (Article, Product, etc.)'),
        t('seo.fixes.steps.jsonld.step2', 'Add JSON-LD script with required properties'),
        t('seo.fixes.steps.jsonld.step3', 'Test with Google Rich Results Test'),
        t('seo.fixes.steps.jsonld.step4', 'Add Organization schema to your homepage for brand knowledge panel'),
        t('seo.fixes.steps.jsonld.step5', 'Add BreadcrumbList schema for breadcrumb-style search results')
      ]
    });
  }

  // --- 9. Link security (only if unsafe external links found) ---
  const unsafeLinks = (links.links || []).filter(l =>
    l.isExternal && l.target === '_blank' && (!l.hasNoOpener || !l.hasNoReferrer)
  ).length;
  const emptyAnchors = (links.links || []).filter(l => !l.text || l.text.length === 0).length;
  if (unsafeLinks > 0 || emptyAnchors > 0) {
    const linkProblems = [];
    if (unsafeLinks > 0) linkProblems.push(t('seo.fixCards.comments.unsafeExternalLinks', '✗ {{count}} external links open in new tab without rel="noopener noreferrer"', { count: unsafeLinks }));
    if (emptyAnchors > 0) linkProblems.push(t('seo.fixCards.comments.emptyAnchorText', '✗ {{count}} links have empty anchor text (bad for SEO and accessibility)', { count: emptyAnchors }));

    cards.push({
      title: t('seo.fixCards.links.title', 'Fix link security & anchor text'),
      severity: unsafeLinks > 3 ? 'Medium' : 'Low',
      category: t('seo.fixCards.categories.linkHealth', 'Link Health'),
      impact: t('seo.fixCards.links.impact', 'Prevents security vulnerabilities and improves link equity signals'),
      description: t('seo.fixCards.links.description', 'External links that open in a new tab without rel="noopener noreferrer" expose your site to reverse tabnapping attacks, where the opened page can use the window.opener API to redirect your original tab to a phishing site. This is a well-documented security vulnerability that can trick users into entering credentials on a fake version of your site without realizing they have been redirected. Additionally, links with empty or missing anchor text waste valuable link equity because search engines use anchor text to understand the context and relevance of the linked page. Screen reader users also rely on anchor text to understand where a link leads before activating it, so empty anchors create a confusing and inaccessible experience. Both issues are simple to fix and should be resolved across all external and internal links.'),
      problematicCode: `<!-- ${t('seo.fixCards.comments.linkIssuesFound', 'Link issues found')}: -->\n${linkProblems.map(p => `<!-- ${p} -->`).join('\n')}\n\n${unsafeLinks > 0 ? `<a href="https://external.com" target="_blank">Link</a>\n<!-- ${t('seo.fixCards.comments.vulnToTabnapping', '✗ Vulnerable to reverse tabnapping')} -->` : ''}\n${emptyAnchors > 0 ? `<a href="/page"></a>\n<!-- ${t('seo.fixCards.comments.noAnchorText', '✗ No descriptive anchor text')} -->` : ''}`,
      snippet: `<!-- ${t('seo.fixCards.comments.secureExternalLink', 'Secure external link')}: -->\n<a href="https://external.com"\n   target="_blank"\n   rel="noopener noreferrer">${t('seo.fixCards.snippets.descriptiveAnchor', 'Descriptive anchor text')}</a>\n\n<!-- ${t('seo.fixCards.comments.descriptiveAnchors', 'Use descriptive anchor text')}: -->\n<a href="/pricing">${t('seo.fixCards.snippets.pricingAnchor', 'View pricing plans')}</a>\n<!-- ${t('seo.fixCards.comments.notThis', 'Not this')}: -->\n<!-- <a href="/pricing">${t('seo.fixCards.snippets.clickHere', 'Click here')}</a> -->`,
      steps: [
        t('seo.fixes.steps.links.step1', 'Add rel="noopener noreferrer" to all external links with target="_blank"'),
        t('seo.fixes.steps.links.step2', 'Replace empty anchor text with descriptive text that explains the link destination'),
        t('seo.fixes.steps.links.step3', 'Avoid generic anchor text like "click here" or "read more"'),
        t('seo.fixes.steps.links.step4', 'Use DevTools Console: document.querySelectorAll(\'a[target="_blank"]:not([rel*="noopener"])\') to find issues'a[target="_blank"]:not([rel*="noopener"])\') to find issues'),
        t('seo.fixes.steps.links.step5', 'Consider adding rel="nofollow" to paid or sponsored external links')
      ]
    });
  }

  // --- 10. Preload critical assets (always relevant if perf issues) ---
  const perfScore = performance.score || 0;
  if (perfScore < 80) {
    cards.push({
      title: t('seo.fixCards.preload.title', 'Preload critical assets'),
      severity: perfScore < 50 ? 'High' : 'Medium',
      category: t('seo.fixCards.categories.performance', 'Performance'),
      impact: t('seo.fixCards.preload.impact', 'Faster LCP and render - improves Core Web Vitals'),
      description: t('seo.fixCards.preload.fullDescription', 'Page performance scored {{score}}/100. Preloading tells the browser to fetch critical resources (hero image, fonts, CSS) as soon as possible, before it discovers them in the HTML. This can shave 200-500ms off your Largest Contentful Paint (LCP) and eliminate layout shift from late-loading fonts.', { score: perfScore }),
      problematicCode: `<!-- ${t('seo.fixCards.comments.commonIssues', 'Common issues')}: -->\n<!-- ${t('seo.fixCards.comments.heroNotPreloaded', '✗ Hero image not preloaded')} -->\n<!-- ${t('seo.fixCards.comments.fontsCauseShift', '✗ Web fonts cause layout shift')} -->\n<!-- ${t('seo.fixCards.comments.cssNotPrioritized', '✗ Critical CSS not prioritized')} -->\n<!-- ${t('seo.fixCards.comments.perfScore', 'Performance score')}: ${perfScore}/100 -->\n\n<head>\n  <!-- ${t('seo.fixCards.comments.noPreloadHints', 'No preload hints')} -->\n  <link rel="stylesheet" href="/styles.css">\n</head>`,
      snippet: `<link rel="preload" as="image" href="/hero.webp" />\n<link rel="preload" as="style" href="/critical.css" />\n<link rel="preload" as="font" type="font/woff2"\n  href="/fonts/main.woff2" crossorigin />\n\n<!-- ${t('seo.fixCards.comments.bestPractices', 'Best practices')}: -->\n<!-- ${t('seo.fixCards.comments.preloadLcpImage', '✓ Preload LCP image')} -->\n<!-- ${t('seo.fixCards.comments.preloadCriticalFonts', '✓ Preload critical fonts')} -->\n<!-- ${t('seo.fixCards.comments.useCrossorigin', '✓ Use crossorigin for fonts')} -->\n<!-- ${t('seo.fixCards.comments.onlyPreloadAboveFold', '✓ Only preload above-the-fold resources')} -->`,
      steps: [
        t('seo.fixes.steps.preload.step1', 'Identify above-the-fold critical resources'),
        t('seo.fixes.steps.preload.step2', 'Add preload hints for hero image and fonts'),
        t('seo.fixes.steps.preload.step3', 'Verify with browser DevTools Network panel'),
        t('seo.fixes.steps.preload.step4', 'Add fetchpriority="high" to the LCP image element itself'),
        t('seo.fixes.steps.preload.step5', 'Do not over-preload - only 2-4 critical resources, or the browser delays everything')
      ]
    });
  }

  // --- 11. Defer non-critical JS (only if performance is poor) ---
  if (perfScore < 70) {
    cards.push({
      title: t('seo.fixCards.defer.title', 'Defer non-critical JS'),
      severity: 'Low',
      category: t('seo.fixCards.categories.performance', 'Performance'),
      impact: t('seo.fixCards.defer.impact', 'Reduces blocking time - faster interactivity'),
      description: t('seo.fixCards.defer.fullDescription', 'Synchronous scripts in the <head> block the browser from rendering any content until they finish downloading and executing. Moving non-essential scripts to defer or async allows the page to paint first, improving perceived load speed and Core Web Vitals scores (especially FID/INP).'),
      problematicCode: `<!-- ${t('seo.fixCards.comments.commonIssues', 'Common issues')}: -->\n<!-- ${t('seo.fixCards.comments.scriptsBlocking', '✗ Scripts blocking page render')} -->\n<!-- ${t('seo.fixCards.comments.analyticsSync', '✗ Analytics loading synchronously')} -->\n\n<head>\n  <script src="/app.js"></script>\n  <script src="/analytics.js"></script>\n</head>`,
      snippet: `<head>\n  <!-- ${t('seo.fixCards.comments.deferNonEssential', 'Defer non-essential scripts')} -->\n  <script src="/app.js" defer></script>\n  <script src="/analytics.js" async></script>\n</head>\n\n<!-- ${t('seo.fixCards.comments.deferVsAsync', 'defer = execute after DOM parsed, in order')} -->\n<!-- ${t('seo.fixCards.comments.asyncNote', 'async = execute as soon as downloaded, any order')} -->\n<!-- ${t('seo.fixCards.comments.orLoadAtEnd', 'Or load at end of body')}: -->\n<body>\n  <!-- ${t('seo.fixCards.comments.content', 'content')} -->\n  <script src="/app.js"></script>\n</body>`,
      steps: [
        t('seo.fixes.steps.defer.step1', 'Add defer attribute to non-essential scripts'),
        t('seo.fixes.steps.defer.step2', 'Move analytics to async loading'),
        t('seo.fixes.steps.defer.step3', 'Test that functionality still works correctly'),
        t('seo.fixes.steps.defer.step4', 'Use Chrome DevTools Coverage tab to find unused JS you can remove entirely'),
        t('seo.fixes.steps.defer.step5', 'Consider lazy-loading third-party widgets (chat, social embeds) on user interaction')
      ]
    });
  }

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
              <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); ${row[3].includes('✗') ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
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
  // Normalize for lightweight analyzer compatibility
  headings = headings || {};
  headings.h1 = headings.h1 || [];
  headings.h2 = headings.h2 || [];
  headings.h3 = headings.h3 || [];
  headings.h4 = headings.h4 || [];
  headings.h5 = headings.h5 || [];
  headings.h6 = headings.h6 || [];
  headings.total = headings.total || headings.totalHeadings || 0;
  headings.hierarchy = headings.hierarchy || [];

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
    'H5': headings.h5.length,
    'H6': headings.h6.length
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
        ${headings.hierarchy.slice(0, 5).map(h => `<p style="margin-left: 1rem; color: var(--r-text-faint, #9CA3AF);">${h.level.toUpperCase()}: ${h.text.substring(0, 80)}${h.text.length > 80 ? '...' : ''}</p>`).join('')}
        ${headings.hierarchy.length > 5 ? `<p style="margin-left: 1rem; color: var(--r-text-faint, #9CA3AF);">${t('seo.report.common.moreCount', '... {{count}} more', { count: headings.hierarchy.length - 5 })}</p>` : ''}
      ` : ''}

      ${renderIssuesAndRecommendations(headings)}
    </div>
  `;
}

/**
 * Render Content Analysis section content
 */
function renderContentAnalysisContent(content) {
  // Normalize for lightweight analyzer compatibility
  content = content || {};
  content.wordCount = content.wordCount || 0;
  content.paragraphCount = content.paragraphCount || 0;
  content.textToHTMLRatio = content.textToHTMLRatio || 0;
  content.averageWordsPerSentence = content.averageWordsPerSentence || 0;
  content.sentenceCount = content.sentenceCount || 0;

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
  // Normalize for lightweight analyzer compatibility
  images = images || {};
  images.total = images.total || images.totalImages || 0;
  images.withAlt = images.withAlt || 0;
  images.withoutAlt = images.withoutAlt || 0;
  images.images = images.images || [];
  images.score = images.score || 0;

  const altStatus = images.withAlt === images.total ? '✓' : images.withoutAlt === 0 ? '~' : '✗';
  const altPercentage = images.total > 0 ? ((images.withAlt / images.total) * 100).toFixed(1) : 0;

  // Image optimization data
  const imageData = {
    [t('seo.report.images.chart.withAlt', 'With Alt')]: images.withAlt,
    [t('seo.report.images.chart.missingAlt', 'Missing Alt')]: images.withoutAlt,
    [t('seo.report.images.chart.totalImages', 'Total Images')]: images.total
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
                <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08)); ${row.pass ? '' : 'background: rgba(255, 68, 68, 0.05);'}">
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
  // Normalize for lightweight analyzer compatibility
  links = links || {};
  links.total = links.total || links.totalLinks || 0;
  links.internal = links.internal || 0;
  links.external = links.external || 0;
  links.noFollow = links.noFollow || 0;
  links.brokenFormat = links.brokenFormat ?? links.broken ?? 0;

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
      <p>>> ${t('seo.report.links.internalLinksLabel', 'internal_links')}: ${links.internal} (${links.total > 0 ? ((links.internal / links.total) * 100).toFixed(1) : 0}%)</p>
      <p>>> ${t('seo.report.links.externalLinksLabel', 'external_links')}: ${links.external} (${links.total > 0 ? ((links.external / links.total) * 100).toFixed(1) : 0}%)</p>
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
              <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
                <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${deviceLabel(vp.viewport)}</td>
                <td style="padding: 0.75rem; text-align: center; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${vp.width}px</td>
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
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${metric}</td>
              <td style="padding: 0.75rem; text-align: center; color: var(--r-text-muted, #6B7280); font-family: 'Courier New', monospace; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">${value}</td>
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
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${header}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.1rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${purpose}</td>
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
        <div style="color: var(--r-text-muted, #6B7280); font-size: 0.95rem; line-height: 1.6; margin-bottom: 1rem;">
          ${t('seo.report.structuredData.info.body', 'Structured data (also called schema markup) is code that helps search engines understand your content better, enabling <strong style="color: #00ff41;">rich search results</strong> like star ratings, product prices, event dates, FAQ dropdowns, and more. It uses the <strong style="color: #00ccff;">Schema.org</strong> vocabulary in JSON-LD, Microdata, or RDFa formats.'
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
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${t('seo.report.structuredData.summary.rows.found.metric', 'Structured Data Found')}</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${data.hasStructuredData ? '✓' : '✗'}</td>
            <td style="padding: 0.75rem; color: ${data.hasStructuredData ? 'var(--accent-primary)' : '#ff6600'}; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.hasStructuredData ? detected : notFound}
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.hasStructuredData
                ? t('seo.report.structuredData.summary.rows.found.impact.detected', 'Enables rich search results')
                : t('seo.report.structuredData.summary.rows.found.impact.notFound', 'Missing enhanced search appearances')}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${t('seo.report.structuredData.summary.rows.types.metric', 'Schema Types Implemented')}</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">C</td>
            <td style="padding: 0.75rem; color: #00ccff; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.count} ${data.count === 1
                ? t('seo.report.structuredData.summary.rows.types.value.singular', 'Type')
                : t('seo.report.structuredData.summary.rows.types.value.plural', 'Types')}
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.count >= 3
                ? t('seo.report.structuredData.summary.rows.types.impact.great', 'Great coverage')
                : data.count >= 1
                  ? t('seo.report.structuredData.summary.rows.types.impact.good', 'Good start')
                  : t('seo.report.structuredData.summary.rows.types.impact.none', 'None implemented')}
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${t('seo.report.structuredData.summary.rows.score.metric', 'Overall Score')}</td>
            <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">T</td>
            <td style="padding: 0.75rem; color: #bb86fc; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${data.score}/100
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
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
                <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.5rem;">${schema.icon}</span>
                      <div>
                        <div style="color: var(--accent-primary); font-weight: 600; font-size: 0.95rem;">${type}</div>
                        <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem;">${schema.desc}</div>
                      </div>
                    </div>
                  </td>
                  <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.5; border: 1px solid rgba(255, 255, 255, 0.05);">
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
                        ${schema.fields.length > 3 ? `<span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.7rem;">${t('seo.report.structuredData.detected.moreFields', '+{{count}} more', { count: schema.fields.length - 3 })}</span>` : ''}
                      </div>
                    ` : `<span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.8rem;">${t('seo.report.structuredData.detected.na', 'N/A')}</span>`}
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
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6;">
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
              <div style="color: var(--r-text-muted, #6B7280); font-size: 0.85rem;">${t('seo.report.structuredData.missing.card.body', "You're missing enhanced search appearances that boost visibility and click-through rates")}</div>
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
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">*</span>
                  <span style="color: #ffd700; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.starRatings.title', 'Star Ratings')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.starRatings.body', 'Display review stars and ratings directly in search results')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: var(--accent-primary); font-weight: bold; font-size: 0.9rem;">+35%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">💰</span>
                  <span style="color: var(--accent-primary); font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.productInfo.title', 'Product Info')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.productInfo.body', 'Show prices, availability, and special offers inline')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: var(--accent-primary); font-weight: bold; font-size: 0.9rem;">+25%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">📅</span>
                  <span style="color: #00ccff; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.eventDetails.title', 'Event Details')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.eventDetails.body', 'Event dates, locations, and ticket info with calendar integration')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+20%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">I</span>
                  <span style="color: #bb86fc; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.richMedia.title', 'Rich Media')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                ${t('seo.report.structuredData.missing.rows.richMedia.body', 'Enhanced thumbnails, carousels, and video snippets')}
              </td>
              <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
                <span style="color: #ffd700; font-weight: bold; font-size: 0.9rem;">+18%</span>
              </td>
            </tr>
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span style="font-size: 1.3rem;">?</span>
                  <span style="color: #ff8c00; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.missing.rows.faq.title', 'FAQ Dropdowns')}</span>
                </div>
              </td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
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
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.6;">
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
          <div style="color: var(--r-text-muted, #6B7280); font-size: 0.9rem; line-height: 1.6;">
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
                <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
                  <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="font-size: 1.5rem;">${schema.icon}</span>
                      <div>
                        <div style="color: #00ccff; font-weight: 600; font-size: 0.95rem;">${item.type}</div>
                        <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem;">${schema.desc}</div>
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
                  <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; line-height: 1.5; border: 1px solid rgba(255, 255, 255, 0.05);">
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
          border-radius: 12px;
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
          border-radius: 12px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">🏷️</div>
            <div>
              <div style="color: #00ccff; font-weight: bold; font-size: 1rem;">Microdata</div>
              <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.7rem;">${t('seo.report.structuredData.formats.microdata.subtitle', 'HTML Attributes')}</div>
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
          border-radius: 12px;
        ">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div style="font-size: 1.8rem;">K</div>
            <div>
              <div style="color: #bb86fc; font-weight: bold; font-size: 1rem;">RDFa</div>
              <div style="color: var(--r-text-faint, #9CA3AF); font-size: 0.7rem;">${t('seo.report.structuredData.formats.rdfa.subtitle', 'Resource Description')}</div>
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
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">🔧</span>
                <span style="color: #00ccff; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.schemaDocs.title', 'Schema.org Docs')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.schemaDocs.purpose',
                'Official vocabulary reference with complete documentation for all schema types and properties'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://schema.org" target="_blank" style="color: #00ccff; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #00ccff;">${t('seo.report.structuredData.resources.rows.schemaDocs.linkText', 'schema.org →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">✓</span>
                <span style="color: var(--accent-primary); font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.richResultsTest.title', 'Rich Results Test')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.richResultsTest.purpose',
                'Test your structured data markup and see which Google rich results can be generated from it'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://search.google.com/test/rich-results" target="_blank" style="color: var(--accent-primary); text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted var(--accent-primary);">${t('seo.report.structuredData.resources.rows.richResultsTest.linkText', 'Test Markup →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">C</span>
                <span style="color: #ffd700; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.validator.title', 'Schema Validator')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.validator.purpose',
                'Comprehensive validation tool for all structured data formats including JSON-LD, Microdata, and RDFa'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://validator.schema.org/" target="_blank" style="color: #ffd700; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #ffd700;">${t('seo.report.structuredData.resources.rows.validator.linkText', 'Validate →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">📚</span>
                <span style="color: #bb86fc; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.googleGuide.title', 'Google Guide')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              ${t(
                'seo.report.structuredData.resources.rows.googleGuide.purpose',
                'Step-by-step guide from Google on implementing structured data with code examples and best practices'
              )}
            </td>
            <td style="padding: 0.75rem; text-align: center; border: 1px solid rgba(255, 255, 255, 0.05);">
              <a href="https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data" target="_blank" style="color: #bb86fc; text-decoration: none; font-size: 0.85rem; border-bottom: 1px dotted #bb86fc;">${t('seo.report.structuredData.resources.rows.googleGuide.linkText', 'Read Guide →')}</a>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
            <td style="padding: 0.75rem; border: 1px solid rgba(255, 255, 255, 0.05);">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 1.3rem;">🔧</span>
                <span style="color: #ff8c00; font-weight: 600; font-size: 0.9rem;">${t('seo.report.structuredData.resources.rows.generator.title', 'Markup Generator')}</span>
              </div>
            </td>
            <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); font-size: 0.85rem; border: 1px solid rgba(255, 255, 255, 0.05);">
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
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${check}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.1rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${purpose}</td>
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
            <tr style="border-bottom: 1px solid var(--r-border, rgba(0, 0, 0, 0.08));">
              <td style="padding: 0.75rem; font-weight: 600; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${platform}</td>
              <td style="padding: 0.75rem; text-align: center; font-size: 1.2rem; border: 1px solid rgba(255, 255, 255, 0.05);">${status}</td>
              <td style="padding: 0.75rem; color: var(--r-text-muted, #6B7280); border: 1px solid rgba(255, 255, 255, 0.05);">${value}</td>
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
  if (score >= 90) return '#22c55e';  // A: Green
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
        <button data-action="reload-page" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ff6600; color: #000; border: none; cursor: pointer; font-family: 'Courier New', monospace; font-weight: bold;">${t('seo.report.error.retry', 'RETRY')}</button>
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
    alert(t('seo.export.noResults', 'No scan results to export. Run a scan first.'));
    return;
  }

  const rows = [];

  // Helper to add a row
  const addRow = (category, item, value, status = '', details = '') => {
    rows.push([category, item, String(value ?? ''), status, details]);
  };

  // Header
  rows.push([t('seo.export.csv.category', 'Category'), t('seo.export.csv.item', 'Item'), t('seo.export.csv.value', 'Value'), t('seo.export.csv.status', 'Status'), t('seo.export.csv.details', 'Details')]);

  // ============ OVERVIEW ============
  const csvOverview = t('seo.export.csv.sections.overview', 'Overview');
  const csvGood = t('seo.export.csv.statusGood', 'Good');
  const csvNeedsWork = t('seo.export.csv.statusNeedsWork', 'Needs Work');
  const csvPoor = t('seo.export.csv.statusPoor', 'Poor');
  const csvPresent = t('seo.export.csv.statusPresent', 'Present');
  const csvMissing = t('seo.export.csv.statusMissing', 'Missing');
  const csvIssue = t('seo.export.csv.statusIssue', 'Issue');

  // Helper to check status (using translated defaults)
  const checkStatus = (condition, goodText = csvGood, badText = csvIssue) => condition ? goodText : badText;
  const csvOptimal = t('seo.export.csv.statusOptimal', 'Optimal');
  const csvAcceptable = t('seo.export.csv.statusAcceptable', 'Acceptable');
  const csvDefault = t('seo.export.csv.statusDefault', 'Default');
  const csvNotSet = t('seo.export.csv.statusNotSet', 'Not set');
  const csvPass = t('seo.export.csv.statusPass', 'Pass');
  const csvFail = t('seo.export.csv.statusFail', 'Fail');
  const csvLow = t('seo.export.csv.statusLow', 'Low');
  const csvVeryLow = t('seo.export.csv.statusVeryLow', 'Very Low');
  const csvModerate = t('seo.export.csv.statusModerate', 'Moderate');
  const csvSlow = t('seo.export.csv.statusSlow', 'Slow');
  const csvOptional = t('seo.export.csv.statusOptional', 'Optional');
  const csvYes = t('seo.export.csv.statusYes', 'Yes');
  const csvNo = t('seo.export.csv.statusNo', 'No');
  const csvFound = t('seo.export.csv.statusFound', 'Found');
  const csvValid = t('seo.export.csv.statusValid', 'Valid');
  const csvSuggestion = t('seo.export.csv.statusSuggestion', 'Suggestion');
  const csvHasAlt = t('seo.export.csv.statusHasAlt', 'Has alt');
  const csvMissingAlt = t('seo.export.csv.statusMissingAlt', 'Missing alt');
  const csvInternal = t('seo.export.csv.statusInternal', 'Internal');
  const csvExternal = t('seo.export.csv.statusExternal', 'External');
  const csvOptimize = t('seo.export.csv.statusOptimize', 'Optimize');
  const csvConsiderLazy = t('seo.export.csv.statusConsiderLazy', 'Consider lazy loading');
  const csvOK = t('seo.export.csv.statusOK', 'OK');

  addRow(csvOverview, t('seo.export.csv.url', 'URL'), results.url || '');
  addRow(csvOverview, t('seo.export.csv.scanDate', 'Scan Date'), results.timestamp || new Date().toISOString());
  if (results.score) {
    addRow(csvOverview, t('seo.export.csv.overallSeoScore', 'Overall SEO Score'), results.score.overall || '', results.score.overall >= 80 ? csvGood : results.score.overall >= 50 ? csvNeedsWork : csvPoor);
    addRow(csvOverview, t('seo.export.csv.grade', 'Grade'), results.score.grade || '');
  }

  // ============ META TAGS ============
  const csvMetaTags = t('seo.export.csv.sections.metaTags', 'Meta Tags');
  if (results.metaTags) {
    const meta = results.metaTags;
    addRow(csvMetaTags, t('seo.export.csv.sectionScore', 'Section Score'), meta.score || '', checkStatus(meta.score >= 80));

    // Title
    addRow(csvMetaTags, t('seo.export.csv.metaTags.title', 'Title'), meta.title || '', checkStatus(meta.title, csvPresent, csvMissing));
    addRow(csvMetaTags, t('seo.export.csv.metaTags.titleLength', 'Title Length'), meta.titleLength || 0,
      meta.titleLength >= 50 && meta.titleLength <= 60 ? csvOptimal :
      meta.titleLength >= 30 && meta.titleLength <= 70 ? csvAcceptable : csvNeedsWork,
      t('seo.export.csv.metaTags.recommendedTitle', 'Recommended: 50-60 characters'));

    // Description
    addRow(csvMetaTags, t('seo.export.csv.metaTags.description', 'Description'), meta.description || '', checkStatus(meta.description, csvPresent, csvMissing));
    addRow(csvMetaTags, t('seo.export.csv.metaTags.descriptionLength', 'Description Length'), meta.descriptionLength || 0,
      meta.descriptionLength >= 120 && meta.descriptionLength <= 160 ? csvOptimal :
      meta.descriptionLength >= 80 && meta.descriptionLength <= 200 ? csvAcceptable : csvNeedsWork,
      t('seo.export.csv.metaTags.recommendedDesc', 'Recommended: 120-160 characters'));

    // Technical meta tags
    addRow(csvMetaTags, t('seo.export.csv.metaTags.canonicalUrl', 'Canonical URL'), meta.canonical || '', checkStatus(meta.canonical, csvPresent, csvMissing));
    addRow(csvMetaTags, t('seo.export.csv.metaTags.robots', 'Robots'), meta.robots || csvNotSet, meta.robots ? csvPresent : csvDefault);
    addRow(csvMetaTags, t('seo.export.csv.metaTags.viewport', 'Viewport'), meta.viewport || '', checkStatus(meta.viewport, csvPresent, csvMissing));
    addRow(csvMetaTags, t('seo.export.csv.metaTags.language', 'Language'), meta.language || '', checkStatus(meta.language, csvPresent, csvMissing));
    addRow(csvMetaTags, t('seo.export.csv.metaTags.charset', 'Charset'), meta.charset || '', checkStatus(meta.charset, csvPresent, csvMissing));
    addRow(csvMetaTags, t('seo.export.csv.metaTags.author', 'Author'), meta.author || '', meta.author ? csvPresent : csvNotSet);
    addRow(csvMetaTags, t('seo.export.csv.metaTags.keywords', 'Keywords'), meta.keywords || '', meta.keywords ? csvPresent : csvNotSet);

    // Open Graph tags
    addRow(csvMetaTags, 'OG:Title', meta.ogTitle || '', checkStatus(meta.ogTitle, csvPresent, csvMissing));
    addRow(csvMetaTags, 'OG:Description', meta.ogDescription || '', checkStatus(meta.ogDescription, csvPresent, csvMissing));
    addRow(csvMetaTags, 'OG:Image', meta.ogImage || '', checkStatus(meta.ogImage, csvPresent, csvMissing));
    addRow(csvMetaTags, 'OG:URL', meta.ogUrl || '', checkStatus(meta.ogUrl, csvPresent, csvMissing));
    addRow(csvMetaTags, 'OG:Type', meta.ogType || '', meta.ogType ? csvPresent : csvNotSet);
    addRow(csvMetaTags, 'OG:Site Name', meta.ogSiteName || '', meta.ogSiteName ? csvPresent : csvNotSet);

    // Twitter Card tags
    addRow(csvMetaTags, 'Twitter:Card', meta.twitterCard || '', checkStatus(meta.twitterCard, csvPresent, csvMissing));
    addRow(csvMetaTags, 'Twitter:Title', meta.twitterTitle || '', meta.twitterTitle ? csvPresent : csvNotSet);
    addRow(csvMetaTags, 'Twitter:Description', meta.twitterDescription || '', meta.twitterDescription ? csvPresent : csvNotSet);
    addRow(csvMetaTags, 'Twitter:Image', meta.twitterImage || '', meta.twitterImage ? csvPresent : csvNotSet);
    addRow(csvMetaTags, 'Twitter:Site', meta.twitterSite || '', meta.twitterSite ? csvPresent : csvNotSet);

    // Meta tag issues
    if (meta.issues && meta.issues.length > 0) {
      meta.issues.forEach((issue, i) => addRow(csvMetaTags, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (meta.recommendations && meta.recommendations.length > 0) {
      meta.recommendations.forEach((rec, i) => addRow(csvMetaTags, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ HEADINGS ============
  const csvHeadings = t('seo.export.csv.sections.headings', 'Headings');
  if (results.headingStructure) {
    const h = results.headingStructure;
    addRow(csvHeadings, t('seo.export.csv.sectionScore', 'Section Score'), h.score || '', checkStatus(h.score >= 80));
    addRow(csvHeadings, t('seo.export.csv.headings.h1Count', 'H1 Count'), h.h1?.length || h.h1Count || 0, (h.h1?.length || h.h1Count) === 1 ? csvGood : csvIssue, t('seo.export.csv.headings.shouldHaveOneH1', 'Should have exactly 1 H1'));
    addRow(csvHeadings, t('seo.export.csv.headings.h2Count', 'H2 Count'), h.h2?.length || h.h2Count || 0);
    addRow(csvHeadings, t('seo.export.csv.headings.h3Count', 'H3 Count'), h.h3?.length || h.h3Count || 0);
    addRow(csvHeadings, t('seo.export.csv.headings.h4Count', 'H4 Count'), h.h4?.length || h.h4Count || 0);
    addRow(csvHeadings, t('seo.export.csv.headings.h5Count', 'H5 Count'), h.h5?.length || h.h5Count || 0);
    addRow(csvHeadings, t('seo.export.csv.headings.h6Count', 'H6 Count'), h.h6?.length || h.h6Count || 0);
    addRow(csvHeadings, t('seo.export.csv.headings.totalHeadings', 'Total Headings'), h.total || h.totalCount || 0, (h.total || h.totalCount) >= 3 ? csvGood : csvLow);

    // H1 texts
    if (h.h1 && Array.isArray(h.h1)) {
      h.h1.forEach((text, i) => addRow(csvHeadings, `${t('seo.export.csv.headings.h1Text', 'H1 Text')} ${i + 1}`, text));
    }

    // Heading hierarchy
    if (h.hierarchy && Array.isArray(h.hierarchy)) {
      h.hierarchy.slice(0, 20).forEach((item, i) => {
        addRow(csvHeadings, `${t('seo.export.csv.headings.hierarchy', 'Hierarchy')} ${i + 1}`, item.text || '', item.level || '');
      });
    }

    if (h.issues && h.issues.length > 0) {
      h.issues.forEach((issue, i) => addRow(csvHeadings, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (h.recommendations && h.recommendations.length > 0) {
      h.recommendations.forEach((rec, i) => addRow(csvHeadings, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ CONTENT ANALYSIS ============
  const csvContentSection = t('seo.export.csv.sections.content', 'Content');
  const csvTooLong = t('seo.export.csv.statusTooLong', 'Too Long');
  if (results.contentAnalysis) {
    const c = results.contentAnalysis;
    addRow(csvContentSection, t('seo.export.csv.sectionScore', 'Section Score'), c.score || '', checkStatus(c.score >= 80));
    addRow(csvContentSection, t('seo.export.csv.content.wordCount', 'Word Count'), c.wordCount || 0, c.wordCount >= 300 ? csvGood : c.wordCount >= 150 ? csvLow : csvVeryLow, t('seo.export.csv.content.recommendedWords', 'Recommended: 300+ words'));
    addRow(csvContentSection, t('seo.export.csv.content.sentenceCount', 'Sentence Count'), c.sentenceCount || 0);
    addRow(csvContentSection, t('seo.export.csv.content.paragraphCount', 'Paragraph Count'), c.paragraphCount || 0);
    addRow(csvContentSection, t('seo.export.csv.content.characterCount', 'Character Count'), c.characterCount || 0);
    addRow(csvContentSection, t('seo.export.csv.content.avgWordsPerSentence', 'Avg Words/Sentence'), c.averageWordsPerSentence || 0, c.averageWordsPerSentence <= 25 ? csvGood : csvTooLong, t('seo.export.csv.content.recommendedAvgWords', 'Recommended: 15-25 words'));
    addRow(csvContentSection, t('seo.export.csv.content.textToHtmlRatio', 'Text-to-HTML Ratio'), ((c.textToHTMLRatio || 0) * 100).toFixed(1) + '%', c.textToHTMLRatio >= 0.1 ? csvGood : csvLow, t('seo.export.csv.content.recommendedRatio', 'Recommended: 10%+'));

    if (c.readabilityScore !== undefined) {
      addRow(csvContentSection, t('seo.export.csv.content.readabilityScore', 'Readability Score'), c.readabilityScore);
    }
    if (c.readingLevel) {
      addRow(csvContentSection, t('seo.export.csv.content.readingLevel', 'Reading Level'), c.readingLevel);
    }

    if (c.issues && c.issues.length > 0) {
      c.issues.forEach((issue, i) => addRow(csvContentSection, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (c.recommendations && c.recommendations.length > 0) {
      c.recommendations.forEach((rec, i) => addRow(csvContentSection, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ IMAGES ============
  const csvImages = t('seo.export.csv.sections.images', 'Images');
  if (results.imageAnalysis || results.images) {
    const img = results.imageAnalysis || results.images;
    addRow(csvImages, t('seo.export.csv.sectionScore', 'Section Score'), img.score || '', checkStatus(img.score >= 80));
    addRow(csvImages, t('seo.export.csv.images.totalImages', 'Total Images'), img.total || img.totalCount || 0);
    addRow(csvImages, t('seo.export.csv.images.withAltText', 'With Alt Text'), img.withAlt || 0, csvGood);
    addRow(csvImages, t('seo.export.csv.images.withoutAltText', 'Without Alt Text'), img.withoutAlt || img.missingAlt || 0, (img.withoutAlt || img.missingAlt) === 0 ? csvGood : csvIssue, t('seo.export.csv.images.allNeedAlt', 'All images need alt text'));

    // Count lazy loaded
    if (img.images && Array.isArray(img.images)) {
      const lazyCount = img.images.filter(i => i.loading === 'lazy').length;
      const eagerCount = img.images.filter(i => i.loading !== 'lazy').length;
      addRow(csvImages, t('seo.export.csv.images.lazyLoaded', 'Lazy Loaded'), lazyCount);
      addRow(csvImages, t('seo.export.csv.images.eagerLoaded', 'Eager Loaded'), eagerCount, eagerCount > 5 ? csvConsiderLazy : csvOK);

      // Large images
      const largeImages = img.images.filter(i => (i.width * i.height) > 1920 * 1080);
      addRow(csvImages, t('seo.export.csv.images.largeImages', 'Large Images (>1080p)'), largeImages.length, largeImages.length === 0 ? csvGood : csvOptimize);

      // List first 20 images
      img.images.slice(0, 20).forEach((image, i) => {
        const altStatus = image.alt ? csvHasAlt : csvMissingAlt;
        addRow(csvImages, `${t('seo.export.csv.images.image', 'Image')} ${i + 1}`, image.src || '', altStatus, `${image.width || '?'}x${image.height || '?'}`);
      });
    }

    if (img.issues && img.issues.length > 0) {
      img.issues.forEach((issue, i) => addRow(csvImages, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (img.recommendations && img.recommendations.length > 0) {
      img.recommendations.forEach((rec, i) => addRow(csvImages, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ LINKS ============
  const csvLinks = t('seo.export.csv.sections.links', 'Links');
  const csvNewTab = t('seo.export.csv.links.newTab', 'new tab');
  if (results.linkAnalysis || results.links) {
    const l = results.linkAnalysis || results.links;
    addRow(csvLinks, t('seo.export.csv.sectionScore', 'Section Score'), l.score || '', checkStatus(l.score >= 80));
    addRow(csvLinks, t('seo.export.csv.links.totalLinks', 'Total Links'), l.total || l.totalCount || 0);
    addRow(csvLinks, t('seo.export.csv.links.internalLinks', 'Internal Links'), l.internal || l.internalCount || 0);
    addRow(csvLinks, t('seo.export.csv.links.externalLinks', 'External Links'), l.external || l.externalCount || 0);
    addRow(csvLinks, t('seo.export.csv.links.nofollowLinks', 'NoFollow Links'), l.noFollow || l.nofollowCount || 0);
    addRow(csvLinks, t('seo.export.csv.links.brokenFormatLinks', 'Broken Format Links'), l.brokenFormat || l.brokenCount || 0, (l.brokenFormat || l.brokenCount) === 0 ? csvGood : csvIssue);

    // List first 30 links
    if (l.links && Array.isArray(l.links)) {
      const emptyAnchors = l.links.filter(link => !link.text || link.text.length === 0).length;
      addRow(csvLinks, t('seo.export.csv.links.emptyAnchorText', 'Empty Anchor Text'), emptyAnchors, emptyAnchors === 0 ? csvGood : csvIssue);

      l.links.slice(0, 30).forEach((link, i) => {
        const type = link.isExternal ? csvExternal : csvInternal;
        const flags = [
          link.hasNoFollow ? 'nofollow' : '',
          link.hasNoOpener ? 'noopener' : '',
          link.target === '_blank' ? csvNewTab : ''
        ].filter(Boolean).join(', ');
        addRow(csvLinks, `${t('seo.export.csv.links.link', 'Link')} ${i + 1}`, link.href || '', type, flags || link.text?.substring(0, 50) || '');
      });
    }

    if (l.issues && l.issues.length > 0) {
      l.issues.forEach((issue, i) => addRow(csvLinks, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (l.recommendations && l.recommendations.length > 0) {
      l.recommendations.forEach((rec, i) => addRow(csvLinks, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ MOBILE RESPONSIVENESS ============
  const csvMobile = t('seo.export.csv.sections.mobile', 'Mobile');
  if (results.mobileResponsive) {
    const m = results.mobileResponsive;
    addRow(csvMobile, t('seo.export.csv.sectionScore', 'Section Score'), m.score || '', checkStatus(m.score >= 80));
    addRow(csvMobile, t('seo.export.csv.mobile.mobileFriendly', 'Mobile Friendly'), m.isMobileFriendly ? csvYes : csvNo, checkStatus(m.isMobileFriendly));
    addRow(csvMobile, t('seo.export.csv.mobile.hasViewportMeta', 'Has Viewport Meta'), m.hasViewport ? csvYes : csvNo, checkStatus(m.hasViewport));
    addRow(csvMobile, t('seo.export.csv.mobile.touchFriendly', 'Touch Friendly'), m.isTouchFriendly ? csvYes : csvNo, checkStatus(m.isTouchFriendly));
    addRow(csvMobile, t('seo.export.csv.mobile.responsiveDesign', 'Responsive Design'), m.isResponsive ? csvYes : csvNo, checkStatus(m.isResponsive));

    if (m.issues && m.issues.length > 0) {
      m.issues.forEach((issue, i) => addRow(csvMobile, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
  }

  // ============ PERFORMANCE METRICS ============
  const csvPerformance = t('seo.export.csv.sections.performance', 'Performance');
  if (results.performanceMetrics) {
    const p = results.performanceMetrics;
    addRow(csvPerformance, t('seo.export.csv.sectionScore', 'Section Score'), p.score || '', checkStatus(p.score >= 80));

    if (p.fcp) addRow(csvPerformance, t('seo.export.csv.performance.fcp', 'First Contentful Paint (FCP)'), p.fcp + 'ms', p.fcp < 1800 ? csvGood : p.fcp < 3000 ? csvModerate : csvPoor);
    if (p.lcp) addRow(csvPerformance, t('seo.export.csv.performance.lcp', 'Largest Contentful Paint (LCP)'), p.lcp + 'ms', p.lcp < 2500 ? csvGood : p.lcp < 4000 ? csvModerate : csvPoor);
    if (p.cls !== undefined) addRow(csvPerformance, t('seo.export.csv.performance.cls', 'Cumulative Layout Shift (CLS)'), p.cls, p.cls < 0.1 ? csvGood : p.cls < 0.25 ? csvModerate : csvPoor);
    if (p.tbt) addRow(csvPerformance, t('seo.export.csv.performance.tbt', 'Total Blocking Time (TBT)'), p.tbt + 'ms', p.tbt < 200 ? csvGood : p.tbt < 600 ? csvModerate : csvPoor);
    if (p.tti) addRow(csvPerformance, t('seo.export.csv.performance.tti', 'Time to Interactive (TTI)'), p.tti + 'ms');
    if (p.ttfb) addRow(csvPerformance, t('seo.export.csv.performance.ttfb', 'Time to First Byte (TTFB)'), p.ttfb + 'ms', p.ttfb < 800 ? csvGood : csvSlow);
    if (p.domContentLoaded) addRow(csvPerformance, t('seo.export.csv.performance.domContentLoaded', 'DOM Content Loaded'), p.domContentLoaded + 'ms');
    if (p.load) addRow(csvPerformance, t('seo.export.csv.performance.pageLoadTime', 'Page Load Time'), p.load + 'ms');
    if (p.pageSize) addRow(csvPerformance, t('seo.export.csv.performance.pageSize', 'Page Size'), (p.pageSize / 1024).toFixed(1) + ' KB');
    if (p.requestCount) addRow(csvPerformance, t('seo.export.csv.performance.totalRequests', 'Total Requests'), p.requestCount);

    if (p.issues && p.issues.length > 0) {
      p.issues.forEach((issue, i) => addRow(csvPerformance, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (p.recommendations && p.recommendations.length > 0) {
      p.recommendations.forEach((rec, i) => addRow(csvPerformance, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ SECURITY HEADERS ============
  const csvSecurity = t('seo.export.csv.sections.security', 'Security');
  if (results.securityHeaders) {
    const s = results.securityHeaders;
    addRow(csvSecurity, t('seo.export.csv.sectionScore', 'Section Score'), s.score || '', checkStatus(s.score >= 80));
    addRow(csvSecurity, 'HTTPS', s.isHttps ? csvYes : csvNo, checkStatus(s.isHttps));

    // Individual headers
    const headers = s.headers || s;
    if (headers.contentSecurityPolicy !== undefined) {
      addRow(csvSecurity, 'Content-Security-Policy', headers.contentSecurityPolicy ? csvPresent : csvMissing, checkStatus(headers.contentSecurityPolicy));
    }
    if (headers.xFrameOptions !== undefined) {
      addRow(csvSecurity, 'X-Frame-Options', headers.xFrameOptions || csvMissing, checkStatus(headers.xFrameOptions));
    }
    if (headers.xContentTypeOptions !== undefined) {
      addRow(csvSecurity, 'X-Content-Type-Options', headers.xContentTypeOptions || csvMissing, checkStatus(headers.xContentTypeOptions));
    }
    if (headers.strictTransportSecurity !== undefined) {
      addRow(csvSecurity, 'Strict-Transport-Security', headers.strictTransportSecurity ? csvPresent : csvMissing, checkStatus(headers.strictTransportSecurity));
    }
    if (headers.referrerPolicy !== undefined) {
      addRow(csvSecurity, 'Referrer-Policy', headers.referrerPolicy || csvMissing, checkStatus(headers.referrerPolicy));
    }
    if (headers.permissionsPolicy !== undefined) {
      addRow(csvSecurity, 'Permissions-Policy', headers.permissionsPolicy ? csvPresent : csvMissing, headers.permissionsPolicy ? csvGood : csvOptional);
    }

    if (s.issues && s.issues.length > 0) {
      s.issues.forEach((issue, i) => addRow(csvSecurity, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (s.recommendations && s.recommendations.length > 0) {
      s.recommendations.forEach((rec, i) => addRow(csvSecurity, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ STRUCTURED DATA ============
  const csvStructuredData = t('seo.export.csv.sections.structuredData', 'Structured Data');
  const csvUnknown = t('seo.export.csv.statusUnknown', 'Unknown');
  if (results.structuredData) {
    const sd = results.structuredData;
    addRow(csvStructuredData, t('seo.export.csv.sectionScore', 'Section Score'), sd.score || '', checkStatus(sd.score >= 80));
    addRow(csvStructuredData, t('seo.export.csv.structuredData.hasStructuredData', 'Has Structured Data'), sd.hasStructuredData ? csvYes : csvNo, checkStatus(sd.hasStructuredData, csvGood, csvMissing));
    addRow(csvStructuredData, t('seo.export.csv.structuredData.jsonLdFound', 'JSON-LD Found'), sd.jsonLdCount || 0);
    addRow(csvStructuredData, t('seo.export.csv.structuredData.microdataFound', 'Microdata Found'), sd.microdataCount || 0);

    // Schema types
    if (sd.schemaTypes && sd.schemaTypes.length > 0) {
      addRow(csvStructuredData, t('seo.export.csv.structuredData.schemaTypes', 'Schema Types'), sd.schemaTypes.join(', '));
    }

    // JSON-LD details
    if (sd.jsonLd && Array.isArray(sd.jsonLd)) {
      sd.jsonLd.slice(0, 5).forEach((item, i) => {
        addRow(csvStructuredData, `JSON-LD ${i + 1} ${t('seo.export.csv.type', 'Type')}`, item['@type'] || csvUnknown);
      });
    }

    if (sd.issues && sd.issues.length > 0) {
      sd.issues.forEach((issue, i) => addRow(csvStructuredData, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (sd.recommendations && sd.recommendations.length > 0) {
      sd.recommendations.forEach((rec, i) => addRow(csvStructuredData, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ ADDITIONAL CHECKS ============
  const csvAdditionalChecks = t('seo.export.csv.sections.additionalChecks', 'Additional Checks');
  const csvIssueFound = t('seo.export.csv.statusIssueFound', 'Issue Found');
  const csvNone = t('seo.export.csv.statusNone', 'None');
  const csvCheck = t('seo.export.csv.check', 'Check');
  if (results.additionalChecks) {
    const ac = results.additionalChecks;
    addRow(csvAdditionalChecks, t('seo.export.csv.sectionScore', 'Section Score'), ac.score || '', checkStatus(ac.score >= 80));

    // Common additional checks
    if (ac.hasRobotsTxt !== undefined) addRow(csvAdditionalChecks, 'robots.txt', ac.hasRobotsTxt ? csvFound : csvMissing, checkStatus(ac.hasRobotsTxt));
    if (ac.hasSitemap !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.sitemap', 'Sitemap'), ac.hasSitemap ? csvFound : csvMissing, checkStatus(ac.hasSitemap));
    if (ac.hasFavicon !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.favicon', 'Favicon'), ac.hasFavicon ? csvFound : csvMissing, checkStatus(ac.hasFavicon));
    if (ac.hasAppleTouchIcon !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.appleTouchIcon', 'Apple Touch Icon'), ac.hasAppleTouchIcon ? csvFound : csvMissing);
    if (ac.has404Page !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.custom404Page', 'Custom 404 Page'), ac.has404Page ? csvYes : csvNo);
    if (ac.hasSSL !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.sslCertificate', 'SSL Certificate'), ac.hasSSL ? csvValid : csvIssue, checkStatus(ac.hasSSL));
    if (ac.mixedContent !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.mixedContent', 'Mixed Content'), ac.mixedContent ? csvIssueFound : csvNone, checkStatus(!ac.mixedContent));
    if (ac.hasAMP !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.ampVersion', 'AMP Version'), ac.hasAMP ? csvYes : csvNo);
    if (ac.hasPWA !== undefined) addRow(csvAdditionalChecks, t('seo.export.csv.additional.pwaReady', 'PWA Ready'), ac.hasPWA ? csvYes : csvNo);

    // Checks array
    if (ac.checks && Array.isArray(ac.checks)) {
      ac.checks.forEach((check, i) => {
        addRow(csvAdditionalChecks, check.name || `${csvCheck} ${i + 1}`, check.value || '', check.passed ? csvPass : csvFail);
      });
    }

    if (ac.issues && ac.issues.length > 0) {
      ac.issues.forEach((issue, i) => addRow(csvAdditionalChecks, `${t('seo.export.csv.issue', 'Issue')} ${i + 1}`, issue, csvIssue));
    }
    if (ac.recommendations && ac.recommendations.length > 0) {
      ac.recommendations.forEach((rec, i) => addRow(csvAdditionalChecks, `${t('seo.export.csv.recommendation', 'Recommendation')} ${i + 1}`, rec, csvSuggestion));
    }
  }

  // ============ SCORE BREAKDOWN ============
  const csvScoreBreakdown = t('seo.export.csv.sections.scoreBreakdown', 'Score Breakdown');
  if (results.score && results.score.breakdown) {
    const breakdown = results.score.breakdown;
    Object.entries(breakdown).forEach(([category, data]) => {
      const score = typeof data === 'number' ? data : data?.score;
      if (score !== undefined) {
        addRow(csvScoreBreakdown, category, score, score >= 80 ? csvGood : score >= 50 ? csvNeedsWork : csvPoor);
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
    window.ReportUI.toast(t('seo.export.csvExported', 'CSV exported: {{count}} data points', { count: rows.length - 1 }));
  }
};

/**
 * Export SEO results as professionally designed Excel workbook
 * Uses ExcelJS for full styling support (colors, fonts, borders)
 */
window.exportSeoExcel = async function() {
  const results = window.currentSeoResults;
  if (!results) {
    alert(t('seo.export.noResults', 'No scan results to export. Run a scan first.'));
    return;
  }

  // Check if ExcelJS is loaded
  if (typeof ExcelJS === 'undefined') {
    alert(t('seo.export.excelLibraryNotLoaded', 'Excel export library not loaded. Please try again or use CSV export.'));
    return;
  }

  // Show loading toast
  if (window.ReportUI?.toast) {
    window.ReportUI.toast(t('seo.export.generatingExcel', 'Generating Excel report...'));
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

  // Excel export status/label translations
  const xlGood = t('seo.export.excel.statusGood', 'Good');
  const xlNeedsWork = t('seo.export.excel.statusNeedsWork', 'Needs Work');
  const xlPoor = t('seo.export.excel.statusPoor', 'Poor');
  const xlPresent = t('seo.export.excel.statusPresent', 'Present');
  const xlMissing = t('seo.export.excel.statusMissing', 'Missing');
  const xlIssue = t('seo.export.excel.statusIssue', 'Issue');
  const xlConfigured = t('seo.export.excel.statusConfigured', 'Configured');
  const xlNotSet = t('seo.export.excel.statusNotSet', 'Not set');
  const xlDefault = t('seo.export.excel.statusDefault', 'Default');
  const xlLow = t('seo.export.excel.statusLow', 'Low');
  const xlModerate = t('seo.export.excel.statusModerate', 'Moderate');
  const xlSlow = t('seo.export.excel.statusSlow', 'Slow');
  const xlSet = t('seo.export.excel.statusSet', 'Set');
  const xlYes = t('seo.export.excel.statusYes', 'Yes');
  const xlNo = t('seo.export.excel.statusNo', 'No');

  // ============ OVERVIEW SHEET ============
  const wsOverview = wb.addWorksheet(t('seo.export.excel.sheets.overview', 'Overview'), {
    properties: { tabColor: { argb: COLORS.brand } }
  });
  wsOverview.columns = [
    { width: 25 }, { width: 50 }, { width: 15 }, { width: 30 }
  ];

  // Title row
  const titleRow = wsOverview.addRow([t('seo.export.excel.seoAnalysisReport', 'SEO Analysis Report')]);
  wsOverview.mergeCells(1, 1, 1, 4);
  applyStyle(wsOverview.getCell('A1'), styles.title);
  titleRow.height = 30;

  // Subtitle with branding
  const brandRow = wsOverview.addRow([t('seo.export.excel.poweredBy', 'Powered by Site Mechanic')]);
  applyStyle(wsOverview.getCell('A2'), { font: { size: 10, italic: true, color: { argb: COLORS.textMuted } } });

  wsOverview.addRow([]);

  // URL and Date
  const urlRow = wsOverview.addRow([t('seo.export.excel.analyzedUrl', 'Analyzed URL:'), results.url || '']);
  applyStyle(wsOverview.getCell('A4'), { font: { bold: true } });

  const dateRow = wsOverview.addRow([t('seo.export.excel.scanDate', 'Scan Date:'), window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date(results.timestamp || Date.now())) : new Date(results.timestamp || Date.now()).toLocaleString()]);
  applyStyle(wsOverview.getCell('A5'), { font: { bold: true } });

  wsOverview.addRow([]);

  // Overall Score - Big and prominent
  const scoreLabel = wsOverview.addRow([t('seo.export.excel.overallSeoScore', 'OVERALL SEO SCORE')]);
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
  addSectionTitle(wsOverview, t('seo.export.excel.scoreBreakdown', 'Score Breakdown'), 4);
  addStyledRow(wsOverview, [t('seo.export.excel.category', 'Category'), t('seo.export.excel.score', 'Score'), t('seo.export.excel.status', 'Status'), t('seo.export.excel.grade', 'Grade')], true);

  if (results.score?.breakdown) {
    let rowIdx = 0;
    Object.entries(results.score.breakdown).forEach(([category, data]) => {
      const score = typeof data === 'number' ? data : data?.score;
      if (score !== undefined) {
        const status = score >= 80 ? xlGood : score >= 50 ? xlNeedsWork : xlPoor;
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
    const wsMeta = wb.addWorksheet(t('seo.export.excel.sheets.metaTags', 'Meta Tags'));
    wsMeta.columns = [{ width: 22 }, { width: 60 }, { width: 12 }, { width: 35 }];

    // Title with score
    const metaTitle = wsMeta.addRow([t('seo.export.excel.metaTags.title', 'Meta Tags Analysis'), '', `${t('seo.export.excel.score', 'Score')}: ${meta.score || 0}`, '']);
    wsMeta.mergeCells(1, 1, 1, 2);
    applyStyle(wsMeta.getCell('A1'), styles.title);
    applyStyle(wsMeta.getCell('C1'), styles.score(meta.score || 0));
    metaTitle.height = 28;
    wsMeta.addRow([]);

    // Basic Meta Tags section
    addSectionTitle(wsMeta, t('seo.export.excel.metaTags.basicMetaTags', 'Basic Meta Tags'), 4);
    addStyledRow(wsMeta, [t('seo.export.excel.tag', 'Tag'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status'), t('seo.export.excel.notes', 'Notes')], true);
    const xlChars = t('seo.export.excel.chars', 'chars');
    const basicTags = [
      [t('seo.export.excel.metaTags.rows.title', 'Title'), meta.title || '', meta.title ? xlPresent : xlMissing, `${meta.titleLength || 0} ${xlChars}`],
      [t('seo.export.excel.metaTags.rows.description', 'Description'), (meta.description || '').substring(0, 80) + '...', meta.description ? xlPresent : xlMissing, `${meta.descriptionLength || 0} ${xlChars}`],
      [t('seo.export.excel.metaTags.rows.canonicalUrl', 'Canonical URL'), meta.canonical || '', meta.canonical ? xlPresent : xlMissing, ''],
      [t('seo.export.excel.metaTags.rows.robots', 'Robots'), meta.robots || xlNotSet, meta.robots ? xlPresent : xlDefault, ''],
      [t('seo.export.excel.metaTags.rows.viewport', 'Viewport'), meta.viewport ? xlConfigured : '', meta.viewport ? xlPresent : xlMissing, ''],
      [t('seo.export.excel.metaTags.rows.language', 'Language'), meta.language || '', meta.language ? xlPresent : xlMissing, ''],
      [t('seo.export.excel.metaTags.rows.charset', 'Charset'), meta.charset || '', meta.charset ? xlPresent : xlMissing, ''],
    ];
    basicTags.forEach((row, i) => addStyledRow(wsMeta, row, false, i % 2 === 1));

    wsMeta.addRow([]);

    // Open Graph section
    addSectionTitle(wsMeta, t('seo.export.excel.metaTags.openGraphTags', 'Open Graph Tags'), 4);
    addStyledRow(wsMeta, [t('seo.export.excel.tag', 'Tag'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status'), t('seo.export.excel.notes', 'Notes')], true);
    const ogTags = [
      ['og:title', meta.ogTitle || '', meta.ogTitle ? xlPresent : xlMissing, ''],
      ['og:description', (meta.ogDescription || '').substring(0, 60) + '...', meta.ogDescription ? xlPresent : xlMissing, ''],
      ['og:image', meta.ogImage ? xlSet : '', meta.ogImage ? xlPresent : xlMissing, t('seo.export.excel.metaTags.ogImageNote', 'Recommended: 1200x630px')],
      ['og:url', meta.ogUrl || '', meta.ogUrl ? xlPresent : xlMissing, ''],
      ['og:type', meta.ogType || '', meta.ogType ? xlPresent : xlNotSet, ''],
    ];
    ogTags.forEach((row, i) => addStyledRow(wsMeta, row, false, i % 2 === 1));

    wsMeta.addRow([]);

    // Twitter Card section
    addSectionTitle(wsMeta, t('seo.export.excel.metaTags.twitterCardTags', 'Twitter Card Tags'), 4);
    addStyledRow(wsMeta, [t('seo.export.excel.tag', 'Tag'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status'), t('seo.export.excel.notes', 'Notes')], true);
    const twitterTags = [
      ['twitter:card', meta.twitterCard || '', meta.twitterCard ? xlPresent : xlMissing, ''],
      ['twitter:title', meta.twitterTitle || '', meta.twitterTitle ? xlPresent : xlNotSet, ''],
      ['twitter:description', (meta.twitterDescription || '').substring(0, 60), meta.twitterDescription ? xlPresent : xlNotSet, ''],
      ['twitter:image', meta.twitterImage ? xlSet : '', meta.twitterImage ? xlPresent : xlNotSet, ''],
    ];
    twitterTags.forEach((row, i) => addStyledRow(wsMeta, row, false, i % 2 === 1));

    // Issues and recommendations
    if (meta.issues?.length > 0) {
      wsMeta.addRow([]);
      addSectionTitle(wsMeta, t('seo.export.excel.issuesFound', 'Issues Found'), 4);
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
    const wsHead = wb.addWorksheet(t('seo.export.excel.sheets.headings', 'Headings'));
    wsHead.columns = [{ width: 15 }, { width: 70 }, { width: 12 }];

    const headTitle = wsHead.addRow([t('seo.export.excel.headings.title', 'Headings Analysis'), '', `${t('seo.export.excel.score', 'Score')}: ${h.score || 0}`]);
    applyStyle(wsHead.getCell('A1'), styles.title);
    applyStyle(wsHead.getCell('C1'), styles.score(h.score || 0));
    headTitle.height = 28;
    wsHead.addRow([]);

    addSectionTitle(wsHead, t('seo.export.excel.headings.headingCounts', 'Heading Counts'), 3);
    addStyledRow(wsHead, [t('seo.export.excel.headings.level', 'Level'), t('seo.export.excel.headings.count', 'Count'), t('seo.export.excel.status', 'Status')], true);
    const h1Count = h.h1?.length || h.h1Count || 0;
    addStyledRow(wsHead, ['H1', h1Count, h1Count === 1 ? xlGood : xlIssue], false, false);
    addStyledRow(wsHead, ['H2', h.h2?.length || h.h2Count || 0, ''], false, true);
    addStyledRow(wsHead, ['H3', h.h3?.length || h.h3Count || 0, ''], false, false);
    addStyledRow(wsHead, ['H4', h.h4?.length || h.h4Count || 0, ''], false, true);
    addStyledRow(wsHead, ['H5', h.h5?.length || h.h5Count || 0, ''], false, false);
    addStyledRow(wsHead, ['H6', h.h6?.length || h.h6Count || 0, ''], false, true);
    addStyledRow(wsHead, [t('seo.export.excel.headings.total', 'Total'), h.total || h.totalCount || 0, (h.total || h.totalCount) >= 3 ? xlGood : xlLow], false, false);

    if (h.h1 && Array.isArray(h.h1) && h.h1.length > 0) {
      wsHead.addRow([]);
      addSectionTitle(wsHead, t('seo.export.excel.headings.h1Content', 'H1 Content'), 3);
      h.h1.forEach((text, i) => addStyledRow(wsHead, [`H1 #${i + 1}`, text, ''], false, i % 2 === 1));
    }
  }

  // ============ CONTENT SHEET ============
  if (results.contentAnalysis) {
    const c = results.contentAnalysis;
    const wsContent = wb.addWorksheet(t('seo.export.excel.sheets.content', 'Content'));
    wsContent.columns = [{ width: 25 }, { width: 20 }, { width: 12 }, { width: 30 }];

    const contTitle = wsContent.addRow([t('seo.export.excel.content.title', 'Content Analysis'), '', `${t('seo.export.excel.score', 'Score')}: ${c.score || 0}`, '']);
    applyStyle(wsContent.getCell('A1'), styles.title);
    applyStyle(wsContent.getCell('C1'), styles.score(c.score || 0));
    contTitle.height = 28;
    wsContent.addRow([]);

    const xlLong = t('seo.export.excel.statusLong', 'Long');
    addSectionTitle(wsContent, t('seo.export.excel.content.contentMetrics', 'Content Metrics'), 4);
    addStyledRow(wsContent, [t('seo.export.excel.metric', 'Metric'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status'), t('seo.export.excel.target', 'Target')], true);
    addStyledRow(wsContent, [t('seo.export.excel.content.wordCount', 'Word Count'), c.wordCount || 0, c.wordCount >= 300 ? xlGood : xlLow, t('seo.export.excel.content.target300', '300+ recommended')], false, false);
    addStyledRow(wsContent, [t('seo.export.excel.content.sentences', 'Sentences'), c.sentenceCount || 0, '', ''], false, true);
    addStyledRow(wsContent, [t('seo.export.excel.content.paragraphs', 'Paragraphs'), c.paragraphCount || 0, '', ''], false, false);
    addStyledRow(wsContent, [t('seo.export.excel.content.avgWordsPerSentence', 'Avg Words/Sentence'), c.averageWordsPerSentence || 0, c.averageWordsPerSentence <= 25 ? xlGood : xlLong, t('seo.export.excel.content.target15to25', '15-25 words')], false, true);
    addStyledRow(wsContent, [t('seo.export.excel.content.textToHtmlRatio', 'Text-to-HTML Ratio'), ((c.textToHTMLRatio || 0) * 100).toFixed(1) + '%', c.textToHTMLRatio >= 0.1 ? xlGood : xlLow, '10%+'], false, false);
  }

  // ============ IMAGES SHEET ============
  if (results.imageAnalysis || results.images) {
    const img = results.imageAnalysis || results.images;
    const wsImg = wb.addWorksheet(t('seo.export.excel.sheets.images', 'Images'));
    wsImg.columns = [{ width: 8 }, { width: 55 }, { width: 35 }, { width: 15 }, { width: 10 }];

    const imgTitle = wsImg.addRow([t('seo.export.excel.images.title', 'Images Analysis'), '', '', `${t('seo.export.excel.score', 'Score')}: ${img.score || 0}`, '']);
    applyStyle(wsImg.getCell('A1'), styles.title);
    applyStyle(wsImg.getCell('D1'), styles.score(img.score || 0));
    imgTitle.height = 28;
    wsImg.addRow([]);

    addSectionTitle(wsImg, t('seo.export.excel.images.imageStatistics', 'Image Statistics'), 5);
    addStyledRow(wsImg, ['', t('seo.export.excel.metric', 'Metric'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status'), ''], true);
    addStyledRow(wsImg, ['', t('seo.export.excel.images.totalImages', 'Total Images'), img.total || 0, '', ''], false, false);
    addStyledRow(wsImg, ['', t('seo.export.excel.images.withAltText', 'With Alt Text'), img.withAlt || 0, xlGood, ''], false, true);
    addStyledRow(wsImg, ['', t('seo.export.excel.images.missingAltText', 'Missing Alt Text'), img.withoutAlt || img.missingAlt || 0, (img.withoutAlt || img.missingAlt) === 0 ? xlGood : xlIssue, ''], false, false);

    if (img.images && img.images.length > 0) {
      wsImg.addRow([]);
      addSectionTitle(wsImg, t('seo.export.excel.images.imageDetails', 'Image Details (first 30)'), 5);
      const xlMissingLabel = t('seo.export.excel.images.missingLabel', '(missing)');
      addStyledRow(wsImg, ['#', t('seo.export.excel.images.source', 'Source'), t('seo.export.excel.images.altText', 'Alt Text'), t('seo.export.excel.images.size', 'Size'), t('seo.export.excel.images.loading', 'Loading')], true);
      img.images.slice(0, 30).forEach((image, i) => {
        addStyledRow(wsImg, [
          i + 1,
          (image.src || '').substring(0, 60),
          image.alt || xlMissingLabel,
          `${image.width || '?'}x${image.height || '?'}`,
          image.loading || 'eager'
        ], false, i % 2 === 1);
      });
    }
  }

  // ============ LINKS SHEET ============
  if (results.linkAnalysis || results.links) {
    const l = results.linkAnalysis || results.links;
    const wsLinks = wb.addWorksheet(t('seo.export.excel.sheets.links', 'Links'));
    wsLinks.columns = [{ width: 8 }, { width: 55 }, { width: 35 }, { width: 12 }, { width: 20 }];

    const linkTitle = wsLinks.addRow([t('seo.export.excel.links.title', 'Links Analysis'), '', '', `${t('seo.export.excel.score', 'Score')}: ${l.score || 0}`, '']);
    applyStyle(wsLinks.getCell('A1'), styles.title);
    applyStyle(wsLinks.getCell('D1'), styles.score(l.score || 0));
    linkTitle.height = 28;
    wsLinks.addRow([]);

    const xlInternal = t('seo.export.excel.links.internal', 'Internal');
    const xlExternal = t('seo.export.excel.links.external', 'External');
    const xlNewTab = t('seo.export.excel.links.newTab', 'new tab');
    addSectionTitle(wsLinks, t('seo.export.excel.links.linkStatistics', 'Link Statistics'), 5);
    addStyledRow(wsLinks, ['', t('seo.export.excel.metric', 'Metric'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status'), ''], true);
    addStyledRow(wsLinks, ['', t('seo.export.excel.links.totalLinks', 'Total Links'), l.total || 0, '', ''], false, false);
    addStyledRow(wsLinks, ['', xlInternal, l.internal || 0, '', ''], false, true);
    addStyledRow(wsLinks, ['', xlExternal, l.external || 0, '', ''], false, false);
    addStyledRow(wsLinks, ['', t('seo.export.excel.links.brokenEmpty', 'Broken/Empty'), l.brokenFormat || 0, (l.brokenFormat || 0) === 0 ? xlGood : xlIssue, ''], false, true);

    if (l.links && l.links.length > 0) {
      wsLinks.addRow([]);
      addSectionTitle(wsLinks, t('seo.export.excel.links.linkDetails', 'Link Details (first 50)'), 5);
      addStyledRow(wsLinks, ['#', t('seo.export.excel.links.url', 'URL'), t('seo.export.excel.links.anchorText', 'Anchor Text'), t('seo.export.excel.links.type', 'Type'), t('seo.export.excel.links.attributes', 'Attributes')], true);
      l.links.slice(0, 50).forEach((link, i) => {
        addStyledRow(wsLinks, [
          i + 1,
          (link.href || '').substring(0, 60),
          (link.text || '').substring(0, 40),
          link.isExternal ? xlExternal : xlInternal,
          [link.hasNoFollow ? 'nofollow' : '', link.target === '_blank' ? xlNewTab : ''].filter(Boolean).join(', ') || '-'
        ], false, i % 2 === 1);
      });
    }
  }

  // ============ PERFORMANCE SHEET ============
  if (results.performanceMetrics) {
    const p = results.performanceMetrics;
    const wsPerf = wb.addWorksheet(t('seo.export.excel.sheets.performance', 'Performance'));
    wsPerf.columns = [{ width: 35 }, { width: 20 }, { width: 12 }, { width: 15 }];

    const perfTitle = wsPerf.addRow([t('seo.export.excel.performance.title', 'Performance Metrics'), '', `${t('seo.export.excel.score', 'Score')}: ${p.score || 0}`, '']);
    applyStyle(wsPerf.getCell('A1'), styles.title);
    applyStyle(wsPerf.getCell('C1'), styles.score(p.score || 0));
    perfTitle.height = 28;
    wsPerf.addRow([]);

    addSectionTitle(wsPerf, t('seo.export.excel.performance.coreWebVitals', 'Core Web Vitals'), 4);
    addStyledRow(wsPerf, [t('seo.export.excel.metric', 'Metric'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status'), t('seo.export.excel.target', 'Target')], true);
    if (p.fcp) addStyledRow(wsPerf, [t('seo.export.excel.performance.fcp', 'First Contentful Paint'), p.fcp + 'ms', p.fcp < 1800 ? xlGood : p.fcp < 3000 ? xlModerate : xlPoor, '< 1.8s'], false, false);
    if (p.lcp) addStyledRow(wsPerf, [t('seo.export.excel.performance.lcp', 'Largest Contentful Paint'), p.lcp + 'ms', p.lcp < 2500 ? xlGood : p.lcp < 4000 ? xlModerate : xlPoor, '< 2.5s'], false, true);
    if (p.cls !== undefined) addStyledRow(wsPerf, [t('seo.export.excel.performance.cls', 'Cumulative Layout Shift'), p.cls, p.cls < 0.1 ? xlGood : p.cls < 0.25 ? xlModerate : xlPoor, '< 0.1'], false, false);
    if (p.tbt) addStyledRow(wsPerf, [t('seo.export.excel.performance.tbt', 'Total Blocking Time'), p.tbt + 'ms', p.tbt < 200 ? xlGood : p.tbt < 600 ? xlModerate : xlPoor, '< 200ms'], false, true);
    if (p.ttfb) addStyledRow(wsPerf, [t('seo.export.excel.performance.ttfb', 'Time to First Byte'), p.ttfb + 'ms', p.ttfb < 800 ? xlGood : xlSlow, '< 800ms'], false, false);
  }

  // ============ SECURITY SHEET ============
  if (results.securityHeaders) {
    const s = results.securityHeaders;
    const wsSec = wb.addWorksheet(t('seo.export.excel.sheets.security', 'Security'));
    wsSec.columns = [{ width: 30 }, { width: 40 }, { width: 12 }];

    const secTitle = wsSec.addRow([t('seo.export.excel.security.title', 'Security Analysis'), '', `${t('seo.export.excel.score', 'Score')}: ${s.score || 0}`]);
    applyStyle(wsSec.getCell('A1'), styles.title);
    applyStyle(wsSec.getCell('C1'), styles.score(s.score || 0));
    secTitle.height = 28;
    wsSec.addRow([]);

    addSectionTitle(wsSec, t('seo.export.excel.security.securityHeaders', 'Security Headers'), 3);
    addStyledRow(wsSec, [t('seo.export.excel.security.header', 'Header'), t('seo.export.excel.value', 'Value'), t('seo.export.excel.status', 'Status')], true);
    addStyledRow(wsSec, ['HTTPS', s.isHttps ? xlYes : xlNo, s.isHttps ? xlGood : xlIssue], false, false);
    const headers = s.headers || s;
    if (headers.contentSecurityPolicy !== undefined)
      addStyledRow(wsSec, ['Content-Security-Policy', headers.contentSecurityPolicy ? xlPresent : xlMissing, headers.contentSecurityPolicy ? xlGood : xlIssue], false, true);
    if (headers.xFrameOptions !== undefined)
      addStyledRow(wsSec, ['X-Frame-Options', headers.xFrameOptions || xlMissing, headers.xFrameOptions ? xlGood : xlIssue], false, false);
    if (headers.strictTransportSecurity !== undefined)
      addStyledRow(wsSec, ['Strict-Transport-Security', headers.strictTransportSecurity ? xlPresent : xlMissing, headers.strictTransportSecurity ? xlGood : xlIssue], false, true);
  }

  // ============ FIX CODE SHEET ============
  if (typeof buildFixCards === 'function') {
    try {
      const fixCards = buildFixCards(results);
      if (fixCards && fixCards.length > 0) {
        const wsFix = wb.addWorksheet(t('seo.export.excel.sheets.fixCode', 'Fix Code'), { properties: { tabColor: { argb: COLORS.good } } });
        wsFix.columns = [{ width: 100 }];

        const fixTitle = wsFix.addRow([t('seo.export.excel.fixCode.title', 'Recommendations')]);
        applyStyle(wsFix.getCell('A1'), styles.title);
        fixTitle.height = 30;
        wsFix.addRow([t('seo.export.excel.fixCode.subtitle', 'Actionable fixes to improve your SEO score')]);
        applyStyle(wsFix.getCell('A2'), { font: { italic: true, color: { argb: COLORS.textMuted } } });
        wsFix.addRow([]);

        const xlSeverity = t('seo.export.excel.fixCode.severity', 'Severity');
        const xlCategory = t('seo.export.excel.fixCode.category', 'Category');
        const xlImpact = t('seo.export.excel.fixCode.impact', 'Impact');
        const xlCurrentIssue = t('seo.export.excel.fixCode.currentIssue', 'CURRENT ISSUE:');
        const xlRecommendedFix = t('seo.export.excel.fixCode.recommendedFix', 'RECOMMENDED FIX:');
        const xlImplementationSteps = t('seo.export.excel.fixCode.implementationSteps', 'IMPLEMENTATION STEPS:');
        const xlGeneral = t('seo.export.excel.fixCode.general', 'General');
        const xlMedium = t('seo.export.excel.fixCode.medium', 'Medium');
        const xlFix = t('seo.export.excel.fixCode.fix', 'FIX');

        fixCards.forEach((fix, index) => {
          // Fix header
          const headerRow = wsFix.addRow([`${xlFix} ${index + 1}: ${fix.title}`]);
          applyStyle(headerRow.getCell(1), {
            font: { bold: true, size: 12, color: { argb: COLORS.white } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: fix.severity === 'High' ? COLORS.bad : fix.severity === 'Medium' ? COLORS.warning : COLORS.neutral } }
          });
          headerRow.height = 24;

          wsFix.addRow([`${xlSeverity}: ${fix.severity || xlMedium} | ${xlCategory}: ${fix.category || xlGeneral}`]);
          wsFix.addRow([`${xlImpact}: ${fix.impact || ''}`]);
          wsFix.addRow([]);
          wsFix.addRow([fix.description || '']);
          wsFix.addRow([]);

          // Problem code
          const probHeader = wsFix.addRow([`❌ ${xlCurrentIssue}`]);
          applyStyle(probHeader.getCell(1), { font: { bold: true, color: { argb: COLORS.bad } } });
          (fix.problematicCode || '').split('\n').forEach(line => {
            const row = wsFix.addRow([line]);
            applyStyle(row.getCell(1), styles.codeBlock);
          });
          wsFix.addRow([]);

          // Solution code
          const solHeader = wsFix.addRow([`✅ ${xlRecommendedFix}`]);
          applyStyle(solHeader.getCell(1), { font: { bold: true, color: { argb: COLORS.good } } });
          (fix.snippet || '').split('\n').forEach(line => {
            const row = wsFix.addRow([line]);
            applyStyle(row.getCell(1), styles.codeBlock);
          });
          wsFix.addRow([]);

          // Steps
          if (fix.steps && fix.steps.length > 0) {
            const stepsHeader = wsFix.addRow([`📋 ${xlImplementationSteps}`]);
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
      window.ReportUI.toast(t('seo.export.excelExported', 'Excel exported: {{count}} sheets', { count: wb.worksheets.length }));
    }
  } catch (err) {
    console.error('Excel export error:', err);
    alert(t('seo.export.excelExportFailed', 'Failed to export Excel. Try CSV export instead.'));
  }
};

/**
 * Copy shareable link to clipboard
 */
window.copyShareLink = function() {
  const reportId = document.body.getAttribute('data-report-id') || '';
  const url = window.currentSeoResults?.url || '';

  if (!reportId) {
    alert(t('seo.share.noReport', 'No report to share. Run a scan first.'));
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

  const shareLinkCopiedMsg = t('seo.share.linkCopied', 'Share link copied to clipboard!');
  navigator.clipboard.writeText(shareUrl.toString()).then(() => {
    if (window.ReportUI?.toast) {
      window.ReportUI.toast(shareLinkCopiedMsg);
    } else {
      alert(shareLinkCopiedMsg);
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
        window.ReportUI.toast(shareLinkCopiedMsg);
      } else {
        alert(shareLinkCopiedMsg);
      }
    } catch (e) {
      alert(t('seo.share.copyFailed', 'Failed to copy link. URL:') + ' ' + shareUrl.toString());
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
    alert(t('seo.export.noResults', 'No scan results to export. Run a scan first.'));
    return;
  }

  const container = document.getElementById('seoResults');
  if (!container || container.hidden) {
    alert(t('seo.export.noResultsToExport', 'No results to export. Run a scan first.'));
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
    alert(t('seo.export.pdfNotAvailable', 'PDF export is not available. Please refresh the page.'));
  }
};
