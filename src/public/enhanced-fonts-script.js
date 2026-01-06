/**
 * Enhanced Font Analyzer Script
 * Detects font providers, duplicates, unused fonts, and optimization opportunities
 */

document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const multiPageOption = document.getElementById('multiPageOption');
  const multiPageOptions = document.getElementById('multiPageOptions');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');

  // Initialize AnalyzerLoader
  let loader = null;
  if (typeof AnalyzerLoader !== 'undefined') {
    loader = new AnalyzerLoader('loadingContainer');
  }

  // Define analysis steps
  const analysisSteps = [
    { label: 'Connecting to website', detail: 'Loading page and resources...' },
    { label: 'Detecting font providers', detail: 'Scanning for Google Fonts, Adobe Fonts, self-hosted...' },
    { label: 'Analyzing font declarations', detail: 'Checking @font-face rules and CSS...' },
    { label: 'Finding optimization issues', detail: 'Checking duplicates, display issues, preload...' },
    { label: 'Generating report', detail: 'Compiling results and recommendations...' }
  ];

  // Toggle multi-page options
  multiPageOption.addEventListener('change', () => {
    multiPageOptions.style.display = multiPageOption.checked ? 'block' : 'none';
  });

  // Handle analysis
  analyzeButton.addEventListener('click', analyzeUrl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeUrl();
  });

  // Check for URL in query params
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  if (urlParam) {
    urlInput.value = urlParam;
    analyzeUrl();
  }

  async function analyzeUrl() {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter a valid URL');
      return;
    }

    // Show loading
    results.classList.add('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;
    
    if (loader) {
      loader.start(analysisSteps, '🔤 ANALYZING FONTS', 30);
      
      // Add ASCII art patience message after loader starts
      addPatienceMessage(loadingContainer);
    }

    // Build options
    const options = {};
    if (multiPageOption.checked) {
      options.maxPages = parseInt(document.getElementById('maxPages').value) || 5;
      options.maxDepth = 2;
    }

    try {
      if (loader) loader.nextStep(1);

      const response = await fetch('/api/enhanced-fonts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options })
      });

      if (loader) loader.nextStep(3);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      
      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          results.classList.remove('hidden');
          displayResults(data);
        }, 800);
      } else {
        results.classList.remove('hidden');
        displayResults(data);
      }

    } catch (error) {
      if (loader) {
        loadingContainer.style.display = 'none';
      }
      showError(error.message);
    } finally {
      analyzeButton.disabled = false;
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  // Store current results for export
  let currentResults = null;

  function displayResults(data) {
    currentResults = data;
    const totalIssues = (data.summary.duplicateCount || 0) + 
                        (data.summary.displayIssueCount || 0) + 
                        (data.summary.preloadIssueCount || 0);
    
    // Get full scan data if available
    const fullScan = data.fullScan || {};
    const hasFullScan = !!data.fullScan;
    const fonts = fullScan.fonts || {};
    const performance = fullScan.performance || {};
    const bestPractices = fullScan.bestPractices || {};
    const screenshot = fullScan.screenshot;

    const html = `
      <!-- Sticky Alert Banner -->
      ${generateStickyAlert(totalIssues, data)}
      
      <!-- Overview Section (Always Visible) -->
      ${generateOverviewSection(data, totalIssues, hasFullScan, fonts, performance, bestPractices, screenshot)}
      
      <!-- Accordions Container -->
      <div id="accordions-container" style="margin-top: 2rem;"></div>
      
      <!-- Export Buttons (at bottom) -->
      <div class="export-buttons" role="toolbar" aria-label="Export options" style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <button class="export-btn" onclick="exportToPDF()" aria-label="Download PDF report">
          📄 Download PDF
        </button>
        <button class="export-btn" onclick="exportToCSS()" aria-label="Export as CSS">
          🎨 Export CSS
        </button>
        <button class="export-btn" onclick="copyShareLink()" aria-label="Copy share link">
          🔗 Share Link
        </button>
      </div>
    `;

    resultsContent.innerHTML = html;
    
    // Create accordions after DOM is ready
    const accordionContainer = document.getElementById('accordions-container');
    
    // Font Families Accordion
    createAccordionSection(accordionContainer, 'font-families', 'Font Families', 
      () => generateFontsAccordionContent(data, fonts, hasFullScan), 
      `${data.families.length} detected`);
    
    // Font Providers Accordion
    createAccordionSection(accordionContainer, 'font-providers', 'Font Providers', 
      () => generateProvidersAccordionContent(data), 
      `${data.providers.length} source${data.providers.length !== 1 ? 's' : ''}`);
    
    // Advanced Analysis Accordion (NEW - Best-in-Class)
    const advancedAnalysis = fonts.advancedAnalysis || {};
    const advancedScore = calculateAdvancedScore(advancedAnalysis);
    createAccordionSection(accordionContainer, 'advanced-analysis', 'Advanced Typography Analysis', 
      () => generateAdvancedAnalysisContent(advancedAnalysis, fonts), 
      advancedScore ? `${advancedScore}/100` : 'N/A');
    
    // Performance Accordion - show initial load time or font metrics
    const perfBadge = hasFullScan ? 
      (performance.fontLoadingTime ? `${performance.fontLoadingTime}ms` : 
       performance.initialLoadTime ? `${performance.initialLoadTime}ms` : 
       fonts.fontMetrics?.length ? `${fonts.fontMetrics.length} elements` : 'Available') 
      : 'N/A';
    createAccordionSection(accordionContainer, 'performance', 'Performance Metrics', 
      () => generatePerformanceAccordionContent(data, performance, hasFullScan, fonts), 
      perfBadge);
    
    // Recommendations Accordion (auto-expand if issues)
    createAccordionSection(accordionContainer, 'recommendations', 'Recommendations & Fixes', 
      () => generateRecommendationsAccordionContent(data, bestPractices), 
      totalIssues > 0 ? `${totalIssues} issue${totalIssues > 1 ? 's' : ''}` : 'All good',
      totalIssues > 0); // auto-expand if there are issues
    
    // AI Suggestions Accordion
    createAccordionSection(accordionContainer, 'ai-suggestions', 'AI Typography Suggestions', 
      () => `<div class="ai-suggestion">${generateAISuggestions(data, fonts)}</div>`, 
      'Smart tips');
    
    // Raw Data Accordion
    createAccordionSection(accordionContainer, 'raw-data', 'Raw Data', 
      () => `<pre style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px; overflow-x: auto; font-size: 0.75rem; max-height: 400px;">${JSON.stringify(data, null, 2)}</pre>`, 
      'JSON');
    
    // Initialize charts after DOM is ready
    setTimeout(() => {
      initializeCharts(data, fonts);
    }, 100);
  }
  
  // ============================================
  // CALCULATE ADVANCED ANALYSIS SCORE
  // ============================================
  function calculateAdvancedScore(advancedAnalysis) {
    if (!advancedAnalysis || Object.keys(advancedAnalysis).length === 0) return null;
    
    const scores = [];
    if (advancedAnalysis.formats?.summary?.woff2Percentage !== undefined) {
      scores.push(advancedAnalysis.formats.summary.woff2Percentage);
    }
    if (advancedAnalysis.fontDisplay?.summary?.score !== undefined) {
      scores.push(advancedAnalysis.fontDisplay.summary.score);
    }
    if (advancedAnalysis.accessibility?.score !== undefined) {
      scores.push(advancedAnalysis.accessibility.score);
    }
    if (advancedAnalysis.fallbackStacks?.summary?.score !== undefined) {
      scores.push(advancedAnalysis.fallbackStacks.summary.score);
    }
    if (advancedAnalysis.clsRisk?.score !== undefined) {
      scores.push(advancedAnalysis.clsRisk.score);
    }
    
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }
  
  // ============================================
  // ADVANCED ANALYSIS CONTENT GENERATOR
  // ============================================
  function generateAdvancedAnalysisContent(advancedAnalysis, fonts) {
    if (!advancedAnalysis || Object.keys(advancedAnalysis).length === 0) {
      return '<p style="color: #888;">Advanced analysis not available. Run a full scan for detailed typography insights.</p>';
    }
    
    const { formats, fontDisplay, accessibility, fallbackStacks, variableFonts, clsRisk } = advancedAnalysis;
    
    return `
      <!-- Font Format Analysis -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          📦 Font Format Analysis
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(formats?.summary?.recommendation)}; color: white;">
            ${formats?.summary?.recommendation || 'N/A'}
          </span>
        </h4>
        ${formats ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 0.75rem; margin-bottom: 1rem;">
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">${formats.summary.woff2Count}</div>
              <div style="font-size: 0.75rem; color: #888;">WOFF2</div>
            </div>
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #4285f4;">${formats.formats.woff.length}</div>
              <div style="font-size: 0.75rem; color: #888;">WOFF</div>
            </div>
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #f59e0b;">${formats.formats.ttf.length + formats.formats.otf.length}</div>
              <div style="font-size: 0.75rem; color: #888;">TTF/OTF</div>
            </div>
            <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${formats.summary.woff2Percentage >= 80 ? '#10b981' : '#f59e0b'};">${formats.summary.woff2Percentage}%</div>
              <div style="font-size: 0.75rem; color: #888;">Modern</div>
            </div>
          </div>
          ${formats.summary.hasLegacyFormats ? `
            <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              ⚠️ Legacy formats detected (EOT/SVG). Consider removing for smaller bundles.
            </div>
          ` : ''}
        ` : '<p style="color: #666;">Format data not available</p>'}
      </div>
      
      <!-- font-display Audit -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          ⚡ font-display Audit
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(fontDisplay?.summary?.recommendation)}; color: white;">
            ${fontDisplay?.summary?.score || 0}/100
          </span>
        </h4>
        ${fontDisplay ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.5rem; margin-bottom: 1rem;">
            ${fontDisplay.values.swap.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #10b981;">${fontDisplay.values.swap.length}</div>
                <div style="font-size: 0.7rem; color: #888;">swap ✓</div>
              </div>
            ` : ''}
            ${fontDisplay.values.optional.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(16, 185, 129, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #10b981;">${fontDisplay.values.optional.length}</div>
                <div style="font-size: 0.7rem; color: #888;">optional ✓</div>
              </div>
            ` : ''}
            ${fontDisplay.values.fallback.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(66, 133, 244, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #4285f4;">${fontDisplay.values.fallback.length}</div>
                <div style="font-size: 0.7rem; color: #888;">fallback</div>
              </div>
            ` : ''}
            ${fontDisplay.values.block.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #ef4444;">${fontDisplay.values.block.length}</div>
                <div style="font-size: 0.7rem; color: #888;">block ✗</div>
              </div>
            ` : ''}
            ${fontDisplay.values.auto.length + fontDisplay.values.notSet.length > 0 ? `
              <div style="text-align: center; padding: 0.5rem; background: rgba(245, 158, 11, 0.1); border-radius: 6px;">
                <div style="font-weight: bold; color: #f59e0b;">${fontDisplay.values.auto.length + fontDisplay.values.notSet.length}</div>
                <div style="font-size: 0.7rem; color: #888;">auto/none</div>
              </div>
            ` : ''}
          </div>
          ${fontDisplay.summary.problematicCount > 0 ? `
            <div style="background: rgba(245, 158, 11, 0.1); border-left: 4px solid #f59e0b; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              💡 Add <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px;">font-display: swap</code> to prevent Flash of Invisible Text (FOIT)
            </div>
          ` : `
            <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              ✅ All fonts use optimal font-display values
            </div>
          `}
        ` : '<p style="color: #666;">font-display data not available</p>'}
      </div>
      
      <!-- Typography Accessibility -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          ♿ Typography Accessibility
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(accessibility?.summary?.recommendation)}; color: white;">
            ${accessibility?.score || 0}/100
          </span>
        </h4>
        ${accessibility ? `
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${accessibility.passed.map(item => `
              <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem; background: rgba(16, 185, 129, 0.05); border-radius: 6px;">
                <span style="color: #10b981;">✓</span>
                <div>
                  <div style="font-weight: 500;">${item.title}</div>
                  <div style="font-size: 0.8rem; color: #888;">${item.detail}</div>
                </div>
              </div>
            `).join('')}
            ${accessibility.issues.map(item => `
              <div style="display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.5rem; background: rgba(${item.type === 'warning' ? '245, 158, 11' : '239, 68, 68'}, 0.05); border-radius: 6px;">
                <span style="color: ${item.type === 'warning' ? '#f59e0b' : '#ef4444'};">${item.type === 'warning' ? '⚠' : '✗'}</span>
                <div>
                  <div style="font-weight: 500;">${item.title}</div>
                  <div style="font-size: 0.8rem; color: #888;">${item.detail}</div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: #666;">Accessibility data not available</p>'}
      </div>
      
      <!-- Fallback Stack Quality -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          🔄 Fallback Stack Quality
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${getRecommendationColor(fallbackStacks?.summary?.recommendation)}; color: white;">
            ${fallbackStacks?.summary?.score || 0}/100
          </span>
        </h4>
        ${fallbackStacks && fallbackStacks.stacks.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
            <span style="padding: 0.25rem 0.5rem; background: rgba(16, 185, 129, 0.2); border-radius: 4px; font-size: 0.75rem;">
              ✓ Excellent: ${fallbackStacks.summary.excellent}
            </span>
            <span style="padding: 0.25rem 0.5rem; background: rgba(66, 133, 244, 0.2); border-radius: 4px; font-size: 0.75rem;">
              ○ Good: ${fallbackStacks.summary.good}
            </span>
            <span style="padding: 0.25rem 0.5rem; background: rgba(239, 68, 68, 0.2); border-radius: 4px; font-size: 0.75rem;">
              ✗ Poor: ${fallbackStacks.summary.poor}
            </span>
          </div>
          ${fallbackStacks.stacks.filter(s => s.quality === 'poor').slice(0, 3).map(stack => `
            <div style="background: rgba(239, 68, 68, 0.05); border-left: 4px solid #ef4444; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              <div style="font-family: monospace; font-size: 0.8rem; margin-bottom: 0.25rem; word-break: break-all;">${stack.stack}</div>
              <div style="color: #888;">${stack.recommendation}</div>
            </div>
          `).join('')}
        ` : '<p style="color: #666;">Fallback stack data not available</p>'}
      </div>
      
      <!-- Variable Fonts Detection -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          🎨 Variable Fonts
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${variableFonts?.hasVariableFonts ? '#10b981' : '#6b7280'}; color: white;">
            ${variableFonts?.variableFonts?.length || 0} detected
          </span>
        </h4>
        ${variableFonts ? `
          ${variableFonts.hasVariableFonts ? `
            <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem; margin-bottom: 0.75rem;">
              ✅ Using variable fonts! This reduces HTTP requests and enables smooth weight/width transitions.
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${variableFonts.variableFonts.map(vf => `
                <span style="padding: 0.25rem 0.75rem; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 20px; font-size: 0.8rem;">
                  ${vf.fontFamily}
                </span>
              `).join('')}
            </div>
          ` : `
            <div style="background: rgba(66, 133, 244, 0.1); border-left: 4px solid #4285f4; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              💡 ${variableFonts.potentialSavings || 'Consider using variable fonts for more flexible typography with fewer files.'}
            </div>
          `}
        ` : '<p style="color: #666;">Variable font data not available</p>'}
      </div>
      
      <!-- CLS Risk Score -->
      <div style="margin-bottom: 1rem;">
        <h4 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          📊 Layout Shift Risk (CLS)
          <span style="font-size: 0.75rem; padding: 2px 8px; border-radius: 12px; background: ${clsRisk?.level === 'low' ? '#10b981' : clsRisk?.level === 'medium' ? '#f59e0b' : '#ef4444'}; color: white;">
            ${clsRisk?.level || 'N/A'}
          </span>
        </h4>
        ${clsRisk ? `
          ${clsRisk.risks.length === 0 ? `
            <div style="background: rgba(16, 185, 129, 0.1); border-left: 4px solid #10b981; padding: 0.75rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
              ✅ Low risk of font-related layout shifts. Good font-display and fallback configuration.
            </div>
          ` : `
            ${clsRisk.risks.map(risk => `
              <div style="background: rgba(${risk.type === 'high' ? '239, 68, 68' : '245, 158, 11'}, 0.1); border-left: 4px solid ${risk.type === 'high' ? '#ef4444' : '#f59e0b'}; padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 0 6px 6px 0; font-size: 0.85rem;">
                <div style="font-weight: 500; margin-bottom: 0.25rem;">${risk.title}</div>
                <div style="color: #888;">${risk.detail}</div>
              </div>
            `).join('')}
          `}
        ` : '<p style="color: #666;">CLS risk data not available</p>'}
      </div>
    `;
  }
  
  function getRecommendationColor(recommendation) {
    switch (recommendation) {
      case 'excellent': return '#10b981';
      case 'good': return '#4285f4';
      case 'needs-improvement': return '#f59e0b';
      default: return '#6b7280';
    }
  }
  
  // ============================================
  // ACCORDION SECTION CREATOR (matches SEO pattern)
  // ============================================
  function createAccordionSection(container, id, displayTitle, contentCreator, badge, autoExpand = false) {
    const accordion = document.createElement('div');
    accordion.className = 'accordion';
    
    const header = document.createElement('button');
    header.className = 'accordion-header';
    header.innerHTML = `
      <span>${displayTitle}</span>
      <span style="display: flex; align-items: center; gap: 0.5rem;">
        <span style="font-size: 0.9rem; color: #9ca3af;">${badge}</span>
        <span class="accordion-toggle">▼</span>
      </span>
    `;
    
    const content = document.createElement('div');
    content.className = 'accordion-content';
    content.id = `accordion-${id}`;
    // Set initial collapsed state
    content.style.cssText = 'max-height: 0; padding: 0; overflow: hidden; border-top: none; transition: max-height 0.3s ease, padding 0.3s ease;';
    
    const contentInner = document.createElement('div');
    contentInner.className = 'accordion-content-inner';
    content.appendChild(contentInner);
    
    // Add click handler for accordion
    header.addEventListener('click', () => {
      const isExpanded = content.classList.contains('expanded');
      
      if (isExpanded) {
        // Collapse
        content.classList.remove('expanded');
        header.classList.remove('active');
        header.querySelector('.accordion-toggle').textContent = '▼';
        content.style.maxHeight = '0';
        content.style.padding = '0';
        content.style.borderTop = 'none';
      } else {
        // Expand and create content if not already created
        if (!contentInner.hasChildNodes()) {
          const contentHTML = contentCreator();
          contentInner.innerHTML = contentHTML;
        }
        
        content.classList.add('expanded');
        header.classList.add('active');
        header.querySelector('.accordion-toggle').textContent = '▲';
        content.style.maxHeight = content.scrollHeight + 100 + 'px';
        content.style.padding = '1rem 1.25rem';
        content.style.borderTop = '1px solid #333';
      }
    });
    
    accordion.appendChild(header);
    accordion.appendChild(content);
    container.appendChild(accordion);
    
    // Auto-expand if requested
    if (autoExpand) {
      setTimeout(() => header.click(), 100);
    }
  }

  // ============================================
  // STICKY ALERT GENERATOR
  // ============================================
  function generateStickyAlert(totalIssues, data) {
    if (totalIssues === 0) {
      return `
        <div class="sticky-alert success" role="alert">
          <span style="font-size: 1.5rem;">✅</span>
          <div>
            <strong>Excellent Font Health!</strong>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; opacity: 0.8;">No critical font issues detected. Your typography is well-optimized.</p>
          </div>
        </div>
      `;
    }
    
    const hasCritical = data.summary.displayIssueCount > 0 || data.summary.duplicateCount > 0;
    
    return `
      <div class="sticky-alert ${hasCritical ? 'critical' : 'warning'}" role="alert">
        <span style="font-size: 1.5rem;">${hasCritical ? '🚨' : '⚠️'}</span>
        <div style="flex: 1;">
          <strong>${totalIssues} Issue${totalIssues > 1 ? 's' : ''} Found</strong>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; opacity: 0.8;">
            ${data.summary.duplicateCount > 0 ? `${data.summary.duplicateCount} duplicate${data.summary.duplicateCount > 1 ? 's' : ''} • ` : ''}
            ${data.summary.displayIssueCount > 0 ? `${data.summary.displayIssueCount} display issue${data.summary.displayIssueCount > 1 ? 's' : ''} • ` : ''}
            ${data.summary.preloadIssueCount > 0 ? `${data.summary.preloadIssueCount} preload opportunit${data.summary.preloadIssueCount > 1 ? 'ies' : 'y'}` : ''}
          </p>
        </div>
      </div>
    `;
  }

  // ============================================
  // OVERVIEW SECTION (Always Visible)
  // ============================================
  function generateOverviewSection(data, totalIssues, hasFullScan, fonts, performance, bestPractices, screenshot) {
    return `
      <!-- Score Section -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Main Score -->
        <div style="text-align: center; padding: 2rem; background: rgba(255,255,255,0.03); border-radius: 12px;">
          <h3 style="margin: 0 0 1rem 0; font-size: 1rem; color: #888;">Font Health Score</h3>
          <div style="
            width: 140px; height: 140px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 3rem; font-weight: bold; margin: 0 auto;
            border: 5px solid ${getScoreColor(data.healthScore)};
            color: ${getScoreColor(data.healthScore)};
            background: rgba(${getScoreColor(data.healthScore) === '#10b981' ? '16, 185, 129' : getScoreColor(data.healthScore) === '#f59e0b' ? '245, 158, 11' : '239, 68, 68'}, 0.1);
          ">
            ${data.healthScore}
          </div>
          <p style="margin: 1rem 0 0 0; color: #888; font-size: 0.9rem;">
            ${data.healthScore >= 80 ? 'Excellent' : data.healthScore >= 60 ? 'Good' : 'Needs Work'}
          </p>
        </div>
        
        <!-- Stats Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div class="font-card" style="text-align: center; margin: 0;">
            <div style="font-size: 2rem; font-weight: bold; color: #4285f4;">${data.summary.totalFamilies}</div>
            <div style="color: #888; font-size: 0.85rem;">Font Families</div>
          </div>
          <div class="font-card" style="text-align: center; margin: 0;">
            <div style="font-size: 2rem; font-weight: bold; color: #10b981;">${data.summary.totalProviders}</div>
            <div style="color: #888; font-size: 0.85rem;">Providers</div>
          </div>
          <div class="font-card" style="text-align: center; margin: 0;">
            <div style="font-size: 2rem; font-weight: bold; color: ${data.summary.duplicateCount > 0 ? '#f59e0b' : '#10b981'};">${data.summary.duplicateCount}</div>
            <div style="color: #888; font-size: 0.85rem;">Duplicates</div>
          </div>
          <div class="font-card" style="text-align: center; margin: 0;">
            <div style="font-size: 2rem; font-weight: bold; color: ${data.summary.displayIssueCount > 0 ? '#ef4444' : '#10b981'};">${data.summary.displayIssueCount}</div>
            <div style="color: #888; font-size: 0.85rem;">Display Issues</div>
          </div>
        </div>
      </div>
      
      <!-- Charts Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1rem;">
        <div class="chart-container">
          <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem;">Provider Distribution</h4>
          <canvas id="providerChart"></canvas>
        </div>
        <div class="chart-container">
          <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem;">Font Weight Usage</h4>
          <canvas id="weightChart"></canvas>
        </div>
      </div>
      
      <!-- Screenshot Preview -->
      ${screenshot ? `
        <div style="margin-bottom: 1rem;">
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
            <img src="${screenshot}" alt="Website screenshot" style="max-width: 100%; max-height: 300px; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);" loading="lazy" />
          </div>
        </div>
      ` : ''}
      
      <!-- Quick Stats Footer -->
      <div style="padding: 1rem; background: rgba(255,255,255,0.03); border-radius: 8px;">
        <p style="margin: 0; color: #888; font-size: 0.9rem;">
          📄 Scanned ${data.pagesScanned} page(s) • 
          🔤 ${data.summary.totalFamilies} font families • 
          📦 ${data.summary.totalProviders} providers •
          ⏱️ Analyzed at ${new Date(data.analyzedAt).toLocaleTimeString()}
        </p>
      </div>
    `;
  }

  // ============================================
  // FONTS ACCORDION CONTENT
  // ============================================
  function generateFontsAccordionContent(data, fonts, hasFullScan) {
    return `
      ${data.families.length === 0 ? '<p style="color: #666;">No font families detected.</p>' : ''}
      ${data.families.map(family => `
        <div class="font-card">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <strong style="font-size: 1.1rem;">${family.name}</strong>
              ${isDuplicate(family.name, data.issues.duplicates) ? '<span class="issue-badge issue-duplicate">DUPLICATE</span>' : ''}
              ${hasDisplayIssue(family.name, data.issues.displayIssues) ? '<span class="issue-badge issue-display">NO DISPLAY</span>' : ''}
            </div>
            <div style="color: #666; font-size: 0.8rem;">
              ${family.variants?.length || 0} variant(s)
            </div>
          </div>
          <!-- Font Preview -->
          <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-family: '${family.name}', sans-serif; font-size: 2.5rem; line-height: 1.3; letter-spacing: 0.01em;">
              The quick brown fox jumps over the lazy dog
            </div>
            <div style="font-family: '${family.name}', sans-serif; font-size: 2.5rem; line-height: 1.3; margin-top: 0.75rem; letter-spacing: 0.02em;">
              0123456789
            </div>
            <div style="font-family: '${family.name}', sans-serif; font-size: 2rem; line-height: 1.3; margin-top: 0.5rem; letter-spacing: 0.05em; color: #888;">
              !@#$%^&amp;*()_+-=[]{}|;':",./&lt;&gt;?
            </div>
          </div>
          ${family.variants && family.variants.length > 0 ? `
            <div style="margin-top: 0.75rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${family.variants.slice(0, 10).map(v => `
                <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem; color: #888;">${v.weight || v}${v.style && v.style !== 'normal' ? ' ' + v.style : ''}</span>
              `).join('')}
              ${family.variants.length > 10 ? `<span style="color: #666; font-size: 0.75rem;">+${family.variants.length - 10} more</span>` : ''}
            </div>
          ` : ''}
        </div>
      `).join('')}
      
      <!-- Categorized Fonts (from full scan) -->
      ${hasFullScan && fonts.categorizedFonts ? `
        <div style="margin-top: 1.5rem;">
          <h4 style="margin-bottom: 1rem; color: #888;">Font Categories</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
            ${fonts.categorizedFonts.googleFonts?.length > 0 ? `
              <div style="background: rgba(66, 133, 244, 0.1); border: 1px solid rgba(66, 133, 244, 0.3); border-radius: 8px; padding: 1rem;">
                <div style="font-weight: 600; color: #4285f4; margin-bottom: 0.5rem;">📦 Google (${fonts.categorizedFonts.googleFonts.length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                  ${fonts.categorizedFonts.googleFonts.slice(0, 3).map(f => `<span style="background: rgba(66, 133, 244, 0.2); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">${f.fontFamily || f.name || f}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            ${fonts.categorizedFonts.system?.length > 0 ? `
              <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 1rem;">
                <div style="font-weight: 600; color: #10b981; margin-bottom: 0.5rem;">💻 System (${fonts.categorizedFonts.system.length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                  ${fonts.categorizedFonts.system.slice(0, 3).map(f => `<span style="background: rgba(16, 185, 129, 0.2); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">${f.fontFamily || f.name || f}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            ${fonts.categorizedFonts.iconFonts?.length > 0 ? `
              <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 1rem;">
                <div style="font-weight: 600; color: #f59e0b; margin-bottom: 0.5rem;">🎨 Icons (${fonts.categorizedFonts.iconFonts.length})</div>
                <div style="display: flex; flex-wrap: wrap; gap: 0.25rem;">
                  ${fonts.categorizedFonts.iconFonts.slice(0, 3).map(f => `<span style="background: rgba(245, 158, 11, 0.2); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">${f.fontFamily || f.name || f}</span>`).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}
    `;
  }

  // ============================================
  // PROVIDERS ACCORDION CONTENT
  // ============================================
  function generateProvidersAccordionContent(data) {
    if (data.providers.length === 0) {
      return '<p style="color: #666;">No external font providers detected (fonts may be self-hosted).</p>';
    }
    
    return data.providers.map(provider => `
      <div class="font-card">
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <span class="provider-badge provider-${getProviderClass(provider.name)}">${provider.name}</span>
            <span style="color: #888;">${provider.families.length} family/families</span>
          </div>
        </div>
        <div style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${provider.families.map(f => `
            <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 4px; font-size: 0.85rem;">${f}</span>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // ============================================
  // PERFORMANCE ACCORDION CONTENT
  // ============================================
  function generatePerformanceAccordionContent(data, performance, hasFullScan, fonts) {
    // Calculate typography statistics from fontMetrics
    const fontMetrics = fonts.fontMetrics || [];
    const typographyStats = calculateTypographyStats(fontMetrics);
    
    return `
      <!-- Core Performance Metrics -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem;">
        ${hasFullScan && performance.initialLoadTime ? `
          <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
            <div style="font-size: 1.5rem; font-weight: bold; color: ${performance.initialLoadTime < 1000 ? '#10b981' : performance.initialLoadTime < 2000 ? '#f59e0b' : '#ef4444'};">${performance.initialLoadTime}ms</div>
            <div style="color: #888; font-size: 0.75rem;">Page Load</div>
          </div>
        ` : ''}
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: ${data.summary.totalFamilies <= 3 ? '#10b981' : data.summary.totalFamilies <= 5 ? '#f59e0b' : '#ef4444'};">${data.summary.totalFamilies}</div>
          <div style="color: #888; font-size: 0.75rem;">Font Families</div>
        </div>
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #4285f4;">${typographyStats.uniqueFonts}</div>
          <div style="color: #888; font-size: 0.75rem;">Unique Fonts</div>
        </div>
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">${typographyStats.uniqueWeights}</div>
          <div style="color: #888; font-size: 0.75rem;">Font Weights</div>
        </div>
        <div class="font-card" style="text-align: center; margin: 0; padding: 0.75rem;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #06b6d4;">${typographyStats.uniqueSizes}</div>
          <div style="color: #888; font-size: 0.75rem;">Font Sizes</div>
        </div>
      </div>
      
      <!-- Typography Scale Analysis -->
      ${typographyStats.sizeBreakdown.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 1rem; color: #888; display: flex; align-items: center; gap: 0.5rem;">
            📏 Typography Scale
            <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 12px; background: ${typographyStats.hasConsistentScale ? 'rgba(16, 185, 129, 0.2); color: #10b981' : 'rgba(245, 158, 11, 0.2); color: #f59e0b'};">
              ${typographyStats.hasConsistentScale ? 'Consistent' : 'Review needed'}
            </span>
          </h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: flex-end;">
            ${typographyStats.sizeBreakdown.slice(0, 8).map(size => `
              <div style="display: flex; flex-direction: column; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 6px; min-width: 60px;">
                <div style="font-size: ${Math.min(parseFloat(size.size), 32)}px; font-weight: 500; line-height: 1; margin-bottom: 0.25rem;">Aa</div>
                <div style="font-size: 0.7rem; color: #888;">${size.size}</div>
                <div style="font-size: 0.65rem; color: #666;">${size.count}×</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Font Weight Distribution -->
      ${typographyStats.weightBreakdown.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin-bottom: 1rem; color: #888;">⚖️ Weight Distribution</h4>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${typographyStats.weightBreakdown.map(weight => `
              <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.05); border-radius: 6px;">
                <span style="font-weight: ${weight.weight}; font-size: 0.9rem;">${weight.weight}</span>
                <span style="font-size: 0.7rem; color: #888; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 10px;">${weight.count}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Typography Usage Table -->
      ${fontMetrics.length > 0 ? `
        <div style="margin-bottom: 1rem;">
          <h4 style="margin-bottom: 1rem; color: #888;">📝 Typography Usage</h4>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
              <thead>
                <tr style="background: rgba(255,255,255,0.05); text-align: left;">
                  <th style="padding: 0.6rem;">Element</th>
                  <th style="padding: 0.6rem;">Font</th>
                  <th style="padding: 0.6rem;">Size</th>
                  <th style="padding: 0.6rem;">Weight</th>
                  <th style="padding: 0.6rem;">Sample</th>
                </tr>
              </thead>
              <tbody>
                ${fontMetrics.slice(0, 12).map(metric => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.6rem;">
                      <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 3px; font-size: 0.75rem;">&lt;${metric.element}&gt;</code>
                    </td>
                    <td style="padding: 0.6rem; font-family: '${metric.fontFamily?.split(',')[0]}', sans-serif; font-size: 0.85rem;">
                      ${metric.fontFamily?.split(',')[0]?.substring(0, 20) || 'N/A'}
                    </td>
                    <td style="padding: 0.6rem; color: #06b6d4;">${metric.fontSize}</td>
                    <td style="padding: 0.6rem; color: #a78bfa;">${metric.fontWeight}</td>
                    <td style="padding: 0.6rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #666; font-size: 0.75rem;">
                      ${metric.textContent?.substring(0, 40) || '—'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ${fontMetrics.length > 12 ? `<p style="color: #666; font-size: 0.75rem; margin-top: 0.5rem;">+ ${fontMetrics.length - 12} more elements analyzed</p>` : ''}
        </div>
      ` : `
        <div style="background: rgba(66, 133, 244, 0.1); border-left: 4px solid #4285f4; padding: 1rem; border-radius: 0 6px 6px 0;">
          <p style="margin: 0; font-size: 0.9rem;">Run a full scan to see detailed typography usage analysis.</p>
        </div>
      `}
      
      <!-- Performance Tips -->
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(16, 185, 129, 0.05); border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.2);">
        <h4 style="margin: 0 0 0.5rem 0; color: #10b981; font-size: 0.9rem;">💡 Typography Performance Tips</h4>
        <ul style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; color: #888;">
          ${data.summary.totalFamilies > 3 ? `<li>Consider reducing font families from ${data.summary.totalFamilies} to 2-3 for faster loading</li>` : ''}
          ${typographyStats.uniqueWeights > 4 ? `<li>Using ${typographyStats.uniqueWeights} font weights - consider consolidating to 3-4</li>` : ''}
          ${typographyStats.uniqueSizes > 8 ? `<li>${typographyStats.uniqueSizes} different font sizes detected - aim for a consistent type scale (6-8 sizes)</li>` : ''}
          ${data.summary.totalFamilies <= 3 && typographyStats.uniqueWeights <= 4 ? `<li>Good job! Your typography setup is well-optimized for performance</li>` : ''}
        </ul>
      </div>
    `;
  }
  
  // Calculate typography statistics from font metrics
  function calculateTypographyStats(fontMetrics) {
    const fonts = new Set();
    const weights = new Set();
    const sizes = new Map();
    const weightCounts = new Map();
    
    fontMetrics.forEach(m => {
      if (m.fontFamily) {
        const primaryFont = m.fontFamily.split(',')[0]?.replace(/['"]/g, '').trim();
        if (primaryFont) fonts.add(primaryFont);
      }
      if (m.fontWeight) {
        weights.add(m.fontWeight);
        weightCounts.set(m.fontWeight, (weightCounts.get(m.fontWeight) || 0) + 1);
      }
      if (m.fontSize) {
        sizes.set(m.fontSize, (sizes.get(m.fontSize) || 0) + 1);
      }
    });
    
    // Sort sizes by pixel value
    const sizeBreakdown = Array.from(sizes.entries())
      .map(([size, count]) => ({ size, count, px: parseFloat(size) }))
      .sort((a, b) => b.px - a.px);
    
    const weightBreakdown = Array.from(weightCounts.entries())
      .map(([weight, count]) => ({ weight, count }))
      .sort((a, b) => parseInt(a.weight) - parseInt(b.weight));
    
    // Check if sizes follow a consistent scale (roughly 1.2-1.5 ratio between sizes)
    let hasConsistentScale = true;
    if (sizeBreakdown.length >= 3) {
      const pxValues = sizeBreakdown.map(s => s.px).filter(px => !isNaN(px) && px > 0);
      for (let i = 1; i < Math.min(pxValues.length, 5); i++) {
        const ratio = pxValues[i-1] / pxValues[i];
        if (ratio < 1.1 || ratio > 2.0) {
          hasConsistentScale = false;
          break;
        }
      }
    }
    
    return {
      uniqueFonts: fonts.size,
      uniqueWeights: weights.size,
      uniqueSizes: sizes.size,
      sizeBreakdown,
      weightBreakdown,
      hasConsistentScale
    };
  }

  // ============================================
  // RECOMMENDATIONS ACCORDION CONTENT
  // ============================================
  function generateRecommendationsAccordionContent(data, bestPractices) {
    const allRecs = [...(data.recommendations || [])];
    
    return `
      <!-- Quick Fixes with Copy Buttons -->
      <div style="margin-bottom: 1.5rem;">
        <h4 style="margin-bottom: 1rem; color: #888;">Quick Performance Fixes</h4>
        
        <div class="font-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>1. Add Preconnect for External Fonts</strong>
            <button class="copy-btn" onclick="copyCode(this, 'preconnect-code')">📋 Copy</button>
          </div>
          <pre id="preconnect-code" style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; margin: 0;">&lt;link rel="preconnect" href="https://fonts.googleapis.com"&gt;
&lt;link rel="preconnect" href="https://fonts.gstatic.com" crossorigin&gt;</pre>
        </div>
        
        <div class="font-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>2. Add font-display: swap</strong>
            <button class="copy-btn" onclick="copyCode(this, 'display-code')">📋 Copy</button>
          </div>
          <pre id="display-code" style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; margin: 0;">/* In your Google Fonts URL: */
https://fonts.googleapis.com/css2?family=Roboto&amp;display=swap

/* Or in @font-face: */
@font-face {
  font-family: 'MyFont';
  font-display: swap;
  src: url('font.woff2') format('woff2');
}</pre>
        </div>
        
        <div class="font-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong>3. Preload Critical Fonts</strong>
            <button class="copy-btn" onclick="copyCode(this, 'preload-code')">📋 Copy</button>
          </div>
          <pre id="preload-code" style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto; margin: 0;">&lt;link rel="preload" href="/fonts/main.woff2" as="font" type="font/woff2" crossorigin&gt;</pre>
        </div>
      </div>
      
      <!-- Detailed Recommendations -->
      ${allRecs.length > 0 ? `
        <h4 style="margin-bottom: 1rem; color: #888;">Site-Specific Recommendations</h4>
        ${allRecs.map(rec => `
          <div style="background: rgba(66, 133, 244, 0.05); border-left: 4px solid ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'}; padding: 1rem; margin-bottom: 0.75rem; border-radius: 0 8px 8px 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="color: ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'};">${rec.title}</strong>
              <span class="issue-badge" style="background: ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'}; color: white;">${rec.priority}</span>
            </div>
            <p style="margin: 0.5rem 0; color: #ccc;">${rec.description}</p>
            <p style="margin: 0; font-size: 0.85rem; color: #888;">👉 ${rec.action}</p>
          </div>
        `).join('')}
      ` : ''}
      
      <!-- Best Practices -->
      ${bestPractices.recommendations && bestPractices.recommendations.length > 0 ? `
        <h4 style="margin: 1.5rem 0 1rem 0; color: #888;">Best Practices Audit (Score: ${bestPractices.score || 0}/100)</h4>
        <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 1rem;">
          ${bestPractices.recommendations.slice(0, 6).map(rec => `
            <div style="display: flex; align-items: flex-start; margin-bottom: 0.75rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
              <span style="color: ${rec.type === 'error' ? '#ef4444' : rec.type === 'warning' ? '#f59e0b' : '#10b981'}; margin-right: 0.75rem; font-size: 1.2rem;">
                ${rec.type === 'error' ? '❌' : rec.type === 'warning' ? '⚠️' : '✅'}
              </span>
              <div>
                <div style="font-weight: 500;">${rec.message || rec.title}</div>
                ${rec.detail ? `<div style="color: #888; font-size: 0.85rem; margin-top: 0.25rem;">${rec.detail}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  // ============================================
  // AI SUGGESTIONS GENERATOR
  // ============================================
  function generateAISuggestions(data, fonts) {
    const suggestions = [];
    
    // Font pairing suggestion
    if (data.families.length >= 2) {
      suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Font Pairing:</strong> Consider using "${data.families[0]?.name}" for headings and "${data.families[1]?.name}" for body text for visual hierarchy.</p>`);
    }
    
    // Performance suggestion
    if (data.summary.totalFamilies > 3) {
      suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Performance Tip:</strong> You're loading ${data.summary.totalFamilies} font families. Consider reducing to 2-3 for faster load times (potential 200-400ms improvement).</p>`);
    }
    
    // Provider suggestion
    if (data.providers.length > 1) {
      suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Consolidation:</strong> Fonts are loaded from ${data.providers.length} different providers. Consolidating to one provider reduces DNS lookups.</p>`);
    }
    
    // Accessibility suggestion
    suggestions.push(`<p style="margin: 0.5rem 0;"><strong>Accessibility:</strong> Ensure body text is at least 16px with line-height of 1.5 for optimal readability.</p>`);
    
    if (suggestions.length === 0) {
      suggestions.push(`<p style="margin: 0.5rem 0;">Your font setup looks optimized! Keep monitoring for any new issues.</p>`);
    }
    
    return suggestions.join('');
  }

  // ============================================
  // CHART INITIALIZATION
  // ============================================
  function initializeCharts(data, fonts) {
    // Provider Distribution Chart
    const providerCtx = document.getElementById('providerChart');
    if (providerCtx && typeof Chart !== 'undefined') {
      const providerData = data.providers.length > 0 
        ? data.providers.map(p => ({ name: p.name, count: p.families.length }))
        : [{ name: 'Self-hosted', count: data.summary.totalFamilies }];
      
      new Chart(providerCtx, {
        type: 'doughnut',
        data: {
          labels: providerData.map(p => p.name),
          datasets: [{
            data: providerData.map(p => p.count),
            backgroundColor: ['#4285f4', '#ff0000', '#10b981', '#ff6b35', '#528dd7', '#6b7280'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#888', font: { size: 11 } }
            }
          }
        }
      });
    }
    
    // Weight Distribution Chart
    const weightCtx = document.getElementById('weightChart');
    if (weightCtx && typeof Chart !== 'undefined') {
      const weights = {};
      data.families.forEach(f => {
        if (f.variants) {
          f.variants.forEach(v => {
            const w = v.weight || v || '400';
            weights[w] = (weights[w] || 0) + 1;
          });
        }
      });
      
      new Chart(weightCtx, {
        type: 'bar',
        data: {
          labels: Object.keys(weights).sort(),
          datasets: [{
            label: 'Usage Count',
            data: Object.values(weights),
            backgroundColor: '#10b981',
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false }
          },
          scales: {
            y: { 
              beginAtZero: true,
              ticks: { color: '#888' },
              grid: { color: 'rgba(255,255,255,0.1)' }
            },
            x: {
              ticks: { color: '#888' },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  // ============================================
  // EXPORT FUNCTIONS (Global scope)
  // ============================================
  window.copyCode = function(btn, codeId) {
    const code = document.getElementById(codeId).textContent;
    navigator.clipboard.writeText(code).then(() => {
      btn.textContent = '✅ Copied!';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = '📋 Copy';
        btn.classList.remove('copied');
      }, 2000);
    });
  };

  window.exportToPDF = async function() {
    if (!currentResults) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('Font Analysis Report', 20, 20);
    
    doc.setFontSize(12);
    doc.text('URL: ' + currentResults.url, 20, 35);
    doc.text('Health Score: ' + currentResults.healthScore + '/100', 20, 45);
    doc.text('Font Families: ' + currentResults.summary.totalFamilies, 20, 55);
    doc.text('Providers: ' + currentResults.summary.totalProviders, 20, 65);
    doc.text('Issues Found: ' + (currentResults.summary.duplicateCount + currentResults.summary.displayIssueCount + currentResults.summary.preloadIssueCount), 20, 75);
    
    doc.setFontSize(14);
    doc.text('Font Families:', 20, 95);
    
    let yPos = 105;
    currentResults.families.slice(0, 15).forEach(f => {
      doc.setFontSize(10);
      doc.text('• ' + f.name + ' (' + (f.variants?.length || 0) + ' variants)', 25, yPos);
      yPos += 8;
    });
    
    doc.save('font-analysis-' + new Date().toISOString().split('T')[0] + '.pdf');
  };

  window.exportToCSS = function() {
    if (!currentResults) return;
    
    let css = '/* Font families detected by Site Mechanic */\n\n';
    
    currentResults.families.forEach(f => {
      css += '/* ' + f.name + ' */\n';
      css += '.font-' + f.name.toLowerCase().replace(/\s+/g, '-') + ' {\n';
      css += "  font-family: '" + f.name + "', sans-serif;\n";
      css += '}\n\n';
    });
    
    const blob = new Blob([css], { type: 'text/css' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fonts.css';
    a.click();
  };

  window.copyShareLink = function() {
    // Check Pro status before sharing
    if (window.ExportGate && !window.ExportGate.isPro()) {
      window.ExportGate.showPaywall();
      return;
    }
    
    const url = window.location.origin + window.location.pathname + '?url=' + encodeURIComponent(urlInput.value);
    navigator.clipboard.writeText(url).then(() => {
      alert('Share link copied to clipboard!');
    });
  };

  function getScoreClass(score) {
    if (score >= 80) return 'score-good';
    if (score >= 60) return 'score-warning';
    return 'score-poor';
  }

  function getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function getProviderClass(name) {
    const lower = name.toLowerCase();
    if (lower.includes('google')) return 'google';
    if (lower.includes('adobe') || lower.includes('typekit')) return 'adobe';
    if (lower.includes('bunny')) return 'bunny';
    if (lower.includes('fontawesome') || lower.includes('font awesome')) return 'fontawesome';
    if (lower.includes('self')) return 'self';
    return 'unknown';
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function isDuplicate(familyName, duplicates) {
    if (!duplicates) return false;
    return duplicates.some(d => d.family === familyName || d.name === familyName);
  }

  function hasDisplayIssue(familyName, displayIssues) {
    if (!displayIssues) return false;
    return displayIssues.some(d => d.family === familyName || d.name === familyName);
  }

  /**
   * Add ASCII art patience message to loading container
   */
  function addPatienceMessage(container) {
    // Remove existing patience message if any
    const existing = document.getElementById('patience-message');
    if (existing) existing.remove();
    
    const patienceEl = document.createElement('div');
    patienceEl.id = 'patience-message';
    patienceEl.style.cssText = `
      margin: 0 0 1.5rem 0;
      padding: 1rem;
      background: rgba(0, 255, 65, 0.05);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    patienceEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: #00ff41;">
        ⏳ Font analysis in progress...<br>
        <span style="font-size: 0.75rem; color: #00ffaa;">This may take 20-45 seconds</span>
      </div>
    `;
    
    // Add animations if not already added
    if (!document.getElementById('patience-animations')) {
      const style = document.createElement('style');
      style.id = 'patience-animations';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: #00ff41; }
          20% { color: #00ffaa; }
          40% { color: #00aaff; }
          60% { color: #aa00ff; }
          80% { color: #ff00aa; }
          100% { color: #00ff41; }
        }
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .ascii-art-responsive {
          font-size: clamp(0.35rem, 1.2vw, 0.65rem);
          white-space: pre;
          max-width: 100%;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Insert at the beginning of the loading container
    const loaderDiv = container.querySelector('.analyzer-loading');
    if (loaderDiv) {
      loaderDiv.insertBefore(patienceEl, loaderDiv.firstChild);
    } else {
      container.insertBefore(patienceEl, container.firstChild);
    }
  }
});
