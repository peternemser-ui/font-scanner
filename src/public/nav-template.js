/**
 * Shared Navigation Template
 * Consistent navigation across all Site Mechanic pages
 * 
 * Site Mechanic follows a 5-stage workflow:
 * 1. SCAN     - Enter URL, run inspection (Dashboard)
 * 2. DIAGNOSE - Identify issues across categories
 * 3. PRIORITIZE - Rank by severity and impact
 * 4. EXPORT   - PDF, CSV, share reports
 * 5. IMPROVE  - Actionable fixes and recommendations
 * 
 * CATEGORY STRUCTURE:
 * A. Overview          - Site Health Summary, Cross-category scores, Priority issues
 * B. Performance & UX  - Speed, Core Web Vitals, Lighthouse, Mobile testing
 * C. SEO & Indexing    - SEO Analysis, Crawler, Sitemap, Metadata, Tags
 * D. Accessibility     - WCAG scoring, Compliance, Critical violations
 * E. Security & Trust  - Security, IP Reputation, DNS, SSL, Email
 * F. Technology        - Fonts & Typography, Tech stack, Scripts
 * G. Infrastructure    - Hosting, Cost estimates, Infra recommendations
 * H. Competitive       - Rank comparison, Benchmarks
 */

// =============================================================================
// CATEGORY DEFINITIONS - Organized by diagnostic area
// =============================================================================

const CATEGORIES = {
  overview: {
    id: 'overview',
    label: 'Overview',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
    description: 'Site health summary and priority issues'
  },
  performance: {
    id: 'performance',
    label: 'Performance & UX',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    description: 'Speed, Core Web Vitals, mobile experience'
  },
  seo: {
    id: 'seo',
    label: 'SEO & Indexing',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
    description: 'Search optimization, crawlability, metadata'
  },
  accessibility: {
    id: 'accessibility',
    label: 'Accessibility',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="4" r="2"/><path d="M10.5 8.5h3M8 13h8M8 13v7M16 13v7"/></svg>',
    description: 'WCAG compliance, screen reader support'
  },
  security: {
    id: 'security',
    label: 'Security & Trust',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
    description: 'Security headers, SSL, IP reputation'
  },
  technology: {
    id: 'technology',
    label: 'Fonts & Design',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>',
    description: 'Typography, fonts, and visual design analysis'
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Infrastructure',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><circle cx="6" cy="10" r="1"/><circle cx="10" cy="10" r="1"/></svg>',
    description: 'Hosting analysis, cost estimates'
  },
  competitive: {
    id: 'competitive',
    label: 'Competitive Insights',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    description: 'Competitor benchmarks and comparisons'
  }
};

// =============================================================================
// ALL DIAGNOSTIC PAGES - Organized by category
// =============================================================================

