/**
 * Example Integration - Modern UI Components
 * This file shows how to use the new interactive components in your existing code
 */

// ===================================================================
// EXAMPLE 1: Creating Interactive Font Recommendations
// ===================================================================

function createFontRecommendation(fontIssue) {
  const rec = interactiveRecs.createRecommendation({
    title: `Optimize ${fontIssue.fontName} Loading`,
    description: `This font is ${fontIssue.size} and blocking render. Preload it for faster page load.`,
    priority: fontIssue.size > 200 ? 'high' : 'medium',
    category: 'performance',
    action: {
      code: `<link rel="preload" href="${fontIssue.url}" as="font" type="font/woff2" crossorigin>`,
      learnMore: 'https://web.dev/font-best-practices/',
      showFiles: false
    }
  });

  // Add code snippet
  const codeSnippet = interactiveRecs.createCodeSnippet(
    `/* Add to your CSS */
@font-face {
  font-family: '${fontIssue.fontName}';
  src: url('${fontIssue.url}') format('woff2');
  font-display: swap; /* Prevent invisible text */
}`,
    'css'
  );

  rec.querySelector('.rec-footer').appendChild(codeSnippet);
  return rec;
}

// ===================================================================
// EXAMPLE 2: Creating Image Optimization Recommendations
// ===================================================================

function createImageOptimizationRec(images) {
  const largeImages = images.filter(img => img.size > 200000); // Over 200KB

  const rec = interactiveRecs.createRecommendation({
    title: 'Compress Large Images',
    description: `Found ${largeImages.length} images over 200KB that could be optimized to improve load time.`,
    priority: largeImages.length > 10 ? 'high' : 'medium',
    category: 'performance',
    action: {
      showFiles: true,
      files: largeImages.map(img => ({
        name: img.src.split('/').pop(),
        size: img.size,
        path: img.src,
        recommendation: `Compress to ~${Math.floor(img.size * 0.3 / 1000)}KB (70% reduction)`
      })),
      code: `/* Use modern image formats */
<picture>
  <source srcset="image.webp" type="image/webp">
  <source srcset="image.avif" type="image/avif">
  <img src="image.jpg" alt="Description" loading="lazy">
</picture>`,
      learnMore: 'https://web.dev/uses-optimized-images/'
    }
  });

  // Add file list
  const fileList = interactiveRecs.createFileList(
    largeImages.map(img => ({
      name: img.src.split('/').pop(),
      size: img.size,
      path: img.src,
      recommendation: `Reduce by ${Math.floor((1 - 0.3) * 100)}%`
    })),
    `Images to Optimize (${largeImages.length})`
  );

  rec.querySelector('.rec-body').appendChild(fileList);
  return rec;
}

// ===================================================================
// EXAMPLE 3: Core Web Vitals with Threshold Bars
// ===================================================================

function renderCoreWebVitals(data) {
  const container = document.createElement('div');
  container.className = 'module-performance cwv-section';

  // Add section header with icon
  const header = document.createElement('div');
  header.className = 'module-section-header';
  header.innerHTML = `
    <div class="module-icon">⚡</div>
    <div class="module-title">
      <h2>Core Web Vitals</h2>
      <p>Critical user experience metrics</p>
    </div>
    <div class="module-actions">
      <button class="module-action-btn" onclick="exportCWVReport()">
        📊 Client Report
      </button>
    </div>
  `;
  container.appendChild(header);

  // Add threshold bars for each vital
  if (data.lcp) {
    const lcpBar = UIComponents.createThresholdBar({
      label: 'Largest Contentful Paint (LCP)',
      value: data.lcp,
      thresholds: { good: 2500, needsWork: 4000, poor: 6000 },
      unit: 'ms',
      format: 'time'
    });
    container.appendChild(lcpBar);
  }

  if (data.fid) {
    const fidBar = UIComponents.createThresholdBar({
      label: 'First Input Delay (FID)',
      value: data.fid,
      thresholds: { good: 100, needsWork: 300, poor: 500 },
      unit: 'ms',
      format: 'time'
    });
    container.appendChild(fidBar);
  }

  if (data.cls) {
    const clsBar = UIComponents.createThresholdBar({
      label: 'Cumulative Layout Shift (CLS)',
      value: data.cls,
      thresholds: { good: 0.1, needsWork: 0.25, poor: 0.5 },
      unit: '',
      format: 'number'
    });
    container.appendChild(clsBar);
  }

  return container;
}

