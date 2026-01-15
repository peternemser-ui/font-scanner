/**
 * Shared theme and font size controls
 * Now integrated into nav-template.js for unified header
 * This file kept for backwards compatibility with pages not using nav-template
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check if controls are already initialized by nav-template.js
  const navPlaceholder = document.getElementById('nav-placeholder');
  if (navPlaceholder && navPlaceholder.innerHTML.includes('unified-header')) {
    // Controls already initialized by nav-template.js, skip
    return;
  }
  
  // Legacy support for pages without nav-template
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  
  if (themeToggle) {
    const currentTheme = localStorage.getItem('theme') || 'dark';
    
    // Apply theme on load
    if (currentTheme === 'light') {
      body.classList.add('white-theme');
    }
    
    const updateThemeButton = () => {
      const isLight = body.classList.contains('white-theme');
      themeToggle.setAttribute('aria-pressed', isLight);
      themeToggle.textContent = isLight ? '� Dark' : '🌓 Light';
    };
    
    updateThemeButton();
    
    themeToggle.addEventListener('click', () => {
      body.classList.toggle('white-theme');
      const newTheme = body.classList.contains('white-theme') ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      updateThemeButton();
    });
  }

  // Legacy font size controls
  const fontBtns = document.querySelectorAll('.font-size-btn');
  
  if (fontBtns.length > 0) {
    const root = document.documentElement;
    
    // Font size multipliers
    const fontSizes = {
      sm: 0.85,
      md: 1.0,
      lg: 1.15,
      xl: 1.35
    };
    
    const savedSize = localStorage.getItem('fontSize') || 'md';
    
    // Apply saved size
    root.style.setProperty('--font-size-multiplier', fontSizes[savedSize]);
    
    // Set active button
    fontBtns.forEach(btn => {
      if (btn.dataset.size === savedSize) {
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed', 'false');
      }
    });
    
    // Add click handlers
    fontBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const size = btn.dataset.size;
        
        fontBtns.forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        
        root.style.setProperty('--font-size-multiplier', fontSizes[size]);
        localStorage.setItem('fontSize', size);
      });
    });
  }
});
