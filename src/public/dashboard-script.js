/**
 * Comprehensive Dashboard Script
 * Orchestrates all 5 analyzers: Font Scanner, SEO, Performance, Accessibility, Security
 */

// Dashboard state
let dashboardResults = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('dashboardUrlInput');
  const submitButton = document.getElementById('dashboardAnalyzeButton');
  
  // Handle button click
  submitButton.addEventListener('click', () => runComprehensiveAnalysis());
  
  // Handle Enter key
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      runComprehensiveAnalysis();
    }
  });
});

/**
 * Run analysis across all 5 modules
 */
async function runComprehensiveAnalysis() {
  const urlInput = document.getElementById('dashboardUrlInput');
  const submitButton = document.getElementById('dashboardAnalyzeButton');
  const errorMessage = document.getElementById('errorMessage');
  const resultsContainer = document.getElementById('dashboardResults');
  
  const url = urlInput.value.trim();
  
  if (!url) {
    showError('Please enter a valid URL');
    return;
  }

  // Disable inputs
  submitButton.disabled = true;
  submitButton.textContent = 'ANALYZING...';
  urlInput.disabled = true;
  
  // Show unified loading with steps
  window.AnalyzerLoader.show([
    { id: 'init', label: 'Connecting to target...' },
    { id: 'fonts', label: 'Analyzing typography & fonts...' },
    { id: 'seo', label: 'Scanning SEO metrics...' },
    { id: 'performance', label: 'Running performance tests...' },
    { id: 'accessibility', label: 'Checking accessibility compliance...' },
    { id: 'security', label: 'Auditing security headers...' },
    { id: 'compile', label: 'Compiling unified report...' }
  ]);
  
  errorMessage.style.display = 'none';
  resultsContainer.style.display = 'none';

  try {
    const startTime = Date.now();
    
    // Step 1: Initialize
    window.AnalyzerLoader.updateStep('init', 'active');
    await new Promise(resolve => setTimeout(resolve, 500));
    window.AnalyzerLoader.updateStep('init', 'complete');
    window.AnalyzerLoader.updateProgress(10);
    
    // Run all analyzers in parallel with step updates
    window.AnalyzerLoader.updateStep('fonts', 'active');
    window.AnalyzerLoader.updateStep('seo', 'active');
    window.AnalyzerLoader.updateStep('performance', 'active');
    window.AnalyzerLoader.updateStep('accessibility', 'active');
    window.AnalyzerLoader.updateStep('security', 'active');
    
    const [fontResults, seoResults, perfResults, a11yResults, securityResults] = await Promise.allSettled([
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'basic' })
      }).then(r => r.json()).then(data => {
        window.AnalyzerLoader.updateStep('fonts', 'complete');
        window.AnalyzerLoader.updateProgress(30);
        return data;
      }),
      
      fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, forceLightweight: true, source: 'dashboard' })
      }).then(async (response) => {
        let data;
        try {
          data = await response.json();
        } catch (parseError) {
          throw new Error('SEO analyzer returned an unexpected response.');
        }

        if (!response.ok || data.success === false) {
          const message = data?.message || data?.error || 'SEO analysis failed.';
          throw new Error(message);
        }

        window.AnalyzerLoader.updateStep('seo', 'complete');
        window.AnalyzerLoader.updateProgress(50);
        return data;
      }),
      
      fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.json()).then(data => {
        window.AnalyzerLoader.updateStep('performance', 'complete');
        window.AnalyzerLoader.updateProgress(65);
        return data;
      }),
      
      fetch('/api/accessibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.json()).then(data => {
        window.AnalyzerLoader.updateStep('accessibility', 'complete');
        window.AnalyzerLoader.updateProgress(80);
        return data;
      }),
      
      fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.json()).then(data => {
        window.AnalyzerLoader.updateStep('security', 'complete');
        window.AnalyzerLoader.updateProgress(90);
        return data;
      })
    ]);
    
    // Step 7: Compile report
    window.AnalyzerLoader.updateStep('compile', 'active');
    window.AnalyzerLoader.updateProgress(95);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    // Process results
    dashboardResults = {
      url,
      timestamp: new Date().toISOString(),
      duration,
      font: fontResults.status === 'fulfilled' ? fontResults.value : { error: fontResults.reason },
      seo: seoResults.status === 'fulfilled' ? seoResults.value : { error: seoResults.reason },
      performance: perfResults.status === 'fulfilled' ? perfResults.value : { error: perfResults.reason },
      accessibility: a11yResults.status === 'fulfilled' ? a11yResults.value : { error: a11yResults.reason },
      security: securityResults.status === 'fulfilled' ? securityResults.value : { error: securityResults.reason }
    };

    window.AnalyzerLoader.updateStep('compile', 'complete');
    window.AnalyzerLoader.updateProgress(100);
    
    // Short delay to show completion
    await new Promise(resolve => setTimeout(resolve, 500));

    // Display results
    displayDashboard(dashboardResults);
    
    // Hide loading
    window.AnalyzerLoader.hide();
    
  } catch (error) {
    console.error('Dashboard analysis error:', error);
    showError(error.message || 'Analysis failed. Please try again.');
    window.AnalyzerLoader.hide();
  } finally {
    // Re-enable inputs
    submitButton.disabled = false;
    submitButton.textContent = 'RUN FULL AUDIT';
    urlInput.disabled = false;
  }
}

