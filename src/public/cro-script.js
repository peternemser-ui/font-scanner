// CRO Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

document.getElementById('analyzeBtn').addEventListener('click', analyzeCRO);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeCRO();
});

// Analysis steps for the loader
const analysisSteps = [
  { label: 'Initializing analysis', detail: 'Connecting to target website...' },
  { label: 'Scanning CTAs', detail: 'Detecting call-to-action buttons...' },
  { label: 'Analyzing forms', detail: 'Evaluating form conversion elements...' },
  { label: 'Checking trust signals', detail: 'Finding credibility indicators...' },
  { label: 'Testing mobile UX', detail: 'Evaluating mobile experience...' },
  { label: 'Generating CRO report', detail: 'Calculating conversion potential...' }
];

async function analyzeCRO() {
  const url = document.getElementById('url').value.trim();
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }
  
  const results = document.getElementById('results');
  const btn = document.getElementById('analyzeBtn');
  
  results.style.display = 'none';
  btn.disabled = true;
  
  // Update button text
  const buttonText = btn.querySelector('#buttonText') || btn;
  buttonText.textContent = 'Running scan...';
  
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
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: #00ff41; font-weight: 600; letter-spacing: 0.05em; padding: 0 0.5rem;">
      CRO analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(0, 255, 65, 0.7); padding: 0 0.5rem;">
      This may take 20-30 seconds
    </p>
  `;

  // Add color cycling animation
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
        white-space: pre;
        max-width: 100%;
      }
    `;
    document.head.appendChild(style);
  }
  
  loader.start(analysisSteps, '[CRO ANALYZER]', 25);
  
  // Insert patience message after loader content
  const loadingContainer = document.getElementById('loadingContainer');
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }
  
  try {
    loader.nextStep(1);
    
    const response = await fetch('/api/cro-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    loader.nextStep(2);
    loader.nextStep(3);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Server returns { error: "Error", message: "actual error message" }
      const errorMsg = errorData.message || errorData.error || 'Analysis failed - please try again';
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    
    loader.nextStep(4);
    loader.nextStep(5);
    loader.complete();
    
    displayResults(data);
    results.style.display = 'block';
    
  } catch (error) {
    const message = error.message || 'Unknown error occurred';
    // Show user-friendly message for timeout errors
    if (message.includes('timeout') || message.includes('Timeout')) {
      alert('The website took too long to respond. Please try a different site or try again later.');
    } else {
      alert(`Error: ${message}`);
    }
    loader.complete();
  } finally {
    btn.disabled = false;
    const buttonText = btn.querySelector('#buttonText') || btn;
    buttonText.textContent = 'Run scan';
  }
}

function displayResults(data) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';
  
  // Store results globally for PDF generation
  window.currentCROResults = data;

  // 1. Overview Section with Score Circle
  const overviewSection = document.createElement('div');
  overviewSection.className = 'section';
  overviewSection.innerHTML = createOverviewSection(data);
  resultsContainer.appendChild(overviewSection);

  // 2. Quick Wins Section (if any)
  if (data.quickWins && data.quickWins.length > 0) {
    const quickWinsSection = document.createElement('div');
    quickWinsSection.className = 'section';
    quickWinsSection.innerHTML = createQuickWinsSection(data.quickWins);
    resultsContainer.appendChild(quickWinsSection);
  }

  // 3. Score Breakdown Cards
  const breakdownSection = document.createElement('div');
  breakdownSection.className = 'section';
  breakdownSection.innerHTML = createScoreBreakdownCards(data.scores);
  resultsContainer.appendChild(breakdownSection);

  // 4. Accordion Sections
  createCROAccordionSection(resultsContainer, 'cta-analysis', '🎯 Call-to-Action Analysis', 
    () => renderCTAContent(data.analysis.ctas), data.scores.cta);
  createCROAccordionSection(resultsContainer, 'form-analysis', '📝 Form Optimization', 
    () => renderFormContent(data.analysis.forms), data.scores.form);
  createCROAccordionSection(resultsContainer, 'trust-signals', '🛡️ Trust Signals', 
    () => renderTrustContent(data.analysis.trustSignals), data.scores.trust);
  createCROAccordionSection(resultsContainer, 'mobile-ux', '📱 Mobile Experience', 
    () => renderMobileContent(data.analysis.mobileUX), data.scores.mobile);
  createCROAccordionSection(resultsContainer, 'recommendations', '💡 All Recommendations',
    () => renderRecommendationsContent(data.recommendations), null);

  // Add PDF Export Button
  const exportSection = document.createElement('div');
  exportSection.className = 'section';
  exportSection.style.cssText = 'text-align: center; margin-top: 2rem; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.1);';
  exportSection.innerHTML = `
    <h3 style="margin-bottom: 1.5rem; color: var(--text-primary);">Export Report</h3>
    <button id="exportPdfBtn" class="export-pdf-btn" style="
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1.5rem;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
      color: #ef4444;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.95rem;
      transition: all 0.2s ease;
    " onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download PDF Report
    </button>
  `;
  resultsContainer.appendChild(exportSection);
}