// ===================================================================
// EXAMPLE 4: Module-Specific Section Headers
// ===================================================================

function createModuleHeader(module) {
  const modules = {
    performance: {
      icon: '⚡',
      title: 'Performance Analysis',
      description: 'Loading speed and optimization opportunities',
      color: 'performance'
    },
    seo: {
      icon: '🔍',
      title: 'SEO Optimization',
      description: 'Search engine visibility and ranking factors',
      color: 'seo'
    },
    accessibility: {
      icon: '♿',
      title: 'Accessibility Audit',
      description: 'WCAG compliance and inclusive design',
      color: 'accessibility'
    },
    fonts: {
      icon: '🔤',
      title: 'Font Analysis',
      description: 'Typography, loading, and rendering',
      color: 'fonts'
    }
  };

  const config = modules[module] || modules.performance;

  const header = document.createElement('div');
  header.className = `module-section-header module-${config.color}`;
  header.setAttribute('data-module', config.color);
  
  header.innerHTML = `
    <div class="module-icon">${config.icon}</div>
    <div class="module-title">
      <h2>${config.title}</h2>
      <p>${config.description}</p>
    </div>
    <div class="module-actions">
      <button class="module-action-btn">
        📄 Export
      </button>
      <button class="module-action-btn">
        🔗 Share
      </button>
    </div>
  `;

  return header;
}

// ===================================================================
// EXAMPLE 5: Before/After Performance Comparison
// ===================================================================

function showPerformanceImprovement(optimization) {
  const comparison = interactiveRecs.createBeforeAfter({
    before: optimization.currentLoadTime,
    after: optimization.potentialLoadTime,
    metric: 'Load Time (ms)',
    improvement: `By ${optimization.technique}, you could save ${optimization.currentLoadTime - optimization.potentialLoadTime}ms`
  });

  // Add recommendation card
  const rec = interactiveRecs.createRecommendation({
    title: optimization.technique,
    description: optimization.description,
    priority: optimization.impact > 1000 ? 'high' : 'medium',
    category: 'performance',
    action: {
      code: optimization.codeExample,
      learnMore: optimization.docsUrl
    }
  });

  rec.querySelector('.rec-body').appendChild(comparison);
  return rec;
}

// ===================================================================
// EXAMPLE 6: Status Chips for Quick Visual Feedback
// ===================================================================

function addStatusChips(element, metrics) {
  const chipContainer = document.createElement('div');
  chipContainer.style.display = 'flex';
  chipContainer.style.gap = '0.5rem';
  chipContainer.style.flexWrap = 'wrap';
  chipContainer.style.marginTop = '1rem';

  metrics.forEach(metric => {
    let status, text;
    
    if (metric.value >= metric.good) {
      status = 'good';
      text = `${metric.name}: Excellent`;
    } else if (metric.value >= metric.needsWork) {
      status = 'needs-work';
      text = `${metric.name}: Needs Work`;
    } else {
      status = 'critical';
      text = `${metric.name}: Critical`;
    }

    const chip = UIComponents.createStatusChip(status, text);
    chipContainer.appendChild(chip);
  });

  element.appendChild(chipContainer);
}

// ===================================================================
// EXAMPLE 7: Metric Cards Grid
// ===================================================================

