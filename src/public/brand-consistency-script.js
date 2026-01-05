// Brand Consistency Checker Script
// Best-in-class brand analysis with consistent UI design

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

// Translation helper
function t(key, fallback) {
  if (window.i18n && typeof window.i18n.t === 'function') {
    return window.i18n.t(key) || fallback;
  }
  return fallback;
}

// Analysis steps for the loader (will be translated at runtime)
function getAnalysisSteps() {
  return [
    { label: t('brandConsistency.steps.initializing', 'Initializing analysis'), detail: t('brandConsistency.steps.connecting', 'Connecting to target website...') },
    { label: t('brandConsistency.steps.extractingColors', 'Extracting colors'), detail: t('brandConsistency.steps.analyzingPalette', 'Analyzing color palette and harmony...') },
    { label: t('brandConsistency.steps.detectingFonts', 'Detecting fonts'), detail: t('brandConsistency.steps.identifyingTypography', 'Identifying typography hierarchy...') },
    { label: t('brandConsistency.steps.findingLogos', 'Finding logos'), detail: t('brandConsistency.steps.locatingAssets', 'Locating brand assets...') },
    { label: t('brandConsistency.steps.analyzingUI', 'Analyzing UI consistency'), detail: t('brandConsistency.steps.checkingStyles', 'Checking button and link styles...') },
    { label: t('brandConsistency.steps.generating', 'Generating insights'), detail: t('brandConsistency.steps.compiling', 'Compiling recommendations...') }
  ];
}

