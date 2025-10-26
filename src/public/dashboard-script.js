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
  const loadingMessage = document.getElementById('loadingMessage');
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
  
  // Show loading
  loadingMessage.style.display = 'block';
  errorMessage.style.display = 'none';
  resultsContainer.style.display = 'none';

  try {
    // Run all analyzers in parallel
    const startTime = Date.now();
    
    const [fontResults, seoResults, perfResults, a11yResults, securityResults] = await Promise.allSettled([
      fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, mode: 'basic' })
      }).then(r => r.json()),
      
      fetch('/api/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.json()),
      
      fetch('/api/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.json()),
      
      fetch('/api/accessibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.json()),
      
      fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      }).then(r => r.json())
    ]);
    
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

    // Display results
    displayDashboard(dashboardResults);
    
    // Hide loading
    loadingMessage.style.display = 'none';
    
  } catch (error) {
    console.error('Dashboard analysis error:', error);
    showError(error.message || 'Analysis failed. Please try again.');
    loadingMessage.style.display = 'none';
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

  // Extract scores
  const scores = {
    font: extractScore(data.font, 'fonts'),
    seo: extractScore(data.seo, 'seo'),
    performance: extractScore(data.performance, 'performance'),
    accessibility: extractScore(data.accessibility, 'accessibility'),
    security: extractScore(data.security, 'security')
  };

  // Calculate overall health score
  const validScores = Object.values(scores).filter(s => s !== null);
  const overallScore = validScores.length > 0 
    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
    : 0;

  // Create summary section
  const summaryHTML = `
    <div class="section" style="border-left: 4px solid #00ff41;">
      <h2>[WEBSITE_HEALTH_OVERVIEW]</h2>
      <p>>> url: ${data.url}</p>
      <p>>> analysis_completed: ${new Date(data.timestamp).toLocaleString()}</p>
      <p>>> total_duration: ${data.duration}s</p>
      
      <!-- Overall Health Score -->
      <div style="
        background: linear-gradient(135deg, rgba(0,255,65,0.08), rgba(0,204,255,0.08));
        border: 2px solid ${getScoreColor(overallScore)};
        border-radius: 12px;
        padding: 2rem;
        margin: 2rem 0;
      ">
        <h3 style="color: #00ff41; margin: 0 0 1.5rem 0;">>> Overall Website Health</h3>
        
        <!-- Circular Progress Dials -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 2rem;">
          <!-- Overall Score -->
          <div style="text-align: center;">
            <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff; font-size: 1.05rem;">Overall Health</div>
            <svg class="circular-progress" width="160" height="160" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="12" />
              <circle
                cx="80" cy="80" r="70" fill="none"
                stroke="${getScoreColor(overallScore)}"
                stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${(overallScore / 100) * 439.82} 439.82"
                transform="rotate(-90 80 80)"
              />
              <text x="80" y="80" text-anchor="middle" dy="0.35em" font-size="3rem" font-weight="bold" fill="#ffffff"
                style="text-shadow: 0 0 10px ${getScoreColor(overallScore)}, 0 0 20px ${getScoreColor(overallScore)};">
                ${overallScore}
              </text>
            </svg>
            <div style="margin-top: 0.5rem; color: ${getScoreColor(overallScore)}; font-weight: 600;">
              ${getGrade(overallScore)} Grade
            </div>
          </div>

          <!-- Font Scanner -->
          ${createAnalyzerDial('Typography', scores.font, '🔤', '/')}

          <!-- SEO -->
          ${createAnalyzerDial('SEO', scores.seo, '🔍', '/seo-analyzer.html')}

          <!-- Performance -->
          ${createAnalyzerDial('Performance', scores.performance, '⚡', '/performance-analyzer.html')}

          <!-- Accessibility -->
          ${createAnalyzerDial('Accessibility', scores.accessibility, '♿', '/accessibility-analyzer.html')}

          <!-- Security -->
          ${createAnalyzerDial('Security', scores.security, '🔒', '/security-analyzer.html')}
        </div>
      </div>

      <!-- Quick Actions -->
      <h3 style="color: #00ff41; margin: 2rem 0 1rem 0;">>> Detailed Analysis</h3>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
        ${createActionCard('Typography Analysis', 'fonts', scores.font, data.font, '/', '🔤')}
        ${createActionCard('SEO Analysis', 'seo', scores.seo, data.seo, '/seo-analyzer.html', '🔍')}
        ${createActionCard('Performance Analysis', 'performance', scores.performance, data.performance, '/performance-analyzer.html', '⚡')}
        ${createActionCard('Accessibility Analysis', 'accessibility', scores.accessibility, data.accessibility, '/accessibility-analyzer.html', '♿')}
        ${createActionCard('Security Analysis', 'security', scores.security, data.security, '/security-analyzer.html', '🔒')}
      </div>

      <!-- Recommendations Summary -->
      <h3 style="color: #00ff41; margin: 2rem 0 1rem 0;">>> Priority Recommendations</h3>
      <div style="background: rgba(255, 165, 0, 0.08); border-left: 4px solid #ffa500; padding: 1.5rem; border-radius: 4px;">
        ${generateRecommendations(data)}
      </div>
    </div>
  `;

  container.innerHTML = summaryHTML;
}

