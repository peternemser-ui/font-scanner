// Hosting Pricing Analyzer JavaScript
// Frontend rendering and API interaction for hosting analysis

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'hosting-analyzer';

// Translation helper - evaluates at runtime to ensure i18n is loaded
function t(key, fallback, params = {}) {
  let value = fallback;
  if (window.i18n && typeof window.i18n.t === 'function') {
    const translated = window.i18n.t(key);
    if (translated !== key) {
      value = translated;
    }
  }
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{\\{?${param}\\}?\\}`, 'g');
      value = value.replace(regex, params[param]);
    });
  }
  return value;
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    {
      label: t('loader.connectingToWebsite', 'Connecting to website'),
      detail: t('loader.establishingConnection', 'Establishing secure connection...')
    },
    {
      label: t('loader.detectingCms', 'Detecting CMS platform'),
      detail: t('loader.identifyingPlatforms', 'Identifying WordPress, Shopify, Wix, and 10+ more...')
    },
    {
      label: t('loader.detectingHost', 'Detecting current host'),
      detail: t('loader.analyzingDns', 'Analyzing DNS records and headers...')
    },
    {
      label: t('loader.matchingProviders', 'Matching hosting providers'),
      detail: t('loader.findingOptions', 'Finding best options for your platform...')
    },
    {
      label: t('loader.calculatingPricing', 'Calculating pricing'),
      detail: t('loader.comparingProviders', 'Comparing 25+ hosting providers...')
    },
    {
      label: t('loader.findingSavings', 'Finding savings opportunities'),
      detail: t('loader.analyzingCosts', 'Analyzing cost optimization options...')
    },
    {
      label: t('loader.generatingRecommendations', 'Generating recommendations'),
      detail: t('loader.compilingHostingReport', 'Compiling personalized hosting report...')
    }
  ];
}
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

  // Inject CSS for CSP-compliant hover effects
  if (!document.getElementById('hosting-hover-styles')) {
    const style = document.createElement('style');
    style.id = 'hosting-hover-styles';
    style.textContent = `
      .hosting-provider-link:hover {
        transform: scale(1.02) !important;
        box-shadow: 0 4px 12px rgba(0, 217, 255, 0.4) !important;
      }
      .hosting-table-link:hover {
        background: rgba(0, 217, 255, 0.3) !important;
      }
    `;
    document.head.appendChild(style);
  }
});

let currentResults = null;
let currentFilter = 'all';

// Popular hosting providers data for quick browse
// Note: Provider names, categories, highlights, and bestFor are translated at render time
function getPopularProviders() {
  return [
    {
      name: 'WP Engine',
      logo: '🚀',
      category: t('reports.hosting.categories.managedWordPress', 'Managed WordPress'),
      tags: ['wordpress'],
      url: 'https://wpengine.com',
      startingPrice: 20,
      rating: 4.5,
      highlights: [
        t('reports.hosting.highlights.bestWpPerformance', 'Best WordPress performance'),
        t('reports.hosting.highlights.freeMigrations', 'Free migrations'),
        t('reports.hosting.highlights.support247', '24/7 support')
      ],
      bestFor: ['WordPress', 'WooCommerce', t('reports.hosting.bestFor.enterprise', 'Enterprise')]
    },
    {
      name: 'Kinsta',
      logo: '⚡',
      category: t('reports.hosting.categories.managedWordPress', 'Managed WordPress'),
      tags: ['wordpress'],
      url: 'https://kinsta.com',
      startingPrice: 35,
      rating: 4.7,
      highlights: [
        t('reports.hosting.highlights.googleCloud', 'Google Cloud Platform'),
        t('reports.hosting.highlights.fastestWpHost', 'Fastest WordPress host'),
        t('reports.hosting.highlights.dataCenters35', '35+ data centers')
      ],
      bestFor: ['WordPress', t('reports.hosting.bestFor.highTraffic', 'High-traffic sites')]
    },
    {
      name: 'Vercel',
      logo: '▲',
      category: t('reports.hosting.categories.jamstackEdge', 'JAMstack/Edge'),
      tags: ['vps'],
      url: 'https://vercel.com',
      startingPrice: 0,
      rating: 4.8,
      highlights: [
        t('reports.hosting.highlights.bestNextjs', 'Best for Next.js'),
        t('reports.hosting.highlights.edgeFunctions', 'Edge functions'),
        t('reports.hosting.highlights.instantDeploy', 'Instant deployments')
      ],
      bestFor: ['Next.js', 'React', 'JAMstack']
    },
    {
      name: 'Netlify',
      logo: '🔷',
      category: t('reports.hosting.categories.jamstackEdge', 'JAMstack/Edge'),
      tags: ['vps', 'budget'],
      url: 'https://www.netlify.com',
      startingPrice: 0,
      rating: 4.7,
      highlights: [
        t('reports.hosting.highlights.jamstackPioneer', 'Pioneer of JAMstack'),
        t('reports.hosting.highlights.greatDx', 'Great DX'),
        t('reports.hosting.highlights.builtInCiCd', 'Built-in CI/CD')
      ],
      bestFor: ['Gatsby', 'Hugo', t('reports.hosting.bestFor.staticSites', 'Static sites')]
    },
    {
      name: 'DigitalOcean',
      logo: '🌊',
      category: t('reports.hosting.categories.cloudVps', 'Cloud VPS'),
      tags: ['vps', 'budget'],
      url: 'https://www.digitalocean.com',
      startingPrice: 4,
      rating: 4.6,
      highlights: [
        t('reports.hosting.highlights.developerFriendly', 'Developer-friendly'),
        t('reports.hosting.highlights.simplePricing', 'Simple pricing'),
        t('reports.hosting.highlights.kubernetesSupport', 'Kubernetes support')
      ],
      bestFor: ['WordPress', 'Node.js', 'Docker']
    },
    {
      name: 'Vultr',
      logo: '🔥',
      category: t('reports.hosting.categories.cloudVps', 'Cloud VPS'),
      tags: ['vps', 'budget'],
      url: 'https://www.vultr.com',
      startingPrice: 2.5,
      rating: 4.5,
      highlights: [
        t('reports.hosting.highlights.cheapestCloudVps', 'Cheapest cloud VPS'),
        t('reports.hosting.highlights.locations32', '32 locations'),
        t('reports.hosting.highlights.highPerfNvme', 'High performance NVMe')
      ],
      bestFor: ['WordPress', t('reports.hosting.bestFor.gameServers', 'Game servers'), 'VPS']
    },
    {
      name: 'Hetzner',
      logo: '🇩🇪',
      category: t('reports.hosting.categories.cloudVps', 'Cloud VPS'),
      tags: ['vps', 'budget'],
      url: 'https://www.hetzner.com',
      startingPrice: 3.79,
      rating: 4.7,
      highlights: [
        t('reports.hosting.highlights.bestValueEurope', 'Best value in Europe'),
        t('reports.hosting.highlights.carbonNeutral', 'Carbon neutral'),
        t('reports.hosting.highlights.germanDataProtection', 'German data protection')
      ],
      bestFor: ['WordPress', t('reports.hosting.bestFor.enterprise', 'Enterprise'), t('reports.hosting.bestFor.europeFocused', 'Europe-focused')]
    },
    {
      name: 'Shopify',
      logo: '🛒',
      category: t('reports.hosting.categories.ecommercePlatform', 'E-commerce Platform'),
      tags: ['ecommerce'],
      url: 'https://www.shopify.com',
      startingPrice: 29,
      rating: 4.5,
      highlights: [
        t('reports.hosting.highlights.bestDropshipping', 'Best for dropshipping'),
        t('reports.hosting.highlights.appEcosystem', 'App ecosystem'),
        t('reports.hosting.highlights.posIntegration', 'POS integration')
      ],
      bestFor: [t('reports.hosting.bestFor.ecommerce', 'E-commerce'), t('reports.hosting.bestFor.dropshipping', 'Dropshipping'), t('reports.hosting.bestFor.retail', 'Retail')]
    },
    {
      name: 'Cloudflare Pages',
      logo: '☁️',
      category: t('reports.hosting.categories.jamstackEdge', 'JAMstack/Edge'),
      tags: ['vps', 'budget'],
      url: 'https://pages.cloudflare.com',
      startingPrice: 0,
      rating: 4.6,
      highlights: [
        t('reports.hosting.highlights.unlimitedBandwidthFree', 'Unlimited bandwidth free'),
        t('reports.hosting.highlights.fastestEdgeNetwork', 'Fastest edge network'),
        t('reports.hosting.highlights.workersIntegration', 'Workers integration')
      ],
      bestFor: [t('reports.hosting.bestFor.staticSites', 'Static sites'), 'JAMstack', t('reports.hosting.bestFor.globalDelivery', 'Global delivery')]
    },
    {
      name: 'SiteGround',
      logo: '🟠',
      category: t('reports.hosting.categories.sharedHosting', 'Shared Hosting'),
      tags: ['wordpress', 'budget'],
      url: 'https://www.siteground.com',
      startingPrice: 2.99,
      rating: 4.4,
      highlights: [
        t('reports.hosting.highlights.excellentSupport', 'Excellent support'),
        t('reports.hosting.highlights.googleCloud', 'Google Cloud'),
        t('reports.hosting.highlights.freeCdnEmail', 'Free CDN & Email')
      ],
      bestFor: ['WordPress', t('reports.hosting.bestFor.smallBusiness', 'Small business'), t('reports.hosting.bestFor.beginners', 'Beginners')]
    },
    {
      name: 'Hostinger',
      logo: '💜',
      category: t('reports.hosting.categories.sharedHosting', 'Shared Hosting'),
      tags: ['wordpress', 'budget'],
      url: 'https://www.hostinger.com',
      startingPrice: 1.99,
      rating: 4.3,
      highlights: [
        t('reports.hosting.highlights.bestBudgetOption', 'Best budget option'),
        t('reports.hosting.highlights.fastLiteSpeed', 'Fast LiteSpeed servers'),
        t('reports.hosting.highlights.hPanelControl', 'hPanel control panel')
      ],
      bestFor: [t('reports.hosting.bestFor.beginners', 'Beginners'), t('reports.hosting.bestFor.budgetSites', 'Budget sites'), 'WordPress']
    },
    {
      name: 'Cloudways',
      logo: '☁️',
      category: t('reports.hosting.categories.managedCloud', 'Managed Cloud'),
      tags: ['wordpress', 'vps'],
      url: 'https://www.cloudways.com',
      startingPrice: 11,
      rating: 4.5,
      highlights: [
        t('reports.hosting.highlights.chooseYourCloud', 'Choose your cloud'),
        t('reports.hosting.highlights.payAsYouGo', 'Pay as you go'),
        t('reports.hosting.highlights.freeMigrations', 'Free migrations')
      ],
      bestFor: ['WordPress', 'Magento', t('reports.hosting.bestFor.agencies', 'Agencies')]
    },
    {
      name: 'BigCommerce',
      logo: '🛍️',
      category: t('reports.hosting.categories.ecommercePlatform', 'E-commerce Platform'),
      tags: ['ecommerce'],
      url: 'https://www.bigcommerce.com',
      startingPrice: 29,
      rating: 4.4,
      highlights: [
        t('reports.hosting.highlights.noTransactionFees', 'No transaction fees'),
        t('reports.hosting.highlights.builtInSeo', 'Built-in SEO'),
        t('reports.hosting.highlights.multiChannelSelling', 'Multi-channel selling')
      ],
      bestFor: [t('reports.hosting.bestFor.ecommerce', 'E-commerce'), t('reports.hosting.bestFor.growingStores', 'Growing stores'), 'B2B']
    },
    {
      name: 'WooCommerce + Bluehost',
      logo: '🔵',
      category: t('reports.hosting.categories.ecommerceWordPress', 'E-commerce WordPress'),
      tags: ['ecommerce', 'wordpress', 'budget'],
      url: 'https://www.bluehost.com/wordpress/woocommerce-hosting',
      startingPrice: 9.95,
      rating: 4.2,
      highlights: [
        t('reports.hosting.highlights.wooPreInstalled', 'WooCommerce pre-installed'),
        t('reports.hosting.highlights.freeDomain', 'Free domain'),
        t('reports.hosting.highlights.sslIncluded', 'SSL included')
      ],
      bestFor: ['WooCommerce', t('reports.hosting.bestFor.smallStores', 'Small stores'), t('reports.hosting.bestFor.wordPressUsers', 'WordPress users')]
    }
  ];
}

// Filter providers function
function filterProviders(filter) {
  currentFilter = filter;

  // Update button styles based on data-filter attribute
  document.querySelectorAll('.filter-pill').forEach(btn => {
    const btnFilter = btn.getAttribute('data-filter') || btn.textContent.toLowerCase();
    if (btnFilter === filter ||
        (filter === 'all' && (btnFilter === 'all' || btn.textContent === t('reports.hosting.filters.all', 'All')))) {
      btn.style.background = 'rgba(0, 255, 65, 0.2)';
      btn.style.borderColor = 'rgba(0, 255, 65, 0.4)';
      btn.style.color = '#00ff41';
    } else {
      btn.style.background = 'rgba(255, 255, 255, 0.05)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      btn.style.color = '#808080';
    }
  });

  renderPopularProviders();
}

// Make filterProviders available globally
window.filterProviders = filterProviders;

// Chart instances
let priceChart, ratingsChart, categoryChart, valueChart;

// Initialize charts
function initializeCharts() {
  if (typeof Chart === 'undefined') {
    return;
  }

  // Chart.js dark theme defaults
  Chart.defaults.color = '#808080';
  Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';

  // Get top 8 providers for charts
  const POPULAR_PROVIDERS = getPopularProviders();
  const chartProviders = POPULAR_PROVIDERS.slice(0, 8);
  const labels = chartProviders.map(p => p.name);
  const prices = chartProviders.map(p => p.startingPrice);
  const ratings = chartProviders.map(p => p.rating);

  // Color palette
  const colors = [
    '#00ff41', '#00d9ff', '#bb77ff', '#ffd700', 
    '#ff6b6b', '#4ecdc4', '#ff9f43', '#a55eea'
  ];

  // 1. Price Comparison Bar Chart
  const priceCtx = document.getElementById('priceChart');
  if (priceCtx) {
    priceChart = new Chart(priceCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: t('reports.hosting.charts.startingPrice', 'Starting Price ($/mo)'),
          data: prices,
          backgroundColor: colors.map(c => c + '80'),
          borderColor: colors,
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.raw === 0 ? t('reports.hosting.pricing.free', 'FREE') : `$${ctx.raw}/${t('reports.hosting.pricing.mo', 'mo')}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              callback: (value) => value === 0 ? t('reports.hosting.pricing.free', 'FREE') : '$' + value
            }
          },
          x: {
            grid: { display: false },
            ticks: { 
              maxRotation: 45,
              font: { size: 10 }
            }
          }
        }
      }
    });
  }

  // 2. Ratings Horizontal Bar Chart
  const ratingsCtx = document.getElementById('ratingsChart');
  if (ratingsCtx) {
    ratingsChart = new Chart(ratingsCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: t('reports.hosting.charts.userRating', 'User Rating'),
          data: ratings,
          backgroundColor: ratings.map(r => {
            if (r >= 4.7) return 'rgba(0, 255, 65, 0.6)';
            if (r >= 4.5) return 'rgba(0, 217, 255, 0.6)';
            if (r >= 4.3) return 'rgba(255, 215, 0, 0.6)';
            return 'rgba(255, 107, 107, 0.6)';
          }),
          borderColor: ratings.map(r => {
            if (r >= 4.7) return '#00ff41';
            if (r >= 4.5) return '#00d9ff';
            if (r >= 4.3) return '#ffd700';
            return '#ff6b6b';
          }),
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `⭐ ${ctx.raw} / 5.0`  // Rating format is universal
            }
          }
        },
        scales: {
          x: {
            min: 4.0,
            max: 5.0,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { stepSize: 0.2 }
          },
          y: {
            grid: { display: false },
            ticks: { font: { size: 10 } }
          }
        }
      }
    });
  }

  // 3. Category Distribution Doughnut Chart
  const categoryCtx = document.getElementById('categoryChart');
  if (categoryCtx) {
    // Count categories
    const categoryCounts = {};
    POPULAR_PROVIDERS.forEach(p => {
      const cat = p.category.split('/')[0].trim();
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    
    const catLabels = Object.keys(categoryCounts);
    const catData = Object.values(categoryCounts);
    const catColors = ['#00ff41', '#00d9ff', '#bb77ff', '#ffd700', '#ff6b6b', '#4ecdc4'];

    categoryChart = new Chart(categoryCtx, {
      type: 'doughnut',
      data: {
        labels: catLabels,
        datasets: [{
          data: catData,
          backgroundColor: catColors.slice(0, catLabels.length).map(c => c + '80'),
          borderColor: catColors.slice(0, catLabels.length),
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              padding: 8,
              font: { size: 10 }
            }
          }
        },
        cutout: '60%'
      }
    });
  }

  // 4. Value Score Chart (Rating divided by Price, higher = better value)
  const valueCtx = document.getElementById('valueChart');
  if (valueCtx) {
    // Calculate value scores (handle free plans)
    const valueScores = chartProviders.map(p => {
      if (p.startingPrice === 0) return p.rating * 2; // Free = excellent value
      return (p.rating / p.startingPrice * 10).toFixed(2);
    });

    valueChart = new Chart(valueCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: t('reports.hosting.charts.valueScore', 'Value Score'),
          data: valueScores,
          backgroundColor: 'rgba(0, 255, 65, 0.3)',
          borderColor: '#00ff41',
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${t('reports.hosting.charts.valueScore', 'Value Score')}: ${ctx.raw}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            title: {
              display: true,
              text: t('reports.hosting.charts.higherBetterValue', 'Higher = Better Value'),
              color: '#808080',
              font: { size: 10 }
            }
          },
          x: {
            grid: { display: false },
            ticks: { 
              maxRotation: 45,
              font: { size: 10 }
            }
          }
        }
      }
    });
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  const analyzeButton = document.getElementById('analyzeButton');
  const urlInput = document.getElementById('urlInput');

  analyzeButton.addEventListener('click', () => analyzeHosting());

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeHosting();
    }
  });

  // Render popular providers on page load
  renderPopularProviders();
  
  // Initialize charts
  initializeCharts();

  // Auto-start scan if URL parameter is present
  if (typeof window.getUrlParameter === 'function') {
    const autoUrl = window.getUrlParameter();
    if (autoUrl) {
      urlInput.value = autoUrl;
      setTimeout(() => {
        analyzeHosting();
      }, 500);
    }
  }
});