/**
 * Display comprehensive dashboard
 */
function displayDashboard(data) {
  const container = document.getElementById('dashboardResults');
  container.style.display = 'block';
  container.innerHTML = '';

  // Extract desktop and mobile scores
  const scores = {
    font: extractScores(data.font, 'fonts'),
    seo: extractScores(data.seo, 'seo'),
    performance: extractScores(data.performance, 'performance'),
    accessibility: extractScores(data.accessibility, 'accessibility'),
    security: extractScores(data.security, 'security')
  };

  // Calculate overall health score (average of all desktop and mobile scores)
  const allScores = [];
  Object.values(scores).forEach(scoreObj => {
    if (scoreObj.desktop !== null) allScores.push(scoreObj.desktop);
    if (scoreObj.mobile !== null) allScores.push(scoreObj.mobile);
  });
  const overallScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
    : 0;

  // Create summary section
  const summaryHTML = `
    <div class="section" style="border-left: 4px solid #00ff41;">
      <h2 style="margin-bottom: 0.75rem;">[WEBSITE_HEALTH_OVERVIEW]</h2>
      <p style="margin: 0.25rem 0;">>> url: ${data.url}</p>
      <p style="margin: 0.25rem 0;">>> analysis_completed: ${new Date(data.timestamp).toLocaleString()}</p>
      <p style="margin: 0.25rem 0 1rem 0;">>> total_duration: ${data.duration}s</p>
      
      <!-- Overall Health Score -->
      <div style="
        background: linear-gradient(135deg, rgba(0,255,65,0.08), rgba(0,204,255,0.08));
        border: 2px solid ${getScoreColor(overallScore)};
        border-radius: 8px;
        padding: 1.25rem 1rem;
        margin: 1rem 0;
      ">
        <h3 style="color: #00ff41; margin: 0 0 1rem 0; font-size: 1.1rem;">>> Overall Website Health</h3>
        
        <!-- Circular Progress Dials -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1.25rem;">
          <!-- Overall Score -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.5rem; font-weight: 600; color: var(--text-primary); font-size: 0.9rem;">Overall Health</div>
            <svg class="circular-progress" width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10" />
              <circle
                cx="70" cy="70" r="60" fill="none"
                stroke="${getScoreColor(overallScore)}"
                stroke-width="10" stroke-linecap="round"
                stroke-dasharray="${(overallScore / 100) * 376.99} 376.99"
                transform="rotate(-90 70 70)"
              />
              <text x="70" y="70" text-anchor="middle" dy="0.35em" font-size="2.5rem" font-weight="bold" class="dial-score-text">
                ${overallScore}
              </text>
            </svg>
            <div style="margin-top: 0.35rem; color: ${getScoreColor(overallScore)}; font-weight: 600; font-size: 0.9rem;">
              ${getGrade(overallScore)} Grade
            </div>
          </div>

          <!-- Font Scanner -->
          ${createAnalyzerDial('Typography', scores.font, 'T', '/')}

          <!-- SEO -->
          ${createAnalyzerDial('SEO', scores.seo, 'S', '/seo-analyzer.html')}

          <!-- Performance -->
          ${createAnalyzerDial('Performance', scores.performance, 'P', '/performance-analyzer.html')}

          <!-- Accessibility -->
          ${createAnalyzerDial('Accessibility', scores.accessibility, 'A', '/accessibility-analyzer.html')}

          <!-- Security -->
          ${createAnalyzerDial('Security', scores.security, '◈', '/security-analyzer.html')}
        </div>
      </div>

      <!-- Quick Actions -->
      <h3 style="color: #00ff41; margin: 1.5rem 0 0.75rem 0; font-size: 1.1rem;">>> Detailed Analysis</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
        ${createActionCard('Typography Analysis', 'fonts', scores.font, data.font, '/', '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>')}
        ${createActionCard('SEO Analysis', 'seo', scores.seo, data.seo, '/seo-analyzer.html', '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>')}
        ${createActionCard('Performance Analysis', 'performance', scores.performance, data.performance, '/performance-analyzer.html', '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>')}
        ${createActionCard('Accessibility Analysis', 'accessibility', scores.accessibility, data.accessibility, '/accessibility-analyzer.html', '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="4" r="2"/><path d="M10.5 8.5h3M8 13h8M8 13v7M16 13v7"/></svg>')}
        ${createActionCard('Security Analysis', 'security', scores.security, data.security, '/security-analyzer.html', '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v0a10 10 0 0 1 8.5 4.7L21 8v5a10 10 0 0 1-9 10 10 10 0 0 1-9-10V8l.5-1.3A10 10 0 0 1 12 2z"/><path d="M9 12l2 2 4-4"/></svg>')}
      </div>

      <!-- Recommendations Summary -->
      <h3 style="color: #00ff41; margin: 1.5rem 0 0.75rem 0; font-size: 1.1rem;">>> Priority Recommendations</h3>
      <div style="background: rgba(255, 165, 0, 0.08); border-left: 4px solid #ffa500; padding: 1rem; border-radius: 4px;">
        ${generateRecommendations(data)}
      </div>
    </div>
  `;

  container.innerHTML = summaryHTML;

  // Add event listeners for action cards (CSP-compliant)
  const actionCards = container.querySelectorAll('.action-card');
  actionCards.forEach(card => {
    const hoverBorder = card.dataset.hoverBorder;
    const hoverBg = card.dataset.hoverBg;
    const defaultBorder = card.dataset.defaultBorder;
    const defaultBg = card.dataset.defaultBg;

    card.addEventListener('mouseover', function() {
      this.style.borderColor = hoverBorder;
      this.style.background = hoverBg;
    });

    card.addEventListener('mouseout', function() {
      this.style.borderColor = defaultBorder;
      this.style.background = defaultBg;
    });
  });
}

