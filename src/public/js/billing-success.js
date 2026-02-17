/**
 * Billing Success Handler
 * Handles post-payment verification and credit application
 */
(function () {
  'use strict';

  function loadCreditsManager() {
    if (window.CreditsManager) return Promise.resolve(true);
    return new Promise(function (resolve) {
      const script = document.createElement('script');
      script.src = '/assets/js/ui.js';
      script.async = true;
      script.onload = function () { resolve(!!window.CreditsManager); };
      script.onerror = function () { resolve(false); };
      document.head.appendChild(script);
    });
  }

  function safeRedirectHome() {
    window.location.replace('/');
  }

  function safeRedirectReturnUrl(params) {
    const returnUrl = params.get('returnUrl') || params.get('return_url') || '';
    if (returnUrl && typeof returnUrl === 'string') {
      try {
        const u = new URL(returnUrl);
        if (u.protocol === 'http:' || u.protocol === 'https:') {
          return window.location.replace(u.toString());
        }
      } catch (e) {
        // ignore malformed URLs
      }
    }
    return safeRedirectHome();
  }

  async function main() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('sessionId');
    if (!sessionId) return safeRedirectReturnUrl(params);

    const verifyResp = await fetch('/api/billing/verify-session?session_id=' + encodeURIComponent(sessionId));
    const verification = await verifyResp.json().catch(function () { return null; });

    if (!verifyResp.ok || !verification || verification.paid !== true || !verification.purchaseType) {
      return safeRedirectReturnUrl(params);
    }

    await loadCreditsManager();

    if (window.CreditsManager) {
      // Dedupe: if we've already applied this session, just redirect.
      if (typeof window.CreditsManager.hasPurchaseReceipt === 'function' && window.CreditsManager.hasPurchaseReceipt(sessionId)) {
        return safeRedirectReturnUrl(params);
      }

      if (verification.purchaseType === 'credit_pack') {
        const creditsAdded = parseInt(verification.creditsAdded || 0, 10) || 0;
        if (creditsAdded > 0) {
          window.CreditsManager.addCredits(creditsAdded);
        }
      }

      if (verification.purchaseType === 'single_report') {
        if (verification.reportId) window.CreditsManager.unlockReport(verification.reportId, 'single');
      }

      if (typeof window.CreditsManager.addPurchaseReceipt === 'function') {
        window.CreditsManager.addPurchaseReceipt(sessionId);
      }
    }

    return safeRedirectReturnUrl(params);
  }

  main().catch(function () { safeRedirectHome(); });
})();
