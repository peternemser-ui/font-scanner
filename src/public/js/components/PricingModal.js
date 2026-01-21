/**
 * Site Mechanic - Pricing Modal Component
 * Shows subscription and single report purchase options
 *
 * Options:
 * - Pro Monthly: $20/month
 * - Pro Yearly: $180/year (Save 25%)
 * - Single Report: $10 one-time
 */

(function(window) {
  'use strict';

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
    // Try proManager first, then localStorage
    if (window.proManager && typeof window.proManager.getToken === 'function') {
      return window.proManager.getToken();
    }
    return localStorage.getItem('sm_auth_token') || null;
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
    const input = document.getElementById('urlInput') ||
                  document.querySelector('input[type="url"], input[name="url"], input[id*="url" i]');
    const value = input && typeof input.value === 'string' ? input.value.trim() : '';
    if (value) return value;

    const params = new URLSearchParams(window.location.search);
    return (params.get('url') || '').trim();
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
    let reportId = document.body.getAttribute('data-report-id') || '';
    if (!reportId) {
      reportId = computeReportId(getReportUrl(), getScanStartedAt(), getAnalyzerKey());
      if (reportId) document.body.setAttribute('data-report-id', reportId);
    }
    return reportId;
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
      console.warn('Failed to fetch billing status:', e);
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

    const params = new URLSearchParams(window.location.search);
    params.delete('billing_success');
    params.delete('billing_canceled');
    if (reportId) params.set('report_id', reportId);
    body.returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

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
      throw new Error(data.error || 'Checkout failed');
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

  function renderModalTitle() {
    return `
      <span class="sm-modal-title">
        <img class="sm-modal-title__logo app-logo-dark" src="/assets/logo-dark.svg" alt="Site Mechanic" />
        <img class="sm-modal-title__logo app-logo-light" src="/assets/logo-light.svg" alt="Site Mechanic" />
        <span class="sm-modal-title__text">Unlock Pro Features</span>
      </span>
    `;
  }

  function renderLoginPrompt() {
    return `
      <div class="pricing-login-prompt">
        <p>Please log in to purchase a subscription or report.</p>
        <div class="pricing-login-prompt__actions">
          <a href="/login.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}" class="btn btn--primary">Log In</a>
          <a href="/signup.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}" class="btn btn--outline">Sign Up</a>
        </div>
      </div>
    `;
  }

  function renderProBadge() {
    return `
      <span class="pricing-card__badge pricing-card__badge--pro">Current Plan</span>
    `;
  }

  function renderSaveBadge() {
    return `
      <span class="pricing-card__badge pricing-card__badge--save">Save 25%</span>
    `;
  }

  function renderPurchasedBadge() {
    return `
      <span class="pricing-card__badge pricing-card__badge--purchased">Purchased</span>
    `;
  }

  function renderPricingCard(type, options = {}) {
    const { isPro, isYearly, reportPurchased, loading, reportId } = options;

    if (type === 'monthly') {
      const isCurrentPlan = isPro && !isYearly;
      return `
        <div class="pricing-card ${isCurrentPlan ? 'pricing-card--current' : ''}">
          ${isCurrentPlan ? renderProBadge() : ''}
          <h4 class="pricing-card__name">Pro Monthly</h4>
          <div class="pricing-card__price">
            <span class="pricing-card__amount">$20</span>
            <span class="pricing-card__period">/month</span>
          </div>
          <ul class="pricing-card__features">
            <li>Unlimited scans</li>
            <li>PDF exports</li>
            <li>All pro features</li>
          </ul>
          ${isCurrentPlan
            ? `<button class="pricing-card__button pricing-card__button--manage" data-action="portal">Manage Billing</button>`
            : isPro
              ? `<button class="pricing-card__button pricing-card__button--switch" data-action="checkout" data-type="subscription" data-interval="month" ${loading ? 'disabled' : ''}>Switch to Monthly</button>`
              : `<button class="pricing-card__button" data-action="checkout" data-type="subscription" data-interval="month" ${loading ? 'disabled' : ''}>${loading ? 'Loading...' : 'Start Monthly'}</button>`
          }
        </div>
      `;
    }

    if (type === 'yearly') {
      const isCurrentPlan = isPro && isYearly;
      return `
        <div class="pricing-card pricing-card--featured ${isCurrentPlan ? 'pricing-card--current' : ''}">
          ${isCurrentPlan ? renderProBadge() : renderSaveBadge()}
          <h4 class="pricing-card__name">Pro Yearly</h4>
          <div class="pricing-card__price">
            <span class="pricing-card__amount">$180</span>
            <span class="pricing-card__period">/year</span>
          </div>
          <p class="pricing-card__effective">$15/month effective</p>
          <ul class="pricing-card__features">
            <li>Unlimited scans</li>
            <li>PDF exports</li>
            <li>All pro features</li>
            <li>25% savings</li>
          </ul>
          ${isCurrentPlan
            ? `<button class="pricing-card__button pricing-card__button--manage" data-action="portal">Manage Billing</button>`
            : isPro
              ? `<button class="pricing-card__button pricing-card__button--switch" data-action="checkout" data-type="subscription" data-interval="year" ${loading ? 'disabled' : ''}>Switch to Yearly</button>`
              : `<button class="pricing-card__button pricing-card__button--featured" data-action="checkout" data-type="subscription" data-interval="year" ${loading ? 'disabled' : ''}>${loading ? 'Loading...' : 'Start Yearly'}</button>`
          }
        </div>
      `;
    }

    if (type === 'single') {
      const purchased = reportPurchased;
      return `
        <div class="pricing-card ${purchased ? 'pricing-card--purchased' : ''}">
          ${purchased ? renderPurchasedBadge() : ''}
          <h4 class="pricing-card__name">Single Report</h4>
          <div class="pricing-card__price">
            <span class="pricing-card__amount">$10</span>
            <span class="pricing-card__period">one-time</span>
          </div>
          <ul class="pricing-card__features">
            <li>This scan only</li>
            <li>PDF export</li>
            <li>All pro features</li>
          </ul>
          ${isPro
            ? `<button class="pricing-card__button" disabled>Included in Pro</button>`
            : purchased
              ? `<button class="pricing-card__button pricing-card__button--unlocked" disabled>Report Unlocked</button>`
              : `<button class="pricing-card__button" data-action="checkout" data-type="single_report" data-report-id="${reportId || ''}" ${loading || !reportId ? 'disabled' : ''}>${!reportId ? 'Run scan first' : loading ? 'Loading...' : 'Buy This Report'}</button>`
          }
        </div>
      `;
    }

    return '';
  }

  function renderError(message) {
    if (!message) return '';
    return `
      <div class="pricing-error">
        <span class="pricing-error__icon">!</span>
        <span class="pricing-error__message">${message}</span>
        <button class="pricing-error__retry" data-action="retry">Retry</button>
      </div>
    `;
  }

  function renderModalContent() {
    const { loading, error, billingStatus } = currentState;
    const reportId = getCurrentReportId();
    currentState.reportId = reportId;

    // Not logged in
    if (!isLoggedIn()) {
      return renderLoginPrompt();
    }

    const isPro = billingStatus?.plan === 'pro';
    const isYearly = billingStatus?.subscriptionInterval === 'year';
    const purchasedReports = billingStatus?.purchasedReports || [];
    const reportPurchased = reportId && purchasedReports.includes(reportId);

    return `
      ${error ? renderError(error) : ''}
      <div class="pricing-cards">
        ${renderPricingCard('monthly', { isPro, isYearly, loading })}
        ${renderPricingCard('yearly', { isPro, isYearly, loading })}
        ${renderPricingCard('single', { isPro, reportPurchased, loading, reportId })}
      </div>
      <p class="pricing-footer">
        ${isPro
          ? `You're on the Pro plan. <button class="pricing-footer__link" data-action="portal">Manage your subscription</button>`
          : 'All plans include a 7-day money-back guarantee.'
        }
      </p>
    `;
  }

  // ============================================
  // Modal Management
  // ============================================

  function updateModalContent() {
    const modalBody = document.querySelector('.modal-overlay[data-modal-id="pricing-modal"] .modal__body') ||
                      document.querySelector('#pricing-modal .modal__body');
    if (modalBody) {
      modalBody.innerHTML = renderModalContent();
      setupEventListeners(modalBody);
    }
  }

  async function open(options = {}) {
    const reportId = options.reportId || getCurrentReportId();
    currentState = {
      loading: false,
      error: null,
      billingStatus: null,
      reportId
    };

    // Pre-fetch billing status if logged in
    if (isLoggedIn()) {
      currentState.billingStatus = await fetchBillingStatus();
    }

    // Prefer the shared Modal component
    if (window.Modal && typeof window.Modal.open === 'function') {
      window.Modal.open('pricing-modal', {
        title: renderModalTitle(),
        size: 'large',
        className: 'modal--pricing',
        dismissible: true,
        showCloseButton: true,
        content: renderModalContent(),
        onOpen: () => {
          const overlay = document.querySelector('.modal-overlay[data-modal-id="pricing-modal"]');
          const modal = overlay ? overlay.querySelector('.modal') : null;
          if (modal) setupEventListeners(modal);
        }
      });
      return;
    }

    // Legacy fallback
    let modal = document.getElementById('pricing-modal');
    if (modal) modal.remove();

    const modalHTML = `
      <div class="modal-overlay" id="pricing-modal" role="dialog" aria-modal="true" aria-labelledby="pricing-modal-title">
        <div class="modal modal--large modal--pricing">
          <div class="modal__header">
            <h3 class="modal__title" id="pricing-modal-title">${renderModalTitle()}</h3>
            <button type="button" class="modal__close" data-modal-close="pricing-modal" aria-label="Close modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal__body">
            ${renderModalContent()}
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('pricing-modal');

    requestAnimationFrame(() => {
      modal.classList.add('modal-overlay--open');
      const content = modal.querySelector('.modal');
      if (content) content.classList.add('modal--open');
    });

    document.body.style.overflow = 'hidden';
    setupEventListeners(modal);
  }

  function openSingleReport(options = {}) {
    open({ reportId: options.reportId || getCurrentReportId() });
  }

  function close() {
    if (window.Modal && typeof window.Modal.close === 'function') {
      window.Modal.close('pricing-modal');
      return;
    }

    const modal = document.getElementById('pricing-modal');
    if (!modal) return;

    modal.classList.remove('modal-overlay--open');
    const content = modal.querySelector('.modal');
    if (content) content.classList.remove('modal--open');

    document.body.style.overflow = '';
    setTimeout(() => modal.remove(), 300);
  }

  // ============================================
  // Event Handlers
  // ============================================

  function setupEventListeners(container) {
    // Close button
    const closeBtn = container.querySelector('[data-modal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    // Overlay click
    if (container.classList && container.classList.contains('modal-overlay')) {
      container.addEventListener('click', (e) => {
        if (e.target === container) close();
      });
    }

    // Checkout buttons
    container.querySelectorAll('[data-action="checkout"]').forEach(btn => {
      btn.addEventListener('click', handleCheckout);
    });

    // Portal buttons
    container.querySelectorAll('[data-action="portal"]').forEach(btn => {
      btn.addEventListener('click', handlePortal);
    });

    // Retry button
    const retryBtn = container.querySelector('[data-action="retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', handleRetry);
    }

    // ESC key
    if (!window.Modal) {
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          close();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
    }
  }

  async function handleCheckout(e) {
    const btn = e.target.closest('[data-action="checkout"]');
    if (!btn || currentState.loading) return;

    const purchaseType = btn.dataset.type;
    const interval = btn.dataset.interval || null;
    const reportId = btn.dataset.reportId || currentState.reportId || null;

    if (purchaseType === 'single_report' && !reportId) {
      showToast('Run a scan first to purchase a report');
      return;
    }

    currentState.loading = true;
    currentState.error = null;
    updateModalContent();

    try {
      const checkoutUrl = await createCheckout(purchaseType, interval, reportId);
      window.location.href = checkoutUrl;
    } catch (err) {
      currentState.loading = false;
      currentState.error = err.message || 'Checkout failed. Please try again.';
      updateModalContent();
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
    updateModalContent();
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
    CREDIT_PACK_OPTIONS, // Legacy compat
    fetchBillingStatus,
    openBillingPortal
  };

})(window);
