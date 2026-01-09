// Brand Consistency Checker Script
// Best-in-class brand analysis with consistent UI design

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

// Multi-page toggle handler
document.getElementById('multiPageToggle').addEventListener('change', (e) => {
  const maxPagesContainer = document.getElementById('maxPagesContainer');
  maxPagesContainer.style.display = e.target.checked ? 'flex' : 'none';
});

// Translation helper
function t(key, fallback) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key) || fallback;
  }
  return fallback;
}

// Copy to clipboard helper
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = button.textContent;
    button.textContent = t('common.copied', 'Copied!');
    button.style.background = 'rgba(0, 255, 65, 0.2)';
    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
    }, 2000);
  }).catch(() => {
    alert(t('common.copyFailed', 'Failed to copy'));
  });
}

// Generate CSS Variables export
function generateCSSVariables(colors) {
  const lines = [':root {'];
  colors.forEach((color, i) => {
    const name = i === 0 ? 'primary' : i === 1 ? 'secondary' : i === 2 ? 'accent' : `color-${i + 1}`;
    lines.push(`  --brand-${name}: ${color};`);
  });
  lines.push('}');
  return lines.join('\n');
}

// Generate Tailwind config export
function generateTailwindConfig(colors) {
  const colorObj = {};
  colors.forEach((color, i) => {
    const name = i === 0 ? 'primary' : i === 1 ? 'secondary' : i === 2 ? 'accent' : `brand${i + 1}`;
    colorObj[name] = `'${color}'`;
  });
  return `module.exports = {
  theme: {
    extend: {
      colors: {
${Object.entries(colorObj).map(([k, v]) => `        ${k}: ${v}`).join(',\n')}
      }
    }
  }
}`;
}

// Generate Design Tokens (JSON)
function generateDesignTokens(colors) {
  const tokens = {
    color: {
      brand: {}
    }
  };
  colors.forEach((color, i) => {
    const name = i === 0 ? 'primary' : i === 1 ? 'secondary' : i === 2 ? 'accent' : `color${i + 1}`;
    tokens.color.brand[name] = { value: color };
  });
  return JSON.stringify(tokens, null, 2);
}

// Analysis steps for the loader (will be translated at runtime)
function getAnalysisSteps(isMultiPage = false) {
  const baseSteps = [
    { label: t('brandConsistency.steps.initializing', 'Initializing analysis'), detail: t('brandConsistency.steps.connecting', 'Connecting to target website...') }
  ];
  
  if (isMultiPage) {
    baseSteps.push(
      { label: t('brandConsistency.steps.discoveringPages', 'Discovering pages'), detail: t('brandConsistency.steps.findingLinks', 'Finding internal links to analyze...') },
      { label: t('brandConsistency.steps.crawlingPages', 'Crawling pages'), detail: t('brandConsistency.steps.analyzingMultiple', 'Analyzing multiple pages...') }
    );
  }
  
  baseSteps.push(
    { label: t('brandConsistency.steps.extractingColors', 'Extracting colors'), detail: t('brandConsistency.steps.analyzingPalette', 'Analyzing color palette and harmony...') },
    { label: t('brandConsistency.steps.detectingFonts', 'Detecting fonts'), detail: t('brandConsistency.steps.identifyingTypography', 'Identifying typography hierarchy...') },
    { label: t('brandConsistency.steps.findingLogos', 'Finding logos'), detail: t('brandConsistency.steps.locatingAssets', 'Locating brand assets...') },
    { label: t('brandConsistency.steps.analyzingUI', 'Analyzing UI consistency'), detail: t('brandConsistency.steps.checkingStyles', 'Checking button and link styles...') },
    { label: t('brandConsistency.steps.checkingAccessibility', 'Checking accessibility'), detail: t('brandConsistency.steps.contrastRatios', 'Analyzing color contrast ratios...') }
  );
  
  if (isMultiPage) {
    baseSteps.push(
      { label: t('brandConsistency.steps.crossPageAnalysis', 'Cross-page analysis'), detail: t('brandConsistency.steps.comparingConsistency', 'Comparing consistency across pages...') }
    );
  }
  
  baseSteps.push(
    { label: t('brandConsistency.steps.generating', 'Generating insights'), detail: t('brandConsistency.steps.compiling', 'Compiling recommendations...') }
  );
  
  return baseSteps;
}

async function analyze() {
  const url = document.getElementById('url').value.trim();
  if (!url) { 
    alert(t('common.pleaseEnterUrl', 'Please enter a URL')); 
    return; 
  }
  
  const multiPageToggle = document.getElementById('multiPageToggle');
  const maxPagesSelect = document.getElementById('maxPages');
  const isMultiPage = multiPageToggle.checked;
  const maxPages = isMultiPage ? parseInt(maxPagesSelect.value, 10) : 1;
  
  const results = document.getElementById('results');
  const btn = document.getElementById('analyzeBtn');
  const buttonText = btn.querySelector('#buttonText') || btn;
  const urlInput = document.getElementById('url');
  
  // Disable inputs during scan
  results.style.display = 'none';
  btn.disabled = true;
  buttonText.textContent = t('common.runningScan', 'Running scan...');
  btn.style.opacity = '0.6';
  urlInput.disabled = true;
  
  // Initialize AnalyzerLoader
  const loader = new AnalyzerLoader('loadingContainer');
  
  // Add ASCII art patience message
  const loaderMessageEl = document.createElement('div');
  loaderMessageEl.id = 'patience-message';
  loaderMessageEl.style.cssText = `
    margin: 0 0 1.5rem 0;
    padding: clamp(0.75rem, 2vw, 1rem);
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3); display: inline-block; text-align: left;">
 ____  ____   __   __ _  ____     __   _  _  ____  __  ____ 
(  _ \\(  _ \\ / _\\ (  ( \\(    \\   / _\\ / )( \\(    \\(  )(_  _)
 ) _ ( )   //    \\/    / ) D (  /    \\) \\/ ( ) D ( )(   )(  
(____/(__\\_)\\_/\\_/\\_)__)(____/  \\_/\\_/\\____/(____/(__) (__)  </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: #00ff41; font-weight: 600; letter-spacing: 0.05em; padding: 0 0.5rem;">
      ${t('brandConsistency.analyzing', 'Analyzing brand consistency...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(0, 255, 65, 0.7); padding: 0 0.5rem;">
      ${t('common.mayTake', 'This may take 15-30 seconds')}
    </p>
  `;

  loader.start(getAnalysisSteps(isMultiPage), t('brandConsistency.loaderTitle', '🎨 BRAND ANALYSIS'), isMultiPage ? 60 : 25);
  
  // Insert patience message after loader content
  const loadingContainer = document.getElementById('loadingContainer');
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }
  
  try {
    loader.nextStep(1);
    
    const response = await fetch('/api/brand-consistency', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, multiPage: isMultiPage, maxPages })
    });
    
    loader.nextStep(2);
    loader.nextStep(3);
    loader.nextStep(4);
    
    if (!response.ok) throw new Error('Analysis failed');
    const data = await response.json();
    
    loader.nextStep(5);
    loader.nextStep(6);
    loader.complete();
    
    setTimeout(() => {
      displayResults(data);
      results.style.display = 'block';
    }, 500);
    
  } catch (error) {
    alert(`${t('common.error', 'Error')}: ${error.message}`);
    loader.complete();
  } finally {
    // Re-enable button
    btn.disabled = false;
    const buttonText = btn.querySelector('#buttonText') || btn;
    buttonText.textContent = t('common.runScan', 'Run scan');
    btn.style.opacity = '1';
    urlInput.disabled = false;
  }
}

function getScoreColor(score) {
  if (score >= 80) return '#00ff41';
  if (score >= 60) return '#ffd700';
  if (score >= 40) return '#ff8c00';
  return '#ff4444';
}

function getGradeColor(grade) {
  if (grade.startsWith('A')) return '#00ff41';
  if (grade.startsWith('B')) return '#ffd700';
  if (grade.startsWith('C')) return '#ff8c00';
  return '#ff4444';
}

