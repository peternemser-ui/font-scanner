/**
 * Shared Navigation Template
 * Consistent navigation across all Font Scanner pages
 */

// Navigation configuration
const NAV_CONFIG = [
  {
    href: '/dashboard.html',
    icon: '📊',
    label: 'Dashboard',
    id: 'dashboard'
  },
  {
    href: '/',
    icon: '🔤',
    label: 'Font Scanner',
    id: 'font-scanner'
  },
  {
    href: '/seo-analyzer.html',
    icon: '🔍',
    label: 'SEO',
    id: 'seo'
  },
  {
    href: '/core-web-vitals.html',
    icon: '⚡',
    label: 'Core Web Vitals',
    badge: '🔥',
    id: 'core-web-vitals'
  },
  {
    href: '/competitive-analysis.html',
    icon: '🏆',
    label: 'Beat Competition',
    badge: 'NEW',
    id: 'competitive-analysis'
  },
  {
    href: '/performance-analyzer.html',
    icon: '📈',
    label: 'Performance',
    id: 'performance'
  },
  {
    href: '/accessibility-analyzer.html',
    icon: '♿',
    label: 'Accessibility',
    id: 'accessibility'
  },
  {
    href: '/security-analyzer.html',
    icon: '🔒',
    label: 'Security',
    id: 'security'
  }
];

/**
 * Render the navigation bar
 * @param {string} activePageId - ID of the currently active page
 * @returns {string} HTML string for the navigation
 */
function renderNavigation(activePageId) {
  const navItems = NAV_CONFIG.map(item => {
    const isActive = item.id === activePageId;
    const activeClass = isActive ? 'active' : '';
    const ariaCurrent = isActive ? 'aria-current="page"' : '';
    const badge = item.badge 
      ? `<span class="hot-badge">${item.badge}</span>` 
      : '';
    
    return `
      <a href="${item.href}" class="nav-link ${activeClass}" ${ariaCurrent}>
        <span class="nav-icon">${item.icon}</span> ${item.label}${badge}
      </a>
    `;
  }).join('');

  return `
    <nav class="top-nav" role="navigation" aria-label="Main navigation">
      ${navItems}
    </nav>
  `;
}

/**
 * Initialize navigation on page load
 * Automatically detects active page based on current URL
 */
function initializeNavigation() {
  // Detect active page from URL
  const path = window.location.pathname;
  let activePageId = 'font-scanner'; // default
  
  if (path.includes('dashboard')) {
    activePageId = 'dashboard';
  } else if (path.includes('seo-analyzer')) {
    activePageId = 'seo';
  } else if (path.includes('core-web-vitals')) {
    activePageId = 'core-web-vitals';
  } else if (path.includes('competitive-analysis')) {
    activePageId = 'competitive-analysis';
  } else if (path.includes('performance-analyzer')) {
    activePageId = 'performance';
  } else if (path.includes('accessibility-analyzer')) {
    activePageId = 'accessibility';
  } else if (path.includes('security-analyzer')) {
    activePageId = 'security';
  }
  
  // Find the nav placeholder and inject navigation
  const navPlaceholder = document.getElementById('nav-placeholder');
  if (navPlaceholder) {
    navPlaceholder.innerHTML = renderNavigation(activePageId);
  }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
  initializeNavigation();
}
