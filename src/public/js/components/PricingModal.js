/**
 * Site Mechanic - Pricing Modal Component
 * Shows credit pack purchase options
 *
 * No signup required - direct Stripe checkout
 */

(function(window) {
  const CREDIT_PACK_OPTIONS = [
    { id: 'pack-5', credits: 5, price: 40, perReport: 8 },
    { id: 'pack-10', credits: 10, price: 70, perReport: 7 },
    { id: 'pack-25', credits: 25, price: 150, perReport: 6 },
  ];

  function renderModalTitle(label) {
    const safeLabel = String(label || '').trim();
    return `
      <span class="sm-modal-title">
        <img class="sm-modal-title__logo app-logo-dark" src="/assets/logo-dark.svg" alt="Site Mechanic" />
        <img class="sm-modal-title__logo app-logo-light" src="/assets/logo-light.svg" alt="Site Mechanic" />
        <span class="sm-modal-title__text">${safeLabel}</span>
      </span>
    `;
  }

  function renderSingleReportModalTitle(label) {
    const safeLabel = String(label || '').trim();
    return `
      <span class="sm-modal-title sm-modal-title--stacked">
        <span class="sm-modal-title__brand">Site Mechanic</span>
        <span class="sm-modal-title__text">${safeLabel}</span>
      </span>
    `;
  }

  function showToast(message) {
    if (!message) return;
    if (window.ReportUI && typeof window.ReportUI.toast === 'function') {
      window.ReportUI.toast(message);
      return;
    }
    // Fallback (older pages)
    // eslint-disable-next-line no-alert
    alert(String(message));
  }

  function getReportUrl() {
    const input = document.getElementById('urlInput') || document.querySelector('input[type="url"], input[name="url"], input[id*="url" i]');
    const value = input && typeof input.value === 'string' ? input.value.trim() : '';
    if (value) return value;

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('url');
    return fromQuery ? fromQuery.trim() : '';
  }

  function getAnalyzerKey() {
    return (
      document.body.getAttribute('data-sm-analyzer-key') ||
      document.body.getAttribute('data-analyzer-key') ||
      window.SM_ANALYZER_KEY ||
      ''
    );
  }

  function getScanStartedAt() {
    return (
      document.body.getAttribute('data-sm-scan-started-at') ||
      window.SM_SCAN_STARTED_AT ||
      ''
    );
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

    // Fallback: best-effort stable id (should rarely run if /js/report-ui.js is loaded)
    const safeUrl = (url || '').trim().replace(/\s+/g, ' ').replace(/\/$/, '');
    const ts = (startedAt || '').trim();
    const key = (analyzerKey || '').trim();
    if (!safeUrl || !ts || !key) return '';

    const raw = `${key}|${safeUrl}|${ts}`;
    const encoded = base64UrlEncode(raw);
    return encoded ? `r_${encoded}` : '';
  }

  /**
   * Render individual pricing option
   */
  function renderPricingOption(option) {
    const label = `${option.credits} credits — $${option.price} ($${option.perReport}/report)`;
    return `
      <div class="pricing-option">
        <div class="pricing-option__header">
          <h4 class="pricing-option__name">${label}</h4>
        </div>
        <button
          class="pricing-option__button"
          data-purchase-option="${option.id}"
          data-price="${option.price}"
          data-credits="${option.credits}">
          Buy ${option.credits} credits
        </button>
      </div>
    `;
  }

  /**
   * Open pricing modal
   */
  function open() {
    // Prefer the shared Modal component (adds focus trap + ESC close)
    if (window.Modal && typeof window.Modal.open === 'function') {
      window.Modal.open('pricing-modal', {
        title: renderModalTitle('Buy credits & save'),
        size: 'large',
        dismissible: true,
        showCloseButton: true,
        content: `
          <div class="pricing-options">
            ${CREDIT_PACK_OPTIONS.map(option => renderPricingOption(option)).join('')}
          </div>
        `,
        onOpen: () => {
          const overlay = document.querySelector('.modal-overlay[data-modal-id="pricing-modal"]');
          const modal = overlay ? overlay.querySelector('.modal') : null;
          if (modal) setupEventListeners(modal);
        }
      });
      return;
    }

    // Check if modal already exists
    let modal = document.getElementById('pricing-modal');

    if (!modal) {
      // Create modal
      const modalHTML = `
        <div class="modal-overlay" id="pricing-modal" role="dialog" aria-modal="true" aria-labelledby="pricing-modal-title">
          <div class="modal modal--large">
            <div class="modal__header">
              <h3 class="modal__title" id="pricing-modal-title">${renderModalTitle('Buy credits & save')}</h3>
              <button type="button" class="modal__close" data-modal-close="pricing-modal" aria-label="Close modal">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div class="modal__body">
              <div class="pricing-options">
                ${CREDIT_PACK_OPTIONS.map(option => renderPricingOption(option)).join('')}
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHTML);
      modal = document.getElementById('pricing-modal');
    }

    // Show modal
    requestAnimationFrame(() => {
      modal.classList.add('modal-overlay--open');
      const modalContent = modal.querySelector('.modal');
      if (modalContent) {
        modalContent.classList.add('modal--open');
      }
    });

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Set up event listeners
    setupEventListeners(modal);
  }

  function openSingleReport(options = {}) {
    const reportId = typeof options.reportId === 'string' ? options.reportId.trim() : '';

    // Prefer the shared Modal component
    if (window.Modal && typeof window.Modal.open === 'function') {
      window.Modal.open('single-report-modal', {
        title: renderSingleReportModalTitle('Unlock this report'),
        size: 'small',
        className: 'modal--single-report',
        dismissible: true,
        showCloseButton: true,
        content: `
          <div class="pricing-options">
            <div class="pricing-option">
              <div class="pricing-option__header">
                <h4 class="pricing-option__name">Single report — $10</h4>
                <p class="pricing-option__description">Unlock paid sections + client-ready exports for this scan.</p>
              </div>
              <button class="pricing-option__button" data-purchase-single-report ${reportId ? `data-report-id="${reportId}"` : ''}>
                Buy single report — $10
              </button>
            </div>
          </div>
        `,
        onOpen: () => {
          const overlay = document.querySelector('.modal-overlay[data-modal-id="single-report-modal"]');
          const modal = overlay ? overlay.querySelector('.modal') : null;
          if (modal) setupEventListeners(modal);
        }
      });
      return;
    }

    // Legacy fallback if Modal.js isn't present
    const modalHTML = `
      <div class="modal-overlay" id="single-report-modal" role="dialog" aria-modal="true" aria-labelledby="single-report-modal-title">
        <div class="modal modal--small modal--single-report">
          <div class="modal__header">
            <h3 class="modal__title" id="single-report-modal-title">${renderSingleReportModalTitle('Unlock this report')}</h3>
            <button type="button" class="modal__close" data-modal-close="single-report-modal" aria-label="Close modal">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div class="modal__body">
            <div class="pricing-options">
              <div class="pricing-option">
                <div class="pricing-option__header">
                  <h4 class="pricing-option__name">Single report — $10</h4>
                  <p class="pricing-option__description">Unlock paid sections + client-ready exports for this scan.</p>
                </div>
                <button class="pricing-option__button" data-purchase-single-report ${reportId ? `data-report-id="${reportId}"` : ''}>
                  Buy single report — $10
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const overlay = document.getElementById('single-report-modal');
    requestAnimationFrame(() => {
      overlay.classList.add('modal-overlay--open');
      const content = overlay.querySelector('.modal');
      if (content) content.classList.add('modal--open');
    });
    document.body.style.overflow = 'hidden';
    setupEventListeners(overlay);
  }

  /**
   * Close pricing modal
   */
  function close() {
    if (window.Modal && typeof window.Modal.close === 'function') {
      window.Modal.close('pricing-modal');
      return;
    }

    const modal = document.getElementById('pricing-modal');
    if (!modal) return;

    modal.classList.remove('modal-overlay--open');
    const modalContent = modal.querySelector('.modal');
    if (modalContent) {
      modalContent.classList.remove('modal--open');
    }

    // Restore body scroll
    document.body.style.overflow = '';

    // Remove modal after animation
    setTimeout(() => {
      modal.remove();
    }, 300);
  }

  /**
   * Setup event listeners for pricing modal
   */
  function setupEventListeners(modal) {
    // Close button
    const closeBtn = modal.querySelector('[data-modal-close]');
    if (closeBtn) {
      closeBtn.addEventListener('click', close);
    }

    // Overlay click (legacy mode only)
    if (modal.classList && modal.classList.contains('modal-overlay')) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          close();
        }
      });
    }

    // Purchase buttons
    const purchaseButtons = modal.querySelectorAll('[data-purchase-option]');
    purchaseButtons.forEach(button => {
      button.addEventListener('click', () => {
        const optionId = button.dataset.purchaseOption;
        handlePurchase(optionId);
      });
    });

    // Single report purchase button
    const singleBtn = modal.querySelector('[data-purchase-single-report]');
    if (singleBtn) {
      singleBtn.addEventListener('click', () => {
        const reportId = singleBtn.getAttribute('data-report-id') || document.body.getAttribute('data-report-id') || '';
        handleSingleReportPurchase(reportId);
      });
    }

    // ESC key handled by Modal.js when present
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

  /**
   * Handle purchase action
   * This would integrate with Stripe in production
   */
  function handlePurchase(optionId) {
    // For demo purposes, add credits to localStorage
    // In production, this would:
    // 1. Open Stripe checkout
    // 2. Process payment
    // 3. Update credits on success via API callback

    const packId = optionId === 'pack-5' ? 'pack_5' :
                   optionId === 'pack-10' ? 'pack_10' :
                   optionId === 'pack-25' ? 'pack_25' : null;

    if (!packId) {
      showToast('That credit pack is unavailable right now.');
      return;
    }

    // reportId is only required for single_report; for credit packs it's optional.
    let reportId = document.body.getAttribute('data-report-id') || '';
    if (!reportId) {
      reportId = computeReportId(getReportUrl(), getScanStartedAt(), getAnalyzerKey());
      if (reportId) document.body.setAttribute('data-report-id', reportId);
    }

    const params = new URLSearchParams(window.location.search);
    params.delete('session_id');
    params.delete('sessionId');
    params.delete('canceled');
    if (reportId) params.set('reportId', reportId);
    const returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

    fetch('/api/billing/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchaseType: 'credit_pack',
        packId,
        reportId: reportId || null,
        returnUrl
      })
    })
      .then(async (resp) => {
        const data = await resp.json().catch(() => null);
        if (resp.ok && data && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        alert('Checkout is unavailable right now. Please try again.');
      })
      .catch(() => {
        alert('Checkout is unavailable right now. Please try again.');
      });
  }

  function handleSingleReportPurchase(reportIdInput) {
    const reportId = typeof reportIdInput === 'string' ? reportIdInput.trim() : '';
    if (!reportId) {
      showToast('Run a scan first to buy this report.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    params.delete('session_id');
    params.delete('sessionId');
    params.delete('canceled');
    params.set('reportId', reportId);
    const returnUrl = `${window.location.origin}${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;

    fetch('/api/billing/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        purchaseType: 'single_report',
        packId: null,
        reportId,
        returnUrl
      })
    })
      .then(async (resp) => {
        const data = await resp.json().catch(() => null);
        if (resp.ok && data && data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }
        alert('Checkout is unavailable right now. Please try again.');
      })
      .catch(() => {
        alert('Checkout is unavailable right now. Please try again.');
      });
  }

  // Public API
  window.PricingModal = {
    open,
    openSingleReport,
    close,
    CREDIT_PACK_OPTIONS
  };

})(window);