const ALL_DIAGNOSTICS = [
  // --- A. OVERVIEW ---
  {
    href: '/dashboard.html',
    label: 'Site Health Dashboard',
    id: 'dashboard',
    category: 'overview',
    tier: 'free',
    primary: true,  // Shows in main nav
    description: 'Cross-category scores and priority issues'
  },

  // --- B. PERFORMANCE & UX ---
  {
    href: '/performance-hub.html',
    label: 'Speed & UX Overview',
    id: 'performance-hub',
    category: 'performance',
    tier: 'free',
    primary: true,
    description: 'Page speed, loading times, user experience'
  },
  {
    href: '/performance-hub.html?mode=cwv',
    label: 'Core Web Vitals',
    id: 'core-web-vitals',
    category: 'performance',
    tier: 'free',
    description: 'LCP, FID, CLS metrics'
  },
  {
    href: '/performance-hub.html?mode=full',
    label: 'Lighthouse Metrics',
    id: 'performance-analyzer',
    category: 'performance',
    tier: 'free',
    description: 'Full Lighthouse performance audit'
  },
  {
    href: '/mobile-analyzer.html',
    label: 'Mobile Testing',
    id: 'mobile-analyzer',
    category: 'performance',
    tier: 'pro',
    description: 'Mobile-specific performance and UX'
  },
  {
    href: '/cro-analyzer.html',
    label: 'Conversion Optimization',
    id: 'cro-analyzer',
    category: 'performance',
    tier: 'pro',
    description: 'UX patterns that impact conversions'
  },

  // --- C. SEO & INDEXING ---
  {
    href: '/seo-analyzer.html',
    label: 'SEO Analysis',
    id: 'seo-analyzer',
    category: 'seo',
    tier: 'free',
    primary: true,
    description: 'SEO audit with actionable fixes'
  },
  {
    href: '/site-crawler.html',
    label: 'Site Crawler',
    id: 'site-crawler',
    category: 'seo',
    tier: 'pro',
    description: 'Full site crawl and indexability'
  },
  {
    href: '/tag-intelligence.html',
    label: 'Tracking & Analytics',
    id: 'tag-intelligence',
    category: 'seo',
    tier: 'pro',
    description: 'Analytics tags, pixels, and tracking scripts'
  },
  {
    href: '/local-seo.html',
    label: 'Local SEO',
    id: 'local-seo',
    category: 'seo',
    tier: 'pro',
    description: 'Local business optimization'
  },
  {
    href: '/broken-links.html',
    label: 'Broken Links',
    id: 'broken-links',
    category: 'seo',
    tier: 'pro',
    description: 'Find and fix broken links'
  },

  // --- D. ACCESSIBILITY ---
  {
    href: '/accessibility-analyzer.html',
    label: 'Accessibility Audit',
    id: 'accessibility-analyzer',
    category: 'accessibility',
    tier: 'free',
    primary: true,
    description: 'WCAG compliance and violations'
  },

  // --- E. SECURITY & TRUST ---
  {
    href: '/security-analyzer.html',
    label: 'Security Scanner',
    id: 'security-analyzer',
    category: 'security',
    tier: 'free',
    primary: true,
    description: 'Security headers and vulnerabilities'
  },
  {
    href: '/ip-reputation-analyzer.html',
    label: 'IP & Domain Health',
    id: 'ip-reputation',
    category: 'security',
    tier: 'pro',
    description: 'IP reputation, DNS, email deliverability'
  },
  {
    href: '/gdpr-compliance.html',
    label: 'Privacy Compliance',
    id: 'gdpr-compliance',
    category: 'security',
    tier: 'pro',
    description: 'GDPR/CCPA cookie and tracking audit'
  },

  // --- F. TECHNOLOGY & FONTS ---
  {
    href: '/enhanced-fonts.html',
    label: 'Fonts & Typography',
    id: 'enhanced-fonts',
    category: 'technology',
    tier: 'pro',
    primary: true,
    description: 'Font loading, rendering, and optimization'
  },
  {
    href: '/brand-consistency.html',
    label: 'Brand & Design',
    id: 'brand-consistency',
    category: 'technology',
    tier: 'pro',
    description: 'Visual consistency and brand alignment'
  },

  // --- G. INFRASTRUCTURE ---
  {
    href: '/hosting-analyzer.html',
    label: 'Hosting Guide',
    id: 'hosting-analyzer',
    category: 'infrastructure',
    tier: 'free',
    primary: true,
    description: 'Hosting recommendations and costs'
  },

  // --- H. COMPETITIVE INSIGHTS ---
  {
    href: '/competitive-analysis.html',
    label: 'Competitor Benchmarks',
    id: 'competitive-analysis',
    category: 'competitive',
    tier: 'pro',
    primary: true,
    description: 'Compare against competitors'
  }
];

// =============================================================================
// DERIVED NAVIGATION ARRAYS (for backward compatibility)
// =============================================================================

// Primary nav items (shown in main nav bar)
const NAV_CONFIG = ALL_DIAGNOSTICS
  .filter(d => d.primary)
  .slice(0, 5)  // Limit to 5 main nav items
  .map(d => ({
    href: d.href,
    icon: CATEGORIES[d.category]?.icon || '',
    label: d.category === 'overview' ? 'Overview' : 
           d.category === 'performance' ? 'Speed' :
           d.category === 'seo' ? 'SEO' :
           d.category === 'accessibility' ? 'Accessibility' :
           d.category === 'security' ? 'Security' : d.label,
    id: d.id,
    stage: d.category === 'overview' ? 1 : 2
  }));