function createQuickWinsSection(quickWins) {
  return `
    <div style="
      background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%);
      border: 2px solid #ffd700;
      border-radius: 12px;
      padding: 1.5rem 2rem;
      margin: 1rem 0 2rem 0;
    ">
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem;">
        <span style="font-size: 1.75rem;">⚡</span>
        <h2 style="margin: 0; color: #ffd700; font-size: 1.4rem;">Quick Wins</h2>
        <span style="
          background: rgba(255, 215, 0, 0.2);
          color: #ffd700;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        ">High Impact • Low Effort</span>
      </div>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0; font-size: 0.95rem;">
        These fixes take just minutes but can significantly improve your conversions.
      </p>
      
      <div style="display: grid; gap: 1rem;">
        ${quickWins.map((win, index) => `
          <div style="
            background: rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 215, 0, 0.3);
            border-radius: 10px;
            padding: 1.25rem;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 1rem;
            align-items: start;
          ">
            <!-- Icon & Number -->
            <div style="
              width: 50px;
              height: 50px;
              background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
              border-radius: 10px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(255, 215, 0, 0.3);
            ">
              <span style="font-size: 1.5rem;">${win.icon}</span>
            </div>
            
            <!-- Content -->
            <div>
              <h3 style="margin: 0 0 0.5rem 0; color: #fff; font-size: 1.1rem;">${win.title}</h3>
              <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  color: #00ff41;
                  font-size: 0.85rem;
                  font-weight: 600;
                ">
                  <span>⏱</span> ${win.timeEstimate}
                </span>
                <span style="
                  display: inline-flex;
                  align-items: center;
                  gap: 0.35rem;
                  color: #00d9ff;
                  font-size: 0.85rem;
                  font-weight: 600;
                ">
                  <span>📈</span> ${win.impact}
                </span>
                <span style="
                  background: ${win.difficulty === 'Easy' ? 'rgba(0, 255, 65, 0.15)' : 'rgba(255, 140, 0, 0.15)'};
                  color: ${win.difficulty === 'Easy' ? '#00ff41' : '#ff8c00'};
                  padding: 0.15rem 0.5rem;
                  border-radius: 4px;
                  font-size: 0.75rem;
                  font-weight: 600;
                ">${win.difficulty}</span>
              </div>
              
              <!-- Steps -->
              <div style="
                background: rgba(255, 255, 255, 0.03);
                border-radius: 6px;
                padding: 0.75rem 1rem;
              ">
                <div style="color: #808080; font-size: 0.75rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">How to fix:</div>
                <ol style="margin: 0; padding-left: 1.25rem; color: #b0b0b0; font-size: 0.85rem; line-height: 1.6;">
                  ${win.steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
              </div>
            </div>
            
            <!-- Quick Win Number -->
            <div style="
              color: rgba(255, 215, 0, 0.4);
              font-size: 2rem;
              font-weight: 900;
              line-height: 1;
            ">#${index + 1}</div>
          </div>
        `).join('')}
      </div>
      
      <div style="
        margin-top: 1.25rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 215, 0, 0.2);
        display: flex;
        align-items: center;
        gap: 0.5rem;
        color: #808080;
        font-size: 0.85rem;
      ">
        <span>💡</span>
        <span>Implementing all quick wins could improve conversions by <strong style="color: #ffd700;">30-50%</strong></span>
      </div>
    </div>
  `;
}