function createMetricsGrid(metrics) {
  const grid = document.createElement('div');
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--spacing-md);
    margin: var(--spacing-lg) 0;
  `;

  metrics.forEach(metric => {
    const card = UIComponents.createMetricCard({
      icon: metric.icon,
      label: metric.label,
      value: metric.value,
      subtitle: metric.subtitle,
      trend: metric.trend
    });
    grid.appendChild(card);
  });

  return grid;
}

// ===================================================================
// EXAMPLE 8: Integrating with Existing Font Scanner Code
// ===================================================================

function enhanceExistingRecommendations(recommendationsDiv) {
  // Example: Find all recommendation items and make them interactive
  const existingRecs = recommendationsDiv.querySelectorAll('.recommendation-item');
  
  existingRecs.forEach(oldRec => {
    const title = oldRec.querySelector('h4')?.textContent || 'Recommendation';
    const description = oldRec.querySelector('p')?.textContent || '';
    const codeBlock = oldRec.querySelector('code')?.textContent;

    // Create new interactive recommendation
    const newRec = interactiveRecs.createRecommendation({
      title: title,
      description: description,
      priority: oldRec.classList.contains('high') ? 'high' : 'medium',
      category: 'general',
      action: codeBlock ? {
        code: codeBlock,
        learnMore: oldRec.querySelector('a')?.href
      } : null
    });

    // Replace old with new
    oldRec.replaceWith(newRec);
  });
}

// ===================================================================
// EXAMPLE 9: Usage in Main Script
// ===================================================================

/*
// In your existing displayResults() function, add:

function displayResults(data) {
  // ... existing code ...

  // Add module header for performance section
  const perfHeader = createModuleHeader('performance');
  performanceSection.insertBefore(perfHeader, performanceSection.firstChild);

  // Add Core Web Vitals with threshold bars
  if (data.coreWebVitals) {
    const cwvSection = renderCoreWebVitals(data.coreWebVitals);
    performanceSection.appendChild(cwvSection);
  }

  // Convert recommendations to interactive cards
  if (data.recommendations) {
    data.recommendations.forEach(rec => {
      const interactiveRec = interactiveRecs.createRecommendation({
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
        category: rec.category,
        action: {
          code: rec.codeExample,
          learnMore: rec.docsUrl,
          showFiles: rec.affectedFiles?.length > 0,
          files: rec.affectedFiles
        }
      });
      recommendationsContainer.appendChild(interactiveRec);
    });
  }

  // Add status chips for quick overview
  if (data.metrics) {
    addStatusChips(summarySection, [
      { name: 'Performance', value: data.performanceScore, good: 90, needsWork: 70 },
      { name: 'SEO', value: data.seoScore, good: 90, needsWork: 70 },
      { name: 'Accessibility', value: data.a11yScore, good: 90, needsWork: 70 }
    ]);
  }

  // Show summary ribbon (already implemented)
  if (window.modernUI) {
    window.modernUI.showSummaryRibbon(data.overallScore, data.grade);
    window.modernUI.showQuickNav();
  }
}
*/

// ===================================================================
// HELPER: Quick Integration for Font Recommendations
// ===================================================================

window.enhanceFontRecommendations = function(fontData) {
  const container = document.getElementById('fontRecommendations') || document.createElement('div');
  container.id = 'fontRecommendations';

  // Clear existing content
  container.innerHTML = '';

  // Add module header
  const header = createModuleHeader('fonts');
  container.appendChild(header);

  // Process each font issue
  fontData.issues?.forEach(issue => {
    const rec = createFontRecommendation(issue);
    container.appendChild(rec);
  });

  return container;
};

// ===================================================================
// HELPER: Quick Integration for Image Optimization
// ===================================================================

window.enhanceImageRecommendations = function(images) {
  const rec = createImageOptimizationRec(images);
  return rec;
};

console.log('✅ Modern UI Examples loaded. Use window.enhance* functions for quick integration.');
