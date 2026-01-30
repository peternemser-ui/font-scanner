/**
 * Site Mechanic - Pro Report Block Component
 * Conversion-focused export & upgrade CTA
 *
 * New billing model:
 * - Pro subscription ($20/mo or $180/yr) - unlocks all reports
 * - Single report purchase ($10) - unlocks specific report
 */

(function(window) {
  // Cache billing status to avoid repeated API calls
  let cachedBillingStatus = null;
  let billingStatusPromise = null;

  /**
   * Fetch billing status from API (with caching)
   * @param {boolean} forceRefresh - If true, bypasses cache and fetches fresh data
   */
  async function fetchBillingStatus(forceRefresh = false) {
    // If force refresh, clear the cache first
    if (forceRefresh) {
      console.log('[ProReportBlock] Force refreshing billing status');
      cachedBillingStatus = null;
      billingStatusPromise = null;
    }

    if (cachedBillingStatus) return cachedBillingStatus;
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
          isPro: data?.subscriptionStatus === 'active',
          purchasedReportsCount: data?.purchasedReports?.length || 0,
          purchasedReports: data?.purchasedReports || []
        });
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
  }

  /**
   * Check if user has Pro subscription
   * Only trusts server-side billing status, not client-side localStorage
   * NOTE: Demo domain check is NOT done here - it must be done in hasAccess()
   * with the specific domain being analyzed to avoid stale context issues
   */
  function isProSubscriber() {
    // Only trust server-side cached billing status
    const hasCachedPro = cachedBillingStatus?.plan === 'pro';
    if (hasCachedPro) {
      console.log('[ProReportBlock] isProSubscriber: true (cached billing status)');
      return true;
    }

    // Note: Demo domain check removed from here - was causing false positives
    // due to stale ScanContext. Demo domains are now only checked in hasAccess()
    // where we explicitly verify the domain being analyzed.

    // Note: Removed legacy localStorage checks (proManager, ProGate) for security
    // Subscription status must come from server via fetchBillingStatus()

    console.log('[ProReportBlock] isProSubscriber: false', {
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
   * Check if user has access to a report (Pro OR purchased OR demo domain)
   * If no reportId is provided, falls back to the current report from body attribute
   */
  function hasAccess(reportId) {
    if (isProSubscriber()) return true;

    // Check demo domains - get domain from multiple sources (most specific first)
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

    if (currentDomain && window.ProAccess?.isDemoDomain?.(currentDomain)) {
      console.log('[ProReportBlock] hasAccess: true (demo domain)', { currentDomain });
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

    if (effectiveReportId && isReportPurchased(effectiveReportId)) return true;

    console.log('[ProReportBlock] hasAccess: false', {
      reportId: effectiveReportId,
      currentDomain,
      hasCachedStatus: !!cachedBillingStatus
    });
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
          <span class="pro-report-block__unlock-text">Unlock this report</span>
        </div>
        <div class="pro-report-block__unlock-buttons">
          <button
            class="pro-report-block__unlock-btn pro-report-block__unlock-btn--primary"
            data-buy-single-report
            data-context="${context}"
            ${reportId ? `data-report-id="${reportId}"` : ''}
          >
            Unlock for $10
          </button>
          <button
            class="pro-report-block__unlock-btn pro-report-block__unlock-btn--secondary"
            data-open-pricing-modal
            data-context="${context}"
          >
            Go Pro — $20/mo
          </button>
        </div>
        <p class="pro-report-block__unlock-hint">
          Pro unlocks all reports. Single purchase unlocks only this scan.
        </p>
      </div>
    `;
  }

  /**
   * Feature labels for different export formats
   */
  const FEATURE_LABELS = {
    pdf: { icon: '📄', label: 'Export PDF', description: 'Client-ready report' },
    excel: { icon: '📗', label: 'Export Excel', description: 'Spreadsheet data' },
    csv: { icon: '📊', label: 'Export CSV', description: 'Raw data export' },
    json: { icon: '🔧', label: 'Export JSON', description: 'API integration' },
    share: { icon: '🔗', label: 'Share Link', description: 'Shareable URL' },
    compare: { icon: '⚖️', label: 'Compare', description: 'Historical trends' },
    schedule: { icon: '📅', label: 'Schedule Scan', description: 'Automated reports' }
  };

  /**
   * Render individual action button
   */
  function renderActionButton(feature, context, reportId) {
    const featureData = FEATURE_LABELS[feature];
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
      title = 'Export & Share',
      subtitle = 'Download reports, export data, and share results.',
      showBadge = true,
      reportId = null
    } = options;

    const userHasAccess = hasAccess(reportId);
    const isPro = isProSubscriber();
    const isPurchased = isReportPurchased(reportId);

    // Determine badge text
    let badgeText = '';
    if (isPro) badgeText = 'PRO';
    else if (isPurchased) badgeText = 'PURCHASED';

    return `
      <div class="pro-report-block" data-pro-report-block ${reportId ? `data-report-id="${reportId}"` : ''}>
        <div class="pro-report-block__header">
          <div class="pro-report-block__icon">📊</div>
          <div class="pro-report-block__text">
            <h3 class="pro-report-block__title">
              ${title}
              ${showBadge && userHasAccess ? `<span class="pro-report-block__badge pro-report-block__badge--${isPro ? 'pro' : 'purchased'}">${badgeText}</span>` : ''}
            </h3>
            <p class="pro-report-block__subtitle">${subtitle}</p>
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
            <span>Unlock Report</span>
          </button>
        </div>
      `;
    }
  }

  /**
   * Render minimal version (just badge or unlock button)
   */
  function renderMinimal(options = {}) {
    const { context = 'report', text = 'Unlock', reportId = null } = options;
    const userHasAccess = hasAccess(reportId);

    if (userHasAccess) {
      const isPro = isProSubscriber();
      return `
        <div class="pro-report-block pro-report-block--minimal">
          <span class="pro-report-block__badge pro-report-block__badge--${isPro ? 'pro' : 'purchased'}">${isPro ? 'PRO' : 'UNLOCKED'}</span>
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
  const VALUE_PROPS = {
    performance: 'Turn performance data into client-ready reports',
    seo: 'Share SEO insights with your team or clients',
    accessibility: 'Document WCAG compliance for stakeholders',
    security: 'Export security findings for remediation',
    mobile: 'Compare mobile vs desktop screenshots',
    cro: 'Track conversion optimization over time',
    fonts: 'Document font usage across your site',
    brand: 'Verify brand consistency at scale',
    default: 'Professional reports your clients will love'
  };

  /**
   * Get value proposition for context
   */
  function getValueProp(context) {
    return VALUE_PROPS[context] || VALUE_PROPS.default;
  }

  /**
   * Initialize: fetch billing status on load
   */
  function init() {
    fetchBillingStatus();
  }

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.ProReportBlock = {
    render,
    renderCompact,
    renderMinimal,
    renderUnlockPrompt,
    getValueProp,

    // Access checks
    hasAccess,
    isProSubscriber,
    isReportPurchased,

    // Billing cache
    fetchBillingStatus,
    clearBillingCache,

    // Constants
    FEATURE_LABELS,
    VALUE_PROPS
  };

})(window);
