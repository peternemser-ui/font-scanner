/**
 * Core Web Vitals Analyzer Frontend
 * Displays Google's ranking factors with actionable insights
 */

const urlInput = document.getElementById('cwvUrlInput');
const analyzeButton = document.getElementById('cwvAnalyzeButton');
const resultsContainer = document.getElementById('cwvResults');

// Handle Enter key
urlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    analyzeButton.click();
  }
});

analyzeButton.addEventListener('click', async () => {
  const url = urlInput.value.trim();
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }

  analyzeButton.disabled = true;
  analyzeButton.textContent = 'ANALYZING...';
  resultsContainer.style.display = 'none';

  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    resultsContainer.parentNode.insertBefore(loadingContainer, resultsContainer);
  }

  // Initialize the analyzer loader
  const loader = new AnalyzerLoader('loadingContainer');
  
  const analysisSteps = [
    {
      label: 'Initializing CWV analysis',
      detail: 'Starting browser performance monitor...'
    },
    {
      label: 'Measuring LCP',
      detail: 'Tracking largest contentful paint...'
    },
    {
      label: 'Measuring FID/INP',
      detail: 'Testing input responsiveness...'
    },
    {
      label: 'Measuring CLS',
      detail: 'Detecting layout shifts...'
    },
    {
      label: 'Calculating scores',
      detail: 'Comparing against Google thresholds...'
    }
  ];

  loader.start(analysisSteps, '[CORE WEB VITALS ANALYZER]', 15);

  try {
    const response = await fetch('/api/core-web-vitals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Complete the loader
    loader.complete();
    
    // Show results after animation completes
    setTimeout(() => {
      displayResults(data);
      resultsContainer.style.display = 'block';
    }, 1000);

  } catch (error) {
    console.error('Analysis error:', error);
    loader.showError(error.message);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = 'ANALYZE CWV';
  }
});

