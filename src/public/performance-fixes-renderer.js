/**
 * Performance Fixes Renderer - Option 3: Tabbed Accordion
 * Generates detailed, actionable performance fixes with code examples
 */

function renderFixesToMake(desktop, mobile) {
  const fixes = generateFixesData(desktop, mobile);

  if (fixes.length === 0) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">🎉</span> Excellent! No Critical Fixes Needed
        </h3>
        <p style="color: #86efac; margin: 0;">Your site is performing well across all metrics. Continue monitoring and consider A/B testing for further optimizations.</p>
      </div>
    `;
  }

  // Group by severity
  const critical = fixes.filter(f => f.severity === 'critical');
  const medium = fixes.filter(f => f.severity === 'medium');
  const low = fixes.filter(f => f.severity === 'low');

  let html = `
    <div style="margin-top: 2rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🎯</span> Performance Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixes.length} issues found)</span>
      </h3>
      <div class="fixes-container">
  `;

  // Render critical fixes
  if (critical.length > 0) {
    html += `<div class="severity-group" style="margin-bottom: 1.5rem;">`;
    critical.forEach((fix, index) => {
      html += renderFixAccordion(fix, index);
    });
    html += `</div>`;
  }

  // Render medium priority fixes
  if (medium.length > 0) {
    html += `<div class="severity-group" style="margin-bottom: 1.5rem;">`;
    medium.forEach((fix, index) => {
      html += renderFixAccordion(fix, critical.length + index);
    });
    html += `</div>`;
  }

  // Render low priority fixes
  if (low.length > 0) {
    html += `<div class="severity-group">`;
    low.forEach((fix, index) => {
      html += renderFixAccordion(fix, critical.length + medium.length + index);
    });
    html += `</div>`;
  }

  html += `</div></div>`;

  return html;
}

function normalizeMetric(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    if (trimmed.endsWith('ms')) {
      const n = parseFloat(trimmed.replace('ms', ''));
      return Number.isNaN(n) ? null : n;
    }
    if (trimmed.endsWith('s')) {
      const n = parseFloat(trimmed.replace('s', ''));
      return Number.isNaN(n) ? null : n * 1000;
    }
    const n = parseFloat(trimmed);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function pickMetric(candidates = []) {
  for (const c of candidates) {
    const n = normalizeMetric(c);
    if (n !== null) return n;
  }
  return null;
}

function normalizeRecommendations(desktop = {}, mobile = {}) {
  const list = [];
  const desktopRecs = Array.isArray(desktop.recommendations) ? desktop.recommendations : [];
  const mobileRecs = Array.isArray(mobile.recommendations) ? mobile.recommendations : [];
  [...desktopRecs, ...mobileRecs].forEach(rec => {
    if (!rec) return;
    const title = rec.title || rec.name || rec.recommendation;
    if (!title) return;
    list.push({
      title,
      description: rec.description || rec.details || rec.summary || '',
      impact: rec.impact || rec.estimatedSavings || '',
      priority: rec.priority || rec.severity || 'medium',
      category: rec.category || rec.group || 'performance'
    });
  });

  const seen = new Set();
  return list.filter(item => {
    const key = `${item.category}:${item.title}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeOpportunities(desktop = {}, mobile = {}) {
  const desktopOpp = Array.isArray(desktop.opportunities) ? desktop.opportunities : [];
  const mobileOpp = Array.isArray(mobile.opportunities) ? mobile.opportunities : [];
  const all = [...desktopOpp, ...mobileOpp];
  return all.filter(Boolean).map(op => ({
    id: op.id || op.auditId || op.title || '',
    title: op.title || op.name || 'Opportunity',
    description: op.description || op.summary || '',
    displayValue: op.displayValue || op.display || '',
    details: op.details || {},
    score: op.score,
    numericValue: op.numericValue,
    raw: op
  }));
}

function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n)) return null;
  if (n < 1024) return `${Math.round(n)} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)} ms`;
}

function extractOpportunityEvidence(op) {
  const items = Array.isArray(op?.details?.items) ? op.details.items : [];
  const urls = new Set();
  const snippets = new Set();
  const sources = [];
  let wastedBytes = null;
  let wastedMs = null;

  items.forEach(item => {
    if (item.url) urls.add(item.url);
    if (item.request?.url) urls.add(item.request.url);
    if (item.source?.location?.url) urls.add(item.source.location.url);
    if (item.node?.snippet) snippets.add(item.node.snippet);
    if (item.selector) snippets.add(item.selector);
    if (item.source?.location) sources.push(item.source.location);
    if (Number.isFinite(item.wastedBytes)) wastedBytes = Math.max(wastedBytes || 0, item.wastedBytes);
    if (Number.isFinite(item.wastedMs)) wastedMs = Math.max(wastedMs || 0, item.wastedMs);
  });

  return {
    title: op.title,
    displayValue: op.displayValue,
    urls: Array.from(urls).slice(0, 6),
    snippets: Array.from(snippets).slice(0, 3),
    sources: sources.slice(0, 3),
    wastedBytes,
    wastedMs
  };
}

