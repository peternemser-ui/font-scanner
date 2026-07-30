// Hosting analyzer page initialization
(function() {
  // Set current year in footer
  var yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Initialize navigation. nav-template.js self-initializes with no arguments on
  // DOM ready, so call it again with the page id to mark the active nav item.
  if (typeof initializeNavigation === 'function') {
    initializeNavigation('hosting-analyzer');
  }
})();
