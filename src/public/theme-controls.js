/**
 * Shared theme and font size controls
 * Used by both Font Scanner and SEO Analyzer pages
 */

document.addEventListener('DOMContentLoaded', () => {
  // Theme toggle
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  
  const currentTheme = localStorage.getItem('theme') || 'dark';
  
  // Apply theme on load
  if (currentTheme === 'light') {
    body.classList.add('white-theme');
  }
  
  const updateThemeButton = () => {
    const isLight = body.classList.contains('white-theme');
    themeToggle.setAttribute('aria-pressed', isLight);
    themeToggle.textContent = isLight ? '🌓 Dark' : '🌓 Light';
  };
  
  updateThemeButton();
  
  themeToggle.addEventListener('click', () => {
    body.classList.toggle('white-theme');
    const newTheme = body.classList.contains('white-theme') ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    updateThemeButton();
  });

  // Font size controls
  const container = document.querySelector('.container');
  const fontBtns = document.querySelectorAll('.font-size-btn');
  
  const savedSize = localStorage.getItem('fontSize') || 'md';
  container.setAttribute('data-font-size', savedSize);
  
  fontBtns.forEach(btn => {
    if (btn.dataset.size === savedSize) {
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
    }
  });
  
  fontBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      fontBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      
      const size = btn.dataset.size;
      container.setAttribute('data-font-size', size);
      localStorage.setItem('fontSize', size);
    });
  });
});