// Extended diagnostics for "More" dropdown (grouped by category)
const MORE_DIAGNOSTICS_CONFIG = ALL_DIAGNOSTICS
  .filter(d => !d.primary || d.tier === 'pro')
  .map(d => {
    const badge = (d.tier && d.tier.toLowerCase() === 'pro') ? 'Saves time' : null;
    // Debug logging to track badge assignments
    if (badge) {
      console.log(`✓ Badge assigned to ${d.label}: "${badge}" (tier: ${d.tier})`);
    }
    return {
      href: d.href,
      icon: CATEGORIES[d.category]?.icon || '',
      label: d.label,
      id: d.id,
      // Paid items get a value badge - explicitly check tier value
      badge: badge,
      category: d.category,
      stage: 2
    };
  });

// Helper: Get diagnostics by category
function getDiagnosticsByCategory(categoryId) {
  return ALL_DIAGNOSTICS.filter(d => d.category === categoryId);
}

// Helper: Get category info
function getCategoryInfo(categoryId) {
  return CATEGORIES[categoryId] || null;
}

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
        <h1 class="app-title" data-i18n="app.name">${appTitle}</h1>
        <p class="app-subtitle" data-i18n="app.tagline">${subtitle}</p>
      </div>
      
      <!-- Right: Auth + Language Selector + Theme Toggle -->
      <div class="unified-header-right">
        <div id="authLinksContainer" class="auth-links-container"></div>
        <div id="languageSelectorContainer" class="language-selector-header"></div>
        <button
          id="headerThemeToggle"
          class="header-theme-toggle"
          aria-label="Toggle dark/light theme"
          aria-pressed="false"
        >
          <svg class="theme-icon" width="24" height="24" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
            <path d="M50 5 A45 45 0 0 0 50 95 Z" fill="currentColor"/>
          </svg>
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
    'seo': 'nav.seo',
    'seo-analyzer': 'nav.seoAnalysis',
    'performance-hub': 'nav.performance',
    'core-web-vitals': 'nav.coreWebVitals',
    'performance-analyzer': 'nav.lighthouseMetrics',
    'accessibility': 'nav.accessibility',
    'accessibility-analyzer': 'nav.accessibility',
    'security': 'nav.security',
    'security-analyzer': 'nav.security',
    'competitive-analysis': 'nav.rankCompetition',
    'ip-reputation': 'nav.ipReputation',
    'tag-intelligence': 'nav.tagIntelligence',
    'enhanced-fonts': 'nav.typography',
    'site-crawler': 'nav.siteCrawler',
    'mobile-analyzer': 'nav.mobileTesting',
    'broken-links': 'nav.brokenLinks',
    'local-seo': 'nav.localSeo',
    'brand-consistency': 'nav.brandAudit',
    'cro-analyzer': 'nav.croAnalysis',
    'gdpr-compliance': 'nav.gdprCheck',
    'hosting-analyzer': 'nav.hostingGuide'
  };

  // Helper to generate nav link HTML
  const generateNavLink = (item, isDropdownItem = false) => {
    const isActive = item.id === activePageId;
    const activeClass = isActive ? 'active' : '';
    const ariaCurrent = isActive ? 'aria-current="page"' : '';
    const badge = item.badge
      ? `<span class="hot-badge">${item.badge}</span>`
      : '';

    let href = item.href;
    if (currentUrl && !['dashboard'].includes(item.id)) {
      href += `?url=${encodeURIComponent(currentUrl)}`;
    }

    const i18nKey = i18nKeyMap[item.id] || '';
    const i18nAttr = i18nKey ? `data-i18n="${i18nKey}"` : '';
    const dropdownClass = isDropdownItem ? 'dropdown-item' : '';

    return `
      <a href="${href}" class="nav-link ${activeClass} ${dropdownClass}" ${ariaCurrent}>
        <span class="nav-icon">${item.icon}</span> <span ${i18nAttr}>${item.label}</span>${badge}
      </a>
    `;
  };

  // Generate primary nav items
  const navItems = NAV_CONFIG.map(item => generateNavLink(item)).join('');

  // Generate dropdown items grouped by category
  const categoryOrder = ['performance', 'seo', 'accessibility', 'security', 'technology', 'infrastructure', 'competitive'];
  
  const generateCategoryGroup = (categoryId) => {
    const category = CATEGORIES[categoryId];
    if (!category) return '';
    
    const items = MORE_DIAGNOSTICS_CONFIG.filter(item => item.category === categoryId);
    if (items.length === 0) return '';
    
    // Map category IDs to i18n keys
    const categoryI18nMap = {
      'performance': 'categories.performance',
      'seo': 'categories.seo',
      'accessibility': 'categories.accessibility',
      'security': 'categories.security',
      'technology': 'categories.technology',
      'infrastructure': 'categories.infrastructure',
      'competitive': 'categories.competitive'
    };
    const categoryI18nKey = categoryI18nMap[categoryId] || '';
    const categoryI18nAttr = categoryI18nKey ? `data-i18n="${categoryI18nKey}"` : '';
    
    return `
      <div class="dropdown-category">
        <div class="dropdown-category-header">
          <span class="dropdown-category-icon">${category.icon}</span>
          <span class="dropdown-category-label" ${categoryI18nAttr}>${category.label}</span>
        </div>
        ${items.map(item => generateNavLink(item, true)).join('')}
      </div>
    `;
  };
  
  const moreDiagnosticsItems = categoryOrder.map(cat => generateCategoryGroup(cat)).join('');

  // Check if any dropdown item is active (but don't auto-open the dropdown)
  const isDropdownActive = MORE_DIAGNOSTICS_CONFIG.some(item => item.id === activePageId);

  // Generate simplified mobile nav items to match desktop toolbar
  const mobileNavItems = [
    { href: '/dashboard.html', icon: CATEGORIES.overview.icon, label: 'Dashboard', id: 'dashboard' },
    ...NAV_CONFIG.filter(item => item.id !== 'dashboard')
  ].map(item => generateNavLink(item)).join('');

  // Generate collapsible category sections for mobile
  const mobileMoreItems = categoryOrder.map(cat => {
    const category = CATEGORIES[cat];
    if (!category) return '';

    const items = MORE_DIAGNOSTICS_CONFIG.filter(item => item.category === cat);
    if (items.length === 0) return '';

    // Map category IDs to i18n keys
    const categoryI18nMap = {
      'performance': 'categories.performance',
      'seo': 'categories.seo',
      'accessibility': 'categories.accessibility',
      'security': 'categories.security',
      'technology': 'categories.technology',
      'infrastructure': 'categories.infrastructure',
      'competitive': 'categories.competitive'
    };
    const categoryI18nKey = categoryI18nMap[cat] || '';
    const categoryI18nAttr = categoryI18nKey ? `data-i18n="${categoryI18nKey}"` : '';

    return `
      <div class="mobile-nav-section" data-category="${cat}">
        <button class="mobile-nav-section-header" aria-expanded="false" aria-controls="mobile-section-${cat}">
          <span class="mobile-nav-section-icon">${category.icon}</span>
          <span class="mobile-nav-section-label" ${categoryI18nAttr}>${category.label}</span>
          <svg class="mobile-nav-section-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
        <div class="mobile-nav-section-items" id="mobile-section-${cat}">
          ${items.map(item => generateNavLink(item)).join('')}
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="nav-wrapper">
      <button class="nav-scroll-btn nav-scroll-left" id="navScrollLeft" aria-label="Scroll navigation left">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <nav class="top-nav" role="navigation" aria-label="Main navigation" id="topNav">
        ${navItems}
        <!-- Extended Diagnostics Dropdown -->
        <div class="nav-dropdown">
          <button class="nav-link nav-dropdown-trigger ${isDropdownActive ? 'active' : ''}" aria-expanded="false" aria-haspopup="true">
            <span class="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
              </svg>
            </span>
            <span data-i18n="nav.more">More</span>
            <svg class="dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="nav-dropdown-menu">
            ${moreDiagnosticsItems}
          </div>
        </div>
      </nav>
      <button class="nav-scroll-btn nav-scroll-right" id="navScrollRight" aria-label="Scroll navigation right">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    
    <!-- Mobile Navigation Overlay -->
    <div class="mobile-nav-overlay" id="mobileNavOverlay"></div>
    <nav class="mobile-nav" id="mobileNav" role="navigation" aria-label="Mobile navigation">
      <div class="mobile-nav-header">
        <span class="mobile-nav-title" data-i18n="nav.menu">Menu</span>
        <button class="mobile-nav-close" id="mobileNavClose" aria-label="Close navigation menu">
          ✕
        </button>
      </div>
      <div class="mobile-nav-items">
        ${mobileNavItems}
        ${mobileMoreItems}
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
let navInitialized = false;
function initializeNavigation(customActivePageId, customAppTitle, customSubtitle) {
  // Prevent double initialization
  if (navInitialized) {
    console.log('Navigation already initialized, skipping...');
    return;
  }
  navInitialized = true;

  // Remove any leftover merge conflict artifacts that may be rendered on the page
  removeMergeConflictArtifacts();

  // If custom values provided, use them; otherwise auto-detect from URL
  let activePageId, appTitle, subtitle;
  
  if (customActivePageId) {
    // Use custom values passed by the page
    activePageId = customActivePageId;
    appTitle = customAppTitle || 'SITE MECHANIC';
    subtitle = customSubtitle || 'website diagnostics & optimization';
  } else {
    // Auto-detect from URL path
    const path = window.location.pathname;
    activePageId = 'dashboard'; // default
    appTitle = 'SITE MECHANIC';
    subtitle = 'website diagnostics & optimization';
  
    if (path.includes('dashboard')) {
      activePageId = 'dashboard';
      appTitle = 'SITE MECHANIC';
      subtitle = '> dashboard / site health overview';
    } else if (path.includes('seo-analyzer')) {
      activePageId = 'seo';
      appTitle = 'SITE MECHANIC';
      subtitle = '> seo analysis / search optimization';
    } else if (path.includes('performance-hub')) {
      activePageId = 'performance-hub';
      appTitle = 'SITE MECHANIC';
      subtitle = '> performance / speed & core web vitals';
    } else if (path.includes('core-web-vitals')) {
      // Redirect legacy URL to performance-hub
      activePageId = 'performance-hub';
      appTitle = 'SITE MECHANIC';
      subtitle = '> performance / core web vitals';
    } else if (path.includes('competitive-analysis')) {
      activePageId = 'competitive-analysis';
      appTitle = 'SITE MECHANIC';
      subtitle = '> rank competition / competitor analysis';
    } else if (path.includes('performance-analyzer') || path.includes('performance-snapshot')) {
      // Redirect legacy URLs to performance-hub
      activePageId = 'performance-hub';
      appTitle = 'SITE MECHANIC';
      subtitle = '> performance analysis';
    } else if (path.includes('accessibility-analyzer')) {
      activePageId = 'accessibility';
      appTitle = 'SITE MECHANIC';
      subtitle = '> accessibility / wcag & ada compliance';
    } else if (path.includes('security-analyzer')) {
      activePageId = 'security';
      appTitle = 'SITE MECHANIC';
      subtitle = '> security / vulnerability scan';
    } else if (path.includes('ip-reputation')) {
      activePageId = 'ip-reputation';
      appTitle = 'SITE MECHANIC';
      subtitle = '> ip reputation / blacklist check';
    } else if (path.includes('tag-intelligence')) {
      activePageId = 'tag-intelligence';
      appTitle = 'SITE MECHANIC';
      subtitle = '> tracking & analytics';
    } else if (path.includes('enhanced-fonts')) {
      activePageId = 'enhanced-fonts';
      appTitle = 'SITE MECHANIC';
      subtitle = '> fonts & typography';
    } else if (path.includes('site-crawler')) {
      activePageId = 'site-crawler';
      appTitle = 'SITE MECHANIC';
      subtitle = '> site crawler / full-site discovery';
    } else if (path.includes('mobile-analyzer')) {
      activePageId = 'mobile-analyzer';
      appTitle = 'SITE MECHANIC';
      subtitle = '> mobile testing / device analysis';
    } else if (path.includes('broken-links')) {
      activePageId = 'broken-links';
      appTitle = 'SITE MECHANIC';
      subtitle = '> broken links / link health check';
    } else if (path.includes('local-seo')) {
      activePageId = 'local-seo';
      appTitle = 'SITE MECHANIC';
      subtitle = '> local seo / business presence';
    } else if (path.includes('brand-consistency')) {
      activePageId = 'brand-consistency';
      appTitle = 'SITE MECHANIC';
      subtitle = '> brand audit / visual consistency';
    } else if (path.includes('cro-analyzer')) {
      activePageId = 'cro-analyzer';
      appTitle = 'SITE MECHANIC';
      subtitle = '> cro analysis / conversion optimization';
    } else if (path.includes('gdpr-compliance')) {
      activePageId = 'gdpr-compliance';
      appTitle = 'SITE MECHANIC';
      subtitle = '> gdpr check / privacy compliance';
    } else if (path.includes('hosting-analyzer')) {
      activePageId = 'hosting-analyzer';
      appTitle = 'SITE MECHANIC';
      subtitle = '> hosting guide / provider comparison';
    } else if (path === '/' || path.includes('index')) {
      activePageId = 'dashboard';
      appTitle = 'SITE MECHANIC';
      subtitle = 'website diagnostics & optimization';
    }
  }
  
  // Find the nav placeholder and inject unified header + navigation
  const navPlaceholder = document.getElementById('nav-placeholder');
  if (navPlaceholder) {
    navPlaceholder.innerHTML = renderUnifiedHeader(appTitle, subtitle) + renderNavigation(activePageId);
  }
  
  // Initialize controls after rendering
  ensureGlobalFooter(); // Create footer first (contains theme toggle)
  initializeAuthLinks(); // Initialize authentication links
  initializeHamburgerMenu();
  initializeNavScroll();
  initializeDropdownMenu();
  initializeHeaderLanguageSwitcher();

  // Initialize theme controls after footer is ready
  setTimeout(() => {
    initializeThemeControls();
  }, 100);
  
  // Re-translate the page to catch dynamically rendered nav elements
  if (window.i18n && window.i18n.translatePage) {
    window.i18n.translatePage();
  }
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
 * Initialize More Tools dropdown menu
 */
function initializeDropdownMenu() {
  const dropdown = document.querySelector('.nav-dropdown');
  const trigger = document.querySelector('.nav-dropdown-trigger');
  const menu = document.querySelector('.nav-dropdown-menu');
  
  if (!dropdown || !trigger || !menu) {
    console.warn('Dropdown elements not found:', { dropdown: !!dropdown, trigger: !!trigger, menu: !!menu });
    return;
  }
  
  console.log('Dropdown initialized');
  
  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isOpen = dropdown.classList.contains('open');
    dropdown.classList.toggle('open');
    trigger.setAttribute('aria-expanded', !isOpen);
    
    console.log('Dropdown clicked, now:', dropdown.classList.contains('open') ? 'OPEN' : 'CLOSED');
  });
  
  // Close dropdown when clicking outside
  setTimeout(() => {
    document.addEventListener('click', (e) => {
      if (dropdown.classList.contains('open') && 
          !trigger.contains(e.target) && 
          !menu.contains(e.target)) {
        console.log('Closing dropdown - clicked outside');
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
  }, 200);
  
  // Close dropdown on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('open')) {
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.focus();
    }
  });
  
  // Close dropdown when clicking any navigation link inside
  const navLinks = menu.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    });
  });
}

/**
 * Initialize navigation scroll buttons for horizontal scrolling
 */
function initializeNavScroll() {
  const topNav = document.getElementById('topNav');
  const scrollLeftBtn = document.getElementById('navScrollLeft');
  const scrollRightBtn = document.getElementById('navScrollRight');

  if (!topNav || !scrollLeftBtn || !scrollRightBtn) {
    return;
  }

  const scrollAmount = 200; // pixels to scroll per click

  // Update button visibility based on scroll position
  const updateScrollButtons = () => {
    const { scrollLeft, scrollWidth, clientWidth } = topNav;
    const maxScroll = scrollWidth - clientWidth;

    // Show/hide left button
    if (scrollLeft <= 5) {
      scrollLeftBtn.classList.add('hidden');
    } else {
      scrollLeftBtn.classList.remove('hidden');
    }

    // Show/hide right button
    if (scrollLeft >= maxScroll - 5) {
      scrollRightBtn.classList.add('hidden');
    } else {
      scrollRightBtn.classList.remove('hidden');
    }

    // Hide both if no scrolling needed
    if (scrollWidth <= clientWidth + 10) {
      scrollLeftBtn.classList.add('hidden');
      scrollRightBtn.classList.add('hidden');
    }
  };

  // Scroll left
  scrollLeftBtn.addEventListener('click', () => {
    topNav.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  });

  // Scroll right
  scrollRightBtn.addEventListener('click', () => {
    topNav.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  });

  // Update on scroll
  topNav.addEventListener('scroll', updateScrollButtons);

  // Update on resize
  window.addEventListener('resize', updateScrollButtons);

  // Initial update
  updateScrollButtons();
}

/**
 * Initialize language switcher in header
 */
function initializeHeaderLanguageSwitcher() {
  // Initialize language switcher into header container
  const container = document.getElementById('languageSelectorContainer');
  if (container && window.languageSwitcher && !window.languageSwitcher.initialized) {
    window.languageSwitcher.init('#languageSelectorContainer');
    console.log('✓ Language switcher initialized in header');
  }
}

/**
 * Initialize authentication links in header
 */
function initializeAuthLinks() {
  const container = document.getElementById('authLinksContainer');
  if (!container) return;

  // Check if pro-utils.js is loaded
  if (typeof window.proManager === 'undefined') {
    console.warn('ProManager not loaded, auth links disabled');
    return;
  }

  const proMgr = window.proManager;

  // Render auth links based on authentication status
  if (proMgr.isAuthenticated()) {
    const isPro = proMgr.isPro();
    const email = proMgr.getEmail() || '';
    const initials = email.substring(0, 2).toUpperCase();

    container.innerHTML = `
      <div class="auth-user-menu">
        <button class="auth-user-trigger" id="authUserTrigger" aria-expanded="false" aria-haspopup="true">
          <span class="auth-user-avatar">${initials}</span>
          ${isPro ? '<span class="auth-user-pro-badge">✨ PRO</span>' : ''}
          <svg class="auth-dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        <div class="auth-user-dropdown" id="authUserDropdown">
          <div class="auth-user-info">
            <div class="auth-user-email">${email}</div>
            <div class="auth-user-plan">${isPro ? 'Pro Plan' : 'Free Plan'}</div>
          </div>
          <div class="auth-user-divider"></div>
          <a href="/account.html" class="auth-dropdown-item">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6"/>
            </svg>
            Account
          </a>
          ${!isPro ? `
            <a href="/upgrade.html" class="auth-dropdown-item auth-upgrade-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
              Upgrade to Pro
            </a>
          ` : `
            <button class="auth-dropdown-item" id="manageSubscriptionBtn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
              </svg>
              Manage Subscription
            </button>
          `}
          ${proMgr.isAdmin() ? `
            <div class="auth-user-divider"></div>
            <a href="/admin.html" class="auth-dropdown-item" style="color: #ef4444;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Admin Dashboard
            </a>
          ` : ''}
          <div class="auth-user-divider"></div>
          <button class="auth-dropdown-item" id="logoutBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Logout
          </button>
        </div>
      </div>
    `;

    // Initialize dropdown functionality
    const trigger = document.getElementById('authUserTrigger');
    const dropdown = document.getElementById('authUserDropdown');

    if (trigger && dropdown) {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', !isOpen);
        dropdown.classList.toggle('active');
      });

      // Close on outside click
      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          trigger.setAttribute('aria-expanded', 'false');
          dropdown.classList.remove('active');
        }
      });

      // Close on Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && dropdown.classList.contains('active')) {
          trigger.setAttribute('aria-expanded', 'false');
          dropdown.classList.remove('active');
          trigger.focus();
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await proMgr.logout();
      });
    }

    // Manage subscription button (if pro)
    const manageSubBtn = document.getElementById('manageSubscriptionBtn');
    if (manageSubBtn) {
      manageSubBtn.addEventListener('click', async () => {
        await proMgr.openCustomerPortal();
      });
    }

  } else {
    // Not authenticated - show login/register links
    container.innerHTML = `
      <div class="auth-actions">
        <a href="/auth.html" class="auth-link auth-login">Login</a>
        <a href="/auth.html" class="auth-link auth-register">Sign Up</a>
      </div>
    `;
  }
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
        <div class="footer-content">
          <span class="footer-text">
            Site Mechanic by <strong>Peter Freedman</strong> |
            <span style="opacity: 0.7;">v${data.build}</span> |
            Web optimization & development services |
            <a href="mailto:peter@sitemechanic.io" class="site-footer-link">peter@sitemechanic.io</a>
          </span>
          <button
            id="themeToggle"
            class="footer-theme-toggle"
            aria-label="Toggle dark/light theme"
            aria-pressed="false"
            title="Toggle theme"
          >
            <svg class="theme-icon" width="20" height="20" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
              <path d="M50 5 A45 45 0 0 0 50 95 Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      `;
      footerBar.innerHTML = footerContent;
    })
    .catch(() => {
      // Fallback if version fetch fails
      const footerContent = `
        <div class="footer-content">
          <span class="footer-text">
            Site Mechanic by <strong>Peter Freedman</strong> |
            Web optimization & development services |
            <a href="mailto:peter@sitemechanic.io" class="site-footer-link">peter@sitemechanic.io</a>
          </span>
          <button
            id="themeToggle"
            class="footer-theme-toggle"
            aria-label="Toggle dark/light theme"
            aria-pressed="false"
            title="Toggle theme"
          >
            <svg class="theme-icon" width="20" height="20" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="4"/>
              <path d="M50 5 A45 45 0 0 0 50 95 Z" fill="currentColor"/>
            </svg>
          </button>
        </div>
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

  // Initialize collapsible sections
  initializeMobileNavSections();
}

/**
 * Initialize collapsible sections in mobile navigation
 */
function initializeMobileNavSections() {
  console.log('📂 Initializing mobile nav collapsible sections...');

  const sectionHeaders = document.querySelectorAll('.mobile-nav-section-header');

  console.log(`📂 Found ${sectionHeaders.length} collapsible sections`);

  sectionHeaders.forEach(header => {
    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const section = header.closest('.mobile-nav-section');
      const itemsContainer = section.querySelector('.mobile-nav-section-items');
      const arrow = header.querySelector('.mobile-nav-section-arrow');
      const isExpanded = header.getAttribute('aria-expanded') === 'true';

      // Toggle this section
      if (isExpanded) {
        // Collapse
        header.setAttribute('aria-expanded', 'false');
        itemsContainer.style.maxHeight = '0';
        arrow.style.transform = 'rotate(0deg)';
      } else {
        // Expand
        header.setAttribute('aria-expanded', 'true');
        itemsContainer.style.maxHeight = itemsContainer.scrollHeight + 'px';
        arrow.style.transform = 'rotate(90deg)';
      }

      console.log(`📂 Section ${section.dataset.category} ${isExpanded ? 'collapsed' : 'expanded'}`);
    });
  });
}

/**
 * Initialize theme toggle functionality
 */
function initializeThemeControls() {
  console.log('Y Initializing theme controls...');

  const headerThemeToggle = document.getElementById('headerThemeToggle');
  const footerThemeToggle = document.getElementById('themeToggle');
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const body = document.body;

  console.log('Y Theme toggle elements:', {
    header: headerThemeToggle ? 'found' : 'NOT FOUND',
    footer: footerThemeToggle ? 'found' : 'NOT FOUND',
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

    // Update header theme toggle (desktop)
    if (headerThemeToggle) {
      headerThemeToggle.setAttribute('aria-pressed', isLight);
      headerThemeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      headerThemeToggle.setAttribute('title', isLight ? 'Dark' : 'Light');
    }

    // Update footer theme toggle
    if (footerThemeToggle) {
      footerThemeToggle.setAttribute('aria-pressed', isLight);
      footerThemeToggle.setAttribute('aria-label', isLight ? 'Switch to dark theme' : 'Switch to light theme');
      footerThemeToggle.setAttribute('title', isLight ? 'Dark' : 'Light');
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

  // Header theme toggle (desktop)
  if (headerThemeToggle) {
    headerThemeToggle.addEventListener('click', toggleTheme);
    console.log('Y Header theme toggle click listener added');
  }

  // Footer theme toggle
  if (footerThemeToggle) {
    footerThemeToggle.addEventListener('click', toggleTheme);
    console.log('Y Footer theme toggle click listener added');
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
