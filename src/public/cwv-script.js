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
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: #00ff41; font-weight: 600; letter-spacing: 0.05em;">
      Measuring core web vitals...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(0, 255, 65, 0.7);">
      This may take 30-60 seconds
    </p>
  `;

  // Add color cycling style
  const style = document.createElement('style');
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
  
  // Insert ASCII art after loader starts
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }

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
        ${mobile.passedCWV ? '✓ PASSING Core Web Vitals (Good for Google Rankings)' : '✗ FAILING Core Web Vitals (May hurt Google Rankings)'}
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
      <h3 style="color: #ff4444; margin: 0 0 1rem 0;">! Critical Issues</h3>
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
          <span>M Mobile (70% weight)</span>
          <span style="font-size: 2rem;">${mobile.score}/100</span>
        </h3>
        ${renderCWVMetrics(mobile)}
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(150, 0, 255, 0.3);">
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            ${mobile.passedCWV ? '✓ All Core Web Vitals passed' : '✗ Some metrics need improvement'}
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
          <span>D Desktop (30% weight)</span>
          <span style="font-size: 2rem;">${desktop.score}/100</span>
        </h3>
        ${renderCWVMetrics(desktop)}
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0, 150, 255, 0.3);">
          <p style="color: #c0c0c0; font-size: 0.9rem; margin: 0;">
            ${desktop.passedCWV ? '✓ All Core Web Vitals passed' : '~ Some metrics need improvement'}
          </p>
        </div>
      </div>
    </div>

    <!-- Accordions for detailed analysis -->
    ${createCWVAccordionSection('best-practices', '📋', 'Best Practices & Optimization Guide', renderBestPracticesTable(mobile, desktop), Math.round((mobile.score + desktop.score) / 2))}
    
    ${createCWVAccordionSection('core-vitals', '⚡', 'The Big 3: Google\'s Core Web Vitals', `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; padding: 1rem 0;">
        ${renderMetricCard('LCP', 'Largest Contentful Paint', mobile.lcp, desktop.lcp, '⏱️', 'Loading Performance')}
        ${renderMetricCard('INP', 'Interaction to Next Paint', mobile.inp, desktop.inp, '👆', 'Responsiveness')}
        ${renderMetricCard('CLS', 'Cumulative Layout Shift', mobile.cls, desktop.cls, '📐', 'Visual Stability')}
      </div>
    `, Math.round((mobile.score + desktop.score) / 2))}
    
    ${createCWVAccordionSection('additional-metrics', '📊', 'Additional Performance Metrics', `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; padding: 1rem 0;">
        ${renderAdditionalMetric('FCP', 'First Contentful Paint', mobile.additionalMetrics.fcp, desktop.additionalMetrics.fcp)}
        ${renderAdditionalMetric('SI', 'Speed Index', mobile.additionalMetrics.si, desktop.additionalMetrics.si)}
        ${renderAdditionalMetric('TTI', 'Time to Interactive', mobile.additionalMetrics.tti, desktop.additionalMetrics.tti)}
      </div>
    `, null)}

    <!-- Recommendations -->
    ${recommendations.length > 0 ? createCWVAccordionSection('recommendations', '💡', 'Recommendations', `
      <div style="display: grid; gap: 1rem; padding: 1rem 0;">
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
            <p style="color: #e0e0e0; margin: 0 0 0.75rem 0; font-weight: 600;">~ ${rec.issue}</p>
            <p style="color: #c0c0c0; margin: 0;">ⓘ ${rec.solution}</p>
          </div>
        `).join('')}
      </div>
    `, null) : ''}

    ${createCWVAccordionSection('understanding-scores', 'ℹ️', 'Understanding Your Scores', `
      <div style="padding: 1rem 0;">
        <p style="color: #e0e0e0; margin: 0 0 0.5rem 0;">${comparison.context}</p>
        <p style="color: #c0c0c0; margin: 0; font-size: 0.9rem;">${comparison.note}</p>
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(0, 255, 65, 0.2);">
          <p style="color: #e0e0e0; margin: 0.5rem 0;"><strong>LCP:</strong> ${comparison.comparison.lcp.percentile} - ${comparison.comparison.lcp.realWorldImpact}</p>
          <p style="color: #e0e0e0; margin: 0.5rem 0;"><strong>CLS:</strong> ${comparison.comparison.cls.percentile} - ${comparison.comparison.cls.realWorldImpact}</p>
        </div>
      </div>
    `, null)}

    <!-- PDF Download button removed - monetization disabled -->
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

