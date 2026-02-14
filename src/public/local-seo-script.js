// Local SEO Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'local-seo';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

// Translation helper - evaluates at runtime to ensure i18n is loaded
function t(key, fallback, params = {}) {
  let value = fallback;
  if (window.i18n && typeof window.i18n.t === 'function') {
    const translated = window.i18n.t(key);
    if (translated !== key) {
      value = translated;
    }
  }
  if (params && typeof value === 'string') {
    Object.keys(params).forEach(param => {
      const regex = new RegExp(`\\{\\{?${param}\\}?\\}`, 'g');
      value = value.replace(regex, params[param]);
    });
  }
  return value;
}

// Translation mapping for API strings to translation keys
function translateLocalSeoApi(englishText, type = 'title') {
  const titleMap = {
    'Add Google Maps Embed': 'reports.localSeo.api.addGoogleMaps',
    'Add LocalBusiness Schema': 'reports.localSeo.api.addSchema',
    'Display Phone Number': 'reports.localSeo.api.displayPhone',
    'Add Social Profile Links': 'reports.localSeo.api.addSocialLinks',
    'Add phone number': 'reports.localSeo.api.addPhoneNumber',
    'Add business address': 'reports.localSeo.api.addBusinessAddress'
  };
  
  const impactMap = {
    '+10% local visibility': 'reports.localSeo.api.impact.localVisibility',
    '+15% search visibility': 'reports.localSeo.api.impact.searchVisibility',
    '+20% customer inquiries': 'reports.localSeo.api.impact.customerInquiries',
    '+10% trust signals': 'reports.localSeo.api.impact.trustSignals'
  };
  
  const difficultyMap = {
    'Easy': 'reports.common.difficulty.easy',
    'Medium': 'reports.common.difficulty.medium',
    'Hard': 'reports.common.difficulty.hard'
  };
  
  const stepsMap = {
    'Go to Google Maps and search your business address': 'reports.localSeo.api.steps.goToGoogleMaps',
    'Click "Share" → "Embed a map"': 'reports.localSeo.api.steps.clickShareEmbed',
    'Copy the iframe code and paste into your contact page': 'reports.localSeo.api.steps.copyIframe',
    'Use Google\'s Structured Data Markup Helper': 'reports.localSeo.api.steps.useMarkupHelper',
    'Select "Local Business" and enter your details': 'reports.localSeo.api.steps.selectLocalBusiness',
    'Add the generated JSON-LD to your homepage': 'reports.localSeo.api.steps.addJsonLd',
    'Add phone number to your header or footer': 'reports.localSeo.api.steps.addPhoneToHeader',
    'Use tel: link for click-to-call on mobile': 'reports.localSeo.api.steps.useTelLink',
    'Format consistently across all pages': 'reports.localSeo.api.steps.formatConsistently',
    'Add links to your Google Business Profile': 'reports.localSeo.api.steps.addGbpLinks',
    'Include Facebook, Instagram, or LinkedIn': 'reports.localSeo.api.steps.includeSocial',
    'Place icons in footer for visibility': 'reports.localSeo.api.steps.placeIconsFooter'
  };

  let map;
  switch(type) {
    case 'impact': map = impactMap; break;
    case 'difficulty': map = difficultyMap; break;
    case 'step': map = stepsMap; break;
    default: map = titleMap;
  }
  
  const key = map[englishText];
  if (key) {
    return t(key, englishText);
  }
  return englishText;
}

// Function to get analysis steps with current translations
// Called at runtime to ensure i18n is loaded
function getAnalysisSteps() {
  return [
    { label: t('loader.initializingAnalysis', 'Initializing analysis'), detail: t('loader.connectingTarget', 'Connecting to target website...') },
    { label: t('loader.extractingNap', 'Extracting NAP data'), detail: t('loader.findingNap', 'Finding Name, Address, Phone information...') },
    { label: t('loader.checkingLocalSchema', 'Checking structured data'), detail: t('loader.scanningLocalBusiness', 'Scanning for LocalBusiness schema...') },
    { label: t('loader.analyzingLocalSignals', 'Analyzing local signals'), detail: t('loader.checkingMaps', 'Checking maps, social profiles, hours...') },
    { label: t('loader.generatingRecommendations', 'Generating recommendations'), detail: t('loader.compilingLocalSeo', 'Compiling local SEO insights...') }
  ];
}

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

