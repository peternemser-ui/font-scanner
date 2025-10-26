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

    <!-- Best Practices & Optimization Guide -->
    <h2 style="color: #00ff41; margin: 2rem 0 1rem 0;">Best Practices & Optimization Guide</h2>
    ${renderBestPracticesTable(mobile, desktop)}

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
        class="pdf-download-btn"
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
      >
        📥 Download CWV PDF Report ($5)
      </button>
      <p style="color: #808080; font-size: 0.85rem; margin: 1rem 0 0 0; font-style: italic;">
        Secure payment • Instant download • One-time purchase
      </p>
    </div>
  `;

  // Add event listeners after DOM is updated
  setTimeout(() => {
    const pdfButton = document.getElementById('cwvPdfDownloadButton');
    if (pdfButton) {
      pdfButton.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 6px 20px rgba(187, 134, 252, 0.5)';
      });
      pdfButton.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 4px 15px rgba(187, 134, 252, 0.3)';
      });
      pdfButton.addEventListener('click', function() {
        if (typeof openPdfPurchaseModal === 'function') {
          openPdfPurchaseModal('core-web-vitals');
        }
      });
    }
  }, 100);
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
  }[metric.rating || 'unknown'];

  const cardId = `metric-card-${abbr.toLowerCase()}`;

  // Add the card HTML
  setTimeout(() => {
    const card = document.getElementById(cardId);
    if (card) {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-4px)';
        this.style.boxShadow = `0 6px 20px ${ratingColor}50`;
      });
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = 'none';
      });
    }
  }, 100);

  return `
    <div id="${cardId}" style="
      background: ${ratingColor}15;
      border: 2px solid ${ratingColor};
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.3s ease;
      cursor: pointer;
    ">
      <div style="font-size: 3rem; text-align: center; margin-bottom: 0.5rem;">${icon}</div>
      <div style="text-align: center; color: ${ratingColor}; font-weight: bold; font-size: 1.2rem; margin-bottom: 0.25rem;">${abbr}</div>
      <div style="text-align: center; color: #c0c0c0; font-size: 0.85rem; margin-bottom: 1rem;">${name}</div>
      <div style="text-align: center; font-size: 2rem; font-weight: bold; color: ${ratingColor}; margin-bottom: 0.5rem;">${metric.displayValue || 'N/A'}</div>
      <div style="text-align: center; color: #909090; font-size: 0.8rem; margin-bottom: 0.75rem;">${category}</div>
      <div style="text-align: center; padding: 0.5rem; background: ${ratingColor}30; border-radius: 6px;">
        <div style="color: #e0e0e0; font-weight: 600; font-size: 0.9rem;">${(metric.rating || 'UNKNOWN').toUpperCase()}</div>
      </div>
      <div style="margin-top: 0.75rem; color: #808080; font-size: 0.75rem; line-height: 1.3; text-align: center;">
        ${metric.description || 'Metric information'}
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
    default: return '⏱️'; // Clock icon instead of question mark
  }
}

