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

  async function postJSON(url, body) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    const data = await resp.json().catch(function () { return null; });
    if (!resp.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : 'Request failed';
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function getJSON(url) {
    const resp = await fetch(url);
    const data = await resp.json().catch(function () { return null; });
    if (!resp.ok) {
      const msg = (data && (data.error || data.message)) ? (data.error || data.message) : 'Request failed';
      const err = new Error(msg);
      err.status = resp.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function buildReturnUrl() {
    const params = new URLSearchParams(window.location.search);
    params.delete('session_id');
    params.delete('sessionId');
    params.delete('canceled');

    const query = params.toString();
    return window.location.origin + window.location.pathname + (query ? ('?' + query) : '');
  }

  async function createCheckoutSession(opts) {
    const o = opts || {};
    return postJSON('/api/billing/create-checkout-session', {
      purchaseType: o.purchaseType,
      packId: o.packId || null,
      reportId: o.reportId || null,
      returnUrl: o.returnUrl || buildReturnUrl()
    });
  }

  async function startCheckout(opts) {
    const data = await createCheckoutSession(opts);
    if (data && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return true;
    }
    throw new Error('Checkout is unavailable right now');
  }

  async function verifySession(sessionId) {
    if (!sessionId) throw new Error('Missing session_id');
    return getJSON('/api/billing/verify-session?session_id=' + encodeURIComponent(sessionId));
  }

  async function applyVerification(sessionId, verification) {
    if (!verification || verification.paid !== true) return false;

    // Lazy-load CreditsManager if needed.
    if (!window.CreditsManager) {
      await new Promise(function (resolve) {
        const script = document.createElement('script');
        script.src = '/assets/js/ui.js';
        script.async = true;
        script.onload = function () { resolve(true); };
        script.onerror = function () { resolve(false); };
        document.head.appendChild(script);
      });
    }

    if (window.CreditsManager) {
      if (typeof window.CreditsManager.hasPurchaseReceipt === 'function' && window.CreditsManager.hasPurchaseReceipt(sessionId)) {
        return true;
      }

      if (verification.purchaseType === 'credit_pack') {
        const creditsAdded = parseInt(verification.creditsAdded || 0, 10) || 0;
        if (creditsAdded > 0) {
          window.CreditsManager.addCredits(creditsAdded);
          showToast(creditsAdded + ' credits added.');
        }
      }

      if (verification.purchaseType === 'single_report') {
        if (verification.reportId) window.CreditsManager.unlockReport(verification.reportId, 'single');
      }

      if (typeof window.CreditsManager.addPurchaseReceipt === 'function') {
        window.CreditsManager.addPurchaseReceipt(sessionId);
      }

      const currentReportId = document.body.getAttribute('data-report-id') || verification.reportId || '';
      if (currentReportId && typeof window.CreditsManager.renderPaywallState === 'function') {
        window.CreditsManager.renderPaywallState(currentReportId);
      }
    }

    return true;
  }

  async function finalizeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('sessionId');
    if (!sessionId) return null;

    const verification = await verifySession(sessionId);
    await applyVerification(sessionId, verification);
    return verification;
  }

  window.SmBilling = {
    createCheckoutSession: createCheckoutSession,
    startCheckout: startCheckout,
    verifySession: verifySession,
    applyVerification: applyVerification,
    finalizeFromUrl: finalizeFromUrl,
    buildReturnUrl: buildReturnUrl
  };
})(window);