const OPPORTUNITY_MATCHERS = {
  'vitals-lcp': ['largest-contentful-paint', 'lcp', 'preload', 'critical-request-chains'],
  'vitals-cls': ['layout-shift', 'cls', 'cumulative-layout-shift'],
  'javascript': ['javascript', 'unused-javascript', 'unminified-javascript', 'render-blocking', 'third-party'],
  'images': ['image', 'images', 'optimized-images', 'webp', 'responsive-images', 'offscreen-images', 'efficient-animated-content'],
  'css': ['css', 'unused-css', 'unminified-css', 'render-blocking'],
  'caching': ['cache', 'cache-ttl', 'uses-long-cache-ttl'],
  'compression': ['compression', 'uses-text-compression', 'gzip', 'brotli'],
  'network': ['network', 'requests', 'server-response-time', 'total-byte-weight'],
  'accessibility': ['accessibility', 'aria', 'contrast', 'label']
};

function findEvidenceForCategory(opps, categoryKey) {
  const needles = OPPORTUNITY_MATCHERS[categoryKey] || [];
  if (!needles.length) return null;
  const match = opps.find(op => {
    const hay = `${op.id} ${op.title} ${op.description}`.toLowerCase();
    return needles.some(n => hay.includes(n));
  });
  return match ? extractOpportunityEvidence(match) : null;
}

function buildProblematicEvidenceBlock(fix, evidence, fallback) {
  if (!evidence) return fallback;
  const lines = [];
  lines.push(`/* Lighthouse evidence: ${evidence.title} */`);
  if (evidence.displayValue) lines.push(`/* ${evidence.displayValue} */`);
  const bytes = formatBytes(evidence.wastedBytes);
  const time = formatMs(evidence.wastedMs);
  if (bytes) lines.push(`/* Wasted bytes: ${bytes} */`);
  if (time) lines.push(`/* Wasted time: ${time} */`);
  if (evidence.urls.length) {
    lines.push('Affected URLs:');
    evidence.urls.forEach(url => lines.push(`- ${url}`));
  }
  if (evidence.snippets.length) {
    lines.push('HTML Snippets:');
    evidence.snippets.forEach(snippet => lines.push(snippet));
  }
  return `${lines.join('\n')}

${fallback}`;
}

function toSeverity(priority = '') {
  const p = String(priority).toLowerCase();
  if (p === 'high' || p === 'critical') return 'critical';
  if (p === 'medium') return 'medium';
  return 'low';
}

