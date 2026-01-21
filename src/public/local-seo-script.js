// Local SEO Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'local-seo';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

// Analysis steps for the loader
const analysisSteps = [
  { label: 'Initializing analysis', detail: 'Connecting to target website...' },
  { label: 'Extracting NAP data', detail: 'Finding Name, Address, Phone information...' },
  { label: 'Checking structured data', detail: 'Scanning for LocalBusiness schema...' },
  { label: 'Analyzing local signals', detail: 'Checking maps, social profiles, hours...' },
  { label: 'Generating recommendations', detail: 'Compiling local SEO insights...' }
];

async function analyze() {
  const url = document.getElementById('url').value.trim();
  if (!url) { 
    alert('Please enter a URL'); 
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
    background: rgba(var(--accent-primary-rgb), 0.05);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em; padding: 0 0.5rem;">
      Local SEO analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      This may take 30-60 seconds for complex sites
    </p>
  `;

  // Add color cycling animation
  if (!document.getElementById('ascii-art-style')) {
    const style = document.createElement('style');
    style.id = 'ascii-art-style';
    style.textContent = `
      @keyframes color-cycle {
        0% { color: var(--accent-primary); }
        20% { color: #00ffff; }
        40% { color: #0099ff; }
        60% { color: #9933ff; }
        80% { color: #ff33cc; }
        100% { color: var(--accent-primary); }
      }
      .ascii-art-responsive {
        font-size: clamp(0.35rem, 1.2vw, 0.65rem);
        white-space: pre;
        max-width: 100%;
      }
    `;
    document.head.appendChild(style);
  }
  
  loader.start(analysisSteps, '[LOCAL SEO ANALYZER]', 20);
  
  // Insert patience message after loader content
  const loadingContainer = document.getElementById('loadingContainer');
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }
  
  try {
    loader.nextStep(1);

    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);
    
    // Set up AbortController with 90 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);
    
    const response = await fetch('/api/local-seo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, scanStartedAt }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    loader.nextStep(2);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.message || errorData.error || 'Analysis failed - please try again';
      throw new Error(errorMsg);
    }
    
    const data = await response.json();
    
    loader.nextStep(3);
    loader.nextStep(4);
    loader.complete();
    
    displayResults(data);
    results.style.display = 'block';
    
  } catch (error) {
    const message = error.message || 'Unknown error occurred';
    if (message.includes('timeout') || message.includes('Timeout')) {
      alert('The website took too long to respond. Please try a different site or try again later.');
    } else {
      alert(`Error: ${message}`);
    }
    loader.complete();
  } finally {
    btn.disabled = false;
  }
}

function displayResults(data) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';
  
  // Store results globally for PDF generation
  window.currentLocalSEOResults = data;

  const reportUrl = (data && data.url) || (document.getElementById('url')?.value || '').trim();
  const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
  const analyzerKey = window.SM_ANALYZER_KEY || 'local-seo';

  let reportId = null;
  if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
    reportId = window.ReportUI.makeReportId({
      analyzerKey,
      normalizedUrl: reportUrl,
      startedAtISO: scanStartedAt
    });
  } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
    reportId = window.ReportUI.computeReportId(reportUrl, scanStartedAt, analyzerKey);
  }

  const isUnlocked = reportId && (
    (window.CreditsManager && typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
    (window.CreditsManager && typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
  );

  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    resultsContainer.setAttribute('data-sm-report-id', reportId);
  }

  if (window.ReportContainer && typeof window.ReportContainer.create === 'function') {
    const summary = [
      { label: 'Overall Score', score: Math.round(data.overallScore || 0) },
      { label: 'NAP', score: Math.round(data.scores?.nap || 0) },
      { label: 'Schema', score: Math.round(data.scores?.schema || 0) },
      { label: 'Presence', score: Math.round(data.scores?.presence || 0) }
    ];

    const sections = [
      {
        id: 'local-seo-overview',
        title: 'Local SEO Overview',
        scoreTextRight: `${Math.round(data.overallScore || 0)}/100`,
        contentHTML: createOverviewSection(data),
        context: 'local-seo',
        reportId
      }
    ];

    if (data.quickWins && data.quickWins.length > 0) {
      sections.push({
        id: 'quick-wins',
        title: 'Quick Wins',
        scoreTextRight: 'High impact',
        contentHTML: createQuickWinsSection(data.quickWins),
        context: 'local-seo',
        reportId
      });
    }

    sections.push(
      {
        id: 'score-breakdown',
        title: 'Score Breakdown',
        scoreTextRight: 'By category',
        contentHTML: createScoreBreakdownCards(data.scores),
        context: 'local-seo',
        reportId
      },
      {
        id: 'nap-analysis',
        title: 'NAP Analysis (Name, Address, Phone)',
        scoreTextRight: Math.round(data.scores?.nap || 0),
        contentHTML: renderNAPContent(data.analysis),
        context: 'local-seo',
        reportId
      },
      {
        id: 'local-presence',
        title: 'Local Presence Signals',
        scoreTextRight: Math.round(data.scores?.presence || 0),
        contentHTML: renderLocalPresenceContent(data.analysis.localPresence),
        context: 'local-seo',
        reportId
      },
      {
        id: 'schema-analysis',
        title: 'Structured Data & Schema',
        scoreTextRight: Math.round(data.scores?.schema || 0),
        contentHTML: (window.ReportUI && window.ReportUI.pro && typeof window.ReportUI.pro.lockContent === 'function' && !isUnlocked)
          ? window.ReportUI.pro.lockContent(renderSchemaContent(data.analysis.schema), 'local-seo')
          : renderSchemaContent(data.analysis.schema),
        isPro: true,
        locked: !isUnlocked,
        context: 'local-seo',
        reportId
      },
      {
        id: 'report-recommendations',
        title: 'Report and Recommendations',
        scoreTextRight: null,
        contentHTML: (window.ReportUI && window.ReportUI.pro && typeof window.ReportUI.pro.lockContent === 'function' && !isUnlocked)
          ? window.ReportUI.pro.lockContent(renderRecommendationsContent(data.recommendations), 'local-seo')
          : renderRecommendationsContent(data.recommendations),
        isPro: true,
        locked: !isUnlocked,
        context: 'local-seo',
        reportId
      }
    );

    const reportHTML = window.ReportContainer.create({
      url: reportUrl,
      timestamp: scanStartedAt,
      mode: 'local-seo',
      title: 'Local SEO Report',
      subtitle: 'Local SEO Inspection',
      summary,
      sections,
      proBlock: true,
      proBlockOptions: {
        context: 'local-seo',
        features: ['pdf', 'csv', 'share'],
        title: 'Unlock Report',
        subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
        reportId
      }
    });

    resultsContainer.innerHTML = `<div class="report-scope">${reportHTML}</div>`;
  } else {
    // Fallback to legacy layout if ReportContainer is unavailable
    const overviewSection = document.createElement('div');
    overviewSection.className = 'section';
    overviewSection.innerHTML = createOverviewSection(data);
    resultsContainer.appendChild(overviewSection);

    if (data.quickWins && data.quickWins.length > 0) {
      const quickWinsSection = document.createElement('div');
      quickWinsSection.className = 'section';
      quickWinsSection.innerHTML = createQuickWinsSection(data.quickWins);
      resultsContainer.appendChild(quickWinsSection);
    }

    const breakdownSection = document.createElement('div');
    breakdownSection.className = 'section';
    breakdownSection.innerHTML = createScoreBreakdownCards(data.scores);
    resultsContainer.appendChild(breakdownSection);

    // Build accordions using ReportAccordion
    const accordionContainer = document.createElement('div');
    accordionContainer.className = 'accordion-container';

    const accordionHTML = [
      ReportAccordion.createSection({
        id: 'nap-analysis',
        title: 'NAP Analysis (Name, Address, Phone)',
        scoreTextRight: `${data.scores.nap}/100`,
        contentHTML: renderNAPContent(data.analysis)
      }),
      ReportAccordion.createSection({
        id: 'local-presence',
        title: 'Local Presence Signals',
        scoreTextRight: `${data.scores.presence}/100`,
        contentHTML: renderLocalPresenceContent(data.analysis.localPresence)
      }),
      ReportAccordion.createSection({
        id: 'schema-analysis',
        title: 'Structured Data & Schema',
        scoreTextRight: `${data.scores.schema}/100`,
        isPro: true,
        locked: !isUnlocked,
        context: 'local-seo',
        reportId: reportId,
        contentHTML: renderSchemaContent(data.analysis.schema)
      }),
      ReportAccordion.createSection({
        id: 'report-recommendations',
        title: 'Report and Recommendations',
        isPro: true,
        locked: !isUnlocked,
        context: 'local-seo',
        reportId: reportId,
        contentHTML: renderRecommendationsContent(data.recommendations)
      })
    ].join('');

    accordionContainer.innerHTML = accordionHTML;
    resultsContainer.appendChild(accordionContainer);

    // Initialize ReportAccordion interactions
    ReportAccordion.initInteractions();

    if (window.ProReportBlock && window.ProReportBlock.render) {
      const proSection = document.createElement('div');
      proSection.className = 'section';
      proSection.style.marginTop = '2rem';
      proSection.innerHTML = window.ProReportBlock.render({
        context: 'local-seo',
        features: ['pdf', 'csv', 'share'],
        title: 'Unlock Report',
        subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
        reportId
      });
      resultsContainer.appendChild(proSection);
    }
  }

  if (window.ReportUI && reportId) {
    window.ReportUI.setCurrentReportId(reportId);
  }

  if (window.CreditsManager && reportId) {
    const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
    if (typeof render === 'function') render(reportId);
  }
}

function createOverviewSection(data) {
  const gradeColor = getGradeColor(data.grade);
  const nap = data.analysis.nap;
  const presence = data.analysis.localPresence;
  const score = data.overallScore;
  const circumference = 2 * Math.PI * 75; // 471.24
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
  
  return `
    <div style="
      background: linear-gradient(135deg, ${gradeColor}10 0%, ${gradeColor}05 100%);
      border: 2px solid ${gradeColor};
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem 0;
      box-shadow: 0 4px 20px ${gradeColor}20;
    ">
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 2rem; align-items: center;">
        <!-- Left: SVG Score Circle -->
        <div style="text-align: center;">
          <svg width="180" height="180" viewBox="0 0 180 180">
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
              stroke="${gradeColor}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${strokeDasharray}"
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
              style="text-shadow: 0 0 18px ${gradeColor}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${score}
            </text>
          </svg>
          <div style="
            margin-top: 0.5rem;
            font-size: 1.3rem;
            font-weight: bold;
            color: ${gradeColor};
          ">${getGradeName(data.grade)}</div>
        </div>
        
        <!-- Right: Quick Stats -->
        <div>
          <h3 style="color: ${gradeColor}; margin: 0 0 1rem 0; font-size: 1.3rem;">Quick Stats</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Overall Grade</span>
              <span style="color: ${gradeColor}; font-weight: bold;">${data.grade}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Phone Numbers Found</span>
              <span style="color: ${nap.phoneCount > 0 ? '#00ff41' : '#ff4444'}; font-weight: bold;">${nap.phoneCount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Business Address</span>
              <span style="color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${nap.hasAddress ? 'Detected' : 'Not Found'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">LocalBusiness Schema</span>
              <span style="color: ${data.analysis.schema.hasLocalBusinessSchema ? '#00ff41' : '#ff4444'}; font-weight: bold;">${data.analysis.schema.hasLocalBusinessSchema ? 'Present' : 'Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: #c0c0c0;">Google Maps Embed</span>
              <span style="color: ${presence.hasGoogleMap ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${presence.hasGoogleMap ? 'Found' : 'Not Found'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
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
        <div style="margin: 0; color: #ffd700; font-size: 1.15rem; font-weight: 700;">High Impact • Low Effort</div>
      </div>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0; font-size: 0.95rem;">
        These quick fixes can boost your local search visibility fast.
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
            <!-- Icon -->
            <div style="
              width: 50px;
              height: 50px;
              background: linear-gradient(135deg, #ffd700 0%, #ffaa00 100%);
              border-radius: 10px;
              display: flex;
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
    </div>
  `;
}

function createScoreBreakdownCards(scores) {
  const categories = [
    { key: 'nap', label: 'NAP Info', description: 'Name, Address, Phone' },
    { key: 'schema', label: 'Schema', description: 'Structured Data' },
    { key: 'presence', label: 'Presence', description: 'Local Signals' }
  ];
  const circumference = 2 * Math.PI * 60; // 376.99

  return `
    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
      ${categories.map(cat => {
        const score = scores[cat.key] || 0;
        const color = getScoreColor(score);
        const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
        return `
          <div style="
            background: linear-gradient(135deg, ${color}15 0%, ${color}05 100%);
            border: 2px solid ${color}80;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          ">
            <svg width="120" height="120" viewBox="0 0 140 140" style="margin: 0 auto 0.75rem; display: block;">
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="70"
                cy="70"
                r="60"
                fill="none"
                stroke="${color}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${strokeDasharray}"
                transform="rotate(-90 70 70)"
              />
              <text
                x="70"
                y="70"
                text-anchor="middle"
                dy="0.35em"
                font-size="2.5rem"
                font-weight="bold"
                fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)"
                stroke-width="2"
                paint-order="stroke fill"
                style="text-shadow: 0 0 12px ${color};"
              >
                ${score}
              </text>
            </svg>
            <div style="color: #ffffff; font-size: 1rem; font-weight: 600;">${cat.label}</div>
            <div style="color: #808080; font-size: 0.8rem; margin-top: 0.25rem;">${cat.description}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderNAPContent(analysis) {
  const nap = analysis.nap;
  
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Contact Information Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        NAP (Name, Address, Phone) consistency is crucial for local SEO. Ensure this information matches across all platforms.
      </p>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 1.5rem;">
        <!-- Phone Numbers -->
        <div style="
          background: rgba(0, 255, 65, 0.05);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
            <span style="font-size: 1.5rem;">📞</span>
            <span style="color: #00ff41; font-weight: bold;">Phone Numbers</span>
          </div>
          <div style="font-size: 2rem; font-weight: 900; color: #ffffff; margin-bottom: 0.5rem;">${nap.phoneCount}</div>
          <div style="color: #808080; font-size: 0.85rem;">detected on page</div>
          ${nap.phones.length > 0 ? `
            <div style="margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${nap.phones.map(phone => `
                <span style="
                  background: rgba(0, 255, 65, 0.1);
                  color: #00ff41;
                  padding: 0.35rem 0.75rem;
                  border-radius: 4px;
                  font-size: 0.85rem;
                  font-family: monospace;
                ">${phone}</span>
              `).join('')}
            </div>
          ` : ''}
        </div>
        
        <!-- Address -->
        <div style="
          background: rgba(${nap.hasAddress ? '0, 255, 65' : '255, 140, 0'}, 0.05);
          border: 1px solid rgba(${nap.hasAddress ? '0, 255, 65' : '255, 140, 0'}, 0.3);
          border-radius: 8px;
          padding: 1.5rem;
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
            <span style="font-size: 1.5rem;">📍</span>
            <span style="color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; font-weight: bold;">Business Address</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 900; color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; margin-bottom: 0.5rem;">
            ${nap.hasAddress ? '✅ Detected' : '⚠️ Not Found'}
          </div>
          ${nap.zipCodes.length > 0 ? `
            <div style="margin-top: 0.5rem; color: #c0c0c0; font-size: 0.85rem;">
              ZIP Codes: ${nap.zipCodes.join(', ')}
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Email Addresses -->
      <div style="
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        padding: 1.25rem;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
          <span style="font-size: 1.2rem;">✉️</span>
          <span style="color: #c0c0c0; font-weight: bold;">Email Addresses</span>
        </div>
        ${nap.emails.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${nap.emails.map(email => `
              <span style="
                background: rgba(0, 217, 255, 0.1);
                color: #00d9ff;
                padding: 0.35rem 0.75rem;
                border-radius: 4px;
                font-size: 0.85rem;
              ">${email}</span>
            `).join('')}
          </div>
        ` : `
          <span style="color: #808080; font-size: 0.9rem;">No email addresses detected on page</span>
        `}
      </div>
    </div>
  `;
}

function renderSchemaContent(schema) {
  const items = [
    { label: 'LocalBusiness Schema', value: schema.hasLocalBusinessSchema, critical: true },
    { label: 'Organization Schema', value: schema.hasOrganizationSchema },
    { label: 'Contact Point', value: schema.hasContactPoint },
    { label: 'Geo Coordinates', value: schema.hasGeoCoordinates },
    { label: 'Opening Hours', value: schema.hasOpeningHours }
  ];

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Structured Data Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Schema markup helps search engines understand your business. LocalBusiness schema is essential for local pack results.
      </p>
      
      ${schema.businessName ? `
        <div style="
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        ">
          <span style="color: #808080; font-size: 0.85rem;">Business Name in Schema:</span>
          <div style="color: #00ff41; font-size: 1.1rem; font-weight: bold; margin-top: 0.25rem;">${schema.businessName}</div>
        </div>
      ` : ''}
      
      <div style="display: grid; gap: 0.5rem;">
        ${items.map(item => `
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background: rgba(255, 255, 255, 0.03);
            border-radius: 6px;
            border-left: 3px solid ${item.value ? '#00ff41' : (item.critical ? '#ff4444' : '#ff8c00')};
          ">
            <span style="color: #c0c0c0;">${item.label}</span>
            <span style="
              color: ${item.value ? '#00ff41' : '#ff4444'};
              font-weight: bold;
              display: flex;
              align-items: center;
              gap: 0.35rem;
            ">
              ${item.value ? '✅ Present' : '❌ Missing'}
            </span>
          </div>
        `).join('')}
      </div>
      
      ${!schema.hasLocalBusinessSchema ? `
        <div style="
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(255, 68, 68, 0.1);
          border: 1px solid rgba(255, 68, 68, 0.3);
          border-radius: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #ff4444; font-weight: bold; margin-bottom: 0.5rem;">
            <span>⚠️</span> Critical: LocalBusiness Schema Missing
          </div>
          <p style="color: #c0c0c0; margin: 0; font-size: 0.9rem;">
            Without LocalBusiness schema, Google may not fully understand your business type and location, 
            reducing your chances of appearing in local pack results.
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderLocalPresenceContent(presence) {
  const signals = [
    { icon: '🗺️', label: 'Google Maps Embed', value: presence.hasGoogleMap, impact: 'High' },
    { icon: '⏰', label: 'Hours of Operation', value: presence.hasHoursInfo, impact: 'Medium' },
    { icon: '📞', label: 'Contact Page Link', value: presence.hasContactPage, impact: 'Medium' },
    { icon: '⭐', label: 'Reviews/Testimonials', value: presence.hasReviews, impact: 'High' }
  ];

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Local Presence Signals</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        These signals help establish your local presence and build trust with potential customers.
      </p>
      
      <!-- Signal Cards -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        ${signals.map(signal => `
          <div style="
            background: rgba(${signal.value ? '0, 255, 65' : '255, 140, 0'}, 0.05);
            border: 1px solid rgba(${signal.value ? '0, 255, 65' : '255, 140, 0'}, 0.3);
            border-radius: 8px;
            padding: 1rem;
            display: flex;
            align-items: center;
            gap: 1rem;
          ">
            <span style="font-size: 1.5rem;">${signal.icon}</span>
            <div style="flex: 1;">
              <div style="color: #ffffff; font-weight: 600;">${signal.label}</div>
              <div style="color: ${signal.value ? '#00ff41' : '#ff8c00'}; font-size: 0.85rem;">
                ${signal.value ? '✅ Found' : '⚠️ Not Found'}
              </div>
            </div>
            <span style="
              background: rgba(${signal.impact === 'High' ? '255, 68, 68' : '255, 215, 0'}, 0.15);
              color: ${signal.impact === 'High' ? '#ff6b6b' : '#ffd700'};
              padding: 0.2rem 0.5rem;
              border-radius: 4px;
              font-size: 0.7rem;
              font-weight: 600;
            ">${signal.impact} Impact</span>
          </div>
        `).join('')}
      </div>
      
      <!-- Social Profiles -->
      <div style="
        background: rgba(255, 255, 255, 0.03);
        border-radius: 8px;
        padding: 1.25rem;
      ">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
          <span style="font-size: 1.2rem;">📱</span>
          <span style="color: #c0c0c0; font-weight: bold;">Social Profiles Linked</span>
          <span style="
            background: rgba(0, 217, 255, 0.15);
            color: #00d9ff;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
          ">${presence.socialProfiles.length} found</span>
        </div>
        ${presence.socialProfiles.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${presence.socialProfiles.map(profile => `
              <span style="
                background: rgba(0, 217, 255, 0.1);
                color: #00d9ff;
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.9rem;
                text-transform: capitalize;
              ">${getSocialIcon(profile)} ${profile}</span>
            `).join('')}
          </div>
        ` : `
          <p style="color: #808080; margin: 0; font-size: 0.9rem;">
            No social media profile links detected. Consider adding links to your business profiles on 
            Facebook, Instagram, LinkedIn, or Yelp to improve local trust signals.
          </p>
        `}
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  // Ensure toggle functions are available globally
  ensureLocalSeoFixFunctions();

  if (!recommendations || recommendations.length === 0) {
    return `
      <div style="margin-top: 1rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> Excellent Local SEO!
        </h3>
        <p style="color: #86efac; margin: 0;">Your site follows local SEO best practices. Keep monitoring for continued success.</p>
      </div>
    `;
  }

  // Group by priority/severity
  const high = recommendations.filter(r => r.priority === 'critical' || r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low');

  const allRecs = [...high, ...medium, ...low];

  let html = `
    <div class="local-seo-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔍</span> Local SEO Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${allRecs.length} improvements found)</span>
      </h3>
      <div class="local-seo-fixes-list">
  `;

  allRecs.forEach((rec, index) => {
    html += renderLocalSeoFixAccordion(rec, index);
  });

  html += `</div></div>`;

  return html;
}

// Ensure global functions are defined for accordion toggle and tabs
function ensureLocalSeoFixFunctions() {
  if (typeof window === 'undefined') return;

  // Toggle accordion
  if (!window.toggleLocalSeoFixAccordion) {
    window.toggleLocalSeoFixAccordion = function(accordionId) {
      const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
      const content = document.getElementById(`${accordionId}-content`);
      const icon = accordion?.querySelector('.local-seo-fix-expand-icon');

      if (!accordion || !content) return;

      const isExpanded = accordion.classList.contains('expanded');

      if (isExpanded) {
        accordion.classList.remove('expanded');
        content.style.maxHeight = '0';
        if (icon) icon.style.transform = 'rotate(0deg)';
      } else {
        accordion.classList.add('expanded');
        content.style.maxHeight = content.scrollHeight + 'px';
        if (icon) icon.style.transform = 'rotate(180deg)';
      }
    };
  }

  // Switch tabs
  if (!window.switchLocalSeoFixTab) {
    window.switchLocalSeoFixTab = function(accordionId, tabName) {
      const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
      if (!accordion) return;

      const tabs = accordion.querySelectorAll('.local-seo-fix-tab');
      const contents = accordion.querySelectorAll('.local-seo-fix-tab-content');

      tabs.forEach(tab => {
        tab.style.background = 'transparent';
        tab.style.color = '#aaa';
        tab.style.borderColor = 'rgba(255,255,255,0.1)';
        tab.classList.remove('active');
      });
      contents.forEach(content => {
        content.style.display = 'none';
        content.classList.remove('active');
      });

      const activeTab = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(tabName));
      const activeContent = document.getElementById(`${accordionId}-${tabName}`);

      if (activeTab) {
        activeTab.style.background = 'rgba(255,255,255,0.1)';
        activeTab.style.color = '#fff';
        activeTab.style.borderColor = 'rgba(255,255,255,0.2)';
        activeTab.classList.add('active');
      }
      if (activeContent) {
        activeContent.style.display = 'block';
        activeContent.classList.add('active');
      }

      // Update accordion height
      const mainContent = document.getElementById(`${accordionId}-content`);
      if (mainContent && accordion.classList.contains('expanded')) {
        setTimeout(() => {
          mainContent.style.maxHeight = mainContent.scrollHeight + 'px';
        }, 50);
      }
    };
  }

  // Copy code
  if (!window.copyLocalSeoCode) {
    window.copyLocalSeoCode = function(elementId) {
      const codeElement = document.getElementById(elementId);
      if (!codeElement) return;

      const text = codeElement.textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = codeElement.parentElement.querySelector('button');
        if (btn) {
          const originalText = btn.textContent;
          btn.textContent = '✓ Copied!';
          setTimeout(() => { btn.textContent = originalText; }, 2000);
        }
      });
    };
  }
}

function renderLocalSeoFixAccordion(rec, index) {
  const accordionId = `localseofix-${index}`;
  const severity = rec.priority === 'critical' ? 'High' : 
                   rec.priority === 'high' ? 'High' : 
                   rec.priority === 'medium' ? 'Medium' : 'Low';
  
  const severityColors = {
    High: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[severity] || severityColors.Medium;

  // Generate code snippet based on recommendation type
  const codeSnippet = getLocalSeoCodeSnippet(rec);
  const steps = getLocalSeoSteps(rec);

  return `
    <div class="local-seo-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="local-seo-fix-header" onclick="toggleLocalSeoFixAccordion('${accordionId}')" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        cursor: pointer;
        transition: background 0.2s;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.25rem;">${style.icon}</span>
          <div>
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${rec.message}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">Local SEO Optimization</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            background: ${style.color}20;
            color: ${style.color};
            border: 1px solid ${style.color}40;
          ">${severity.toUpperCase()}</span>
          <span class="local-seo-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="local-seo-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
          ${renderLocalSeoFixTabs(accordionId, rec, codeSnippet, steps)}
        </div>
      </div>
    </div>
  `;
}

function renderLocalSeoFixTabs(accordionId, rec, codeSnippet, steps) {
  return `
    <div class="local-seo-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="local-seo-fix-tab active" onclick="switchLocalSeoFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="local-seo-fix-tab" onclick="switchLocalSeoFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="local-seo-fix-tab" onclick="switchLocalSeoFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">📖 Guide</button>
    </div>

    <!-- Summary Tab -->
    <div class="local-seo-fix-tab-content active" id="${accordionId}-summary" style="display: block;">
      <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem;">
        <h5 style="margin: 0 0 0.75rem 0; color: #00ff41; font-size: 0.95rem;">What's the issue?</h5>
        <p style="margin: 0 0 1rem 0; color: #c0c0c0; font-size: 0.9rem; line-height: 1.6;">${rec.detail}</p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span style="background: rgba(0,255,65,0.1); color: #00ff41; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">Impact: ${rec.priority === 'critical' || rec.priority === 'high' ? 'High' : 'Medium'}</span>
          <span style="background: rgba(59,130,246,0.1); color: #3b82f6; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">Category: Local SEO</span>
        </div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="local-seo-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Recommended Fix -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Implementation</span>
            <button onclick="copyLocalSeoCode('${accordionId}-solution')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeLocalSeoHtml(codeSnippet)}</pre>
        </div>
      </div>
    </div>

    <!-- Guide Tab -->
    <div class="local-seo-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${steps.map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function escapeLocalSeoHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getLocalSeoCodeSnippet(rec) {
  const snippets = {
    'Add LocalBusiness schema': `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Your Business Name",
  "image": "https://example.com/logo.jpg",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "123 Main St",
    "addressLocality": "City",
    "addressRegion": "State",
    "postalCode": "12345",
    "addressCountry": "US"
  },
  "telephone": "+1-555-555-5555",
  "openingHoursSpecification": [{
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "09:00",
    "closes": "17:00"
  }]
}
</script>`,
    'Add contact email': `<!-- Add visible email address -->
<a href="mailto:contact@yourbusiness.com">
  contact@yourbusiness.com
</a>

<!-- Or in schema -->
"email": "contact@yourbusiness.com"`,
    'Add opening hours to schema': `"openingHoursSpecification": [
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    "opens": "09:00",
    "closes": "17:00"
  },
  {
    "@type": "OpeningHoursSpecification",
    "dayOfWeek": ["Saturday"],
    "opens": "10:00",
    "closes": "14:00"
  }
]`,
    'Display customer reviews': `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Your Business",
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.5",
    "reviewCount": "89"
  },
  "review": [{
    "@type": "Review",
    "author": {"@type": "Person", "name": "Customer Name"},
    "reviewRating": {"@type": "Rating", "ratingValue": "5"},
    "reviewBody": "Great service!"
  }]
}
</script>`
  };

  // Match by message
  for (const [key, snippet] of Object.entries(snippets)) {
    if (rec.message.toLowerCase().includes(key.toLowerCase())) {
      return snippet;
    }
  }

  return `<!-- Implementation for: ${rec.message} -->
<!-- Add the appropriate structured data or HTML elements -->`;
}

function getLocalSeoSteps(rec) {
  const stepsMap = {
    'Add LocalBusiness schema': [
      'Create a JSON-LD script block in your page head or body',
      'Add your business name, address, phone number, and hours',
      'Include geo-coordinates for better local search visibility',
      'Test with Google Rich Results Test tool',
      'Submit updated sitemap to Google Search Console'
    ],
    'Add contact email': [
      'Add a visible email address on your contact page',
      'Include email in your LocalBusiness schema markup',
      'Consider using a professional domain email (not Gmail/Yahoo)',
      'Add email to your Google Business Profile'
    ],
    'Add opening hours to schema': [
      'Add openingHoursSpecification to your LocalBusiness schema',
      'Include hours for each day of the week',
      'Mark special holiday hours if applicable',
      'Keep hours consistent with Google Business Profile'
    ],
    'Display customer reviews': [
      'Add aggregateRating to your schema with average rating and count',
      'Include individual review snippets if available',
      'Consider adding a reviews widget to your site',
      'Encourage customers to leave Google reviews',
      'Respond to reviews to show engagement'
    ]
  };

  for (const [key, steps] of Object.entries(stepsMap)) {
    if (rec.message.toLowerCase().includes(key.toLowerCase())) {
      return steps;
    }
  }

  return [
    'Review the current implementation on your site',
    'Apply the recommended code changes',
    'Test with Google Rich Results Test',
    'Monitor Search Console for improvements'
  ];
}

// Helper functions
function getGradeColor(grade) {
  const colors = {
    'A': '#00ff41',
    'B': '#ffd700',
    'C': '#ff8c00',
    'D': '#ff4444',
    'F': '#ff0000'
  };
  return colors[grade] || '#888888';
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

function getScoreColor(score) {
  if (score >= 80) return '#00ff41';
  if (score >= 60) return '#ffd700';
  if (score >= 40) return '#ff8c00';
  return '#ff4444';
}

function getSocialIcon(platform) {
  const icons = {
    'facebook': '📘',
    'twitter': '🐦',
    'x': '🐦',
    'instagram': '📸',
    'linkedin': '💼',
    'youtube': '📺',
    'yelp': '⭐',
    'tiktok': '🎵'
  };
  return icons[platform] || '🔗';
}
