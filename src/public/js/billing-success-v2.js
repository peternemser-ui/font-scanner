/**
 * Billing Success Handler (v2)
 * Handles post-payment verification and credit application with toast support
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

  function safeRedirect(path) {
    let target = typeof path === 'string' && path.trim() ? path.trim() : '/';
    if (!target.startsWith('/')) target = '/';
    window.location.replace(target);
  }

  function enqueueToast(message) {
    try {
      if (!message) return;
      const key = 'sm_toast_queue';
      const raw = sessionStorage.getItem(key);
      let queue = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(queue)) queue = [];
      queue.push({ message: String(message), ts: Date.now() });
      sessionStorage.setItem(key, JSON.stringify(queue));
    } catch (e) {
      // ignore
    }
  }

  async function main() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id') || params.get('sessionId');
    if (!sessionId) return safeRedirect('/');

    const verifyResp = await fetch('/api/billing/verify-session?session_id=' + encodeURIComponent(sessionId));
    const verification = await verifyResp.json().catch(function () { return null; });

    if (!verifyResp.ok || !verification || verification.paid !== true || !verification.purchaseType) {
      return safeRedirect('/');
    }

    await loadCreditsManager();
    if (!window.CreditsManager) {
      // CreditsManager should normally be present, but this page must remain safe.
      // Fall back to a best-effort redirect below.
    }

    // Dedupe: if we've already applied this session, just redirect.
    if (window.CreditsManager && typeof window.CreditsManager.hasPurchaseReceipt === 'function' && window.CreditsManager.hasPurchaseReceipt(sessionId)) {
      // Best-effort redirect: try returnUrl in query, else home.
      const returnUrlEarly = params.get('returnUrl') || params.get('return_url') || '';
      if (returnUrlEarly && typeof returnUrlEarly === 'string') {
        try {
          const uEarly = new URL(returnUrlEarly);
          return window.location.replace(uEarly.toString());
        } catch (e) {
          // ignore
        }
      }
      return safeRedirect('/');
    }

    if (window.CreditsManager) {
      if (verification.purchaseType === 'credit_pack') {
        const creditsAdded = parseInt(verification.creditsAdded || 0, 10) || 0;
        if (creditsAdded > 0) {
          window.CreditsManager.addCredits(creditsAdded);
          enqueueToast(creditsAdded + ' credits added.');
        }
      }

      if (verification.purchaseType === 'single_report') {
        if (verification.reportId) window.CreditsManager.unlockReport(verification.reportId, 'single');
      }

      if (typeof window.CreditsManager.addPurchaseReceipt === 'function') {
        window.CreditsManager.addPurchaseReceipt(sessionId);
      }
    }

    // Best-effort redirect: try returnUrl in query, else home.
    const returnUrl = params.get('returnUrl') || params.get('return_url') || '';
    if (returnUrl && typeof returnUrl === 'string') {
      try {
        const u = new URL(returnUrl);
        return window.location.replace(u.toString());
      } catch (e) {
        // ignore
      }
    }

    return safeRedirect('/');
  }

  main().catch(function () { safeRedirect('/'); });
})();
