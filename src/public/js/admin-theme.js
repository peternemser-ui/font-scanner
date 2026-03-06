/**
 * Admin Dashboard Theme Toggle
 * Standalone theme management for admin page (doesn't depend on nav-template)
 */
(function() {
  var body = document.body;
  var html = document.documentElement;
  var btn = document.getElementById('adminThemeToggle');
  var icon = btn ? btn.querySelector('.theme-icon-display') : null;

  function applyTheme(theme) {
    if (theme === 'light') {
      body.classList.add('white-theme');
      html.classList.add('white-theme');
      html.setAttribute('data-theme', 'light');
    } else {
      body.classList.remove('white-theme');
      html.classList.remove('white-theme');
      html.setAttribute('data-theme', 'dark');
    }
    if (icon) icon.textContent = theme === 'light' ? '\u2600' : '\u263E';
  }

  // Read saved preference
  var saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);

  if (btn) {
    btn.addEventListener('click', function() {
      var next = body.classList.contains('white-theme') ? 'dark' : 'light';
      localStorage.setItem('theme', next);
      applyTheme(next);
      // Re-render charts for new theme colors
      if (typeof _analyticsData !== 'undefined' && _analyticsData && typeof _renderCharts === 'function') {
        _renderCharts(_analyticsData);
      }
    });
  }
})();