/**
 * Create analyzer dial with desktop and mobile scores
 */
function createAnalyzerDial(name, scores, icon, link) {
  // Handle null or error cases
  if (!scores || (scores.desktop === null && scores.mobile === null)) {
    return `
      <div style="text-align: center; opacity: 0.5;">
        <div style="margin-bottom: 0.5rem; font-weight: 600; color: #808080; font-size: 0.85rem;">${icon} ${name}</div>
        <div style="
          width: 140px; height: 140px; border-radius: 50%; margin: 0 auto;
          background: rgba(0,0,0,0.3); border: 2px dashed rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
        ">
          <span style="color: #808080; font-size: 0.9rem;">N/A</span>
        </div>
        <div style="margin-top: 0.35rem; color: #808080; font-size: 0.85rem;">Error</div>
      </div>
    `;
  }

  // Use average for the dial, or whichever score is available
  const avgScore = scores.desktop !== null && scores.mobile !== null
    ? Math.round((scores.desktop + scores.mobile) / 2)
    : (scores.desktop || scores.mobile);

  const desktopDisplay = scores.desktop !== null ? scores.desktop : 'N/A';
  const mobileDisplay = scores.mobile !== null ? scores.mobile : 'N/A';

  return `
    <div style="text-align: center;">
      <div style="margin-bottom: 0.5rem; font-weight: 600; color: var(--text-primary); font-size: 0.85rem;">${icon} ${name}</div>
      <a href="${link}" style="text-decoration: none; display: inline-block;">
        <svg class="circular-progress" width="140" height="160" viewBox="0 0 140 160" style="cursor: pointer;">
          <!-- Grey background circle (100%) -->
          <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(100, 100, 100, 0.3)" stroke-width="9" />
          <!-- Colored progress circle -->
          <circle
            cx="70" cy="70" r="60" fill="none"
            stroke="${getScoreColor(avgScore)}"
            stroke-width="9" stroke-linecap="round"
            stroke-dasharray="${(avgScore / 100) * 376.99} 376.99"
            transform="rotate(-90 70 70)"
          />
          <!-- Average score in center -->
          <text x="70" y="70" text-anchor="middle" dy="0.35em" font-size="2.2rem" font-weight="bold" class="dial-score-text">
            ${avgScore}
          </text>
          <!-- Desktop and Mobile labels below -->
          <text x="35" y="145" text-anchor="middle" font-size="0.7rem" fill="#888">Desktop</text>
          <text x="105" y="145" text-anchor="middle" font-size="0.7rem" fill="#888">Mobile</text>
          <!-- Desktop and Mobile scores -->
          <text x="35" y="158" text-anchor="middle" font-size="0.9rem" font-weight="600" fill="${scores.desktop !== null ? getScoreColor(scores.desktop) : '#666'}">
            ${desktopDisplay}
          </text>
          <text x="105" y="158" text-anchor="middle" font-size="0.9rem" font-weight="600" fill="${scores.mobile !== null ? getScoreColor(scores.mobile) : '#666'}">
            ${mobileDisplay}
          </text>
        </svg>
      </a>
      <div style="margin-top: 0.35rem; color: ${getScoreColor(avgScore)}; font-weight: 600; font-size: 0.9rem;">
        ${getGrade(avgScore)}
      </div>
    </div>
  `;
}

