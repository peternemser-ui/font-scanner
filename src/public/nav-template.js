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
  },
  help: {
    id: 'help',
    label: 'Help',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.82 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg>',
    description: 'FAQs and troubleshooting'
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
    tier: 'pro',
    description: 'LCP, FID, CLS metrics'
  },
  {
    href: '/performance-hub.html?mode=full',
    label: 'Lighthouse Metrics',
    id: 'performance-analyzer',
    category: 'performance',
    tier: 'pro',
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
    tier: 'free',
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
  },

  // --- I. HELP ---
  {
    href: '/faq.html',
    label: 'FAQ',
    id: 'faq',
    category: 'help',
    description: 'Scans, paid reports, and troubleshooting'
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
    return {
      href: d.href,
      icon: CATEGORIES[d.category]?.icon || '',
      label: d.label,
      id: d.id,
      badge: null, // Removed "Saves time" badges
      tier: d.tier, // Include tier for FREE badge display
      category: d.category,
      stage: 2
    };
  });

// Helper: Get category info
function getCategoryInfo(categoryId) {
  return CATEGORIES[categoryId] || null;
}

/**
 * Render breadcrumb trail: Home > Section > Tool
 * - Home always links to dashboard
 * - Section is the tool category (when available)
 * - Tool is the current page label
 */
function renderBreadcrumb(activePageId) {
  const currentUrl = new URLSearchParams(window.location.search).get('url');

  const activeItem =
    NAV_CONFIG.find(item => item.id === activePageId) ||
    MORE_DIAGNOSTICS_CONFIG.find(item => item.id === activePageId) ||
    null;

  if (!activeItem) return '';

  const category = activeItem.category ? getCategoryInfo(activeItem.category) : null;
  const parts = [];

  parts.push(`<a href="/dashboard.html" data-i18n="breadcrumb.home">Home</a>`);

  // Only show Section when we have a category and we're not on a top-level page.
  if (category && activePageId !== 'dashboard') {
    parts.push(`<span class="breadcrumb-separator" aria-hidden="true">›</span>`);
    parts.push(`<span class="breadcrumb-section">${category.label}</span>`);
  }

  // Current page
  const isDashboard = activePageId === 'dashboard';
  if (!isDashboard) {
    parts.push(`<span class="breadcrumb-separator" aria-hidden="true">›</span>`);
    parts.push(`<span class="breadcrumb-current" aria-current="page">${activeItem.label}</span>`);
  } else {
    parts.push(`<span class="breadcrumb-separator" aria-hidden="true">›</span>`);
    parts.push(`<span class="breadcrumb-current" aria-current="page">Dashboard</span>`);
  }

  // If we have a url context, expose it for screen readers without adding UI noise.
  const contextNote = currentUrl ? ` <span class="breadcrumb-context" aria-label="Current site context">(${currentUrl})</span>` : '';

  return `
    <div class="breadcrumb-bar" role="navigation" aria-label="Breadcrumb">
      <div class="breadcrumb-container">
        <div class="breadcrumb">${parts.join('')}${contextNote}</div>
      </div>
    </div>
  `;
}

/**
 * Render the unified header with app title and subtitle
 * @param {string} appTitle - Main app title (e.g., "FONT SCANNER")
 * @param {string} subtitle - Analyzer name (e.g., "SEO Analysis")
 * @returns {string} HTML string for the unified header
 */