// Render popular providers for quick browse
function renderPopularProviders() {
  const container = document.getElementById('popularProviders');
  if (!container) return;

  // Get providers with translations applied at render time
  const POPULAR_PROVIDERS = getPopularProviders();

  // Filter providers based on current filter
  const filteredProviders = currentFilter === 'all'
    ? POPULAR_PROVIDERS
    : POPULAR_PROVIDERS.filter(p => p.tags && p.tags.includes(currentFilter));

  if (filteredProviders.length === 0) {
    container.innerHTML = `<p style="color: #808080; text-align: center; padding: 2rem;">${t('reports.hosting.noProvidersMatch', 'No providers match this filter. Try another category.')}</p>`;
    return;
  }

  container.innerHTML = filteredProviders.map((provider, index) => `
    <div class="provider-card ${index < 2 && currentFilter === 'all' ? 'top-pick' : ''}" style="animation: fadeIn 0.3s ease ${index * 0.05}s both;">
      ${index === 0 && currentFilter === 'all' ? `<div class="provider-badge">👑 ${t('reports.hosting.badges.topPick', 'TOP PICK')}</div>` : ''}
      ${index === 1 && currentFilter === 'all' ? `<div class="provider-badge" style="background: linear-gradient(135deg, #c0c0c0, #808080);">🥈 ${t('reports.hosting.badges.runnerUp', 'RUNNER UP')}</div>` : ''}

      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
        <div style="font-size: 2.5rem;">${provider.logo}</div>
        <div style="flex: 1;">
          <div style="font-size: 1.25rem; font-weight: bold; color: #ffffff;">${provider.name}</div>
          <div style="font-size: 0.85rem; color: #808080;">${provider.category}</div>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
        <span style="color: #ffd700; font-size: 1rem;">${getRatingStars(provider.rating)}</span>
        <span style="color: #ffffff; font-weight: 600;">${provider.rating}</span>
      </div>

      <div style="background: rgba(0, 217, 255, 0.1); border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #808080; font-size: 0.85rem;">${t('reports.hosting.pricing.startingAt', 'Starting at')}</span>
          <span style="font-size: 1.5rem; font-weight: bold; color: #00d9ff;">${provider.startingPrice === 0 ? `<span style="color: #00ff41;">${t('reports.hosting.pricing.free', 'FREE')}</span>` : `$${provider.startingPrice}/${t('reports.hosting.pricing.mo', 'mo')}`}</span>
        </div>
      </div>

      <div style="margin-bottom: 1rem;">
        ${provider.highlights.slice(0, 2).map(h => `
          <div style="color: #00ff41; font-size: 0.85rem; margin-bottom: 0.25rem;">✅ ${h}</div>
        `).join('')}
      </div>

      <div style="font-size: 0.8rem; color: #808080; margin-bottom: 0.75rem;">
        <strong>${t('reports.hosting.bestForLabel', 'Best for')}:</strong> ${provider.bestFor.join(', ')}
      </div>

      ${provider.url ? `
        <a href="${provider.url}" target="_blank" rel="noopener noreferrer"
           style="display: block; background: linear-gradient(135deg, #00d9ff, #0099cc); color: #000; text-decoration: none; padding: 0.65rem; border-radius: 6px; text-align: center; font-weight: 600; font-size: 0.85rem; transition: all 0.2s ease;"
           class="hosting-provider-link">
          ${t('reports.hosting.visitProvider', 'Visit {{name}}', { name: provider.name })} →
        </a>
      ` : ''}
    </div>
  `).join('');
}

