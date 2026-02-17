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
          const _t0 = typeof t === 'function' ? t : (k, fb) => fb;
          alert(_t0('common.pdf.proRequired', 'Pro access required for PDF export.'));
        }
        return;
      }

      // CRITICAL: Save the current report to storage before PDF export
      // This ensures Puppeteer can load the same results when it renders the page
      const currentResults = window.currentSeoResults ||
                             window.currentSecurityResults ||
                             window.currentPerformanceResults ||
                             window.currentPerformanceHubResults?.data ||
                             window.currentAccessibilityResults ||
                             window.currentFontsResults ||
                             window.currentMobileResults ||
                             window.currentBrokenLinksResults ||
                             window.currentBrandResults ||
                             window.currentCompetitiveResults ||
                             window.currentCrawlerResults ||
                             window.currentTagResults ||
                             window.currentCROResults ||
                             window.__gdprCurrentData ||
                             window.currentGeoSEOResults ||
                             window.currentLocalSEOResults ||
                             window.currentCWVResults ||
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

      // Detect current locale for i18n-aware PDF export
      // Priority: localStorage (user's explicit choice) > URL path prefix > i18n state > fallback
      const SUPPORTED_LANGS = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ru'];
      const storedLang = localStorage.getItem('sm_lang');
      const urlPathParts = window.location.pathname.split('/').filter(Boolean);
      const urlLang = SUPPORTED_LANGS.includes(urlPathParts[0]) ? urlPathParts[0] : null;
      const i18nLang = (window.i18n && typeof window.i18n.getActiveLocale === 'function')
        ? window.i18n.getActiveLocale() : null;
      const currentLang = (storedLang && SUPPORTED_LANGS.includes(storedLang) ? storedLang : null)
        || urlLang || i18nLang || 'en';

      // Build URL for Puppeteer to render (with report_id, print mode, and lang prefix)
      const pageUrl = new URL(window.location.href);
      pageUrl.searchParams.set('report_id', reportId);
      pageUrl.searchParams.set('print', '1');
      // Ensure language prefix in path (e.g., /ja/security-analyzer.html)
      const pathParts = pageUrl.pathname.split('/').filter(Boolean);
      if (!SUPPORTED_LANGS.includes(pathParts[0])) {
        pageUrl.pathname = `/${currentLang}${pageUrl.pathname}`;
      } else if (pathParts[0] !== currentLang) {
        // URL has a different language prefix than the active language — update it
        pathParts[0] = currentLang;
        pageUrl.pathname = '/' + pathParts.join('/');
      }

      const analyzedUrlValue = getAnalyzedUrl();
      console.log('[PDF Export] Sending to server:', {
        reportType: reportType,
        reportId: reportId,
        pageUrl: pageUrl.pathname + pageUrl.search,
        hasReportData: !!currentResults,
        reportDataKeys: currentResults ? Object.keys(currentResults).slice(0, 5) : [],
        analyzedUrl: analyzedUrlValue
      });

      // Unwrap API response wrapper if present: { success, results: {...actualData...} }
      // Some analyzers store the full API response in window.current*Results
      let unwrappedResults = currentResults;
      if (currentResults && currentResults.results && typeof currentResults.results === 'object' && !Array.isArray(currentResults.results)) {
        const inner = currentResults.results;
        const looksLikeWrapper = currentResults.success !== undefined ||
          inner.desktop !== undefined || inner.mobile !== undefined ||
          inner.performanceScore !== undefined || inner.overallScore !== undefined ||
          inner.score !== undefined || inner.metaTags !== undefined ||
          inner.ssl !== undefined || inner.headers !== undefined ||
          inner.mobileScore !== undefined || inner.devices !== undefined;
        if (looksLikeWrapper) {
          console.log('[PDF Export] Unwrapping API response wrapper before PDF generation');
          unwrappedResults = { ...inner };
          // Preserve metadata from wrapper
          if (!unwrappedResults.url && currentResults.url) unwrappedResults.url = currentResults.url;
          if (!unwrappedResults.reportId && currentResults.reportId) unwrappedResults.reportId = currentResults.reportId;
          if (!unwrappedResults.screenshotUrl && currentResults.screenshotUrl) unwrappedResults.screenshotUrl = currentResults.screenshotUrl;
        }
      }

      // Prepare report data with all necessary fields for PDF generation
      const pdfReportData = {
        ...unwrappedResults,
        reportId: reportId,
        url: analyzedUrlValue,
        normalizedUrl: analyzedUrlValue,
        scanStartedAt: document.body.getAttribute('data-sm-scan-started-at') ||
                       window.SM_SCAN_STARTED_AT ||
                       unwrappedResults?.scanStartedAt ||
                       unwrappedResults?.timestamp ||
                       new Date().toISOString()
      };

      // ── Issue 1: Ensure screenshotUrl is present ──
      // The PDF exec summary renders a screenshot if data.screenshotUrl exists,
      // but many report types (especially CWV) don't include it in the API response.
      // Fall back to the body data-attribute set by the page script, or construct
      // a conventional path from the reportId.
      if (!pdfReportData.screenshotUrl) {
        const bodyScreenshot = document.body.getAttribute('data-sm-screenshot-url');
        if (bodyScreenshot) {
          pdfReportData.screenshotUrl = bodyScreenshot;
          console.log('[PDF Export] Enriched screenshotUrl from body attr:', bodyScreenshot);
        } else if (reportId) {
          pdfReportData.screenshotUrl = `/reports/${encodeURIComponent(reportId)}/screenshot.jpg`;
          console.log('[PDF Export] Enriched screenshotUrl from reportId fallback:', pdfReportData.screenshotUrl);
        }
      } else {
        console.log('[PDF Export] screenshotUrl already present:', pdfReportData.screenshotUrl);
      }

      // ── Issue 2: Enrich with rich fix data from browser-side generators ──
      // The page may have loaded fix-renderer scripts that expose global generator
      // functions. These produce rich fix objects (title, subtitle, severity, impact,
      // summary, problematicCode, fixedCode, resources[], steps[], category) that
      // the PDF template can render instead of the simple API recommendations array.
      try {
        // --- Performance enriched fixes ---
        if (typeof generateFixesData === 'function') {
          // Locate desktop/mobile device data from whichever results global is set.
          // Performance-hub stores { mode, url, data: { desktop, mobile, ... } }.
          // CWV stores { desktop, mobile, ... } directly.
          const perfSource = window.currentPerformanceHubResults?.data ||
                             window.currentCWVResults ||
                             window.currentPerformanceResults?.results ||
                             window.currentPerformanceResults ||
                             unwrappedResults;

          const rawDesktop = perfSource?.desktop || {};
          const rawMobile  = perfSource?.mobile  || {};

          // Normalize CWV-shape data (where desktop.lcp is an object with .value)
          // into the flat coreWebVitals shape that generateFixesData expects.
          // normalizeCWVDevice is scoped inside performance-hub-script.js and is NOT
          // a global, so we inline a lightweight normalizer here.
          const normalizePerfDevice = (device) => {
            // If the device already has coreWebVitals with numeric lcpMs, it's
            // already in the "Full" normalized shape — return as-is.
            if (device.coreWebVitals && typeof device.coreWebVitals.lcpMs === 'number') {
              return device;
            }
            // CWV shape: device.lcp may be an object { value, displayValue, ... }
            const pick = (candidates) => {
              for (const c of candidates) {
                if (c === null || c === undefined) continue;
                if (typeof c === 'number' && Number.isFinite(c)) return c;
                if (typeof c === 'string') {
                  const trimmed = c.trim();
                  if (trimmed.endsWith('ms')) { const n = parseFloat(trimmed); if (!Number.isNaN(n)) return n; }
                  if (trimmed.endsWith('s'))  { const n = parseFloat(trimmed); if (!Number.isNaN(n)) return n * 1000; }
                  const n = parseFloat(trimmed);
                  if (!Number.isNaN(n)) return n;
                }
              }
              return null;
            };
            const cwv = device.coreWebVitals || {};
            const addl = device.additionalMetrics || {};
            return {
              ...device,
              coreWebVitals: {
                lcpMs: pick([cwv.lcpMs, cwv.lcp, device.lcp?.value, device.lcp?.numericValue, device.lcp, addl.lcp?.value]),
                lcp:   device.lcp?.displayValue || cwv.lcp || null,
                clsNum: pick([cwv.clsNum, cwv.cls, device.cls?.value, device.cls?.numericValue, device.cls, addl.cls?.value]),
                cls:   device.cls?.displayValue || cwv.cls || null,
                inpMs: pick([cwv.inpMs, cwv.inp, cwv.fidMs, cwv.fid, cwv.tbt,
                             device.inp?.value, device.inp?.numericValue,
                             device.fid?.value, device.fid?.numericValue,
                             device.inp, device.fid, addl.tbt?.value, addl.fid?.value]),
                fcpMs: pick([cwv.fcpMs, cwv.fcp, device.fcp?.value, device.fcp?.numericValue, device.fcp, addl.fcp?.value])
              },
              lighthouse: device.lighthouse || {}
            };
          };

          const desktop = normalizePerfDevice(rawDesktop);
          const mobile  = normalizePerfDevice(rawMobile);
          const perfFixes = generateFixesData(desktop, mobile);

          if (perfFixes && perfFixes.length > 0) {
            pdfReportData.enrichedFixes = pdfReportData.enrichedFixes || {};
            pdfReportData.enrichedFixes.performance = perfFixes;
            console.log('[PDF Export] Enriched performance fixes:', perfFixes.length);
          }
        }

        // --- Security enriched fixes ---
        if (typeof generateSecurityFixesData === 'function') {
          const secSource = window.currentSecurityResults || unwrappedResults;
          const recs = secSource?.recommendations || unwrappedResults?.recommendations;
          if (recs && recs.length > 0) {
            const secFixes = generateSecurityFixesData(recs, secSource);
            if (secFixes && secFixes.length > 0) {
              pdfReportData.enrichedFixes = pdfReportData.enrichedFixes || {};
              pdfReportData.enrichedFixes.security = secFixes;
              console.log('[PDF Export] Enriched security fixes:', secFixes.length);
            }
          }
        }

        // --- Accessibility enriched fixes (future-proof) ---
        if (typeof renderAccessibilityFixes === 'function') {
          const a11ySource = window.currentAccessibilityResults || unwrappedResults;
          if (a11ySource) {
            try {
              const a11yFixes = renderAccessibilityFixes(a11ySource);
              if (a11yFixes && a11yFixes.length > 0) {
                pdfReportData.enrichedFixes = pdfReportData.enrichedFixes || {};
                pdfReportData.enrichedFixes.accessibility = a11yFixes;
                console.log('[PDF Export] Enriched accessibility fixes:', a11yFixes.length);
              }
            } catch (a11yErr) {
              console.warn('[PDF Export] Accessibility fix enrichment failed:', a11yErr);
            }
          }
        }
      } catch (enrichErr) {
        console.warn('[PDF Export] Fix enrichment failed (non-fatal):', enrichErr);
        // Non-fatal: the PDF will still generate with the simple recommendations array
      }

      // Check if we have session-verified access (from recent payment)
      const sessionPaymentMarker = sessionStorage.getItem('sm_payment_completed_session');
      const hasSessionVerifiedAccess = sessionPaymentMarker &&
        (Date.now() - parseInt(sessionPaymentMarker, 10) < 30 * 60 * 1000); // Within 30 min

      // Get the checkout session ID if available (for fallback verification)
      const checkoutSessionId = sessionStorage.getItem('sm_last_checkout_session_id') || '';

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      };

      // Pass session verification info to server for fallback access check
      if (hasSessionVerifiedAccess) {
        headers['X-Session-Verified'] = 'true';
        if (checkoutSessionId) {
          headers['X-Checkout-Session-Id'] = checkoutSessionId;
        }
        console.log('[PDF Export] Including session verification headers');
      }

      const response = await fetch('/api/pdf/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reportType: reportType,
          reportData: pdfReportData,
          pageUrl: pageUrl.pathname + pageUrl.search,
          preferBrowser: true,
          lang: currentLang
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
            const _t1 = typeof t === 'function' ? t : (k, fb) => fb;
            alert(errorData.message || _t1('common.pdf.proRequired', 'Pro access required for PDF export.'));
          }
          return;
        }

        const _t2b = typeof t === 'function' ? t : (k, fb) => fb;
        throw new Error(errorData.error || errorData.message || _t2b('common.pdf.generateFailed', 'Failed to generate PDF'));
      }

      // Download the PDF
      const blob = await response.blob();
      const url = getAnalyzedUrl();
      const hostname = url ? new URL(url).hostname : 'report';
      const timestamp = new Date().toISOString().split('T')[0];
      // Use correct casing for acronym report types
      const REPORT_TYPE_LABELS = {
        seo: 'SEO', cro: 'CRO', gdpr: 'GDPR', cwv: 'CWV',
        'core-web-vitals': 'Core-Web-Vitals',
        'tag-intelligence': 'Tag-Intelligence', 'geo-seo': 'GEO-SEO', 'local-seo': 'Local-SEO',
        'broken-links': 'Broken-Links', 'ip-reputation': 'IP-Reputation',
        'competitive': 'Competitive'
      };
      const typeLabel = REPORT_TYPE_LABELS[reportType] ||
        reportType.charAt(0).toUpperCase() + reportType.slice(1);
      const filename = `${typeLabel}-report-${hostname}-${timestamp}.pdf`;

      downloadBlob(blob, filename);

      // Show success message
      if (window.ReportUI?.toast) {
        const _t2 = typeof t === 'function' ? t : (k, fb) => fb;
        window.ReportUI.toast(_t2('common.pdf.downloadSuccess', 'PDF downloaded successfully!'));
      }

    } catch (error) {
      console.error('PDF export error:', error);
      const _t3 = typeof t === 'function' ? t : (k, fb) => fb;
      const errMsg = error.message || _t3('common.pdf.exportFailedGeneric', 'Unknown error. Please try again.');
      alert(_t3('common.pdf.exportFailed', 'Failed to generate PDF: {{error}}').replace('{{error}}', errMsg));
    } finally {
      setButtonLoading(buttonElement, false, originalButtonState);
      activeExportPromise = null;
    }
    })();

    return activeExportPromise;
  }

  /**
   * Check if user has access to export (Pro subscription or purchased report)
   * Uses server verification for critical export decisions
   */
  async function checkExportAccess(reportId) {
    console.log('[PDF Export] checkExportAccess called with reportId:', reportId);
    console.log('[PDF Export] data-report-id attr:', document.body.getAttribute('data-report-id'));
    console.log('[PDF Export] URL report_id param:', new URLSearchParams(window.location.search).get('report_id'));

    // Demo domain auto-unlock removed - use ProReportBlock.hasAccess() for all access checks

    // First try local hasAccess check (includes session-verified purchases)
    // This handles the case right after payment return when server may not have synced yet
    if (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function') {
      const localAccess = window.ProReportBlock.hasAccess(reportId);
      console.log('[PDF Export] Local hasAccess check:', { reportId, localAccess });
      if (localAccess) {
        console.log('[PDF Export] Access granted via local check');
        return true;
      }
    }

    // Use server-verified access check for critical export operations
    // This ensures we have the most up-to-date entitlement status
    if (window.ProReportBlock && typeof window.ProReportBlock.verifyAccessViaServer === 'function') {
      try {
        // Force refresh to get latest server state
        const serverResult = await window.ProReportBlock.verifyAccessViaServer(reportId, true);
        console.log('[PDF Export] Server-verified access check:', { reportId, serverResult });
        if (serverResult.canExport || serverResult.canViewPro) {
          console.log('[PDF Export] Access granted via server check');
          return true;
        }
      } catch (error) {
        console.warn('[PDF Export] Server access check failed:', error);
      }
    }

    // Final fallback: Fetch billing status directly (same endpoint PricingModal uses)
    // This handles edge cases where the check-access endpoint fails but billing status works
    try {
      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      if (token && reportId) {
        console.log('[PDF Export] Trying billing status fallback...');
        const resp = await fetch('/api/billing/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (resp.ok) {
          const billing = await resp.json();
          console.log('[PDF Export] Billing status fallback:', {
            plan: billing.plan,
            purchasedReports: billing.purchasedReports,
            reportId
          });
          if (billing.plan === 'pro' || billing.plan === 'day_pass') {
            console.log('[PDF Export] Access granted via billing status (pro/day_pass)');
            return true;
          }
          if (billing.purchasedReports && billing.purchasedReports.includes(reportId)) {
            console.log('[PDF Export] Access granted via billing status (purchased report)');
            return true;
          }
        }
      }
    } catch (error) {
      console.warn('[PDF Export] Billing status fallback failed:', error);
    }

    console.log('[PDF Export] Access denied - no valid access found');
    return false;
  }

  /**
   * Detect report type from current page
   * Valid types for PDF generation: seo, performance, core-web-vitals, accessibility, security, fonts, tag-intelligence, competitive, etc.
   */
  function detectReportType() {
    const path = window.location.pathname.toLowerCase();
    const pageAttr = document.body.getAttribute('data-page');
    const analyzerKey = document.body.getAttribute('data-sm-analyzer-key');

    // Map of page names/paths to valid PDF report types
    const reportTypeMap = {
      'performance-hub': 'performance',
      'performance': 'performance',
      'speed-ux': 'performance',
      'cwv': 'core-web-vitals',
      'core-web-vitals': 'core-web-vitals',
      'seo': 'seo',
      'seo-analyzer': 'seo',
      'security': 'security',
      'security-analyzer': 'security',
      'accessibility': 'accessibility',
      'accessibility-analyzer': 'accessibility',
      'fonts': 'fonts',
      'font-scanner': 'fonts',
      'enhanced-fonts': 'fonts',
      'tag-intelligence': 'tag-intelligence',
      'competitive-analysis': 'competitive',
      'competitive': 'competitive',
      'gdpr': 'gdpr',
      'gdpr-compliance': 'gdpr',
      'mobile': 'mobile',
      'mobile-analyzer': 'mobile',
      'cro': 'cro',
      'cro-analyzer': 'cro',
      'hosting': 'hosting',
      'hosting-analyzer': 'hosting',
      'broken-links': 'broken-links',
      'geo-seo': 'geo-seo',
      'local-seo': 'geo-seo',
      'ip-reputation': 'ip-reputation',
      'brand-consistency': 'brand-consistency',
      'site-crawler': 'site-crawler'
    };

    // Check analyzer key first (most reliable)
    if (analyzerKey) {
      const normalizedType = reportTypeMap[analyzerKey.toLowerCase()];
      if (normalizedType) return normalizedType;
    }

    // Check page attribute
    if (pageAttr) {
      const normalizedType = reportTypeMap[pageAttr.toLowerCase()];
      if (normalizedType) return normalizedType;
    }

    // Fallback to path-based detection
    if (path.includes('seo')) return 'seo';
    if (path.includes('cwv') || path.includes('core-web-vitals')) return 'core-web-vitals';
    if (path.includes('performance') || path.includes('speed')) return 'performance';
    if (path.includes('security')) return 'security';
    if (path.includes('accessibility') || path.includes('a11y')) return 'accessibility';
    if (path.includes('font')) return 'fonts';
    if (path.includes('tag-intelligence')) return 'tag-intelligence';
    if (path.includes('competitive')) return 'competitive';
    if (path.includes('gdpr')) return 'gdpr';
    if (path.includes('mobile')) return 'mobile';
    if (path.includes('cro')) return 'cro';
    if (path.includes('hosting')) return 'hosting';
    if (path.includes('broken-link')) return 'broken-links';
    if (path.includes('geo-seo') || path.includes('local-seo')) return 'geo-seo';
    if (path.includes('ip-reputation')) return 'ip-reputation';
    if (path.includes('brand')) return 'brand-consistency';
    if (path.includes('crawler')) return 'site-crawler';

    // Default to performance (most common)
    console.warn('[PDF Export] Could not detect report type, defaulting to performance');
    return 'performance';
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
        const _t = typeof t === 'function' ? t : (k, fb) => fb;
        overlay.innerHTML = `
          <div class="pdf-generating-spinner"></div>
          <div class="pdf-generating-text">
            ${_t('common.pdf.generating', 'Generating PDF')}
            <div class="pdf-generating-subtext">${_t('common.pdf.creatingReport', 'Creating client-ready report...')}</div>
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
        const _tInline = typeof t === 'function' ? t : (k, fb) => fb;
        inlineLoader.innerHTML = `
          <span class="pdf-inline-spinner"></span>
          <span>${_tInline('common.pdf.generatingShort', 'Generating...')}</span>
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
