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

  async function ensureProReportBlock() {
    if (window.ProReportBlock) return true;
    return loadScriptOnce('/js/components/ProReportBlock.js');
  }

  async function ensurePricingModal() {
    if (window.PricingModal && typeof window.PricingModal.open === 'function') return true;
    // PricingModal prefers Modal.js when present.
    if (!window.Modal) {
      await loadScriptOnce('/js/components/Modal.js');
    }
    return loadScriptOnce('/js/components/PricingModal.js');
  }

  /**
   * Check if user has access to a report (Pro subscription or purchased)
   */
  function hasAccess(reportId) {
    if (window.ProReportBlock?.hasAccess) {
      return window.ProReportBlock.hasAccess(reportId);
    }
    return false;
  }

  /**
   * Check if user is a Pro subscriber
   */
  function isPro() {
    if (window.ProReportBlock?.isProSubscriber) {
      return window.ProReportBlock.isProSubscriber();
    }
    return false;
  }

  async function openPricing(opts) {
    await ensurePricingModal();
    if (window.PricingModal && typeof window.PricingModal.open === 'function') {
      window.PricingModal.open(opts);
      return true;
    }
    return false;
  }

  async function openSingleReportPurchase(reportId) {
    await ensurePricingModal();
    if (window.PricingModal && typeof window.PricingModal.openSingleReport === 'function') {
      window.PricingModal.openSingleReport({ reportId });
      return true;
    }
    // Fallback: open general pricing modal
    return openPricing();
  }

  function wireDomHandlers() {
    document.addEventListener('click', function (e) {
      const target = e.target;
      if (!(target instanceof Element)) return;

      // Legacy unlock-with-credit - redirect to pricing modal
      const unlockBtn = target.closest('[data-unlock-with-credit]');
      if (unlockBtn) {
        e.preventDefault();
        openPricing();
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
        if (!reportId) {
          showToast('Run a scan first to purchase this report.');
          return;
        }
        openSingleReportPurchase(reportId);
      }
    });
  }

  function init(opts) {
    const o = opts || {};
    const reportId = getCurrentReportId(o.reportId || '');

    // Fetch billing status so access checks work
    ensureProReportBlock().then(function () {
      if (window.ProReportBlock?.fetchBillingStatus) {
        window.ProReportBlock.fetchBillingStatus();
      }
    });

    wireDomHandlers();
  }

  window.SmEntitlements = {
    init: init,
    ensureProReportBlock: ensureProReportBlock,
    hasAccess: hasAccess,
    isPro: isPro,
    openPricing: openPricing,
    openSingleReportPurchase: openSingleReportPurchase
  };
})(window);