/**
 * Create analyzer dial
 */
function createAnalyzerDial(name, score, icon, link) {
  if (score === null) {
    return `
      <div style="text-align: center; opacity: 0.5;">
        <div style="margin-bottom: 0.75rem; font-weight: 600; color: #808080; font-size: 0.95rem;">${icon} ${name}</div>
        <div style="
          width: 160px; height: 160px; border-radius: 50%; margin: 0 auto;
          background: rgba(0,0,0,0.3); border: 2px dashed rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
        ">
          <span style="color: #808080; font-size: 0.9rem;">N/A</span>
        </div>
        <div style="margin-top: 0.5rem; color: #808080; font-size: 0.9rem;">Error</div>
      </div>
    `;
  }

  return `
    <div style="text-align: center;">
      <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff; font-size: 0.95rem;">${icon} ${name}</div>
      <a href="${link}" style="text-decoration: none; display: inline-block;">
        <svg class="circular-progress" width="160" height="160" viewBox="0 0 160 160" style="cursor: pointer;">
          <circle cx="80" cy="80" r="70" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10" />
          <circle
            cx="80" cy="80" r="70" fill="none"
            stroke="${getScoreColor(score)}"
            stroke-width="10" stroke-linecap="round"
            stroke-dasharray="${(score / 100) * 439.82} 439.82"
            transform="rotate(-90 80 80)"
          />
          <text x="80" y="80" text-anchor="middle" dy="0.35em" font-size="2.5rem" font-weight="bold" fill="#ffffff"
            style="text-shadow: 0 0 10px ${getScoreColor(score)}, 0 0 15px ${getScoreColor(score)};">
            ${score}
          </text>
        </svg>
      </a>
      <div style="margin-top: 0.5rem; color: ${getScoreColor(score)}; font-weight: 600;">
        ${getGrade(score)}
      </div>
    </div>
  `;
}

/**
 * Create action card
 */