function renderUnifiedHeader(appTitle, subtitle) {
  // Cache-bust logo assets so updates show immediately without relying on hard refresh.
  const logoAssetVersion = '20260112.2';

  return `
    <div class="unified-header">
      <!-- Hamburger Menu Button (Mobile Only) -->
      <button 
        class="hamburger-btn" 
        id="hamburgerBtn"
        type="button"
        aria-label="Toggle navigation menu"
        aria-expanded="false"
        aria-controls="mobileNav"
      >
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
        <span class="hamburger-line"></span>
      </button>
      
      <!-- Center: App Logo and Subtitle -->
      <div class="unified-header-center">
        <a href="/" class="app-logo-link" aria-label="Site Mechanic Home">
          <img src="/assets/logo-dark.svg?v=${logoAssetVersion}" alt="Site Mechanic" class="app-logo app-logo-dark" />
          <img src="/assets/logo-light.svg?v=${logoAssetVersion}" alt="Site Mechanic" class="app-logo app-logo-light" />
        </a>
        <div class="app-subtitle" data-i18n="app.tagline">${subtitle}</div>
      </div>
      
      <!-- Right: Auth + Language Selector + Theme Toggle -->
      <div class="unified-header-right">
        <div id="authLinksContainer" class="auth-links-container"></div>
        <div id="languageSelectorContainer" class="language-selector-header"></div>
        <button
          id="headerThemeToggle"
          class="header-theme-toggle"
          type="button"
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
    <div id="scanContextBar" class="scan-context-bar" style="display: none;"></div>
  `;
}

/**
 * Render the scan context bar showing current domain and actions
 * This appears below the header when there's an active scan context
 */
function renderScanContextBar() {
  const bar = document.getElementById('scanContextBar');
  if (!bar) return;
  
  // Check if ScanContext exists and has data
  if (!window.ScanContext || !window.ScanContext.exists()) {
    bar.style.display = 'none';
    return;
  }
  
  const context = window.ScanContext.get();
  const domain = context.domain || 'Unknown site';
  const timeSince = window.ScanContext.getTimeSinceScan() || '';
  
  bar.innerHTML = `
    <div class="scan-context-content">
      <div class="scan-context-info">
        <span class="scan-context-label">Currently analyzing:</span>
        <span class="scan-context-domain">${domain}</span>
        ${timeSince ? `<span class="scan-context-time">• Scanned ${timeSince}</span>` : ''}
      </div>
      <div class="scan-context-actions">
        <button onclick="window.ScanContext.clear(); window.location.href='/dashboard.html'" class="scan-context-btn scan-context-btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
          Change Site
        </button>
        <button onclick="window.location.href='/dashboard.html'" class="scan-context-btn scan-context-btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          Run New Scan
        </button>
      </div>
    </div>
  `;
  bar.style.display = 'block';
}

/**
 * Add styles for the scan context bar
 */