function displayResults(data) {
  const results = document.getElementById('results');
  const score = data.score || 0;
  const isMultiPage = data.multiPage === true;
  
  // Multi-page badge
  const multiPageBadge = isMultiPage ? `
    <span style="display: inline-block; margin-left: 0.5rem; padding: 2px 8px; background: linear-gradient(135deg, #00ff41, #00cc33); color: #000; font-size: 0.65rem; border-radius: 3px; font-weight: 700; vertical-align: middle;">
      ${data.pagesAnalyzed} ${t('brandConsistency.pagesScanned', 'PAGES SCANNED')}
    </span>
  ` : '';
  
  // Score breakdown items for circular dials
  const breakdownItems = data.scoreBreakdown ? Object.entries(data.scoreBreakdown).slice(0, 3) : [];
  
  results.innerHTML = `
    <!-- Executive Summary Section (matches SEO page design) -->
    <div class="section">
      <h2>[BRAND_ANALYSIS_RESULTS]${multiPageBadge}</h2>
      <p>>> url: ${data.url}</p>
      ${isMultiPage ? `<p>>> mode: ${t('brandConsistency.multiPageAnalysis', 'Multi-page analysis')} (${data.pagesAnalyzed} pages)</p>` : ''}
      <p>>> timestamp: ${new Date(data.timestamp).toLocaleString()}</p>
      
      <!-- Enhanced Overall Score Display with SVG Circular Dials (matches SEO pattern) -->
      <div style="
        background: linear-gradient(135deg, rgba(0,255,65,0.05) 0%, rgba(0,255,65,0.02) 100%);
        border: 2px solid ${getScoreColor(score)};
        border-radius: 12px;
        padding: 2rem;
        margin: 2rem 0;
        box-shadow: 0 4px 20px rgba(0,255,65,0.15);
      ">
        <h3 style="color: #00ff41; margin: 0 0 1.5rem 0; font-size: 1.3rem;">>> ${t('brandConsistency.auditSummary', 'Brand Audit Summary')}</h3>
        
        <!-- Circular Progress Dials -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 2rem; margin: 2rem 0;">
          <!-- Overall Score -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff; font-size: 1.1rem;">${t('brandConsistency.overallScore', 'Overall Brand Score')}</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle
                cx="90"
                cy="90"
                r="75"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="10"
              />
              <circle
                cx="90"
                cy="90"
                r="75"
                fill="none"
                stroke="${getScoreColor(score)}"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray="${(score / 100) * 471.24} 471.24"
                transform="rotate(-90 90 90)"
              />
              <text
                x="90"
                y="90"
                text-anchor="middle"
                dy="0.35em"
                font-size="3.5rem"
                font-weight="bold"
                fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)"
                stroke-width="2.5"
                paint-order="stroke fill"
                style="text-shadow: 0 0 18px ${getScoreColor(score)}, 0 0 30px rgba(0,0,0,0.6);"
              >
                ${score}
              </text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor(score)}; font-weight: 600; font-size: 1.1rem;">
              ${t('brandConsistency.grade', 'Grade')}: ${data.grade}
            </div>
          </div>

          <!-- Color Palette Score -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">${t('brandConsistency.colorPalette', 'Color Palette')}</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
              <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor((data.scoreBreakdown?.colorPalette?.score || 50) * 3.33)}" stroke-width="10" stroke-linecap="round"
                stroke-dasharray="${((data.scoreBreakdown?.colorPalette?.score || 15) / 30) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
              <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill"
                style="text-shadow: 0 0 18px ${getScoreColor((data.scoreBreakdown?.colorPalette?.score || 50) * 3.33)}, 0 0 30px rgba(0,0,0,0.6);">
                ${data.scoreBreakdown?.colorPalette?.score || '-'}
              </text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor((data.scoreBreakdown?.colorPalette?.score || 50) * 3.33)}; font-weight: 600; font-size: 1.1rem;">
              ${data.scoreBreakdown?.colorPalette?.score || 0}/30
            </div>
          </div>

          <!-- Typography Score -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">${t('brandConsistency.typography', 'Typography')}</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
              <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor((data.scoreBreakdown?.typography?.score || 50) * 4)}" stroke-width="10" stroke-linecap="round"
                stroke-dasharray="${((data.scoreBreakdown?.typography?.score || 12) / 25) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
              <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill"
                style="text-shadow: 0 0 18px ${getScoreColor((data.scoreBreakdown?.typography?.score || 50) * 4)}, 0 0 30px rgba(0,0,0,0.6);">
                ${data.scoreBreakdown?.typography?.score || '-'}
              </text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor((data.scoreBreakdown?.typography?.score || 50) * 4)}; font-weight: 600; font-size: 1.1rem;">
              ${data.scoreBreakdown?.typography?.score || 0}/25
            </div>
          </div>

          <!-- Brand Identity Score -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">${t('brandConsistency.brandIdentity', 'Brand Identity')}</div>
            <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
              <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
              <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor((data.scoreBreakdown?.brandIdentity?.score || 50) * 5)}" stroke-width="10" stroke-linecap="round"
                stroke-dasharray="${((data.scoreBreakdown?.brandIdentity?.score || 10) / 20) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
              <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill"
                style="text-shadow: 0 0 18px ${getScoreColor((data.scoreBreakdown?.brandIdentity?.score || 50) * 5)}, 0 0 30px rgba(0,0,0,0.6);">
                ${data.scoreBreakdown?.brandIdentity?.score || '-'}
              </text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor((data.scoreBreakdown?.brandIdentity?.score || 50) * 5)}; font-weight: 600; font-size: 1.1rem;">
              ${data.scoreBreakdown?.brandIdentity?.score || 0}/20
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Score Breakdown -->
    ${data.scoreBreakdown ? generateScoreBreakdown(data.scoreBreakdown) : ''}
    
    <!-- Accordions Container -->
    <div id="accordions-container" style="margin-top: 2rem;"></div>
  `;
  
  // Store results globally for PDF generation
  window.currentBrandResults = data;
  
  // Create accordion sections
  const container = document.getElementById('accordions-container');
  
  // Color Palette Accordion (with export)
  createAccordionSection(container, 'color-palette', t('brandConsistency.colorPaletteAnalysis', 'Color Palette Analysis'), 
    () => renderColorPaletteContent(data), 
    data.colorAnalysis?.harmonyScore || 70);
  
  // Color Contrast Accessibility Accordion (NEW)
  if (data.contrastAnalysis) {
    createAccordionSection(container, 'color-contrast', t('brandConsistency.colorContrastAccessibility', 'Color Contrast Accessibility'), 
      () => renderColorContrastContent(data.contrastAnalysis), 
      data.contrastAnalysis.score || 50);
  }
  
  // Color Usage Breakdown Accordion (NEW)
  if (data.colorUsageAnalysis) {
    createAccordionSection(container, 'color-usage', t('brandConsistency.colorUsageBreakdown', 'Color Usage Breakdown'), 
      () => renderColorUsageContent(data.colorUsageAnalysis), 
      null);
  }
  
  // Typography Accordion
  createAccordionSection(container, 'typography', t('brandConsistency.typographyAnalysis', 'Typography Analysis'), 
    () => renderTypographyContent(data), 
    data.typographyAnalysis?.typographyScore || 50);
  
  // Visual Hierarchy Accordion (NEW)
  if (data.hierarchyAnalysis) {
    createAccordionSection(container, 'visual-hierarchy', t('brandConsistency.visualHierarchy', 'Visual Hierarchy'), 
      () => renderVisualHierarchyContent(data.hierarchyAnalysis), 
      data.hierarchyAnalysis.score || 50);
  }
  
  // Brand Identity Accordion
  createAccordionSection(container, 'brand-identity', t('brandConsistency.brandIdentity', 'Brand Identity'), 
    () => renderBrandIdentityContent(data), 
    (data.consistency.hasLogo ? 75 : 25) + (data.consistency.hasFavicon ? 25 : 0));
  
  // Brand Assets Accordion (NEW)
  if (data.brandElements?.brandAssets) {
    createAccordionSection(container, 'brand-assets', t('brandConsistency.brandAssets', 'Brand Assets (Meta Tags)'), 
      () => renderBrandAssetsContent(data.brandElements.brandAssets), 
      null);
  }
  
  // UI Consistency Accordion
  createAccordionSection(container, 'ui-consistency', t('brandConsistency.uiConsistency', 'UI Consistency'), 
    () => renderUIConsistencyContent(data), 
    data.consistency.buttonStyleConsistency === 'Excellent' ? 85 : 
    data.consistency.buttonStyleConsistency === 'Good' ? 70 : 50);
  
  // Cross-Page Consistency Accordion (Multi-Page Mode Only)
  if (data.multiPage && data.crossPageConsistency) {
    createAccordionSection(container, 'cross-page-consistency', t('brandConsistency.crossPageConsistency', 'Cross-Page Consistency'), 
      () => renderCrossPageConsistencyContent(data), 
      data.crossPageConsistency.score || 80,
      data.crossPageConsistency.issues?.length > 0); // Start expanded if there are issues
  }
  
  // Page Breakdown Accordion (Multi-Page Mode Only)
  if (data.multiPage && data.pageBreakdown && data.pageBreakdown.length > 1) {
    createAccordionSection(container, 'page-breakdown', t('brandConsistency.pageBreakdown', 'Per-Page Breakdown'), 
      () => renderPageBreakdownContent(data.pageBreakdown), 
      null);
  }
  
  // Competitive Brand Comparison (PRO) Accordion (NEW)
  createAccordionSection(container, 'competitive-comparison', t('brandConsistency.competitiveBrandComparison', 'Competitive Brand Comparison'), 
    () => renderCompetitiveComparisonContent(data), 
    null, false, true); // isPro = true
  
  // Recommendations Accordion (start expanded if there are issues)
  if (data.recommendations && data.recommendations.length > 0) {
    createAccordionSection(container, 'recommendations', t('brandConsistency.recommendations', 'Recommendations'), 
      () => renderRecommendationsContent(data.recommendations), 
      null, data.recommendations[0]?.priority === 'critical');
  }
}