async function analyze() {
  const url = document.getElementById('url').value.trim();
  if (!url) { 
    alert(t('reports.common.pleaseEnterUrl', 'Please enter a URL')); 
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
      ${t('reports.localSeo.analysisInProgress', 'Local SEO analysis in progress...')}
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      ${t('loader.mayTakeTime', 'This may take 30-60 seconds for complex sites')}
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
  
  loader.start(getAnalysisSteps(), '📍 ' + t('loader.analyzingLocalSeo', 'LOCAL SEO ANALYZER'), 20);
  
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

    const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch('/api/local-seo', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url, scanStartedAt }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    loader.nextStep(2);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.code === 'SCAN_QUOTA_EXCEEDED') {
        const limit = errorData.scansLimit || 10;
        loader.showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit), { isQuotaError: true });
        return;
      }
      const errorMsg = errorData.message || errorData.error || t('reports.common.analysisFailed', 'Analysis failed - please try again');
      throw new Error(errorMsg);
    }
    
    const data = await response.json();

    // Extract and set report metadata from API response
    console.log('[local-seo-script] Setting report metadata from API response');
    const apiReportId = data?.reportId || data?.results?.reportId;
    const screenshotUrl = data?.screenshotUrl || data?.results?.screenshotUrl;
    if (apiReportId) {
      document.body.setAttribute('data-report-id', apiReportId);
    }
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

    loader.nextStep(3);
    loader.nextStep(4);
    loader.complete();

    displayResults(data);
    results.style.display = 'block';
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));

  } catch (error) {
    const message = error.message || t('reports.common.unknownError', 'Unknown error occurred');
    if (message.includes('timeout') || message.includes('Timeout')) {
      alert(t('reports.common.timeoutError', 'The website took too long to respond. Please try a different site or try again later.'));
    } else {
      alert(t('reports.common.error', 'Error: {{message}}', { message }));
    }
    loader.complete();
  } finally {
    btn.disabled = false;
  }
}