/**
 * Create action card
 */
function createActionCard(title, key, scores, data, link, icon) {
  const hasError = data && data.error;
  const limitedNote = data && data.warning
    ? `<div style="margin-top: 0.5rem; color: #ffa500; font-size: 0.8rem;">${data.warning}</div>`
    : '';

  // Calculate average score from desktop/mobile
  const avgScore = scores.desktop !== null && scores.mobile !== null
    ? Math.round((scores.desktop + scores.mobile) / 2)
    : (scores.desktop || scores.mobile || 0);

  const status = hasError ? 'Error' : (avgScore >= 80 ? 'Good' : avgScore >= 60 ? 'Fair' : 'Needs Work');
  const statusColor = hasError ? '#ff4444' : getScoreColor(avgScore || 0);

  // Detect light mode
  const isLightMode = document.body.classList.contains('white-theme');
  const cardBg = isLightMode ? '#f5f5f5' : 'rgba(0,255,65,0.05)';
  const cardBorder = isLightMode ? '#cccccc' : 'rgba(0,255,65,0.2)';
  const cardTitleColor = isLightMode ? '#222' : '#ffffff';
  const cardTextColor = isLightMode ? '#333' : '#808080';
  const detailsColor = isLightMode ? '#00796b' : '#00ff41';
  const borderTopColor = isLightMode ? '#e0e0e0' : 'rgba(255,255,255,0.1)';

  return `
    <a href="${link}" style="text-decoration: none; display: block;">
      <div class="action-card" data-card-key="${key}" style="
        padding: 1.5rem;
        background: ${cardBg};
        border: 1px solid ${cardBorder};
        border-radius: 8px;
        transition: all 0.3s ease;
        cursor: pointer;
      " data-hover-border="${isLightMode ? '#00796b' : '#00ff41'}" 
         data-hover-bg="${isLightMode ? '#e0f7fa' : 'rgba(0,255,65,0.1)'}" 
         data-default-border="${cardBorder}" 
         data-default-bg="${cardBg}">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="color: ${cardTextColor}; line-height: 0;">${icon}</div>
          <div style="
            padding: 0.25rem 0.75rem;
            background: ${statusColor}20;
            border: 1px solid ${statusColor};
            border-radius: 4px;
            color: ${statusColor};
            font-size: 0.85rem;
            font-weight: 600;
          ">${status}</div>
        </div>
        <div style="font-size: 1.1rem; font-weight: 600; color: ${cardTitleColor}; margin-bottom: 0.5rem;">${title}</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: ${cardTextColor}; font-size: 0.9rem;">Score</span>
          <span style="font-size: 1.5rem; font-weight: bold; color: ${statusColor};">${avgScore !== null ? avgScore : 'N/A'}</span>
        </div>
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid ${borderTopColor};">
          <span style="color: ${detailsColor}; font-size: 0.9rem;">View Details →</span>
        </div>
        ${limitedNote}
      </div>
    </a>
  `;
}

