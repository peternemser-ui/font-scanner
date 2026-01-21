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

  // Generate report ID for pro features
  const url = document.getElementById('url')?.value || '';
  const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
  const analyzerKey = window.SM_ANALYZER_KEY || 'gdpr-compliance';

  let reportId = null;
  if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
    reportId = window.ReportUI.makeReportId({
      analyzerKey,
      normalizedUrl: data.url || url,
      startedAtISO: scanStartedAt
    });
  } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
    reportId = window.ReportUI.computeReportId(data.url || url, scanStartedAt, analyzerKey);
  } else {
    reportId = data.reportId || `gdpr_${btoa(url).replace(/[^a-zA-Z0-9]/g, '').slice(0, 16)}`;
  }

  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    results.setAttribute('data-sm-report-id', reportId);
  }

  // Set screenshot URL from API response
  const screenshotUrl = data.screenshotUrl || (reportId ? `/reports/${encodeURIComponent(reportId)}/screenshot.jpg` : '');
  if (screenshotUrl) {
    document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
  }

  // Check if report is unlocked
  const isUnlocked = !!(
    reportId &&
    window.CreditsManager &&
    (
      (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
      (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
    )
  );

  // Calculate legal pages score
  const legalPagesScore = (data.compliance?.privacyPolicy?.hasLink ? 40 : 0) +
    (data.compliance?.cookiePolicy?.hasLink ? 30 : 0) +
    (data.compliance?.termsOfService?.hasLink ? 30 : 0);

  // Calculate data rights score
  const dataRightsScore = (data.compliance?.dataSubjectRights?.hasInfo ? 60 : 0) +
    (data.compliance?.dataSubjectRights?.hasDPOContact ? 40 : 0);

  // Build summary donuts (following SEO pattern - use short, consistent labels)
  const summary = [
    { label: 'Overall', score: score },
    { label: 'Consent', score: consentScore },
    { label: 'Privacy', score: privacyScore },
    { label: 'Trackers', score: trackerScore },
    { label: 'Legal', score: legalPagesScore },
    { label: 'Rights', score: dataRightsScore }
  ];

  // Build accordion sections array (following SEO pattern)
  const sections = [
    // Cookie Consent Quality Accordion
    {
      id: 'consent-quality',
      title: 'Cookie Consent Quality',
      scoreTextRight: `${Math.round(consentQuality.score)}/100`,
      contentHTML: renderConsentQualityContent(data)
    },
    // Cookie Analysis Accordion
    {
      id: 'cookie-analysis',
      title: 'Cookie Analysis',
      scoreTextRight: `${Math.round(cookieScore)}/100`,
      contentHTML: renderCookieAnalysisContent(data.compliance?.cookies)
    },
    // Tracker Analysis Accordion
    data.compliance?.trackers ? {
      id: 'tracker-analysis',
      title: 'Tracker Analysis',
      scoreTextRight: `${Math.round(trackerScore)}/100`,
      contentHTML: renderTrackerAnalysisContent(data.compliance?.trackers)
    } : null,
    // Legal Pages Accordion
    {
      id: 'legal-pages',
      title: 'Legal Pages',
      scoreTextRight: `${Math.round(legalPagesScore)}/100`,
      contentHTML: renderLegalPagesContent(data.compliance)
    },
    // Data Rights Accordion
    {
      id: 'data-rights',
      title: 'Data Subject Rights',
      scoreTextRight: `${Math.round(dataRightsScore)}/100`,
      contentHTML: renderDataRightsContent(data.compliance)
    },
    // Compliance Risks Accordion
    (data.risks && data.risks.length > 0) ? {
      id: 'risks',
      title: `Compliance Risks (${data.risks.length})`,
      contentHTML: renderRisksContent(data.risks)
    } : null,
    // Report and Recommendations Accordion (Pro) - follows SEO pattern
    (data.recommendations && data.recommendations.length > 0) ? {
      id: 'report-recommendations',
      title: 'Fix Code + Recommendations',
      isPro: true,
      locked: !isUnlocked,
      context: 'gdpr-compliance',
      reportId: reportId,
      contentHTML: isUnlocked 
        ? renderGdprProFixes(data.recommendations) 
        : getGdprRecommendationsPreview(data.recommendations)
    } : null
  ].filter(Boolean);

  // Use ReportContainer.create() for consistent rendering (like SEO)
  if (window.ReportContainer && typeof window.ReportContainer.create === 'function') {
    const reportHTML = window.ReportContainer.create({
      url: data.url || url,
      timestamp: data.timestamp || scanStartedAt,
      mode: 'gdpr-compliance',
      title: 'Privacy Compliance Analysis',
      subtitle: '',
      summary,
      sections,
      screenshots: [], // Handled by report-ui.js ensurePageScreenshotCard()
      proBlock: true,
      proBlockOptions: {
        context: 'gdpr-compliance',
        features: ['pdf', 'csv', 'share'],
        title: 'Unlock Report',
        subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
        reportId
      }
    });
    // Wrap in report-scope for proper CSS styling of accordions
    results.innerHTML = `<div class="report-scope">${reportHTML}</div>`;
  } else {
    // Fallback: manual rendering with report-scope wrapper
    let fallbackHTML = `<div class="report-header"><h1 class="report-header__title">Privacy Compliance Analysis</h1></div>`;
    sections.forEach(section => {
      if (window.ReportAccordion && window.ReportAccordion.createSection) {
        fallbackHTML += window.ReportAccordion.createSection(section);
      }
    });
    results.innerHTML = `<div class="report-scope">${fallbackHTML}</div>`;
  }

  // Initialize ReportAccordion interactions
  if (window.ReportAccordion && typeof window.ReportAccordion.initInteractions === 'function') {
    window.ReportAccordion.initInteractions();
  }

  // Update paywall UI
  if (window.ReportUI && reportId) {
    window.ReportUI.setCurrentReportId(reportId);
  }

  if (window.CreditsManager && reportId) {
    const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
    if (typeof render === 'function') render(reportId);
  }

  // If already unlocked, reveal pro content
  if (isUnlocked) {
    revealGdprProContent();
  }

  // Listen for unlock events
  if (!window.__gdprUnlockListenerAttached) {
    window.__gdprUnlockListenerAttached = true;
    window.addEventListener('reportUnlocked', (e) => {
      const unlockedId = e && e.detail ? e.detail.reportId : '';
      if (!unlockedId || unlockedId !== document.body.getAttribute('data-report-id')) return;

      // Replace the Fix Code section body with the full content
      const body = document.querySelector('[data-accordion-body="report-recommendations"]');
      if (body && window.__gdprCurrentData) {
        body.innerHTML = renderGdprProFixes(window.__gdprCurrentData.recommendations || []);
      }

      revealGdprProContent();

      if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
        window.CreditsManager.renderPaywallState(unlockedId);
      }
    });
  }

  // Store data for unlock handler
  window.__gdprCurrentData = data;
}