// Get rating stars
function getRatingStars(rating) {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 >= 0.5;
  let stars = '★'.repeat(fullStars);
  if (halfStar) stars += '½';
  stars += '☆'.repeat(5 - Math.ceil(rating));
  return stars;
}

// Main analysis function
async function analyzeHosting() {
  const input = document.getElementById('urlInput').value.trim();
  
  // Get manual input values
  const trafficSelect = document.getElementById('trafficSelect');
  const cmsSelect = document.getElementById('cmsSelect');
  const storageSelect = document.getElementById('storageSelect');
  const prioritySelect = document.getElementById('prioritySelect');
  const regionSelect = document.getElementById('regionSelect');
  const ecommerceSelect = document.getElementById('ecommerceSelect');
  const featuresSelect = document.getElementById('featuresSelect');
  const billingSelect = document.getElementById('billingSelect');
  
  // Get multiple selected features
  const selectedFeatures = featuresSelect 
    ? Array.from(featuresSelect.selectedOptions).map(opt => opt.value)
    : [];
  
  const manualInputs = {
    monthlyVisitors: trafficSelect?.value ? parseInt(trafficSelect.value) : null,
    cms: cmsSelect?.value || null,
    storageNeeds: storageSelect?.value ? parseInt(storageSelect.value) : null,
    priority: prioritySelect?.value || 'balanced',
    region: regionSelect?.value || null,
    ecommerceLevel: ecommerceSelect?.value || 'none',
    requiredFeatures: selectedFeatures,
    billingPreference: billingSelect?.value || 'annual'
  };

  if (!input) {
    showError(t('reports.common.pleaseEnterUrl', 'Please enter a valid website URL or domain name'));
    return;
  }

  // Setup UI
  const resultsDiv = document.getElementById('results');
  const errorMessage = document.getElementById('errorMessage');
  const quickBrowse = document.getElementById('quickBrowse');

  // Clear report metadata from previous scans
  document.body.removeAttribute('data-report-id');
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');

  resultsDiv.classList.add('hidden');
  errorMessage.classList.add('hidden');
  if (quickBrowse) quickBrowse.classList.add('hidden');

  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    resultsDiv.parentNode.insertBefore(loadingContainer, resultsDiv);
  }

  // Initialize the analyzer loader
  const loader = new window.AnalyzerLoaderClass('loadingContainer');

  // Use getAnalysisSteps() to get translated steps at runtime
  loader.start(getAnalysisSteps(), '🏠 ' + t('loader.analyzingHosting', 'HOSTING ANALYZER'), 20);

  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    // Call hosting API with manual inputs
    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const response = await fetch('/api/hosting/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
      },
      body: JSON.stringify({ 
        url: input,
        scanStartedAt,
        ...manualInputs
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = errorData.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        return;
      }
      throw new Error(errorData.message || errorData.error || t('reports.hosting.analysisFailedSimple', 'Hosting analysis failed'));
    }

    const results = await response.json();
    currentResults = results;

    // Set report metadata from API response
    const reportId = results && results.reportId ? String(results.reportId) : '';
    const screenshotUrl = results && results.screenshotUrl ? String(results.screenshotUrl) : '';
    if (reportId) {
      if (window.ReportUI && typeof window.ReportUI.setCurrentReportId === 'function') {
        window.ReportUI.setCurrentReportId(reportId);
      } else {
        document.body.setAttribute('data-report-id', reportId);
      }
    }
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    // Complete the loader
    loader.complete();

    // Show results after animation completes
    setTimeout(() => {
      displayHostingResults(results);
      resultsDiv.classList.remove('hidden');
      window.__REPORT_READY__ = true;
      window.dispatchEvent(new CustomEvent('report:ready'));
    }, 1000);

  } catch (error) {
    console.error('Hosting analysis error:', error);
    loader.showError(t('reports.hosting.analysisFailed', 'Hosting analysis failed: {{message}}', { message: error.message }));
    if (quickBrowse) quickBrowse.classList.remove('hidden');
  }
}