// Translate status words
function translateStatus(status) {
  if (!status) return t('common.na', 'N/A');
  const statusMap = {
    'Excellent': t('brandConsistency.excellent', 'Excellent'),
    'Good': t('brandConsistency.good', 'Good'),
    'Fair': t('brandConsistency.fair', 'Fair'),
    'Poor': t('brandConsistency.poor', 'Poor'),
    'N/A': t('common.na', 'N/A')
  };
  return statusMap[status] || status;
}

function generateStatCard(label, value, sublabel) {
  const statusColor = getStatusColor(sublabel);
  return `
    <div class="stat-card" style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; text-align: center;">
      <div style="font-size: 1.5rem; font-weight: 600; color: #fff;">${value}</div>
      <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6); margin-top: 0.25rem;">${label}</div>
      <div style="font-size: 0.75rem; color: ${statusColor}; margin-top: 0.25rem;">${sublabel}</div>
    </div>
  `;
}

function getStatusColor(status) {
  if (!status) return 'rgba(255,255,255,0.5)';
  const s = status.toLowerCase();
  if (s === 'excellent' || s === 'detected' || s === 'present') return '#00ff41';
  if (s === 'good') return '#90EE90';
  if (s === 'fair') return '#ffd700';
  if (s === 'poor' || s === 'missing') return '#ff6b6b';
  return 'rgba(255,255,255,0.5)';
}