/**
 * Generate priority recommendations
 */
function generateRecommendations(data) {
  const recommendations = [];
  
  // Check each analyzer for issues
  if (data.seo && data.seo.results && data.seo.results.score.overall < 70) {
    recommendations.push('~ <strong>SEO:</strong> Improve meta tags, headings, and content optimization');
  }
  if (data.performance && data.performance.results && data.performance.results.overallScore < 70) {
    recommendations.push('~ <strong>Performance:</strong> Optimize images, minify resources, and leverage caching');
  }
  if (data.accessibility && data.accessibility.results && data.accessibility.results.overallScore < 70) {
    recommendations.push('~ <strong>Accessibility:</strong> Fix color contrast, add ARIA labels, and improve keyboard navigation');
  }
  if (data.security && data.security.overallScore < 70) {
    recommendations.push('~ <strong>Security:</strong> Add security headers, enable HTTPS, and fix vulnerabilities');
  }
  if (data.font && data.font.overallScore && data.font.overallScore < 70) {
    recommendations.push('~ <strong>Typography:</strong> Optimize font loading and improve typography hierarchy');
  }

  if (recommendations.length === 0) {
    return '<p style="color: #00ff41; margin: 0;">✓ Excellent! All areas are performing well. Keep up the good work!</p>';
  }

  return `
    <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">
      ${recommendations.map(rec => `<li style="color: #ffa500;">${rec}</li>`).join('')}
    </ul>
  `;
}

/**
 * Extract desktop and mobile scores from analyzer result
 */