function renderBestPracticesTable(mobile, desktop) {
  return `
    <div style="
      background: rgba(0, 255, 65, 0.05);
      border: 2px solid rgba(0, 255, 65, 0.3);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 2rem;
      overflow-x: auto;
    ">
      <table style="
        width: 100%;
        border-collapse: collapse;
        color: #e0e0e0;
        font-size: 0.9rem;
      ">
        <thead>
          <tr style="background: rgba(0, 255, 65, 0.1); border-bottom: 2px solid rgba(0, 255, 65, 0.4);">
            <th style="padding: 1rem; text-align: left; color: #00ff41; font-weight: bold; width: 12%;">Metric</th>
            <th style="padding: 1rem; text-align: left; color: #00ff41; font-weight: bold; width: 15%;">Google Target</th>
            <th style="padding: 1rem; text-align: center; color: #9600ff; font-weight: bold; width: 10%;">Mobile</th>
            <th style="padding: 1rem; text-align: center; color: #0096ff; font-weight: bold; width: 10%;">Desktop</th>
            <th style="padding: 1rem; text-align: center; color: #00ff41; font-weight: bold; width: 8%;">Status</th>
            <th style="padding: 1rem; text-align: left; color: #00ff41; font-weight: bold; width: 45%;">Optimization Recommendations</th>
          </tr>
        </thead>
        <tbody>
          <!-- LCP Row -->
          <tr style="border-bottom: 1px solid rgba(0, 255, 65, 0.2);">
            <td style="padding: 1rem; font-weight: bold; color: #ffd700;">
              LCP<br/>
              <span style="font-size: 0.75rem; color: #c0c0c0; font-weight: normal;">Largest Contentful Paint</span>
            </td>
            <td style="padding: 1rem; color: #c0c0c0;">
              <div style="margin-bottom: 0.25rem;"><span style="color: #00ff41;">Good:</span> ≤ 2.5s</div>
              <div style="margin-bottom: 0.25rem;"><span style="color: #ffd700;">Needs Work:</span> 2.5s - 4.0s</div>
              <div><span style="color: #ff4444;">Poor:</span> > 4.0s</div>
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #9600ff; font-weight: bold;">
              ${mobile.lcp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #0096ff; font-weight: bold;">
              ${desktop.lcp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-size: 1.5rem;">
              ${mobile.lcp.rating === 'good' && desktop.lcp.rating === 'good' ? '✅' : 
                mobile.lcp.rating === 'good' || desktop.lcp.rating === 'good' ? '⚠️' : '❌'}
            </td>
            <td style="padding: 1rem; color: #c0c0c0; line-height: 1.6;">
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">1. Optimize Critical Resources:</strong> Reduce render-blocking JavaScript and CSS. Inline critical CSS and defer non-essential scripts.</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">2. Image Optimization:</strong> Compress largest image/video, use modern formats (WebP, AVIF), implement responsive images with srcset.</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">3. Server Performance:</strong> Use CDN, enable HTTP/2, implement server-side caching, reduce server response time (TTFB).</div>
              <div><strong style="color: #e0e0e0;">4. Resource Hints:</strong> Add preload for critical resources, preconnect to required origins, use priority hints for important images.</div>
            </td>
          </tr>
          
          <!-- INP/FID Row -->
          <tr style="border-bottom: 1px solid rgba(0, 255, 65, 0.2);">
            <td style="padding: 1rem; font-weight: bold; color: #ffd700;">
              INP/FID<br/>
              <span style="font-size: 0.75rem; color: #c0c0c0; font-weight: normal;">Interaction to Next Paint</span>
            </td>
            <td style="padding: 1rem; color: #c0c0c0;">
              <div style="margin-bottom: 0.25rem;"><span style="color: #00ff41;">Good:</span> ≤ 200ms</div>
              <div style="margin-bottom: 0.25rem;"><span style="color: #ffd700;">Needs Work:</span> 200ms - 500ms</div>
              <div><span style="color: #ff4444;">Poor:</span> > 500ms</div>
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #9600ff; font-weight: bold;">
              ${mobile.inp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #0096ff; font-weight: bold;">
              ${desktop.inp.displayValue || 'N/A'}
            </td>
            <td style="padding: 1rem; text-align: center; font-size: 1.5rem;">
              ${mobile.inp.rating === 'good' && desktop.inp.rating === 'good' ? '✅' : 
                mobile.inp.rating === 'good' || desktop.inp.rating === 'good' ? '⚠️' : '❌'}
            </td>
            <td style="padding: 1rem; color: #c0c0c0; line-height: 1.6;">
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">1. Minimize JavaScript:</strong> Remove unused code, split bundles, lazy load non-critical JavaScript. Keep main thread under 50ms per task.</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">2. Optimize Event Handlers:</strong> Debounce/throttle input handlers, use passive event listeners, avoid synchronous layout calculations.</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">3. Web Workers:</strong> Move heavy computations to web workers, use requestIdleCallback for non-urgent tasks.</div>
              <div><strong style="color: #e0e0e0;">4. Third-Party Scripts:</strong> Audit and remove unnecessary third-party scripts, load them asynchronously, use facade patterns for heavy widgets.</div>
            </td>
          </tr>
          
          <!-- CLS Row -->
          <tr>
            <td style="padding: 1rem; font-weight: bold; color: #ffd700;">
              CLS<br/>
              <span style="font-size: 0.75rem; color: #c0c0c0; font-weight: normal;">Cumulative Layout Shift</span>
            </td>
            <td style="padding: 1rem; color: #c0c0c0;">
              <div style="margin-bottom: 0.25rem;"><span style="color: #00ff41;">Good:</span> ≤ 0.1</div>
              <div style="margin-bottom: 0.25rem;"><span style="color: #ffd700;">Needs Work:</span> 0.1 - 0.25</div>
              <div><span style="color: #ff4444;">Poor:</span> > 0.25</div>
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #9600ff; font-weight: bold;">
              ${mobile.cls.value.toFixed(3)}
            </td>
            <td style="padding: 1rem; text-align: center; font-family: 'Courier New', monospace; color: #0096ff; font-weight: bold;">
              ${desktop.cls.value.toFixed(3)}
            </td>
            <td style="padding: 1rem; text-align: center; font-size: 1.5rem;">
              ${mobile.cls.rating === 'good' && desktop.cls.rating === 'good' ? '✅' : 
                mobile.cls.rating === 'good' || desktop.cls.rating === 'good' ? '⚠️' : '❌'}
            </td>
            <td style="padding: 1rem; color: #c0c0c0; line-height: 1.6;">
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">1. Reserve Space:</strong> Set explicit width/height on images and videos, use CSS aspect-ratio property, reserve space for ads and embeds.</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">2. Font Loading:</strong> Use font-display: swap, preload critical fonts, avoid invisible text during font load (FOIT).</div>
              <div style="margin-bottom: 0.5rem;"><strong style="color: #e0e0e0;">3. Dynamic Content:</strong> Never insert content above existing content without user interaction, use transform animations instead of layout-shifting properties.</div>
              <div><strong style="color: #e0e0e0;">4. CSS Best Practices:</strong> Avoid animations on layout properties (width, height, top, left), use transform and opacity instead.</div>
            </td>
          </tr>
        </tbody>
      </table>
      
      <!-- Additional Context -->
      <div style="
        margin-top: 1.5rem;
        padding: 1rem;
        background: rgba(187, 134, 252, 0.08);
        border: 1px solid rgba(187, 134, 252, 0.3);
        border-radius: 8px;
      ">
        <h4 style="color: #bb86fc; margin: 0 0 0.75rem 0; font-size: 1rem;">Google's Evaluation Methodology</h4>
        <div style="color: #c0c0c0; font-size: 0.85rem; line-height: 1.6;">
          <p style="margin: 0 0 0.5rem 0;">Google evaluates Core Web Vitals at the 75th percentile of all page loads. This means:</p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li style="margin: 0.25rem 0;"><strong style="color: #00ff41;">Good (Green):</strong> 75% or more of your users experience the "good" threshold</li>
            <li style="margin: 0.25rem 0;"><strong style="color: #ffd700;">Needs Improvement (Yellow):</strong> Between "good" and "poor" thresholds</li>
            <li style="margin: 0.25rem 0;"><strong style="color: #ff4444;">Poor (Red):</strong> 25% or more of your users experience the "poor" threshold</li>
          </ul>
          <p style="margin: 0.75rem 0 0 0; padding-top: 0.75rem; border-top: 1px solid rgba(187, 134, 252, 0.2);">
            <strong>Mobile Weighting:</strong> Mobile performance counts for 70% of your overall score because Google uses mobile-first indexing for search rankings.
          </p>
        </div>
      </div>
    </div>
  `;
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
