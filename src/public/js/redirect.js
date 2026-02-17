/**
 * Redirect Handler
 * Reads redirect target from data-redirect attribute on body or script element
 * Optionally preserves query string with data-preserve-search="true"
 */
(function () {
  'use strict';

  // Try to find redirect target from body data attribute
  const body = document.body;
  let target = body ? body.dataset.redirect : null;
  let preserveSearch = body ? body.dataset.preserveSearch === 'true' : false;

  // Fallback: check if script element has data attributes
  if (!target) {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.includes('redirect.js')) {
        target = scripts[i].dataset.redirect;
        preserveSearch = scripts[i].dataset.preserveSearch === 'true';
        break;
      }
    }
  }

  if (target) {
    const url = preserveSearch ? target + window.location.search : target;
    window.location.href = url;
  }
})();