function addScanContextStyles() {
  if (document.getElementById('scanContextStyles')) return;
  
  const style = document.createElement('style');
  style.id = 'scanContextStyles';
  style.textContent = `
    .scan-context-bar {
      background: linear-gradient(135deg, rgba(var(--accent-primary-rgb), 0.08) 0%, rgba(var(--accent-primary-rgb), 0.03) 100%);
      border-bottom: 1px solid rgba(var(--accent-primary-rgb), 0.2);
      padding: 0.5rem 1rem;
    }
    .scan-context-content {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .scan-context-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .scan-context-label {
      color: #888;
      font-size: 0.85rem;
    }
    .scan-context-domain {
      color: var(--accent-primary);
      font-weight: 600;
      font-size: 0.9rem;
    }
    .scan-context-time {
      color: #666;
      font-size: 0.8rem;
    }
    .scan-context-actions {
      display: flex;
      gap: 0.5rem;
    }
    .scan-context-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
    }
    .scan-context-btn-secondary {
      background: transparent;
      border-color: rgba(255, 255, 255, 0.15);
      color: #aaa;
    }
    .scan-context-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.25);
      color: #fff;
    }
    .scan-context-btn-primary {
      background: rgba(var(--accent-primary-rgb), 0.1);
      border-color: rgba(var(--accent-primary-rgb), 0.3);
      color: var(--accent-primary);
    }
    .scan-context-btn-primary:hover {
      background: rgba(var(--accent-primary-rgb), 0.2);
      border-color: rgba(var(--accent-primary-rgb), 0.5);
    }
    @media (max-width: 600px) {
      .scan-context-content {
        flex-direction: column;
        align-items: flex-start;
      }
      .scan-context-actions {
        width: 100%;
      }
      .scan-context-btn {
        flex: 1;
        justify-content: center;
      }
    }
  `;
  document.head.appendChild(style);
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
    
    // Badge logic: item.badge for custom badges, tier for free/pro indicators
    let badge = '';
    if (item.badge) {
      badge = `<span class="hot-badge">${item.badge}</span>`;
    } else if (item.tier === 'free') {
      badge = `<span class="free-badge" style="background: #00ff41; color: #000; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-left: 0.5rem; display: inline-block; vertical-align: middle;">FREE</span>`;
    }

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
  const categoryOrder = ['performance', 'seo', 'accessibility', 'security', 'technology', 'infrastructure', 'competitive', 'help'];
  
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
          <button type="button" class="nav-link nav-dropdown-trigger ${isDropdownActive ? 'active' : ''}" aria-expanded="false" aria-haspopup="true">
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
    return;
  }
  navInitialized = true;

  // Remove any leftover merge conflict artifacts that may be rendered on the page
  // (defensive: never let this block header/nav rendering)
  try {
    removeMergeConflictArtifacts();
  } catch (e) {
  }

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
    } else if (path.includes('faq')) {
      activePageId = 'faq';
      appTitle = 'SITE MECHANIC';
      subtitle = '> help / faq';
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
    navPlaceholder.innerHTML = renderUnifiedHeader(appTitle, subtitle) + renderNavigation(activePageId) + renderBreadcrumb(activePageId);
  }
  
  // Initialize controls after rendering
  ensureGlobalFooter(); // Create footer first (contains theme toggle)
  initializeAuthLinks(); // Initialize authentication links
  initializeHamburgerMenu();
  initializeNavScroll();
  initializeDropdownMenu();
  initializeHeaderLanguageSwitcher();
  
  // Global click handler to close dropdowns when clicking outside
  document.addEventListener('click', function(e) {
    // Close auth dropdown when clicking outside
    const authWrapper = document.getElementById('authDropdownWrapper');
    const authTrigger = document.getElementById('authUserTrigger');
    if (authWrapper && authWrapper.classList.contains('open')) {
      if (!authWrapper.contains(e.target)) {
        authWrapper.classList.remove('open');
        if (authTrigger) authTrigger.setAttribute('aria-expanded', 'false');
      }
    }
  });
  
  // Initialize scan context bar
  addScanContextStyles();
  renderScanContextBar();
  
  // Listen for scan context updates
  window.addEventListener('scanContextUpdated', () => {
    renderScanContextBar();
  });

  // Initialize theme controls after footer is ready
  setTimeout(() => {
    initializeThemeControls();
  }, 100);
  
  // Re-translate the page to catch dynamically rendered nav elements
  if (window.i18n && window.i18n.translatePage) {
    window.i18n.translatePage();
  }

  // Progressive enhancement: ensure legacy accordions meet a11y requirements
  initializeGlobalAccordionA11y();
}

// =============================================================================
// Accessibility helpers
// =============================================================================