function buildRecommendationTemplate(rec = {}) {
  const title = String(rec.title || '').toLowerCase();
  const category = String(rec.category || '').toLowerCase();

  if (title.includes('lcp') || category.includes('vital')) {
    return {
      id: 'rec-lcp',
      categoryKey: 'vitals-lcp',
      icon: '🔴',
      categoryLabel: 'Core Web Vitals',
      problematicCode: `<!-- LCP element not optimized -->
<img src="/images/hero.jpg" class="hero" alt="Hero">
<!-- ✗ Large asset, not preloaded -->`,
      fixedCode: `<!-- Preload and serve responsive LCP image -->
<link rel="preload" as="image" href="/images/hero-800.webp" fetchpriority="high">
<img src="/images/hero-800.webp"
     srcset="/images/hero-400.webp 400w, /images/hero-800.webp 800w"
     sizes="(max-width: 768px) 100vw, 800px"
     width="1920" height="1080" loading="eager" fetchpriority="high" alt="Hero">`,
      steps: [
        'Identify the LCP element in DevTools → Performance',
        'Preload the LCP resource and serve responsive formats (WebP/AVIF)',
        'Add explicit dimensions to prevent layout shifts'
      ]
    };
  }

  if (title.includes('cls') || category.includes('layout')) {
    return {
      id: 'rec-cls',
      categoryKey: 'vitals-cls',
      icon: '🟡',
      categoryLabel: 'Core Web Vitals',
      problematicCode: `<!-- Missing dimensions cause layout shifts -->
<img src="/images/product.jpg" alt="Product">
<div id="ad-slot"></div>`,
      fixedCode: `<!-- Reserve space to prevent CLS -->
<img src="/images/product.jpg" alt="Product" width="800" height="600">
<div id="ad-slot" style="min-height: 250px;"></div>`,
      steps: [
        'Add width/height (or aspect-ratio) to images and embeds',
        'Reserve space for ads and dynamic widgets',
        'Use font-display: swap for web fonts'
      ]
    };
  }

  if (category.includes('javascript') || title.includes('javascript') || title.includes('js')) {
    return {
      id: 'rec-js',
      categoryKey: 'javascript',
      icon: '🟡',
      categoryLabel: 'Performance',
      problematicCode: `<!-- Render-blocking scripts -->
<script src="/js/vendor.bundle.js"></script>
<script src="/js/app.js"></script>`,
      fixedCode: `<!-- Defer non-critical scripts -->
<script src="/js/vendor.bundle.js" defer></script>
<script src="/js/app.js" defer></script>`,
      steps: [
        'Defer or async non-critical scripts',
        'Split bundles and remove unused dependencies',
        'Use code-splitting for heavy modules'
      ]
    };
  }

  if (category.includes('images') || title.includes('image')) {
    return {
      id: 'rec-images',
      categoryKey: 'images',
      icon: '🟡',
      categoryLabel: 'Performance',
      problematicCode: `<!-- Large unoptimized images -->
<img src="/photos/team.jpg" alt="Team">`,
      fixedCode: `<!-- Responsive images with WebP -->
<picture>
  <source srcset="/photos/team-400.webp 400w, /photos/team-800.webp 800w" type="image/webp">
  <img src="/photos/team-800.jpg" width="800" height="600" loading="lazy" alt="Team">
</picture>`,
      steps: [
        'Convert images to WebP/AVIF',
        'Add srcset for responsive delivery',
        'Lazy-load below-the-fold images'
      ]
    };
  }

  if (category.includes('css')) {
    return {
      id: 'rec-css',
      categoryKey: 'css',
      icon: '🟡',
      categoryLabel: 'Performance',
      problematicCode: `<!-- Large unused CSS -->
<link rel="stylesheet" href="/css/app.css">`,
      fixedCode: `<!-- Split critical CSS -->
<style>/* critical above-the-fold styles */</style>
<link rel="stylesheet" href="/css/app.css" media="print" onload="this.media='all'">`,
      steps: [
        'Remove unused CSS with Coverage tab',
        'Inline critical CSS for above-the-fold',
        'Defer non-critical styles'
      ]
    };
  }

  if (category.includes('caching') || title.includes('cache')) {
    return {
      id: 'rec-caching',
      categoryKey: 'caching',
      icon: '🟡',
      categoryLabel: 'Performance',
      problematicCode: `# Missing caching headers
Cache-Control: no-store`,
      fixedCode: `# Enable long-term caching for static assets
Cache-Control: public, max-age=31536000, immutable`,
      steps: [
        'Set Cache-Control for static assets',
        'Use asset versioning for cache busting',
        'Verify cache headers in DevTools'
      ]
    };
  }

  if (category.includes('compression') || title.includes('compression')) {
    return {
      id: 'rec-compression',
      categoryKey: 'compression',
      icon: '🟡',
      categoryLabel: 'Performance',
      problematicCode: `# Text assets served without compression
Content-Encoding: none`,
      fixedCode: `# Enable Brotli or Gzip
Content-Encoding: br`,
      steps: [
        'Enable Brotli (preferred) or Gzip on the server',
        'Compress HTML/CSS/JS/JSON responses',
        'Verify with network headers'
      ]
    };
  }

  if (category.includes('fonts') || title.includes('font')) {
    return {
      id: 'rec-fonts',
      categoryKey: 'fonts',
      icon: '🟡',
      categoryLabel: 'Performance',
      problematicCode: `@font-face {
  font-family: 'Brand';
  src: url('/fonts/brand.woff2') format('woff2');
  font-display: auto;
}`,
      fixedCode: `@font-face {
  font-family: 'Brand';
  src: url('/fonts/brand.woff2') format('woff2');
  font-display: swap;
}`,
      steps: [
        'Use font-display: swap',
        'Subset font files to required glyphs',
        'Preload critical fonts'
      ]
    };
  }

  if (category.includes('network') || title.includes('request')) {
    return {
      id: 'rec-requests',
      categoryKey: 'network',
      icon: '🟡',
      categoryLabel: 'Performance',
      problematicCode: `<!-- Too many separate requests -->
<script src="/js/vendor-1.js"></script>
<script src="/js/vendor-2.js"></script>`,
      fixedCode: `<!-- Bundle and defer where possible -->
<script src="/js/vendors.bundle.js" defer></script>`,
      steps: [
        'Bundle small JS/CSS files',
        'Remove unused third-party scripts',
        'Use HTTP/2 and keep connections warm'
      ]
    };
  }

  if (category.includes('accessibility')) {
    return {
      id: 'rec-accessibility',
      categoryKey: 'accessibility',
      icon: '🔵',
      categoryLabel: 'Accessibility',
      problematicCode: `<!-- Missing labels -->
<input type="text">
<img src="logo.png">`,
      fixedCode: `<!-- Add labels and alt text -->
<label for="name">Name</label>
<input id="name" type="text">
<img src="logo.png" alt="Site logo">`,
      steps: [
        'Add labels for form inputs',
        'Provide alt text for images',
        'Ensure sufficient color contrast'
      ]
    };
  }

  return null;
}

