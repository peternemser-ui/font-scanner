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
        <svg class="sm-modal-title__logo sm-modal-title__logo--red" width="240" height="36" viewBox="0 0 439 67" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path fill="#dd3838" d="M6.55,61.86c-1.11,0-2.01-.9-2.01-2.01v-3.99c0-1.08.9-1.98,2.01-1.98h20.94c.54,0,1.01-.47,1.01-1.01v-6.97H6.55c-1.11,0-2.01-.9-2.01-2.01v-11.96c0-1.11.9-2.01,2.01-2.01h4.96c.57,0,1.01-.43,1.01-1.01v-4.99c0-1.08.9-1.98,2.01-1.98h19.94c1.11,0,2.01.9,2.01,2.01v3.99c0,1.08-.9,1.98-2.01,1.98H13.53c-.54,0-1.01.47-1.01,1.01v6c0,.54.47.97,1.01.97h20.94c1.11,0,2.01.9,2.01,2.01v11.96c0,1.11-.9,2.01-2.01,2.01h-4.99c-.54,0-.97.43-.97,1.01v4.96c0,1.11-.9,2.01-2.01,2.01H6.55Z"/>
          <path fill="#dd3838" d="M43.15,13.98c-1.11,0-2.01-.9-2.01-2.01v-3.99c0-1.11.9-2.01,2.01-2.01h3.99c1.08,0,1.98.9,1.98,2.01v3.99c0,1.11-.9,2.01-1.98,2.01h-3.99ZM43.15,61.86c-1.11,0-2.01-.9-2.01-2.01V23.93c0-1.08.9-1.98,2.01-1.98h3.99c1.08,0,1.98.9,1.98,2.01v35.88c0,1.11-.9,2.01-1.98,2.01h-3.99Z"/>
          <path fill="#dd3838" d="M67.27,61.86c-1.11,0-2.01-.9-2.01-2.01v-4.96c0-.57-.43-1.01-.97-1.01h-4.99c-1.11,0-2.01-.9-2.01-2.01v-20.94c0-.54-.43-1.01-1.01-1.01h-4.96c-1.11,0-2.01-.9-2.01-1.98v-3.99c0-1.11.9-2.01,2.01-2.01h4.96c.57,0,1.01-.47,1.01-1.01V7.96c0-1.11.9-2.01,2.01-2.01h3.99c1.11,0,1.98.9,1.98,2.01v12.97c0,.54.47,1.01,1.01,1.01h12.97c1.11,0,2.01.9,2.01,1.98v3.99c0,1.11-.9,2.01-2.01,2.01h-12.97c-.54,0-1.01.47-1.01,1.01v21.95c0,.54.47,1.01,1.01,1.01h12.97c1.11,0,2.01.9,2.01,1.98v3.99c0,1.11-.9,2.01-2.01,2.01h-11.98Z"/>
          <path fill="#dd3838" d="M94.83,61.86c-1.11,0-2.01-.9-2.01-2.01v-4.96c0-.57-.43-1.01-1.01-1.01h-4.96c-1.11,0-2.01-.9-2.01-2.01v-19.94c0-1.11.9-2.01,2.01-2.01h4.96c.57,0,1.01-.43,1.01-1.01v-4.96c0-1.11.9-2.01,2.01-2.01h11.96c1.11,0,2.01.9,2.01,1.98v4.99c0,.57.43,1.01.97,1.01h4.99c1.11,0,2.01.9,2.01,2.01v11.96c0,1.11-.9,2.01-2.01,2.01h-20.94c-.54,0-1.01.43-1.01.97v6c0,.54.47,1.01,1.01,1.01h20.94c1.11,0,2.01.9,2.01,1.98v3.99c0,1.11-.9,2.01-2.01,2.01h-19.94,0ZM108.81,37.9v-6.97c0-.54-.47-1.01-1.01-1.01h-13.97c-.54,0-1.01.47-1.01,1.01v6c0,.54.47.97,1.01.97h14.98Z"/>
          <path fill="#dd3838" d="M148.11,61.86c-1.11,0-2.01-.9-2.01-2.01V23.97c0-1.11.9-2.01,2.01-2.01h19.94c1.11,0,2.01.9,2.01,2.01v4.96c0,.57.43,1.01.97,1.01h6c.54,0,1.01-.43,1.01-1.01v-4.96c0-1.11.9-2.01,1.98-2.01h12c1.08,0,1.98.9,1.98,2.01v4.96c0,.57.47,1.01,1.01,1.01h4.99c1.11,0,2.01.9,2.01,2.01v27.91c0,1.11-.9,2.01-2.01,2.01h-3.99c-1.11,0-2.01-.9-2.01-2.01v-28.92c0-.54-.43-1.01-.97-1.01h-13.97c-.57,0-1.01.47-1.01,1.01v28.92c0,1.11-.9,2.01-2.01,2.01h-3.99c-1.08,0-1.98-.9-1.98-2.01v-28.92c0-.54-.47-1.01-1.01-1.01h-13.97c-.54,0-1.01.47-1.01,1.01v28.92c0,1.11-.9,2.01-1.98,2.01h-3.99Z"/>
          <path fill="#dd3838" d="M216.79,61.86c-1.11,0-2.01-.9-2.01-2.01v-4.96c0-.57-.43-1.01-1.01-1.01h-4.96c-1.11,0-2.01-.9-2.01-2.01v-19.94c0-1.11.9-2.01,2.01-2.01h4.96c.57,0,1.01-.43,1.01-1.01v-4.96c0-1.11.9-2.01,2.01-2.01h11.96c1.11,0,2.01.9,2.01,1.98v4.99c0,.57.43,1.01.97,1.01h4.99c1.11,0,2.01.9,2.01,2.01v11.96c0,1.11-.9,2.01-2.01,2.01h-20.94c-.54,0-1.01.43-1.01.97v6c0,.54.47,1.01,1.01,1.01h20.94c1.11,0,2.01.9,2.01,1.98v3.99c0,1.11-.9,2.01-2.01,2.01h-19.94.01ZM230.76,37.9v-6.97c0-.54-.47-1.01-1.01-1.01h-13.97c-.54,0-1.01.47-1.01,1.01v6c0,.54.47.97,1.01.97h14.98Z"/>
          <path fill="#dd3838" d="M253.17,61.86c-1.11,0-2.01-.9-2.01-2.01v-4.96c0-.57-.43-1.01-1.01-1.01h-4.96c-1.11,0-2.01-.9-2.01-2.01v-19.94c0-1.11.9-2.01,2.01-2.01h4.96c.58,0,1.01-.43,1.01-1.01v-4.96c0-1.11.9-2.01,2.01-2.01h19.94c1.11,0,2.01.9,2.01,1.98v4.02c0,1.08-.9,1.98-2.01,1.98h-20.94c-.54,0-1.01.47-1.01,1.01v21.95c0,.54.47,1.01,1.01,1.01h20.94c1.11,0,2.01.9,2.01,1.98v3.99c0,1.11-.9,2.01-2.01,2.01h-19.94Z"/>
          <path fill="#dd3838" d="M281.58,61.86c-1.11,0-2.01-.9-2.01-2.01V7.98c0-1.11.9-2.01,2.01-2.01h3.99c1.08,0,1.98.9,1.98,2.01v12.97c0,.54.47,1.01,1.01,1.01h12.97c1.11,0,2.01.9,2.01,2.01v4.96c0,.57.43,1.01.97,1.01h4.99c1.11,0,2.01.9,2.01,2.01v27.91c0,1.11-.9,2.01-2.01,2.01h-3.99c-1.08,0-1.98-.9-1.98-2.01v-28.92c0-.54-.47-1.01-1.01-1.01h-13.97c-.54,0-1.01.47-1.01,1.01v28.92c0,1.11-.9,2.01-1.98,2.01h-3.99.01Z"/>
          <path fill="#dd3838" d="M326.16,61.86c-1.11,0-2.01-.9-2.01-2.01v-4.96c0-.57-.43-1.01-1-1.01h-4.96c-1.11,0-2.01-.9-2.01-2.01v-11.96c0-1.11.9-2.01,2.01-2.01h20.94c.54,0,1.01-.43,1.01-.97v-6c0-.54-.47-1.01-1.01-1.01h-20.94c-1.11,0-2.01-.9-2.01-1.98v-3.99c0-1.11.9-2.01,2.01-2.01h19.93c1.11,0,2.01.9,2.01,1.98v4.99c0,.57.43,1.01.97,1.01h4.99c1.11,0,2.01.9,2.01,2.01v27.91c0,1.11-.9,2.01-2.01,2.01h-19.94.01ZM339.12,53.89c.54,0,1.01-.47,1.01-1.01v-6c0-.54-.47-.97-1.01-.97h-14.98v6.97c0,.54.47,1.01,1.01,1.01h13.97Z"/>
          <path fill="#dd3838" d="M355.1,61.86c-1.11,0-2.01-.9-2.01-2.01V23.97c0-1.11.9-2.01,2.01-2.01h19.93c1.11,0,2.01.9,2.01,2.01v4.96c0,.57.43,1.01.97,1.01h4.99c1.11,0,2.01.9,2.01,2.01v27.91c0,1.11-.9,2.01-2.01,2.01h-3.99c-1.08,0-1.98-.9-1.98-2.01v-28.92c0-.54-.47-1.01-1.01-1.01h-13.97c-.54,0-1.01.47-1.01,1.01v28.92c0,1.11-.9,2.01-1.98,2.01h-3.99.03Z"/>
          <path fill="#dd3838" d="M392.02,13.98c-1.11,0-2.01-.9-2.01-2.01v-3.99c0-1.11.9-2.01,2.01-2.01h3.99c1.08,0,1.98.9,1.98,2.01v3.99c0,1.11-.9,2.01-1.98,2.01h-3.99ZM392.02,61.86c-1.11,0-2.01-.9-2.01-2.01V23.93c0-1.08.9-1.98,2.01-1.98h3.99c1.08,0,1.98.9,1.98,2.01v35.88c0,1.11-.9,2.01-1.98,2.01h-3.99Z"/>
          <path fill="#dd3838" d="M412.6,61.86c-1.11,0-2.01-.9-2.01-2.01v-4.96c0-.57-.43-1.01-1-1.01h-4.96c-1.11,0-2.01-.9-2.01-2.01v-19.94c0-1.11.9-2.01,2.01-2.01h4.96c.57,0,1-.43,1-1.01v-4.96c0-1.11.9-2.01,2.01-2.01h19.94c1.11,0,2.01.9,2.01,1.98v4.02c0,1.08-.9,1.98-2.01,1.98h-20.94c-.54,0-1.01.47-1.01,1.01v21.95c0,.54.47,1.01,1.01,1.01h20.94c1.11,0,2.01.9,2.01,1.98v3.99c0,1.11-.9,2.01-2.01,2.01h-19.94Z"/>
        </svg>
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