function renderMetricCard(abbr, name, mobileMetric, desktopMetric, icon, category) {
  // Determine overall rating based on mobile (70% weight) and desktop (30% weight)
  const mobileRating = mobileMetric.rating || 'unknown';
  const desktopRating = desktopMetric.rating || 'unknown';
  
  // Use mobile rating as primary since it's weighted more heavily
  const primaryRating = mobileRating;
  
  const ratingColor = {
    'good': '#00ff41',
    'needs-improvement': '#ffd700',
    'poor': '#ff4444',
    'unknown': '#808080'
  }[primaryRating];

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
      background: rgba(0, 0, 0, 0.4);
      border: 2px solid ${ratingColor};
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.3s ease;
      cursor: pointer;
    ">
      <div style="font-size: 3rem; text-align: center; margin-bottom: 0.5rem;">${icon}</div>
      <div style="text-align: center; color: ${ratingColor}; font-weight: bold; font-size: 1.2rem; margin-bottom: 0.25rem;">${abbr}</div>
      <div style="text-align: center; color: #c0c0c0; font-size: 0.85rem; margin-bottom: 1rem;">${name}</div>
      
      <!-- Mobile and Desktop Values -->
      <div style="margin-bottom: 1rem;">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
          padding: 0.5rem;
          background: rgba(150, 0, 255, 0.1);
          border-radius: 6px;
        ">
          <span style="color: #9600ff; font-size: 0.85rem; font-weight: bold;">M Mobile</span>
          <span style="color: #e0e0e0; font-family: 'Courier New', monospace; font-weight: bold; font-size: 1.1rem;">
            ${abbr === 'CLS' ? mobileMetric.value.toFixed(3) : (mobileMetric.displayValue || 'N/A')}
          </span>
        </div>
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem;
          background: rgba(0, 150, 255, 0.1);
          border-radius: 6px;
        ">
          <span style="color: #0096ff; font-size: 0.85rem; font-weight: bold;">D Desktop</span>
          <span style="color: #e0e0e0; font-family: 'Courier New', monospace; font-weight: bold; font-size: 1.1rem;">
            ${abbr === 'CLS' ? desktopMetric.value.toFixed(3) : (desktopMetric.displayValue || 'N/A')}
          </span>
        </div>
      </div>
      
      <div style="text-align: center; color: #909090; font-size: 0.8rem; margin-bottom: 0.75rem;">${category}</div>
      <div style="text-align: center; padding: 0.5rem; border: 1px solid ${ratingColor}; border-radius: 6px;">
        <div style="color: ${ratingColor}; font-weight: 600; font-size: 0.9rem;">${primaryRating.toUpperCase().replace('-', ' ')}</div>
      </div>
      <div style="margin-top: 0.75rem; color: #808080; font-size: 0.75rem; line-height: 1.3; text-align: center;">
        ${mobileMetric.description || 'Metric information'}
      </div>
    </div>
  `;
}

function renderAdditionalMetric(abbr, name, mobileMetric, desktopMetric) {
  return `
    <div style="
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(0, 150, 255, 0.3);
      border-radius: 8px;
      padding: 1rem;
    ">
      <div style="color: #0096ff; font-weight: bold; margin-bottom: 0.5rem;">${abbr}</div>
      <div style="color: #c0c0c0; font-size: 0.85rem; margin-bottom: 1rem;">${name}</div>
      
      <!-- Mobile Value -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
        padding: 0.5rem;
        background: rgba(150, 0, 255, 0.1);
        border-radius: 6px;
      ">
        <span style="color: #9600ff; font-size: 0.8rem; font-weight: bold;">M Mobile</span>
        <span style="color: #e0e0e0; font-family: 'Courier New', monospace; font-weight: bold; font-size: 1rem;">
          ${mobileMetric.displayValue}
        </span>
      </div>
      
      <!-- Desktop Value -->
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.5rem;
        background: rgba(0, 150, 255, 0.1);
        border-radius: 6px;
      ">
        <span style="color: #0096ff; font-size: 0.8rem; font-weight: bold;">D Desktop</span>
        <span style="color: #e0e0e0; font-family: 'Courier New', monospace; font-weight: bold; font-size: 1rem;">
          ${desktopMetric.displayValue}
        </span>
      </div>
      
      <div style="color: #909090; font-size: 0.75rem; margin-top: 0.75rem; line-height: 1.3;">
        ${mobileMetric.description}
      </div>
    </div>
  `;
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
              ${mobile.lcp.rating === 'good' && desktop.lcp.rating === 'good' ? '✓' : 
                mobile.lcp.rating === 'good' || desktop.lcp.rating === 'good' ? '~' : '✗'}
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
              ${mobile.inp.rating === 'good' && desktop.inp.rating === 'good' ? '✓' : 
                mobile.inp.rating === 'good' || desktop.inp.rating === 'good' ? '~' : '✗'}
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
              ${mobile.cls.rating === 'good' && desktop.cls.rating === 'good' ? '✓' : 
                mobile.cls.rating === 'good' || desktop.cls.rating === 'good' ? '~' : '✗'}
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

function getRatingEmoji(rating) {
  if (rating === 'good') return '✓';
  if (rating === 'needs-improvement') return '⚠️';
  return '✗';
}

// Accordion helper functions
function createCWVAccordionSection(id, icon, title, contentHTML, score = null) {
  const scoreHTML = score !== null ? `
    <span class="accordion-badge" style="
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-weight: 600;
      background: ${score >= 90 ? 'rgba(0, 255, 65, 0.2)' : score >= 70 ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'};
      color: ${score >= 90 ? '#00ff41' : score >= 70 ? '#ffd700' : '#ff4444'};
      border: 1px solid ${score >= 90 ? 'rgba(0, 255, 65, 0.4)' : score >= 70 ? 'rgba(255, 215, 0, 0.4)' : 'rgba(255, 68, 68, 0.4)'};
    ">${score}</span>
  ` : '';

  return `
    <div class="accordion" style="margin-bottom: 0.5rem; border-radius: 8px; overflow: hidden; background: rgba(255, 255, 255, 0.03);">
      <div class="accordion-header" onclick="toggleCWVAccordion('${id}')" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.875rem 1.25rem;
        cursor: pointer;
        background: transparent;
        transition: all 0.2s ease;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.25rem;">${icon}</span>
          <span style="font-weight: 600; color: #ffffff;">${title}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          ${scoreHTML}
          <span class="accordion-chevron" style="transition: transform 0.2s ease; color: #808080;">▼</span>
        </div>
      </div>
      <div class="accordion-content" id="${id}" style="
        max-height: 0;
        overflow: hidden;
        transition: all 0.3s ease;
        padding: 0 1.25rem;
        border-top: 0px solid rgba(255, 255, 255, 0.1);
      ">
        <div class="accordion-body" style="padding: 0;">${contentHTML}</div>
      </div>
    </div>
  `;
}

function toggleCWVAccordion(accordionId) {
  const content = document.getElementById(accordionId);
  const header = content.previousElementSibling;
  const chevron = header.querySelector('.accordion-chevron');
  
  if (content.style.maxHeight && content.style.maxHeight !== '0px') {
    // Collapse
    content.style.maxHeight = '0px';
    content.style.padding = '0 1.25rem';
    content.style.borderTopWidth = '0px';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    // Expand
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.padding = '1rem 1.25rem';
    content.style.borderTopWidth = '1px';
    chevron.style.transform = 'rotate(180deg)';
    
    // Adjust max-height after content loads (images, etc.)
    setTimeout(() => {
      if (content.style.maxHeight !== '0px') {
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    }, 100);
  }
}

// Auto-start scan if URL parameter is present
if (typeof window.getUrlParameter === 'function') {
  window.addEventListener('DOMContentLoaded', () => {
    const autoUrl = window.getUrlParameter();
    if (autoUrl) {
      console.log('→ Auto-starting Core Web Vitals analysis for:', autoUrl);
      urlInput.value = autoUrl;
      setTimeout(() => {
        analyzeButton.click();
      }, 500);
    }
  });
}