function displayResults(data) {
  if (!data || typeof data !== 'object' || typeof data === 'string') { console.error('[LocalSEO] displayResults received invalid data:', data); return; }
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';

  // CRITICAL: Show results container (it starts hidden)
  resultsContainer.style.display = 'block';

  // Store results globally for PDF generation
  window.currentLocalSEOResults = data;

  const reportUrl = (data && data.url) || (document.getElementById('url')?.value || '').trim();
  const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
  const analyzerKey = window.SM_ANALYZER_KEY || 'local-seo';

  // CRITICAL: Use existing reportId from body attribute if set (from billing return)
  // Only compute a new one if not already set
  let reportId = document.body.getAttribute('data-report-id') || data.reportId || null;
  if (!reportId) {
    if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
      reportId = window.ReportUI.makeReportId({
        analyzerKey,
        normalizedUrl: reportUrl,
        startedAtISO: scanStartedAt
      });
    } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
      reportId = window.ReportUI.computeReportId(reportUrl, scanStartedAt, analyzerKey);
    }
  }
  console.log('[LocalSEO] displayResults using reportId:', reportId);

  // Check if report is unlocked (Pro subscription or purchased single report)
  // Use hasAccess() which checks both Pro subscription and purchased reports
  const isUnlocked = !!(
    // Pro/Day Pass subscribers have global access (no reportId needed)
    (window.ProReportBlock && typeof window.ProReportBlock.isProSubscriber === 'function' && window.ProReportBlock.isProSubscriber()) ||
    (reportId &&
      window.ProReportBlock &&
      typeof window.ProReportBlock.hasAccess === 'function' &&
      window.ProReportBlock.hasAccess(reportId))
  );

  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    resultsContainer.setAttribute('data-sm-report-id', reportId);
  }

  // Build screenshot URL for report display
  const screenshotUrl = data.screenshotUrl || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }
  const screenshots = screenshotUrl ? [{ src: screenshotUrl, alt: t('reports.common.screenshotOf', 'Screenshot of') + ' ' + reportUrl, device: '' }] : [];

  if (window.ReportContainer && typeof window.ReportContainer.create === 'function') {
    const summary = [
      { label: t('reports.common.overallScore', 'Overall Score'), score: Math.round(data.overallScore || 0) },
      { label: t('reports.localSeo.nap', 'NAP'), score: Math.round(data.scores?.nap || 0) },
      { label: t('reports.localSeo.schema', 'Schema'), score: Math.round(data.scores?.schema || 0) },
      { label: t('reports.localSeo.presence', 'Presence'), score: Math.round(data.scores?.presence || 0) }
    ];

    const sections = [
      {
        id: 'local-seo-overview',
        title: t('reports.localSeo.overview', 'Local SEO Overview'),
        scoreTextRight: `${Math.round(data.overallScore || 0)}/100`,
        contentHTML: createOverviewSection(data),
        context: 'local-seo',
        reportId
      }
    ];

    if (data.quickWins && data.quickWins.length > 0) {
      sections.push({
        id: 'quick-wins',
        title: t('reports.common.quickWins', 'Quick Wins'),
        scoreTextRight: t('reports.common.highImpact', 'High impact'),
        contentHTML: createQuickWinsSection(data.quickWins),
        context: 'local-seo',
        reportId
      });
    }

    sections.push(
      {
        id: 'score-breakdown',
        title: t('reports.common.scoreBreakdown', 'Score Breakdown'),
        scoreTextRight: t('reports.common.byCategory', 'By category'),
        contentHTML: createScoreBreakdownCards(data.scores),
        context: 'local-seo',
        reportId
      },
      {
        id: 'nap-analysis',
        title: t('reports.localSeo.napAnalysis', 'NAP Analysis (Name, Address, Phone)'),
        scoreTextRight: Math.round(data.scores?.nap || 0),
        contentHTML: renderNAPContent(data.analysis),
        context: 'local-seo',
        reportId
      },
      {
        id: 'local-presence',
        title: t('reports.localSeo.localPresence', 'Local Presence Signals'),
        scoreTextRight: Math.round(data.scores?.presence || 0),
        contentHTML: renderLocalPresenceContent(data.analysis.localPresence),
        context: 'local-seo',
        reportId
      },
      {
        id: 'schema-analysis',
        title: t('reports.localSeo.schemaAnalysis', 'Structured Data & Schema'),
        scoreTextRight: Math.round(data.scores?.schema || 0),
        contentHTML: renderSchemaContent(data.analysis.schema),
        isPro: true,
        locked: !isUnlocked,
        context: 'local-seo',
        reportId
      },
      {
        id: 'report-recommendations',
        title: t('reports.common.reportAndRecommendations', 'Recommendations'),
        scoreTextRight: null,
        contentHTML: renderRecommendationsContent(data.recommendations),
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
      title: t('reports.localSeo.title', 'Local SEO Report'),
      subtitle: t('reports.localSeo.subtitle', 'Local SEO Inspection'),
      summary,
      sections,
      screenshots,
      proBlock: true,
      proBlockOptions: {
        context: 'local-seo',
        features: ['pdf', 'excel', 'csv', 'share'],
        title: t('reports.common.unlockReport', 'Unlock Report'),
        subtitle: t('reports.common.unlockReportSubtitle', 'PDF export, share link, export data, and fix packs for this scan.'),
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
        title: t('reports.localSeo.napAnalysis', 'NAP Analysis (Name, Address, Phone)'),
        scoreTextRight: `${data.scores.nap}/100`,
        contentHTML: renderNAPContent(data.analysis)
      }),
      ReportAccordion.createSection({
        id: 'local-presence',
        title: t('reports.localSeo.localPresence', 'Local Presence Signals'),
        scoreTextRight: `${data.scores.presence}/100`,
        contentHTML: renderLocalPresenceContent(data.analysis.localPresence)
      }),
      ReportAccordion.createSection({
        id: 'schema-analysis',
        title: t('reports.localSeo.schemaAnalysis', 'Structured Data & Schema'),
        scoreTextRight: `${data.scores.schema}/100`,
        isPro: true,
        locked: !isUnlocked,
        context: 'local-seo',
        reportId: reportId,
        contentHTML: renderSchemaContent(data.analysis.schema)
      }),
      ReportAccordion.createSection({
        id: 'report-recommendations',
        title: t('reports.common.reportRecommendations', 'Recommendations'),
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

    // Note: ReportContainer.create() with proBlock: true already adds Export & Share block
    // Don't manually add ProReportBlock to avoid duplicate
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
          <h3 style="color: ${gradeColor}; margin: 0 0 1rem 0; font-size: 1.3rem;">${t('reports.localSeo.quickStats', 'Quick Stats')}</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">${t('reports.localSeo.overallGrade', 'Overall Grade')}</span>
              <span style="color: ${gradeColor}; font-weight: bold;">${data.grade}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">${t('reports.localSeo.phoneNumbersFound', 'Phone Numbers Found')}</span>
              <span style="color: ${nap.phoneCount > 0 ? '#00ff41' : '#ff4444'}; font-weight: bold;">${nap.phoneCount}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">${t('reports.localSeo.businessAddress', 'Business Address')}</span>
              <span style="color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${nap.hasAddress ? t('reports.common.detected', 'Detected') : t('reports.common.notFound', 'Not Found')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">${t('reports.localSeo.localBusinessSchema', 'LocalBusiness Schema')}</span>
              <span style="color: ${data.analysis.schema.hasLocalBusinessSchema ? '#00ff41' : '#ff4444'}; font-weight: bold;">${data.analysis.schema.hasLocalBusinessSchema ? t('reports.common.present', 'Present') : t('reports.common.missing', 'Missing')}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: #c0c0c0;">${t('reports.localSeo.googleMapsEmbed', 'Google Maps Embed')}</span>
              <span style="color: ${presence.hasGoogleMap ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${presence.hasGoogleMap ? t('reports.common.found', 'Found') : t('reports.common.notFound', 'Not Found')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createQuickWinsSection(quickWins) {
  // Translate quick win data from API
  const translatedWins = quickWins.map(win => ({
    ...win,
    title: translateLocalSeoApi(win.title, 'title'),
    impact: translateLocalSeoApi(win.impact, 'impact'),
    difficulty: translateLocalSeoApi(win.difficulty, 'difficulty'),
    steps: win.steps.map(step => translateLocalSeoApi(step, 'step'))
  }));

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
        <div style="margin: 0; color: #ffd700; font-size: 1.15rem; font-weight: 700;">${t('reports.common.highImpactLowEffort', 'High Impact • Low Effort')}</div>
      </div>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0; font-size: 0.95rem;">
        ${t('reports.localSeo.quickFixesDescription', 'These quick fixes can boost your local search visibility fast.')}
      </p>
      
      <div style="display: grid; gap: 1rem;">
        ${translatedWins.map((win, index) => `
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
                <div style="color: #808080; font-size: 0.75rem; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.5px;">${t('reports.common.howToFix', 'How to fix:')}</div>
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
    { key: 'nap', label: t('reports.localSeo.napInfo', 'NAP Info'), description: t('reports.localSeo.nameAddressPhone', 'Name, Address, Phone') },
    { key: 'schema', label: t('reports.localSeo.schema', 'Schema'), description: t('reports.localSeo.structuredData', 'Structured Data') },
    { key: 'presence', label: t('reports.localSeo.presence', 'Presence'), description: t('reports.localSeo.localSignals', 'Local Signals') }
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
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> ${t('reports.localSeo.contactInfoAnalysis', 'Contact Information Analysis')}</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.localSeo.napConsistencyDesc', 'NAP (Name, Address, Phone) consistency is crucial for local SEO. Ensure this information matches across all platforms.')}
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
            <span style="color: #00ff41; font-weight: bold;">${t('reports.localSeo.phoneNumbers', 'Phone Numbers')}</span>
          </div>
          <div style="font-size: 2rem; font-weight: 900; color: #ffffff; margin-bottom: 0.5rem;">${nap.phoneCount}</div>
          <div style="color: #808080; font-size: 0.85rem;">${t('reports.localSeo.detectedOnPage', 'detected on page')}</div>
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
            <span style="color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; font-weight: bold;">${t('reports.localSeo.businessAddress', 'Business Address')}</span>
          </div>
          <div style="font-size: 1.5rem; font-weight: 900; color: ${nap.hasAddress ? '#00ff41' : '#ff8c00'}; margin-bottom: 0.5rem;">
            ${nap.hasAddress ? '✅ ' + t('reports.common.detected', 'Detected') : '⚠️ ' + t('reports.common.notFound', 'Not Found')}
          </div>
          ${nap.zipCodes.length > 0 ? `
            <div style="margin-top: 0.5rem; color: #c0c0c0; font-size: 0.85rem;">
              ${t('reports.localSeo.zipCodes', 'ZIP Codes')}: ${nap.zipCodes.join(', ')}
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
          <span style="color: #c0c0c0; font-weight: bold;">${t('reports.localSeo.emailAddresses', 'Email Addresses')}</span>
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
          <span style="color: #808080; font-size: 0.9rem;">${t('reports.localSeo.noEmailsDetected', 'No email addresses detected on page')}</span>
        `}
      </div>
    </div>
  `;
}

function renderSchemaContent(schema) {
  const items = [
    { label: t('reports.localSeo.localBusinessSchema', 'LocalBusiness Schema'), value: schema.hasLocalBusinessSchema, critical: true },
    { label: t('reports.localSeo.organizationSchema', 'Organization Schema'), value: schema.hasOrganizationSchema },
    { label: t('reports.localSeo.contactPoint', 'Contact Point'), value: schema.hasContactPoint },
    { label: t('reports.localSeo.geoCoordinates', 'Geo Coordinates'), value: schema.hasGeoCoordinates },
    { label: t('reports.localSeo.openingHours', 'Opening Hours'), value: schema.hasOpeningHours }
  ];

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> ${t('reports.localSeo.structuredDataAnalysis', 'Structured Data Analysis')}</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.localSeo.schemaDescription', 'Schema markup helps search engines understand your business. LocalBusiness schema is essential for local pack results.')}
      </p>
      
      ${schema.businessName ? `
        <div style="
          background: rgba(0, 255, 65, 0.1);
          border: 1px solid rgba(0, 255, 65, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        ">
          <span style="color: #808080; font-size: 0.85rem;">${t('reports.localSeo.businessNameInSchema', 'Business Name in Schema')}:</span>
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
              ${item.value ? '✅ ' + t('reports.common.present', 'Present') : '❌ ' + t('reports.common.missing', 'Missing')}
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
            <span>⚠️</span> ${t('reports.localSeo.criticalSchemaMissing', 'Critical: LocalBusiness Schema Missing')}
          </div>
          <p style="color: #c0c0c0; margin: 0; font-size: 0.9rem;">
            ${t('reports.localSeo.schemaMissingDesc', 'Without LocalBusiness schema, Google may not fully understand your business type and location, reducing your chances of appearing in local pack results.')}
          </p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderLocalPresenceContent(presence) {
  const signals = [
    { icon: '🗺️', label: t('reports.localSeo.googleMapsEmbed', 'Google Maps Embed'), value: presence.hasGoogleMap, impact: 'High' },
    { icon: '⏰', label: t('reports.localSeo.hoursOfOperation', 'Hours of Operation'), value: presence.hasHoursInfo, impact: 'Medium' },
    { icon: '📞', label: t('reports.localSeo.contactPageLink', 'Contact Page Link'), value: presence.hasContactPage, impact: 'Medium' },
    { icon: '⭐', label: t('reports.localSeo.reviewsTestimonials', 'Reviews/Testimonials'), value: presence.hasReviews, impact: 'High' }
  ];

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> ${t('reports.localSeo.localPresenceSignals', 'Local Presence Signals')}</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        ${t('reports.localSeo.presenceSignalsDesc', 'These signals help establish your local presence and build trust with potential customers.')}
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
                ${signal.value ? '✅ ' + t('reports.common.found', 'Found') : '⚠️ ' + t('reports.common.notFound', 'Not Found')}
              </div>
            </div>
            <span style="
              background: rgba(${signal.impact === 'High' ? '255, 68, 68' : '255, 215, 0'}, 0.15);
              color: ${signal.impact === 'High' ? '#ff6b6b' : '#ffd700'};
              padding: 0.2rem 0.5rem;
              border-radius: 4px;
              font-size: 0.7rem;
              font-weight: 600;
            ">${signal.impact === 'High' ? t('reports.common.highImpact', 'High Impact') : t('reports.common.mediumImpact', 'Medium Impact')}</span>
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
          <span style="color: #c0c0c0; font-weight: bold;">${t('reports.localSeo.socialProfilesLinked', 'Social Profiles Linked')}</span>
          <span style="
            background: rgba(0, 217, 255, 0.15);
            color: #00d9ff;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
          ">${presence.socialProfiles.length} ${t('reports.common.found', 'found')}</span>
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
            ${t('reports.localSeo.noSocialProfilesDesc', 'No social media profile links detected. Consider adding links to your business profiles on Facebook, Instagram, LinkedIn, or Yelp to improve local trust signals.')}
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
          <span style="font-size: 1.5rem;">✓</span> ${t('reports.localSeo.excellentLocalSeo', 'Excellent Local SEO!')}
        </h3>
        <p style="color: #86efac; margin: 0;">${t('reports.localSeo.excellentLocalSeoDesc', 'Your site follows local SEO best practices. Keep monitoring for continued success.')}</p>
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
        <span style="font-size: 1.75rem;">🔍</span> ${t('reports.localSeo.localSeoFixes', 'Local SEO Fixes')}
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${t('reports.common.improvementsFound', '{{count}} improvements found', { count: allRecs.length })})</span>
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

      const activeTab = Array.from(tabs).find(tab => tab.getAttribute('data-tab') === tabName);
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
          btn.textContent = '✓ ' + t('common.copied', 'Copied!');
          setTimeout(() => { btn.textContent = originalText; }, 2000);
        }
      });
    };
  }

  // Event delegation for Local SEO fix accordions (CSP compliant)
  if (!window.__localSeoFixEventDelegationInitialized) {
    window.__localSeoFixEventDelegationInitialized = true;

    document.addEventListener('click', function(e) {
      // Handle accordion header clicks
      const toggleAccordion = e.target.closest('[data-action="toggle-local-seo-accordion"]');
      if (toggleAccordion) {
        const accordionId = toggleAccordion.getAttribute('data-accordion-id');
        if (accordionId) {
          e.preventDefault();
          e.stopPropagation();
          window.toggleLocalSeoFixAccordion(accordionId);
        }
        return;
      }

      // Handle tab button clicks
      const switchTab = e.target.closest('[data-action="switch-local-seo-tab"]');
      if (switchTab) {
        const accordionId = switchTab.getAttribute('data-accordion-id');
        const tabName = switchTab.getAttribute('data-tab');
        if (accordionId && tabName) {
          e.preventDefault();
          e.stopPropagation();
          window.switchLocalSeoFixTab(accordionId, tabName);
        }
        return;
      }

      // Handle copy button clicks
      const copyBtn = e.target.closest('[data-action="copy-local-seo-code"]');
      if (copyBtn) {
        const codeId = copyBtn.getAttribute('data-code-id');
        if (codeId) {
          e.preventDefault();
          e.stopPropagation();
          window.copyLocalSeoCode(codeId);
        }
        return;
      }
    });
  }
}

// Map backend fix messages to translation keys
function getLocalSeoFixKey(message) {
  const msg = message.toLowerCase();
  if (msg.includes('localbusiness') && msg.includes('schema')) return 'addLocalBusinessSchema';
  if (msg.includes('embed') && msg.includes('map')) return 'embedGoogleMaps';
  if (msg.includes('google map')) return 'embedGoogleMaps';
  if (msg.includes('opening hours') || msg.includes('hours to schema')) return 'addOpeningHours';
  if (msg.includes('social media') || msg.includes('social profile')) return 'addSocialMediaLinks';
  if (msg.includes('review') && (msg.includes('display') || msg.includes('customer') || msg.includes('show'))) return 'displayCustomerReviews';
  if (msg.includes('email') && (msg.includes('add') || msg.includes('contact'))) return 'addContactEmail';
  if (msg.includes('geo') && msg.includes('coord')) return 'addGeoCoordinates';
  if (msg.includes('contact') && msg.includes('point')) return 'addContactPoint';
  if (msg.includes('organization') && msg.includes('schema')) return 'addOrganizationSchema';
  if (msg.includes('address') && msg.includes('schema')) return 'addAddressToSchema';
  if (msg.includes('phone') && msg.includes('schema')) return 'addPhoneToSchema';
  return 'default';
}

// Get translated fix title and description
function getTranslatedFix(rec) {
  const fixKey = getLocalSeoFixKey(rec.message);
  const titleKey = `reports.localSeo.fixes.${fixKey}.title`;
  const descKey = `reports.localSeo.fixes.${fixKey}.description`;

  return {
    title: t(titleKey, rec.message),
    description: t(descKey, rec.detail || rec.message)
  };
}

function renderLocalSeoFixAccordion(rec, index) {
  const accordionId = `localseofix-${index}`;
  const severityKey = rec.priority === 'critical' ? 'high' :
                   rec.priority === 'high' ? 'high' :
                   rec.priority === 'medium' ? 'medium' : 'low';
  const severityLabel = t(`reports.common.severity.${severityKey}`, severityKey.charAt(0).toUpperCase() + severityKey.slice(1));

  const severityColors = {
    high: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[severityKey] || severityColors.medium;

  // Generate code snippet based on recommendation type
  const codeSnippet = getLocalSeoCodeSnippet(rec);
  const steps = getLocalSeoSteps(rec);

  // Get translated title and description
  const translatedFix = getTranslatedFix(rec);

  return `
    <div class="local-seo-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="local-seo-fix-header" data-action="toggle-local-seo-accordion" data-accordion-id="${accordionId}" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${translatedFix.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${t('reports.localSeo.localSeoOptimization', 'Local SEO Optimization')}</p>
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
          ">${severityLabel.toUpperCase()}</span>
          <span class="local-seo-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="local-seo-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0.5rem 1.25rem 1.25rem 1.25rem;">
          ${renderLocalSeoFixTabs(accordionId, rec, codeSnippet, steps)}
        </div>
      </div>
    </div>
  `;
}

function renderLocalSeoFixTabs(accordionId, rec, codeSnippet, steps) {
  // Get translated description for this fix
  const translatedFix = getTranslatedFix(rec);

  return `
    <div class="local-seo-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="local-seo-fix-tab active" data-action="switch-local-seo-tab" data-accordion-id="${accordionId}" data-tab="summary" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 ${t('reports.common.tabs.summary', 'Summary')}</button>
      <button class="local-seo-fix-tab" data-action="switch-local-seo-tab" data-accordion-id="${accordionId}" data-tab="code" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 ${t('reports.common.tabs.code', 'Code')}</button>
      <button class="local-seo-fix-tab" data-action="switch-local-seo-tab" data-accordion-id="${accordionId}" data-tab="guide" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">📖 ${t('reports.common.tabs.guide', 'Guide')}</button>
    </div>

    <!-- Summary Tab -->
    <div class="local-seo-fix-tab-content active" id="${accordionId}-summary" style="display: block;">
      <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem;">
        <h5 style="margin: 0 0 0.75rem 0; color: #00ff41; font-size: 0.95rem;">${t('reports.common.whatsTheIssue', "What's the issue?")}</h5>
        <p style="margin: 0 0 1rem 0; color: #c0c0c0; font-size: 0.9rem; line-height: 1.6;">${translatedFix.description}</p>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <span style="background: rgba(0,255,65,0.1); color: #00ff41; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">${t('reports.common.impact', 'Impact')}: ${rec.priority === 'critical' || rec.priority === 'high' ? t('reports.common.high', 'High') : t('reports.common.medium', 'Medium')}</span>
          <span style="background: rgba(59,130,246,0.1); color: #3b82f6; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">${t('reports.common.category', 'Category')}: ${t('reports.localSeo.localSeo', 'Local SEO')}</span>
        </div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="local-seo-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Recommended Fix -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ ${t('reports.common.recommendedImplementation', 'Recommended Implementation')}</span>
            <button data-action="copy-local-seo-code" data-code-id="${accordionId}-solution" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 ${t('reports.common.copy', 'Copy')}</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeLocalSeoHtml(codeSnippet)}</pre>
        </div>
      </div>
    </div>

    <!-- Guide Tab -->
    <div class="local-seo-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">${t('reports.common.stepByStepFix', 'Step-by-Step Fix')}:</h5>
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
  // Use the same fix key mapping as getLocalSeoFixKey
  const fixType = getLocalSeoFixKey(rec.message);

  // Get translated steps - try up to 5 steps
  const steps = [];
  for (let i = 1; i <= 5; i++) {
    const step = t(`reports.localSeo.fixSteps.${fixType}.step${i}`, null);
    if (step) {
      steps.push(step);
    }
  }

  // Fallback to default if no translations found
  if (steps.length === 0) {
    return [
      t('reports.localSeo.fixSteps.default.step1', 'Review the current implementation on your site'),
      t('reports.localSeo.fixSteps.default.step2', 'Apply the recommended code changes'),
      t('reports.localSeo.fixSteps.default.step3', 'Test with Google Rich Results Test'),
      t('reports.localSeo.fixSteps.default.step4', 'Monitor Search Console for improvements')
    ];
  }

  return steps;
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
    'A': t('reports.common.grades.excellent', 'Excellent'),
    'B': t('reports.common.grades.good', 'Good'),
    'C': t('reports.common.grades.fair', 'Fair'),
    'D': t('reports.common.grades.poor', 'Poor'),
    'F': t('reports.common.grades.critical', 'Critical')
  };
  return names[grade] || t('reports.common.grades.unknown', 'Unknown');
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

// ============================================================
// Expose display function globally for billing return handler
// ============================================================
window.displayResults = displayResults;
window.displayLocalSEOResults = displayResults;

// ============================================================
// Billing Return Handling
// ============================================================
(async function initFromUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const reportId = params.get('report_id') || '';
  const autoUrl = params.get('url') || '';
  const billingSuccess = params.get('billing_success') === 'true';

  // If we have a report_id, set it immediately so hasAccess checks work
  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    console.log('[LocalSEO] Set report ID from URL:', reportId);
  }

  // Pre-fill URL if provided
  if (autoUrl) {
    const urlInput = document.getElementById('url');
    if (urlInput) urlInput.value = autoUrl;
  }

  // If returning from billing, wait for billing return processing to complete
  if (billingSuccess && !window.__smBillingReturnComplete) {
    console.log('[LocalSEO] Waiting for billing return processing...');
    await new Promise((resolve) => {
      if (window.__smBillingReturnComplete) {
        resolve();
        return;
      }
      const handler = () => {
        window.removeEventListener('sm:billingReturnComplete', handler);
        resolve();
      };
      window.addEventListener('sm:billingReturnComplete', handler);
      setTimeout(() => {
        window.removeEventListener('sm:billingReturnComplete', handler);
        resolve();
      }, 5000);
    });
    console.log('[LocalSEO] Billing return processing complete');
    return; // Results will be restored by report-ui.js
  }

  // If we have a report_id, try to load the stored report
  if (reportId && window.ReportStorage) {
    console.log('[LocalSEO] Checking for stored report:', reportId);

    // Fetch billing status BEFORE displaying the report
    if (window.ProReportBlock?.fetchBillingStatus) {
      console.log('[LocalSEO] Fetching billing status...');
      await window.ProReportBlock.fetchBillingStatus(true);
    }

    const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayResults);
    if (loaded) {
      console.log('[LocalSEO] Loaded stored report successfully');
      return;
    }
  }
})();

// Listen for restore scan results event (after payment return)
window.addEventListener('sm:restoreScanResults', (e) => {
  const { results: restoredResults, url, analyzer } = e.detail || {};
  if (restoredResults && (analyzer?.includes('local-seo') || analyzer?.includes('local_seo'))) {
    console.log('[LocalSEO] Restoring scan results after payment');
    const urlInput = document.getElementById('url');
    if (url && urlInput) urlInput.value = url;
    displayResults(restoredResults);
  }
});