function createActionCard(title, key, score, data, link, icon) {
  const hasError = data && data.error;
  const status = hasError ? 'Error' : (score >= 80 ? 'Good' : score >= 60 ? 'Fair' : 'Needs Work');
  const statusColor = hasError ? '#ff4444' : getScoreColor(score || 0);

  return `
    <a href="${link}" style="text-decoration: none; display: block;">
      <div style="
        padding: 1.5rem;
        background: rgba(0,255,65,0.05);
        border: 1px solid rgba(0,255,65,0.2);
        border-radius: 8px;
        transition: all 0.3s ease;
        cursor: pointer;
      " onmouseover="this.style.borderColor='#00ff41'; this.style.background='rgba(0,255,65,0.1)'" 
         onmouseout="this.style.borderColor='rgba(0,255,65,0.2)'; this.style.background='rgba(0,255,65,0.05)'">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <div style="font-size: 2rem;">${icon}</div>
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
        <div style="font-size: 1.1rem; font-weight: 600; color: #ffffff; margin-bottom: 0.5rem;">${title}</div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #808080; font-size: 0.9rem;">Score</span>
          <span style="font-size: 1.5rem; font-weight: bold; color: ${statusColor};">${score !== null ? score : 'N/A'}</span>
        </div>
        <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1);">
          <span style="color: #00ff41; font-size: 0.9rem;">View Details →</span>
        </div>
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
    recommendations.push('⚠️ <strong>SEO:</strong> Improve meta tags, headings, and content optimization');
  }
  if (data.performance && data.performance.results && data.performance.results.overallScore < 70) {
    recommendations.push('⚠️ <strong>Performance:</strong> Optimize images, minify resources, and leverage caching');
  }
  if (data.accessibility && data.accessibility.results && data.accessibility.results.overallScore < 70) {
    recommendations.push('⚠️ <strong>Accessibility:</strong> Fix color contrast, add ARIA labels, and improve keyboard navigation');
  }
  if (data.security && data.security.overallScore < 70) {
    recommendations.push('⚠️ <strong>Security:</strong> Add security headers, enable HTTPS, and fix vulnerabilities');
  }
  if (data.font && data.font.overallScore && data.font.overallScore < 70) {
    recommendations.push('⚠️ <strong>Typography:</strong> Optimize font loading and improve typography hierarchy');
  }

  if (recommendations.length === 0) {
    return '<p style="color: #00ff41; margin: 0;">✅ Excellent! All areas are performing well. Keep up the good work!</p>';
  }

  return `
    <ul style="margin: 0; padding-left: 1.5rem; line-height: 1.8;">
      ${recommendations.map(rec => `<li style="color: #ffa500;">${rec}</li>`).join('')}
    </ul>
  `;
}

/**
 * Extract score from analyzer result
 */
function extractScore(data, type) {
  if (!data) {
    console.log(`❌ ${type} - No data received`);
    return null;
  }
  
  if (data.error) {
    console.log(`❌ ${type} - Has error:`, data.error);
    return null;
  }
  
  console.log(`🔍 Extracting score for ${type}:`, data);
  
  switch(type) {
    case 'fonts': {
      // Font scanner returns success flag and results object
      // Score might be in results.fonts.totalFonts or we calculate based on font count
      if (data.success && data.results) {
        const fontCount = data.results.fonts?.totalFonts || 0;
        // Calculate simple score based on font count (optimal is 2-4 fonts)
        let score = 50;
        if (fontCount === 0) score = 30; // No fonts detected
        else if (fontCount <= 2) score = 100; // Excellent
        else if (fontCount <= 4) score = 90; // Very good
        else if (fontCount <= 6) score = 75; // Good
        else if (fontCount <= 8) score = 60; // Fair
        else score = 40; // Too many fonts
        
        console.log(`  → Font score calculated: ${score} (${fontCount} fonts)`);
        return score;
      }
      console.log(`  → Font score: null (no valid data)`);
      return null;
    }
      
    case 'seo': {
      // SEO returns results.score.overall
      const seoScore = data.results?.score?.overall || data.score?.overall || null;
      console.log(`  → SEO score: ${seoScore}`);
      return seoScore;
    }
      
    case 'performance': {
      // Performance can return performanceScore or overallScore
      const perfScore = data.results?.performanceScore || 
                        data.results?.overallScore || 
                        data.performanceScore ||
                        null;
      console.log(`  → Performance score: ${perfScore}`);
      return perfScore;
    }
      
    case 'accessibility': {
      // Accessibility returns accessibilityScore at top level (NOT in results)
      const a11yScore = data.accessibilityScore || 
                        data.results?.accessibilityScore ||
                        data.results?.overallScore ||
                        null;
      console.log(`  → Accessibility score: ${a11yScore}`);
      return a11yScore;
    }
      
    case 'security': {
      // Security returns overallScore
      const secScore = data.overallScore || 
                       data.results?.overallScore || 
                       data.score ||
                       null;
      console.log(`  → Security score: ${secScore}`);
      return secScore;
    }
      
    default:
      console.log(`  → Unknown type: ${type}`);
      return null;
  }
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