function generateFixesData(desktop, mobile) {
  const fixes = [];
  const deskLighthouse = desktop.lighthouse || {};
  const mobLighthouse = mobile.lighthouse || {};
  const deskCWV = desktop.coreWebVitals || {};
  const mobCWV = mobile.coreWebVitals || {};
  const opportunities = normalizeOpportunities(desktop, mobile);

  const mobilePerf = mobLighthouse.performance || 0;
  const mobileLCP = pickMetric([mobCWV.lcpMs, mobCWV.lcp]) || 0;
  const mobileTBT = pickMetric([mobCWV.tbtMs, mobCWV.tbt, mobCWV.inpMs, mobCWV.inp, mobCWV.fidMs, mobCWV.fid]) || 0;
  const mobileCLS = pickMetric([mobCWV.clsNum, mobCWV.cls]) || 0;

  // LCP Fix - Most Critical
  if (mobileLCP > 2500) {
    const severity = mobileLCP > 4000 ? 'critical' : 'medium';
    fixes.push({
      id: 'lcp-optimization',
      severity: severity,
      icon: '🔴',
      title: `Reduce Largest Contentful Paint (LCP)`,
      subtitle: `Current: ${mobCWV.lcp || (mobileLCP/1000).toFixed(2) + 's'} → Target: <2.5s`,
      category: 'Core Web Vitals',
      categoryKey: 'vitals-lcp',
      impact: mobileLCP > 4000 ? '+25 Performance Score' : '+15 Performance Score',
      summary: `Your LCP is ${mobCWV.lcp || (mobileLCP/1000).toFixed(2) + 's'}, which is ${mobileLCP > 4000 ? 'critically slow' : 'slower than recommended'}. LCP measures how long it takes for the largest content element (usually hero image or heading) to become visible. Google considers LCP a direct ranking factor.`,
      problematicCode: `<!-- Typical problematic pattern -->
<img src="/images/hero-original.jpg"
     class="hero-banner"
     alt="Hero banner">

<!-- Issues detected: -->
<!-- ✗ Large file size (likely 2-4MB) -->
<!-- ✗ No responsive images (srcset) -->
<!-- ✗ No width/height (causes CLS) -->
<!-- ✗ Not preloaded as LCP element -->`,
      fixedCode: `<!-- Optimized solution -->
<link rel="preload"
      as="image"
      href="/images/hero-800.webp"
      fetchpriority="high">

<img src="/images/hero-800.webp"
     srcset="/images/hero-400.webp 400w,
             /images/hero-800.webp 800w,
             /images/hero-1200.webp 1200w"
     sizes="(max-width: 768px) 100vw, 800px"
     width="1920"
     height="1080"
     loading="eager"
     fetchpriority="high"
     alt="Hero banner">

<!-- ✓ WebP format (70-80% smaller) -->
<!-- ✓ Responsive images for different screens -->
<!-- ✓ Explicit dimensions (prevents CLS) -->
<!-- ✓ Preloaded for instant visibility -->`,
      resources: [
        { file: 'images/hero.jpg', size: '2.4MB', issue: 'Unoptimized, blocks LCP' },
        { file: 'images/background.png', size: '1.8MB', issue: 'Could use WebP format' }
      ],
      steps: [
        'Identify your LCP element using Chrome DevTools → Performance → View Largest Contentful Paint',
        'Convert LCP images to WebP and add <code>&lt;link rel="preload" as="image" fetchpriority="high"&gt;</code> in <code>&lt;head&gt;</code>',
        'Add explicit <code>width</code> and <code>height</code> attributes to prevent layout shift',
        'Set <code>loading="eager"</code> and <code>fetchpriority="high"</code> on the LCP image'
      ]
    });
  }

  // TBT / JavaScript Optimization
  if (mobileTBT > 200 || mobilePerf < 70) {
    fixes.push({
      id: 'javascript-optimization',
      severity: mobileTBT > 600 ? 'critical' : 'medium',
      icon: '🟡',
      title: 'Reduce JavaScript Execution Time',
      subtitle: `Total Blocking Time: ${mobileTBT}ms → Target: <200ms`,
      category: 'Performance',
      categoryKey: 'javascript',
      impact: '+20 Performance Score',
      summary: `Your site has ${mobileTBT}ms of Total Blocking Time, meaning the main thread is blocked and can't respond to user input. This causes delays in interactivity and poor user experience.`,
      problematicCode: `<!-- Render-blocking scripts in <head> -->
<script src="/js/jquery-3.6.0.min.js"></script>
<script src="/js/bootstrap.bundle.js"></script>
<script src="/js/animations.js"></script>
<script src="/js/analytics.js"></script>

<!-- Issues: -->
<!-- ✗ Blocks HTML parsing -->
<!-- ✗ Large bundle sizes -->
<!-- ✗ No code splitting -->
<!-- ✗ Unnecessary dependencies -->`,
      fixedCode: `<!-- Defer non-critical scripts -->
<script src="/js/analytics.js" defer></script>

<!-- Async for independent scripts -->
<script src="/js/animations.js" async></script>

<!-- Modern module approach -->
<script type="module">
  // Only load what you need
  import { initCarousel } from '/js/carousel.js';
  import { trackEvents } from '/js/analytics.js';

  // Lazy load heavy features
  if (document.querySelector('.video-player')) {
    import('/js/video-player.js');
  }
</script>

<!-- ✓ Non-blocking script loading -->
<!-- ✓ Code splitting by feature -->
<!-- ✓ Lazy load heavy components -->`,
      resources: [
        { file: 'js/vendor.bundle.js', size: '248KB', issue: 'Contains unused libraries' },
        { file: 'js/main.js', size: '156KB', issue: 'Not minified or tree-shaken' }
      ],
      steps: [
        'Add <code>defer</code> or <code>async</code> attributes to all non-critical script tags',
        'Open DevTools → Coverage tab to find and remove unused JavaScript',
        'Enable minification and gzip/brotli compression on your server'
      ]
    });
  }

  // CLS Fix
  if (mobileCLS > 0.1) {
    fixes.push({
      id: 'cls-layout-shift',
      severity: mobileCLS > 0.25 ? 'critical' : 'medium',
      icon: mobileCLS > 0.25 ? '🔴' : '🟡',
      title: 'Fix Cumulative Layout Shift (CLS)',
      subtitle: `Current: ${mobileCLS.toFixed(3)} → Target: <0.1`,
      category: 'Core Web Vitals',
      categoryKey: 'vitals-cls',
      impact: '+10 Performance Score',
      summary: `Your CLS score is ${mobileCLS.toFixed(3)}, indicating unexpected layout shifts that frustrate users. This happens when elements move after the page initially loads, often due to images, ads, or web fonts loading late.`,
      problematicCode: `<!-- Missing dimensions cause shifts -->
<img src="product.jpg" alt="Product">

<!-- Font loading causes text reflow -->
<style>
  body {
    font-family: 'Custom Font', sans-serif;
  }
</style>

<!-- Dynamic content insertion -->
<div id="banner-ad"></div>
<div class="main-content">...</div>

<!-- Issues: -->
<!-- ✗ No image dimensions -->
<!-- ✗ No font-display strategy -->
<!-- ✗ No space reserved for ads -->`,
      fixedCode: `<!-- Reserve space with dimensions -->
<img src="product.jpg"
     alt="Product"
     width="800"
     height="600">

<!-- Control font loading -->
<style>
  @font-face {
    font-family: 'Custom Font';
    src: url('/fonts/custom.woff2');
    font-display: swap; /* Prevents invisible text */
  }

  body {
    font-family: 'Custom Font', sans-serif;
  }
</style>

<!-- Reserve space for dynamic content -->
<div id="banner-ad"
     style="min-height: 250px;
            background: rgba(0,0,0,0.05);">
</div>
<div class="main-content">...</div>

<!-- ✓ Explicit dimensions prevent shifts -->
<!-- ✓ font-display controls loading -->
<!-- ✓ Reserved space for ads -->`,
      resources: [
        { file: 'All images without width/height', size: 'N/A', issue: 'Causes layout shifts' },
        { file: 'Custom web fonts', size: 'N/A', issue: 'No font-display strategy' }
      ],
      steps: [
        'Add <code>width</code> and <code>height</code> attributes to all images and videos',
        'Set <code>font-display: swap</code> on @font-face rules and preload critical fonts',
        'Reserve space for ads/embeds with <code>min-height</code> or <code>aspect-ratio</code>'
      ]
    });
  }

  // Image Optimization
  if (mobilePerf < 80) {
    fixes.push({
      id: 'image-optimization',
      severity: 'medium',
      icon: '🟡',
      title: 'Optimize Images',
      subtitle: 'Reduce image file sizes by 60-80%',
      category: 'Performance',
      categoryKey: 'images',
      impact: '+12 Performance Score',
      summary: 'Images account for a significant portion of page weight. Optimizing images can dramatically improve load times and reduce bandwidth costs.',
      problematicCode: `<!-- Unoptimized images -->
<img src="/photos/team-photo.jpg"
     alt="Team photo">
<!-- File size: 3.2MB -->
<!-- Format: JPEG -->
<!-- Resolution: 4000x3000 -->

<div style="background-image: url('/bg/hero.png')">
  ...
</div>
<!-- File size: 2.8MB -->
<!-- Format: PNG (unnecessary) -->`,
      fixedCode: `<!-- Optimized with WebP + responsive -->
<picture>
  <source
    srcset="/photos/team-400.webp 400w,
            /photos/team-800.webp 800w"
    type="image/webp">
  <img src="/photos/team-800.jpg"
       srcset="/photos/team-400.jpg 400w,
               /photos/team-800.jpg 800w"
       sizes="(max-width: 768px) 100vw, 50vw"
       width="800"
       height="600"
       loading="lazy"
       alt="Team photo">
</picture>
<!-- File size: 180KB (WebP) or 320KB (JPEG) -->
<!-- 94% smaller! -->

<div style="background-image:
     image-set(
       url('/bg/hero.webp') type('image/webp'),
       url('/bg/hero.jpg') type('image/jpeg')
     )">
  ...
</div>
<!-- WebP fallback for backgrounds -->`,
      resources: [
        { file: 'images/hero.jpg', size: '3.2MB', issue: 'Could be 180KB as WebP' },
        { file: 'images/gallery/*.jpg', size: '18MB total', issue: '12 unoptimized images' }
      ],
      steps: [
        'Convert images to WebP format using Squoosh, Sharp, or your image CDN',
        'Add <code>srcset</code> with multiple sizes (400w, 800w, 1200w) for responsive delivery',
        'Set <code>loading="lazy"</code> on images below the fold',
        'Add <code>width</code> and <code>height</code> attributes to prevent layout shift'
      ]
    });
  }

  // Accessibility
  const accessScore = mobLighthouse.accessibility || deskLighthouse.accessibility || 0;
  if (accessScore < 85) {
    fixes.push({
      id: 'accessibility-improvements',
      severity: accessScore < 70 ? 'medium' : 'low',
      icon: '🔵',
      title: 'Improve Accessibility',
      subtitle: `Score: ${accessScore}/100 → Target: >90`,
      category: 'Accessibility',
      categoryKey: 'accessibility',
      impact: 'Legal compliance + SEO boost',
      summary: 'Accessibility improvements help users with disabilities and improve SEO. Common issues include missing alt text, poor color contrast, and missing ARIA labels.',
      problematicCode: `<!-- Missing alt text -->
<img src="logo.png">

<!-- Poor color contrast -->
<button style="color: #ccc;
               background: #ddd;">
  Click me
</button>

<!-- Non-semantic HTML -->
<div onclick="submit()">Submit</div>

<!-- Missing labels -->
<input type="text" placeholder="Name">

<!-- Issues: -->
<!-- ✗ Screen readers can't describe images -->
<!-- ✗ Low contrast (fails WCAG AA) -->
<!-- ✗ Not keyboard accessible -->
<!-- ✗ No associated label -->`,
      fixedCode: `<!-- Descriptive alt text -->
<img src="logo.png"
     alt="Company Logo - Site Mechanic">

<!-- Sufficient contrast (4.5:1) -->
<button style="color: #fff;
               background: #2563eb;">
  Click me
</button>

<!-- Semantic, keyboard accessible -->
<button type="submit"
        aria-label="Submit form">
  Submit
</button>

<!-- Proper label association -->
<label for="nameInput">Name:</label>
<input type="text"
       id="nameInput"
       name="name"
       aria-required="true">

<!-- ✓ All elements accessible -->
<!-- ✓ WCAG AA compliant -->
<!-- ✓ Keyboard navigable -->`,
      resources: [],
      steps: [
        'Add descriptive <code>alt</code> text to all images',
        'Ensure color contrast ratio of at least 4.5:1 for text',
        'Use semantic HTML (<code>&lt;button&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>) instead of <code>&lt;div&gt;</code>',
        'Associate all form inputs with <code>&lt;label&gt;</code> elements'
      ]
    });
  }

  // Sort by severity
  const priorityOrder = { critical: 0, medium: 1, low: 2 };
  fixes.sort((a, b) => priorityOrder[a.severity] - priorityOrder[b.severity]);

  if (opportunities.length) {
    fixes.forEach(fix => {
      if (!fix.categoryKey) return;
      const evidence = findEvidenceForCategory(opportunities, fix.categoryKey);
      fix.problematicCode = buildProblematicEvidenceBlock(fix, evidence, fix.problematicCode);
    });
  }

  const recommendations = normalizeRecommendations(desktop, mobile);
  if (recommendations.length) {
    const usedCategories = new Set(fixes.map(f => f.categoryKey).filter(Boolean));
    recommendations.forEach(rec => {
      const template = buildRecommendationTemplate(rec);
      if (!template) return;
      if (usedCategories.has(template.categoryKey)) return;

      usedCategories.add(template.categoryKey);
      const evidence = findEvidenceForCategory(opportunities, template.categoryKey);
      fixes.push({
        id: `${template.id}-${rec.title.replace(/\s+/g, '-').toLowerCase()}`,
        severity: toSeverity(rec.priority),
        icon: template.icon,
        title: rec.title,
        subtitle: rec.impact || rec.category || 'Performance',
        category: template.categoryLabel,
        categoryKey: template.categoryKey,
        impact: rec.impact || 'Impact varies by implementation',
        summary: rec.description || 'This item was flagged by the analysis and should be addressed to improve performance.',
        problematicCode: buildProblematicEvidenceBlock({}, evidence, template.problematicCode),
        fixedCode: template.fixedCode,
        resources: [],
        steps: template.steps
      });
    });
  }

  return fixes;
}