function displayResults(data) {
  const { desktop, mobile, score, grade, recommendations, issues, comparison } = data;

  resultsContainer.innerHTML = `
    <!-- Overall Score Banner -->
    <div style="
      background: linear-gradient(135deg, ${getGradeColor(grade)}20 0%, ${getGradeColor(grade)}10 100%);
      border: 3px solid ${getGradeColor(grade)};
      border-radius: 16px;
      padding: 2rem;
      margin-bottom: 2rem;
      text-align: center;
    ">
      <div style="font-size: 5rem; font-weight: bold; color: ${getGradeColor(grade)}; margin-bottom: 0.5rem;">${score}</div>
      <div style="font-size: 1.5rem; color: #e0e0e0; margin-bottom: 0.5rem;">Overall CWV Score</div>
      <div style="
        display: inline-block;
        padding: 0.5rem 2rem;
        background: ${getGradeColor(grade)};
        color: #000;
        font-size: 2rem;
        font-weight: bold;
        border-radius: 8px;
        margin-bottom: 1rem;
      ">GRADE: ${grade}</div>
      <div style="color: #c0c0c0; font-size: 1rem; margin-top: 1rem;">
        ${mobile.passedCWV ? '✅ PASSING Core Web Vitals (Good for Google Rankings)' : '❌ FAILING Core Web Vitals (May hurt Google Rankings)'}
      </div>
    </div>

    <!-- Critical Issues Alert -->
    ${issues.length > 0 ? `
    <div style="
      background: rgba(255, 68, 68, 0.1);
      border-left: 4px solid #ff4444;
      padding: 1.5rem;
      margin-bottom: 2rem;
      border-radius: 8px;
    ">
      <h3 style="color: #ff4444; margin: 0 0 1rem 0;">🚨 Critical Issues</h3>
      ${issues.map(issue => `<p style="color: #e0e0e0; margin: 0.5rem 0;">${issue}</p>`).join('')}
    </div>
    ` : ''}

    <!-- Desktop vs Mobile Comparison -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
      <!-- Mobile (70% weight) -->
      <div style="
        background: rgba(150, 0, 255, 0.1);
        border: 2px solid rgba(150, 0, 255, 0.4);
        border-radius: 12px;
        padding: 1.5rem;
      ">
        <h3 style="color: #9600ff; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
          <span>📱 Mobile (70% weight)</span>
          <span style="font-size: 2rem;">${mobile.score}/100</span>
        </h3>
        ${renderCWVMetrics(mobile)}
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(150, 0, 255, 0.3);">
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            ${mobile.passedCWV ? '✅ All Core Web Vitals passed' : '❌ Some metrics need improvement'}
          </p>
        </div>
      </div>

      <!-- Desktop (30% weight) -->
      <div style="
        background: rgba(0, 150, 255, 0.1);
        border: 2px solid rgba(0, 150, 255, 0.4);
        border-radius: 12px;
        padding: 1.5rem;
      ">
        <h3 style="color: #0096ff; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
          <span>🖥️ Desktop (30% weight)</span>
          <span style="font-size: 2rem;">${desktop.score}/100</span>
        </h3>
        ${renderCWVMetrics(desktop)}
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0, 150, 255, 0.3);">
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            ${desktop.passedCWV ? '✅ All Core Web Vitals passed' : '⚠️ Some metrics need improvement'}
          </p>
        </div>
      </div>
    </div>

    <!-- The Big 3 Core Web Vitals -->
    <h2 style="color: #00ff41; margin: 2rem 0 1rem 0;">⚡ The Big 3: Google's Core Web Vitals</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
      ${renderMetricCard('LCP', 'Largest Contentful Paint', mobile.lcp, '🖼️', 'Loading Performance')}
      ${renderMetricCard('INP', 'Interaction to Next Paint', mobile.inp, '👆', 'Responsiveness')}
      ${renderMetricCard('CLS', 'Cumulative Layout Shift', mobile.cls, '📐', 'Visual Stability')}
    </div>

    <!-- Additional Performance Metrics -->
    <h2 style="color: #00ff41; margin: 2rem 0 1rem 0;">📊 Additional Performance Metrics</h2>
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
      ${renderAdditionalMetric('FCP', 'First Contentful Paint', mobile.additionalMetrics.fcp)}
      ${renderAdditionalMetric('SI', 'Speed Index', mobile.additionalMetrics.si)}
      ${renderAdditionalMetric('TTI', 'Time to Interactive', mobile.additionalMetrics.tti)}
    </div>

    <!-- Recommendations -->
    ${recommendations.length > 0 ? `
    <h2 style="color: #00ff41; margin: 2rem 0 1rem 0;">💡 Recommendations</h2>
    <div style="display: grid; gap: 1rem; margin-bottom: 2rem;">
      ${recommendations.map(rec => `
        <div style="
          background: ${rec.priority === 'critical' ? 'rgba(255, 68, 68, 0.1)' : rec.priority === 'high' ? 'rgba(255, 140, 0, 0.1)' : 'rgba(255, 215, 0, 0.1)'};
          border-left: 4px solid ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : '#ffd700'};
          padding: 1.5rem;
          border-radius: 8px;
        ">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
            <h4 style="color: ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : '#ffd700'}; margin: 0;">
              ${rec.metric}
            </h4>
            <span style="
              padding: 0.25rem 0.75rem;
              background: ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : '#ffd700'};
              color: #000;
              font-size: 0.75rem;
              font-weight: bold;
              border-radius: 4px;
              text-transform: uppercase;
            ">${rec.priority}</span>
          </div>
          <p style="color: #e0e0e0; margin: 0 0 0.75rem 0; font-weight: 600;">⚠️ ${rec.issue}</p>
          <p style="color: #c0c0c0; margin: 0;">💡 ${rec.solution}</p>
        </div>
      `).join('')}
    </div>
    ` : ''}

    <!-- Field Data Context -->
    <div style="
      background: rgba(0, 255, 65, 0.05);
      border: 1px solid rgba(0, 255, 65, 0.3);
      padding: 1.5rem;
      border-radius: 8px;
      margin-bottom: 2rem;
    ">
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">ℹ️ Understanding Your Scores</h3>
      <p style="color: #e0e0e0; margin: 0 0 0.5rem 0;">${comparison.context}</p>
      <p style="color: #c0c0c0; margin: 0; font-size: 0.9rem;">${comparison.note}</p>
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0, 255, 65, 0.2);">
        <p style="color: #e0e0e0; margin: 0.5rem 0;"><strong>LCP:</strong> ${comparison.comparison.lcp.percentile} - ${comparison.comparison.lcp.realWorldImpact}</p>
        <p style="color: #e0e0e0; margin: 0.5rem 0;"><strong>CLS:</strong> ${comparison.comparison.cls.percentile} - ${comparison.comparison.cls.realWorldImpact}</p>
      </div>
    </div>

    <!-- PDF Download Button -->
    <div style="text-align: center; margin: 2rem 0; padding: 2rem; background: rgba(187, 134, 252, 0.05); border: 2px solid rgba(187, 134, 252, 0.3); border-radius: 12px;">
      <h3 style="color: #bb86fc; margin: 0 0 1rem 0;">📄 Professional CWV Report</h3>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0;">
        Get a comprehensive PDF report with detailed Core Web Vitals analysis, optimization roadmap, and Google ranking impact assessment.
      </p>
      <button 
        id="cwvPdfDownloadButton"
        style="
          padding: 1rem 2rem;
          background: linear-gradient(135deg, #bb86fc 0%, #9d5fdb 100%);
          border: none;
          border-radius: 8px;
          color: #000000;
          font-size: 1.1rem;
          font-weight: bold;
          font-family: 'Courier New', monospace;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 15px rgba(187, 134, 252, 0.3);
        "
        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(187, 134, 252, 0.5)';"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(187, 134, 252, 0.3)';"
        onclick="openPdfPurchaseModal('core-web-vitals')"
      >
        📥 Download CWV PDF Report ($5)
      </button>
      <p style="color: #808080; font-size: 0.85rem; margin: 1rem 0 0 0; font-style: italic;">
        Secure payment • Instant download • One-time purchase
      </p>
    </div>
  `;
}

