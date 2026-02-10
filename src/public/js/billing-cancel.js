/**
 * Billing Cancel Handler
 * Sets up return URL for cancelled payments
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  var returnUrl = params.get('returnUrl') || params.get('return_url') || '';

  var link = document.getElementById('returnLink');
  if (!link) return;

  if (returnUrl && typeof returnUrl === 'string') {
    try {
      var u = new URL(returnUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        link.href = u.toString();
      }
    } catch (e) {
      // ignore malformed URLs
    }
  }
})();