function renderFixAccordion(fix, index) {
  const accordionId = `fix-${fix.id}-${index}`;
  const severityClass = `severity-${fix.severity}`;

  return `
    <div class="fix-accordion ${severityClass}" data-fix-id="${accordionId}">
      <div class="fix-header" onclick="toggleFixAccordion('${accordionId}')">
        <div class="fix-header-left">
          <span class="fix-icon">${fix.icon}</span>
          <div class="fix-title-group">
            <h4 class="fix-title">${fix.title}</h4>
            <p class="fix-subtitle">${fix.subtitle}</p>
          </div>
        </div>
        <div class="fix-badges">
          <span class="fix-badge priority-${fix.severity}">${fix.severity}</span>
          <span class="fix-badge category">${fix.category}</span>
          <span class="fix-expand-icon">▼</span>
        </div>
      </div>

      <div class="fix-content" id="${accordionId}-content">
        <div class="fix-content-inner">
          ${renderFixTabs(fix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderFixTabs(fix, accordionId) {
  return `
    <div class="fix-tabs">
      <button class="fix-tab active" onclick="switchFixTab('${accordionId}', 'summary')">
        📋 Summary
      </button>
      <button class="fix-tab" onclick="switchFixTab('${accordionId}', 'code')">
        💻 Code
      </button>
      ${fix.resources.length > 0 ? `<button class="fix-tab" onclick="switchFixTab('${accordionId}', 'resources')">📦 Resources</button>` : ''}
      <button class="fix-tab" onclick="switchFixTab('${accordionId}', 'guide')">
        🔧 Fix Guide
      </button>
    </div>

    <!-- Summary Tab -->
    <div class="fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin-bottom: 1rem;">
        ${fix.summary}
      </p>
      <div class="impact-indicator">
        <div>
          <div class="impact-value">${fix.impact}</div>
          <div class="impact-label">Estimated Improvement</div>
        </div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="fix-tab-content" id="${accordionId}-code">
      <div class="code-comparison">
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-block-title error">
              ❌ Problematic Code
            </span>
            <button class="fix-btn-secondary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;" onclick="copyCode('${accordionId}-problem')">
              📋 Copy
            </button>
          </div>
          <div class="code-block-body">
            <pre id="${accordionId}-problem">${escapeHtml(fix.problematicCode)}</pre>
          </div>
        </div>

        <div class="code-block" style="position: relative;">
          <div class="code-block-header">
            <span class="code-block-title success">
              ✅ Optimized Solution
            </span>
            <button class="fix-btn-secondary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;" onclick="copyCode('${accordionId}-solution')">
              📋 Copy
            </button>
          </div>
          <div class="code-block-body">
            <pre id="${accordionId}-solution">${escapeHtml(fix.fixedCode)}</pre>
          </div>
        </div>
      </div>
    </div>

    ${fix.resources.length > 0 ? `
    <!-- Resources Tab -->
    <div class="fix-tab-content" id="${accordionId}-resources">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Affected Resources:</h5>
      <ul class="resources-list">
        ${fix.resources.map(r => `
          <li class="resource-item">
            <code>${r.file}</code>
            ${r.size !== 'N/A' ? `<span class="resource-size">${r.size}</span>` : ''}
            <div style="color: #888; font-size: 0.8rem; margin-top: 0.25rem;">${r.issue}</div>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Fix Guide Tab -->
    <div class="fix-tab-content" id="${accordionId}-guide">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${[...fix.steps, ...(fix.proSteps || [])].map(step => `<li style="margin-bottom: 0.75rem;">${step}</li>`).join('')}
      </ol>

      <div class="fix-actions">
        <button class="fix-btn fix-btn-primary" data-action="apply-fix" data-fix-id="${fix.id}">
          ✨ Apply Fix
        </button>
        <button class="fix-btn fix-btn-secondary" data-action="test-fix" data-fix-id="${fix.id}">
          🧪 Test Fix
        </button>
        <button class="fix-btn fix-btn-secondary" data-action="learn-more" data-fix-id="${fix.id}" data-learn-url="https://web.dev/articles/${fix.id}">
          📚 Learn More
        </button>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Accordion toggle function
function toggleFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);

  if (!accordion || !content) return;

  const isExpanded = accordion.classList.contains('expanded');

  if (isExpanded) {
    // Collapse
    accordion.classList.remove('expanded');
    content.style.maxHeight = '0';
  } else {
    // Expand
    accordion.classList.add('expanded');
    content.style.maxHeight = content.scrollHeight + 'px';

    // Recalculate after a short delay to account for content rendering
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 50);
  }
}