function renderCWVMetrics(device) {
  return `
    <div style="display: grid; gap: 0.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #c0c0c0;">LCP</span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: #e0e0e0; font-family: 'Courier New', monospace; font-weight: bold;">${device.lcp.displayValue}</span>
          <span style="font-size: 1.2rem;">${getRatingEmoji(device.lcp.rating)}</span>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #c0c0c0;">INP/FID</span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: #e0e0e0; font-family: 'Courier New', monospace; font-weight: bold;">${device.inp.displayValue}</span>
          <span style="font-size: 1.2rem;">${getRatingEmoji(device.inp.rating)}</span>
        </div>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="color: #c0c0c0;">CLS</span>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: #e0e0e0; font-family: 'Courier New', monospace; font-weight: bold;">${device.cls.value.toFixed(3)}</span>
          <span style="font-size: 1.2rem;">${getRatingEmoji(device.cls.rating)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderMetricCard(abbr, name, metric, icon, category) {
  const ratingColor = {
    'good': '#00ff41',
    'needs-improvement': '#ffd700',
    'poor': '#ff4444',
    'unknown': '#808080'
  }[metric.rating];

  return `
    <div style="
      background: ${ratingColor}15;
      border: 2px solid ${ratingColor};
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.3s ease;
      cursor: pointer;
    " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 6px 20px ${ratingColor}50';" 
       onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
      <div style="font-size: 3rem; text-align: center; margin-bottom: 0.5rem;">${icon}</div>
      <div style="text-align: center; color: ${ratingColor}; font-weight: bold; font-size: 1.2rem; margin-bottom: 0.25rem;">${abbr}</div>
      <div style="text-align: center; color: #c0c0c0; font-size: 0.85rem; margin-bottom: 1rem;">${name}</div>
      <div style="text-align: center; font-size: 2rem; font-weight: bold; color: ${ratingColor}; margin-bottom: 0.5rem;">${metric.displayValue}</div>
      <div style="text-align: center; color: #909090; font-size: 0.8rem; margin-bottom: 0.75rem;">${category}</div>
      <div style="text-align: center; padding: 0.5rem; background: ${ratingColor}30; border-radius: 6px;">
        <div style="color: #e0e0e0; font-weight: 600; font-size: 0.9rem;">${metric.rating.toUpperCase()}</div>
      </div>
      <div style="margin-top: 0.75rem; color: #808080; font-size: 0.75rem; line-height: 1.3; text-align: center;">
        ${metric.description}
      </div>
    </div>
  `;
}

function renderAdditionalMetric(abbr, name, metric) {
  return `
    <div style="
      background: rgba(0, 150, 255, 0.1);
      border: 1px solid rgba(0, 150, 255, 0.3);
      border-radius: 8px;
      padding: 1rem;
    ">
      <div style="color: #0096ff; font-weight: bold; margin-bottom: 0.25rem;">${abbr}</div>
      <div style="color: #e0e0e0; font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem;">${metric.displayValue}</div>
      <div style="color: #c0c0c0; font-size: 0.85rem;">${name}</div>
      <div style="color: #909090; font-size: 0.75rem; margin-top: 0.5rem;">${metric.description}</div>
    </div>
  `;
}

function getRatingEmoji(rating) {
  switch(rating) {
    case 'good': return '✅';
    case 'needs-improvement': return '⚠️';
    case 'poor': return '❌';
    default: return '❓';
  }
}

function getGradeColor(grade) {
  switch(grade) {
    case 'A': return '#00ff41';
    case 'B': return '#ffd700';
    case 'C': return '#ff8c00';
    case 'D': return '#ff6b6b';
    case 'F': return '#ff4444';
    default: return '#808080';
  }
}
