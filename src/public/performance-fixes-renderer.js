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

function generateFixesData(desktop, mobile) {
  const fixes = [];
  const deskLighthouse = desktop.lighthouse || {};
  const mobLighthouse = mobile.lighthouse || {};
  const deskCWV = desktop.coreWebVitals || {};
  const mobCWV = mobile.coreWebVitals || {};

  const mobilePerf = mobLighthouse.performance || 0;
  const mobileLCP = mobCWV.lcpMs || 0;
  const mobileTBT = mobCWV.fidMs || 0;
  const mobileCLS = mobCWV.clsNum || 0;

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
        'Convert images to WebP format using tools like Squoosh or Sharp',
        'Generate multiple sizes (400w, 800w, 1200w) for responsive delivery',
        'Add <code>width</code> and <code>height</code> attributes to prevent layout shift',
        'Use <code>&lt;link rel="preload"&gt;</code> for LCP image'
      ],
      proSteps: [
        'Set <code>fetchpriority="high"</code> on hero image and critical assets',
        'Implement adaptive image loading based on connection speed using Network Information API',
        'Configure CDN edge caching with stale-while-revalidate strategy',
        'Set up automated image optimization pipeline with CI/CD integration'
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
        'Use <code>defer</code> or <code>async</code> attributes on script tags',
        'Split code by route/feature using dynamic imports',
        'Remove unused JavaScript with tree-shaking',
        'Minify and compress JavaScript files (gzip/brotli)'
      ],
      proSteps: [
        'Consider removing jQuery if only used for simple DOM manipulation',
        'Implement code splitting at component level with React.lazy() or Vue async components',
        'Use a bundler like Webpack, Rollup, or Vite with advanced optimization (scope hoisting)',
        'Set up performance budgets in CI/CD to prevent regression'
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
        'Add <code>width</code> and <code>height</code> to all <code>&lt;img&gt;</code> and <code>&lt;video&gt;</code> tags',
        'Use <code>aspect-ratio</code> CSS for responsive embeds',
        'Set <code>font-display: swap</code> on @font-face declarations',
        'Reserve space for ads with <code>min-height</code>'
      ],
      proSteps: [
        'Avoid inserting content above existing content after page load',
        'Use CSS transforms for animations (not top/left/margin)',
        'Implement font preloading with <code>&lt;link rel="preload"&gt;</code> for critical fonts',
        'Use content-visibility CSS property to optimize off-screen rendering'
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
        'Convert to WebP format (70-80% smaller than JPEG)',
        'Use <code>&lt;picture&gt;</code> element for format fallbacks',
        'Generate multiple sizes for responsive delivery',
        'Add <code>loading="lazy"</code> for below-the-fold images'
      ],
      proSteps: [
        'Use image CDN for automatic optimization (Cloudinary, Imgix) with real-time transformations',
        'Implement AVIF format support for even better compression (30% smaller than WebP)',
        'Set up automated image compression pipeline with tools like Sharp or ImageOptim',
        'Use blur-up or LQIP (Low Quality Image Placeholder) technique for progressive loading'
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
        'Ensure color contrast ratio of 4.5:1 for text (7:1 for AAA)',
        'Use semantic HTML (<code>&lt;button&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>)',
        'Add <code>aria-label</code> where text labels aren\'t visible'
      ],
      proSteps: [
        'Make all interactive elements keyboard accessible with proper focus indicators',
        'Implement skip links for keyboard navigation to main content',
        'Test with screen readers (NVDA, JAWS, VoiceOver) and fix announced content',
        'Add live regions with <code>aria-live</code> for dynamic content updates'
      ]
    });
  }

  // Sort by severity
  const priorityOrder = { critical: 0, medium: 1, low: 2 };
  fixes.sort((a, b) => priorityOrder[a.severity] - priorityOrder[b.severity]);

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
          ${fix.proSteps && fix.proSteps.length > 0 ? '<span class="pro-badge"><span style="font-size: 0.7rem;">✨</span> PRO</span>' : ''}
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
              ✅ Optimized Solution ${fix.proSteps && fix.proSteps.length > 0 ? '<span class="pro-badge" style="margin-left: 0.5rem;"><span style="font-size: 0.7rem;">✨</span> PRO</span>' : ''}
            </span>
            <button class="fix-btn-secondary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;" onclick="copyCode('${accordionId}-solution')">
              📋 Copy
            </button>
          </div>
          <div class="code-block-body">
            <pre id="${accordionId}-solution">${escapeHtml(fix.fixedCode)}</pre>
          </div>
          ${fix.proSteps && fix.proSteps.length > 0 ? `
            <!-- Pro Code Overlay -->
            <div class="pro-code-overlay">
              <div style="text-align: center; position: relative; z-index: 2;">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔒</div>
                <div style="font-weight: 700; font-size: 1rem; margin-bottom: 0.5rem;">
                  Advanced Solution
                </div>
                <div style="font-size: 0.85rem; opacity: 0.9; margin-bottom: 1rem;">
                  Unlock expert-level code examples
                </div>
                <button style="padding: 0.625rem 1.5rem; background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; border: none; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer;" onclick="alert('Upgrade to Pro! (Demo functionality)')">
                  Upgrade to Pro
                </button>
              </div>
            </div>
          ` : ''}
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
        ${fix.steps.map(step => `<li style="margin-bottom: 0.75rem;">${step}</li>`).join('')}

        ${fix.proSteps && fix.proSteps.length > 0 ? `
          <!-- Pro Unlock Banner -->
          <div class="pro-unlock-banner" style="margin: 1.5rem 0; list-style: none;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="font-size: 1.5rem;">🔒</span>
              <div style="flex: 1;">
                <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem;">
                  Unlock ${fix.proSteps.length} Advanced Steps
                </div>
                <div style="font-size: 0.8rem; opacity: 0.8;">
                  Get expert-level optimization techniques with Site Mechanic Pro
                </div>
              </div>
              <button style="padding: 0.5rem 1.25rem; background: linear-gradient(135deg, #ffd700, #ffaa00); color: #000; border: none; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; white-space: nowrap;" onclick="alert('Upgrade to Pro! (Demo functionality)')">
                Upgrade to Pro
              </button>
            </div>
          </div>

          <!-- Pro Steps (Locked) -->
          ${fix.proSteps.map(step => `
            <li class="pro-step" style="margin-bottom: 0.75rem;">${step}</li>
          `).join('')}
        ` : ''}
      </ol>

      <div class="fix-actions">
        <button class="fix-btn fix-btn-primary" onclick="alert('Fix applied! (Demo functionality)')">
          ✨ Apply Fix
        </button>
        <button class="fix-btn fix-btn-secondary" onclick="alert('Test opened in new tab (Demo functionality)')">
          🧪 Test Fix
        </button>
        <button class="fix-btn fix-btn-secondary" onclick="window.open('https://web.dev/articles/${fix.id}', '_blank')">
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