function createOverviewSection(data) {
  const gradeColor = getGradeColor(data.grade);
  
  return `
    <h2>[CONVERSION_OVERVIEW]</h2>
    
    <div style="
      background: linear-gradient(135deg, ${gradeColor}10 0%, ${gradeColor}05 100%);
      border: 2px solid ${gradeColor};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px ${gradeColor}20;
    ">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: center;">
        <!-- Left: Score Circle -->
        <div style="text-align: center;">
          <div style="
            width: 180px;
            height: 180px;
            border-radius: 50%;
            background: #ffffff;
            border: 5px solid ${gradeColor};
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 30px ${gradeColor}40, 0 4px 15px rgba(0,0,0,0.2);
          ">
            <div style="
              font-size: 4.5rem;
              font-weight: 900;
              color: #000000;
              line-height: 1;
            ">${data.overallScore}</div>
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
            color: ${gradeColor};
          ">${getGradeName(data.grade)}</div>
        </div>
        
        <!-- Right: Quick Stats -->
        <div>
          <h3 style="color: ${gradeColor}; margin: 0 0 1rem 0; font-size: 1.3rem;">>> Quick Stats</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Overall Grade</span>
              <span style="color: ${gradeColor}; font-weight: bold;">${data.grade}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">CTAs Detected</span>
              <span style="color: ${data.analysis.ctas.count > 0 ? '#00ff41' : '#ff4444'}; font-weight: bold;">${data.analysis.ctas.count}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Forms Found</span>
              <span style="color: ${data.analysis.forms.count > 0 ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${data.analysis.forms.count}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: #c0c0c0;">Conversion Potential</span>
              <span style="color: ${gradeColor}; font-weight: bold;">${data.conversionPotential}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createScoreBreakdownCards(scores) {
  const categories = [
    { key: 'cta', label: 'Call-to-Action', icon: '🎯' },
    { key: 'form', label: 'Forms', icon: '📝' },
    { key: 'trust', label: 'Trust Signals', icon: '🛡️' },
    { key: 'mobile', label: 'Mobile UX', icon: '📱' }
  ];

  return `
    <h2>[SCORE_BREAKDOWN]</h2>
    <p style="color: #c0c0c0; margin-bottom: 1rem;">>> Category performance breakdown</p>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;">
      ${categories.map(cat => {
        const score = scores[cat.key] || 0;
        const color = getScoreColor(score);
        return `
          <div style="
            background: linear-gradient(135deg, ${color}15 0%, ${color}05 100%);
            border: 2px solid ${color}80;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          ">
            <div style="
              width: 80px;
              height: 80px;
              margin: 0 auto 1rem;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid ${color};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 2rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px ${color}40;
            ">${score}</div>
            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">${cat.icon}</div>
            <div style="color: #c0c0c0; font-size: 0.9rem;">${cat.label}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function createCROAccordionSection(container, id, title, contentCreator, score) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span>${title}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
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
      content.style.maxHeight = content.scrollHeight + 100 + 'px';
      content.style.padding = '1rem 1.25rem';
      content.style.borderTop = '1px solid #333';
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
}

function getGradeName(grade) {
  const names = {
    'A': 'Excellent',
    'B': 'Good', 
    'C': 'Fair',
    'D': 'Poor',
    'F': 'Critical'
  };
  return names[grade] || 'Unknown';
}

function renderCTAContent(ctas) {
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Call-to-Action Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        CTAs are the primary conversion elements on your page. Strong, visible CTAs with action-oriented text drive conversions.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 1rem;">
        <div style="
          background: rgba(0, 255, 65, 0.05);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; font-weight: 900; color: #00ff41;">${ctas.count}</div>
          <div style="color: #c0c0c0; margin-top: 0.5rem;">Total CTAs Found</div>
        </div>
        <div style="
          background: rgba(0, 200, 255, 0.05);
          border: 1px solid rgba(0, 200, 255, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; font-weight: 900; color: #00c8ff;">${ctas.visible}</div>
          <div style="color: #c0c0c0; margin-top: 0.5rem;">Above the Fold</div>
        </div>
      </div>
      
      ${ctas.examples.length > 0 ? `
        <h4 style="color: #bb86fc; margin: 1.5rem 0 1rem 0;">CTA Examples Found:</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem;">
          ${ctas.examples.map(text => `
            <span style="
              background: linear-gradient(135deg, rgba(0, 255, 65, 0.15) 0%, rgba(0, 255, 65, 0.05) 100%);
              padding: 0.75rem 1.25rem;
              border-radius: 6px;
              border: 1px solid rgba(0, 255, 65, 0.4);
              color: #00ff41;
              font-weight: 500;
            ">${text}</span>
          `).join('')}
        </div>
      ` : `
        <div style="
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid rgba(255, 68, 68, 0.3);
          border-radius: 8px;
          padding: 1rem;
          color: #ff4444;
        ">
          ⚠️ No action-oriented CTAs detected. Add buttons with text like "Get Started", "Sign Up", or "Buy Now".
        </div>
      `}
    </div>
  `;
}

function renderFormContent(forms) {
  if (forms.count === 0) {
    return `
      <div>
        <h3 style="color: #ff8c00; margin: 0 0 1rem 0;">>> Form Analysis</h3>
        <div style="
          background: rgba(255, 140, 0, 0.1);
          border: 1px solid rgba(255, 140, 0, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">📝</div>
          <p style="color: #ff8c00; font-weight: bold; margin: 0;">No forms detected on this page</p>
          <p style="color: #c0c0c0; margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            Consider adding a contact form or lead capture form to improve conversions.
          </p>
        </div>
      </div>
    `;
  }
  
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Form Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Forms are critical for lead capture. Optimize field count, validation, and user experience for higher completion rates.
      </p>
      
      <div style="overflow-x: auto; margin-bottom: 1rem;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid #333;">
              <th style="text-align: left; padding: 0.75rem; color: #bb86fc;">Form</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Fields</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Email</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Phone</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Validation</th>
              <th style="text-align: center; padding: 0.75rem; color: #bb86fc;">Autocomplete</th>
            </tr>
          </thead>
          <tbody>
            ${forms.details.map((form, idx) => `
              <tr style="border-bottom: 1px solid #333;">
                <td style="padding: 0.75rem; color: #c0c0c0;">Form ${idx + 1}</td>
                <td style="padding: 0.75rem; text-align: center; color: ${form.fieldCount <= 5 ? '#00ff41' : form.fieldCount <= 8 ? '#ffd700' : '#ff4444'}; font-weight: bold;">
                  ${form.fieldCount}
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasEmail ? '#00ff41' : '#808080'};">${form.hasEmail ? '✓' : '–'}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasPhone ? '#00ff41' : '#808080'};">${form.hasPhone ? '✓' : '–'}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasValidation ? '#00ff41' : '#ff8c00'};">${form.hasValidation ? '✓' : '✗'}</span>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${form.hasAutocomplete ? '#00ff41' : '#ff8c00'};">${form.hasAutocomplete ? '✓' : '✗'}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div style="
        background: rgba(138, 43, 226, 0.05);
        border-radius: 6px;
        padding: 1rem;
        margin-top: 1rem;
      ">
        <h4 style="color: #bb86fc; margin: 0 0 0.5rem 0; font-size: 0.95rem;">💡 Form Optimization Tips</h4>
        <ul style="color: #c0c0c0; margin: 0; padding-left: 1.5rem; font-size: 0.9rem;">
          <li>Keep forms under 5 fields when possible</li>
          <li>Use autocomplete to speed up form filling</li>
          <li>Add inline validation for better UX</li>
        </ul>
      </div>
    </div>
  `;
}

function renderTrustContent(trust) {
  const signals = [
    { key: 'hasSSL', label: 'SSL Certificate', icon: '🔒', desc: 'Secure HTTPS connection' },
    { key: 'hasTestimonials', label: 'Testimonials', icon: '💬', desc: 'Customer reviews visible' },
    { key: 'hasSocialProof', label: 'Social Proof', icon: '👥', desc: 'Trust badges or certifications' },
    { key: 'hasContactInfo', label: 'Contact Information', icon: '📞', desc: 'Phone number displayed' },
    { key: 'hasPrivacyPolicy', label: 'Privacy Policy', icon: '📋', desc: 'Privacy policy link found' },
    { key: 'hasSecurityBadges', label: 'Security Badges', icon: '🛡️', desc: 'Security seals visible' }
  ];

  const presentCount = signals.filter(s => trust[s.key]).length;
  
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Trust Signal Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Trust signals reduce friction and increase conversion rates. ${presentCount} of ${signals.length} trust elements detected.
      </p>
      
      <div style="display: grid; gap: 0.75rem;">
        ${signals.map(signal => {
          const hasIt = trust[signal.key];
          return `
            <div style="
              display: grid;
              grid-template-columns: auto 1fr auto;
              gap: 1rem;
              align-items: center;
              padding: 1rem;
              background: ${hasIt ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 68, 68, 0.05)'};
              border: 1px solid ${hasIt ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 68, 68, 0.2)'};
              border-radius: 8px;
            ">
              <span style="font-size: 1.5rem;">${signal.icon}</span>
              <div>
                <div style="color: #e0e0e0; font-weight: 500;">${signal.label}</div>
                <div style="color: #808080; font-size: 0.85rem;">${signal.desc}</div>
              </div>
              <span style="
                font-size: 1.5rem;
                color: ${hasIt ? '#00ff41' : '#ff4444'};
              ">${hasIt ? '✓' : '✗'}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderMobileContent(mobile) {
  const tapPercent = (mobile.tapTargetCompliance * 100).toFixed(1);
  
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Mobile UX Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Mobile optimization is critical - over 60% of web traffic comes from mobile devices.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
        <!-- Tap Targets -->
        <div style="
          background: ${mobile.tapTargetCompliance >= 0.8 ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 140, 0, 0.05)'};
          border: 2px solid ${mobile.tapTargetCompliance >= 0.8 ? 'rgba(0, 255, 65, 0.4)' : 'rgba(255, 140, 0, 0.4)'};
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 1rem;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid ${mobile.tapTargetCompliance >= 0.8 ? '#00ff41' : '#ff8c00'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: 900;
            color: #000;
          ">${tapPercent}%</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Tap Target Compliance</div>
          <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">44×44px minimum</div>
        </div>
        
        <!-- Font Size -->
        <div style="
          background: ${mobile.avgFontSize >= 16 ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 140, 0, 0.05)'};
          border: 2px solid ${mobile.avgFontSize >= 16 ? 'rgba(0, 255, 65, 0.4)' : 'rgba(255, 140, 0, 0.4)'};
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 1rem;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid ${mobile.avgFontSize >= 16 ? '#00ff41' : '#ff8c00'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.3rem;
            font-weight: 900;
            color: #000;
          ">${mobile.avgFontSize.toFixed(0)}px</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Average Font Size</div>
          <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">16px recommended</div>
        </div>
        
        <!-- Viewport Meta -->
        <div style="
          background: ${mobile.hasViewportMeta ? 'rgba(0, 255, 65, 0.05)' : 'rgba(255, 68, 68, 0.05)'};
          border: 2px solid ${mobile.hasViewportMeta ? 'rgba(0, 255, 65, 0.4)' : 'rgba(255, 68, 68, 0.4)'};
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="
            width: 80px;
            height: 80px;
            margin: 0 auto 1rem;
            border-radius: 50%;
            background: #ffffff;
            border: 3px solid ${mobile.hasViewportMeta ? '#00ff41' : '#ff4444'};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            color: ${mobile.hasViewportMeta ? '#00cc33' : '#cc0000'};
          ">${mobile.hasViewportMeta ? '✓' : '✗'}</div>
          <div style="color: #c0c0c0; font-size: 0.9rem;">Viewport Meta</div>
          <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">Responsive scaling</div>
        </div>
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <div>
        <h3 style="color: #00ff41; margin: 0 0 1rem 0;">>> Recommendations</h3>
        <div style="
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
          text-align: center;
        ">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🎉</div>
          <p style="color: #00ff41; font-weight: bold; margin: 0;">Great job! No critical issues found.</p>
          <p style="color: #c0c0c0; margin: 0.5rem 0 0 0; font-size: 0.9rem;">
            Your page follows CRO best practices.
          </p>
        </div>
      </div>
    `;
  }
  
  const priorityColors = {
    critical: '#ff4444',
    high: '#ff8c00',
    medium: '#ffd700',
    low: '#00ff41'
  };

  return `
    <div>
      <h3 style="color: #bb86fc; margin: 0 0 1rem 0;">>> Actionable Recommendations</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem;">
        Prioritized improvements to boost your conversion rate.
      </p>
      
      <div style="display: grid; gap: 1rem;">
        ${recommendations.map(rec => {
          const color = priorityColors[rec.priority] || '#808080';
          return `
            <div style="
              background: ${color}10;
              border-left: 4px solid ${color};
              border-radius: 0 8px 8px 0;
              padding: 1.25rem;
            ">
              <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
                <span style="
                  background: ${color}30;
                  color: ${color};
                  padding: 0.25rem 0.5rem;
                  border-radius: 4px;
                  font-size: 0.75rem;
                  font-weight: bold;
                  text-transform: uppercase;
                ">${rec.priority}</span>
                <h4 style="color: #e0e0e0; margin: 0; font-size: 1rem;">${rec.message}</h4>
              </div>
              <p style="color: #c0c0c0; margin: 0 0 0.5rem 0; font-size: 0.9rem;">${rec.detail}</p>
              <p style="color: ${color}; margin: 0; font-size: 0.85rem; font-style: italic;">
                ⚡ Impact: ${rec.impact}
              </p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function getGradeColor(grade) {
  const colors = { 'A': '#00ff41', 'B': '#ffd700', 'C': '#ff8c00', 'D': '#ff4444', 'F': '#ff4444' };
  return colors[grade] || '#888';
}

function getScoreColor(score) {
  if (score >= 90) return '#00ff41';
  if (score >= 70) return '#ffd700';
  if (score >= 50) return '#ff8c00';
  return '#ff4444';
}

/**
 * Initialize PDF Export for CRO Analyzer
 */
function initCROPDFExport() {
  if (typeof initPDFExport === 'function') {
    initPDFExport({
      contentSelector: '#results, #resultsContent, .results-container',
      buttonSelector: '#exportPdfBtn, .export-pdf-btn, #downloadPdfButton',
      reportSubtitle: 'Conversion Rate Optimization Analysis',
      urlInputSelector: '#urlInput, input[type="url"]',
      filename: `cro-analysis-${new Date().toISOString().split('T')[0]}.pdf`
    });
    console.log('CRO Analyzer PDF export initialized');
  } else {
    console.warn('PDF export utility not loaded');
  }
}

// Initialize PDF export when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCROPDFExport);
} else {
  initCROPDFExport();
}
