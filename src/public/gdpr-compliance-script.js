// GDPR Compliance Scanner Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'gdpr-compliance';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

document.getElementById('analyzeBtn').addEventListener('click', analyze);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyze();
});

// Analysis steps for the loader
const analysisSteps = [
  { label: 'Initializing scan', detail: 'Connecting to target website...' },
  { label: 'Detecting cookies', detail: 'Scanning for tracking cookies...' },
  { label: 'Finding consent banners', detail: 'Checking for cookie consent mechanisms...' },
  { label: 'Analyzing privacy policy', detail: 'Scanning for privacy policy links...' },
  { label: 'Checking third-party trackers', detail: 'Detecting analytics and tracking scripts...' },
  { label: 'Generating compliance report', detail: 'Calculating GDPR risk assessment...' }
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

  const loader = new AnalyzerLoader('loadingContainer');

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
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: var(--accent-primary); font-weight: 600;">
      GDPR compliance scan in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7);">
      This may take 30-45 seconds
    </p>
  `;

  loader.start(analysisSteps, '[GDPR COMPLIANCE SCANNER]', 40);

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

    const response = await fetch('/api/gdpr-compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, scanStartedAt })
    });

    loader.nextStep(2);
    loader.nextStep(3);

    if (!response.ok) throw new Error('Analysis failed');
    const data = await response.json();

    loader.nextStep(4);
    loader.nextStep(5);
    loader.complete();

    displayResults(data);
    results.style.display = 'block';

  } catch (error) {
    alert(`Error: ${error.message}`);
    loader.complete();
  } finally {
    btn.disabled = false;
  }
}

function getScoreColor(score) {
  if (score >= 90) return getAccentPrimaryHex();
  if (score >= 75) return '#00bcd4';
  if (score >= 50) return '#ffa500';
  return '#ff4444';
}

function getAccentPrimaryHex() {
  const computed = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-primary')
    .trim();
  if (computed) return computed;

  const isLight = document.body?.classList?.contains('white-theme');
  return isLight ? '#dd3838' : '#5bf4e7';
}

function getGrade(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

function getGradeLetter(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 50) return 'C';
  return 'F';
}

function displayResults(data) {
  const results = document.getElementById('results');
  const score = data.score || 0;
  const cookieScore = data.compliance?.cookies?.count <= 5 ? 100 : Math.max(0, 100 - (data.compliance?.cookies?.count - 5) * 5);
  const consentScore = data.compliance?.cookieConsent?.detected ? (data.compliance?.cookieConsent?.hasKnownLibrary ? 100 : 70) : 0;
  const privacyScore = data.compliance?.privacyPolicy?.hasLink ? 100 : 0;
  const trackerScore = data.compliance?.trackers?.count === 0 ? 100 : Math.max(0, 100 - data.compliance?.trackers?.count * 10);
  const consentQuality = data.consentQuality || { score: 0 };

  results.innerHTML = `
    <div class="section">
      <h2>[PRIVACY_COMPLIANCE_ANALYSIS]</h2>
      <p>>> url: ${data.url || 'N/A'}</p>
      <p>>> timestamp: ${new Date(data.timestamp).toLocaleString()}</p>
      
      <h3 style="color: var(--accent-primary); margin: 1.5rem 0 1rem 0; font-size: 1.3rem;">>> Compliance Summary</h3>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 2rem; margin: 2rem 0;">
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Overall Compliance</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
            <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(score)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(score / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
            <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(score)}, 0 0 30px rgba(0,0,0,0.6);">${score}</text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(score)}; font-weight: 600; font-size: 1.1rem;">${getGrade(score)}</div>
        </div>

        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Cookie Consent</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
            <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(consentScore)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(consentScore / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
            <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(consentScore)}, 0 0 30px rgba(0,0,0,0.6);">${consentScore}</text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${data.compliance?.cookieConsent?.detected ? 'var(--accent-primary)' : '#ff4444'}; font-weight: 600; font-size: 1.1rem;">${data.compliance?.cookieConsent?.detected ? (data.compliance?.cookieConsent?.hasKnownLibrary ? 'Compliant' : 'Partial') : 'Missing'}</div>
        </div>

        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Privacy Policy</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
            <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(privacyScore)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(privacyScore / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
            <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(privacyScore)}, 0 0 30px rgba(0,0,0,0.6);">${privacyScore}</text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${privacyScore > 0 ? 'var(--accent-primary)' : '#ff4444'}; font-weight: 600; font-size: 1.1rem;">${privacyScore > 0 ? 'Found' : 'Missing'}</div>
        </div>

        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Tracker Status</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
            <circle cx="90" cy="90" r="75" fill="none" stroke="rgba(0, 0, 0, 0.1)" stroke-width="10"/>
            <circle cx="90" cy="90" r="75" fill="none" stroke="${getScoreColor(trackerScore)}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(trackerScore / 100) * 471.24} 471.24" transform="rotate(-90 90 90)"/>
            <text x="90" y="90" text-anchor="middle" dy="0.35em" font-size="3.5rem" font-weight="bold" fill="#f9fff2" stroke="rgba(0, 0, 0, 0.65)" stroke-width="2.5" paint-order="stroke fill" style="text-shadow: 0 0 18px ${getScoreColor(trackerScore)}, 0 0 30px rgba(0,0,0,0.6);">${trackerScore}</text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${trackerScore >= 80 ? 'var(--accent-primary)' : trackerScore >= 50 ? '#ffa500' : '#ff4444'}; font-weight: 600; font-size: 1.1rem;">${data.compliance?.trackers?.count || 0} Trackers</div>
        </div>
      </div>
    </div>
    
    <!-- Accordion Sections -->
    <div id="accordionContainer"></div>
  `;
  
  const accordionContainer = document.getElementById('accordionContainer');
  
  // Cookie Consent Quality Accordion
  createAccordionSection(accordionContainer, 'consent-quality', 'Cookie Consent Quality', 
    () => renderConsentQualityContent(data), consentQuality.score);
  
  // Cookie Analysis Accordion
  createAccordionSection(accordionContainer, 'cookie-analysis', 'Cookie Analysis', 
    () => renderCookieAnalysisContent(data.compliance?.cookies), cookieScore);
  
  // Tracker Analysis Accordion
  if (data.compliance?.trackers) {
    createAccordionSection(accordionContainer, 'tracker-analysis', 'Tracker Analysis', 
      () => renderTrackerAnalysisContent(data.compliance?.trackers), trackerScore);
  }
  
  // Legal Pages Accordion
  createAccordionSection(accordionContainer, 'legal-pages', 'Legal Pages', 
    () => renderLegalPagesContent(data.compliance), 
    (data.compliance?.privacyPolicy?.hasLink ? 40 : 0) + 
    (data.compliance?.cookiePolicy?.hasLink ? 30 : 0) + 
    (data.compliance?.termsOfService?.hasLink ? 30 : 0));
  
  // Data Rights Accordion
  createAccordionSection(accordionContainer, 'data-rights', 'Data Subject Rights', 
    () => renderDataRightsContent(data.compliance), 
    (data.compliance?.dataSubjectRights?.hasInfo ? 60 : 0) + 
    (data.compliance?.dataSubjectRights?.hasDPOContact ? 40 : 0));
  
  // Compliance Risks Accordion
  if (data.risks && data.risks.length > 0) {
    createAccordionSection(accordionContainer, 'risks', `Compliance Risks (${data.risks.length})`, 
      () => renderRisksContent(data.risks), null, true);
  }
  
  // Recommendations Accordion
  if (data.recommendations && data.recommendations.length > 0) {
    createAccordionSection(accordionContainer, 'recommendations', 'Recommendations', 
      () => renderRecommendationsContent(data.recommendations));
  }

  // Pro Report Block
  if (window.ProReportBlock && window.ProReportBlock.render) {
    const proBlockHtml = window.ProReportBlock.render({
      context: 'gdpr-compliance',
      features: ['pdf', 'csv', 'share'],
      title: 'Unlock Report',
      subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
    });
    results.insertAdjacentHTML('beforeend', proBlockHtml);
  }
}

function createAccordionSection(container, id, title, contentCreator, score = null, startOpen = false) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  accordion.style.cssText = 'margin: 0.5rem 0;';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span>${title}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
      <span class="accordion-toggle">${startOpen ? '▲' : '▼'}</span>
    </span>
  `;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  
  if (startOpen) {
    content.style.cssText = 'max-height: 5000px; padding: 1rem 1.25rem; overflow: visible; border-top: 1px solid #333;';
    content.classList.add('expanded');
    header.classList.add('active');
  } else {
    content.style.cssText = 'max-height: 0; padding: 0; overflow: hidden; border-top: none; transition: max-height 0.3s ease, padding 0.3s ease;';
  }
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  
  if (startOpen) {
    contentInner.innerHTML = contentCreator();
  }
  
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

