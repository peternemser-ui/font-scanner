(function (window) {
  'use strict';

  function showToast(message) {
    if (!message) return;
    if (window.ReportUI && typeof window.ReportUI.toast === 'function') {
      window.ReportUI.toast(message);
      return;
    }
    // eslint-disable-next-line no-alert
    alert(String(message));
  }

  function getCurrentReportId(fallback) {
    const fromBody = document.body && document.body.getAttribute('data-report-id');
    if (fromBody) return fromBody;
    return fallback || '';
  }

  function loadScriptOnce(src) {
    return new Promise(function (resolve) {
      const existing = document.querySelector('script[src="' + src + '"]');
      if (existing) return resolve(true);
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(true); };
      s.onerror = function () { resolve(false); };
      document.head.appendChild(s);
    });
  }

  async function ensureCreditsManager() {
    if (window.CreditsManager) return true;
    return loadScriptOnce('/assets/js/ui.js');
  }

  async function ensurePricingModal() {
    if (window.PricingModal && typeof window.PricingModal.open === 'function') return true;
    // PricingModal prefers Modal.js when present.
    if (!window.Modal) {
      await loadScriptOnce('/js/components/Modal.js');
    }
    return loadScriptOnce('/js/components/PricingModal.js');
  }

  function render(reportId) {
    if (!window.CreditsManager || typeof window.CreditsManager.renderPaywallState !== 'function') return;
    window.CreditsManager.renderPaywallState(reportId);
  }

  async function unlockWithCredit(reportId) {
    await ensureCreditsManager();
    const id = getCurrentReportId(reportId);
    if (!id || !window.CreditsManager) return false;

    try {
      window.CreditsManager.consumeCredit();
      window.CreditsManager.unlockReport(id, 'credit');
      render(id);
      showToast('Report unlocked.');
      return true;
    } catch (e) {
      showToast('No credits available.');
      return false;
    }
  }

  async function openPricing() {
    await ensurePricingModal();
    if (window.PricingModal && typeof window.PricingModal.open === 'function') {
      window.PricingModal.open();
      return true;
    }
    return false;
  }

  function wireDomHandlers() {
    document.addEventListener('click', function (e) {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const unlockBtn = target.closest('[data-unlock-with-credit]');
      if (unlockBtn) {
        e.preventDefault();
        const rid = unlockBtn.getAttribute('data-report-id') || getCurrentReportId('');
        unlockWithCredit(rid);
        return;
      }

      const pricingBtn = target.closest('[data-open-pricing-modal]');
      if (pricingBtn) {
        e.preventDefault();
        openPricing();
        return;
      }

      const buySingleBtn = target.closest('[data-buy-single-report]');
      if (buySingleBtn) {
        e.preventDefault();
        const reportId = buySingleBtn.getAttribute('data-report-id') || getCurrentReportId('');
        if (!reportId || !window.SmBilling || typeof window.SmBilling.startCheckout !== 'function') {
          showToast('Checkout is unavailable right now.');
          return;
        }
        window.SmBilling.startCheckout({
          purchaseType: 'single_report',
          reportId: reportId,
          returnUrl: window.SmBilling.buildReturnUrl ? window.SmBilling.buildReturnUrl() : undefined
        }).catch(function () {
          showToast('Checkout is unavailable right now.');
        });
      }
    });
  }

  function init(opts) {
    const o = opts || {};
    const reportId = getCurrentReportId(o.reportId || '');

    ensureCreditsManager().then(function () {
      if (reportId) render(reportId);
    });

    wireDomHandlers();
  }

  window.SmEntitlements = {
    init: init,
    ensureCreditsManager: ensureCreditsManager,
    render: render,
    unlockWithCredit: unlockWithCredit,
    openPricing: openPricing
  };
})(window);