function initializeGlobalAccordionA11y() {
  if (window.__smAccordionA11yInitialized) return;
  window.__smAccordionA11yInitialized = true;

  let idCounter = 0;

  function getPanelForHeader(headerEl) {
    if (!headerEl) return null;

    // Most legacy accordions are: .accordion-header + next sibling content
    const next = headerEl.nextElementSibling;
    if (next && next.classList && (next.classList.contains('accordion-content') || next.classList.contains('accordion-body') || next.classList.contains('accordion-panel'))) {
      return next;
    }

    // Some accordions nest content inside the item
    const item = headerEl.closest('.accordion-item');
    if (!item) return null;
    return item.querySelector('.accordion-content, .accordion-body, .accordion-panel');
  }

  function isExpanded(headerEl, buttonEl, panelEl) {
    const item = headerEl && headerEl.closest ? headerEl.closest('.accordion-item') : null;
    if (item && item.classList && item.classList.contains('open')) return true;
    if (headerEl && headerEl.classList && headerEl.classList.contains('active')) return true;
    if (buttonEl && buttonEl.classList && buttonEl.classList.contains('active')) return true;

    if (panelEl && panelEl.classList && (panelEl.classList.contains('expanded') || panelEl.classList.contains('open'))) return true;
    if (panelEl && typeof panelEl.getAttribute === 'function' && panelEl.getAttribute('aria-hidden') === 'false') return true;
    if (panelEl && panelEl.style && typeof panelEl.style.maxHeight === 'string') {
      const mh = panelEl.style.maxHeight.trim();
      if (mh && mh !== '0px' && mh !== '0') return true;
    }
    return false;
  }

  function ensureIds(buttonEl, panelEl) {
    idCounter += 1;
    if (buttonEl && !buttonEl.id) buttonEl.id = `sm-accordion-header-${idCounter}`;
    if (panelEl && !panelEl.id) panelEl.id = `sm-accordion-panel-${idCounter}`;
  }

  function syncAria(headerEl) {
    if (!headerEl) return;

    const panelEl = getPanelForHeader(headerEl);
    const buttonEl = (headerEl.tagName === 'BUTTON')
      ? headerEl
      : headerEl.querySelector('button.accordion-header__button');

    if (!buttonEl || !panelEl) return;

    ensureIds(buttonEl, panelEl);

    buttonEl.setAttribute('type', 'button');
    buttonEl.setAttribute('aria-controls', panelEl.id);
    buttonEl.setAttribute('aria-expanded', String(isExpanded(headerEl, buttonEl, panelEl)));

    if (!panelEl.getAttribute('role')) panelEl.setAttribute('role', 'region');
    panelEl.setAttribute('aria-labelledby', buttonEl.id);
  }

  function upgradeHeader(headerEl) {
    if (!headerEl) return;

    // If the header itself is already a <button>, just wire ARIA
    if (headerEl.tagName === 'BUTTON') {
      headerEl.setAttribute('data-sm-accordion-button', 'true');
      syncAria(headerEl);
      return;
    }

    // If we've already injected a button, just wire ARIA
    const existingButton = headerEl.querySelector('button.accordion-header__button');
    if (existingButton) {
      existingButton.setAttribute('data-sm-accordion-button', 'true');
      syncAria(headerEl);
      return;
    }

    // Inject a real <button> while preserving existing click handlers on the container
    const buttonEl = document.createElement('button');
    buttonEl.type = 'button';
    buttonEl.className = 'accordion-header__button';
    buttonEl.setAttribute('data-sm-accordion-button', 'true');

    // Move existing children into the button
    while (headerEl.firstChild) {
      buttonEl.appendChild(headerEl.firstChild);
    }
    headerEl.appendChild(buttonEl);

    syncAria(headerEl);
  }

  function upgradeAllAccordions(root = document) {
    const headers = root.querySelectorAll ? root.querySelectorAll('.accordion-header') : [];
    headers.forEach(upgradeHeader);
  }

  // Keep aria-expanded in sync with legacy open/close implementations
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.accordion-header__button, button.accordion-header, [data-sm-accordion-button]');
    if (!btn) return;
    const headerEl = btn.classList.contains('accordion-header') ? btn : btn.closest('.accordion-header');
    if (!headerEl) return;
    // Let the page's existing toggle logic run first, then sync
    window.requestAnimationFrame(() => syncAria(headerEl));
  });

  // Initial pass
  upgradeAllAccordions(document);

  // Upgrade dynamically rendered accordions (many pages render results after scan)
  let debounceHandle = null;
  const observer = new MutationObserver(() => {
    if (debounceHandle) return;
    debounceHandle = window.setTimeout(() => {
      debounceHandle = null;
      upgradeAllAccordions(document);
    }, 50);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

/**
 * Strip merge conflict markers that might appear on legacy deployments
 */
function removeMergeConflictArtifacts() {
  if (!document || !document.body) return;

  const conflictRegex = /<<<<<<< HEAD[\s\S]*?>>>>>>>[ \t]*[0-9a-f]+/gi;
  const additionalPhrases = [
    'Updated deployment scripts and server files'
  ];

  const showText = (typeof NodeFilter !== 'undefined' && NodeFilter && NodeFilter.SHOW_TEXT)
    ? NodeFilter.SHOW_TEXT
    : 4; // NodeFilter.SHOW_TEXT
  const walker = document.createTreeWalker(document.body, showText);
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
    return;
  }
  
  // Move menu to body and use fixed positioning to escape stacking contexts
  document.body.appendChild(menu);
  // Start hidden
  menu.style.cssText = 'display: none !important; visibility: hidden !important;';
  let isOpen = false;
  
  // Helper to detect if we're in light mode
  function isLightMode() {
    return document.body.classList.contains('white-theme');
  }
  
  // Set up hover handlers ONCE for all nav-links (before menu is shown)
  menu.querySelectorAll('.nav-link').forEach(el => {
    el.addEventListener('mouseenter', function() {
      const light = isLightMode();
      // Theme-specific hover colors: cyan for dark, red for light
      if (light) {
        this.style.background = 'rgba(221, 56, 56, 0.12)';
        this.style.color = '#dd3838';
        this.style.boxShadow = '0 2px 8px rgba(221, 56, 56, 0.15)';
      } else {
        this.style.background = 'rgba(91, 244, 231, 0.15)';
        this.style.color = '#5bf4e7';
        this.style.boxShadow = '0 2px 8px rgba(91, 244, 231, 0.2)';
      }
      this.style.transform = 'translateX(4px)';
    });
    el.addEventListener('mouseleave', function() {
      this.style.background = 'transparent';
      this.style.transform = 'translateX(0)';
      this.style.boxShadow = 'none';
      // Use appropriate text color based on current theme
      this.style.color = isLightMode() ? '#333333' : '#e0e0e0';
    });
  });
  
  function updateMenuPosition() {
    if (!isOpen) return;
    const rect = trigger.getBoundingClientRect();
    const topPos = rect.bottom + 8;
    const rightPos = window.innerWidth - rect.right;
    const maxHeight = window.innerHeight - topPos - 20;
    menu.style.top = `${topPos}px`;
    menu.style.right = `${rightPos}px`;
    menu.style.maxHeight = `${maxHeight}px`;
  }
  
  function showMenu() {
    const rect = trigger.getBoundingClientRect();
    const topPos = rect.bottom + 8;
    const rightPos = window.innerWidth - rect.right;
    // Calculate max height - leave some space at bottom
    const maxHeight = window.innerHeight - topPos - 20;
    
    // Detect current theme
    const lightMode = isLightMode();
    
    // Theme-aware colors
    const bgColor = lightMode ? '#ffffff' : 'rgba(30, 30, 35, 0.98)';
    const borderColor = lightMode ? '#e0e0e0' : 'rgba(255,255,255,0.1)';
    const shadowColor = lightMode ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.5)';
    const textColor = lightMode ? '#333333' : '#e0e0e0';
    const labelColor = lightMode ? '#888' : '#888';
    const iconColor = lightMode ? '#666' : '#999';
    const dividerColor = lightMode ? '#e8e8e8' : 'rgba(255,255,255,0.1)';
    
    menu.style.cssText = `
      position: fixed !important;
      top: ${topPos}px !important;
      right: ${rightPos}px !important;
      left: auto !important;
      display: block !important;
      opacity: 1 !important;
      visibility: visible !important;
      pointer-events: auto !important;
      transform: none !important;
      z-index: 2147483647 !important;
      min-width: 320px !important;
      max-width: 360px !important;
      max-height: ${maxHeight}px !important;
      overflow-y: auto !important;
      background: ${bgColor} !important;
      border: 1px solid ${borderColor} !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 40px ${shadowColor} !important;
      padding: 0.5rem !important;
    `;
    
    // Make all children visible since menu is no longer inside .nav-dropdown
    menu.querySelectorAll('.dropdown-category').forEach(el => {
      el.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important; position: relative !important; left: auto !important; top: auto !important; pointer-events: auto !important; z-index: auto !important;';
    });
    menu.querySelectorAll('.dropdown-category-header').forEach(el => {
      el.style.cssText = `display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; left: auto !important; top: auto !important; pointer-events: auto !important; border-top: 1px solid ${dividerColor} !important;`;
    });
    menu.querySelectorAll('.dropdown-category-icon').forEach(el => {
      el.style.cssText = `display: inline-flex !important; visibility: visible !important; opacity: 0.6 !important; position: relative !important; left: auto !important; top: auto !important; color: ${iconColor} !important;`;
    });
    menu.querySelectorAll('.dropdown-category-label').forEach(el => {
      el.style.cssText = `display: inline !important; visibility: visible !important; opacity: 1 !important; position: relative !important; left: auto !important; top: auto !important; color: ${labelColor} !important;`;
    });
    menu.querySelectorAll('.nav-link').forEach(el => {
      // Set base styles - theme-appropriate text color with smooth transitions
      el.style.cssText = `display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important; left: auto !important; top: auto !important; pointer-events: auto !important; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 8px; color: ${textColor}; text-decoration: none; transition: all 0.2s ease; white-space: nowrap; background: transparent; transform: translateX(0); box-shadow: none;`;
    });
    dropdown.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    isOpen = true;
  }
  
  function hideMenu() {
    menu.style.cssText = 'display: none !important; visibility: hidden !important;';
    dropdown.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    isOpen = false;
  }
  
  // Toggle dropdown on trigger click
  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Close account dropdown if open
    const authMenu = document.getElementById('authUserDropdown');
    const authWrapper = document.getElementById('authDropdownWrapper');
    if (authMenu && authMenu.style.display === 'block') {
      authMenu.style.cssText = 'display: none !important;';
      if (authWrapper) authWrapper.classList.remove('open');
    }
    
    if (!isOpen) {
      showMenu();
    } else {
      hideMenu();
    }
  });
  
  // Reposition menu when page scrolls so it stays anchored to trigger
  window.addEventListener('scroll', updateMenuPosition, { passive: true });
  window.addEventListener('resize', updateMenuPosition, { passive: true });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && 
        !trigger.contains(e.target) && 
        !menu.contains(e.target)) {
      hideMenu();
    }
  });
  
  // Close dropdown on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      hideMenu();
      trigger.focus();
    }
  });
  
  // Close dropdown when clicking any navigation link inside
  const navLinks = menu.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      hideMenu();
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
  }
}

