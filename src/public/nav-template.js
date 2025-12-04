/**
 * Shared Navigation Template
 * Consistent navigation across all Font Scanner pages
 */

// Navigation configuration
const NAV_CONFIG = [
  {
    href: '/dashboard.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    label: 'Dashboard',
    id: 'dashboard'
  },
  {
    href: '/',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
    label: 'Font Scanner',
    id: 'font-scanner'
  },
  {
    href: '/seo-analyzer.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    label: 'SEO',
    id: 'seo'
  },
  {
    href: '/core-web-vitals.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    label: 'Core Web Vitals',
    id: 'core-web-vitals'
  },
  {
    href: '/performance-analyzer.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18M7 16l4-4 4 4 6-6"/></svg>',
    label: 'Performance',
    id: 'performance'
  },
  {
    href: '/accessibility-analyzer.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M10.5 8.5h3M8 13h8M8 13v7M16 13v7"/></svg>',
    label: 'Accessibility',
    id: 'accessibility'
  },
  {
    href: '/security-analyzer.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    label: 'Security',
    id: 'security'
  },
  {
    href: '/ip-reputation-analyzer.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><circle cx="12" cy="12" r="3"/></svg>',
    label: 'IP Reputation',
    id: 'ip-reputation'
  },
  {
    href: '/competitive-analysis.html',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    label: 'Rank Competition',
    id: 'competitive-analysis'
  }
];

/**
 * Render the unified header with app title and subtitle
 * @param {string} appTitle - Main app title (e.g., "FONT SCANNER")
 * @param {string} subtitle - Analyzer name (e.g., "SEO Analysis")
 * @returns {string} HTML string for the unified header
 */
function renderUnifiedHeader(appTitle, subtitle) {
  return `
    <div class="unified-header">
      <!-- Hamburger Menu Button (Mobile Only) -->
      <button 
        class="hamburger-btn" 
        id="hamburgerBtn"
        aria-label="Toggle navigation menu"
        aria-expanded="false"
        aria-controls="mobileNav"
      >
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
      
      <!-- Center: App Title and Subtitle -->
      <div class="unified-header-center">
        <h1 class="app-title">${appTitle}</h1>
        <p class="app-subtitle">${subtitle}</p>
      </div>
      
      <!-- Right: Theme Toggle -->
      <div class="unified-header-right">
        <button 
          id="themeToggle" 
          class="theme-toggle" 
          aria-label="Toggle dark/light theme"
          aria-pressed="false"
        >
          🌓 Light
        </button>
      </div>
    </div>
  `;
}

/**
 * Render the navigation bar
 * @param {string} activePageId - ID of the currently active page
 * @returns {string} HTML string for the navigation
 */
function renderNavigation(activePageId) {
  // Get current URL parameter if exists
  const currentUrl = new URLSearchParams(window.location.search).get('url');

  // Map navigation IDs to i18n keys
  const i18nKeyMap = {
    'dashboard': 'nav.dashboard',
    'font-scanner': 'nav.fontScanner',
    'seo': 'nav.seo',
    'core-web-vitals': 'nav.coreWebVitals',
    'performance': 'nav.performance',
    'accessibility': 'nav.accessibility',
    'security': 'nav.security',
    'competitive-analysis': 'nav.rankCompetition'
  };

  const navItems = NAV_CONFIG.map(item => {
    const isActive = item.id === activePageId;
    const activeClass = isActive ? 'active' : '';
    const ariaCurrent = isActive ? 'aria-current="page"' : '';
    const badge = item.badge
      ? `<span class="hot-badge">${item.badge}</span>`
      : '';

    // Add URL parameter to links if it exists (except dashboard/font-scanner which don't need it)
    let href = item.href;
    if (currentUrl && !['dashboard', 'font-scanner'].includes(item.id)) {
      href += `?url=${encodeURIComponent(currentUrl)}`;
    }

    // Add i18n attribute
    const i18nKey = i18nKeyMap[item.id] || '';
    const i18nAttr = i18nKey ? `data-i18n="${i18nKey}"` : '';

    return `
      <a href="${href}" class="nav-link ${activeClass}" ${ariaCurrent}>
        <span class="nav-icon">${item.icon}</span> <span ${i18nAttr}>${item.label}</span>${badge}
      </a>
    `;
  }).join('');

  return `
    <nav class="top-nav" role="navigation" aria-label="Main navigation">
      ${navItems}
    </nav>
    
    <!-- Mobile Navigation Overlay -->
    <div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
    <nav class="mobile-nav" id="mobileNav" role="navigation" aria-label="Mobile navigation">
      <div class="mobile-nav-header">
        <span class="mobile-nav-title">Menu</span>
        <button class="mobile-nav-close" id="mobileNavClose" aria-label="Close navigation menu">
          ✕
        </button>
      </div>
      <div class="mobile-nav-items">
        ${navItems}
      </div>
      <div class="mobile-nav-footer">
        <button 
          id="mobileThemeToggle" 
          class="mobile-theme-toggle" 
          aria-label="Toggle dark/light theme"
          aria-pressed="false"
        >
          <span class="theme-icon">🌓</span>
          <span class="theme-label">Toggle Theme</span>
        </button>
      </div>
    </nav>
  `;
}