function extractScores(data, type) {
  if (!data) {
    console.log(`✗ ${type} - No data received`);
    return { desktop: null, mobile: null };
  }

  if (data.error) {
    console.log(`✗ ${type} - Has error:`, data.error);
    return { desktop: null, mobile: null };
  }

  console.log(`S Extracting scores for ${type}:`, data);

  switch(type) {
    case 'fonts': {
      // Font scanner may return desktop/mobile font data separately
      if (data.success && data.results) {
        const fontCount = data.results.fonts?.totalFonts || 0;
        // Calculate simple score based on font count (optimal is 2-4 fonts)
        let score = 50;
        if (fontCount === 0) score = 30;
        else if (fontCount <= 2) score = 100;
        else if (fontCount <= 4) score = 90;
        else if (fontCount <= 6) score = 75;
        else if (fontCount <= 8) score = 60;
        else score = 40;

        console.log(`  → Font score calculated: ${score} (${fontCount} fonts)`);
        // Fonts don't distinguish desktop/mobile, so use same score
        return { desktop: score, mobile: score };
      }
      return { desktop: null, mobile: null };
    }

    case 'seo': {
      // SEO returns single overall score (no desktop/mobile distinction)
      const seoScore = data.results?.score?.overall || data.score?.overall || null;
      console.log(`  → SEO score: ${seoScore}`);
      return { desktop: seoScore, mobile: seoScore };
    }

    case 'performance': {
      // Performance may have desktop/mobile results
      let desktopScore = null;
      let mobileScore = null;

      // Check if data has desktop/mobile breakdown
      if (data.desktop && data.desktop.performanceScore !== undefined) {
        desktopScore = data.desktop.performanceScore;
        console.log(`  → Performance desktop score: ${desktopScore}`);
      }
      if (data.mobile && data.mobile.performanceScore !== undefined) {
        mobileScore = data.mobile.performanceScore;
        console.log(`  → Performance mobile score: ${mobileScore}`);
      }

      // Fallback: use overall score for both if no breakdown
      if (desktopScore === null && mobileScore === null) {
        const overallScore = data.results?.performanceScore ||
                            data.results?.overallScore ||
                            data.performanceScore ||
                            null;
        console.log(`  → Performance overall score: ${overallScore}`);
        return { desktop: overallScore, mobile: overallScore };
      }

      return { desktop: desktopScore, mobile: mobileScore };
    }

    case 'accessibility': {
      // Accessibility may have desktop/mobile results
      let desktopScore = null;
      let mobileScore = null;

      // Check if data has desktop/mobile breakdown
      if (data.desktop && data.desktop.accessibilityScore !== undefined) {
        desktopScore = data.desktop.accessibilityScore;
        console.log(`  → Accessibility desktop score: ${desktopScore}`);
      }
      if (data.mobile && data.mobile.accessibilityScore !== undefined) {
        mobileScore = data.mobile.accessibilityScore;
        console.log(`  → Accessibility mobile score: ${mobileScore}`);
      }

      // Fallback: use overall score for both if no breakdown
      if (desktopScore === null && mobileScore === null) {
        const overallScore = data.accessibilityScore ||
                            data.results?.accessibilityScore ||
                            data.results?.overallScore ||
                            null;
        console.log(`  → Accessibility overall score: ${overallScore}`);
        return { desktop: overallScore, mobile: overallScore };
      }

      return { desktop: desktopScore, mobile: mobileScore };
    }

    case 'security': {
      // Security has desktop/mobile breakdown
      let desktopScore = null;
      let mobileScore = null;

      // Extract desktop score
      if (data.desktop && !data.desktop.error) {
        desktopScore = data.desktop.securityScore || null;
        console.log(`  → Security desktop score: ${desktopScore}`);
      }

      // Extract mobile score
      if (data.mobile && !data.mobile.error) {
        mobileScore = data.mobile.securityScore || null;
        console.log(`  → Security mobile score: ${mobileScore}`);
      }

      // Fallback to overall score if no desktop/mobile breakdown
      if (desktopScore === null && mobileScore === null) {
        const overallScore = data.overallScore ||
                            data.results?.overallScore ||
                            data.score ||
                            null;
        console.log(`  → Security overall score: ${overallScore}`);
        return { desktop: overallScore, mobile: overallScore };
      }

      return { desktop: desktopScore, mobile: mobileScore };
    }

    default:
      console.log(`  → Unknown type: ${type}`);
      return { desktop: null, mobile: null };
  }
}

/**
 * Extract single score from analyzer result (legacy function)
 * Returns average of desktop and mobile scores
 */
function extractScore(data, type) {
  const scores = extractScores(data, type);

  // Return average of desktop and mobile, or whichever is available
  if (scores.desktop !== null && scores.mobile !== null) {
    return Math.round((scores.desktop + scores.mobile) / 2);
  }
  return scores.desktop || scores.mobile || null;
}

/**
 * Get score color - Traditional traffic light system
 * A grades (90-100): Green
 * B grades (70-89): Yellow
 * C grades (50-69): Orange
 * Below C (<50): Red
 */
function getScoreColor(score) {
  if (score >= 90) return '#00ff41';  // A: Bright green (terminal green)
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
}

/**
 * Get letter grade
 */
function getGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}