// Display complete hosting results
function displayHostingResults(data) {
  if (!data || typeof data !== 'object' || data.error || typeof data === 'string') { console.error('[Hosting] received invalid data:', data?.error || data); return; }
  const resultsContent = document.getElementById('resultsContent');
  resultsContent.innerHTML = '';

  // Build screenshot URL for report display
  const reportId = document.body.getAttribute('data-report-id') || '';
  const screenshotUrl = data.screenshotUrl || document.body.getAttribute('data-sm-screenshot-url') || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');

  const cms = data.cms;
  const currentHost = data.currentHost;
  const trafficTier = data.trafficTier;
  const trafficIndicators = data.trafficIndicators || [];
  const tierWarning = data.tierWarning;
  const recommendedHosts = data.recommendedHosts || [];
  const allProviders = data.allProviders || [];
  const priceComparison = data.priceComparison;
  const savingsOpportunities = data.savingsOpportunities || [];
  const appliedFilters = data.appliedFilters || {};

  // Get tier color
  const getTierColor = (tierKey) => {
    const colors = {
      enterprise: '#ffd700',
      business: '#00d9ff',
      startup: '#00ff41',
      personal: '#9933ff'
    };
    return colors[tierKey] || '#808080';
  };

  const tierColor = getTierColor(trafficTier?.key);

  // Build applied filters display - Feather Style icons
  const filterLabels = {
    priority: { label: t('reports.hosting.filterLabels.priority', 'Priority'), icon: '⭐' },
    region: { label: t('reports.hosting.filterLabels.region', 'Region'), icon: '🌍' },
    ecommerceLevel: { label: t('reports.hosting.filterLabels.ecommerce', 'E-commerce'), icon: '🛒' },
    requiredFeatures: { label: t('reports.hosting.filterLabels.requiredFeatures', 'Required Features'), icon: '✅' },
    storageNeeds: { label: t('reports.hosting.filterLabels.storage', 'Storage'), icon: '💾' },
    billingPreference: { label: t('reports.hosting.filterLabels.billing', 'Billing'), icon: '💳' }
  };

  const formatFilterValue = (key, value) => {
    if (!value || value === 'none' || value === 'global' || value === 'balanced' || (Array.isArray(value) && value.length === 0)) return null;
    if (key === 'region') {
      const regionMap = {
        us: t('reports.hosting.regions.us', 'United States'),
        eu: t('reports.hosting.regions.eu', 'Europe'),
        uk: t('reports.hosting.regions.uk', 'United Kingdom'),
        asia: t('reports.hosting.regions.asia', 'Asia Pacific'),
        au: t('reports.hosting.regions.au', 'Australia'),
        latam: t('reports.hosting.regions.latam', 'Latin America')
      };
      return regionMap[value] || value;
    }
    if (key === 'ecommerceLevel') {
      const ecomMap = {
        basic: t('reports.hosting.ecomLevels.basic', 'Basic (<100 products)'),
        medium: t('reports.hosting.ecomLevels.medium', 'Medium (100-1K)'),
        large: t('reports.hosting.ecomLevels.large', 'Large (1K+)'),
        enterprise: t('reports.hosting.ecomLevels.enterprise', 'Enterprise')
      };
      return ecomMap[value] || value;
    }
    if (key === 'requiredFeatures' && Array.isArray(value)) {
      const featureMap = {
        ssl: 'SSL',
        cdn: 'CDN',
        backup: t('reports.hosting.features.backups', 'Backups'),
        staging: t('reports.hosting.features.staging', 'Staging'),
        email: t('reports.hosting.features.email', 'Email'),
        migration: t('reports.hosting.features.migration', 'Migration'),
        support247: t('reports.hosting.features.support247', '24/7 Support'),
        uptime99: t('reports.hosting.features.uptime99', '99.9%+ Uptime')
      };
      return value.map(f => featureMap[f] || f).join(', ');
    }
    if (key === 'storageNeeds' && value) {
      return value >= 1000 ? `${value/1000}TB+` : `${value}GB+`;
    }
    if (key === 'billingPreference') {
      const billingMap = {
        annual: t('reports.hosting.billing.annual', 'Annual'),
        monthly: t('reports.hosting.billing.monthly', 'Monthly'),
        'multi-year': t('reports.hosting.billing.multiYear', 'Multi-year')
      };
      return billingMap[value] || value;
    }
    if (key === 'priority') {
      const priorityMap = {
        speed: t('reports.hosting.priorities.speed', 'Speed'),
        budget: t('reports.hosting.priorities.budget', 'Budget'),
        support: t('reports.hosting.priorities.support', 'Support'),
        uptime: t('reports.hosting.priorities.uptime', 'Uptime'),
        scalability: t('reports.hosting.priorities.scalability', 'Scalability'),
        security: t('reports.hosting.priorities.security', 'Security'),
        ecommerce: t('reports.hosting.priorities.ecommerceReady', 'E-commerce Ready')
      };
      return priorityMap[value] || value;
    }
    return value;
  };

  const activeFilters = Object.entries(appliedFilters)
    .map(([key, value]) => {
      const formatted = formatFilterValue(key, value);
      if (!formatted) return null;
      const labelInfo = filterLabels[key] || { label: key, icon: '•' };
      return { key, label: labelInfo.label, icon: labelInfo.icon, value: formatted };
    })
    .filter(Boolean);

  // Screenshot Section
  const screenshotHTML = screenshotUrl ? `
    <div class="screenshot-section" style="margin-bottom: 1.5rem;">
      <h3 style="color: var(--text-primary, #fff); font-size: 1rem; margin: 0 0 0.75rem 0; font-weight: 600;">
        ${t('reports.common.pageScreenshot', 'Page Screenshot')}
      </h3>
      <div class="screenshot-item" style="background: var(--bg-secondary, #1a1a1a); border: 1px solid var(--border-color, #333); border-radius: 8px; overflow: hidden;">
        <img
          src="${screenshotUrl}"
          alt="${t('reports.common.screenshotOf', 'Screenshot of {{url}}', { url: data.hostname || data.url || '' })}"
          class="screenshot-item__img"
          style="width: 100%; max-height: 300px; object-fit: cover; object-position: top; cursor: pointer; display: block;"
          data-action="open-lightbox"
          data-screenshot-url="${screenshotUrl}"
          data-screenshot-title="${t('reports.common.pageScreenshot', 'Page Screenshot')}"
          onerror="this.parentElement.innerHTML='<div style=\\'padding: 2rem; text-align: center; color: var(--text-muted, #666);\\'>${t('reports.common.screenshotUnavailable', 'Screenshot unavailable')}</div>'"
        />
      </div>
    </div>
  ` : '';

  // Summary Section with Traffic Tier
  let html = `
    ${screenshotHTML}
    <div class="section" style="margin-bottom: 2rem;">
      <h2 style="color: #00ff41; margin-bottom: 1.5rem;">📊 ${t('reports.hosting.analysisResults', 'Hosting Analysis Results')}</h2>

      <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">
          <span style="color: #00ff41;">${t('reports.common.analyzed', 'Analyzed')}:</span>
          <span style="color: #ffffff;">${data.hostname || data.url || 'N/A'}</span>
          <span style="color: #00ff41;">${t('reports.common.timestamp', 'Timestamp')}:</span>
          <span style="color: #ffffff;">${window.i18n?.formatDateTime ? window.i18n.formatDateTime(new Date()) : new Date().toLocaleString()}</span>
        </div>
      </div>

      ${activeFilters.length > 0 ? `
        <div style="background: rgba(153, 51, 255, 0.08); border: 1px solid rgba(153, 51, 255, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
            <span style="font-size: 1.1rem;">🔧</span>
            <span style="color: #bb77ff; font-weight: 600; font-size: 0.9rem;">${t('reports.hosting.appliedFilters', 'Applied Filters')}</span>
          </div>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${activeFilters.map(filter => `
              <div style="background: rgba(153, 51, 255, 0.15); border: 1px solid rgba(153, 51, 255, 0.4); padding: 0.4rem 0.75rem; border-radius: 6px; display: flex; align-items: center; gap: 0.4rem;">
                <span style="font-size: 0.85rem;">${filter.icon}</span>
                <span style="color: #808080; font-size: 0.8rem;">${filter.label}:</span>
                <span style="color: #bb77ff; font-size: 0.85rem; font-weight: 500;">${filter.value}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Traffic Tier Detection Card - NEW -->
      ${trafficTier ? `
        <div style="background: linear-gradient(135deg, ${tierColor}15 0%, ${tierColor}08 100%); border: 2px solid ${tierColor}60; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="font-size: 3rem;">${trafficTier.icon || '◈'}</div>
              <div>
                <div style="font-size: 0.85rem; color: #808080;">${t('reports.hosting.estimatedWebsiteTier', 'Estimated Website Tier')}</div>
                <div style="font-size: 1.75rem; font-weight: bold; color: ${tierColor};">${trafficTier.name}</div>
                <div style="font-size: 0.9rem; color: #808080; margin-top: 0.25rem;">${trafficTier.description}</div>
              </div>
            </div>
            <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem 1.5rem; border-radius: 8px; text-align: center;">
              <div style="font-size: 0.75rem; color: #808080;">${t('reports.hosting.confidence', 'Confidence')}</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: ${tierColor};">${data.tierConfidence || 70}%</div>
            </div>
          </div>

          ${trafficIndicators.length > 0 ? `
            <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid ${tierColor}30;">
              <div style="font-size: 0.8rem; color: #808080; margin-bottom: 0.75rem;">${t('reports.hosting.detectionSignals', 'Detection Signals')}:</div>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${trafficIndicators.slice(0, 6).map(ind => `
                  <div style="background: rgba(0, 0, 0, 0.3); padding: 0.4rem 0.75rem; border-radius: 6px; display: flex; align-items: center; gap: 0.4rem;">
                    <span>${ind.icon || '•'}</span>
                    <span style="color: #ffffff; font-size: 0.85rem;">${ind.signal}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          
          <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">
            <div style="font-size: 0.8rem; color: #808080;">
              <strong>${t('reports.hosting.recommendedBudget', 'Recommended hosting budget')}:</strong>
              <span style="color: ${tierColor}; font-weight: 600;">$${trafficTier.minMonthly || 0}+/${t('reports.hosting.pricing.month', 'month')}</span>
              ${trafficTier.characteristics ? ` • ${t('reports.hosting.typicalFor', 'Typical for')}: ${trafficTier.characteristics.slice(0, 2).join(', ')}` : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Tier Warning if applicable -->
      ${tierWarning ? `
        <div style="background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.4); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
            <span style="font-size: 1.25rem;">◉</span>
            <div>
              <div style="color: #ffa500; font-weight: 600; margin-bottom: 0.25rem;">${t('reports.hosting.trafficAppropriateRecommendations', 'Traffic-Appropriate Recommendations')}</div>
              <div style="color: #808080; font-size: 0.9rem;">${tierWarning.message}</div>
              ${tierWarning.hiddenCount ? `<div style="color: #808080; font-size: 0.8rem; margin-top: 0.5rem;">(${tierWarning.hiddenCount} budget options hidden as inadequate for this tier)</div>` : ''}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- CMS and Host Detection Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Detected CMS -->
        <div class="cms-detection-card">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
            <div style="font-size: 3rem;">${cms?.icon || '🔍'}</div>
            <div>
              <div style="font-size: 0.85rem; color: #808080;">${t('reports.hosting.detectedCms', 'Detected CMS')}</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;">${cms?.name || t('reports.hosting.unknownCustom', 'Unknown / Custom')}</div>
            </div>
          </div>
          ${cms ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
              <div style="background: rgba(0, 0, 0, 0.3); padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; color: #808080;">${t('reports.hosting.marketShare', 'Market Share')}</div>
                <div style="font-size: 1.25rem; font-weight: bold; color: #00d9ff;">${cms.marketShare || 'N/A'}</div>
              </div>
              <div style="background: rgba(0, 0, 0, 0.3); padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; color: #808080;">${t('reports.hosting.confidence', 'Confidence')}</div>
                <div style="font-size: 1.25rem; font-weight: bold; color: #9933ff;">${cms.confidence || 0}%</div>
              </div>
            </div>
            ${cms.matchedPatterns?.length > 0 ? `
              <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 6px;">
                <div style="font-size: 0.75rem; color: #808080; margin-bottom: 0.5rem;">${t('reports.hosting.detectionSignals', 'Detection Signals')}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                  ${cms.matchedPatterns.slice(0, 5).map(p => `
                    <span style="background: rgba(153, 51, 255, 0.2); color: #9933ff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-family: monospace;">${p}</span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          ` : `
            <div style="color: #808080; font-size: 0.9rem; margin-top: 0.5rem;">
              ${t('reports.hosting.noCmsDetected', 'Could not detect a known CMS. This site may be using a custom-built platform or a CMS not in our database.')}
            </div>
          `}
        </div>

        <!-- Current Host Detection -->
        <div class="current-host-card">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
            <div style="font-size: 3rem;">${currentHost ? '🏢' : '❓'}</div>
            <div>
              <div style="font-size: 0.85rem; color: #808080;">${t('reports.hosting.currentHost', 'Current Host')}</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;">${currentHost?.name || t('reports.hosting.notDetected', 'Not Detected')}</div>
            </div>
          </div>
          ${currentHost ? `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
              <div style="background: rgba(0, 0, 0, 0.3); padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; color: #808080;">${t('reports.hosting.category', 'Category')}</div>
                <div style="font-size: 1rem; font-weight: 600; color: #00ff41;">${currentHost.category}</div>
              </div>
              <div style="background: rgba(0, 0, 0, 0.3); padding: 0.75rem; border-radius: 6px;">
                <div style="font-size: 0.75rem; color: #808080;">${t('reports.hosting.detectedVia', 'Detected Via')}</div>
                <div style="font-size: 1rem; font-weight: 600; color: #00d9ff;">${currentHost.detectedVia}</div>
              </div>
            </div>
          ` : `
            <div style="color: #808080; font-size: 0.9rem; margin-top: 0.5rem;">
              ${t('reports.hosting.noHostDetected', 'Unable to determine current hosting provider from DNS records. The site may be behind a CDN or using custom infrastructure.')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;

  // Price Comparison Summary - Updated to show tier-appropriate pricing
  if (priceComparison) {
    const tierMinLabel = priceComparison.tierMinimum > 0 ? `(${priceComparison.tierName} ${t('reports.hosting.tierMinimum', 'tier minimum')}: $${priceComparison.tierMinimum}/${t('reports.hosting.pricing.mo', 'mo')})` : '';
    html += `
      <div class="section" style="background: rgba(255, 165, 0, 0.08); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
        <h3 style="color: #ffa500; margin: 0 0 0.5rem 0;">💰 ${t('reports.hosting.pricingOverview', 'Pricing Overview')} ${cms ? t('reports.hosting.forHosting', 'for {{name}} Hosting', { name: cms.name }) : ''}</h3>
        ${tierMinLabel ? `<div style="font-size: 0.85rem; color: #808080; margin-bottom: 1rem;">${tierMinLabel}</div>` : ''}
        <div class="price-stats">
          <div class="price-stat-card">
            <div style="font-size: 0.8rem; color: #808080;">${priceComparison.tierMinimum > 0 ? t('reports.hosting.tierMinimumLabel', 'Tier Minimum') : t('reports.hosting.lowestPrice', 'Lowest Price')}</div>
            <div style="font-size: 1.75rem; font-weight: bold; color: #00ff41;">$${priceComparison.lowestPrice}</div>
            <div style="font-size: 0.75rem; color: #808080;">/${t('reports.hosting.pricing.month', 'month')}</div>
          </div>
          <div class="price-stat-card">
            <div style="font-size: 0.8rem; color: #808080;">${t('reports.hosting.averagePrice', 'Average Price')}</div>
            <div style="font-size: 1.75rem; font-weight: bold; color: #ffa500;">$${priceComparison.averagePrice}</div>
            <div style="font-size: 0.75rem; color: #808080;">/${t('reports.hosting.pricing.month', 'month')}</div>
          </div>
          <div class="price-stat-card">
            <div style="font-size: 0.8rem; color: #808080;">${t('reports.hosting.premiumPrice', 'Premium Price')}</div>
            <div style="font-size: 1.75rem; font-weight: bold; color: #9933ff;">$${priceComparison.highestPrice}</div>
            <div style="font-size: 0.75rem; color: #808080;">/${t('reports.hosting.pricing.month', 'month')}</div>
          </div>
          <div class="price-stat-card">
            <div style="font-size: 0.8rem; color: #808080;">${t('reports.hosting.budgetOptions', 'Budget Options')}</div>
            <div style="font-size: 1.75rem; font-weight: bold; color: #00d9ff;">${priceComparison.budgetOptions}</div>
            <div style="font-size: 0.75rem; color: #808080;">${t('reports.hosting.under5mo', 'under $5/mo')}</div>
          </div>
        </div>
      </div>
    `;
  }

  // Savings Opportunities
  if (savingsOpportunities.length > 0) {
    html += `
      <div class="savings-card" style="margin-bottom: 2rem;">
        <h3 style="color: #00ff41; margin: 0 0 1rem 0;">💸 ${t('reports.hosting.potentialSavings', 'Potential Savings Opportunities')}</h3>
        <p style="color: #808080; font-size: 0.9rem; margin-bottom: 1rem;">${t('reports.hosting.savingsDescription', 'Based on your current hosting, here are alternatives that could save you money')}:</p>
        <div style="display: grid; gap: 1rem;">
          ${savingsOpportunities.map(opp => `
            <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="font-weight: 600; color: #ffffff;">${opp.provider}</div>
                <div style="font-size: 0.85rem; color: #808080;">${opp.category} • ★ ${opp.rating}</div>
              </div>
              <div style="text-align: center;">
                <div style="font-size: 0.75rem; color: #808080;">${t('reports.hosting.currentToNew', 'Current → New')}</div>
                <div style="font-size: 1rem;">
                  <span style="color: #ff4444; text-decoration: line-through;">$${opp.currentPrice}</span>
                  <span style="color: #808080;"> → </span>
                  <span style="color: #00ff41; font-weight: bold;">$${opp.newPrice}</span>
                </div>
              </div>
              <div style="background: rgba(0, 255, 65, 0.2); padding: 0.5rem 1rem; border-radius: 6px; text-align: center;">
                <div style="font-size: 1.25rem; font-weight: bold; color: #00ff41;">-${opp.savingsPercent}%</div>
                <div style="font-size: 0.75rem; color: #00ff41;">$${opp.annualSavings}/${t('reports.hosting.pricing.year', 'year')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Recommended Hosts
  if (recommendedHosts.length > 0) {
    html += `
      <div class="section" style="margin-bottom: 2rem;">
        <h3 style="color: #ffffff; margin: 0 0 1rem 0;">🏆 ${t('reports.hosting.topRecommendedHosts', 'Top Recommended Hosts')} ${cms ? t('reports.hosting.forPlatform', 'for {{name}}', { name: cms.name }) : ''}</h3>
        <div class="providers-grid">
          ${recommendedHosts.slice(0, 6).map((host, index) => `
            <div class="provider-card ${index === 0 ? 'top-pick' : ''}">
              ${index === 0 ? `<div class="provider-badge">◆ ${t('reports.hosting.badges.topPick', 'TOP PICK')}</div>` : ''}
              ${index === 1 ? `<div class="provider-badge" style="background: linear-gradient(135deg, #c0c0c0, #808080);">${t('reports.hosting.badges.runnerUp', 'RUNNER UP')}</div>` : ''}

              <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                <div style="font-size: 2rem;">${getCategoryIcon(host.category)}</div>
                <div style="flex: 1;">
                  <div style="font-size: 1.25rem; font-weight: bold; color: #ffffff;">${host.name}</div>
                  <div style="font-size: 0.85rem; color: #808080;">${host.category}</div>
                </div>
                ${host.matchScore ? `
                  <div style="background: rgba(0, 255, 65, 0.15); border: 1px solid rgba(0, 255, 65, 0.3); padding: 0.4rem 0.6rem; border-radius: 6px;">
                    <div style="font-size: 0.7rem; color: #808080; text-align: center;">${t('reports.hosting.match', 'Match')}</div>
                    <div style="font-size: 1rem; font-weight: bold; color: #00ff41;">${Math.round(host.matchScore)}%</div>
                  </div>
                ` : ''}
              </div>

              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                <span style="color: #ffd700; font-size: 1rem;">${getRatingStars(host.rating)}</span>
                <span style="color: #ffffff; font-weight: 600;">${host.rating}</span>
                <span style="color: #808080; font-size: 0.85rem;">• ${host.uptime} ${t('reports.hosting.uptime', 'uptime')}</span>
              </div>

              ${host.matchReasons && host.matchReasons.length > 0 ? `
                <div style="background: rgba(153, 51, 255, 0.1); border: 1px solid rgba(153, 51, 255, 0.3); border-radius: 6px; padding: 0.6rem; margin-bottom: 1rem;">
                  <div style="font-size: 0.7rem; color: #808080; margin-bottom: 0.4rem;">${t('reports.hosting.whyThisProvider', 'Why this provider')}:</div>
                  <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                    ${host.matchReasons.slice(0, 3).map(reason => `
                      <span style="background: rgba(153, 51, 255, 0.2); color: #bb77ff; padding: 0.15rem 0.4rem; border-radius: 4px; font-size: 0.7rem;">▸ ${reason}</span>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

              <div style="background: rgba(0, 217, 255, 0.1); border: 1px solid rgba(0, 217, 255, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="color: #808080; font-size: 0.85rem;">${t('reports.hosting.pricing.startingAt', 'Starting at')}</span>
                  <span style="font-size: 1.5rem; font-weight: bold; color: #00d9ff;">${formatPrice(host.cheapestPlan?.price)}</span>
                </div>
                <div style="font-size: 0.8rem; color: #808080;">
                  ${host.cheapestPlan?.name}: ${host.cheapestPlan?.storage} ${t('reports.hosting.storage', 'storage')}
                </div>
              </div>

              ${host.featuresBadges && host.featuresBadges.length > 0 ? `
                <div style="margin-bottom: 0.75rem;">
                  <div style="display: flex; flex-wrap: wrap; gap: 0.3rem;">
                    ${host.featuresBadges.filter(b => b.included).slice(0, 6).map(badge => `
                      <span style="background: ${badge.required ? 'rgba(0, 255, 65, 0.2)' : 'rgba(0, 217, 255, 0.1)'}; color: ${badge.required ? '#00ff41' : '#00d9ff'}; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.65rem; border: 1px solid ${badge.required ? 'rgba(0, 255, 65, 0.3)' : 'transparent'};">
                        ${badge.required ? '▸ ' : ''}${badge.label}
                      </span>
                    `).join('')}
                  </div>
                </div>
              ` : `
                <div style="margin-bottom: 1rem;">
                  <div style="display: flex; flex-wrap: wrap; gap: 0.4rem;">
                    ${(host.cheapestPlan?.features || []).slice(0, 3).map(feature => `
                      <span style="background: rgba(0, 255, 65, 0.1); color: #00ff41; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">▸ ${feature}</span>
                    `).join('')}
                  </div>
                </div>
              `}

              <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap;">
                ${host.migrationDifficulty ? `
                  <span style="background: ${host.migrationDifficulty === 'easy' ? 'rgba(0, 255, 65, 0.1)' : host.migrationDifficulty === 'medium' ? 'rgba(255, 165, 0, 0.1)' : 'rgba(255, 68, 68, 0.1)'}; color: ${host.migrationDifficulty === 'easy' ? '#00ff41' : host.migrationDifficulty === 'medium' ? '#ffa500' : '#ff4444'}; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.65rem;">
                    ▹ ${host.migrationDifficulty === 'easy' ? t('reports.hosting.migration.easy', 'Easy Migration') : host.migrationDifficulty === 'medium' ? t('reports.hosting.migration.moderate', 'Moderate Migration') : t('reports.hosting.migration.complex', 'Complex Migration')}
                  </span>
                ` : ''}
                ${host.availableRegions && host.availableRegions.length > 0 ? `
                  <span style="background: rgba(0, 217, 255, 0.1); color: #00d9ff; padding: 0.2rem 0.4rem; border-radius: 4px; font-size: 0.65rem;">
                    ○ ${host.availableRegions.length} ${host.availableRegions.length > 1 ? t('reports.hosting.regions.plural', 'regions') : t('reports.hosting.regions.singular', 'region')}
                  </span>
                ` : ''}
              </div>

              ${host.highlights?.length > 0 ? `
                <div style="font-size: 0.75rem; color: #9933ff; margin-bottom: 0.75rem;">${host.highlights.slice(0, 2).join(' • ')}</div>
              ` : ''}
              
              ${host.url ? `
                <a href="${host.url}" target="_blank" rel="noopener noreferrer"
                   style="display: block; background: linear-gradient(135deg, #00d9ff, #0099cc); color: #000; text-decoration: none; padding: 0.75rem; border-radius: 6px; text-align: center; font-weight: 600; font-size: 0.9rem; transition: all 0.2s ease;"
                   class="hosting-provider-link">
                  ${t('reports.hosting.visitProvider', 'Visit {{name}}', { name: host.name })} →
                </a>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // All Providers Comparison Table
  if (allProviders.length > 0) {
    html += `
      <div class="section">
        <h3 style="color: #ffffff; margin: 0 0 1rem 0;">📝 ${t('reports.hosting.completeProviderComparison', 'Complete Provider Comparison')} (${allProviders.length} ${t('reports.hosting.matchingProviders', 'matching providers')})</h3>
        <div style="overflow-x: auto; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
          <table class="comparison-table">
            <thead>
              <tr>
                <th>${t('reports.hosting.table.provider', 'Provider')}</th>
                <th>${t('reports.hosting.table.category', 'Category')}</th>
                <th style="text-align: center;">${t('reports.hosting.table.match', 'Match')}</th>
                <th style="text-align: center;">${t('reports.hosting.table.rating', 'Rating')}</th>
                <th style="text-align: center;">${t('reports.hosting.table.uptime', 'Uptime')}</th>
                <th style="text-align: center;">${t('reports.hosting.table.priceRange', 'Price Range')}</th>
                <th style="text-align: center;">${t('reports.hosting.table.migration', 'Migration')}</th>
                <th style="text-align: center;">${t('reports.hosting.table.link', 'Link')}</th>
              </tr>
            </thead>
            <tbody>
              ${allProviders.slice(0, 20).map(provider => `
                <tr>
                  <td>
                    <div style="font-weight: 600; color: #ffffff;">${provider.name}</div>
                    <div style="font-size: 0.75rem; color: #808080;">${provider.highlights?.[0] || ''}</div>
                  </td>
                  <td>
                    <span style="background: rgba(153, 51, 255, 0.2); color: #9933ff; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${provider.category}</span>
                  </td>
                  <td style="text-align: center;">
                    ${provider.matchScore ? `
                      <span style="background: rgba(0, 255, 65, 0.15); color: #00ff41; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${Math.round(provider.matchScore)}%</span>
                    ` : '<span style="color: #555;">-</span>'}
                  </td>
                  <td style="text-align: center;">
                    <span style="color: #ffd700;">★ ${provider.rating}</span>
                  </td>
                  <td style="text-align: center; color: #00ff41; font-size: 0.9rem;">${provider.uptime}</td>
                  <td style="text-align: center;">
                    <span style="color: #00d9ff; font-weight: 600;">${provider.priceRange}</span>
                  </td>
                  <td style="text-align: center;">
                    ${provider.migrationDifficulty ? `
                      <span style="background: ${provider.migrationDifficulty === 'easy' ? 'rgba(0, 255, 65, 0.15)' : provider.migrationDifficulty === 'medium' ? 'rgba(255, 165, 0, 0.15)' : 'rgba(255, 68, 68, 0.15)'}; color: ${provider.migrationDifficulty === 'easy' ? '#00ff41' : provider.migrationDifficulty === 'medium' ? '#ffa500' : '#ff4444'}; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">
                        ${provider.migrationDifficulty === 'easy' ? `▸ ${t('reports.hosting.migrationTable.easy', 'Easy')}` : provider.migrationDifficulty === 'medium' ? `○ ${t('reports.hosting.migrationTable.medium', 'Medium')}` : `◉ ${t('reports.hosting.migrationTable.hard', 'Hard')}`}
                      </span>
                    ` : '<span style="color: #555;">-</span>'}
                  </td>
                  <td style="text-align: center;">
                    ${provider.url ? `
                      <a href="${provider.url}" target="_blank" rel="noopener noreferrer"
                         style="display: inline-block; background: rgba(0, 217, 255, 0.2); color: #00d9ff; text-decoration: none; padding: 0.4rem 0.75rem; border-radius: 4px; font-size: 0.8rem; font-weight: 500; border: 1px solid rgba(0, 217, 255, 0.4); transition: all 0.2s ease;"
                         class="hosting-table-link">
                        ${t('reports.hosting.visit', 'Visit')} →
                      </a>
                    ` : '<span style="color: #555;">-</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; font-size: 0.85rem; color: #808080;">
          <strong>◎ ${t('reports.hosting.proTip', 'Pro Tip')}:</strong> ${t('reports.hosting.proTipText', 'Prices shown are starting prices with annual billing. Monthly billing is typically 20-30% higher. Match % indicates how well the provider fits your requirements. Consider your traffic needs, support requirements, and scaling plans when choosing a host.')}
        </div>
      </div>
    `;
  }

  resultsContent.innerHTML = html;

  // Add click handler for screenshot lightbox
  if (screenshotUrl) {
    const screenshotImg = resultsContent.querySelector('[data-action="open-lightbox"]');
    if (screenshotImg) {
      screenshotImg.addEventListener('click', () => {
        if (window.ScreenshotLightbox && typeof window.ScreenshotLightbox.open === 'function') {
          window.ScreenshotLightbox.open(screenshotUrl, t('reports.common.pageScreenshot', 'Page Screenshot'));
        }
      });
    }
  }

  // Pro Report Block
  if (window.ProReportBlock && window.ProReportBlock.render) {
    const proBlockHtml = window.ProReportBlock.render({
      context: 'hosting-analysis',
      features: ['pdf', 'excel', 'csv', 'share'],
      title: t('reports.common.unlockReport', 'Unlock Report'),
      subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.')
    });
    resultsContent.insertAdjacentHTML('beforeend', proBlockHtml);
  } else {
    const opts = { context: 'hosting-analysis', features: ['pdf', 'excel', 'csv', 'share'], title: 'Unlock Report', subtitle: 'PDF export, share link, export data, and fix packs for this scan.' };
    const safe = JSON.stringify(opts).replace(/</g, '\\u003c').replace(/"/g, '&quot;');
    resultsContent.insertAdjacentHTML('beforeend', '<div class="pro-report-block" data-pro-block-pending data-pro-block-options="' + safe + '"></div>');
  }
}

// Get category icon - Classic Emoji Style
function getCategoryIcon(category) {
  const icons = {
    'Managed WordPress': '🚀',
    'Cloud VPS': '☁️',
    'JAMstack/Edge': '⚡',
    'Shared Hosting': '🏠',
    'E-commerce Platform': '🛒',
    'Website Builder': '🎨',
    'Managed Cloud': '☁️',
    'Cloud Provider': '🌐',
    'Managed CMS': '📝',
    'Managed WordPress/Drupal': '🚀',
  };
  return icons[category] || '🌐';
}

// Format price
function formatPrice(price) {
  if (price === 0) return `<span style="color: #00ff41;">${t('reports.hosting.pricing.free', 'FREE')}</span>`;
  if (typeof price === 'string') return price;
  if (typeof price !== 'number') return 'N/A';
  return `$${price}/${t('reports.hosting.pricing.mo', 'mo')}`;
}

function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

/**
 * Initialize PDF Export for Hosting Analyzer
 */
function initHostingPDFExport() {
  if (typeof initPDFExport === 'function') {
    initPDFExport({
      contentSelector: '#results, #resultsContent, .results-container',
      buttonSelector: '#exportPdfBtn, .export-pdf-btn, #downloadPdfButton',
      reportSubtitle: t('reports.hosting.pdfSubtitle', 'Hosting Performance & Infrastructure Analysis'),
      urlInputSelector: '#urlInput, input[type="url"], input[type="text"]',
      filename: `hosting-analysis-${new Date().toISOString().split('T')[0]}.pdf`
    });
  } else {
  }
}

// Initialize PDF export when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHostingPDFExport);
} else {
  initHostingPDFExport();
}
