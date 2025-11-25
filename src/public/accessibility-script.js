/**
 * Accessibility Analyzer - Frontend Script
 * Handles UI interactions and displays accessibility analysis results
 */

// DOM Elements
const urlInput = document.getElementById('urlInput');
const analyzeButton = document.getElementById('analyzeButton');
const results = document.getElementById('results');
const loadingMessage = document.getElementById('loadingMessage');
const resultsContent = document.getElementById('resultsContent');
const errorMessage = document.getElementById('errorMessage');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

// Event Listeners
analyzeButton.addEventListener('click', analyzeAccessibility);
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeAccessibility();
});

// Auto-start scan if URL parameter is present
if (typeof window.getUrlParameter === 'function') {
  const autoUrl = window.getUrlParameter();
  if (autoUrl) {
    console.log('→ Auto-starting Accessibility analysis for:', autoUrl);
    urlInput.value = autoUrl;
    setTimeout(() => {
      analyzeAccessibility();
    }, 500);
  }
}

/**
 * Main analysis function
 */
async function analyzeAccessibility() {
  const url = urlInput.value.trim();
  
  if (!url) {
    showError('Please enter a valid URL');
    return;
  }

  // Reset UI
  results.classList.add('hidden');
  errorMessage.classList.add('hidden');

  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    results.parentNode.insertBefore(loadingContainer, results);
  }

  // Initialize the analyzer loader
  const loader = new AnalyzerLoader('loadingContainer');
  
  // Add ASCII art patience message
  const loaderMessageEl = document.createElement('div');
  loaderMessageEl.id = 'patience-message';
  loaderMessageEl.style.cssText = `
    margin: 0 0 1.5rem 0;
    padding: 1rem;
    background: rgba(0, 255, 65, 0.05);
    border: 1px solid rgba(0, 255, 65, 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\\\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\\\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: #00ff41; font-weight: 600; letter-spacing: 0.05em;">
      Comprehensive analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(0, 255, 65, 0.7);">
      This may take 30-60 seconds
    </p>
  `;

  // Add color cycling style if not already added
  if (!document.getElementById('ascii-art-style')) {
    const style = document.createElement('style');
    style.id = 'ascii-art-style';
    style.textContent = `
      @keyframes color-cycle {
        0% { color: #00ff41; }
        20% { color: #00ffff; }
        40% { color: #0099ff; }
        60% { color: #9933ff; }
        80% { color: #ff33cc; }
        100% { color: #00ff41; }
      }
      .ascii-art-responsive {
        font-size: clamp(0.35rem, 1.2vw, 0.65rem);
        animation: color-cycle 4s linear infinite;
        white-space: pre;
        max-width: 100%;
      }
      #patience-message {
        overflow: visible;
      }
      #patience-message > div {
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(style);
  }
  
  const analysisSteps = [
    {
      label: 'Initializing WCAG audit',
      detail: 'Starting accessibility analysis...'
    },
    {
      label: 'Checking color contrast',
      detail: 'Testing text readability and WCAG ratios...'
    },
    {
      label: 'Testing keyboard navigation',
      detail: 'Verifying tab order and focus management...'
    },
    {
      label: 'Analyzing ARIA attributes',
      detail: 'Checking semantic markup and labels...'
    },
    {
      label: 'Testing screen reader compatibility',
      detail: 'Evaluating assistive technology support...'
    }
  ];

  loader.start(analysisSteps, '[ACCESSIBILITY ANALYZER]', 20);
  
  // Insert ASCII art message after loader starts
  setTimeout(() => {
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer && loaderMessageEl) {
      loadingContainer.insertBefore(loaderMessageEl, loadingContainer.firstChild);
    }
  }, 100);

  try {
    // Call API
    const response = await fetch('/api/accessibility', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }

    const data = await response.json();
    
    // Complete the loader
    loader.complete();
    
    // Show results after animation completes
    setTimeout(() => {
      displayAccessibilityResults(data);
      results.classList.remove('hidden');
    }, 1000);

  } catch (error) {
    loader.showError(error.message || 'Failed to analyze accessibility. Please try again.');
    console.error('Accessibility analysis error:', error);
  }
}

/**
 * Animate progress bar
 */
function animateProgress() {
  const stages = [
    { progress: 20, text: 'Running Lighthouse accessibility audit...' },
    { progress: 40, text: 'Analyzing color contrast ratios...' },
    { progress: 60, text: 'Testing keyboard navigation...' },
    { progress: 80, text: 'Validating ARIA implementation...' },
    { progress: 95, text: 'Compiling accessibility report...' }
  ];

  let currentStage = 0;
  const interval = setInterval(() => {
    if (currentStage < stages.length) {
      progressBar.style.width = `${stages[currentStage].progress}%`;
      progressText.textContent = stages[currentStage].text;
      currentStage++;
    } else {
      clearInterval(interval);
      progressBar.style.width = '100%';
      progressText.textContent = 'Analysis complete!';
    }
  }, 2000);
}

/**
 * Display accessibility results
 */
function displayAccessibilityResults(results) {
  const container = resultsContent;
  container.innerHTML = '';

  // Summary Section
  const summary = document.createElement('div');
  summary.className = 'section';
  summary.innerHTML = `
    <h2>[ACCESSIBILITY_OVERVIEW]</h2>
    
    <!-- Performance Score Overview -->
    <div style="
      background: linear-gradient(135deg, rgba(138,43,226,0.05) 0%, rgba(138,43,226,0.02) 100%);
      border: 2px solid ${getAccessibilityColor(results.accessibilityScore)};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px rgba(138,43,226,0.15);
    ">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: center;">
        <!-- Left: Accessibility Score Circle -->
        <div style="text-align: center;">
          <div style="
            width: 180px;
            height: 180px;
            border-radius: 50%;
            background: #ffffff;
            border: 5px solid ${getAccessibilityColor(results.accessibilityScore)};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 30px ${getAccessibilityColor(results.accessibilityScore)}40, 0 4px 15px rgba(0,0,0,0.2);
          ">
            <div style="
              font-size: 4.5rem;
              font-weight: 900;
              color: #000000;
              line-height: 1;
            ">${results.accessibilityScore}</div>
            <div style="
              font-size: 0.9rem;
              color: #666666;
              margin-top: 0.5rem;
              text-transform: uppercase;
              letter-spacing: 2px;
              font-weight: 600;
            ">/ 100</div>
          </div>
          <div style="
            margin-top: 1rem;
            font-size: 1.5rem;
            font-weight: bold;
            color: ${getAccessibilityColor(results.accessibilityScore)};
            text-shadow: 0 0 10px ${getAccessibilityColor(results.accessibilityScore)}80;
          ">${getAccessibilityGrade(results.accessibilityScore)}</div>
        </div>
        
        <!-- Right: Quick Stats -->
        <div>
          <h3 style="color: #bb86fc; margin: 0 0 1rem 0; font-size: 1.3rem;">>> Quick Stats</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">WCAG Level</span>
              <span style="color: #bb86fc; font-weight: bold;">${results.wcagLevel || 'AA'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Violations Found</span>
              <span style="color: ${results.violationsCount > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold;">${results.violationsCount || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Contrast Issues</span>
              <span style="color: ${results.contrastIssues > 0 ? '#ffa500' : '#00ff41'}; font-weight: bold;">${results.contrastIssues || 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: #c0c0c0;">Best Practices</span>
              <span style="color: #bb86fc; font-weight: bold;">${results.bestPracticesCount || 0} passed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  container.appendChild(summary);
  
  // Store results globally for PDF generation
  window.currentAccessibilityResults = results;

  // Desktop vs Mobile Comparison Section
  if (results.desktop && results.mobile) {
    const comparisonSection = document.createElement('div');
    comparisonSection.className = 'section';
    comparisonSection.innerHTML = createDesktopMobileComparison(results);
    container.appendChild(comparisonSection);
  }

  // WCAG Compliance Levels Section
  const wcagLevelsSection = document.createElement('div');
  wcagLevelsSection.className = 'section';
  wcagLevelsSection.innerHTML = createWCAGLevelsSection(results);
  container.appendChild(wcagLevelsSection);

  // Calculate average scores for accordion headers
  const avgWcagScore = results.desktop?.wcag?.score && results.mobile?.wcag?.score 
    ? Math.round((results.desktop.wcag.score + results.mobile.wcag.score) / 2)
    : (results.desktop?.wcag?.score || results.mobile?.wcag?.score || 0);

  const avgContrastScore = results.contrast?.score || 0;
  const avgKeyboardScore = results.keyboard?.score || 0;
  const avgAriaScore = results.aria?.score || 0;

  // Create accordion sections
  createAccordionSection(container, 'wcag-compliance', 'WCAG 2.1 Compliance', () => renderWCAGContent(results.desktop?.wcag, results.mobile?.wcag), avgWcagScore);
  createAccordionSection(container, 'color-contrast', 'Color Contrast Analysis', () => renderContrastContent(results.contrast), avgContrastScore);
  createAccordionSection(container, 'keyboard-navigation', 'Keyboard Navigation', () => renderKeyboardContent(results.keyboard), avgKeyboardScore);
  createAccordionSection(container, 'aria-implementation', 'ARIA & Semantics', () => renderARIAContent(results.aria), avgAriaScore);
  createAccordionSection(container, 'recommendations', 'Accessibility Recommendations', () => renderRecommendationsContent(results.recommendations), null);
}

/**
 * Create WCAG Compliance Levels Section
 */
function createWCAGLevelsSection(results) {
  // Determine current WCAG level based on score
  const score = results.accessibilityScore || 0;
  let currentLevel = 'None';
  if (score >= 95) currentLevel = 'AAA';
  else if (score >= 80) currentLevel = 'AA';
  else if (score >= 60) currentLevel = 'A';

  return `
    <h2>[WCAG_COMPLIANCE_LEVELS]</h2>
    <div style="padding-left: 1rem;">
      <p style="color: #ffd700; margin-bottom: 1.5rem;">>> Understanding WCAG 2.1 Conformance Levels</p>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Level A Card -->
        <div style="
          background: linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.05) 100%);
          border: 2px solid ${currentLevel === 'A' ? '#ffd700' : 'rgba(255,215,0,0.3)'};
          border-radius: 12px;
          padding: 1.5rem;
          ${currentLevel === 'A' ? 'box-shadow: 0 0 20px rgba(255,215,0,0.3);' : ''}
        ">
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid #ffd700;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px rgba(255,215,0,0.4), 0 2px 8px rgba(0,0,0,0.15);
            ">A</div>
          </div>
          <h3 style="color: #ffd700; text-align: center; margin: 0 0 1rem 0; font-size: 1.2rem;">
            Level A
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #ffd700;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(255,215,0,0.2);
              border: 1px solid rgba(255,215,0,0.4);
            ">Minimum Accessibility</span>
          </div>
          <p style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            Removes the most critical barriers to access for people with disabilities. Websites meeting Level A are considered barely accessible.
          </p>
          <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: #808080; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">Key Requirements:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>Text alternatives for images</li>
              <li>Keyboard accessibility</li>
              <li>No seizure-inducing content</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: #808080; font-size: 0.8rem;">
            ◉ Score: 60-79
          </div>
        </div>

        <!-- Level AA Card -->
        <div style="
          background: linear-gradient(135deg, rgba(0,255,65,0.15) 0%, rgba(0,255,65,0.05) 100%);
          border: 2px solid ${currentLevel === 'AA' ? '#00ff41' : 'rgba(0,255,65,0.3)'};
          border-radius: 12px;
          padding: 1.5rem;
          ${currentLevel === 'AA' ? 'box-shadow: 0 0 20px rgba(0,255,65,0.3);' : ''}
        ">
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid #00ff41;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.8rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px rgba(0,255,65,0.4), 0 2px 8px rgba(0,0,0,0.15);
            ">AA</div>
          </div>
          <h3 style="color: #00ff41; text-align: center; margin: 0 0 1rem 0; font-size: 1.2rem;">
            Level AA
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #00ff41;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(0,255,65,0.2);
              border: 1px solid rgba(0,255,65,0.4);
            ">Industry Standard</span>
          </div>
          <p style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            The accepted legal and industry standard (ADA, Section 508, EN 301 549). Ensures content is accessible to most users with disabilities.
          </p>
          <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: #808080; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">Key Requirements:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>Sufficient color contrast (4.5:1)</li>
              <li>Visible focus indicators</li>
              <li>Content reflows properly</li>
              <li>All Level A requirements</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: #808080; font-size: 0.8rem;">
            ◉ Score: 80-94
          </div>
        </div>

        <!-- Level AAA Card -->
        <div style="
          background: linear-gradient(135deg, rgba(0,217,255,0.15) 0%, rgba(0,217,255,0.05) 100%);
          border: 2px solid ${currentLevel === 'AAA' ? '#00d9ff' : 'rgba(0,217,255,0.3)'};
          border-radius: 12px;
          padding: 1.5rem;
          ${currentLevel === 'AAA' ? 'box-shadow: 0 0 20px rgba(0,217,255,0.3);' : ''}
        ">
          <div style="text-align: center; margin-bottom: 1rem;">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid #00d9ff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.5rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px rgba(0,217,255,0.4), 0 2px 8px rgba(0,0,0,0.15);
            ">AAA</div>
          </div>
          <h3 style="color: #00d9ff; text-align: center; margin: 0 0 1rem 0; font-size: 1.2rem;">
            Level AAA
          </h3>
          <div style="text-align: center; margin-bottom: 1rem;">
            <span style="
              color: #00d9ff;
              font-size: 0.9rem;
              padding: 0.3rem 0.8rem;
              border-radius: 4px;
              background: rgba(0,217,255,0.2);
              border: 1px solid rgba(0,217,255,0.4);
            ">Highest Accessibility</span>
          </div>
          <p style="color: #c0c0c0; font-size: 0.9rem; line-height: 1.6; margin-bottom: 1rem;">
            Most comprehensive level of accessibility. Provides the best possible experience for all users, including those with severe disabilities.
          </p>
          <div style="background: rgba(0,0,0,0.3); border-radius: 6px; padding: 1rem; margin-top: 1rem;">
            <div style="color: #808080; font-size: 0.85rem; margin-bottom: 0.5rem; font-weight: 600;">Key Requirements:</div>
            <ul style="color: #b0b0b0; font-size: 0.85rem; margin: 0; padding-left: 1.2rem; line-height: 1.8;">
              <li>Sign language interpretation</li>
              <li>Extended audio descriptions</li>
              <li>Very high contrast (7:1)</li>
              <li>All Level A & AA requirements</li>
            </ul>
          </div>
          <div style="margin-top: 1rem; text-align: center; color: #808080; font-size: 0.8rem;">
            ◉ Score: 95-100
          </div>
        </div>
      </div>

      <!-- Current Level Status -->
      <div style="
        background: linear-gradient(135deg, ${currentLevel === 'AAA' ? 'rgba(0,217,255,0.1)' : currentLevel === 'AA' ? 'rgba(0,255,65,0.1)' : currentLevel === 'A' ? 'rgba(255,215,0,0.1)' : 'rgba(255,68,68,0.1)'} 0%, rgba(0,0,0,0.05) 100%);
        border: 2px solid ${currentLevel === 'AAA' ? '#00d9ff' : currentLevel === 'AA' ? '#00ff41' : currentLevel === 'A' ? '#ffd700' : '#ff4444'};
        border-radius: 12px;
        padding: 1.5rem;
        text-align: center;
        box-shadow: 0 4px 15px ${currentLevel === 'AAA' ? 'rgba(0,217,255,0.2)' : currentLevel === 'AA' ? 'rgba(0,255,65,0.2)' : currentLevel === 'A' ? 'rgba(255,215,0,0.2)' : 'rgba(255,68,68,0.2)'};
      ">
        <h3 style="color: ${currentLevel === 'AAA' ? '#00d9ff' : currentLevel === 'AA' ? '#00ff41' : currentLevel === 'A' ? '#ffd700' : '#ff4444'}; margin: 0 0 1rem 0; font-size: 1.4rem;">
          ${currentLevel === 'None' ? '✗ Not Compliant' : `✓ Meets WCAG Level ${currentLevel}`}
        </h3>
        <p style="color: #c0c0c0; font-size: 1rem; margin: 0;">
          ${currentLevel === 'None' ? 'This website does not meet minimum WCAG accessibility standards. Immediate improvements are needed.' : 
            currentLevel === 'A' ? 'This website meets minimum accessibility standards but has room for improvement to reach the industry-standard Level AA.' :
            currentLevel === 'AA' ? 'This website meets industry-standard accessibility requirements. Consider implementing AAA enhancements for optimal accessibility.' :
            'This website achieves the highest level of accessibility compliance. Excellent work!'}
        </p>
      </div>

      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(138,43,226,0.05); border-radius: 8px; border-left: 3px solid #bb86fc;">
        <p style="color: #bb86fc; font-size: 0.9rem; margin: 0; line-height: 1.6;">
          <strong>ⓘ Note:</strong> Most organizations aim for Level AA compliance as it balances comprehensive accessibility with practical implementation. 
          Level AAA is not always feasible for all content types.
        </p>
      </div>
    </div>
  `;
}

/**
 * Create Desktop vs Mobile Comparison Section
 */
function createDesktopMobileComparison(results) {
  const desktopScore = results.desktop?.accessibilityScore || 0;
  const mobileScore = results.mobile?.accessibilityScore || 0;
  const scoreDiff = Math.abs(desktopScore - mobileScore);
  
  // Check if Lighthouse failed for either platform
  const desktopFailed = results.desktop?.lighthouse?.failed || (results.desktop?.lighthouse?.score === 0 && results.desktop?.lighthouse?.error);
  const mobileFailed = results.mobile?.lighthouse?.failed || (results.mobile?.lighthouse?.score === 0 && results.mobile?.lighthouse?.error);
  const anyFailed = desktopFailed || mobileFailed;

  return `
    <h2>[DESKTOP_VS_MOBILE_COMPARISON]</h2>
    <div style="padding-left: 1rem;">
      <p style="color: #bb86fc; margin-bottom: 1.5rem;">>> Comprehensive accessibility analysis across both platforms</p>
      
      ${anyFailed ? `
        <div style="
          background: rgba(255,165,0,0.1);
          border: 2px solid rgba(255,165,0,0.5);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1.5rem;
          text-align: center;
        ">
          <div style="color: #ffa500; font-size: 1.2rem; margin-bottom: 0.5rem;">~ Partial Analysis</div>
          <p style="color: #c0c0c0; margin: 0; font-size: 0.9rem;">
            ${desktopFailed && mobileFailed ? 'Both desktop and mobile Lighthouse analyses timed out.' : 
              desktopFailed ? 'Desktop Lighthouse analysis timed out.' : 'Mobile Lighthouse analysis timed out.'}
            Using alternative accessibility metrics from axe-core for affected platform(s).
          </p>
        </div>
      ` : ''}
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Desktop Column -->
        <div style="
          background: linear-gradient(135deg, rgba(0,204,255,0.1), rgba(0,102,204,0.05));
          border: 2px solid #00ccff;
          border-radius: 8px;
          padding: 1.5rem;
        ">
          ${createPlatformCard('D DESKTOP', desktopScore, results.desktop, '#00ccff')}
        </div>
        
        <!-- Mobile Column -->
        <div style="
          background: linear-gradient(135deg, rgba(255,102,0,0.1), rgba(255,102,0,0.05));
          border: 2px solid #ff6600;
          border-radius: 8px;
          padding: 1.5rem;
        ">
          ${createPlatformCard('M MOBILE', mobileScore, results.mobile, '#ff6600')}
        </div>
      </div>
      
      <!-- Accessibility Gap Warning (only show if both analyses succeeded) -->
      ${!anyFailed && scoreDiff > 10 ? `
        <div style="
          background: linear-gradient(135deg, rgba(255,165,0,0.15), rgba(255,68,68,0.15));
          border: 2px solid #ffa500;
          border-radius: 8px;
          padding: 1.5rem;
          margin-top: 1rem;
        ">
          <h4 style="color: #ffa500; margin: 0 0 0.75rem 0; font-size: 1.1rem;">
            ~ Accessibility Gap Detected
          </h4>
          <p style="color: #c0c0c0; margin: 0;">
            There is a ${scoreDiff}-point difference between desktop (${desktopScore}) and mobile (${mobileScore}) accessibility. 
            ${desktopScore > mobileScore ? 'Mobile users may face additional barriers.' : 'Desktop users may face additional barriers.'}
            Review platform-specific issues in the detailed analysis below.
          </p>
        </div>
      ` : !anyFailed ? `
        <div style="
          background: rgba(0,255,65,0.1);
          border: 2px solid #00ff41;
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
        ">
          <p style="color: #00ff41; margin: 0;">
            ✓ Consistent Accessibility - Both platforms scored within ${scoreDiff} points of each other
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Create platform card for comparison
 */
function createPlatformCard(title, score, data, color) {
  // Check if Lighthouse analysis failed
  const lighthouseFailed = data?.lighthouse?.failed || (data?.lighthouse?.score === 0 && data?.lighthouse?.error);
  const lighthouseError = data?.lighthouse?.error || 'Analysis incomplete';
  
  return `
    <div style="text-align: center; margin-bottom: 1rem;">
      <div style="font-size: 1.5rem; color: ${color}; margin-bottom: 0.5rem;">${title}</div>
      <div style="
        width: 120px;
        height: 120px;
        margin: 0 auto;
        border-radius: 50%;
        background: #ffffff;
        border: 4px solid ${lighthouseFailed ? '#666666' : getAccessibilityColor(score)};
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        box-shadow: 0 0 20px ${lighthouseFailed ? '#66666640' : getAccessibilityColor(score) + '40'}, 0 2px 8px rgba(0,0,0,0.15);
      ">
        ${lighthouseFailed ? `
          <div style="
            font-size: 1.5rem;
            font-weight: 900;
            color: #999999;
            line-height: 1.2;
            text-align: center;
            padding: 0.5rem;
          ">N/A</div>
          <div style="color: #666666; font-size: 0.65rem; margin-top: 0.25rem; font-weight: 600; text-align: center; padding: 0 0.5rem;">
            Timeout
          </div>
        ` : `
          <div style="
            font-size: 2.8rem;
            font-weight: 900;
            color: #000000;
            line-height: 1;
          ">${score}</div>
          <div style="color: #666666; font-size: 0.75rem; margin-top: 0.25rem; font-weight: 600;">/ 100</div>
        `}
      </div>
      <div style="
        margin-top: 0.75rem;
        font-weight: bold;
        color: ${lighthouseFailed ? '#999999' : getAccessibilityColor(score)};
      ">${lighthouseFailed ? 'Analysis Failed' : getAccessibilityGrade(score)}</div>
    </div>
    
    ${lighthouseFailed ? `
      <div style="border-top: 1px solid ${color}40; padding-top: 1rem;">
        <div style="
          background: rgba(255,165,0,0.1);
          border: 1px solid rgba(255,165,0,0.3);
          border-radius: 6px;
          padding: 0.75rem;
          text-align: center;
        ">
          <div style="color: #ffa500; font-size: 1.2rem; margin-bottom: 0.5rem;">⧗</div>
          <div style="color: #c0c0c0; font-size: 0.85rem; line-height: 1.4;">
            Lighthouse analysis timed out after 45 seconds. This can happen with:
          </div>
          <ul style="text-align: left; color: #999999; font-size: 0.8rem; margin: 0.5rem 0 0 1.5rem; padding: 0; line-height: 1.6;">
            <li>Slow-loading websites</li>
            <li>Heavy JavaScript execution</li>
            <li>Anti-bot protection</li>
            <li>Server-side rendering delays</li>
          </ul>
          <div style="color: #b0b0b0; font-size: 0.75rem; margin-top: 0.75rem; font-style: italic;">
            Using alternative accessibility metrics from axe-core instead
          </div>
        </div>
      </div>
    ` : `
      <div style="border-top: 1px solid ${color}40; padding-top: 1rem;">
        <h4 style="color: ${color}; margin: 0 0 0.75rem 0; font-size: 1rem;">Lighthouse Scores</h4>
        <div style="display: grid; gap: 0.5rem;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">A Accessibility</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.accessibility || 0)}; font-weight: bold;">
              ${data?.lighthouse?.accessibility || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">P Performance</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.performance || 0)}; font-weight: bold;">
              ${data?.lighthouse?.performance || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">B Best Practices</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.bestPractices || 0)}; font-weight: bold;">
              ${data?.lighthouse?.bestPractices || 0}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #c0c0c0;">S SEO</span>
            <span style="color: ${getAccessibilityColor(data?.lighthouse?.seo || 0)}; font-weight: bold;">
              ${data?.lighthouse?.seo || 0}
            </span>
          </div>
        </div>
      </div>
    `}
  `;
}

/**
 * Create an accordion section
 */
function createAccordionSection(container, id, displayTitle, contentCreator, score) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span>${displayTitle}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getAccessibilityColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
      <span class="accordion-toggle">▼</span>
    </span>
  `;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  
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
      header.querySelector('.accordion-toggle').classList.remove('rotated');
    } else {
      // Expand and create content if not already created
      if (!contentInner.hasChildNodes()) {
        const contentHTML = contentCreator();
        contentInner.innerHTML = contentHTML;
      }
      
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
      header.querySelector('.accordion-toggle').classList.add('rotated');
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
}

/**
 * Render WCAG Compliance Content
 */
function renderWCAGContent(desktopWcag, mobileWcag) {
  if (!desktopWcag && !mobileWcag) {
    return '<p style="color: #ff6600;">>>> WCAG compliance data not available</p>';
  }

  // Helper to render criterion row
  const renderCriterionRow = (criterion, desktopStatus, mobileStatus) => {
    const getStatusBadge = (status) => {
      const styles = {
        pass: { color: '#00ff41', icon: '✓', label: 'Pass' },
        fail: { color: '#ff4444', icon: '✗', label: 'Fail' },
        warning: { color: '#ffa500', icon: '~', label: 'Warning' },
        na: { color: '#808080', icon: '–', label: 'N/A' }
      };
      return styles[status] || styles.na;
    };

    const dBadge = getStatusBadge(desktopStatus);
    const mBadge = getStatusBadge(mobileStatus);

    return `
      <tr>
        <td style="color: #bb86fc;">${criterion}</td>
        <td style="text-align: center;">
          <span style="color: ${dBadge.color}; font-size: 1.2rem;">${dBadge.icon}</span>
        </td>
        <td style="text-align: center;">
          <span style="
            color: ${dBadge.color};
            font-size: 0.85rem;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            background: ${dBadge.color}20;
          ">${dBadge.label}</span>
        </td>
        <td style="text-align: center;">
          <span style="color: ${mBadge.color}; font-size: 1.2rem;">${mBadge.icon}</span>
        </td>
        <td style="text-align: center;">
          <span style="
            color: ${mBadge.color};
            font-size: 0.85rem;
            padding: 0.25rem 0.5rem;
            border-radius: 3px;
            background: ${mBadge.color}20;
          ">${mBadge.label}</span>
        </td>
      </tr>
    `;
  };

  return `
    <div style="padding-left: 1rem;">
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> WCAG 2.1 Compliance Status</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Web Content Accessibility Guidelines (WCAG) 2.1 Level AA compliance audit across both platforms.
      </p>
      
      <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
        <thead>
          <tr>
            <th style="text-align: left; width: 40%;">Success Criterion</th>
            <th colspan="2" style="text-align: center; background: rgba(0,204,255,0.1); border-left: 2px solid #00ccff;">
              <span style="color: #00ccff;">D Desktop</span>
            </th>
            <th colspan="2" style="text-align: center; background: rgba(255,102,0,0.1); border-left: 2px solid #ff6600;">
              <span style="color: #ff6600;">M Mobile</span>
            </th>
          </tr>
          <tr style="font-size: 0.85rem;">
            <th style="border-top: 1px solid #333;"></th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">Result</th>
            <th style="text-align: center; width: 15%; border-top: 1px solid #333; background: rgba(0,204,255,0.05);">Status</th>
            <th style="text-align: center; width: 10%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">Result</th>
            <th style="text-align: center; width: 15%; border-top: 1px solid #333; background: rgba(255,102,0,0.05);">Status</th>
          </tr>
        </thead>
        <tbody>
          ${renderCriterionRow('1.1.1 Non-text Content', desktopWcag?.criteria?.nonTextContent || 'pass', mobileWcag?.criteria?.nonTextContent || 'pass')}
          ${renderCriterionRow('1.3.1 Info and Relationships', desktopWcag?.criteria?.infoRelationships || 'pass', mobileWcag?.criteria?.infoRelationships || 'pass')}
          ${renderCriterionRow('1.4.3 Contrast (Minimum)', desktopWcag?.criteria?.contrastMinimum || 'pass', mobileWcag?.criteria?.contrastMinimum || 'pass')}
          ${renderCriterionRow('2.1.1 Keyboard', desktopWcag?.criteria?.keyboard || 'pass', mobileWcag?.criteria?.keyboard || 'pass')}
          ${renderCriterionRow('2.4.1 Bypass Blocks', desktopWcag?.criteria?.bypassBlocks || 'pass', mobileWcag?.criteria?.bypassBlocks || 'pass')}
          ${renderCriterionRow('2.4.2 Page Titled', desktopWcag?.criteria?.pageTitled || 'pass', mobileWcag?.criteria?.pageTitled || 'pass')}
          ${renderCriterionRow('2.4.3 Focus Order', desktopWcag?.criteria?.focusOrder || 'pass', mobileWcag?.criteria?.focusOrder || 'pass')}
          ${renderCriterionRow('3.1.1 Language of Page', desktopWcag?.criteria?.languagePage || 'pass', mobileWcag?.criteria?.languagePage || 'pass')}
          ${renderCriterionRow('4.1.1 Parsing', desktopWcag?.criteria?.parsing || 'pass', mobileWcag?.criteria?.parsing || 'pass')}
          ${renderCriterionRow('4.1.2 Name, Role, Value', desktopWcag?.criteria?.nameRoleValue || 'pass', mobileWcag?.criteria?.nameRoleValue || 'pass')}
        </tbody>
      </table>
      
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(138,43,226,0.05); border-radius: 4px;">
        <h4 style="color: #bb86fc; margin: 0 0 0.5rem 0; font-size: 1rem;">📚 About WCAG 2.1</h4>
        <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
          WCAG 2.1 Level AA is the international standard for web accessibility. Meeting these criteria ensures your website 
          is usable by people with disabilities and complies with legal requirements in many jurisdictions.
        </p>
      </div>
    </div>
  `;
}

/**
 * Render Color Contrast Content
 */
function renderContrastContent(contrast) {
  if (!contrast) {
    return '<p style="color: #ff6600;">>>> Color contrast data not available</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> Color contrast ratios are design-based and apply equally to all platforms.
        </p>
      </div>
      
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> Contrast Ratio Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        WCAG requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text. 
        Found <strong style="color: ${contrast.issuesCount > 0 ? '#ff4444' : '#00ff41'};">${contrast.issuesCount || 0} issues</strong>.
      </p>
      
      ${contrast.issues && contrast.issues.length > 0 ? `
        <table class="seo-table" style="width: 100%; margin-bottom: 1.5rem;">
          <thead>
            <tr>
              <th style="text-align: left;">Element</th>
              <th style="text-align: center;">Contrast Ratio</th>
              <th style="text-align: center;">Required</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${contrast.issues.slice(0, 10).map(issue => `
              <tr>
                <td style="color: #c0c0c0; font-family: monospace; font-size: 0.85rem;">${issue.selector || 'Unknown element'}</td>
                <td style="text-align: center;">
                  <span style="color: ${issue.ratio < 4.5 ? '#ff4444' : '#ffa500'}; font-weight: bold;">
                    ${issue.ratio?.toFixed(2) || 'N/A'}:1
                  </span>
                </td>
                <td style="text-align: center; color: #808080;">${issue.required || '4.5:1'}</td>
                <td style="text-align: center;">
                  <span style="
                    color: ${issue.ratio >= 4.5 ? '#00ff41' : '#ff4444'};
                    font-size: 0.85rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 3px;
                    background: ${issue.ratio >= 4.5 ? '#00ff4120' : '#ff444420'};
                  ">${issue.ratio >= 4.5 ? 'Pass' : 'Fail'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${contrast.issues.length > 10 ? `
          <p style="color: #ffa500; font-size: 0.9rem; margin-top: 0.5rem;">
            ~ Showing 10 of ${contrast.issues.length} contrast issues. Review all issues in detailed audit.
          </p>
        ` : ''}
      ` : `
        <div style="background: rgba(0,255,65,0.1); border: 2px solid #00ff41; border-radius: 8px; padding: 1.5rem; text-align: center;">
          <p style="color: #00ff41; margin: 0; font-size: 1.1rem;">
            ✓ <strong>Excellent Contrast!</strong><br>
            All text elements meet WCAG contrast requirements.
          </p>
        </div>
      `}
    </div>
  `;
}

/**
 * Render Keyboard Navigation Content
 */
function renderKeyboardContent(keyboard) {
  if (!keyboard) {
    return '<p style="color: #ff6600;">>>> Keyboard navigation data not available</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> Keyboard navigation patterns apply universally across devices with keyboard input.
        </p>
      </div>
      
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> Keyboard Accessibility</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        All interactive elements must be accessible via keyboard. Tab order should be logical and focus indicators visible.
      </p>
      
      <div style="display: grid; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid #bb86fc;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #c0c0c0;">T Focusable Elements</span>
            <span style="color: #bb86fc; font-weight: bold; font-size: 1.2rem;">${keyboard.focusableCount || 0}</span>
          </div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid ${keyboard.tabTraps > 0 ? '#ff4444' : '#00ff41'};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #c0c0c0;">🚫 Tab Traps Detected</span>
            <span style="color: ${keyboard.tabTraps > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold; font-size: 1.2rem;">${keyboard.tabTraps || 0}</span>
          </div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; border-left: 4px solid ${keyboard.missingFocusIndicators > 0 ? '#ffa500' : '#00ff41'};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="color: #c0c0c0;">👁️ Missing Focus Indicators</span>
            <span style="color: ${keyboard.missingFocusIndicators > 0 ? '#ffa500' : '#00ff41'}; font-weight: bold; font-size: 1.2rem;">${keyboard.missingFocusIndicators || 0}</span>
          </div>
        </div>
      </div>
      
      ${keyboard.issues && keyboard.issues.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 0.75rem 0;">Keyboard Issues Found</h4>
        <div style="display: grid; gap: 0.75rem;">
          ${keyboard.issues.map(issue => `
            <div style="background: rgba(255,68,68,0.1); border-left: 3px solid #ff4444; padding: 1rem; border-radius: 4px;">
              <div style="color: #ff4444; font-weight: bold; margin-bottom: 0.25rem;">${issue.type || 'Keyboard Issue'}</div>
              <div style="color: #c0c0c0; font-size: 0.9rem;">${issue.description || 'No description available'}</div>
              ${issue.element ? `<div style="color: #808080; font-size: 0.85rem; margin-top: 0.25rem; font-family: monospace;">${issue.element}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render ARIA Implementation Content
 */
function renderARIAContent(aria) {
  if (!aria) {
    return '<p style="color: #ff6600;">>>> ARIA implementation data not available</p>';
  }

  return `
    <div style="padding-left: 1rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(0,204,255,0.1); border-left: 3px solid #00ccff; border-radius: 4px; margin-bottom: 1.5rem;">
        <p style="color: #00ccff; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Platform-Agnostic Metrics:</strong> ARIA attributes and semantic HTML apply universally to assistive technologies.
        </p>
      </div>
      
      <h3 style="color: #bb86fc; margin: 1rem 0 0.5rem 0;">>> ARIA & Semantic HTML</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem;">
        Proper use of ARIA attributes and semantic HTML elements ensures screen readers can understand and navigate your content.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: #bb86fc; margin-bottom: 0.5rem;">${aria.landmarksCount || 0}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">ARIA Landmarks</div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: ${aria.missingLabels > 0 ? '#ff4444' : '#00ff41'}; margin-bottom: 0.5rem;">${aria.missingLabels || 0}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Missing Labels</div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: ${aria.invalidRoles > 0 ? '#ffa500' : '#00ff41'}; margin-bottom: 0.5rem;">${aria.invalidRoles || 0}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Invalid Roles</div>
        </div>
        
        <div style="background: rgba(138,43,226,0.1); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 2rem; color: #bb86fc; margin-bottom: 0.5rem;">${aria.headingStructure || 'Good'}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Heading Structure</div>
        </div>
      </div>
      
      ${aria.issues && aria.issues.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 0.75rem 0;">ARIA Issues Found</h4>
        <table class="seo-table" style="width: 100%;">
          <thead>
            <tr>
              <th style="text-align: left;">Issue Type</th>
              <th style="text-align: left;">Description</th>
              <th style="text-align: center;">Impact</th>
            </tr>
          </thead>
          <tbody>
            ${aria.issues.slice(0, 10).map(issue => `
              <tr>
                <td style="color: #bb86fc; font-weight: bold;">${issue.type || 'ARIA Issue'}</td>
                <td style="color: #c0c0c0; font-size: 0.9rem;">${issue.description || 'No description'}</td>
                <td style="text-align: center;">
                  <span style="
                    color: ${issue.impact === 'critical' ? '#ff4444' : issue.impact === 'serious' ? '#ffa500' : '#00ccff'};
                    font-size: 0.85rem;
                    padding: 0.25rem 0.5rem;
                    border-radius: 3px;
                    background: ${issue.impact === 'critical' ? '#ff444420' : issue.impact === 'serious' ? '#ffa50020' : '#00ccff20'};
                    text-transform: uppercase;
                  ">${issue.impact || 'Moderate'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </div>
  `;
}

/**
 * Render Recommendations Content
 */
function renderRecommendationsContent(recommendations) {
  const introSection = `
    <div style="padding-left: 1rem; margin-bottom: 1.5rem;">
      <div style="padding: 0.75rem 1rem; background: rgba(255,165,0,0.1); border-left: 3px solid #ffa500; border-radius: 4px;">
        <p style="color: #ffa500; font-size: 0.9rem; margin: 0;">
          ⓘ <strong>Cross-Platform Recommendations:</strong> These accessibility improvements are analyzed based on both desktop and mobile to ensure inclusive design.
        </p>
      </div>
    </div>
  `;
  
  if (!recommendations || !recommendations.length) {
    return `
      ${introSection}
      <div style="padding: 2rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">A</div>
        <h3 style="color: #bb86fc; margin: 0 0 0.5rem 0;">Excellent Accessibility!</h3>
        <p style="color: #c0c0c0;">No critical accessibility issues found. Your site meets WCAG 2.1 guidelines across both desktop and mobile!</p>
      </div>
    `;
  }

  // Group by priority
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low');

  const getPriorityBadge = (priority) => {
    const styles = {
      high: { bg: 'rgba(255,68,68,0.15)', color: '#ff4444', border: '#ff4444', icon: 'H', label: 'CRITICAL' },
      medium: { bg: 'rgba(255,165,0,0.15)', color: '#ffa500', border: '#ffa500', icon: 'M', label: 'IMPORTANT' },
      low: { bg: 'rgba(0,204,255,0.15)', color: '#00ccff', border: '#00ccff', icon: 'L', label: 'MINOR' }
    };
    return styles[priority] || styles.medium;
  };

  const renderRecommendationCard = (rec) => {
    const badge = getPriorityBadge(rec.priority);
    return `
      <div style="
        background: ${badge.bg};
        border: 2px solid ${badge.border};
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h4 style="color: ${badge.color}; margin: 0; font-size: 1.1rem;">
            ${badge.icon} ${rec.title || 'Accessibility Issue'}
          </h4>
          <span style="
            background: ${badge.bg};
            color: ${badge.color};
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: bold;
            border: 1px solid ${badge.border};
          ">${badge.label}</span>
        </div>
        
        <p style="color: #c0c0c0; margin: 0 0 1rem 0; line-height: 1.6;">
          ${rec.description || 'No description available'}
        </p>
        
        ${rec.wcagReference ? `
          <div style="background: rgba(0,0,0,0.3); padding: 0.5rem; border-radius: 4px; margin-bottom: 1rem;">
            <span style="color: #808080; font-size: 0.85rem;">WCAG Reference:</span>
            <span style="color: #bb86fc; font-weight: bold; margin-left: 0.5rem;">${rec.wcagReference}</span>
          </div>
        ` : ''}
        
        ${rec.impact ? `
          <div style="margin-bottom: 1rem;">
            <span style="color: #bb86fc; font-weight: bold;">Impact:</span>
            <span style="color: #c0c0c0;"> ${rec.impact}</span>
          </div>
        ` : ''}
        
        ${rec.solution ? `
          <div style="background: rgba(0,255,65,0.05); padding: 1rem; border-radius: 4px; border-left: 3px solid #00ff41;">
            <div style="color: #00ff41; font-weight: bold; margin-bottom: 0.5rem;">✓ Solution:</div>
            <p style="color: #c0c0c0; margin: 0; line-height: 1.6;">${rec.solution}</p>
          </div>
        ` : ''}
      </div>
    `;
  };

  return `
    ${introSection}
    <div style="padding-left: 1rem;">
      <div style="
        background: linear-gradient(135deg, rgba(255,68,68,0.1), rgba(255,165,0,0.1));
        border: 2px solid #ff4444;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 2rem;
      ">
        <h3 style="color: #ff4444; margin: 0 0 0.75rem 0; font-size: 1.5rem;">
          ~ Accessibility Improvement Opportunities
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
          ${high.length > 0 ? `
          <div style="text-align: center; padding: 0.75rem; background: rgba(255,68,68,0.15); border-radius: 6px; border: 1px solid #ff4444;">
            <div style="font-size: 2rem; color: #ff4444; font-weight: bold;">${high.length}</div>
            <div style="color: #ff4444; font-size: 0.85rem; text-transform: uppercase;">Critical</div>
          </div>
          ` : ''}
          ${medium.length > 0 ? `
          <div style="text-align: center; padding: 0.75rem; background: rgba(255,165,0,0.15); border-radius: 6px; border: 1px solid #ffa500;">
            <div style="font-size: 2rem; color: #ffa500; font-weight: bold;">${medium.length}</div>
            <div style="color: #ffa500; font-size: 0.85rem; text-transform: uppercase;">Important</div>
          </div>
          ` : ''}
          ${low.length > 0 ? `
          <div style="text-align: center; padding: 0.75rem; background: rgba(0,204,255,0.15); border-radius: 6px; border: 1px solid #00ccff;">
            <div style="font-size: 2rem; color: #00ccff; font-weight: bold;">${low.length}</div>
            <div style="color: #00ccff; font-size: 0.85rem; text-transform: uppercase;">Minor</div>
          </div>
          ` : ''}
        </div>
      </div>

      ${high.length > 0 ? `
        <h4 style="color: #ff4444; margin: 2rem 0 1rem 0; font-size: 1.3rem; border-bottom: 2px solid #ff4444; padding-bottom: 0.5rem;">
          H CRITICAL - Fix Immediately
        </h4>
        ${high.map(rec => renderRecommendationCard(rec)).join('')}
      ` : ''}

      ${medium.length > 0 ? `
        <h4 style="color: #ffa500; margin: 2rem 0 1rem 0; font-size: 1.3rem; border-bottom: 2px solid #ffa500; padding-bottom: 0.5rem;">
          M IMPORTANT - Address Soon
        </h4>
        ${medium.map(rec => renderRecommendationCard(rec)).join('')}
      ` : ''}

      ${low.length > 0 ? `
        <h4 style="color: #00ccff; margin: 2rem 0 1rem 0; font-size: 1.3rem; border-bottom: 2px solid #00ccff; padding-bottom: 0.5rem;">
          L MINOR - Enhance When Possible
        </h4>
        ${low.map(rec => renderRecommendationCard(rec)).join('')}
      ` : ''}
    </div>
  `;
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = `>>> ERROR: ${message}`;
  errorMessage.classList.remove('hidden');
  results.classList.add('hidden');
}

/**
 * Get accessibility color based on score - Traditional traffic light system
 */
function getAccessibilityColor(score) {
  if (score >= 90) return '#00ff41';  // A: Bright green
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
}

/**
 * Get accessibility grade
 */
function getAccessibilityGrade(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Poor';
}

/**
 * Get WCAG level color
 */
function getWCAGLevelColor(level) {
  switch(level) {
    case 'AAA': return '#00d9ff';  // Cyan (highest accessibility)
    case 'AA':  return '#00ff41';  // Green (industry standard)
    case 'A':   return '#ffd700';  // Yellow (minimum)
    default:    return '#ff4444';  // Red (non-compliant)
  }
}

/**
 * Get WCAG level description
 */
function getWCAGLevelDescription(level) {
  switch(level) {
    case 'AAA': 
      return 'Highest Accessibility - Provides the best possible experience for all users, including those with severe disabilities.';
    case 'AA':  
      return 'Industry Standard - Meets legal requirements (ADA, Section 508) and ensures content is accessible to most users with disabilities.';
    case 'A':   
      return 'Minimum Accessibility - Removes the most critical barriers but considered barely accessible.';
    default:    
      return 'Non-Compliant - Does not meet WCAG standards.';
  }
}

// PDF purchase modal removed - monetization disabled