function renderConsentQualityContent(data) {
  const quality = data.consentQuality || { score: 0, factors: [] };
  const consent = data.compliance?.cookieConsent || {};
  
  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">>> Consent Implementation Quality</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(quality.score)};">${quality.score}</div>
          <div style="color: #808080; font-size: 0.85rem;">Quality Score</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(quality.score)};">${quality.grade || 'N/A'}</div>
          <div style="color: #808080; font-size: 0.85rem;">Grade</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.2rem; font-weight: bold; color: #00d9ff;">${consent.detectedLibrary || 'None'}</div>
          <div style="color: #808080; font-size: 0.85rem;">Consent Library</div>
        </div>
      </div>
      
      <h4 style="color: #c0c0c0; margin: 1rem 0 0.75rem 0;">Quality Factors</h4>
      <div style="display: grid; gap: 0.5rem;">
        ${(quality.factors || []).map(f => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; border-left: 3px solid ${f.status === 'pass' ? 'var(--accent-primary)' : f.status === 'warn' ? '#ffa500' : '#ff4444'};">
            <span style="color: #ffffff;">${f.name}</span>
            <span style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: ${f.status === 'pass' ? 'var(--accent-primary)' : f.status === 'warn' ? '#ffa500' : '#ff4444'}; font-weight: bold;">${f.points}/${f.name.includes('reject') ? 25 : f.name.includes('library') ? 15 : 20}</span>
              <span style="color: ${f.status === 'pass' ? 'var(--accent-primary)' : f.status === 'warn' ? '#ffa500' : '#ff4444'};">${f.status === 'pass' ? '✓' : f.status === 'warn' ? '~' : '✗'}</span>
            </span>
          </div>
        `).join('')}
      </div>
      
      ${!consent.hasRejectOption && consent.detected ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.3); border-radius: 8px;">
          <strong style="color: #ff4444;">Missing Reject Option</strong>
          <p style="margin: 0.5rem 0 0 0; color: #c0c0c0; font-size: 0.9rem;">GDPR requires an equally prominent "Reject" or "Decline" button. Users must be able to refuse cookies as easily as accepting them.</p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCookieAnalysisContent(cookies) {
  if (!cookies) return '<p style="color: #808080;">No cookie data available</p>';
  
  const classified = cookies.classified || {};
  const categories = [
    { key: 'necessary', label: 'Necessary', color: 'var(--accent-primary)', desc: 'Required for basic site functionality' },
    { key: 'functional', label: 'Functional', color: '#00d9ff', desc: 'Preferences and settings' },
    { key: 'analytics', label: 'Analytics', color: '#ffa500', desc: 'Usage tracking and statistics' },
    { key: 'marketing', label: 'Marketing', color: '#ff4444', desc: 'Advertising and targeting' },
    { key: 'social', label: 'Social', color: '#9933ff', desc: 'Social media integrations' },
    { key: 'unknown', label: 'Unknown', color: '#808080', desc: 'Unclassified cookies' }
  ];
  
  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">>> Cookie Classification</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        ${categories.map(cat => {
          const count = classified[cat.key]?.length || 0;
          return `
            <div style="background: linear-gradient(135deg, ${cat.color}15 0%, ${cat.color}05 100%); border: 1px solid ${cat.color}40; padding: 1rem; border-radius: 8px; text-align: center;">
              <div style="font-size: 2rem; font-weight: bold; color: ${cat.color};">${count}</div>
              <div style="color: #ffffff; font-weight: 600; font-size: 0.9rem;">${cat.label}</div>
              <div style="color: #808080; font-size: 0.75rem; margin-top: 0.25rem;">${cat.desc}</div>
            </div>
          `;
        }).join('')}
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #00d9ff;">${cookies.sessionCount || 0}</div>
          <div style="color: #808080; font-size: 0.85rem;">Session Cookies</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #ffa500;">${cookies.persistentCount || 0}</div>
          <div style="color: #808080; font-size: 0.85rem;">Persistent Cookies</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold; color: #ff4444;">${cookies.longLivedCount || 0}</div>
          <div style="color: #808080; font-size: 0.85rem;">Long-lived (>1yr)</div>
        </div>
      </div>
      
      ${cookies.longLivedCount > 0 ? `
        <div style="padding: 1rem; background: rgba(255, 140, 0, 0.1); border: 1px solid rgba(255, 140, 0, 0.3); border-radius: 8px;">
          <strong style="color: #ffa500;">Long-lived Cookies Detected</strong>
          <p style="margin: 0.5rem 0 0 0; color: #c0c0c0; font-size: 0.9rem;">GDPR recommends shorter cookie lifespans. Consider if cookies with >1 year expiration are necessary.</p>
        </div>
      ` : ''}
    </div>
  `;
}

function renderTrackerAnalysisContent(trackers) {
  if (!trackers) return '<p style="color: #808080;">No tracker data available</p>';
  
  const classified = trackers.classified || {};
  const categories = [
    { key: 'analytics', label: 'Analytics', color: '#00d9ff' },
    { key: 'advertising', label: 'Advertising', color: '#ff4444' },
    { key: 'social', label: 'Social Media', color: '#9933ff' },
    { key: 'customer', label: 'Customer Support', color: 'var(--accent-primary)' },
    { key: 'heatmap', label: 'Heatmaps/Session Recording', color: '#ffa500' }
  ];
  
  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">>> Third-Party Trackers (${trackers.count})</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        ${categories.map(cat => {
          const items = classified[cat.key] || [];
          return `
            <div style="background: rgba(0, 0, 0, 0.3); border-left: 3px solid ${cat.color}; padding: 1rem; border-radius: 4px;">
              <div style="color: ${cat.color}; font-weight: 600; margin-bottom: 0.5rem;">${cat.label}</div>
              <div style="font-size: 1.5rem; font-weight: bold; color: #ffffff;">${items.length}</div>
            </div>
          `;
        }).join('')}
      </div>
      
      ${trackers.detected && trackers.detected.length > 0 ? `
        <h4 style="color: #c0c0c0; margin: 1rem 0 0.75rem 0;">Detected Trackers</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${trackers.detected.map(t => `
            <span style="background: rgba(255, 140, 0, 0.1); border: 1px solid rgba(255, 140, 0, 0.3); padding: 0.5rem 1rem; border-radius: 4px; font-size: 0.85rem; color: #ffa500;">${t}</span>
          `).join('')}
        </div>
      ` : '<p style="color: var(--accent-primary);">No third-party trackers detected</p>'}
    </div>
  `;
}

function renderLegalPagesContent(compliance) {
  const pages = [
    { key: 'privacyPolicy', label: 'Privacy Policy', required: true },
    { key: 'cookiePolicy', label: 'Cookie Policy', required: false },
    { key: 'termsOfService', label: 'Terms of Service', required: false }
  ];
  
  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">>> Legal Page Detection</h3>
      
      <div style="display: grid; gap: 0.75rem;">
        ${pages.map(p => {
          const data = compliance?.[p.key] || {};
          const hasLink = data.hasLink;
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border-left: 3px solid ${hasLink ? 'var(--accent-primary)' : p.required ? '#ff4444' : '#ffa500'};">
              <div>
                <span style="color: #ffffff; font-weight: 600;">${p.label}</span>
                ${p.required ? '<span style="color: #ff4444; font-size: 0.75rem; margin-left: 0.5rem;">Required</span>' : ''}
              </div>
              <span style="color: ${hasLink ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${hasLink ? '✓ Found' : '✗ Missing'}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderDataRightsContent(compliance) {
  const rights = compliance?.dataSubjectRights || {};
  const international = compliance?.internationalCompliance || {};
  
  return `
    <div>
      <h3 style="color: var(--accent-primary); margin: 0 0 1rem 0; font-size: 1rem;">>> Data Subject Rights (GDPR Articles 12-23)</h3>
      
      <div style="display: grid; gap: 0.75rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border-left: 3px solid ${rights.hasInfo ? 'var(--accent-primary)' : '#ff4444'};">
          <span style="color: #ffffff;">Data Rights Information</span>
          <span style="color: ${rights.hasInfo ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${rights.hasInfo ? '✓ Found' : '✗ Missing'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border-left: 3px solid ${rights.hasDPOContact ? 'var(--accent-primary)' : '#ffa500'};">
          <span style="color: #ffffff;">DPO/Privacy Contact</span>
          <span style="color: ${rights.hasDPOContact ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${rights.hasDPOContact ? '✓ Found' : '~ Not Found'}</span>
        </div>
      </div>
      
      <h4 style="color: #c0c0c0; margin: 1rem 0 0.75rem 0;">International Compliance</h4>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; color: ${international.gdpr ? 'var(--accent-primary)' : '#ff4444'};">${international.gdpr ? '✓' : '✗'}</div>
          <div style="color: #ffffff; font-weight: 600;">GDPR (EU)</div>
        </div>
        <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; color: ${international.ccpa ? 'var(--accent-primary)' : '#808080'};">${international.ccpa ? '✓' : '—'}</div>
          <div style="color: #ffffff; font-weight: 600;">CCPA (California)</div>
        </div>
      </div>
    </div>
  `;
}

function renderRisksContent(risks) {
  const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
  const sorted = risks.sort((a, b) => priorityOrder[a.severity] - priorityOrder[b.severity]);
  
  return `
    <div>
      <h3 style="color: #ff4444; margin: 0 0 1rem 0; font-size: 1rem;">>> Compliance Risks</h3>
      
      <div style="display: grid; gap: 1rem;">
        ${sorted.map(risk => `
          <div style="padding: 1.25rem; background: ${risk.severity === 'critical' ? 'rgba(255,68,68,0.15)' : risk.severity === 'high' ? 'rgba(255,140,0,0.15)' : 'rgba(255,215,0,0.1)'}; border-left: 4px solid ${risk.severity === 'critical' ? '#ff4444' : risk.severity === 'high' ? '#ff8c00' : '#ffd700'}; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h4 style="margin: 0; color: ${risk.severity === 'critical' ? '#ff4444' : risk.severity === 'high' ? '#ff8c00' : '#ffd700'};">${risk.risk}</h4>
              <span style="background: ${risk.severity === 'critical' ? '#ff4444' : risk.severity === 'high' ? '#ff8c00' : '#ffd700'}; color: #000; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${risk.severity}</span>
            </div>
            <p style="margin: 0 0 0.5rem 0; color: #c0c0c0;">${risk.detail}</p>
            <p style="margin: 0; color: #808080; font-size: 0.85rem; font-style: italic;">Potential Fine: ${risk.fine}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
  const sorted = recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return `
    <div>
      <h3 style="color: #00d9ff; margin: 0 0 1rem 0; font-size: 1rem;">>> Recommendations</h3>
      
      <div style="display: grid; gap: 1rem;">
        ${sorted.map(rec => `
          <div style="padding: 1.25rem; background: rgba(0, 0, 0, 0.2); border-left: 4px solid ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : rec.priority === 'medium' ? '#00d9ff' : '#808080'}; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; color: #ffffff;">${rec.message}</h4>
              <span style="background: ${rec.priority === 'critical' ? '#ff4444' : rec.priority === 'high' ? '#ff8c00' : '#00d9ff'}; color: ${rec.priority === 'critical' || rec.priority === 'high' ? '#000' : '#fff'}; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase;">${rec.priority}</span>
            </div>
            ${rec.category ? `<div style="color: #00d9ff; font-size: 0.8rem; margin-bottom: 0.5rem;">${rec.category}</div>` : ''}
            <p style="margin: 0 0 0.5rem 0; color: #c0c0c0;">${rec.detail}</p>
            <p style="margin: 0; color: var(--accent-primary); font-size: 0.85rem;">Impact: ${rec.impact}</p>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderItem(label, hasIt) {
  return `
    <div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.03); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
      <span>${label}</span>
      <span style="color: ${hasIt ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${hasIt ? '' : ''}</span>
    </div>
  `;
}

function getColor(grade) {
  return { 'A': getAccentPrimaryHex(), 'B': '#ffd700', 'C': '#ff8c00', 'F': '#ff4444' }[grade] || '#888';
}