/**
 * Reveal pro content when unlocked
 */
function revealGdprProContent() {
  document.querySelectorAll('.report-accordion--locked').forEach(el => {
    el.classList.remove('report-accordion--locked');
  });
  document.querySelectorAll('[data-pro-locked]').forEach(el => {
    el.removeAttribute('data-pro-locked');
  });
}

/**
 * Preview content for locked recommendations (follows SEO pattern)
 */
function getGdprRecommendationsPreview(recommendations = []) {
  const critical = recommendations.filter(r => r.priority === 'critical').length;
  const high = recommendations.filter(r => r.priority === 'high').length;
  const medium = recommendations.filter(r => r.priority === 'medium').length;

  const previewItems = [];
  if (critical > 0) previewItems.push(`${critical} critical compliance issues`);
  if (high > 0) previewItems.push(`${high} high-priority fixes`);
  if (medium > 0) previewItems.push(`${medium} medium-priority improvements`);
  
  if (previewItems.length === 0) {
    previewItems.push('GDPR compliance recommendations', 'Cookie consent improvements', 'Privacy policy suggestions');
  }

  return `
    <div style="padding: 1rem;">
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        Unlock to view:
      </p>
      <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
        ${previewItems.slice(0, 3).map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `;
}

/**
 * Render GDPR Pro Fixes with accordion-style tabs (follows SEO pattern)
 */