// Tab switching function
function switchFixTab(accordionId, tabName) {
  // Update tab buttons
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.fix-tab');
  const contents = accordion.querySelectorAll('.fix-tab-content');

  tabs.forEach(tab => tab.classList.remove('active'));
  contents.forEach(content => content.classList.remove('active'));

  const activeTab = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(tabName));
  const activeContent = document.getElementById(`${accordionId}-${tabName}`);

  if (activeTab) activeTab.classList.add('active');
  if (activeContent) activeContent.classList.add('active');

  // Recalculate accordion height
  const content = document.getElementById(`${accordionId}-content`);
  if (content && accordion.classList.contains('expanded')) {
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 50);
  }
}

// Copy code function
function copyCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;

  navigator.clipboard.writeText(text).then(() => {
    // Show success feedback
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    button.style.background = 'rgba(34, 197, 94, 0.2)';
    button.style.borderColor = '#22c55e';
    button.style.color = '#22c55e';

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
      button.style.borderColor = '';
      button.style.color = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy code. Please select and copy manually.');
  });
}

// Make functions globally available
window.toggleFixAccordion = toggleFixAccordion;
window.switchFixTab = switchFixTab;
window.copyCode = copyCode;

// Event delegation for dynamically generated performance fix accordions
// This ensures clicks work even when content is added after page load
document.addEventListener('click', function(e) {
  // Handle accordion header clicks (expand/collapse)
  const header = e.target.closest('.fix-header');
  if (header) {
    const accordion = header.closest('.fix-accordion');
    if (accordion) {
      const accordionId = accordion.getAttribute('data-fix-id');
      if (accordionId) {
        e.preventDefault();
        e.stopPropagation();
        toggleFixAccordion(accordionId);
      }
    }
    return;
  }

  // Handle tab button clicks
  const tabButton = e.target.closest('.fix-tab');
  if (tabButton) {
    const accordion = tabButton.closest('.fix-accordion');
    if (accordion) {
      const accordionId = accordion.getAttribute('data-fix-id');
      const tabText = tabButton.textContent.toLowerCase();
      let tabName = 'summary';
      if (tabText.includes('code')) tabName = 'code';
      else if (tabText.includes('resources') || tabText.includes('docs')) tabName = 'resources';
      else if (tabText.includes('guide') || tabText.includes('implement')) tabName = 'guide';
      e.preventDefault();
      e.stopPropagation();
      switchFixTab(accordionId, tabName);
    }
    return;
  }

  // Handle copy button clicks
  const copyBtn = e.target.closest('.copy-btn, [onclick*="copyCode"]');
  if (copyBtn) {
    const codeBlock = copyBtn.closest('.code-block');
    if (codeBlock) {
      const codeEl = codeBlock.querySelector('code');
      if (codeEl) {
        e.preventDefault();
        e.stopPropagation();
        copyCode(copyBtn, codeEl.textContent);
      }
    }
    return;
  }

  // Handle fix action buttons (Apply Fix, Test Fix, Learn More)
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    const action = actionBtn.getAttribute('data-action');
    const fixId = actionBtn.getAttribute('data-fix-id');
    e.preventDefault();
    e.stopPropagation();

    switch (action) {
      case 'apply-fix':
        // Show helpful message about applying the fix
        alert(`To apply this fix:\n\n1. Review the code examples in the "Code" tab\n2. Copy the relevant snippets to your project\n3. Test thoroughly before deploying\n\nFix ID: ${fixId}`);
        break;
      case 'test-fix':
        // Open relevant testing tools
        const testUrls = {
          'reduce-javascript': 'https://pagespeed.web.dev/',
          'optimize-images': 'https://pagespeed.web.dev/',
          'reduce-tbt': 'https://pagespeed.web.dev/',
          'improve-lcp': 'https://pagespeed.web.dev/',
          'reduce-cls': 'https://pagespeed.web.dev/',
          'improve-fcp': 'https://pagespeed.web.dev/',
          'improve-inp': 'https://pagespeed.web.dev/',
          'improve-accessibility': 'https://wave.webaim.org/'
        };
        const testUrl = testUrls[fixId] || 'https://pagespeed.web.dev/';
        window.open(testUrl, '_blank');
        break;
      case 'learn-more':
        const learnUrl = actionBtn.getAttribute('data-learn-url') || `https://web.dev/articles/${fixId}`;
        window.open(learnUrl, '_blank');
        break;
    }
    return;
  }
});