/**
 * Get URL from query parameter
 * @returns {string|null} URL if present in query string
 */
function getUrlParameter() {
  const params = new URLSearchParams(window.location.search);
  return params.get('url');
}

// Export for use in analyzer pages
if (typeof window !== 'undefined') {
  window.getUrlParameter = getUrlParameter;
}

/**
 * Initialize navigation on page load
 * Automatically detects active page based on current URL
 */
function initializeNavigation() {
  // Detect active page from URL
  const path = window.location.pathname;
  let activePageId = 'font-scanner'; // default
  let appTitle = 'FONT SCANNER';
  let subtitle = 'comprehensive web analysis platform';

  // Remove any leftover merge conflict artifacts that may be rendered on the page
  removeMergeConflictArtifacts();
  
  if (path.includes('dashboard')) {
    activePageId = 'dashboard';
    appTitle = 'FONT SCANNER';
    subtitle = '> dashboard / comprehensive overview';
  } else if (path.includes('seo-analyzer')) {
    activePageId = 'seo';
    appTitle = 'FONT SCANNER';
    subtitle = '> seo analysis / search engine optimization';
  } else if (path.includes('core-web-vitals')) {
    activePageId = 'core-web-vitals';
    appTitle = 'FONT SCANNER';
    subtitle = '> core web vitals / performance metrics';
  } else if (path.includes('competitive-analysis')) {
    activePageId = 'competitive-analysis';
    appTitle = 'FONT SCANNER';
    subtitle = '> competitive analysis / beat the competition';
  } else if (path.includes('performance-analyzer')) {
    activePageId = 'performance';
    appTitle = 'FONT SCANNER';
    subtitle = '> performance analysis / lighthouse audit';
  } else if (path.includes('accessibility-analyzer')) {
    activePageId = 'accessibility';
    appTitle = 'FONT SCANNER';
    subtitle = '> accessibility analysis / wcag compliance';
  } else if (path.includes('security-analyzer')) {
    activePageId = 'security';
    appTitle = 'FONT SCANNER';
    subtitle = '> security analysis / vulnerability scan';
  } else if (path === '/' || path.includes('index')) {
    activePageId = 'font-scanner';
    appTitle = 'FONT SCANNER';
    subtitle = '> font analysis / typography scanner';
  }
  
  // Find the nav placeholder and inject unified header + navigation
  const navPlaceholder = document.getElementById('nav-placeholder');
  if (navPlaceholder) {
    navPlaceholder.innerHTML = renderUnifiedHeader(appTitle, subtitle) + renderNavigation(activePageId);
  }
  
  // Initialize controls after rendering
  initializeThemeControls();
  initializeHamburgerMenu();
  ensureGlobalFooter();
}

/**
 * Strip merge conflict markers that might appear on legacy deployments
 */
function removeMergeConflictArtifacts() {
  const conflictRegex = /<<<<<<< HEAD[\s\S]*?>>>>>>>[ \t]*[0-9a-f]+/gi;
  const additionalPhrases = [
    'Updated deployment scripts and server files'
  ];

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodesToClean = [];

  while (walker.nextNode()) {
    nodesToClean.push(walker.currentNode);
  }

  nodesToClean.forEach(node => {
    let text = node.nodeValue || '';
    const originalText = text;

    text = text.replace(conflictRegex, '');
    additionalPhrases.forEach(phrase => {
      text = text.replace(phrase, '');
    });

    if (text.trim().length === 0) {
      node.parentNode && node.parentNode.removeChild(node);
    } else if (text !== originalText) {
      node.nodeValue = text.trim();
    }
  });
}

/**
 * Ensure the shared footer bar exists on every page
 */
function ensureGlobalFooter() {
  let footerBar = document.querySelector('.site-footer-bar');
  if (!footerBar) {
    footerBar = document.createElement('div');
    footerBar.className = 'site-footer-bar';
    document.body.appendChild(footerBar);
  }

  // Fetch version info
  fetch('/api/version')
    .then(res => res.json())
    .then(data => {
      const footerContent = `
        Font Scanner by <strong>Peter Freedman</strong> |
        <span style="opacity: 0.7;">v${data.build}</span> |
        Web optimization & development services |
        <a href="mailto:peter@font-scanner.com" class="site-footer-link">peter@font-scanner.com</a>
      `;
      footerBar.innerHTML = footerContent;
    })
    .catch(() => {
      // Fallback if version fetch fails
      const footerContent = `
        Font Scanner by <strong>Peter Freedman</strong> |
        Web optimization & development services |
        <a href="mailto:peter@font-scanner.com" class="site-footer-link">peter@font-scanner.com</a>
      `;
      footerBar.innerHTML = footerContent;
    });
}

/**
 * Initialize hamburger menu functionality for mobile
 */