function getProManagerForNav() {
  if (window.proManager && typeof window.proManager.isAuthenticated === 'function') {
    return window.proManager;
  }

  const readAuthState = () => {
    let user = null;
    let token = null;
    try {
      token = localStorage.getItem('sm_token');
      const rawUser = localStorage.getItem('sm_user');
      user = rawUser ? JSON.parse(rawUser) : null;
    } catch {
      user = null;
      token = null;
    }
    return { user, token };
  };

  const getAuthHeaders = () => {
    const { token } = readAuthState();
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  };

  const clearAuth = () => {
    try {
      localStorage.removeItem('sm_user');
      localStorage.removeItem('sm_token');
    } catch {
      // ignore
    }
  };

  return {
    isAuthenticated: () => {
      const { user, token } = readAuthState();
      return !!user && !!token;
    },
    isPro: () => {
      const { user } = readAuthState();
      return !!user && user.plan === 'pro';
    },
    isAdmin: () => {
      const { user } = readAuthState();
      return !!user && user.is_admin === 1;
    },
    getEmail: () => {
      const { user } = readAuthState();
      return user?.email || null;
    },
    logout: async () => {
      try {
        const { token } = readAuthState();
        if (token) {
          await fetch('/api/auth/logout', {
            method: 'POST',
            headers: getAuthHeaders()
          });
        }
      } catch {
        // ignore
      } finally {
        clearAuth();
        window.location.href = '/';
      }
    },
    openCustomerPortal: async () => {
      const { token } = readAuthState();
      if (!token) {
        window.location.href = '/auth.html';
        return;
      }

      try {
        const response = await fetch('/api/payment/create-portal-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            returnUrl: window.location.origin + '/account.html'
          })
        });

        if (!response.ok) {
          throw new Error('Failed to create portal session');
        }

        const data = await response.json();
        const portalUrl = data.portalUrl || data.url;
        if (data.success && portalUrl) {
          window.location.href = portalUrl;
        }
      } catch (error) {
        console.error('Failed to open customer portal:', error);
        alert('Failed to open billing portal. Please try again.');
      }
    }
  };
}