async function analyze() {
  const url = document.getElementById('url').value.trim();
  if (!url) { 
    alert(t('common.pleaseEnterUrl', 'Please enter a URL')); 
    return; 
  }
  
  const results = document.getElementById('results');
  const btn = document.getElementById('analyzeBtn');
  
  results.style.display = 'none';
  btn.disabled = true;
  
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

  loader.start(getAnalysisSteps(), t('brandConsistency.loaderTitle', '🎨 BRAND ANALYSIS'), 25);
  
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
      body: JSON.stringify({ url })
    });
    
    loader.nextStep(2);
    loader.nextStep(3);
    loader.nextStep(4);
    
    if (!response.ok) throw new Error('Analysis failed');
    const data = await response.json();
    
    loader.nextStep(5);
    loader.complete();
    
    setTimeout(() => {
      displayResults(data);
      results.style.display = 'block';
    }, 500);
    
  } catch (error) {
    alert(`${t('common.error', 'Error')}: ${error.message}`);
    loader.complete();
  } finally {
    btn.disabled = false;
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
  const circumference = 2 * Math.PI * 75; // r=75
  const offset = circumference - (score / 100) * circumference;
  
  results.innerHTML = `
    <!-- Score Dashboard -->
    <div class="results-grid" style="display: grid; grid-template-columns: 1fr 2fr; gap: 2rem; margin-bottom: 2rem;">
      
      <!-- Circular Score -->
      <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem;">
        <div class="score-circle-container" style="position: relative; width: 180px; height: 180px;">
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180" style="transform: rotate(-90deg);">
            <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="10"/>
            <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(score)}" stroke-width="10" 
              stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"
              style="transition: stroke-dashoffset 1s ease-out;"/>
          </svg>
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
            <span style="font-size: 2.5rem; font-weight: 700; color: #fff;">${score}</span>
            <div style="font-size: 0.8rem; color: rgba(255,255,255,0.6);">/ 100</div>
          </div>
        </div>
        <div style="text-align: center; margin-top: 1rem;">
          <span style="display: inline-block; padding: 0.4rem 1rem; background: ${getGradeColor(data.grade)}20; color: ${getGradeColor(data.grade)}; border-radius: 4px; font-weight: 600; font-size: 1.2rem;">
            ${t('brandConsistency.grade', 'Grade')}: ${data.grade}
          </span>
        </div>
        <p style="color: rgba(255,255,255,0.5); font-size: 0.8rem; margin-top: 0.5rem;">${t('brandConsistency.scoreLabel', 'Brand Consistency Score')}</p>
      </div>
      
      <!-- Summary Stats -->
      <div class="card" style="padding: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0; color: rgba(255,255,255,0.7); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.1em;">${t('brandConsistency.quickSummary', 'Quick Summary')}</h3>
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
          ${generateStatCard(t('brandConsistency.colors', 'Colors'), data.consistency.colorCount, translateStatus(data.consistency.colorConsistency))}
          ${generateStatCard(t('brandConsistency.fonts', 'Fonts'), data.consistency.fontCount, translateStatus(data.consistency.fontConsistency))}
          ${generateStatCard(t('brandConsistency.logos', 'Logos'), data.consistency.logoCount, data.consistency.hasLogo ? t('brandConsistency.detected', 'Detected') : t('brandConsistency.missing', 'Missing'))}
          ${generateStatCard(t('brandConsistency.buttons', 'Buttons'), '—', translateStatus(data.consistency.buttonStyleConsistency))}
          ${generateStatCard(t('brandConsistency.links', 'Links'), '—', translateStatus(data.consistency.linkColorConsistency))}
          ${generateStatCard(t('brandConsistency.favicon', 'Favicon'), '—', data.consistency.hasFavicon ? t('brandConsistency.present', 'Present') : t('brandConsistency.missing', 'Missing'))}
        </div>
      </div>
    </div>
    
    <!-- Score Breakdown -->
    ${data.scoreBreakdown ? generateScoreBreakdown(data.scoreBreakdown) : ''}
    
    <!-- Accordions Container -->
    <div id="accordions-container" style="margin-top: 2rem;"></div>
  `;
  
  // Create accordion sections
  const container = document.getElementById('accordions-container');
  
  // Color Palette Accordion
  createAccordionSection(container, 'color-palette', t('brandConsistency.colorPaletteAnalysis', 'Color Palette Analysis'), 
    () => renderColorPaletteContent(data), 
    data.colorAnalysis?.harmonyScore || 70);
  
  // Typography Accordion
  createAccordionSection(container, 'typography', t('brandConsistency.typographyAnalysis', 'Typography Analysis'), 
    () => renderTypographyContent(data), 
    data.typographyAnalysis?.typographyScore || 50);
  
  // Brand Identity Accordion
  createAccordionSection(container, 'brand-identity', t('brandConsistency.brandIdentity', 'Brand Identity'), 
    () => renderBrandIdentityContent(data), 
    (data.consistency.hasLogo ? 75 : 25) + (data.consistency.hasFavicon ? 25 : 0));
  
  // UI Consistency Accordion
  createAccordionSection(container, 'ui-consistency', t('brandConsistency.uiConsistency', 'UI Consistency'), 
    () => renderUIConsistencyContent(data), 
    data.consistency.buttonStyleConsistency === 'Excellent' ? 85 : 
    data.consistency.buttonStyleConsistency === 'Good' ? 70 : 50);
  
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
      <h3 style="margin: 0 0 1rem 0; color: rgba(255,255,255,0.7); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.1em;">${t('brandConsistency.scoreBreakdown', 'Score Breakdown')}</h3>
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

function createAccordionSection(container, id, displayTitle, contentCreator, score, startExpanded = false) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  
  const scoreDisplay = score !== null ? `
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      <span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${Math.round(score)}/100</span>
      <span class="accordion-toggle">▼</span>
    </span>
  ` : '<span class="accordion-toggle">▼</span>';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `<span>${displayTitle}</span>${scoreDisplay}`;
  
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
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.colorHarmony', 'Color Harmony')}</h4>
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
        <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.primaryBrandColors', 'Primary Brand Colors')}</h4>
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
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.allDetectedColors', 'All Detected Colors')} (${colors.length})</h4>
      <div style="display: flex; flex-wrap: wrap; gap: 0.35rem; max-height: 200px; overflow-y: auto;">
        ${colors.slice(0, 40).map(color => `
          <div style="background: ${color}; width: 32px; height: 32px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15);" title="${formatColor(color)}"></div>
        `).join('')}
        ${colors.length > 40 ? `<div style="display: flex; align-items: center; color: rgba(255,255,255,0.5); font-size: 0.8rem; padding: 0 0.5rem;">+${colors.length - 40} ${t('common.more', 'more')}</div>` : ''}
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
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.typographySummary', 'Typography Summary')}</h4>
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
        <h4 style="margin: 0 0 0.5rem 0; color: rgba(255,255,255,0.8); font-size: 0.9rem;">${t('brandConsistency.headingFonts', 'Heading Fonts')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${typography.headingFonts.map(font => `
            <span style="background: rgba(0,255,65,0.1); border: 1px solid rgba(0,255,65,0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-family: ${font}; color: #fff;">${font}</span>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    ${typography.bodyFonts?.length > 0 ? `
      <div style="margin-bottom: 1rem;">
        <h4 style="margin: 0 0 0.5rem 0; color: rgba(255,255,255,0.8); font-size: 0.9rem;">${t('brandConsistency.bodyFonts', 'Body Fonts')}</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${typography.bodyFonts.map(font => `
            <span style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); padding: 0.4rem 0.8rem; border-radius: 4px; font-family: ${font}; color: #fff;">${font}</span>
          `).join('')}
        </div>
      </div>
    ` : ''}
    
    <div>
      <h4 style="margin: 0 0 0.5rem 0; color: rgba(255,255,255,0.8); font-size: 0.9rem;">${t('brandConsistency.allFontsByUsage', 'All Fonts by Usage')}</h4>
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
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.logoDetection', 'Logo Detection')}</h4>
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
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.favicon', 'Favicon')}</h4>
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
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.buttonStyles', 'Button Styles')}</h4>
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
      <h4 style="margin: 0 0 0.75rem 0; color: rgba(255,255,255,0.8);">${t('brandConsistency.linkColors', 'Link Colors')}</h4>
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
