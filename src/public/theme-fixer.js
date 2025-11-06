/**
 * Theme Fixer - Dynamically fixes dark backgrounds in light theme
 * This script runs on every page and fixes inline styles that don't respect theme
 */

(function() {
  'use strict';
  
  // Check if we're in light theme
  function isLightTheme() {
    return document.body.classList.contains('white-theme') || 
           localStorage.getItem('theme') === 'light';
  }
  
  // Fix an element's dark background
  function fixDarkBackground(element) {
    if (!element || !element.style) return;
    
    const bg = element.style.background || element.style.backgroundColor;
    
    // Check if background is dark (black or very dark colors)
    const darkPatterns = [
      '#000', '#111', '#222', '#333', '#0f0f0f', '#1a1a1a',
      'rgb(0,0,0)', 'rgb(0, 0, 0)', 
      'rgba(0,0,0', 'rgba(0, 0, 0',
      'linear-gradient(135deg, rgba(0',
      'linear-gradient(135deg, #1',
      'linear-gradient(135deg, #0',
      'linear-gradient(135deg, #2',
      'linear-gradient(90deg, #1',
      'linear-gradient(90deg, #0',
      'linear-gradient(90deg, #2'
    ];
    
    const isDark = darkPatterns.some(pattern => 
      bg && bg.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isDark) {
      // Replace with light background
      element.style.setProperty('background', '#f8f9fa', 'important');
      element.style.setProperty('background-color', '#f8f9fa', 'important');
      element.style.setProperty('color', '#000000', 'important');
      
      // If it has a border, make it visible
      if (element.style.border || element.style.borderColor) {
        element.style.setProperty('border-color', '#e0e0e0', 'important');
      }
    }
    
    // Fix white/light text colors
    const color = element.style.color;
    const lightTextPatterns = ['#fff', '#ffffff', 'rgb(255,255,255)', 'rgba(255,255,255', '#aaa', '#bbb', '#ccc', '#ddd'];
    const isLightText = lightTextPatterns.some(pattern =>
      color && color.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isLightText) {
      element.style.setProperty('color', '#000000', 'important');
    }
  }
  
  // Process all elements
  function fixAllDarkBackgrounds() {
    if (!isLightTheme()) return;
    
    console.log('🎨 Theme Fixer: Applying light theme fixes...');
    
    // Get all elements
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(element => {
      fixDarkBackground(element);
    });
    
    console.log(`🎨 Theme Fixer: Fixed ${allElements.length} elements`);
  }
  
  // Run fixer when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixAllDarkBackgrounds);
  } else {
    // Run immediately
    fixAllDarkBackgrounds();
  }
  
  // Run again after a short delay (for dynamic content)
  setTimeout(fixAllDarkBackgrounds, 500);
  setTimeout(fixAllDarkBackgrounds, 1000);
  setTimeout(fixAllDarkBackgrounds, 2000);
  
  // Also run when theme changes (listen for body class changes)
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (isLightTheme()) {
          setTimeout(fixAllDarkBackgrounds, 100);
        }
      }
    });
  });
  
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });
  
  // Periodically check for new elements (for dynamically loaded content)
  setInterval(() => {
    if (isLightTheme()) {
      fixAllDarkBackgrounds();
    }
  }, 500); // Check every 500ms (twice per second)
  
})();