/**
 * Initialize authentication links in header
 */
function initializeAuthLinks() {
  const container = document.getElementById('authLinksContainer');
  if (!container) return;

  const proMgr = getProManagerForNav();

  // Render auth links based on authentication status
  if (proMgr.isAuthenticated()) {
    const isPro = proMgr.isPro();
    const email = proMgr.getEmail() || '';
    const initials = email.substring(0, 2).toUpperCase();

    // Render everything together in the container (matching .nav-dropdown pattern)
    container.innerHTML = `
      <div class="auth-dropdown" id="authDropdownWrapper">
        <button class="auth-user-trigger" id="authUserTrigger" type="button" aria-expanded="false" aria-haspopup="true">
          <span class="auth-user-avatar">${initials}</span>
          ${isPro ? '<span class="auth-user-pro-badge">✨ PRO</span>' : ''}
          <svg class="auth-dropdown-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
        <div class="auth-dropdown-menu" id="authUserDropdown">
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
          ${!isPro ? '' : `
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

    // Move dropdown menu to body to escape all stacking contexts
    const menu = document.getElementById('authUserDropdown');
    if (menu) {
      document.body.appendChild(menu);
    }

    // Set up click handler directly on trigger
    const wrapper = document.getElementById('authDropdownWrapper');
    const trigger = document.getElementById('authUserTrigger');
    const movedMenu = document.getElementById('authUserDropdown');
    
    if (trigger && wrapper && movedMenu) {
      trigger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Close nav dropdown if open
        const navDropdown = document.querySelector('.nav-dropdown.open');
        if (navDropdown) {
          navDropdown.classList.remove('open');
        }
        
        const isOpen = movedMenu.style.display === 'block';
        
        // Check if light theme is active
        const isLightTheme = document.body.classList.contains('white-theme');
        const bgColor = isLightTheme ? 'rgba(255, 255, 255, 0.98)' : 'rgba(20, 20, 20, 0.98)';
        const borderColor = isLightTheme ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)';
        const shadowColor = isLightTheme ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.5)';
        
        if (!isOpen) {
          // Position the fixed menu relative to trigger
          const rect = trigger.getBoundingClientRect();
          movedMenu.style.cssText = `
            position: fixed !important;
            top: ${rect.bottom + 8}px !important;
            right: ${window.innerWidth - rect.right}px !important;
            left: auto !important;
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
            transform: none !important;
            z-index: 2147483647 !important;
            display: block !important;
            min-width: 240px !important;
            background: ${bgColor} !important;
            border: 1px solid ${borderColor} !important;
            border-radius: 8px !important;
            box-shadow: 0 8px 32px ${shadowColor} !important;
            padding: 0.5rem !important;
          `;
          wrapper.classList.add('open');
          trigger.setAttribute('aria-expanded', 'true');
        } else {
          movedMenu.style.cssText = 'display: none !important;';
          wrapper.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
      
      // Close on outside click
      document.addEventListener('click', function(e) {
        if (movedMenu.style.display === 'block' && 
            !trigger.contains(e.target) && 
            !movedMenu.contains(e.target)) {
          movedMenu.style.cssText = 'display: none !important;';
          wrapper.classList.remove('open');
          trigger.setAttribute('aria-expanded', 'false');
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
    // Not authenticated - show login link only
    container.innerHTML = `
      <div class="auth-actions">
        <a href="/auth.html" class="auth-link auth-login">Login</a>
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
            &copy; 2026 Site Mechanic by <strong>Peter Freedman</strong> |
            <span style="opacity: 0.7;">v${data.build}</span> |
            Web optimization & development services |
            <a href="/faq.html" class="site-footer-link">FAQ</a> |
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
            &copy; 2026 Site Mechanic by <strong>Peter Freedman</strong> |
            Web optimization & development services |
            <a href="/faq.html" class="site-footer-link">FAQ</a> |
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
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  let mobileNav = document.getElementById('mobileNav');
  let mobileNavOverlay = document.getElementById('mobileNavOverlay');
  const mobileNavClose = document.getElementById('mobileNavClose');
  const body = document.body;
  if (!hamburgerBtn || !mobileNav || !mobileNavOverlay) {
    console.error('✗ Hamburger menu elements not found!');
    return;
  }

  // Move mobile nav elements to body to escape stacking context of #nav-placeholder
  // This ensures the mobile menu always appears on top of all page content
  if (mobileNavOverlay.parentElement !== body) {
    body.appendChild(mobileNavOverlay);
  }
  if (mobileNav.parentElement !== body) {
    body.appendChild(mobileNav);
  }

  // Re-query after move
  mobileNav = document.getElementById('mobileNav');
  mobileNavOverlay = document.getElementById('mobileNavOverlay');
  // Open mobile menu
  const openMenu = () => {
    mobileNav.classList.add('active');
    mobileNavOverlay.classList.add('active');
    hamburgerBtn.classList.add('active');
    hamburgerBtn.setAttribute('aria-expanded', 'true');
    body.style.overflow = 'hidden'; // Prevent body scroll when menu is open
  };
  
  // Close mobile menu
  const closeMenu = () => {
    mobileNav.classList.remove('active');
    mobileNavOverlay.classList.remove('active');
    hamburgerBtn.classList.remove('active');
    hamburgerBtn.setAttribute('aria-expanded', 'false');
    body.style.overflow = ''; // Restore body scroll
  };
  
  // Toggle on hamburger button click
  hamburgerBtn.addEventListener('click', () => {
    if (mobileNav.classList.contains('active')) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  
  // Close on overlay click
  mobileNavOverlay.addEventListener('click', () => {
    closeMenu();
  });
  
  // Close on close button click
  if (mobileNavClose) {
    mobileNavClose.addEventListener('click', () => {
      closeMenu();
    });
  }
  
  // Close on nav link click
  const mobileNavLinks = mobileNav.querySelectorAll('.nav-link');
  mobileNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      closeMenu();
    });
  });
  
  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileNav.classList.contains('active')) {
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
  const sectionHeaders = document.querySelectorAll('.mobile-nav-section-header');
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
    });
  });
}

/**
 * Initialize theme toggle functionality
 */
function initializeThemeControls() {
  const headerThemeToggle = document.getElementById('headerThemeToggle');
  const footerThemeToggle = document.getElementById('themeToggle');
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const body = document.body;
  const currentTheme = localStorage.getItem('theme') || 'dark';
  // Apply theme on load
  if (currentTheme === 'light') {
    body.classList.add('white-theme');
    // FORCE background with inline styles
    body.style.backgroundColor = '#ffffff';
    body.style.color = '#000000';
  } else {
    // Dark mode - explicitly set dark colors
    body.classList.remove('white-theme');
    body.style.backgroundColor = '#000000';
    body.style.color = '#ffffff';
  }
  
  const updateThemeButtons = () => {
    const isLight = body.classList.contains('white-theme');
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
    body.classList.toggle('white-theme');
    const newTheme = body.classList.contains('white-theme') ? 'light' : 'dark';
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
  }

  // Footer theme toggle
  if (footerThemeToggle) {
    footerThemeToggle.addEventListener('click', toggleTheme);
  }

  // Mobile theme toggle
  if (mobileThemeToggle) {
    mobileThemeToggle.addEventListener('click', toggleTheme);
  }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
  initializeNavigation();
}
