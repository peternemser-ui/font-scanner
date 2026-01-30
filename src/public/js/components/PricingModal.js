/**
 * Site Mechanic - Pricing Modal Component
 * Swiss / International Typographic Style
 *
 * Options:
 * - Pro Monthly: $20/month
 * - Pro Yearly: $180/year (Save 25%)
 * - Day Pass: $20 for 24 hours (no auto-renewal)
 * - Single Report: $10 one-time
 */

(function(window) {
  'use strict';

  // DEV flag - set to true to enable debug assertions
  const DEV_MODE = false;

  // Stripe logo SVG (white version for dark backgrounds)
  const STRIPE_LOGO_SVG = `<svg class="sm-modal__footer-stripe" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M60 12.8C60 8.55 57.95 5.2 54 5.2C50.05 5.2 47.6 8.55 47.6 12.75C47.6 17.7 50.5 20.35 54.65 20.35C56.7 20.35 58.25 19.85 59.45 19.1V15.85C58.25 16.55 56.85 17 55.1 17C53.4 17 51.9 16.35 51.7 14.25H59.95C59.95 14.05 60 13.15 60 12.8ZM51.65 11.35C51.65 9.35 52.85 8.45 54 8.45C55.1 8.45 56.25 9.35 56.25 11.35H51.65ZM41.2 5.2C39.45 5.2 38.35 6 37.75 6.5L37.55 5.45H33.9V24.55L38 23.7V19.95C38.6 20.35 39.5 20.9 41.15 20.9C44.55 20.9 47.6 18.3 47.6 12.85C47.55 7.85 44.45 5.2 41.2 5.2ZM40.3 17.05C39.15 17.05 38.5 16.65 38.05 16.15L38 9.55C38.5 9 39.2 8.6 40.3 8.6C42.1 8.6 43.35 10.55 43.35 12.85C43.35 15.2 42.1 17.05 40.3 17.05ZM28.05 4.3L32.2 3.45V0L28.05 0.85V4.3ZM32.2 5.45H28.05V20.6H32.2V5.45ZM23.65 6.7L23.4 5.45H19.8V20.6H23.9V10.1C24.85 8.85 26.45 9.1 26.95 9.25V5.45C26.4 5.25 24.6 4.9 23.65 6.7ZM15.4 1.8L11.4 2.65L11.35 16.35C11.35 18.65 13.1 20.4 15.4 20.4C16.65 20.4 17.55 20.2 18.05 19.9V16.55C17.55 16.75 15.35 17.4 15.35 15.1V8.8H18.05V5.45H15.35L15.4 1.8ZM4.15 9.9C4.15 9.2 4.75 8.9 5.7 8.9C7.05 8.9 8.75 9.3 10.1 10.05V6.2C8.65 5.6 7.2 5.35 5.7 5.35C2.3 5.35 0 7.2 0 10.1C0 14.7 6.35 13.95 6.35 15.95C6.35 16.8 5.6 17.1 4.6 17.1C3.1 17.1 1.2 16.5 0.2 15.55V19.5C1.55 20.1 2.95 20.4 4.6 20.4C8.1 20.4 10.55 18.6 10.55 15.65C10.5 10.65 4.15 11.55 4.15 9.9Z" fill="currentColor"/>
  </svg>`;

  // State
  let currentState = {
    loading: false,
    error: null,
    billingStatus: null,
    reportId: null
  };

  // ============================================
  // Helpers
  // ============================================

  function getAuthToken() {
    if (window.proManager && typeof window.proManager.getToken === 'function') {
      return window.proManager.getToken();
    }
    return localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token') || null;
  }

  function isLoggedIn() {
    return !!getAuthToken();
  }

  function showToast(message) {
    if (!message) return;
    if (window.ReportUI && typeof window.ReportUI.toast === 'function') {
      window.ReportUI.toast(message);
      return;
    }
    alert(String(message));
  }

  function getReportUrl() {
    // Try multiple ID patterns used across analyzers
    const input = document.getElementById('urlInput') ||
                  document.getElementById('url') ||
                  document.getElementById('ipReputationInput') ||
                  document.querySelector('input[type="url"], input[name="url"], input[id*="url" i]');
    const value = input && typeof input.value === 'string' ? input.value.trim() : '';
    if (value) {
      console.log('[PricingModal] getReportUrl found:', value, 'from input:', input?.id);
      return value;
    }

    const params = new URLSearchParams(window.location.search);
    const urlParam = (params.get('url') || '').trim();
    console.log('[PricingModal] getReportUrl from params:', urlParam);
    return urlParam;
  }

  function getAnalyzerKey() {
    return document.body.getAttribute('data-sm-analyzer-key') ||
           document.body.getAttribute('data-analyzer-key') ||
           window.SM_ANALYZER_KEY || '';
  }

  function getScanStartedAt() {
    return document.body.getAttribute('data-sm-scan-started-at') ||
           window.SM_SCAN_STARTED_AT || '';
  }

  function base64UrlEncode(str) {
    try {
      return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
    } catch (e) {
      return '';
    }
  }

  function computeReportId(url, startedAt, analyzerKey) {
    if (window.ReportUI) {
      if (typeof window.ReportUI.makeReportId === 'function') {
        return window.ReportUI.makeReportId({ analyzerKey, normalizedUrl: url, startedAtISO: startedAt });
      }
      if (typeof window.ReportUI.computeReportId === 'function') {
        return window.ReportUI.computeReportId(url, startedAt, analyzerKey);
      }
    }

    const safeUrl = (url || '').trim().replace(/\s+/g, ' ').replace(/\/$/, '');
    const ts = (startedAt || '').trim();
    const key = (analyzerKey || '').trim();
    if (!safeUrl || !ts || !key) return '';

    const raw = `${key}|${safeUrl}|${ts}`;
    const encoded = base64UrlEncode(raw);
    return encoded ? `r_${encoded}` : '';
  }

  function getCurrentReportId() {
    // Check body attribute first
    let reportId = document.body.getAttribute('data-report-id') || '';

    // Check URL params if not found on body
    if (!reportId) {
      const params = new URLSearchParams(window.location.search);
      reportId = params.get('report_id') || params.get('reportId') || '';
      if (reportId) {
        document.body.setAttribute('data-report-id', reportId);
      }
    }

    // Compute from scan data if still not found
    if (!reportId) {
      reportId = computeReportId(getReportUrl(), getScanStartedAt(), getAnalyzerKey());
      if (reportId) document.body.setAttribute('data-report-id', reportId);
    }
    return reportId;
  }

  // ============================================
  // Debug: Price Clipping Assertion
  // ============================================

  function debugCheckPriceClipping() {
    if (!DEV_MODE) return;

    requestAnimationFrame(() => {
      const priceElements = document.querySelectorAll('.sm-plan-card__amount');
      priceElements.forEach((el) => {
        if (el.scrollWidth > el.clientWidth) {
          console.warn('[PricingModal] Price text is clipped!', {
            element: el,
            text: el.textContent,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            computedStyles: {
              display: getComputedStyle(el).display,
              overflow: getComputedStyle(el).overflow,
              whiteSpace: getComputedStyle(el).whiteSpace,
              maxWidth: getComputedStyle(el).maxWidth,
              width: getComputedStyle(el).width,
              flex: getComputedStyle(el).flex
            }
          });
        }
      });
    });
  }

  // ============================================
  // API Calls
  // ============================================

  async function fetchBillingStatus() {
    const token = getAuthToken();
    if (!token) return null;

    try {
      const resp = await fetch('/api/billing/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch (e) {
      return null;
    }
  }

  async function createCheckout(purchaseType, interval = null, reportId = null) {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Please log in to continue');
    }

    const body = { purchaseType };
    if (interval) body.interval = interval;
    if (reportId) body.reportId = reportId;

    // Include site URL and analyzer type for purchase records
    const siteUrl = getReportUrl();
    if (siteUrl) body.siteUrl = siteUrl;

    // Determine analyzer type from page or body attribute
    const analyzerType = document.body.getAttribute('data-sm-analyzer-key') ||
                         document.body.getAttribute('data-analyzer-key') ||
                         window.SM_ANALYZER_KEY ||
                         window.location.pathname.replace(/.*\//, '').replace('.html', '').replace('-analyzer', '') ||
                         'unknown';
    if (analyzerType) body.analyzerType = analyzerType;

    const params = new URLSearchParams(window.location.search);
    params.delete('billing_success');
    params.delete('billing_canceled');
    if (reportId) {
      params.set('report_id', reportId);
    } else {
      console.warn('[PricingModal] createCheckout: No reportId provided!', {
        dataReportId: document.body.getAttribute('data-report-id'),
        computedId: computeReportId(getReportUrl(), getScanStartedAt(), getAnalyzerKey()),
        url: getReportUrl(),
        scanStarted: getScanStartedAt(),
        analyzerKey: getAnalyzerKey()
      });
    }
    // Include the scanned URL in return URL so it's available after billing
    if (siteUrl && !params.has('url')) {
      params.set('url', siteUrl);
    }
    body.returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    console.log('[PricingModal] createCheckout returnUrl:', body.returnUrl);

    const resp = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error('[PricingModal] Checkout error response:', data);
      throw new Error(data.message || data.error || 'Checkout failed');
    }

    return data.checkoutUrl;
  }

  async function openBillingPortal() {
    const token = getAuthToken();
    if (!token) {
      showToast('Please log in to manage billing');
      return;
    }

    try {
      const resp = await fetch('/api/billing/portal', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await resp.json();
      if (resp.ok && data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        showToast(data.error || 'Unable to open billing portal');
      }
    } catch (e) {
      showToast('Unable to open billing portal');
    }
  }

  // ============================================
  // Render Functions
  // ============================================

  function renderHeader() {
    return `
      <div class="sm-modal__header">
        <img class="sm-modal__logo app-logo-dark" src="/assets/logo-dark.svg" alt="Site Mechanic" />
        <img class="sm-modal__logo app-logo-light" src="/assets/logo-light.svg" alt="Site Mechanic" />
        <span class="sm-modal__title-text">Unlock Pro Features</span>
        <button type="button" class="sm-modal__close" data-action="close" aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    `;
  }

  function renderLoginPrompt() {
    return `
      <div class="sm-pricing-login">
        <p class="sm-pricing-login__text">Sign in to purchase a subscription or single report.</p>
        <div class="sm-pricing-login__actions">
          <a href="/auth.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}" class="sm-btn sm-btn--primary">Sign In</a>
          <a href="/auth.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}&mode=signup" class="sm-btn sm-btn--outline">Create Account</a>
        </div>
      </div>
    `;
  }

  function renderError(message) {
    if (!message) return '';
    return `
      <div class="sm-pricing-error">
        <span class="sm-pricing-error__icon">!</span>
        <span class="sm-pricing-error__msg">${message}</span>
        <button class="sm-pricing-error__retry" data-action="retry">Retry</button>
      </div>
    `;
  }

  function renderPlanCard(type, options = {}) {
    const { isPro, isYearly, reportPurchased, loading, reportId } = options;

    // Monthly Plan
    if (type === 'monthly') {
      const isCurrentPlan = isPro && !isYearly;
      const cardClass = isCurrentPlan ? 'sm-plan-card sm-plan-card--current' : 'sm-plan-card';

      let buttonHtml;
      if (isCurrentPlan) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--current" data-action="portal">Manage Plan</button>`;
      } else if (isPro) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--switch" data-action="checkout" data-type="subscription" data-interval="month" ${loading ? 'disabled' : ''}>Switch to Monthly</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--primary" data-action="checkout" data-type="subscription" data-interval="month" ${loading ? 'disabled' : ''}>${loading ? 'Processing...' : 'Subscribe'}</button>`;
      }

      return `
        <div class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__title">Pro Monthly</h3>
            ${isCurrentPlan ? '<span class="sm-plan-card__badge sm-plan-card__badge--current">Current</span>' : ''}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$20</span>
            <span class="sm-plan-card__period">per month</span>
          </div>
          <p class="sm-plan-card__desc">Billed monthly, cancel anytime</p>
          ${buttonHtml}
        </div>
      `;
    }

    // Yearly Plan
    if (type === 'yearly') {
      const isCurrentPlan = isPro && isYearly;
      const cardClass = isCurrentPlan ? 'sm-plan-card sm-plan-card--current sm-plan-card--featured' : 'sm-plan-card sm-plan-card--featured';

      let buttonHtml;
      if (isCurrentPlan) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--current" data-action="portal">Manage Plan</button>`;
      } else if (isPro) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--switch" data-action="checkout" data-type="subscription" data-interval="year" ${loading ? 'disabled' : ''}>Switch to Yearly</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--featured" data-action="checkout" data-type="subscription" data-interval="year" ${loading ? 'disabled' : ''}>${loading ? 'Processing...' : 'Subscribe'}</button>`;
      }

      return `
        <div class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__title">Pro Yearly</h3>
            ${isCurrentPlan ? '<span class="sm-plan-card__badge sm-plan-card__badge--current">Current</span>' : '<span class="sm-plan-card__badge sm-plan-card__badge--save">Save 25%</span>'}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$180</span>
            <span class="sm-plan-card__period">per year</span>
          </div>
          <p class="sm-plan-card__desc">$15/mo effective rate</p>
          ${buttonHtml}
        </div>
      `;
    }

    // Day Pass
    if (type === 'daypass') {
      const isDay = options.isDay;
      const isCurrentPlan = isPro && isDay;
      const cardClass = isCurrentPlan ? 'sm-plan-card sm-plan-card--current' : 'sm-plan-card';

      let buttonHtml;
      if (isCurrentPlan) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--current" data-action="portal">Manage Pass</button>`;
      } else if (isPro) {
        // User already has monthly/yearly, don't offer downgrade to day pass
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--disabled" disabled>You have Pro</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--primary" data-action="checkout" data-type="subscription" data-interval="day" ${loading ? 'disabled' : ''}>${loading ? 'Processing...' : 'Get Day Pass'}</button>`;
      }

      return `
        <div class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__title">Day Pass</h3>
            ${isCurrentPlan ? '<span class="sm-plan-card__badge sm-plan-card__badge--current">Active</span>' : ''}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$20</span>
            <span class="sm-plan-card__period">24 hours</span>
          </div>
          <p class="sm-plan-card__desc">Full Pro access for one day</p>
          ${buttonHtml}
        </div>
      `;
    }

    // Single Report
    if (type === 'single') {
      const purchased = reportPurchased;
      const cardClass = purchased ? 'sm-plan-card sm-plan-card--purchased' : 'sm-plan-card';

      let buttonHtml;
      if (isPro) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--disabled" disabled>Included with Pro</button>`;
      } else if (purchased) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--purchased" disabled>Purchased</button>`;
      } else if (!reportId) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--disabled" disabled>Run scan first</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--primary" data-action="checkout" data-type="single_report" data-report-id="${reportId}" ${loading ? 'disabled' : ''}>${loading ? 'Processing...' : 'Buy Report'}</button>`;
      }

      return `
        <div class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__title">This Report</h3>
            ${purchased ? '<span class="sm-plan-card__badge sm-plan-card__badge--purchased">Owned</span>' : ''}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$10</span>
            <span class="sm-plan-card__period">one-time</span>
          </div>
          <p class="sm-plan-card__desc">Permanent access to this report</p>
          ${buttonHtml}
        </div>
      `;
    }

    return '';
  }

  function renderBody() {
    const { loading, error, billingStatus } = currentState;
    const reportId = getCurrentReportId();
    currentState.reportId = reportId;

    console.log('[PricingModal] renderBody reportId:', reportId, {
      fromBody: document.body.getAttribute('data-report-id'),
      scanStarted: getScanStartedAt(),
      analyzerKey: getAnalyzerKey(),
      url: getReportUrl()
    });

    if (!isLoggedIn()) {
      return renderLoginPrompt();
    }

    const isPro = billingStatus?.plan === 'pro';
    const isYearly = billingStatus?.subscriptionInterval === 'year';
    const isDay = billingStatus?.subscriptionInterval === 'day';
    const purchasedReports = billingStatus?.purchasedReports || [];
    const reportPurchased = reportId && purchasedReports.includes(reportId);

    console.log('[PricingModal] renderBody billing check:', {
      reportId,
      isPro,
      purchasedReports,
      reportPurchased,
      billingStatus
    });

    // Show single report card if there's a reportId (scan has been run)
    // The card will show appropriate button state (Buy/Purchased/Included with Pro)
    const showSingleReport = !!reportId;

    // Grid: Monthly, Yearly, Day Pass (+ Single Report if applicable)
    // 3 subscription options + optional single report = 3 or 4 cards
    const cardCount = showSingleReport ? 4 : 3;
    const gridClass = `sm-pricing-grid sm-pricing-grid--${cardCount}`;

    return `
      ${error ? renderError(error) : ''}
      <div class="${gridClass}">
        ${renderPlanCard('monthly', { isPro, isYearly, isDay, loading })}
        ${renderPlanCard('yearly', { isPro, isYearly, isDay, loading })}
        ${renderPlanCard('daypass', { isPro, isYearly, isDay, loading })}
        ${showSingleReport ? renderPlanCard('single', { isPro, reportPurchased, loading, reportId }) : ''}
      </div>
    `;
  }

  function renderFooter() {
    const isPro = currentState.billingStatus?.plan === 'pro';

    if (isPro) {
      return `
        <div class="sm-modal__footer">
          <span>Powered by</span>
          ${STRIPE_LOGO_SVG}
          <span>|</span>
          <button class="sm-modal__footer-link" data-action="portal">Manage subscription</button>
        </div>
      `;
    }

    return `
      <div class="sm-modal__footer">
        <span>Powered by</span>
        ${STRIPE_LOGO_SVG}
      </div>
    `;
  }

  function renderModal() {
    return `
      <div class="sm-modal__overlay" data-pricing-modal role="dialog" aria-modal="true" aria-label="Pricing options">
        <div class="sm-modal__panel">
          ${renderHeader()}
          <div class="sm-modal__body">
            ${renderBody()}
          </div>
          ${renderFooter()}
        </div>
      </div>
    `;
  }

  // ============================================
  // Modal Management
  // ============================================

  function updateBody() {
    const body = document.querySelector('[data-pricing-modal] .sm-modal__body');
    if (body) {
      body.innerHTML = renderBody();
      setupEventListeners(document.querySelector('[data-pricing-modal]'));
    }

    const footer = document.querySelector('[data-pricing-modal] .sm-modal__footer');
    if (footer) {
      footer.outerHTML = renderFooter();
      setupEventListeners(document.querySelector('[data-pricing-modal]'));
    }

    // Debug: Check for price clipping after render
    debugCheckPriceClipping();
  }

  async function open(options = {}) {
    // Remove existing modal if present
    const existing = document.querySelector('[data-pricing-modal]');
    if (existing) existing.remove();

    const reportId = options.reportId || getCurrentReportId();
    currentState = {
      loading: false,
      error: null,
      billingStatus: null,
      reportId
    };

    // Pre-fetch billing status
    if (isLoggedIn()) {
      currentState.billingStatus = await fetchBillingStatus();
    }

    // Insert modal
    document.body.insertAdjacentHTML('beforeend', renderModal());

    // Lock body scroll
    document.body.classList.add('sm-modal-open');
    document.documentElement.classList.add('sm-modal-open');

    // Animate in
    requestAnimationFrame(() => {
      const overlay = document.querySelector('[data-pricing-modal]');
      if (overlay) {
        overlay.classList.add('sm-modal__overlay--open');
        setupEventListeners(overlay);

        // Debug: Check for price clipping after render
        debugCheckPriceClipping();
      }
    });
  }

  function openSingleReport(options = {}) {
    open({ reportId: options.reportId || getCurrentReportId() });
  }

  function close() {
    const overlay = document.querySelector('[data-pricing-modal]');
    if (!overlay) return;

    overlay.classList.remove('sm-modal__overlay--open');
    document.body.classList.remove('sm-modal-open');
    document.documentElement.classList.remove('sm-modal-open');

    setTimeout(() => overlay.remove(), 200);
  }

  // ============================================
  // Event Handlers
  // ============================================

  function setupEventListeners(container) {
    if (!container) return;

    // Close button
    container.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.onclick = close;
    });

    // Overlay click to close
    container.onclick = (e) => {
      if (e.target === container) close();
    };

    // Checkout buttons
    container.querySelectorAll('[data-action="checkout"]').forEach(btn => {
      btn.onclick = handleCheckout;
    });

    // Portal buttons
    container.querySelectorAll('[data-action="portal"]').forEach(btn => {
      btn.onclick = handlePortal;
    });

    // Retry button
    container.querySelectorAll('[data-action="retry"]').forEach(btn => {
      btn.onclick = handleRetry;
    });

    // ESC key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  async function handleCheckout(e) {
    const btn = e.target.closest('[data-action="checkout"]');
    if (!btn || currentState.loading) return;

    const purchaseType = btn.dataset.type;
    const interval = btn.dataset.interval || null;
    // Get reportId from multiple sources - button dataset, state, or compute fresh
    let reportId = btn.dataset.reportId || currentState.reportId || getCurrentReportId() || null;

    console.log('[PricingModal] handleCheckout reportId sources:', {
      fromButton: btn.dataset.reportId,
      fromState: currentState.reportId,
      fromGetCurrent: getCurrentReportId(),
      final: reportId
    });

    if (purchaseType === 'single_report' && !reportId) {
      showToast('Run a scan first to purchase a report');
      return;
    }

    currentState.loading = true;
    currentState.error = null;
    updateBody();

    try {
      // Cache the current URL being analyzed before redirecting to checkout
      const urlToAnalyze = getReportUrl();
      if (urlToAnalyze) {
        sessionStorage.setItem('sm_checkout_url', urlToAnalyze);
      }
      if (reportId) {
        sessionStorage.setItem('sm_checkout_report_id', reportId);
      }

      // Get analyzer type to determine which results to save
      const analyzerType = document.body.getAttribute('data-sm-analyzer-key') ||
                          window.SM_ANALYZER_KEY ||
                          window.location.pathname.replace(/.*\//, '').replace('.html', '').replace('-analyzer', '') ||
                          'unknown';

      // Get scan results based on analyzer type (more reliable than || chain)
      let resultsToSave = null;
      if (analyzerType.includes('seo')) {
        resultsToSave = window.currentSeoResults;
      } else if (analyzerType.includes('security')) {
        resultsToSave = window.currentSecurityResults;
      } else if (analyzerType.includes('performance') || analyzerType.includes('speed') || analyzerType.includes('cwv')) {
        resultsToSave = window.currentPerformanceResults || window.currentCWVResults;
      } else if (analyzerType.includes('accessibility')) {
        resultsToSave = window.currentAccessibilityResults;
      } else if (analyzerType.includes('mobile')) {
        resultsToSave = window.currentMobileResults || window.mobileData;
      } else if (analyzerType.includes('cro')) {
        resultsToSave = window.currentCROResults;
      } else if (analyzerType.includes('gdpr') || analyzerType.includes('privacy')) {
        resultsToSave = window.__gdprCurrentData || window.currentGDPRResults;
      } else if (analyzerType.includes('ip-reputation') || analyzerType.includes('reputation')) {
        resultsToSave = window.currentResults || window.currentIPReputationResults;
      } else if (analyzerType.includes('tag')) {
        resultsToSave = window.currentTagResults || window.tagIntelligenceData;
      } else if (analyzerType.includes('hosting')) {
        resultsToSave = window.currentHostingResults;
      } else if (analyzerType.includes('brand')) {
        resultsToSave = window.currentBrandResults;
      } else if (analyzerType.includes('fonts') || analyzerType.includes('typography')) {
        resultsToSave = window.currentFontsResults;
      } else if (analyzerType.includes('crawler') || analyzerType.includes('site-crawler')) {
        resultsToSave = window.currentCrawlerResults;
      } else if (analyzerType.includes('local-seo') || analyzerType.includes('local_seo')) {
        resultsToSave = window.currentLocalSEOResults;
      } else if (analyzerType.includes('broken-links') || analyzerType.includes('broken_links')) {
        resultsToSave = window.currentBrokenLinksResults;
      } else if (analyzerType.includes('competitive')) {
        resultsToSave = window.currentCompetitiveResults || window.competitiveData;
      }
      // Fallback to checking all globals if analyzer type not matched
      if (!resultsToSave) {
        resultsToSave = window.currentSeoResults ||
                        window.currentSecurityResults ||
                        window.currentPerformanceResults ||
                        window.currentAccessibilityResults ||
                        window.currentMobileResults ||
                        window.currentCROResults ||
                        window.currentCWVResults ||
                        window.currentCrawlerResults ||
                        window.currentLocalSEOResults ||
                        window.currentBrokenLinksResults ||
                        window.currentCompetitiveResults ||
                        window.competitiveData ||
                        window.__gdprCurrentData ||
                        window.currentResults ||
                        window.mobileData ||
                        window.lastScanResults ||
                        null;
      }

      console.log('[PricingModal] Analyzer type:', analyzerType, 'Results to save:', !!resultsToSave);

      // CRITICAL: Save results to DATABASE before checkout (not just sessionStorage)
      // This ensures purchased reports can be recalled even if results are too large for sessionStorage
      if (resultsToSave && reportId && window.ReportStorage?.saveBeforeCheckout) {
        const scanStartedAt = document.body.getAttribute('data-sm-scan-started-at') ||
                             window.SM_SCAN_STARTED_AT ||
                             new Date().toISOString();

        console.log('[PricingModal] Saving report to database before checkout:', {
          reportId,
          analyzerType,
          hasResults: !!resultsToSave,
          resultKeys: Object.keys(resultsToSave || {}).slice(0, 10)
        });

        try {
          const saved = await window.ReportStorage.saveBeforeCheckout(reportId, resultsToSave, {
            siteUrl: urlToAnalyze,
            analyzerType,
            scannedAt: scanStartedAt
          });
          console.log('[PricingModal] Save result:', saved ? 'SUCCESS' : 'FAILED');
        } catch (saveErr) {
          console.error('[PricingModal] Error saving report:', saveErr);
        }
      } else {
        console.warn('[PricingModal] Cannot save report - missing:', {
          hasResults: !!resultsToSave,
          hasReportId: !!reportId,
          hasReportStorage: !!window.ReportStorage?.saveBeforeCheckout
        });
      }

      // Also try to cache in sessionStorage as a fallback (may fail for large results)
      if (resultsToSave) {
        try {
          sessionStorage.setItem('sm_checkout_results', JSON.stringify(resultsToSave));
          sessionStorage.setItem('sm_checkout_analyzer', window.location.pathname);
        } catch (e) {
          // Results too large for sessionStorage, but we already saved to database
          console.warn('Could not cache scan results in sessionStorage (already saved to database):', e);
        }
      }

      const checkoutUrl = await createCheckout(purchaseType, interval, reportId);
      window.location.href = checkoutUrl;
    } catch (err) {
      currentState.loading = false;
      currentState.error = err.message || 'Checkout failed. Please try again.';
      updateBody();
    }
  }

  async function handlePortal(e) {
    e.preventDefault();
    await openBillingPortal();
  }

  async function handleRetry() {
    currentState.error = null;
    currentState.loading = false;
    if (isLoggedIn()) {
      currentState.billingStatus = await fetchBillingStatus();
    }
    updateBody();
  }

  // ============================================
  // Legacy API Compatibility
  // ============================================

  const CREDIT_PACK_OPTIONS = [
    { id: 'pack-5', credits: 5, price: 40, perReport: 8 },
    { id: 'pack-10', credits: 10, price: 70, perReport: 7 },
    { id: 'pack-25', credits: 25, price: 150, perReport: 6 },
  ];

  // ============================================
  // Public API
  // ============================================

  window.PricingModal = {
    open,
    openSingleReport,
    close,
    CREDIT_PACK_OPTIONS,
    fetchBillingStatus,
    openBillingPortal
  };

})(window);
