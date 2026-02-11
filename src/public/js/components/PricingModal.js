/**
 * Site Mechanic - Pricing Modal Component
 * Swiss / International Typographic Style - Redesigned v2
 *
 * Pricing from window.PRICING (loaded from /js/pricing-config.js):
 * - Free: 10 scans/day, Pro sections gated
 * - Pro Monthly: $29/month - 250 reports/month, unlimited scans
 * - Pro Annual: $290/year ($24/mo effective) - unlimited reports & scans
 * - Day Pass: $20 for 24 hours - 30 reports, unlimited scans
 * - Single Report: $5 one-time - unlocks 1 report
 */

(function(window) {
  'use strict';

  // DEV flag - set to true to enable debug assertions
  const DEV_MODE = false;

  // Stripe logo SVG (adapts to theme via currentColor)
  const STRIPE_LOGO_SVG = `<svg class="sm-modal__footer-stripe" viewBox="0 0 60 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M60 12.8C60 8.55 57.95 5.2 54 5.2C50.05 5.2 47.6 8.55 47.6 12.75C47.6 17.7 50.5 20.35 54.65 20.35C56.7 20.35 58.25 19.85 59.45 19.1V15.85C58.25 16.55 56.85 17 55.1 17C53.4 17 51.9 16.35 51.7 14.25H59.95C59.95 14.05 60 13.15 60 12.8ZM51.65 11.35C51.65 9.35 52.85 8.45 54 8.45C55.1 8.45 56.25 9.35 56.25 11.35H51.65ZM41.2 5.2C39.45 5.2 38.35 6 37.75 6.5L37.55 5.45H33.9V24.55L38 23.7V19.95C38.6 20.35 39.5 20.9 41.15 20.9C44.55 20.9 47.6 18.3 47.6 12.85C47.55 7.85 44.45 5.2 41.2 5.2ZM40.3 17.05C39.15 17.05 38.5 16.65 38.05 16.15L38 9.55C38.5 9 39.2 8.6 40.3 8.6C42.1 8.6 43.35 10.55 43.35 12.85C43.35 15.2 42.1 17.05 40.3 17.05ZM28.05 4.3L32.2 3.45V0L28.05 0.85V4.3ZM32.2 5.45H28.05V20.6H32.2V5.45ZM23.65 6.7L23.4 5.45H19.8V20.6H23.9V10.1C24.85 8.85 26.45 9.1 26.95 9.25V5.45C26.4 5.25 24.6 4.9 23.65 6.7ZM15.4 1.8L11.4 2.65L11.35 16.35C11.35 18.65 13.1 20.4 15.4 20.4C16.65 20.4 17.55 20.2 18.05 19.9V16.55C17.55 16.75 15.35 17.4 15.35 15.1V8.8H18.05V5.45H15.35L15.4 1.8ZM4.15 9.9C4.15 9.2 4.75 8.9 5.7 8.9C7.05 8.9 8.75 9.3 10.1 10.05V6.2C8.65 5.6 7.2 5.35 5.7 5.35C2.3 5.35 0 7.2 0 10.1C0 14.7 6.35 13.95 6.35 15.95C6.35 16.8 5.6 17.1 4.6 17.1C3.1 17.1 1.2 16.5 0.2 15.55V19.5C1.55 20.1 2.95 20.4 4.6 20.4C8.1 20.4 10.55 18.6 10.55 15.65C10.5 10.65 4.15 11.55 4.15 9.9Z" fill="currentColor"/>
  </svg>`;

  // Helper function to get translated text (falls back to English if i18n not ready)
  function t(key, fallback) {
    if (window.i18n && typeof window.i18n.t === 'function') {
      const val = window.i18n.t(key);
      // If t() returns the key itself, use fallback
      return (val === key && fallback) ? fallback : val;
    }
    return fallback || key;
  }

  // Plan benefit keys (translated dynamically)
  // Updated with specific limits per plan
  function getPlanBenefits(type) {
    const limits = window.PRICING?.plans || {};
    const benefitKeys = {
      monthly: [
        { key: 'pricing.benefits.unlimitedScans', fallback: 'Unlimited scans' },
        { key: 'pricing.benefits.reportsPerMonth', fallback: `${limits.pro_monthly?.limits?.paidReportsPerWindow || 250} reports/month` },
        { key: 'pricing.benefits.exportPdfs', fallback: 'Export PDFs' },
        { key: 'pricing.benefits.cancelAnytime', fallback: 'Cancel anytime' }
      ],
      yearly: [
        { key: 'pricing.benefits.unlimitedScans', fallback: 'Unlimited scans' },
        { key: 'pricing.benefits.unlimitedReports', fallback: 'Unlimited reports' },
        { key: 'pricing.benefits.exportPdfs', fallback: 'Export PDFs' },
        { key: 'pricing.benefits.bestValue', fallback: 'Best value' }
      ],
      daypass: [
        { key: 'pricing.benefits.unlimitedScans24h', fallback: 'Unlimited scans for 8h' },
        { key: 'pricing.benefits.reportsPerPass', fallback: `${limits.day_pass?.limits?.paidReportsPerWindow || 30} reports included` },
        { key: 'pricing.benefits.exportPdfs', fallback: 'Export PDFs' },
        { key: 'pricing.benefits.noAutoRenewal', fallback: 'No auto-renewal' }
      ],
      single: [
        { key: 'pricing.benefits.unlocksThisReport', fallback: 'Unlocks this report' },
        { key: 'pricing.benefits.exportPdf', fallback: 'Export PDF' },
        { key: 'pricing.benefits.permanentAccess', fallback: 'Permanent access' }
      ]
    };
    return (benefitKeys[type] || []).map(b => t(b.key, b.fallback));
  }

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

  function applyFontSize(container, size) {
    const panel = container.querySelector('.sm-modal__panel');
    if (!panel) return;
    panel.classList.remove('sm-modal__panel--font-small', 'sm-modal__panel--font-large');
    if (size === 'small') {
      panel.classList.add('sm-modal__panel--font-small');
    } else if (size === 'large') {
      panel.classList.add('sm-modal__panel--font-large');
    }
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
      throw new Error(t('pricing.modal.pleaseLoginToContinue', 'Please log in to continue'));
    }

    const body = { purchaseType };
    if (interval) body.interval = interval;
    if (reportId) body.reportId = reportId;

    // Include locale for Stripe checkout page language
    const currentLocale = window.i18n?.currentLanguage || localStorage.getItem('sm_lang') || 'en';
    body.locale = currentLocale;

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
      throw new Error(data.message || data.error || t('errors.checkoutFailed', 'Checkout failed'));
    }

    return data.checkoutUrl;
  }

  async function openBillingPortal() {
    const token = getAuthToken();
    if (!token) {
      showToast(t('pricing.modal.pleaseLoginToManageBilling', 'Please log in to manage billing'));
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
        showToast(data.error || t('errors.unableToOpenBillingPortal', 'Unable to open billing portal'));
      }
    } catch (e) {
      showToast(t('errors.unableToOpenBillingPortal', 'Unable to open billing portal'));
    }
  }

  // ============================================
  // Render Functions
  // ============================================

  function renderHeader() {
    // Use red logo for light mode, cyan logo for dark mode
    const isLightMode = document.body.classList.contains('white-theme');
    const logoSrc = isLightMode ? '/assets/logo-light.svg' : '/assets/logo-dark.svg';

    return `
      <header class="sm-modal__header">
        <div class="sm-modal__header-left">
          <img class="sm-modal__logo" src="${logoSrc}" alt="Site Mechanic" />
        </div>
        <h2 class="sm-modal__title">${t('pricing.modal.unlockProFeatures', 'Unlock Pro Features')}</h2>
        <button type="button" class="sm-modal__close" data-action="close" aria-label="${t('pricing.modal.closeModal', 'Close modal')}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </header>
    `;
  }

  function renderLoginPrompt() {
    return `
      <div class="sm-pricing-login">
        <p class="sm-pricing-login__text">${t('pricing.modal.loginPrompt', 'Sign in to purchase a subscription or single report.')}</p>
        <div class="sm-pricing-login__actions">
          <a href="/auth.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}" class="sm-btn sm-btn--primary">${t('pricing.modal.signIn', 'Sign In')}</a>
          <a href="/auth.html?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}&mode=signup" class="sm-btn sm-btn--outline">${t('pricing.modal.createAccount', 'Create Account')}</a>
        </div>
      </div>
    `;
  }

  function renderError(message) {
    if (!message) return '';
    return `
      <div class="sm-pricing-error" role="alert">
        <span class="sm-pricing-error__icon" aria-hidden="true">!</span>
        <span class="sm-pricing-error__msg">${message}</span>
        <button class="sm-pricing-error__retry" data-action="retry">${t('pricing.modal.retry', 'Retry')}</button>
      </div>
    `;
  }

  function renderBenefits(benefitsArray) {
    return `
      <ul class="sm-plan-card__benefits">
        ${benefitsArray.map(b => `<li class="sm-plan-card__benefit">${b}</li>`).join('')}
      </ul>
    `;
  }

  function renderPlanCard(type, options = {}) {
    const { isPro, isYearly, reportPurchased, loading, reportId } = options;

    // Monthly Plan
    if (type === 'monthly') {
      const isCurrentPlan = isPro && !isYearly && !options.isDay;
      const cardClass = isCurrentPlan ? 'sm-plan-card sm-plan-card--current' : 'sm-plan-card';

      let buttonHtml;
      if (isCurrentPlan) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--current" data-action="portal">${t('pricing.buttons.managePlan', 'Manage Plan')}</button>`;
      } else if (isPro) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--secondary" data-action="checkout" data-type="subscription" data-interval="month" ${loading ? 'disabled' : ''}>${t('pricing.buttons.switchToMonthly', 'Switch to Monthly')}</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--primary" data-action="checkout" data-type="subscription" data-interval="month" ${loading ? 'disabled' : ''}>${loading ? t('pricing.buttons.processing', 'Processing...') : t('pricing.buttons.subscribe', 'Subscribe')}</button>`;
      }

      // Get price from centralized config
      const monthlyPrice = window.PRICING?.plans?.pro_monthly?.price || 29;

      return `
        <article class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__name">${t('pricing.plans.proMonthly', 'Pro Monthly')}</h3>
            ${isCurrentPlan ? `<span class="sm-plan-card__badge sm-plan-card__badge--current">${t('pricing.badges.current', 'Current')}</span>` : ''}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$${monthlyPrice}</span>
            <span class="sm-plan-card__period">${t('pricing.periods.perMonth', 'per month')}</span>
          </div>
          ${renderBenefits(getPlanBenefits('monthly'))}
          <div class="sm-plan-card__footer">
            ${buttonHtml}
          </div>
        </article>
      `;
    }

    // Yearly Plan (Featured/Recommended)
    if (type === 'yearly') {
      const isCurrentPlan = isPro && isYearly;
      const cardClass = isCurrentPlan
        ? 'sm-plan-card sm-plan-card--featured sm-plan-card--current'
        : 'sm-plan-card sm-plan-card--featured';

      let buttonHtml;
      if (isCurrentPlan) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--current" data-action="portal">${t('pricing.buttons.managePlan', 'Manage Plan')}</button>`;
      } else if (isPro) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--secondary" data-action="checkout" data-type="subscription" data-interval="year" ${loading ? 'disabled' : ''}>${t('pricing.buttons.switchToYearly', 'Switch to Yearly')}</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--featured" data-action="checkout" data-type="subscription" data-interval="year" ${loading ? 'disabled' : ''}>${loading ? t('pricing.buttons.processing', 'Processing...') : t('pricing.buttons.subscribe', 'Subscribe')}</button>`;
      }

      // Get prices from centralized config
      const annualPrice = window.PRICING?.plans?.pro_annual?.price || 290;
      const effectiveMonthly = window.PRICING?.plans?.pro_annual?.effectiveMonthly || 24;
      const savings = window.PRICING?.plans?.pro_annual?.savings || 60;

      return `
        <article class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__name">${t('pricing.plans.proYearly', 'Pro Yearly')}</h3>
            ${isCurrentPlan
              ? `<span class="sm-plan-card__badge sm-plan-card__badge--current">${t('pricing.badges.current', 'Current')}</span>`
              : `<span class="sm-plan-card__badge sm-plan-card__badge--save">${t('pricing.badges.save', 'Save ${{amount}}').replace('{{amount}}', savings)}</span>`}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$${annualPrice}</span>
            <span class="sm-plan-card__period">${t('pricing.periods.perYear', 'per year')}</span>
            <span class="sm-plan-card__effective">${t('pricing.periods.effectiveMonthly', '${{amount}}/mo effective').replace('{{amount}}', effectiveMonthly)}</span>
          </div>
          ${renderBenefits(getPlanBenefits('yearly'))}
          <div class="sm-plan-card__footer">
            ${buttonHtml}
          </div>
        </article>
      `;
    }

    // Day Pass
    if (type === 'daypass') {
      const isDay = options.isDay;
      const isCurrentPlan = isPro && isDay;
      const cardClass = isCurrentPlan ? 'sm-plan-card sm-plan-card--current' : 'sm-plan-card';

      let buttonHtml;
      if (isCurrentPlan) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--current" data-action="portal">${t('pricing.buttons.activePass', 'Active Pass')}</button>`;
      } else if (isPro) {
        // User already has monthly/yearly, don't offer downgrade to day pass
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--disabled" disabled>${t('pricing.buttons.youHavePro', 'You have Pro')}</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--primary" data-action="checkout" data-type="subscription" data-interval="day" ${loading ? 'disabled' : ''}>${loading ? t('pricing.buttons.processing', 'Processing...') : t('pricing.buttons.getDayPass', 'Get Day Pass')}</button>`;
      }

      // Get price from centralized config
      const dayPassPrice = window.PRICING?.plans?.day_pass?.price || 20;

      return `
        <article class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__name">${t('pricing.plans.dayPass', 'Day Pass')}</h3>
            ${isCurrentPlan ? `<span class="sm-plan-card__badge sm-plan-card__badge--current">${t('pricing.badges.active', 'Active')}</span>` : ''}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$${dayPassPrice}</span>
            <span class="sm-plan-card__period">${t('pricing.periods.hours24', '24 hours')}</span>
          </div>
          ${renderBenefits(getPlanBenefits('daypass'))}
          <div class="sm-plan-card__footer">
            ${buttonHtml}
          </div>
        </article>
      `;
    }

    // Single Report
    if (type === 'single') {
      const purchased = reportPurchased;
      const cardClass = purchased ? 'sm-plan-card sm-plan-card--purchased' : 'sm-plan-card';

      let buttonHtml;
      if (isPro) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--disabled" disabled>${t('pricing.buttons.includedWithPro', 'Included with Pro')}</button>`;
      } else if (purchased) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--purchased" disabled>${t('pricing.buttons.purchased', 'Purchased')}</button>`;
      } else if (!reportId) {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--disabled" disabled>${t('pricing.buttons.runScanFirst', 'Run scan first')}</button>`;
      } else {
        buttonHtml = `<button class="sm-plan-card__btn sm-plan-card__btn--primary" data-action="checkout" data-type="single_report" data-report-id="${reportId}" ${loading ? 'disabled' : ''}>${loading ? t('pricing.buttons.processing', 'Processing...') : t('pricing.buttons.buyReport', 'Buy Report')}</button>`;
      }

      // Get price from centralized config
      const singleReportPrice = window.PRICING?.oneTimePurchases?.single_report?.price || 5;

      return `
        <article class="${cardClass}">
          <div class="sm-plan-card__header">
            <h3 class="sm-plan-card__name">${t('pricing.plans.thisReport', 'This Report')}</h3>
            ${purchased ? `<span class="sm-plan-card__badge sm-plan-card__badge--purchased">${t('pricing.badges.owned', 'Owned')}</span>` : ''}
          </div>
          <div class="sm-plan-card__price">
            <span class="sm-plan-card__amount">$${singleReportPrice}</span>
            <span class="sm-plan-card__period">${t('pricing.periods.oneTime', 'one-time')}</span>
          </div>
          ${renderBenefits(getPlanBenefits('single'))}
          <div class="sm-plan-card__footer">
            ${buttonHtml}
          </div>
        </article>
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

    const isPro = billingStatus?.plan === 'pro' || billingStatus?.plan === 'day_pass';
    const isYearly = billingStatus?.subscriptionInterval === 'year';
    const isDay = billingStatus?.plan === 'day_pass' || billingStatus?.subscriptionInterval === 'day';
    const purchasedReports = billingStatus?.purchasedReports || [];
    const reportPurchased = reportId && purchasedReports.includes(reportId);

    console.log('[PricingModal] renderBody billing check:', {
      reportId,
      isPro,
      purchasedReports,
      reportPurchased,
      billingStatus
    });

    // Always show single report card
    return `
      ${error ? renderError(error) : ''}
      <div class="sm-pricing-grid">
        ${renderPlanCard('monthly', { isPro, isYearly, isDay, loading })}
        ${renderPlanCard('yearly', { isPro, isYearly, isDay, loading })}
        ${renderPlanCard('daypass', { isPro, isYearly, isDay, loading })}
        ${renderPlanCard('single', { isPro, reportPurchased, loading, reportId })}
      </div>
    `;
  }

  function renderFooter() {
    const plan = currentState.billingStatus?.plan;
    const isPro = plan === 'pro' || plan === 'day_pass';

    if (isPro) {
      return `
        <footer class="sm-modal__footer">
          <span class="sm-modal__footer-text">${t('pricing.modal.poweredBy', 'Powered by')}</span>
          ${STRIPE_LOGO_SVG}
          <span class="sm-modal__footer-sep">·</span>
          <button class="sm-modal__footer-link" data-action="portal">${t('pricing.modal.manageSubscription', 'Manage subscription')}</button>
        </footer>
      `;
    }

    return `
      <footer class="sm-modal__footer">
        <span class="sm-modal__footer-text">${t('pricing.modal.poweredBy', 'Powered by')}</span>
        ${STRIPE_LOGO_SVG}
      </footer>
    `;
  }

  function renderModal() {
    return `
      <div class="sm-modal__overlay" data-pricing-modal role="dialog" aria-modal="true" aria-labelledby="sm-modal-title">
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

    // Font size toggle
    container.querySelectorAll('[data-font-size]').forEach(btn => {
      btn.onclick = () => {
        const size = btn.dataset.fontSize;
        applyFontSize(container, size);
        localStorage.setItem('sm-modal-font-size', size);
        // Update active state on buttons
        container.querySelectorAll('[data-font-size]').forEach(b => {
          b.classList.toggle('sm-modal__font-btn--active', b.dataset.fontSize === size);
        });
      };
    });

    // Apply saved font size on open
    const savedSize = localStorage.getItem('sm-modal-font-size') || 'normal';
    applyFontSize(container, savedSize);

    // Accessibility: Focus trap within modal
    const focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = container.querySelectorAll(focusableSelector);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element when modal opens
    if (firstFocusable) {
      setTimeout(() => firstFocusable.focus(), 100);
    }

    const trapFocus = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: if on first element, go to last
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };
    container.addEventListener('keydown', trapFocus);

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
      showToast(t('pricing.buttons.runScanFirst', 'Run a scan first to purchase a report'));
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
      // Use unique key per analyzer+url to prevent cross-scan collisions
      if (resultsToSave) {
        try {
          const normalizedUrl = window.ReportUI?.normalizeUrlForReportId?.(urlToAnalyze) || urlToAnalyze;
          const urlHash = window.ReportUI?.hashForStorageKey?.(normalizedUrl) || normalizedUrl.replace(/[^a-z0-9]/gi, '').slice(0, 16);
          const checkoutKey = `sm_checkout_${analyzerType}_${urlHash}`;

          sessionStorage.setItem(checkoutKey, JSON.stringify({
            results: resultsToSave,
            analyzer: analyzerType,
            url: urlToAnalyze,
            timestamp: Date.now()
          }));
          // Store which key to read later
          sessionStorage.setItem('sm_checkout_key', checkoutKey);
          // Keep legacy keys for backwards compatibility during transition
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
      currentState.error = err.message || t('errors.checkoutFailedRetry', 'Checkout failed. Please try again.');
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
