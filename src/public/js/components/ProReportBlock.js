/**
 * Site Mechanic - Pro Report Block Component
 * Conversion-focused export & upgrade CTA
 *
 * New billing model:
 * - Pro subscription ($30/mo or $240/yr) - unlocks all reports
 * - Day Pass ($20) - unlocks all reports for 8 hours
 * - Single report purchase ($5) - unlocks specific report
 */

(function(window) {
  // i18n helper: falls back to provided fallback when translation key is missing
  function _t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const val = window.i18n.t(key);
      return (val === key && fallback) ? fallback : val;
    }
    return fallback || key;
  }

  // Stripe logo SVG for payment branding (adapts via currentColor)
  const STRIPE_LOGO_SVG = `<svg class="pro-report-block__stripe-logo" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M60 12.8C60 8.55 57.95 5.2 54 5.2C50.05 5.2 47.6 8.55 47.6 12.75C47.6 17.7 50.5 20.35 54.65 20.35C56.7 20.35 58.25 19.85 59.45 19.1V15.85C58.25 16.55 56.85 17 55.1 17C53.4 17 51.9 16.35 51.7 14.25H59.95C59.95 14.05 60 13.15 60 12.8ZM51.65 11.35C51.65 9.35 52.85 8.45 54 8.45C55.1 8.45 56.25 9.35 56.25 11.35H51.65ZM41.2 5.2C39.45 5.2 38.35 6 37.75 6.5L37.55 5.45H33.9V24.55L38 23.7V19.95C38.6 20.35 39.5 20.9 41.15 20.9C44.55 20.9 47.6 18.3 47.6 12.85C47.55 7.85 44.45 5.2 41.2 5.2ZM40.3 17.05C39.15 17.05 38.5 16.65 38.05 16.15L38 9.55C38.5 9 39.2 8.6 40.3 8.6C42.1 8.6 43.35 10.55 43.35 12.85C43.35 15.2 42.1 17.05 40.3 17.05ZM28.05 4.3L32.2 3.45V0L28.05 0.85V4.3ZM32.2 5.45H28.05V20.6H32.2V5.45ZM23.65 6.7L23.4 5.45H19.8V20.6H23.9V10.1C24.85 8.85 26.45 9.1 26.95 9.25V5.45C26.4 5.25 24.6 4.9 23.65 6.7ZM15.4 1.8L11.4 2.65L11.35 16.35C11.35 18.65 13.1 20.4 15.4 20.4C16.65 20.4 17.55 20.2 18.05 19.9V16.55C17.55 16.75 15.35 17.4 15.35 15.1V8.8H18.05V5.45H15.35L15.4 1.8ZM4.15 9.9C4.15 9.2 4.75 8.9 5.7 8.9C7.05 8.9 8.75 9.3 10.1 10.05V6.2C8.65 5.6 7.2 5.35 5.7 5.35C2.3 5.35 0 7.2 0 10.1C0 14.7 6.35 13.95 6.35 15.95C6.35 16.8 5.6 17.1 4.6 17.1C3.1 17.1 1.2 16.5 0.2 15.55V19.5C1.55 20.1 2.95 20.4 4.6 20.4C8.1 20.4 10.55 18.6 10.55 15.65C10.5 10.65 4.15 11.55 4.15 9.9Z" fill="currentColor"/>
  </svg>`;

  // Cache billing status to avoid repeated API calls
  let cachedBillingStatus = null;
  let billingStatusPromise = null;

  // Cache for server-verified access checks
  const accessCheckCache = new Map();
  const ACCESS_CACHE_TTL = 60000; // 1 minute cache for access checks

  /**
   * Fetch billing status from API (with caching)
   * @param {boolean} forceRefresh - If true, bypasses cache and fetches fresh data
   */
  async function fetchBillingStatus(forceRefresh = false) {
    if (forceRefresh) {
      console.log('[ProReportBlock] Force refreshing billing status');
      // IMPORTANT: Do NOT null out cachedBillingStatus here.
      // Keep stale data available for synchronous hasAccess() calls
      // that may run before the new fetch resolves. This prevents
      // race conditions where event handlers clear the cache and
      // then other synchronous code sees null and denies access.
      billingStatusPromise = null;
    }

    // Return cached data only when NOT force-refreshing
    if (!forceRefresh && cachedBillingStatus) return cachedBillingStatus;
    if (billingStatusPromise) return billingStatusPromise;

    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    if (!token) {
      console.log('[ProReportBlock] No auth token, skipping billing status fetch');
      return null;
    }

    console.log('[ProReportBlock] Fetching billing status from API...');
    billingStatusPromise = fetch('/api/billing/status', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => {
        if (!r.ok) {
          console.warn('[ProReportBlock] Billing status fetch failed:', r.status);
          return null;
        }
        return r.json();
      })
      .then(data => {
        cachedBillingStatus = data;
        billingStatusPromise = null;
        console.log('[ProReportBlock] Billing status fetched:', {
          plan: data?.plan,
          isPro: data?.plan === 'pro' || data?.plan === 'day_pass',
          purchasedReportsCount: data?.purchasedReports?.length || 0,
          purchasedReports: data?.purchasedReports || []
        });

        // Dispatch event so other components (like UsagePill) can refresh
        window.dispatchEvent(new CustomEvent('entitlements:updated', { detail: data }));

        // Also update global cache for backward compatibility
        window.__cachedBillingStatus = data;

        return data;
      })
      .catch((err) => {
        console.error('[ProReportBlock] Billing status fetch error:', err);
        billingStatusPromise = null;
        return null;
      });

    return billingStatusPromise;
  }

  /**
   * Clear cached billing status (call after purchase)
   */
  function clearBillingCache() {
    cachedBillingStatus = null;
    billingStatusPromise = null;
    accessCheckCache.clear();
  }

  /**
   * Verify access for a specific report via server API
   * This is the most reliable access check as it uses the server as source of truth.
   *
   * @param {string} reportId - The report ID to check access for
   * @param {boolean} forceRefresh - Bypass cache and fetch fresh data
   * @returns {Promise<Object>} Access result with canViewPro, canExport, reason
   */
  async function verifyAccessViaServer(reportId, forceRefresh = false) {
    if (!reportId) {
      console.log('[ProReportBlock] verifyAccessViaServer: No reportId provided');
      return { canViewPro: false, canExport: false, reason: 'no_report_id' };
    }

    // Check cache first (unless force refresh)
    const cacheKey = reportId;
    if (!forceRefresh && accessCheckCache.has(cacheKey)) {
      const cached = accessCheckCache.get(cacheKey);
      if (Date.now() - cached.timestamp < ACCESS_CACHE_TTL) {
        console.log('[ProReportBlock] verifyAccessViaServer: Using cached result', cached.result);
        return cached.result;
      }
      accessCheckCache.delete(cacheKey);
    }

    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      console.log('[ProReportBlock] verifyAccessViaServer: Checking with server', { reportId });
      const response = await fetch(`/api/auth/check-access?reportId=${encodeURIComponent(reportId)}`, {
        headers
      });

      if (!response.ok) {
        console.warn('[ProReportBlock] verifyAccessViaServer: Server returned error', response.status);
        return { canViewPro: false, canExport: false, reason: 'server_error' };
      }

      const result = await response.json();
      console.log('[ProReportBlock] verifyAccessViaServer: Server result', result);

      // Cache the result
      accessCheckCache.set(cacheKey, {
        timestamp: Date.now(),
        result
      });

      return result;
    } catch (error) {
      console.error('[ProReportBlock] verifyAccessViaServer: Fetch error', error);
      return { canViewPro: false, canExport: false, reason: 'fetch_error' };
    }
  }

  /**
   * Check if user has Pro subscription or Day Pass (full Pro access)
   * Only trusts server-side billing status, not client-side localStorage
   * NOTE: Demo domain check is NOT done here - it must be done in hasAccess()
   * with the specific domain being analyzed to avoid stale context issues
   */
  function isProSubscriber() {
    // SECURITY: First verify user still has a valid auth token
    // The cached billing status becomes invalid when user logs out
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    if (!token) {
      // No token = user is not logged in, clear any stale cache
      if (cachedBillingStatus) {
        console.log('[ProReportBlock] isProSubscriber: Clearing stale cache (no auth token)');
        cachedBillingStatus = null;
        billingStatusPromise = null;
      }
      console.log('[ProReportBlock] isProSubscriber: FALSE (no auth token)');
      return false;
    }

    console.log('[ProReportBlock] isProSubscriber checking cachedBillingStatus:', {
      exists: !!cachedBillingStatus,
      permissions: cachedBillingStatus?.permissions,
      plan: cachedBillingStatus?.plan
    });

    // Use server-derived permissions if available (new format)
    if (cachedBillingStatus?.permissions?.accessProTools) {
      console.log('[ProReportBlock] isProSubscriber: TRUE (permissions.accessProTools)');
      return true;
    }

    // Fallback: check plan directly for backwards compatibility
    const plan = cachedBillingStatus?.plan;
    if (plan === 'pro' || plan === 'day_pass') {
      // For day_pass, also verify it hasn't expired
      if (plan === 'day_pass' && cachedBillingStatus?.dayPassExpiresAt) {
        const expiresAt = new Date(cachedBillingStatus.dayPassExpiresAt);
        if (expiresAt < new Date()) {
          console.log('[ProReportBlock] isProSubscriber: FALSE (day pass expired)');
          return false;
        }
      }
      console.log('[ProReportBlock] isProSubscriber: TRUE (plan=' + plan + ')');
      return true;
    }

    // Note: Demo domain check removed from here - was causing false positives
    // due to stale ScanContext. Demo domains are now only checked in hasAccess()
    // where we explicitly verify the domain being analyzed.

    // Note: Removed legacy localStorage checks (proManager, ProGate) for security
    // Subscription status must come from server via fetchBillingStatus()

    console.log('[ProReportBlock] isProSubscriber: FALSE', {
      cachedBillingStatus: cachedBillingStatus ? 'exists' : 'null',
      plan: cachedBillingStatus?.plan || 'none'
    });
    return false;
  }

  /**
   * Check if specific report is purchased
   */
  function isReportPurchased(reportId) {
    if (!reportId || !cachedBillingStatus) {
      console.log('[ProReportBlock] isReportPurchased:', { reportId, hasCachedStatus: !!cachedBillingStatus });
      return false;
    }
    const purchased = cachedBillingStatus.purchasedReports || [];
    const isPurchased = purchased.includes(reportId);
    console.log('[ProReportBlock] isReportPurchased:', { reportId, purchasedReports: purchased, isPurchased });
    return isPurchased;
  }

  /**
   * Check if the current report was just purchased in THIS SESSION
   * This handles the brief window where user just returned from Stripe payment
   * and the server-side billing status hasn't been updated yet (webhook delay).
   *
   * SECURITY: This function ONLY grants access if:
   * 1. There's a recent session payment marker (within 10 minutes)
   * 2. The purchased reportId stored in sessionStorage matches the current reportId
   *
   * This is a narrow fallback for webhook delays, not a general access mechanism.
   */
  function isReportTypePurchasedLocally() {
    // Get the current reportId - this is REQUIRED for any local purchase check
    let currentReportId = document.body?.getAttribute('data-report-id') || '';
    if (!currentReportId) {
      const params = new URLSearchParams(window.location.search);
      currentReportId = params.get('report_id') || params.get('reportId') || '';
    }

    if (!currentReportId) {
      console.log('[ProReportBlock] isReportTypePurchasedLocally: FALSE (no current reportId)');
      return false;
    }

    // Check for session-verified purchase marker
    const sessionPaymentMarker = sessionStorage.getItem('sm_payment_completed_session');
    if (!sessionPaymentMarker) {
      console.log('[ProReportBlock] isReportTypePurchasedLocally: FALSE (no session marker)');
      return false;
    }

    // SECURITY: Session marker must be recent (within last 10 minutes, not 30)
    // This is only meant to bridge the webhook delay, not provide extended access
    const markerTimestamp = parseInt(sessionPaymentMarker, 10);
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    if (isNaN(markerTimestamp) || markerTimestamp < tenMinutesAgo) {
      console.log('[ProReportBlock] isReportTypePurchasedLocally: FALSE (session marker expired)', {
        markerTimestamp,
        ageMinutes: isNaN(markerTimestamp) ? 'invalid' : Math.round((Date.now() - markerTimestamp) / 60000)
      });
      // Clear the expired session marker
      sessionStorage.removeItem('sm_payment_completed_session');
      sessionStorage.removeItem('sm_purchased_report_id');
      return false;
    }

    // CRITICAL: Check if the purchased reportId matches the current reportId
    const purchasedReportId = sessionStorage.getItem('sm_purchased_report_id');
    if (!purchasedReportId) {
      console.log('[ProReportBlock] isReportTypePurchasedLocally: FALSE (no purchased reportId in session)');
      return false;
    }

    if (purchasedReportId !== currentReportId) {
      console.log('[ProReportBlock] isReportTypePurchasedLocally: FALSE (reportId mismatch)', {
        purchasedReportId,
        currentReportId
      });
      return false;
    }

    console.log('[ProReportBlock] isReportTypePurchasedLocally: TRUE (session-verified purchase for this reportId)', {
      reportId: currentReportId,
      markerAgeMinutes: Math.round((Date.now() - markerTimestamp) / 60000)
    });
    return true;
  }

  /**
   * Check if user has access to a report (Pro OR purchased OR demo domain)
   * If no reportId is provided, falls back to the current report from body attribute
   *
   * SECURITY: This function defaults to FALSE (locked) and only returns TRUE
   * when there is explicit, verified proof of access.
   */
  function hasAccess(reportId) {
    // Version marker for debugging cache issues - UPDATE THIS WHEN CHANGING CODE
    const VERSION = '20260210-remove-flag-gate';
    console.log('[ProReportBlock] hasAccess v' + VERSION + ' called with reportId:', reportId);

    // NOTE: __SM_FRESH_SCAN_PENDING_PAYMENT__ flag is NO LONGER used as an early gate.
    // It was causing Day Pass / Pro users to see locked sections when the billing
    // API fetch hadn't completed yet (race condition). The flag is redundant because:
    // - Free users: isProSubscriber()=false already locks sections
    // - Pro/DayPass: isProSubscriber()=true already unlocks sections
    // - Purchased reports: isReportPurchased() checks server data
    // The flag remains set/cleared elsewhere for backward compat but is not checked here.

    // Check 1: Is user a Pro subscriber? (server-verified, requires auth token)
    const isProSub = isProSubscriber();
    console.log('[ProReportBlock] isProSubscriber check:', isProSub, '(type: ' + typeof isProSub + ')');
    if (isProSub === true) {
      console.log('[ProReportBlock] hasAccess: TRUE via isProSubscriber');
      return true;
    }

    // Check 2: Just completed payment in THIS session (session marker required)
    // This handles the case where user just paid and returned from Stripe
    // The session marker proves they went through payment flow in this browser session
    const localPurchase = isReportTypePurchasedLocally();
    console.log('[ProReportBlock] isReportTypePurchasedLocally check:', localPurchase, '(type: ' + typeof localPurchase + ')');
    if (localPurchase === true) {
      console.log('[ProReportBlock] hasAccess: TRUE via session-verified purchase');
      return true;
    }

    // Check 3: Demo domains (for testing/demos only)
    // 1. Body attribute (if explicitly set by page)
    // 2. URL input field (what user is currently analyzing)
    // 3. ScanContext (last scan, but could be stale)
    let currentDomain = document.body?.getAttribute('data-scan-domain') || '';

    // Try URL input field - most reliable for current analysis
    if (!currentDomain) {
      try {
        const urlInput = document.getElementById('url') || document.getElementById('urlInput');
        if (urlInput && urlInput.value) {
          const urlValue = urlInput.value.startsWith('http') ? urlInput.value : 'https://' + urlInput.value;
          currentDomain = new URL(urlValue).hostname.toLowerCase();
        }
      } catch (e) {
        // URL parsing failed, continue to next source
      }
    }

    // Fall back to ScanContext (may be stale for returning from billing)
    if (!currentDomain && window.ScanContext) {
      currentDomain = window.ScanContext.getDomain() || '';
    }

    console.log('[ProReportBlock] hasAccess domain check:', { currentDomain, source: document.body?.getAttribute('data-scan-domain') ? 'body' : document.getElementById('url')?.value ? 'urlInput' : 'scanContext' });

    // Check 3: Demo domains (for testing/demos only)
    // SECURITY: Strictly check for explicit true return, not just truthy
    const isDemoResult = currentDomain && window.ProAccess?.isDemoDomain?.(currentDomain);
    console.log('[ProReportBlock] isDemoDomain check:', { currentDomain, isDemoResult, demoDomains: window.ProAccess?.DEMO_DOMAINS });
    if (isDemoResult === true) {
      console.log('[ProReportBlock] hasAccess: TRUE via demo domain', { currentDomain });
      return true;
    }

    // If no reportId provided, try to get from body attribute or URL
    let effectiveReportId = reportId;
    if (!effectiveReportId) {
      effectiveReportId = document.body?.getAttribute('data-report-id') || '';
    }
    if (!effectiveReportId) {
      const params = new URLSearchParams(window.location.search);
      effectiveReportId = params.get('report_id') || params.get('reportId') || '';
    }

    // Check 4: Server-verified report purchase
    const isPurchased = effectiveReportId ? isReportPurchased(effectiveReportId) : false;
    console.log('[ProReportBlock] isReportPurchased check:', isPurchased, '(reportId:', effectiveReportId, ')');
    if (isPurchased === true) {
      console.log('[ProReportBlock] hasAccess: TRUE via purchased report');
      return true;
    }

    // SECURITY: Default to FALSE - no access unless explicitly granted above
    console.log('[ProReportBlock] hasAccess: FALSE (no valid access proof)', {
      reportId: effectiveReportId,
      currentDomain,
      hasCachedStatus: !!cachedBillingStatus
    });
    return false;
  }

  /**
   * Async access check that verifies with server for critical operations
   * Use this for export, PDF generation, and other operations where
   * we need to be certain about access status.
   *
   * @param {string} reportId - Report ID to check
   * @param {boolean} preferServer - If true, always check with server (default: true)
   * @returns {Promise<boolean>} Whether user has access
   */
  async function hasAccessAsync(reportId, preferServer = true) {
    // Quick local check first - this includes session-verified purchases
    const localAccess = hasAccess(reportId);
    console.log('[ProReportBlock] hasAccessAsync: Local check result', { reportId, localAccess });

    // If local check passes, user has access (trust session markers after payment)
    if (localAccess) {
      console.log('[ProReportBlock] hasAccessAsync: Access granted via local check');
      return true;
    }

    // If no local access but we prefer server check, verify with server
    if (preferServer) {
      try {
        // Force refresh to bypass cache and get latest server state
        const serverResult = await verifyAccessViaServer(reportId, true);
        console.log('[ProReportBlock] hasAccessAsync: Server verification result', {
          reportId,
          localAccess,
          serverAccess: serverResult.canViewPro
        });
        return serverResult.canViewPro;
      } catch (error) {
        console.warn('[ProReportBlock] hasAccessAsync: Server check failed', error);
      }
    }

    return false;
  }

  /**
   * Render the unlock prompt for locked reports
   */
  function renderUnlockPrompt(options = {}) {
    const { context = 'report', reportId = null } = options;

    return `
      <div class="pro-report-block__unlock-prompt" data-locked-overlay>
        <div class="pro-report-block__unlock-header">
          <span class="pro-report-block__unlock-icon">🔒</span>
          <span class="pro-report-block__unlock-text">${_t('reports.common.unlockThisReport', 'Unlock this report')}</span>
        </div>
        <div class="pro-report-block__unlock-buttons">
          <button
            class="pro-report-block__unlock-btn pro-report-block__unlock-btn--primary"
            data-buy-single-report
            data-context="${context}"
            ${reportId ? `data-report-id="${reportId}"` : ''}
          >
            ${_t('reports.common.unlockFor5', 'Unlock for $5')}
          </button>
          <button
            class="pro-report-block__unlock-btn pro-report-block__unlock-btn--secondary"
            data-open-pricing-modal
            data-context="${context}"
          >
            ${_t('reports.common.goPro30', 'Go Pro — $30/mo')}
          </button>
        </div>
        <p class="pro-report-block__unlock-hint">
          ${_t('reports.common.proUnlocksAll', 'Pro unlocks all reports. Single purchase unlocks only this scan.')}
        </p>
        <div class="pro-report-block__stripe-badge">
          ${STRIPE_LOGO_SVG}
          <span>${_t('reports.common.securePayments', 'Secure payments by Stripe')}</span>
        </div>
      </div>
    `;
  }

  /**
   * Get feature labels for different export formats (with i18n support)
   */
  function getFeatureLabels() {
    return {
      pdf: { icon: '📄', label: _t('reports.common.exportPdf', 'Export PDF'), description: _t('reports.common.clientReadyReport', 'Client-ready report') },
      excel: { icon: '📗', label: _t('reports.common.exportExcel', 'Export Excel'), description: _t('reports.common.spreadsheetData', 'Spreadsheet data') },
      csv: { icon: '📊', label: _t('reports.common.exportCsv', 'Export CSV'), description: _t('reports.common.rawDataExport', 'Raw data export') },
      json: { icon: '🔧', label: _t('reports.common.exportJson', 'Export JSON'), description: _t('reports.common.apiIntegration', 'API integration') },
      share: { icon: '🔗', label: _t('reports.common.shareLink', 'Share Link'), description: _t('reports.common.shareableUrl', 'Shareable URL') },
      compare: { icon: '⚖️', label: _t('reports.common.compare', 'Compare'), description: _t('reports.common.historicalTrends', 'Historical trends') },
      schedule: { icon: '📅', label: _t('reports.common.scheduleScan', 'Schedule Scan'), description: _t('reports.common.automatedReports', 'Automated reports') }
    };
  }

  /**
   * Render individual action button
   */
  function renderActionButton(feature, context, reportId) {
    const featureLabels = getFeatureLabels();
    const featureData = featureLabels[feature];
    if (!featureData) return '';

    const userHasAccess = hasAccess(reportId);
    const handler = feature === 'pdf' ? 'exportPDF' :
                    feature === 'excel' ? 'exportExcel' :
                    feature === 'csv' ? 'exportCSV' :
                    feature === 'json' ? 'exportJSON' :
                    feature === 'share' ? 'shareResults' : null;

    if (userHasAccess) {
      return `
        <button class="pro-report-block__action" data-export="${feature}" ${handler ? `data-handler="${handler}"` : ''} ${reportId ? `data-report-id="${reportId}"` : ''}>
          <span class="pro-report-block__action-icon">${featureData.icon}</span>
          <div class="pro-report-block__action-text">
            <div class="pro-report-block__action-label">${featureData.label}</div>
            <div class="pro-report-block__action-description">${featureData.description}</div>
          </div>
        </button>
      `;
    } else {
      return `
        <button class="pro-report-block__action pro-report-block__action--locked" data-open-pricing-modal data-context="${context}" ${reportId ? `data-report-id="${reportId}"` : ''}>
          <span class="pro-report-block__action-icon">${featureData.icon}</span>
          <div class="pro-report-block__action-text">
            <div class="pro-report-block__action-label">${featureData.label}</div>
            <div class="pro-report-block__action-description">${featureData.description}</div>
          </div>
          <span class="pro-report-block__lock-badge">PRO</span>
        </button>
      `;
    }
  }

  /**
   * Render Pro Report Block
   */
  function render(options = {}) {
    const {
      context = 'report',
      features = ['pdf', 'csv', 'share'],
      title = _t('reports.common.unlockReport', 'Unlock Report'),
      subtitle = _t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
      showBadge = true,
      reportId = null
    } = options;

    const userHasAccess = hasAccess(reportId);
    const isPro = isProSubscriber();
    const isPurchased = isReportPurchased(reportId);
    const hasLocalPurchase = isReportTypePurchasedLocally();

    // Determine badge text and style
    let badgeText = '';
    let badgeStyle = 'purchased';
    if (isPro) {
      badgeText = 'PRO';
      badgeStyle = 'pro';
    } else if (isPurchased || hasLocalPurchase) {
      badgeText = _t('reports.common.unlocked', 'UNLOCKED');
      badgeStyle = 'purchased';
    }

    // Use different title when user has access
    const displayTitle = userHasAccess ? _t('reports.common.exportShare', 'Export & Share') : title;
    const displaySubtitle = userHasAccess
      ? _t('reports.common.downloadReports', 'Download reports, export data, and share results.')
      : subtitle;

    // SVG icons that work in both light and dark modes
    const exportIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`;
    const lockIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>`;

    return `
      <div class="pro-report-block" data-pro-report-block ${reportId ? `data-report-id="${reportId}"` : ''}>
        <div class="pro-report-block__header">
          <div class="pro-report-block__icon">${userHasAccess ? exportIcon : lockIcon}</div>
          <div class="pro-report-block__text">
            <h3 class="pro-report-block__title">
              ${displayTitle}
              ${showBadge && userHasAccess ? `<span class="pro-report-block__badge pro-report-block__badge--${badgeStyle}">${badgeText}</span>` : ''}
            </h3>
            <p class="pro-report-block__subtitle">${displaySubtitle}</p>
          </div>
        </div>
        <div class="pro-report-block__actions">
          ${features.map(feature => renderActionButton(feature, context, reportId)).join('')}
        </div>
        ${!userHasAccess ? renderUnlockPrompt({ context, reportId }) : ''}
      </div>
    `;
  }

  /**
   * Render compact version (for sidebar or footer)
   */
  function renderCompact(options = {}) {
    const { context = 'report', features = ['pdf'], reportId = null } = options;
    const userHasAccess = hasAccess(reportId);

    if (userHasAccess) {
      return `
        <div class="pro-report-block pro-report-block--compact">
          ${features.map(feature => renderActionButton(feature, context, reportId)).join('')}
        </div>
      `;
    } else {
      return `
        <div class="pro-report-block pro-report-block--compact pro-report-block--locked">
          <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--compact" data-open-pricing-modal data-context="${context}" ${reportId ? `data-report-id="${reportId}"` : ''}>
            <span>🔒</span>
            <span>${_t('reports.common.unlockReport', 'Unlock Report')}</span>
          </button>
        </div>
      `;
    }
  }

  /**
   * Render minimal version (just badge or unlock button)
   */
  function renderMinimal(options = {}) {
    const { context = 'report', text = _t('reports.common.unlock', 'Unlock'), reportId = null } = options;
    const userHasAccess = hasAccess(reportId);

    if (userHasAccess) {
      const isPro = isProSubscriber();
      return `
        <div class="pro-report-block pro-report-block--minimal">
          <span class="pro-report-block__badge pro-report-block__badge--${isPro ? 'pro' : 'purchased'}">${isPro ? 'PRO' : _t('reports.common.unlocked', 'UNLOCKED')}</span>
        </div>
      `;
    } else {
      return `
        <div class="pro-report-block pro-report-block--minimal">
          <button class="pro-report-block__unlock-btn pro-report-block__unlock-btn--minimal" data-open-pricing-modal data-context="${context}" ${reportId ? `data-report-id="${reportId}"` : ''}>
            ${text}
          </button>
        </div>
      `;
    }
  }

  /**
   * Value proposition messaging for different contexts
   */
  function getValueProps() {
    return {
      performance: _t('reports.valueProps.performance', 'Turn performance data into client-ready reports'),
      seo: _t('reports.valueProps.seo', 'Share SEO insights with your team or clients'),
      accessibility: _t('reports.valueProps.accessibility', 'Document WCAG compliance for stakeholders'),
      security: _t('reports.valueProps.security', 'Export security findings for remediation'),
      mobile: _t('reports.valueProps.mobile', 'Compare mobile vs desktop screenshots'),
      cro: _t('reports.valueProps.cro', 'Track conversion optimization over time'),
      fonts: _t('reports.valueProps.fonts', 'Document font usage across your site'),
      brand: _t('reports.valueProps.brand', 'Verify brand consistency at scale'),
      default: _t('reports.valueProps.default', 'Professional reports your clients will love')
    };
  }

  /**
   * Get value proposition for context
   */
  function getValueProp(context) {
    const props = getValueProps();
    return props[context] || props.default;
  }

  /**
   * Cleanup stale URL-based localStorage purchase keys
   * These are legacy keys that granted access based on URL hash instead of reportId.
   * They're a security issue and should be removed.
   */
  function cleanupStalePurchaseKeys() {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      // Remove URL-based purchase keys (format: sm_report_purchased_<type>_<urlhash>)
      if (key && key.startsWith('sm_report_purchased_')) {
        keysToRemove.push(key);
      }
    }
    if (keysToRemove.length > 0) {
      console.log('[ProReportBlock] Cleaning up stale URL-based purchase keys:', keysToRemove);
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
  }

  /**
   * Initialize: fetch billing status on load and cleanup stale data
   */
  function init() {
    // Clean up legacy URL-based purchase keys - these are a security issue
    cleanupStalePurchaseKeys();

    // SECURITY: Clear stale session markers if NOT returning from billing
    // This prevents old payment sessions from granting access to new scans
    const params = new URLSearchParams(window.location.search);
    const billingSuccess = params.get('billing_success') === 'true';
    const paymentSuccess = params.get('payment') === 'success';
    const sessionId = params.get('session_id') || params.get('sessionId');
    const isReturningFromBilling = (billingSuccess || paymentSuccess) && sessionId;

    if (!isReturningFromBilling) {
      const existingMarker = sessionStorage.getItem('sm_payment_completed_session');
      if (existingMarker) {
        console.log('[ProReportBlock] SECURITY: Clearing stale session markers (not returning from billing)');
        sessionStorage.removeItem('sm_payment_completed_session');
        sessionStorage.removeItem('sm_purchased_report_id');
      }
    }

    fetchBillingStatus();
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /**
   * DIAGNOSTIC: Show exactly why access is granted or denied
   * Call from console: ProReportBlock.diagnoseAccess()
   */
  function diagnoseAccess(reportId = null) {
    const effectiveReportId = reportId || document.body?.getAttribute('data-report-id') || '';
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const sessionMarker = sessionStorage.getItem('sm_payment_completed_session');
    const purchasedReportId = sessionStorage.getItem('sm_purchased_report_id');

    console.log('=== ProReportBlock Access Diagnosis ===');
    console.log('1. Auth token present:', !!token);
    console.log('2. Cached billing status:', cachedBillingStatus);
    console.log('3. Current reportId:', effectiveReportId);
    console.log('4. Session payment marker:', sessionMarker, sessionMarker ? `(age: ${Math.round((Date.now() - parseInt(sessionMarker)) / 60000)} mins)` : '');
    console.log('5. Session purchased reportId:', purchasedReportId);
    console.log('6. isProSubscriber():', isProSubscriber());
    console.log('7. isReportTypePurchasedLocally():', isReportTypePurchasedLocally());
    console.log('8. isReportPurchased(reportId):', isReportPurchased(effectiveReportId));
    console.log('9. FINAL hasAccess():', hasAccess(effectiveReportId));
    console.log('========================================');

    return {
      reportId: effectiveReportId,
      hasToken: !!token,
      billingStatus: cachedBillingStatus,
      sessionMarker,
      purchasedReportId,
      isProSubscriber: isProSubscriber(),
      isLocalPurchase: isReportTypePurchasedLocally(),
      isReportPurchased: isReportPurchased(effectiveReportId),
      hasAccess: hasAccess(effectiveReportId)
    };
  }

  /**
   * RESET: Clear all access-related state
   * Call from console: ProReportBlock.resetAccessState()
   */
  function resetAccessState() {
    console.log('[ProReportBlock] Resetting all access state...');

    // Clear billing cache
    cachedBillingStatus = null;
    billingStatusPromise = null;
    accessCheckCache.clear();

    // Clear session markers
    sessionStorage.removeItem('sm_payment_completed_session');
    sessionStorage.removeItem('sm_purchased_report_id');

    // Clear any stale URL-based purchase keys
    cleanupStalePurchaseKeys();

    console.log('[ProReportBlock] Access state reset complete. Refresh the page to re-check access.');
    return { success: true };
  }

  // Public API
  window.ProReportBlock = {
    render,
    renderCompact,
    renderMinimal,
    renderUnlockPrompt,
    getValueProp,

    // Access checks (synchronous - uses cached billing status)
    hasAccess,
    isProSubscriber,
    isReportPurchased,

    // Async access checks (server-verified - preferred for critical decisions)
    hasAccessAsync,
    verifyAccessViaServer,

    // Billing cache
    fetchBillingStatus,
    clearBillingCache,

    // Diagnostics
    diagnoseAccess,
    resetAccessState,

    // Constants
    getFeatureLabels,
    VALUE_PROPS
  };

})(window);
