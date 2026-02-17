/**
 * Billing Cancel Handler
 * Sets up return URL for cancelled payments
 */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get('returnUrl') || params.get('return_url') || '';

  const link = document.getElementById('returnLink');
  if (!link) return;

  if (returnUrl && typeof returnUrl === 'string') {
    try {
      const u = new URL(returnUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        link.href = u.toString();
      }
    } catch (e) {
      // ignore malformed URLs
    }
  }
})();