function renderGdprProFixes(recommendations) {
  ensureGdprFixStyles();
  const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
  const sorted = [...recommendations].sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const fixCount = sorted.length;

  if (fixCount === 0) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">✓</span> Excellent Compliance!
        </h3>
        <p style="color: #86efac; margin: 0;">Your site follows GDPR best practices. Keep monitoring for continued compliance.</p>
      </div>
    `;
  }

  return `
    <div class="gdpr-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔍</span> Compliance Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixCount} improvement${fixCount !== 1 ? 's' : ''} found)</span>
      </h3>
      <div class="gdpr-fixes-list">
        ${sorted.map((rec, index) => renderGdprFixAccordion(rec, index)).join('')}
      </div>
    </div>
  `;
}

function renderGdprFixAccordion(rec, index) {
  const accordionId = `gdprfix-${rec.id || index}`;
  const severityColors = {
    critical: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    high: { bg: 'rgba(255,140,0,0.1)', border: '#ff8c00', color: '#ff8c00', icon: '🟠' },
    medium: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟡' },
    low: { bg: 'rgba(128,128,128,0.1)', border: '#808080', color: '#808080', icon: '🟢' }
  };
  const style = severityColors[rec.priority] || severityColors.medium;
  const category = rec.category || 'Privacy Compliance';

  return `
    <div class="gdpr-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="gdpr-fix-header" onclick="toggleGdprFixAccordion('${accordionId}')" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${rec.message || rec.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${category}</p>
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
          ">${rec.priority.toUpperCase()}</span>
          <span class="gdpr-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="gdpr-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
          ${renderGdprFixTabs(rec, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderGdprFixTabs(rec, accordionId) {
  return `
    <div class="gdpr-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="gdpr-fix-tab active" onclick="switchGdprFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="gdpr-fix-tab" onclick="switchGdprFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="gdpr-fix-tab" onclick="switchGdprFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 Fix Guide</button>
    </div>

    <!-- Summary Tab -->
    <div class="gdpr-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${rec.detail || rec.description || rec.message}
      </p>
      ${rec.impact ? `
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${rec.impact}</div>
      </div>
      ` : ''}
    </div>

    <!-- Code Tab -->
    <div class="gdpr-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Recommended Action -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Implementation</span>
            <button onclick="copyGdprCode('${accordionId}-action')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-action" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlGdpr(getGdprCodeSnippet(rec))}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="gdpr-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${getGdprDefaultSteps(rec).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function getGdprCodeSnippet(rec) {
  const snippets = {
    'cookie consent': `<!-- Cookie Consent Implementation -->
<script src="https://cdn.cookieconsent.io/cookieconsent.js"></script>
<script>
  CookieConsent.run({
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: { enabled: false },
      marketing: { enabled: false }
    },
    guiOptions: {
      consentModal: {
        layout: 'box',
        position: 'bottom center',
        equalWeightButtons: true // Shows Accept and Reject equally
      }
    }
  });
</script>`,
    'privacy policy': `<!-- Privacy Policy Link -->
<a href="/privacy-policy" rel="nofollow">Privacy Policy</a>

<!-- Schema.org PrivacyPolicy -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Privacy Policy",
  "url": "https://yoursite.com/privacy-policy"
}
</script>`,
    'dpo contact': `<!-- DPO Contact Information -->
<p>Data Protection Officer: dpo@yourcompany.com</p>
<p>For data requests: <a href="/data-request">Submit Request</a></p>`,
    default: rec.detail || rec.description || 'Follow the recommended implementation steps.'
  };

  const key = Object.keys(snippets).find(k => 
    (rec.message || rec.category || '').toLowerCase().includes(k)
  );
  return snippets[key] || snippets.default;
}

function getGdprDefaultSteps(rec) {
  const stepsMap = {
    'consent': [
      'Choose a GDPR-compliant consent management platform',
      'Implement with both Accept and Reject options equally visible',
      'Ensure no cookies are set before consent is given',
      'Test with browser DevTools to verify cookie behavior'
    ],
    'privacy policy': [
      'Create a comprehensive privacy policy page',
      'Include all required GDPR disclosures',
      'Add clear links in footer and consent banner',
      'Update regularly when practices change'
    ],
    'tracker': [
      'Audit all third-party scripts on your site',
      'Remove unnecessary trackers',
      'Ensure remaining trackers respect consent',
      'Document data processing in privacy policy'
    ],
    'dpo': [
      'Designate a Data Protection Officer if required',
      'Provide clear contact information',
      'Set up data subject request handling process',
      'Train staff on GDPR compliance procedures'
    ]
  };

  const key = Object.keys(stepsMap).find(k => 
    (rec.message || rec.category || '').toLowerCase().includes(k)
  );
  return stepsMap[key] || [
    'Review the current compliance gap',
    'Implement the recommended fix',
    'Test thoroughly before deployment',
    'Document changes for compliance records'
  ];
}

// Toggle accordion
function toggleGdprFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.gdpr-fix-expand-icon');

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
}

// Switch tabs
function switchGdprFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.gdpr-fix-tab');
  const contents = accordion.querySelectorAll('.gdpr-fix-tab-content');

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
  const content = document.getElementById(`${accordionId}-content`);
  if (content && accordion.classList.contains('expanded')) {
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 50);
  }
}

// Copy code
function copyGdprCode(elementId) {
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
}

function ensureGdprFixStyles() {
  if (document.getElementById('gdpr-fixes-styles')) return;
  const style = document.createElement('style');
  style.id = 'gdpr-fixes-styles';
  style.textContent = `
    .gdpr-fix-accordion.expanded .gdpr-fix-expand-icon {
      transform: rotate(180deg);
    }
    .gdpr-fix-header:hover {
      background: rgba(255,255,255,0.03);
    }
  `;
  document.head.appendChild(style);
}

function escapeHtmlGdpr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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