function initializeHamburgerMenu() {
  console.log('🍔 Initializing hamburger menu...');
  
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNav = document.getElementById('mobileNav');
  const mobileNavOverlay = document.getElementById('mobileNavOverlay');
  const mobileNavClose = document.getElementById('mobileNavClose');
  const body = document.body;
  
  console.log('🍔 Elements found:', {
    hamburgerBtn: !!hamburgerBtn,
    mobileNav: !!mobileNav,
    mobileNavOverlay: !!mobileNavOverlay,
    mobileNavClose: !!mobileNavClose
  });
  
  if (!hamburgerBtn || !mobileNav || !mobileNavOverlay) {
    console.error('✗ Hamburger menu elements not found!');
    return;
  }
  
  console.log('✓ All hamburger menu elements found, setting up event listeners...');
  
  // Open mobile menu
  const openMenu = () => {
    console.log('📂 Opening mobile menu...');
    mobileNav.classList.add('active');
    mobileNavOverlay.classList.add('active');
    hamburgerBtn.classList.add('active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    body.style.overflow = 'hidden'; // Prevent body scroll when menu is open
  };
  
  // Close mobile menu
  const closeMenu = () => {
    console.log('📁 Closing mobile menu...');
    mobileNav.classList.remove('active');
    mobileNavOverlay.classList.remove('active');
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    body.style.overflow = ''; // Restore body scroll
  };
  
  // Toggle on hamburger button click
  hamburgerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('🍔 Hamburger clicked!');
    console.log('🍔 Menu currently active?', mobileNav.classList.contains('active'));
    if (mobileNav.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  
  // Close on overlay click
  mobileNavOverlay.addEventListener('click', (e) => {
    console.log('👆 Overlay clicked');
    closeMenu();
  });
  
  // Close on close button click
  if (mobileNavClose) {
    mobileNavClose.addEventListener('click', (e) => {
      console.log('✗ Close button clicked');
      closeMenu();
    });
  }
  
  // Close on nav link click
  const mobileNavLinks = mobileNav.querySelectorAll('.nav-link');
  console.log('K Found', mobileNavLinks.length, 'nav links in mobile menu');
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      console.log('K Nav link clicked:', link.textContent);
      closeMenu();
    });
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
      console.log('⌨️ Escape key pressed');
      closeMenu();
    }
  });
}

/**
 * Initialize theme toggle functionality
 */
function initializeThemeControls() {
  console.log('Y Initializing theme controls...');
  
  const themeToggle = document.getElementById('themeToggle');
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const body = document.body;
  
  console.log('Y Theme toggle elements:', { 
    desktop: themeToggle ? 'found' : 'NOT FOUND', 
    mobile: mobileThemeToggle ? 'found' : 'NOT FOUND' 
  });
  
  const currentTheme = localStorage.getItem('theme') || 'dark';
  console.log('Y Current theme from localStorage:', currentTheme);
  
  // Apply theme on load
  if (currentTheme === 'light') {
    body.classList.add('white-theme');
    // FORCE background with inline styles
    body.style.backgroundColor = '#ffffff';
    body.style.color = '#000000';
    console.log('Y Applied white-theme class + inline styles on load');
  } else {
    // Dark mode - explicitly set dark colors
    body.classList.remove('white-theme');
    body.style.backgroundColor = '#000000';
    body.style.color = '#ffffff';
    console.log('Y Applied dark theme on load');
  }
  
  const updateThemeButtons = () => {
    const isLight = body.classList.contains('white-theme');
    console.log('Y Updating theme buttons, isLight:', isLight);
    
    // Update desktop theme toggle (if exists)
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', isLight);
      themeToggle.textContent = isLight ? '🌙 Dark' : '🌓 Light';
    }
    
    // Update mobile theme toggle (if exists)
    if (mobileThemeToggle) {
      mobileThemeToggle.setAttribute('aria-pressed', isLight);
      const label = mobileThemeToggle.querySelector('.theme-label');
      if (label) {
        label.textContent = isLight ? 'Switch to Dark' : 'Switch to Light';
      }
    }
  };
  
  const toggleTheme = () => {
    console.log('Y Toggle theme clicked!');
    body.classList.toggle('white-theme');
    const newTheme = body.classList.contains('white-theme') ? 'light' : 'dark';
    console.log('Y New theme:', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // FORCE background change with inline styles as fallback
    if (newTheme === 'light') {
      body.style.backgroundColor = '#ffffff';
      body.style.color = '#000000';
    } else {
      // Dark mode - explicitly set dark colors
      body.style.backgroundColor = '#000000';
      body.style.color = '#ffffff';
    }
    
    updateThemeButtons();
  };
  
  updateThemeButtons();
  
  // Desktop theme toggle
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    console.log('Y Desktop theme toggle click listener added');
  }
  
  // Mobile theme toggle
  if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener('click', toggleTheme);
    console.log('Y Mobile theme toggle click listener added');
  }
  
  console.log('Y Theme controls initialization complete');
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
  initializeNavigation();
}
