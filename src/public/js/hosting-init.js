// Hosting analyzer page initialization
(function() {
  // Set current year in footer
  var yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Initialize navigation
  if (typeof initNavigation === 'function') {
    initNavigation('hosting-analyzer');
  }
})();