function generateScoreBreakdown(breakdown) {
  if (!breakdown) return '';
  
  // Translate breakdown category names
  const categoryNames = {
    colorPalette: t('brandConsistency.colorPalette', 'Color Palette'),
    typography: t('brandConsistency.typography', 'Typography'),
    brandIdentity: t('brandConsistency.brandIdentity', 'Brand Identity'),
    uiConsistency: t('brandConsistency.uiConsistency', 'UI Consistency'),
    colorHarmony: t('brandConsistency.colorHarmony', 'Color Harmony')
  };
  
  return `
    <div class="card" style="padding: 1.5rem; margin-bottom: 1.5rem;">
      <h3 style="margin: 0 0 1rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.scoreBreakdown', 'Score Breakdown')}</h3>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${Object.entries(breakdown).map(([key, item]) => `
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="flex: 1; min-width: 120px; color: rgba(255,255,255,0.8);">${categoryNames[key] || key.replace(/([A-Z])/g, ' $1').trim()}</div>
            <div style="flex: 2; background: rgba(255,255,255,0.1); border-radius: 4px; height: 8px; overflow: hidden;">
              <div style="width: ${(item.score / item.maxScore) * 100}%; height: 100%; background: ${getScoreColor((item.score / item.maxScore) * 100)}; border-radius: 4px;"></div>
            </div>
            <div style="min-width: 60px; text-align: right; color: ${getScoreColor((item.score / item.maxScore) * 100)}; font-weight: 500;">${item.score}/${item.maxScore}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function createAccordionSection(container, id, displayTitle, contentCreator, score, startExpanded = false, isPro = false) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  
  const proBadge = isPro ? `<span style="margin-left: 0.5rem; font-size: 0.65rem; padding: 0.2rem 0.5rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.05em;">PRO</span>` : '';
  
  const scoreDisplay = score !== null ? `
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      <span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${Math.round(score)}/100</span>
      <span class="accordion-toggle">▼</span>
    </span>
  ` : '<span class="accordion-toggle">▼</span>';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `<span>${displayTitle}${proBadge}</span>${scoreDisplay}`;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  content.style.cssText = 'max-height: 0; padding: 0; overflow: hidden; border-top: none; transition: max-height 0.3s ease, padding 0.3s ease;';
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  content.appendChild(contentInner);
  
  header.addEventListener('click', () => {
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
      content.classList.remove('expanded');
      header.classList.remove('active');
      header.querySelector('.accordion-toggle').textContent = '▼';
      content.style.maxHeight = '0';
      content.style.padding = '0';
      content.style.borderTop = 'none';
    } else {
      if (!contentInner.hasChildNodes()) {
        contentInner.innerHTML = contentCreator();
      }
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
      content.style.maxHeight = content.scrollHeight + 200 + 'px';
      content.style.padding = '1rem 1.25rem';
      content.style.borderTop = '1px solid #333';
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
  
  // Auto-expand if needed
  if (startExpanded) {
    setTimeout(() => header.click(), 100);
  }
}

function renderColorPaletteContent(data) {
  const colors = data.brandElements?.colors || [];
  const colorAnalysis = data.colorAnalysis || {};
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.colorHarmony', 'Color Harmony')}</h4>
      <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
        <div>
          <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.harmonyType', 'Harmony Type')}:</span>
          <span style="color: #fff; margin-left: 0.5rem; text-transform: capitalize;">${translateHarmonyType(colorAnalysis.harmonyType)}</span>
        </div>
        <div>
          <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.uniqueHues', 'Unique Hues')}:</span>
          <span style="color: #fff; margin-left: 0.5rem;">${colorAnalysis.uniqueHueCount || '—'}</span>
        </div>
        <div>
          <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.neutralRatio', 'Neutral Ratio')}:</span>
          <span style="color: #fff; margin-left: 0.5rem;">${colorAnalysis.neutralRatio || 0}%</span>
        </div>
      </div>
    </div>
    
    ${colorAnalysis.primaryColors?.length > 0 ? `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.primaryBrandColors', 'Primary Brand Colors')}</h4>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${colorAnalysis.primaryColors.map(color => `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
              <div style="background: ${color}; width: 60px; height: 60px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.2);"></div>
              <span style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">${formatColor(color)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div>
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.allDetectedColors', 'All Detected Colors')} (${colors.length})</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; max-height: 200px; overflow-y: auto;">
        ${colors.slice(0, 40).map(color => `
          <div style="background: ${color}; width: 32px; height: 32px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;" title="${formatColor(color)}" onclick="copyToClipboard('${color}', this)"></div>
        `).join('')}
        ${colors.length > 40 ? `<div style="display: flex; align-items: center; color: rgba(255,255,255,0.5); font-size: 0.8rem; padding: 0 0.5rem;">+${colors.length - 40} ${t('common.more', 'more')}</div>` : ''}
      </div>
      <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: rgba(255,255,255,0.4);">${t('brandConsistency.clickToCopy', 'Click a color to copy its value')}</p>
    </div>
    
    <!-- Export Color Palette -->
    <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.exportColorPalette', 'Export Color Palette')}</h4>
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
        <button onclick="copyToClipboard(\`${generateCSSVariables(colorAnalysis.primaryColors || colors.slice(0, 5)).replace(/`/g, '\\`')}\`, this)" 
          style="padding: 0.5rem 1rem; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 4px; color: #00ff41; cursor: pointer; font-size: 0.8rem;">
          ${t('brandConsistency.exportCSS', 'Copy CSS Variables')}
        </button>
        <button onclick="copyToClipboard(\`${generateTailwindConfig(colorAnalysis.primaryColors || colors.slice(0, 5)).replace(/`/g, '\\`')}\`, this)" 
          style="padding: 0.5rem 1rem; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 4px; color: #00ff41; cursor: pointer; font-size: 0.8rem;">
          ${t('brandConsistency.exportTailwind', 'Copy Tailwind Config')}
        </button>
        <button onclick="copyToClipboard(\`${generateDesignTokens(colorAnalysis.primaryColors || colors.slice(0, 5)).replace(/`/g, '\\`')}\`, this)" 
          style="padding: 0.5rem 1rem; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 4px; color: #00ff41; cursor: pointer; font-size: 0.8rem;">
          ${t('brandConsistency.exportTokens', 'Copy Design Tokens')}
        </button>
      </div>
    </div>
  `;
}

// Translate harmony type
function translateHarmonyType(type) {
  if (!type) return t('common.unknown', 'Unknown');
  const harmonyMap = {
    'monochromatic': t('brandConsistency.harmony.monochromatic', 'Monochromatic'),
    'analogous': t('brandConsistency.harmony.analogous', 'Analogous'),
    'triadic': t('brandConsistency.harmony.triadic', 'Triadic'),
    'split-complementary': t('brandConsistency.harmony.splitComplementary', 'Split-Complementary'),
    'complementary': t('brandConsistency.harmony.complementary', 'Complementary'),
    'diverse': t('brandConsistency.harmony.diverse', 'Diverse'),
    'custom': t('brandConsistency.harmony.custom', 'Custom')
  };
  return harmonyMap[type] || type;
}

function formatColor(colorStr) {
  if (colorStr.startsWith('rgb')) {
    return colorStr;
  }
  return colorStr;
}

function renderTypographyContent(data) {
  const fonts = data.brandElements?.fonts || [];
  const typography = data.typographyAnalysis || {};
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.typographySummary', 'Typography Summary')}</h4>
      <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
        <div>
          <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.totalFonts', 'Total Fonts')}:</span>
          <span style="color: #fff; margin-left: 0.5rem;">${typography.fontCount || fonts.length}</span>
        </div>
        <div>
          <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.quality', 'Quality')}:</span>
          <span style="color: ${getStatusColor(typography.fontQuality)}; margin-left: 0.5rem; text-transform: capitalize;">${translateStatus(typography.fontQuality)}</span>
        </div>
        <div>
          <span style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.typographyHierarchy', 'Typography Hierarchy')}:</span>
          <span style="color: ${typography.hasTypographyHierarchy ? '#00ff41' : '#ff6b6b'}; margin-left: 0.5rem;">${typography.hasTypographyHierarchy ? t('common.yes', 'Yes') : t('common.no', 'No')}</span>
        </div>
      </div>
    </div>
    
    ${typography.headingFonts?.length > 0 ? `
      <div style="margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.headingFonts', 'Heading Fonts')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${typography.headingFonts.map(font => `
            <span style="background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-family: ${font}; color: #fff;">${font}</span>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${typography.bodyFonts?.length > 0 ? `
      <div style="margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.bodyFonts', 'Body Fonts')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${typography.bodyFonts.map(font => `
            <span style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); padding: 0.4rem 0.8rem; border-radius: 4px; font-family: ${font}; color: #fff;">${font}</span>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div>
      <h4 style="margin: 0 0 0.5rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.allFontsByUsage', 'All Fonts by Usage')}</h4>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${fonts.slice(0, 10).map(f => `
          <div style="display: flex; align-items: center; gap: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 4px;">
            <span style="flex: 1; font-family: ${f.font}; color: #fff;">${f.font}</span>
            <span style="color: rgba(255,255,255,0.5); font-size: 0.8rem;">${f.count} ${t('brandConsistency.uses', 'uses')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderBrandIdentityContent(data) {
  const logos = data.brandElements?.logos || [];
  const hasFavicon = data.consistency?.hasFavicon;
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.logoDetection', 'Logo Detection')}</h4>
      ${logos.length > 0 ? `
        <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
          ${logos.map((logo, i) => `
            <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; text-align: center;">
              ${logo.type === 'img' && logo.src && logo.src !== 'SVG inline' ? `
                <img src="${logo.src}" alt="${logo.alt || 'Logo'}" style="max-width: 150px; max-height: 80px; object-fit: contain; background: #fff; padding: 0.5rem; border-radius: 4px;" onerror="this.style.display='none'"/>
              ` : `
                <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.1); border-radius: 4px; display: flex; align-items: center; justify-content: center; color: rgba(255,255,255,0.5);">
                  ${logo.type === 'svg' ? 'SVG' : 'IMG'}
                </div>
              `}
              <div style="margin-top: 0.5rem; font-size: 0.75rem; color: rgba(255,255,255,0.5);">
                ${logo.width || '?'}×${logo.height || '?'}px
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="padding: 1.5rem; background: rgba(255,100,100,0.1); border: 1px solid rgba(255,100,100,0.3); border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
          <div style="color: #ff6b6b; font-weight: 500;">${t('brandConsistency.noLogoDetected', 'No logo detected')}</div>
          <div style="color: rgba(255,255,255,0.5); font-size: 0.85rem; margin-top: 0.5rem;">${t('brandConsistency.addLogoTip', 'Add a logo with alt text containing "logo" for better brand recognition')}</div>
        </div>
      `}
    </div>
    
    <div>
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.favicon', 'Favicon')}</h4>
      <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <div style="width: 48px; height: 48px; background: ${hasFavicon ? 'rgba(0,255,65,0.1)' : 'rgba(255,100,100,0.1)'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
          ${hasFavicon ? '✓' : '✗'}
        </div>
        <div>
          <div style="color: #fff; font-weight: 500;">${hasFavicon ? t('brandConsistency.faviconPresent', 'Favicon Present') : t('brandConsistency.faviconMissing', 'Favicon Missing')}</div>
          <div style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">
            ${hasFavicon ? t('brandConsistency.faviconPresentDesc', 'Your site has a favicon for browser tab identification') : t('brandConsistency.faviconMissingDesc', 'Add a favicon to help users identify your site in browser tabs')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderUIConsistencyContent(data) {
  const buttonStyles = data.brandElements?.buttonStyles || [];
  const linkColors = data.brandElements?.linkColors || [];
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.buttonStyles', 'Button Styles')}</h4>
      <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <div style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: rgba(255,255,255,0.5);">${t('brandConsistency.consistency', 'Consistency')}:</span>
          <span style="color: ${getStatusColor(data.consistency?.buttonStyleConsistency)}; font-weight: 500;">${translateStatus(data.consistency?.buttonStyleConsistency)}</span>
        </div>
        ${buttonStyles.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
            ${buttonStyles.slice(0, 6).map(btn => `
              <div style="background: ${btn.backgroundColor}; color: ${btn.color}; padding: 0.5rem 1rem; border-radius: ${btn.borderRadius}; font-family: ${btn.fontFamily}; font-size: ${btn.fontSize};">
                ${t('brandConsistency.sampleButton', 'Sample Button')}
              </div>
            `).join('')}
          </div>
        ` : `<p style="color: rgba(255,255,255,0.5); margin: 0;">${t('brandConsistency.noButtonStyles', 'No button styles detected')}</p>`}
      </div>
    </div>
    
    <div>
      <h4 style="margin: 0 0 0.75rem 0; color: #00ff41; font-family: monospace; font-size: 0.85rem;">>> ${t('brandConsistency.linkColors', 'Link Colors')}</h4>
      <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <div style="margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: rgba(255,255,255,0.5);">${t('brandConsistency.consistency', 'Consistency')}:</span>
          <span style="color: ${getStatusColor(data.consistency?.linkColorConsistency)}; font-weight: 500;">${translateStatus(data.consistency?.linkColorConsistency)}</span>
        </div>
        ${linkColors.length > 0 ? `
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${[...new Set(linkColors)].map(color => `
              <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.05); padding: 0.5rem 0.75rem; border-radius: 4px;">
                <div style="width: 20px; height: 20px; background: ${color}; border-radius: 4px;"></div>
                <span style="color: ${color}; font-size: 0.85rem;">${t('brandConsistency.linkText', 'Link Text')}</span>
              </div>
            `).join('')}
          </div>
        ` : `<p style="color: rgba(255,255,255,0.5); margin: 0;">${t('brandConsistency.noLinkColors', 'No link colors detected')}</p>`}
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `<p style="color: rgba(255,255,255,0.5);">${t('brandConsistency.noRecommendations', 'No recommendations at this time.')}</p>`;
  }
  
  const priorityColors = {
    critical: '#ff4444',
    high: '#ff8c00',
    medium: '#ffd700',
    low: '#90EE90',
    success: '#00ff41'
  };
  
  const priorityIcons = {
    critical: '🚨',
    high: '⚠️',
    medium: '💡',
    low: 'ℹ️',
    success: '✅'
  };
  
  // Translate priority labels
  const priorityLabels = {
    critical: t('brandConsistency.priority.critical', 'Critical'),
    high: t('brandConsistency.priority.high', 'High'),
    medium: t('brandConsistency.priority.medium', 'Medium'),
    low: t('brandConsistency.priority.low', 'Low'),
    success: t('brandConsistency.priority.success', 'Success')
  };
  
  // Get translated recommendation content based on type
  function getRecommendationContent(rec) {
    const type = rec.type;
    const params = rec.params || {};
    
    // Recommendation translations by type
    const recTranslations = {
      excessiveColors: {
        message: t('brandConsistency.rec.excessiveColors.message', 'Excessive color usage'),
        detail: t('brandConsistency.rec.excessiveColors.detail', `Using ${params.count} colors creates visual chaos. Professional brands use 5-10 colors maximum.`).replace('{count}', params.count),
        action: t('brandConsistency.rec.excessiveColors.action', 'Create a defined color palette with primary, secondary, and accent colors.')
      },
      tooManyColors: {
        message: t('brandConsistency.rec.tooManyColors.message', 'Too many colors'),
        detail: t('brandConsistency.rec.tooManyColors.detail', `Using ${params.count} colors. Streamline to 8-12 brand colors for better consistency.`).replace('{count}', params.count),
        action: t('brandConsistency.rec.tooManyColors.action', 'Audit your color usage and remove redundant variations.')
      },
      inconsistentHarmony: {
        message: t('brandConsistency.rec.inconsistentHarmony.message', 'Inconsistent color harmony'),
        detail: t('brandConsistency.rec.inconsistentHarmony.detail', 'Your color palette lacks a clear harmony pattern (complementary, analogous, or triadic).'),
        action: t('brandConsistency.rec.inconsistentHarmony.action', 'Use a color wheel to select harmonious colors that work together.')
      },
      tooManyFonts: {
        message: t('brandConsistency.rec.tooManyFonts.message', 'Too many fonts'),
        detail: t('brandConsistency.rec.tooManyFonts.detail', `Using ${params.count} different fonts creates visual inconsistency and hurts performance.`).replace('{count}', params.count),
        action: t('brandConsistency.rec.tooManyFonts.action', 'Limit to 2-3 font families: one for headings, one for body text, and optionally one for accents.')
      },
      reduceFontCount: {
        message: t('brandConsistency.rec.reduceFontCount.message', 'Consider reducing font count'),
        detail: t('brandConsistency.rec.reduceFontCount.detail', `Using ${params.count} fonts. Best practice is 2-3 fonts maximum.`).replace('{count}', params.count),
        action: t('brandConsistency.rec.reduceFontCount.action', 'Review font usage and consolidate where possible.')
      },
      noTypographyHierarchy: {
        message: t('brandConsistency.rec.noTypographyHierarchy.message', 'Typography hierarchy not detected'),
        detail: t('brandConsistency.rec.noTypographyHierarchy.detail', 'Could not identify distinct heading and body fonts.'),
        action: t('brandConsistency.rec.noTypographyHierarchy.action', 'Ensure headings and body text use consistent, distinct font treatments.')
      },
      noLogo: {
        message: t('brandConsistency.rec.noLogo.message', 'No logo detected'),
        detail: t('brandConsistency.rec.noLogo.detail', 'A logo is essential for brand recognition and trust.'),
        action: t('brandConsistency.rec.noLogo.action', 'Add a logo in the header with proper alt text containing "logo".')
      },
      noFavicon: {
        message: t('brandConsistency.rec.noFavicon.message', 'No favicon detected'),
        detail: t('brandConsistency.rec.noFavicon.detail', 'A favicon helps users identify your site in browser tabs and bookmarks.'),
        action: t('brandConsistency.rec.noFavicon.action', 'Add a favicon.ico or use <link rel="icon"> with your brand icon.')
      },
      inconsistentButtons: {
        message: t('brandConsistency.rec.inconsistentButtons.message', 'Inconsistent button styles'),
        detail: t('brandConsistency.rec.inconsistentButtons.detail', 'Buttons across your site have varying colors and shapes.'),
        action: t('brandConsistency.rec.inconsistentButtons.action', 'Define standard button styles in your CSS and use them consistently.')
      },
      inconsistentLinks: {
        message: t('brandConsistency.rec.inconsistentLinks.message', 'Inconsistent link colors'),
        detail: t('brandConsistency.rec.inconsistentLinks.detail', 'Links use multiple different colors across the page.'),
        action: t('brandConsistency.rec.inconsistentLinks.action', 'Set a consistent link color that matches your brand palette.')
      },
      poorContrast: {
        message: t('brandConsistency.rec.poorContrast.message', 'Poor color contrast accessibility'),
        detail: t('brandConsistency.rec.poorContrast.detail', `Only ${rec.params?.complianceRate || 0}% of text/background combinations meet WCAG AA standards.`),
        action: t('brandConsistency.rec.poorContrast.action', 'Review and fix color combinations to ensure a minimum 4.5:1 contrast ratio for text.')
      },
      lowContrast: {
        message: t('brandConsistency.rec.lowContrast.message', 'Low color contrast detected'),
        detail: t('brandConsistency.rec.lowContrast.detail', `${rec.params?.failCount || 0} text elements fail WCAG AA contrast requirements.`),
        action: t('brandConsistency.rec.lowContrast.action', 'Increase contrast between text and background colors for better readability.')
      },
      headingSizeNotProgressive: {
        message: t('brandConsistency.rec.headingSizeNotProgressive.message', 'Heading sizes not progressive'),
        detail: t('brandConsistency.rec.headingSizeNotProgressive.detail', `${rec.params?.from} (${rec.params?.fromSize}) is not larger than ${rec.params?.to} (${rec.params?.toSize}).`),
        action: t('brandConsistency.rec.headingSizeNotProgressive.action', 'Ensure headings decrease in size from h1 to h6 for clear visual hierarchy.')
      },
      h1TooSmall: {
        message: t('brandConsistency.rec.h1TooSmall.message', 'H1 heading may be too small'),
        detail: t('brandConsistency.rec.h1TooSmall.detail', `H1 is only ${rec.params?.ratio}x larger than body text. Aim for 2-3x.`),
        action: t('brandConsistency.rec.h1TooSmall.action', 'Increase h1 font size for better visual hierarchy.')
      },
      inconsistentHeadingFonts: {
        message: t('brandConsistency.rec.inconsistentHeadingFonts.message', 'Inconsistent heading fonts'),
        detail: t('brandConsistency.rec.inconsistentHeadingFonts.detail', `Using ${rec.params?.count} different fonts across headings.`),
        action: t('brandConsistency.rec.inconsistentHeadingFonts.action', 'Use a consistent font family for all headings.')
      },
      noOgImage: {
        message: t('brandConsistency.rec.noOgImage.message', 'Missing Open Graph image'),
        detail: t('brandConsistency.rec.noOgImage.detail', 'No og:image meta tag found. Social shares will lack a preview image.'),
        action: t('brandConsistency.rec.noOgImage.action', 'Add <meta property="og:image" content="your-image-url"> to your page.')
      },
      noTwitterCard: {
        message: t('brandConsistency.rec.noTwitterCard.message', 'Missing Twitter Card meta tags'),
        detail: t('brandConsistency.rec.noTwitterCard.detail', 'No Twitter card metadata found. Twitter shares may look incomplete.'),
        action: t('brandConsistency.rec.noTwitterCard.action', 'Add Twitter card meta tags for better social sharing.')
      },
      noAppleTouchIcon: {
        message: t('brandConsistency.rec.noAppleTouchIcon.message', 'Missing Apple Touch Icon'),
        detail: t('brandConsistency.rec.noAppleTouchIcon.detail', 'No apple-touch-icon found. iOS home screen bookmarks will use a screenshot.'),
        action: t('brandConsistency.rec.noAppleTouchIcon.action', 'Add <link rel="apple-touch-icon" href="icon.png"> for iOS devices.')
      },
      // Cross-page consistency recommendations
      fontVariationAcrossPages: {
        message: t('brandConsistency.rec.fontVariationAcrossPages.message', 'Font inconsistency across pages'),
        detail: t('brandConsistency.rec.fontVariationAcrossPages.detail', `${params.count} fonts appear on some pages but not others: ${params.fonts}`),
        action: t('brandConsistency.rec.fontVariationAcrossPages.action', 'Ensure all pages use the same font families from your brand guidelines.')
      },
      colorVariationAcrossPages: {
        message: t('brandConsistency.rec.colorVariationAcrossPages.message', 'Color inconsistency across pages'),
        detail: t('brandConsistency.rec.colorVariationAcrossPages.detail', `${params.count} colors vary between the ${params.pages} pages analyzed.`),
        action: t('brandConsistency.rec.colorVariationAcrossPages.action', 'Create a centralized color palette and apply it consistently across all pages.')
      },
      poorCrossPageConsistency: {
        message: t('brandConsistency.rec.poorCrossPageConsistency.message', 'Poor cross-page brand consistency'),
        detail: t('brandConsistency.rec.poorCrossPageConsistency.detail', `Only ${params.score}% consistency between pages. Brand elements vary significantly.`),
        action: t('brandConsistency.rec.poorCrossPageConsistency.action', 'Implement a design system or style guide to maintain consistency across all pages.')
      },
      lowCrossPageConsistency: {
        message: t('brandConsistency.rec.lowCrossPageConsistency.message', 'Low cross-page consistency'),
        detail: t('brandConsistency.rec.lowCrossPageConsistency.detail', `${params.score}% consistency between pages. Some brand elements vary.`),
        action: t('brandConsistency.rec.lowCrossPageConsistency.action', 'Review pages with variations and align them with your main brand palette.')
      },
      pagesWithUniqueElements: {
        message: t('brandConsistency.rec.pagesWithUniqueElements.message', 'Pages with unique brand elements'),
        detail: t('brandConsistency.rec.pagesWithUniqueElements.detail', `${params.count} page(s) use colors or fonts not found elsewhere: ${params.pages}`),
        action: t('brandConsistency.rec.pagesWithUniqueElements.action', 'Review these pages for intentional variations or consolidate with main brand.')
      },
      excellent: {
        message: t('brandConsistency.rec.excellent.message', 'Excellent brand consistency!'),
        detail: t('brandConsistency.rec.excellent.detail', 'Your website maintains strong visual consistency across colors, typography, and branding elements.'),
        action: t('brandConsistency.rec.excellent.action', 'Continue maintaining your brand guidelines and conduct periodic audits.')
      }
    };
    
    // Return translated content or fallback to legacy format
    return recTranslations[type] || {
      message: rec.message || type,
      detail: rec.detail || '',
      action: rec.action || ''
    };
  }
  
  return recommendations.map(rec => {
    const content = getRecommendationContent(rec);
    return `
    <div style="padding: 1rem; margin-bottom: 0.75rem; background: ${rec.priority === 'success' ? 'rgba(0,255,65,0.1)' : 'rgba(255,255,255,0.03)'}; border-left: 4px solid ${priorityColors[rec.priority] || '#888'}; border-radius: 0 8px 8px 0;">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
        <span style="font-size: 1.2rem;">${priorityIcons[rec.priority] || '•'}</span>
        <h4 style="margin: 0; color: #fff; font-weight: 600;">${content.message}</h4>
        <span style="margin-left: auto; font-size: 0.7rem; padding: 0.2rem 0.5rem; background: ${priorityColors[rec.priority]}30; color: ${priorityColors[rec.priority]}; border-radius: 4px; text-transform: uppercase;">${priorityLabels[rec.priority] || rec.priority}</span>
      </div>
      <p style="margin: 0 0 0.5rem 1.7rem; color: rgba(255,255,255,0.7); font-size: 0.9rem;">${content.detail}</p>
      ${content.action ? `<p style="margin: 0 0 0 1.7rem; color: rgba(0,255,65,0.8); font-size: 0.85rem;">→ ${content.action}</p>` : ''}
    </div>
  `}).join('');
}

// Color Contrast Accessibility Content
function renderColorContrastContent(contrastAnalysis) {
  const { pairs, summary } = contrastAnalysis;
  
  const getContrastBadge = (level) => {
    if (level === 'AAA') return '<span style="background: #00ff41; color: #000; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem; font-weight: 600;">AAA</span>';
    if (level === 'AA') return '<span style="background: #90EE90; color: #000; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem; font-weight: 600;">AA</span>';
    return '<span style="background: #ff6b6b; color: #fff; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem; font-weight: 600;">FAIL</span>';
  };
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.wcagCompliance', 'WCAG Compliance Summary')}</h4>
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;">
        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #fff;">${summary.total}</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">${t('brandConsistency.pairsTested', 'Pairs Tested')}</div>
        </div>
        <div style="background: rgba(0,255,65,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #00ff41;">${summary.passAAA}</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">${t('brandConsistency.passAAA', 'Pass AAA')}</div>
        </div>
        <div style="background: rgba(144,238,144,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #90EE90;">${summary.passAA - summary.passAAA}</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">${t('brandConsistency.passAA', 'Pass AA Only')}</div>
        </div>
        <div style="background: rgba(255,107,107,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: 600; color: #ff6b6b;">${summary.failAA}</div>
          <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5);">${t('brandConsistency.fail', 'Fail')}</div>
        </div>
      </div>
      <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <span style="color: rgba(255,255,255,0.6);">${t('brandConsistency.complianceRate', 'Compliance Rate')}:</span>
        <span style="color: ${getScoreColor(summary.complianceRate)}; font-weight: 600; margin-left: 0.5rem;">${summary.complianceRate}%</span>
      </div>
    </div>
    
    ${pairs.length > 0 ? `
      <div>
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.samplePairs', 'Sample Color Pairs')}</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${pairs.map(pair => `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
              <div style="display: flex; gap: 0.25rem;">
                <div style="width: 30px; height: 30px; background: ${pair.bgColor}; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);"></div>
                <div style="width: 30px; height: 30px; background: ${pair.textColor}; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2);"></div>
              </div>
              <div style="flex: 1; font-size: 0.85rem; color: rgba(255,255,255,0.7);">&lt;${pair.element}&gt;</div>
              <div style="color: ${pair.passAA ? '#00ff41' : '#ff6b6b'}; font-weight: 500;">${pair.ratio}:1</div>
              ${getContrastBadge(pair.level)}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// Color Usage Breakdown Content
function renderColorUsageContent(colorUsageAnalysis) {
  const { distribution, topColors, uniqueColors } = colorUsageAnalysis;
  
  const categoryLabels = {
    text: t('brandConsistency.textColors', 'Text Colors'),
    background: t('brandConsistency.backgroundColors', 'Background Colors'),
    border: t('brandConsistency.borderColors', 'Border Colors'),
    accent: t('brandConsistency.accentColors', 'Accent Colors')
  };
  
  const categoryColors = {
    text: '#00ff41',
    background: '#667eea',
    border: '#ffd700',
    accent: '#ff6b6b'
  };
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.colorDistribution', 'Color Distribution')}</h4>
      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${Object.entries(distribution).map(([key, data]) => `
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="min-width: 120px; color: rgba(255,255,255,0.8);">${categoryLabels[key]}</div>
            <div style="flex: 1; background: rgba(255,255,255,0.1); border-radius: 4px; height: 20px; overflow: hidden; position: relative;">
              <div style="width: ${data.percentage}%; height: 100%; background: ${categoryColors[key]}; border-radius: 4px;"></div>
              <span style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); font-size: 0.75rem; color: #fff;">${data.percentage}%</span>
            </div>
            <div style="min-width: 80px; text-align: right; color: rgba(255,255,255,0.6); font-size: 0.85rem;">${data.count} ${t('common.unique', 'unique')}</div>
          </div>
        `).join('')}
      </div>
    </div>
    
    <div>
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.topColorsByCategory', 'Top Colors by Category')}</h4>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
        ${Object.entries(topColors).map(([key, colors]) => colors.length > 0 ? `
          <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px;">
            <div style="font-size: 0.85rem; color: ${categoryColors[key]}; margin-bottom: 0.5rem; font-weight: 500;">${categoryLabels[key]}</div>
            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
              ${colors.slice(0, 5).map(c => `
                <div style="display: flex; align-items: center; gap: 0.25rem; background: rgba(255,255,255,0.05); padding: 0.25rem 0.5rem; border-radius: 4px;">
                  <div style="width: 16px; height: 16px; background: ${c.color}; border-radius: 3px; border: 1px solid rgba(255,255,255,0.2);"></div>
                  <span style="font-size: 0.7rem; color: rgba(255,255,255,0.5);">${c.count}x</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '').join('')}
      </div>
    </div>
  `;
}

// Visual Hierarchy Content
function renderVisualHierarchyContent(hierarchyAnalysis) {
  const { headings, bodyStyle, isProgressive, typeScale, issues, score } = hierarchyAnalysis;
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.headingProgression', 'Heading Size Progression')}</h4>
      ${isProgressive ? 
        `<div style="padding: 0.75rem; background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); border-radius: 6px; color: #00ff41;">
          ${t('brandConsistency.progressiveHeadings', 'Headings are properly sized in descending order')}
        </div>` : 
        `<div style="padding: 0.75rem; background: rgba(255,107,107,0.1); border: 1px solid rgba(255,107,107,0.3); border-radius: 6px; color: #ff6b6b;">
          ${t('brandConsistency.nonProgressiveHeadings', 'Heading sizes do not follow a clear hierarchy')}
        </div>`
      }
    </div>
    
    ${headings && headings.length > 0 ? `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.headingSizes', 'Heading Sizes')}</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${headings.map(h => `
            <div style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
              <span style="font-size: ${h.fontSizeUnit}; font-weight: ${h.fontWeight}; color: #fff; min-width: 40px;">${h.tag.toUpperCase()}</span>
              <div style="flex: 1; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div style="width: ${Math.min(h.fontSize / 48 * 100, 100)}%; height: 100%; background: #00ff41;"></div>
              </div>
              <span style="color: rgba(255,255,255,0.6); font-size: 0.85rem; min-width: 60px;">${h.fontSizeUnit}</span>
              <span style="color: rgba(255,255,255,0.4); font-size: 0.75rem;">${h.count}x</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${typeScale && typeScale.length > 0 ? `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.typeScale', 'Type Scale Ratios')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${typeScale.map(s => `
            <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 0.75rem; border-radius: 4px; font-size: 0.85rem;">
              <span style="color: rgba(255,255,255,0.6);">${s.from}/${s.to}:</span>
              <span style="color: ${s.ratio >= 1.2 && s.ratio <= 1.5 ? '#00ff41' : '#ffd700'}; margin-left: 0.25rem; font-weight: 500;">${s.ratio}</span>
            </div>
          `).join('')}
        </div>
        <p style="margin: 0.5rem 0 0 0; font-size: 0.75rem; color: rgba(255,255,255,0.4);">${t('brandConsistency.idealRatio', 'Ideal ratio: 1.2-1.5 (modular scale)')}</p>
      </div>
    ` : ''}
    
    ${bodyStyle ? `
      <div>
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.bodyText', 'Body Text')}</h4>
        <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
          <div><span style="color: rgba(255,255,255,0.5);">${t('brandConsistency.fontSize', 'Font Size')}:</span> <span style="color: #fff;">${bodyStyle.fontSize}</span></div>
          <div><span style="color: rgba(255,255,255,0.5);">${t('brandConsistency.lineHeight', 'Line Height')}:</span> <span style="color: #fff;">${bodyStyle.lineHeight}</span></div>
          <div><span style="color: rgba(255,255,255,0.5);">${t('brandConsistency.font', 'Font')}:</span> <span style="color: #fff;">${bodyStyle.fontFamily}</span></div>
        </div>
      </div>
    ` : ''}
  `;
}

// Brand Assets Content
function renderBrandAssetsContent(brandAssets) {
  const assetItems = [
    { key: 'ogImage', label: 'Open Graph Image', icon: '📷' },
    { key: 'ogTitle', label: 'Open Graph Title', icon: '📝' },
    { key: 'ogDescription', label: 'Open Graph Description', icon: '📄' },
    { key: 'twitterImage', label: 'Twitter Card Image', icon: '🐦' },
    { key: 'twitterCard', label: 'Twitter Card Type', icon: '🃏' },
    { key: 'appleTouchIcon', label: 'Apple Touch Icon', icon: '🍎' },
    { key: 'themeColor', label: 'Theme Color', icon: '🎨' },
    { key: 'maskIcon', label: 'Safari Mask Icon', icon: '🦁' },
    { key: 'msapplicationTileImage', label: 'MS Tile Image', icon: '🪟' }
  ];
  
  const presentCount = assetItems.filter(item => brandAssets[item.key]).length;
  const totalAssets = assetItems.length;
  const completeness = Math.round((presentCount / totalAssets) * 100);
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.metaTagCompleteness', 'Meta Tag Completeness')}</h4>
      <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <div style="flex: 1; background: rgba(255,255,255,0.1); border-radius: 4px; height: 12px; overflow: hidden;">
          <div style="width: ${completeness}%; height: 100%; background: ${getScoreColor(completeness)}; border-radius: 4px;"></div>
        </div>
        <span style="color: ${getScoreColor(completeness)}; font-weight: 600;">${presentCount}/${totalAssets}</span>
      </div>
    </div>
    
    <div>
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.assetDetails', 'Asset Details')}</h4>
      <div style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${assetItems.map(item => `
          <div style="display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
            <span style="font-size: 1.2rem;">${item.icon}</span>
            <span style="flex: 1; color: rgba(255,255,255,0.8);">${item.label}</span>
            ${brandAssets[item.key] ? `
              <span style="color: #00ff41; font-size: 0.85rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${brandAssets[item.key]}">
                ${item.key === 'themeColor' ? 
                  `<span style="display: inline-block; width: 16px; height: 16px; background: ${brandAssets[item.key]}; border-radius: 3px; vertical-align: middle; margin-right: 0.25rem;"></span>` : 
                  ''
                }${brandAssets[item.key].length > 30 ? brandAssets[item.key].substring(0, 30) + '...' : brandAssets[item.key]}
              </span>
              <span style="color: #00ff41;">✓</span>
            ` : `
              <span style="color: rgba(255,255,255,0.4);">${t('brandConsistency.notSet', 'Not set')}</span>
              <span style="color: #ff6b6b;">✗</span>
            `}
          </div>
        `).join('')}
      </div>
    </div>
    
    ${brandAssets.ogImage ? `
      <div style="margin-top: 1.5rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.ogImagePreview', 'Open Graph Image Preview')}</h4>
        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; text-align: center;">
          <img src="${brandAssets.ogImage}" alt="OG Image" style="max-width: 100%; max-height: 200px; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <p style="display: none; color: rgba(255,255,255,0.5); margin: 0;">${t('brandConsistency.imageLoadFailed', 'Could not load image preview')}</p>
        </div>
      </div>
    ` : ''}
  `;
}

// Competitive Brand Comparison Content (PRO Feature)
function renderCompetitiveComparisonContent(data) {
  return `
    <div style="text-align: center; padding: 2rem;">
      <div style="width: 80px; height: 80px; margin: 0 auto 1rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
      </div>
      <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 1.2rem;">${t('brandConsistency.competitiveAnalysis', 'Competitive Brand Analysis')}</h3>
      <p style="color: rgba(255,255,255,0.6); margin: 0 0 1.5rem 0; font-size: 0.9rem;">
        ${t('brandConsistency.competitiveDesc', 'Compare your brand consistency against competitors. Analyze color palettes, typography, and visual identity side-by-side.')}
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; text-align: left;">
        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px;">
          <div style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">${t('brandConsistency.feature1', 'Side-by-Side Comparison')}</div>
          <div style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.feature1Desc', 'Compare up to 5 competitor sites')}</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px;">
          <div style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">${t('brandConsistency.feature2', 'Visual Similarity Score')}</div>
          <div style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.feature2Desc', 'See how your brand stacks up')}</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px;">
          <div style="color: #667eea; font-weight: 600; margin-bottom: 0.5rem;">${t('brandConsistency.feature3', 'Export Reports')}</div>
          <div style="color: rgba(255,255,255,0.5); font-size: 0.85rem;">${t('brandConsistency.feature3Desc', 'Client-ready PDF comparisons')}</div>
        </div>
      </div>
      
      <button style="padding: 0.75rem 2rem; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer; font-size: 1rem;">
        ${t('brandConsistency.upgradeToPro', 'Upgrade to Pro')}
      </button>
      <p style="margin: 0.75rem 0 0 0; color: rgba(255,255,255,0.4); font-size: 0.8rem;">
        ${t('brandConsistency.savesTime', 'Saves 2+ hours per competitive analysis')}
      </p>
    </div>
  `;
}
// Cross-Page Consistency Content (Multi-Page Mode)
function renderCrossPageConsistencyContent(data) {
  const crossPage = data.crossPageConsistency;
  if (!crossPage) return '<p>No cross-page data available</p>';
  
  const scoreColor = getScoreColor(crossPage.score);
  const issues = crossPage.issues || [];
  
  // Create issue severity badge
  const getSeverityBadge = (severity) => {
    const colors = {
      high: '#ff6b6b',
      medium: '#ffd700',
      low: '#00ff41'
    };
    return `<span style="display: inline-block; padding: 2px 8px; background: ${colors[severity] || '#888'}20; color: ${colors[severity] || '#888'}; font-size: 0.7rem; border-radius: 4px; font-weight: 600;">${severity.toUpperCase()}</span>`;
  };
  
  return `
    <div style="margin-bottom: 1.5rem;">
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.crossPageScore', 'Cross-Page Consistency Score')}</h4>
      <div style="display: flex; align-items: center; gap: 1rem; padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <div style="width: 60px; height: 60px; position: relative;">
          <svg width="60" height="60" viewBox="0 0 60 60" style="transform: rotate(-90deg);">
            <circle cx="30" cy="30" r="24" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="5"/>
            <circle cx="30" cy="30" r="24" fill="none" stroke="${scoreColor}" stroke-width="5" 
              stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 24}" stroke-dashoffset="${2 * Math.PI * 24 - (crossPage.score / 100) * 2 * Math.PI * 24}"/>
          </svg>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.9rem; font-weight: 600; color: ${scoreColor};">${crossPage.score}</div>
        </div>
        <div style="flex: 1;">
          <div style="font-size: 1rem; font-weight: 600; color: #fff;">
            ${crossPage.score >= 90 ? t('brandConsistency.excellentConsistency', 'Excellent Consistency') :
              crossPage.score >= 70 ? t('brandConsistency.goodConsistency', 'Good Consistency') :
              crossPage.score >= 50 ? t('brandConsistency.moderateVariation', 'Moderate Variation') :
              t('brandConsistency.significantVariation', 'Significant Variation')}
          </div>
          <div style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">
            ${t('brandConsistency.pagesAnalyzedCount', 'Analyzed {{count}} pages').replace('{{count}}', crossPage.pagesAnalyzed || data.pagesAnalyzed)}
          </div>
        </div>
      </div>
    </div>
    
    ${issues.length > 0 ? `
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.consistencyIssues', 'Consistency Issues')} (${issues.length})</h4>
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${issues.map(issue => `
            <div style="padding: 0.75rem 1rem; background: rgba(255,255,255,0.03); border-radius: 6px; border-left: 3px solid ${issue.severity === 'high' ? '#ff6b6b' : issue.severity === 'medium' ? '#ffd700' : '#00ff41'};">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.35rem;">
                <span style="color: rgba(255,255,255,0.9); font-weight: 500;">${issue.message}</span>
                ${getSeverityBadge(issue.severity)}
              </div>
              ${issue.details && Array.isArray(issue.details) ? `
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                  ${issue.details.slice(0, 5).map(d => `
                    <span style="padding: 2px 8px; background: rgba(255,255,255,0.1); border-radius: 4px; font-size: 0.75rem; color: rgba(255,255,255,0.7);">
                      ${d.page || d}: ${d.count !== undefined ? d.count : (d.hasLogo !== undefined ? (d.hasLogo ? '✓' : '✗') : '')}
                    </span>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <div style="padding: 1.5rem; background: rgba(0, 255, 65, 0.05); border-radius: 8px; text-align: center; border: 1px solid rgba(0, 255, 65, 0.2);">
        <span style="color: #00ff41; font-size: 1.5rem;">✓</span>
        <p style="margin: 0.5rem 0 0 0; color: #00ff41; font-weight: 500;">${t('brandConsistency.noIssuesFound', 'No consistency issues found!')}</p>
        <p style="margin: 0.25rem 0 0 0; color: rgba(255,255,255,0.6); font-size: 0.85rem;">${t('brandConsistency.brandConsistent', 'Your brand appears consistent across all analyzed pages.')}</p>
      </div>
    `}
    
    ${crossPage.pageVariations && crossPage.pageVariations.length > 0 ? `
      <div>
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.metricVariation', 'Metric Variation')}</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
          ${crossPage.pageVariations.map(v => `
            <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px; text-align: center;">
              <div style="font-size: 0.75rem; color: rgba(255,255,255,0.5); text-transform: uppercase; margin-bottom: 0.25rem;">${v.metric}</div>
              <div style="font-size: 1.1rem; font-weight: 600; color: ${v.variation === 'consistent' || v.variation === 'low' || (typeof v.variation === 'number' && v.variation < 5) ? '#00ff41' : '#ffd700'};">
                ${typeof v.variation === 'number' ? '±' + v.variation : v.variation}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// Page Breakdown Content (Multi-Page Mode)
function renderPageBreakdownContent(pageBreakdown) {
  if (!pageBreakdown || pageBreakdown.length === 0) return '<p>No page data available</p>';
  
  return `
    <div>
      <h4 style="margin: 0 0 1rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.pagesAnalyzed', 'Pages Analyzed')}</h4>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
              <th style="padding: 0.75rem; text-align: left; color: rgba(255,255,255,0.6); font-weight: 500;">${t('brandConsistency.page', 'Page')}</th>
              <th style="padding: 0.75rem; text-align: center; color: rgba(255,255,255,0.6); font-weight: 500;">${t('brandConsistency.colors', 'Colors')}</th>
              <th style="padding: 0.75rem; text-align: center; color: rgba(255,255,255,0.6); font-weight: 500;">${t('brandConsistency.fonts', 'Fonts')}</th>
              <th style="padding: 0.75rem; text-align: center; color: rgba(255,255,255,0.6); font-weight: 500;">${t('brandConsistency.logo', 'Logo')}</th>
              <th style="padding: 0.75rem; text-align: center; color: rgba(255,255,255,0.6); font-weight: 500;">${t('brandConsistency.buttons', 'Buttons')}</th>
            </tr>
          </thead>
          <tbody>
            ${pageBreakdown.map((page, idx) => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); ${idx === 0 ? 'background: rgba(0, 255, 65, 0.05);' : ''}">
                <td style="padding: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    ${idx === 0 ? '<span style="color: #00ff41; font-size: 0.7rem;">★</span>' : ''}
                    <span style="color: #fff; font-weight: 500;">${page.pageName}</span>
                  </div>
                  <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${page.url}">
                    ${page.url}
                  </div>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${page.colorCount <= 20 ? '#00ff41' : page.colorCount <= 35 ? '#ffd700' : '#ff6b6b'};">${page.colorCount}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${page.fontCount <= 3 ? '#00ff41' : page.fontCount <= 5 ? '#ffd700' : '#ff6b6b'};">${page.fontCount}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${page.hasLogo ? '#00ff41' : '#ff6b6b'};">${page.hasLogo ? '✓' : '✗'}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: rgba(255,255,255,0.7);">${page.buttonCount}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(255,255,255,0.03); border-radius: 6px;">
        <p style="margin: 0; font-size: 0.8rem; color: rgba(255,255,255,0.6);">
          <span style="color: #00ff41;">★</span> = ${t('brandConsistency.homepage', 'Homepage (primary page)')}
        </p>
      </div>
    </div>
  `;
}