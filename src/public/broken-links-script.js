// Broken Links Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'broken-links';
document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);

document.getElementById('analyzeBtn').addEventListener('click', analyzeLinks);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeLinks();
});

// Analysis steps for the loader
const analysisSteps = [
  { label: 'Initializing crawler', detail: 'Starting website crawl...' },
  { label: 'Discovering pages', detail: 'Finding internal links...' },
  { label: 'Checking link status', detail: 'Testing each link for errors...' },
  { label: 'Analyzing redirects', detail: 'Tracing redirect chains...' },
  { label: 'Testing external links', detail: 'Validating external resources...' },
  { label: 'Generating report', detail: 'Compiling link health analysis...' }
];

async function analyzeLinks() {
  const url = document.getElementById('url').value.trim();
  const maxPages = parseInt(document.getElementById('maxPages').value);
  const maxDepth = parseInt(document.getElementById('maxDepth').value);
  const followExternal = document.getElementById('followExternal').checked;
  
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
      Link analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      This may take 30-90 seconds depending on site size
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
  
  loader.start(analysisSteps, '[BROKEN LINK CHECKER]', 60);
  
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
    
    const response = await fetch('/api/broken-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, maxPages, maxDepth, followExternal, scanStartedAt })
    });
    
    loader.nextStep(2);
    loader.nextStep(3);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }
    
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

function displayResults(data) {
  const resultsContainer = document.getElementById('results');
  resultsContainer.innerHTML = '';
  
  // Store results globally
  window.currentBrokenLinksResults = data;

  // Wrap in report-scope for proper CSS styling of accordions
  const reportScope = document.createElement('div');
  reportScope.className = 'report-scope';
  resultsContainer.appendChild(reportScope);

  // 1. Overview Section with Score Circle
  const overviewSection = document.createElement('div');
  overviewSection.className = 'section';
  overviewSection.innerHTML = createOverviewSection(data);
  reportScope.appendChild(overviewSection);
  
  // 1.5. Show warning if no links found (site blocking or JS rendering issue)
  if (data.totalLinks === 0 || data.summary.broken + data.summary.redirects + data.summary.working + data.summary.external === 0) {
    const warningSection = document.createElement('div');
    warningSection.className = 'section';
    warningSection.innerHTML = `
      <div style="
        background: linear-gradient(135deg, rgba(255,140,0,0.15), rgba(255,68,68,0.1));
        border: 2px solid rgba(255,140,0,0.6);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
      ">
        <h3 style="color: #ff8c00; margin: 0 0 0.75rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
          ⚠️ No Links Discovered
        </h3>
        <p style="color: #c0c0c0; margin: 0 0 0.75rem 0; line-height: 1.6;">
          The crawler was unable to find any links on <strong>${data.url}</strong>. This usually indicates one of the following:
        </p>
        <ul style="color: #c0c0c0; margin: 0 0 1rem 1rem; line-height: 1.8;">
          <li><strong>Bot Detection:</strong> The site is blocking automated crawlers (common with CloudFlare, Akamai, etc.)</li>
          <li><strong>JavaScript Rendering:</strong> Links are generated dynamically by JavaScript that requires a browser</li>
          <li><strong>Access Restrictions:</strong> The site returned a 403 Forbidden or similar error</li>
          <li><strong>Unusual Navigation:</strong> The site uses custom navigation (data-href, onclick handlers, etc.)</li>
        </ul>
        <p style="color: #808080; margin: 0; font-size: 0.85rem; font-style: italic;">
          Try running the scan again, or contact support if this issue persists. Some enterprise sites cannot be crawled externally.
        </p>
      </div>
    `;
    reportScope.appendChild(warningSection);
  }

  // 2. Summary Cards
  const summarySection = document.createElement('div');
  summarySection.className = 'section';
  summarySection.innerHTML = createSummaryCards(data.summary);
  reportScope.appendChild(summarySection);

  // 3. Accordion Sections using ReportAccordion
  const accordionContainer = document.createElement('div');
  accordionContainer.className = 'accordion-container';

  let accordionHTML = '';

  if (data.links.broken && data.links.broken.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'broken-links',
      title: `Broken Links (${data.links.broken.length})`,
      contentHTML: renderBrokenLinksContent(data.links.broken)
    });
  }

  if (data.links.redirects && data.links.redirects.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'redirects',
      title: `Redirects (${data.links.redirects.length})`,
      contentHTML: renderRedirectsContent(data.links.redirects, data.redirectAnalysis)
    });
  }

  if (data.links.working && data.links.working.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'working-links',
      title: `Working Links (${data.summary.working} total)`,
      contentHTML: renderWorkingLinksContent(data.links.working, data.summary.working)
    });
  }

  if (data.links.external && data.links.external.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'external-links',
      title: `External Links (${data.summary.external} total)`,
      contentHTML: renderExternalLinksContent(data.links.external, data.summary.external)
    });
  }

  // Anchor Text Analysis - only show if there's actual anchor data
  if (data.anchorAnalysis && data.anchorAnalysis.totalAnchors > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'anchor-analysis',
      title: 'Anchor Text Analysis',
      contentHTML: renderAnchorAnalysisContent(data.anchorAnalysis)
    });
  }

  // Link Attributes Audit - only show if there are external links to audit
  if (data.attributeAnalysis && (data.attributeAnalysis.secureExternalLinks > 0 || data.attributeAnalysis.insecureExternalLinks > 0 || data.attributeAnalysis.nofollowCount > 0)) {
    accordionHTML += ReportAccordion.createSection({
      id: 'attribute-analysis',
      title: 'Link Attributes Audit',
      contentHTML: renderAttributeAnalysisContent(data.attributeAnalysis)
    });
  }

  // Redirect Chain Analysis
  if (data.redirectAnalysis && data.redirectAnalysis.total > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'redirect-analysis',
      title: 'Redirect Chain Analysis',
      contentHTML: renderRedirectAnalysisContent(data.redirectAnalysis)
    });
  }

  // Report and Recommendations (PRO)
  if (data.recommendations && data.recommendations.length > 0) {
    accordionHTML += ReportAccordion.createSection({
      id: 'report-recommendations',
      title: `Report and Recommendations (${data.recommendations.length})`,
      isPro: true,
      locked: !window.ProAccess?.hasProAccess?.(),
      context: 'broken-links',
      contentHTML: renderRecommendationsAndExportContent(data)
    });
  }

  accordionContainer.innerHTML = accordionHTML;
  reportScope.appendChild(accordionContainer);

  // Initialize ReportAccordion interactions
  ReportAccordion.initInteractions();

  // 9. Pro Report Block
  if (window.ProReportBlock && window.ProReportBlock.render) {
    // Compute and set report ID for monetization
    const reportUrl = data.url || document.getElementById('url').value.trim();
    const scanStartedAt = window.SM_SCAN_STARTED_AT || document.body.getAttribute('data-sm-scan-started-at');
    const analyzerKey = window.SM_ANALYZER_KEY;
    
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
    
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
    }
    
    const proSection = document.createElement('div');
    proSection.className = 'section';
    proSection.style.marginTop = '2rem';
    proSection.innerHTML = window.ProReportBlock.render({
      context: 'broken-links',
      features: ['pdf', 'excel', 'csv', 'share'],
      title: 'Unlock Report',
      subtitle: 'PDF export, Excel spreadsheet, share link, and export data for this scan.',
      reportId: reportId
    });
    reportScope.appendChild(proSection);
    
    // Refresh paywall state to show correct buttons
    if (window.CreditsManager && typeof window.CreditsManager.renderPaywallState === 'function') {
      window.CreditsManager.renderPaywallState();
    }
  }
}

function createOverviewSection(data) {
  const gradeColor = getGradeColor(data.grade);
  const s = data.summary;
  const score = data.score;
  const circumference = 2 * Math.PI * 75;
  const strokeDasharray = `${(score / 100) * circumference} ${circumference}`;
  
  // Check if scan failed to find links
  const noLinksFound = data.totalLinks === 0 || (s.broken === 0 && s.redirects === 0 && s.working === 0 && s.external === 0);
  
  return `
    <h2>Broken Link Analysis</h2>
    <p>>> url: ${data.url || 'N/A'}</p>
    <p>>> timestamp: ${new Date().toLocaleString()}</p>
    
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
          <h3 style="color: ${gradeColor}; margin: 0 0 1rem 0; font-size: 1.3rem;">>> Link Health Summary</h3>
          <div style="display: grid; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Pages Scanned</span>
              <span style="color: #00d9ff; font-weight: bold;">${data.pagesScanned}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Total Links Found</span>
              <span style="color: #00d9ff; font-weight: bold;">${data.totalLinks}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Broken Links</span>
              <span style="color: ${s.broken > 0 ? '#ff4444' : getAccentPrimaryHex()}; font-weight: bold;">${s.broken}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #333;">
              <span style="color: #c0c0c0;">Redirects</span>
              <span style="color: ${s.redirects > 5 ? '#ff8c00' : '#ffd700'}; font-weight: bold;">${s.redirects}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding: 0.5rem 0;">
              <span style="color: #c0c0c0;">Analysis Time</span>
              <span style="color: #808080; font-weight: bold;">${data.analysisTime}s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function createSummaryCards(summary) {
  const accent = getAccentPrimaryHex();
  const cards = [
    { key: 'broken', label: 'Broken', color: summary.broken > 0 ? '#ff4444' : accent, desc: 'Dead links' },
    { key: 'redirects', label: 'Redirects', color: summary.redirects > 5 ? '#ff8c00' : '#ffd700', desc: '301/302 chains' },
    { key: 'working', label: 'Working', color: accent, desc: 'Healthy links' },
    { key: 'external', label: 'External', color: '#00d9ff', desc: 'Outbound links' }
  ];

  return `
    <h3 style="color: ${accent}; margin: 0 0 1.5rem 0; font-size: 1.3rem;">>> Link Status Breakdown</h3>
    <p style="color: #c0c0c0; margin-bottom: 1rem;">Overview of all links found on the site by category</p>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;">
      ${cards.map(cat => {
        const count = summary[cat.key] || 0;
        const circumference = 2 * Math.PI * 55;
        // For visual purposes, show fill based on relative count (max 100 for full circle)
        const fillPercent = Math.min(count, 100) / 100;
        const strokeDasharray = `${fillPercent * circumference} ${circumference}`;
        return `
          <div style="
            background: linear-gradient(135deg, ${cat.color}15 0%, ${cat.color}05 100%);
            border: 2px solid ${cat.color}80;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          ">
            <svg width="100" height="100" viewBox="0 0 120 120" style="margin: 0 auto 0.75rem; display: block;">
              <circle
                cx="60"
                cy="60"
                r="55"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="60"
                cy="60"
                r="55"
                fill="none"
                stroke="${cat.color}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${strokeDasharray}"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="60"
                text-anchor="middle"
                dy="0.35em"
                font-size="2rem"
                font-weight="bold"
                fill="#f9fff2"
                stroke="rgba(0, 0, 0, 0.65)"
                stroke-width="1.5"
                paint-order="stroke fill"
                style="text-shadow: 0 0 10px ${cat.color};"
              >
                ${count}
              </text>
            </svg>
            <div style="color: #ffffff; font-size: 1rem; font-weight: 600;">${cat.label}</div>
            <div style="color: #808080; font-size: 0.8rem; margin-top: 0.25rem;">${cat.desc}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// Reusable export button helper
function renderExportButton(functionName, color, isUnlocked) {
  return `
    <button onclick="${functionName}()" style="
      background: ${isUnlocked ? `rgba(${hexToRgb(color)}, 0.15)` : 'rgba(128,128,128,0.15)'};
      color: ${isUnlocked ? color : '#888'};
      border: 1px solid ${isUnlocked ? `rgba(${hexToRgb(color)}, 0.4)` : 'rgba(128,128,128,0.4)'};
      padding: 0.4rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      transition: all 0.2s;
    " title="${isUnlocked ? 'Export to Excel' : 'PRO feature - Unlock to export'}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
      </svg>
      Export ${isUnlocked ? '' : '<span style="font-size: 0.65rem; background: rgba(255,215,0,0.2); color: #ffd700; padding: 0.1rem 0.3rem; border-radius: 3px; margin-left: 0.25rem;">PRO</span>'}
    </button>
  `;
}

// Helper to convert hex to RGB for rgba()
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '128, 128, 128';
}

function renderBrokenLinksContent(broken) {
  const headers = [
    { label: 'Broken URL', align: 'left' },
    { label: 'Status', align: 'center' },
    { label: 'Found On', align: 'center' },
    { label: 'Link Text', align: 'left' }
  ];

  const renderRow = (link) => `
    <tr style="border-bottom: 1px solid #222;">
      <td style="padding: 0.75rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <a href="${link.url}" target="_blank" rel="noopener" style="color: #ff6b6b;">${truncateUrl(link.url)}</a>
      </td>
      <td style="padding: 0.75rem; text-align: center;">
        <span style="background: rgba(255,68,68,0.2); color: #ff6b6b; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600;">
          ${link.statusCode || 'ERR'}
        </span>
      </td>
      <td style="padding: 0.75rem; text-align: center; color: #808080;">${link.foundOn.length} page(s)</td>
      <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c0c0c0;">
        ${link.text || '—'}
      </td>
    </tr>
  `;

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #ff4444; margin: 0; font-size: 1rem;">>> Critical: Fix These Links</h3>
        ${renderExportButton('exportBrokenLinksToExcel', '#E74C3C', isUnlocked)}
      </div>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Broken links hurt SEO and user experience. These need immediate attention.
      </p>
      ${renderPaginatedTable(broken, 'broken-links', renderRow, headers)}
    </div>
  `;
}

function renderRedirectsContent(redirects, redirectAnalysis) {
  const headers = [
    { label: 'Original URL', align: 'left' },
    { label: 'Type', align: 'center' },
    { label: 'Chain', align: 'center' },
    { label: 'Final Destination', align: 'left' }
  ];

  const renderRow = (link) => {
    const chainLength = (link.redirectChain || []).length;
    const typeColor = link.redirectType === 'permanent' || link.redirectType === 'permanent-308' ? '#00ff41' : '#ff8c00';
    const typeLabel = link.redirectType === 'permanent' ? '301' :
                     link.redirectType === 'temporary' ? '302' :
                     link.redirectType === 'temporary-307' ? '307' :
                     link.redirectType === 'permanent-308' ? '308' : link.statusCode;
    return `
      <tr style="border-bottom: 1px solid #222;">
        <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          <a href="${link.url}" target="_blank" rel="noopener" style="color: #F5B041;">${truncateUrl(link.url)}</a>
        </td>
        <td style="padding: 0.75rem; text-align: center;">
          <span style="background: ${typeColor}20; color: ${typeColor}; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">
            ${typeLabel}
          </span>
        </td>
        <td style="padding: 0.75rem; text-align: center;">
          <span style="color: ${chainLength > 2 ? '#E74C3C' : '#58D68D'}; font-weight: 600;">
            ${chainLength} hop${chainLength !== 1 ? 's' : ''}
          </span>
          ${link.redirectLoop ? '<span style="color: #E74C3C; margin-left: 0.5rem;">⚠️ LOOP</span>' : ''}
        </td>
        <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: ${link.redirectEndsInError ? '#E74C3C' : '#58D68D'};">
            link.redirectEndsInError ? '❌ Error' :
            link.redirectChain && link.redirectChain.length > 0 ? truncateUrl(link.redirectChain[link.redirectChain.length - 1]?.url || link.redirectChain[0]) : '—'}
        </td>
      </tr>
    `;
  };

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #F5B041; margin: 0; font-size: 1rem;">>> Redirect Chains</h3>
        ${renderExportButton('exportRedirectsToExcel', '#F5B041', isUnlocked)}
      </div>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Update these links to point directly to their final destination to improve page speed.
      </p>
      ${renderPaginatedTable(redirects, 'redirects', renderRow, headers)}
    </div>
  `;
}

function renderWorkingLinksContent(working, total) {
  const headers = [
    { label: 'URL', align: 'left' },
    { label: 'Link Text', align: 'left' },
    { label: 'Found On', align: 'center' }
  ];

  const renderRow = (link) => `
    <tr style="border-bottom: 1px solid #222;">
      <td style="padding: 0.75rem; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <a href="${link.url}" target="_blank" rel="noopener" style="color: #5DADE2;">${truncateUrl(link.url)}</a>
      </td>
      <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c0c0c0;">
        ${link.text || '—'}
      </td>
      <td style="padding: 0.75rem; text-align: center; color: #808080;">${link.foundOn ? link.foundOn.length : 1}</td>
    </tr>
  `;

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #5DADE2; margin: 0; font-size: 1rem;">>> Healthy Internal Links</h3>
        ${renderExportButton('exportWorkingLinksToExcel', '#5DADE2', isUnlocked)}
      </div>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        All these links are working correctly. Showing ${working.length} of ${total} total.
      </p>
      ${renderPaginatedTable(working, 'working-links', renderRow, headers)}
    </div>
  `;
}

function renderExternalLinksContent(external, total) {
  const headers = [
    { label: 'External URL', align: 'left' },
    { label: 'Link Text', align: 'left' },
    { label: 'Status', align: 'center' },
    { label: 'Found On', align: 'center' }
  ];

  const renderRow = (link) => `
    <tr style="border-bottom: 1px solid #222;">
      <td style="padding: 0.75rem; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" style="color: #7FB3D5;">${truncateUrl(link.url)}</a>
      </td>
      <td style="padding: 0.75rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #c0c0c0;">
        ${link.text || '—'}
      </td>
      <td style="padding: 0.75rem; text-align: center;">
        <span style="background: rgba(93,173,226,0.2); color: #5DADE2; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600; font-size: 0.8rem;">
          ${link.statusCode || 'OK'}
        </span>
      </td>
      <td style="padding: 0.75rem; text-align: center; color: #808080;">${link.foundOn ? link.foundOn.length : 1}</td>
    </tr>
  `;

  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;

  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #7FB3D5; margin: 0; font-size: 1rem;">>> External Outbound Links</h3>
        ${renderExportButton('exportExternalLinksToExcel', '#7FB3D5', isUnlocked)}
      </div>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Links pointing to other domains. Showing ${external.length} of ${total} total.
      </p>
      ${renderPaginatedTable(external, 'external-links', renderRow, headers)}
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  // Ensure global fix functions are available
  ensureBrokenLinksFixFunctions();

  const grouped = {
    critical: recommendations.filter(r => r.priority === 'critical'),
    high: recommendations.filter(r => r.priority === 'high'),
    medium: recommendations.filter(r => r.priority === 'medium'),
    success: recommendations.filter(r => r.priority === 'success')
  };

  // Combine all fixes for accordion rendering
  const allFixes = [
    ...grouped.critical.map(r => ({ ...r, severity: 'High' })),
    ...grouped.high.map(r => ({ ...r, severity: 'High' })),
    ...grouped.medium.map(r => ({ ...r, severity: 'Medium' })),
    ...grouped.success.map(r => ({ ...r, severity: 'Low' }))
  ];

  if (allFixes.length === 0) {
    return `
      <div style="text-align: center; padding: 2rem;">
        <span style="font-size: 3rem;">✅</span>
        <h3 style="color: #00ff41; margin: 1rem 0 0.5rem;">All Clear!</h3>
        <p style="color: #808080;">No link issues detected. Your site's link health is excellent.</p>
      </div>
    `;
  }

  return `
    <div class="broken-links-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔗</span> Link Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${allFixes.length} recommendations)</span>
      </h3>
      <div class="broken-links-fixes-list">
        ${allFixes.map((fix, index) => renderBrokenLinksFixAccordion(fix, index)).join('')}
      </div>
    </div>
  `;
}

function renderBrokenLinksFixAccordion(fix, index) {
  const accordionId = `blfix-${fix.category?.replace(/\s+/g, '-').toLowerCase() || index}`;
  const severityColors = {
    High: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    Medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    Low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[fix.severity] || severityColors.Medium;

  return `
    <div class="broken-links-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="broken-links-fix-header" onclick="toggleBrokenLinksFixAccordion('${accordionId}')" style="
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
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${escapeBrokenLinksHtml(fix.message)}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${escapeBrokenLinksHtml(fix.category || 'Link Issue')}</p>
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
          ">${fix.severity.toUpperCase()}</span>
          <span class="broken-links-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="broken-links-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
          ${renderBrokenLinksFixTabs(fix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderBrokenLinksFixTabs(fix, accordionId) {
  return `
    <div class="broken-links-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="broken-links-fix-tab active" onclick="switchBrokenLinksFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="broken-links-fix-tab" onclick="switchBrokenLinksFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="broken-links-fix-tab" onclick="switchBrokenLinksFixTab('${accordionId}', 'guide')" style="
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
    <div class="broken-links-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${escapeBrokenLinksHtml(fix.detail)}
      </p>
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${escapeBrokenLinksHtml(fix.impact)}</div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="broken-links-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Current Issue -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,68,68,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(255,68,68,0.1); border-bottom: 1px solid rgba(255,68,68,0.2);">
            <span style="color: #ff6666; font-weight: 600; font-size: 0.85rem;">❌ Current Issue</span>
            <button onclick="copyBrokenLinksCode('${accordionId}-problem')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-problem" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${getBrokenLinksCodeSnippet(fix, 'problem')}</pre>
        </div>

        <!-- Fixed Code -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Fix</span>
            <button onclick="copyBrokenLinksCode('${accordionId}-solution')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-solution" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${getBrokenLinksCodeSnippet(fix, 'solution')}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="broken-links-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${getBrokenLinksSteps(fix).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function escapeBrokenLinksHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getBrokenLinksCodeSnippet(fix, type) {
  const category = fix.category || '';
  
  const snippets = {
    'Broken Links': {
      problem: `<!-- Broken link found -->
<a href="https://example.com/old-page">Read more</a>
<!-- Returns 404 - Page not found -->`,
      solution: `<!-- Option 1: Update to correct URL -->
<a href="https://example.com/new-page">Read more</a>

<!-- Option 2: Remove if no replacement exists -->
<span>Content no longer available</span>

<!-- Option 3: Create a redirect (in .htaccess) -->
Redirect 301 /old-page /new-page`
    },
    'Redirect Chains': {
      problem: `<!-- Redirect chain detected -->
Page A → Page B → Page C → Final Page
<!-- 3+ hops waste crawl budget and slow loading -->`,
      solution: `<!-- Update link to point directly to final destination -->
<a href="https://example.com/final-page">Link</a>

<!-- Or fix server-side redirects (.htaccess) -->
Redirect 301 /page-a /final-page
Redirect 301 /page-b /final-page
Redirect 301 /page-c /final-page`
    },
    'Redirect Loops': {
      problem: `<!-- Redirect loop detected -->
Page A → Page B → Page A (infinite loop!)
<!-- Browser will fail to load the page -->`,
      solution: `<!-- Review and fix redirect rules -->
# Check .htaccess or server config for conflicting rules

# Correct configuration:
Redirect 301 /old-page /new-page
# Ensure /new-page does NOT redirect back to /old-page`
    },
    'Temporary Redirects': {
      problem: `<!-- Using temporary redirect (302) -->
HTTP/1.1 302 Found
Location: /new-page

<!-- 302/307 don't pass full link equity -->`,
      solution: `<!-- Use permanent redirect (301) instead -->
HTTP/1.1 301 Moved Permanently
Location: /new-page

# In .htaccess:
Redirect 301 /old-page /new-page

# In nginx:
rewrite ^/old-page$ /new-page permanent;`
    },
    'Link Security': {
      problem: `<!-- Insecure external link -->
<a href="https://external-site.com" target="_blank">
  External Link
</a>
<!-- Missing rel attributes - vulnerable to tabnabbing -->`,
      solution: `<!-- Add security attributes -->
<a href="https://external-site.com" 
   target="_blank" 
   rel="noopener noreferrer">
  External Link
</a>

<!-- noopener: prevents window.opener access -->
<!-- noreferrer: hides referrer info + includes noopener -->`
    },
    'Anchor Text': {
      problem: `<!-- Generic anchor text -->
<a href="/pricing">Click here</a>
<a href="/blog/seo-tips">Read more</a>
<a href="/contact">Learn more</a>

<!-- These provide no SEO value -->`,
      solution: `<!-- Use descriptive anchor text -->
<a href="/pricing">View pricing plans</a>
<a href="/blog/seo-tips">10 SEO Tips for Beginners</a>
<a href="/contact">Contact our support team</a>

<!-- Anchor text should describe the destination -->`
    },
    'Accessibility': {
      problem: `<!-- Empty or inaccessible link -->
<a href="/page"></a>
<a href="/page"><img src="icon.png"></a>
<!-- No accessible text for screen readers -->`,
      solution: `<!-- Option 1: Add visible text -->
<a href="/page">Go to page</a>

<!-- Option 2: Add aria-label -->
<a href="/page" aria-label="Go to page">
  <img src="icon.png" alt="">
</a>

<!-- Option 3: Add alt text to image -->
<a href="/page">
  <img src="icon.png" alt="Go to page">
</a>`
    }
  };

  const categorySnippets = snippets[category] || {
    problem: `<!-- Link issue detected -->
<!-- Review the specific link causing this issue -->`,
    solution: `<!-- Fix the link according to the recommendation -->
<!-- See the Fix Guide tab for detailed steps -->`
  };

  return categorySnippets[type] || categorySnippets.problem;
}

function getBrokenLinksSteps(fix) {
  const category = fix.category || '';
  
  const stepsMap = {
    'Broken Links': [
      'Identify all broken links using the list in this report',
      'For each broken link, check if the page moved or was deleted',
      'If moved: update the href to the new URL',
      'If deleted: remove the link or replace with relevant alternative',
      'Consider setting up a custom 404 page to help users who land on missing pages',
      'Re-run the broken link scan to verify fixes'
    ],
    'Redirect Chains': [
      'Review the redirect chain analysis in this report',
      'Identify the final destination URL for each chain',
      'Update your links to point directly to the final URL',
      'If you control the intermediate pages, consolidate redirects',
      'Update any internal links that point to redirected URLs',
      'Test that links now resolve in 1-2 hops maximum'
    ],
    'Redirect Loops': [
      'Identify the URLs involved in the loop from this report',
      'Review your .htaccess file or server redirect configuration',
      'Look for conflicting redirect rules that create the loop',
      'Remove or correct the conflicting rules',
      'Test the affected URLs to confirm the loop is broken',
      'Clear browser cache before testing'
    ],
    'Temporary Redirects': [
      'Identify 302/307 redirects that should be permanent',
      'For each temporary redirect, decide if it should be 301',
      'Update server configuration to use 301 status codes',
      'In .htaccess: Change "Redirect 302" to "Redirect 301"',
      'In nginx: Use "permanent" instead of "redirect"',
      'Verify changes with curl -I <URL> to check response headers'
    ],
    'Link Security': [
      'Find all external links that open in new tabs (target="_blank")',
      'Add rel="noopener noreferrer" to each of these links',
      'For modern browsers, rel="noopener" alone is usually sufficient',
      'Consider automating this with a script for existing content',
      'Update your CMS templates to include these attributes by default',
      'Verify that window.opener is null on the opened pages'
    ],
    'Anchor Text': [
      'Review the list of generic anchor texts in this report',
      'For each "click here" or "read more" link, identify the destination',
      'Replace with descriptive text that explains where the link goes',
      'Include relevant keywords naturally in the anchor text',
      'Avoid over-optimized exact-match anchor text',
      'Make anchor text unique - avoid repeating the same text for different links'
    ],
    'Accessibility': [
      'Find all empty links and image-only links in this report',
      'For empty links: add visible text content',
      'For image links: add alt text that describes the link purpose',
      'Alternative: add aria-label attribute to the link',
      'Test with a screen reader to verify accessibility',
      'Consider using the WAVE browser extension for validation'
    ]
  };

  return stepsMap[category] || [
    'Review the specific issue in the report details',
    'Identify affected links using the tables above',
    'Apply the recommended fix from the Code tab',
    'Test the changes in a development environment',
    'Deploy fixes and re-run the scan to verify'
  ];
}

function ensureBrokenLinksFixFunctions() {
  // Toggle accordion
  if (typeof window.toggleBrokenLinksFixAccordion !== 'function') {
    window.toggleBrokenLinksFixAccordion = function(accordionId) {
      const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
      const content = document.getElementById(`${accordionId}-content`);
      const icon = accordion?.querySelector('.broken-links-fix-expand-icon');

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
  if (typeof window.switchBrokenLinksFixTab !== 'function') {
    window.switchBrokenLinksFixTab = function(accordionId, tabName) {
      const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
      if (!accordion) return;

      const tabs = accordion.querySelectorAll('.broken-links-fix-tab');
      const contents = accordion.querySelectorAll('.broken-links-fix-tab-content');

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
    };
  }

  // Copy code
  if (typeof window.copyBrokenLinksCode !== 'function') {
    window.copyBrokenLinksCode = function(elementId) {
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

// Combined Recommendations + Export Content
function renderRecommendationsAndExportContent(data) {
  const recommendations = data.recommendations || [];

  // Initialize export handlers after render
  setTimeout(() => initExportHandlers(data), 100);

  return `
    <div>
      <!-- Recommendations Section -->
      ${renderRecommendationsContent(recommendations)}

      <!-- Export Section (inline) -->
      <div style="
        margin-top: 2rem;
        padding-top: 1.5rem;
        border-top: 1px solid #333;
      ">
        <h3 style="color: #00d9ff; margin: 0 0 0.75rem 0; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">
          📊 Export Report Data
        </h3>
        <p style="color: #808080; margin: 0 0 1rem 0; font-size: 0.85rem;">
          Download your broken links report in Excel or CSV format to share with your team or track fixes.
        </p>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <button id="exportExcelBtn" style="
            background: rgba(0,217,255,0.15);
            color: #00d9ff;
            border: 1px solid rgba(0,217,255,0.4);
            padding: 0.6rem 1.25rem;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
          " onmouseover="this.style.background='rgba(0,217,255,0.25)'" onmouseout="this.style.background='rgba(0,217,255,0.15)'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
            Export to Excel
          </button>
          <button id="exportCsvBtn" style="
            background: rgba(0,255,65,0.1);
            color: #00ff41;
            border: 1px solid rgba(0,255,65,0.3);
            padding: 0.6rem 1.25rem;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.2s;
          " onmouseover="this.style.background='rgba(0,255,65,0.2)'" onmouseout="this.style.background='rgba(0,255,65,0.1)'">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Export to CSV
          </button>
        </div>
      </div>
    </div>
  `;
}

// ============================================
// NEW: Anchor Text Analysis
// ============================================
function renderAnchorAnalysisContent(analysis) {
  const qualityColor = analysis.qualityScore >= 80 ? '#00ff41' : 
                       analysis.qualityScore >= 60 ? '#ffd700' : 
                       analysis.qualityScore >= 40 ? '#ff8c00' : '#ff4444';
  
  return `
    <div>
      <h3 style="color: #00d9ff; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Anchor Text Quality</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem; font-size: 0.9rem;">
        Good anchor text describes the link destination and helps search engines understand page relevance.
      </p>
      
      <!-- Quality Score -->
      <div style="
        display: flex;
        align-items: center;
        gap: 1.5rem;
        padding: 1rem;
        background: ${qualityColor}10;
        border: 1px solid ${qualityColor}40;
        border-radius: 8px;
        margin-bottom: 1.5rem;
      ">
        <div style="
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: #ffffff;
          border: 3px solid ${qualityColor};
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          font-weight: 900;
          color: #000000;
        ">${analysis.qualityScore}%</div>
        <div>
          <div style="color: #ffffff; font-weight: 600; margin-bottom: 0.25rem;">Anchor Text Quality Score</div>
          <div style="color: #808080; font-size: 0.85rem;">
            ${analysis.descriptiveCount} of ${analysis.totalAnchors} links have descriptive anchor text
          </div>
        </div>
      </div>
      
      <!-- Stats Grid -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #00ff41;">${analysis.descriptiveCount}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Descriptive</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,140,0,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff8c00;">${analysis.genericCount}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Generic</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,68,68,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff4444;">${analysis.emptyCount}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Empty</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(0,217,255,0.1); border-radius: 8px;">
          <div style="font-size: 1.75rem; font-weight: 900; color: #00d9ff;">${analysis.imageOnlyCount}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Image Links</div>
        </div>
      </div>
      
      <!-- Over-used Anchors -->
      ${analysis.overUsedAnchors && analysis.overUsedAnchors.length > 0 ? `
        <div style="margin-bottom: 1.5rem;">
          <h4 style="color: #ffd700; margin: 0 0 0.5rem 0; font-size: 0.95rem;">Frequently Used Anchors</h4>
          <p style="color: #808080; font-size: 0.85rem; margin-bottom: 0.75rem;">
            Consider varying these to create a more natural link profile.
          </p>
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${analysis.overUsedAnchors.map(a => `
              <span style="
                background: rgba(255,215,0,0.15);
                color: #ffd700;
                padding: 0.35rem 0.75rem;
                border-radius: 4px;
                font-size: 0.85rem;
              ">"${a.text}" <span style="opacity: 0.7;">(${a.count}×)</span></span>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Issues Table -->
      ${analysis.issues && analysis.issues.length > 0 ? `
        <h4 style="color: #ff8c00; margin: 0 0 0.5rem 0; font-size: 0.95rem;">Issues to Fix</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid #333;">
                <th style="text-align: left; padding: 0.5rem; color: #c0c0c0;">Anchor Text</th>
                <th style="text-align: left; padding: 0.5rem; color: #c0c0c0;">Issue</th>
                <th style="text-align: left; padding: 0.5rem; color: #c0c0c0;">Link URL</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.issues.slice(0, 20).map(issue => `
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 0.5rem; color: ${issue.category === 'empty' ? '#ff4444' : '#ff8c00'};">
                    ${issue.text || '<em style="opacity: 0.5;">[empty]</em>'}
                  </td>
                  <td style="padding: 0.5rem; color: #c0c0c0; font-size: 0.8rem;">${issue.issue}</td>
                  <td style="padding: 0.5rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <a href="${issue.url}" target="_blank" rel="noopener" style="color: #00d9ff;">${truncateUrl(issue.url)}</a>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${analysis.issues.length > 20 ? `<p style="margin-top: 0.5rem; color: #808080; font-size: 0.8rem;">Showing first 20 of ${analysis.issues.length} issues</p>` : ''}
        </div>
      ` : '<p style="color: #00ff41;">✅ All anchor texts look good!</p>'}
    </div>
  `;
}

// ============================================
// NEW: Link Attributes Audit
// ============================================
function renderAttributeAnalysisContent(analysis) {
  const securityScore = analysis.insecureExternalLinks === 0 ? 100 :
    Math.round((analysis.secureExternalLinks / (analysis.secureExternalLinks + analysis.insecureExternalLinks)) * 100);
  const securityColor = securityScore === 100 ? '#00ff41' : securityScore >= 80 ? '#ffd700' : '#ff4444';
  const isUnlocked = window.ProAccess?.hasProAccess?.() || false;
  
  return `
    <div>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <h3 style="color: #9933ff; margin: 0; font-size: 1rem;">>> Link Attributes Overview</h3>
        ${renderExportButton('exportSecurityIssuesToExcel', '#9933ff', isUnlocked)}
      </div>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem; font-size: 0.9rem;">
        Proper link attributes improve security, SEO, and control how link equity flows through your site.
      </p>
      
      <!-- Attribute Distribution -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(153,51,255,0.1); border-radius: 8px; border: 1px solid rgba(153,51,255,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #9933ff;">${analysis.nofollowCount}</div>
          <div style="color: #c0c0c0; font-size: 0.75rem;">nofollow</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(0,217,255,0.1); border-radius: 8px; border: 1px solid rgba(0,217,255,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #00d9ff;">${analysis.sponsoredCount}</div>
          <div style="color: #c0c0c0; font-size: 0.75rem;">sponsored</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,140,0,0.1); border-radius: 8px; border: 1px solid rgba(255,140,0,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #ff8c00;">${analysis.ugcCount}</div>
          <div style="color: #c0c0c0; font-size: 0.75rem;">ugc</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px; border: 1px solid rgba(0,255,65,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #00ff41;">${analysis.secureExternalLinks}</div>
          <div style="color: #c0c0c0; font-size: 0.75rem;">secure external</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,68,68,0.1); border-radius: 8px; border: 1px solid rgba(255,68,68,0.3);">
          <div style="font-size: 1.5rem; font-weight: 900; color: #ff4444;">${analysis.insecureExternalLinks}</div>
          <div style="color: #c0c0c0; font-size: 0.75rem;">insecure</div>
        </div>
      </div>
      
      <!-- Security Status -->
      <div style="
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1rem;
        background: ${securityColor}10;
        border: 1px solid ${securityColor}40;
        border-radius: 8px;
        margin-bottom: 1.5rem;
      ">
        <span style="font-size: 2rem;">${securityScore === 100 ? '🛡️' : '⚠️'}</span>
        <div>
          <div style="color: ${securityColor}; font-weight: 600;">
            ${securityScore === 100 ? 'All external links are secure!' : 
              `${analysis.insecureExternalLinks} external link${analysis.insecureExternalLinks > 1 ? 's' : ''} missing security attributes`}
          </div>
          <div style="color: #808080; font-size: 0.85rem;">
            External links opening in new tabs should have rel="noopener noreferrer" to prevent tabnabbing
          </div>
        </div>
      </div>
      
      <!-- Internal Link Flow -->
      <div style="
        padding: 1rem;
        background: rgba(255,255,255,0.03);
        border-radius: 8px;
        margin-bottom: 1.5rem;
      ">
        <h4 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 0.95rem;">Internal Link Equity Flow</h4>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="flex: 1; background: #222; border-radius: 4px; height: 24px; overflow: hidden;">
            <div style="
              width: ${analysis.internalLinkFlow.ratio};
              height: 100%;
              background: linear-gradient(90deg, #00ff41, #00d9ff);
            "></div>
          </div>
          <span style="color: #00ff41; font-weight: 600; min-width: 60px;">${analysis.internalLinkFlow.ratio}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; color: #808080; font-size: 0.8rem;">
          <span>Followed: ${analysis.internalLinkFlow.followed}</span>
          <span>Nofollowed: ${analysis.internalLinkFlow.nofollowed}</span>
        </div>
      </div>
      
      <!-- Security Issues Table -->
      ${analysis.securityIssues && analysis.securityIssues.length > 0 ? `
        <h4 style="color: #ff4444; margin: 0 0 0.5rem 0; font-size: 0.95rem;">Security Issues to Fix</h4>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 2px solid #333;">
                <th style="text-align: left; padding: 0.5rem; color: #c0c0c0;">URL</th>
                <th style="text-align: left; padding: 0.5rem; color: #c0c0c0;">Issue</th>
                <th style="text-align: left; padding: 0.5rem; color: #c0c0c0;">Fix</th>
              </tr>
            </thead>
            <tbody>
              ${analysis.securityIssues.slice(0, 15).map(issue => `
                <tr style="border-bottom: 1px solid #222;">
                  <td style="padding: 0.5rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <a href="${issue.url}" target="_blank" rel="noopener noreferrer" style="color: #ff6b6b;">${truncateUrl(issue.url)}</a>
                  </td>
                  <td style="padding: 0.5rem; color: #c0c0c0; font-size: 0.8rem;">${issue.risk}</td>
                  <td style="padding: 0.5rem; color: #00ff41; font-size: 0.8rem; font-family: monospace;">${issue.fix}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          ${analysis.securityIssues.length > 15 ? `<p style="margin-top: 0.5rem; color: #808080; font-size: 0.8rem;">Showing first 15 of ${analysis.securityIssues.length} issues</p>` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

// ============================================
// NEW: Redirect Chain Analysis
// ============================================
function renderRedirectAnalysisContent(analysis) {
  return `
    <div>
      <h3 style="color: #ffd700; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Redirect Analysis</h3>
      <p style="color: #c0c0c0; margin-bottom: 1.5rem; font-size: 0.9rem;">
        Detailed breakdown of redirect types and chain lengths across your site.
      </p>
      
      <!-- Redirect Type Distribution -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="text-align: center; padding: 1rem; background: rgba(0,255,65,0.1); border-radius: 8px; border: 1px solid rgba(0,255,65,0.3);">
          <div style="font-size: 1.75rem; font-weight: 900; color: #00ff41;">${analysis.permanent301 + analysis.permanent308}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Permanent (301/308)</div>
          <div style="color: #00ff41; font-size: 0.7rem; margin-top: 0.25rem;">✓ Passes link equity</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,140,0,0.1); border-radius: 8px; border: 1px solid rgba(255,140,0,0.3);">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff8c00;">${analysis.temporary302 + analysis.temporary307}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Temporary (302/307)</div>
          <div style="color: #ff8c00; font-size: 0.7rem; margin-top: 0.25rem;">⚠ Limited equity</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: rgba(255,68,68,0.1); border-radius: 8px; border: 1px solid rgba(255,68,68,0.3);">
          <div style="font-size: 1.75rem; font-weight: 900; color: #ff4444;">${analysis.longChains.length}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Long Chains (>2 hops)</div>
          <div style="color: #ff4444; font-size: 0.7rem; margin-top: 0.25rem;">⚠ Slow & lossy</div>
        </div>
        <div style="text-align: center; padding: 1rem; background: ${analysis.loops.length > 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,255,65,0.1)'}; border-radius: 8px; border: 1px solid ${analysis.loops.length > 0 ? 'rgba(255,0,0,0.5)' : 'rgba(0,255,65,0.3)'};">
          <div style="font-size: 1.75rem; font-weight: 900; color: ${analysis.loops.length > 0 ? '#ff0000' : '#00ff41'};">${analysis.loops.length}</div>
          <div style="color: #c0c0c0; font-size: 0.8rem;">Redirect Loops</div>
          <div style="color: ${analysis.loops.length > 0 ? '#ff0000' : '#00ff41'}; font-size: 0.7rem; margin-top: 0.25rem;">
            ${analysis.loops.length > 0 ? '❌ Critical!' : '✓ None found'}
          </div>
        </div>
      </div>
      
      <!-- Chain Length Distribution -->
      ${Object.keys(analysis.chainLengths).length > 0 ? `
        <div style="
          padding: 1rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          margin-bottom: 1.5rem;
        ">
          <h4 style="color: #c0c0c0; margin: 0 0 0.75rem 0; font-size: 0.9rem;">Chain Length Distribution</h4>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${Object.entries(analysis.chainLengths).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([length, count]) => {
              const color = parseInt(length) <= 1 ? '#00ff41' : parseInt(length) <= 2 ? '#ffd700' : '#ff4444';
              return `
                <div style="
                  padding: 0.5rem 1rem;
                  background: ${color}15;
                  border: 1px solid ${color}40;
                  border-radius: 4px;
                  text-align: center;
                ">
                  <span style="color: ${color}; font-weight: 600;">${count}</span>
                  <span style="color: #808080; font-size: 0.8rem;"> × ${length} hop${parseInt(length) !== 1 ? 's' : ''}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
      
      <!-- Long Chains Detail -->
      ${analysis.longChains && analysis.longChains.length > 0 ? `
        <h4 style="color: #ff4444; margin: 0 0 0.5rem 0; font-size: 0.95rem;">Long Redirect Chains (>2 hops)</h4>
        <p style="color: #808080; font-size: 0.85rem; margin-bottom: 0.75rem;">
          These chains slow down page load. Update links to point directly to final destination.
        </p>
        <div style="display: grid; gap: 0.75rem;">
          ${analysis.longChains.slice(0, 10).map(chain => `
            <div style="
              padding: 0.75rem;
              background: rgba(255,68,68,0.1);
              border: 1px solid rgba(255,68,68,0.3);
              border-radius: 6px;
            ">
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                <span style="color: #ff4444; font-weight: 600;">${chain.chainLength} hops</span>
                <span style="color: #808080; font-size: 0.8rem;">→</span>
              </div>
              <div style="font-family: monospace; font-size: 0.8rem; color: #c0c0c0; overflow-x: auto;">
                <span style="color: #ff8c00;">${truncateUrl(chain.originalUrl)}</span>
                ${chain.chain.slice(0, 3).map(r => `
                  <span style="color: #666;"> → </span>
                  <span style="color: #ffd700;">${r.statusCode || '→'}</span>
                  <span style="color: #666;"> → </span>
                  <span style="color: #00d9ff;">${truncateUrl(r.url)}</span>
                `).join('')}
                ${chain.chain.length > 3 ? `<span style="color: #666;"> ... +${chain.chain.length - 3} more</span>` : ''}
                ${chain.finalDestination ? `
                  <span style="color: #666;"> → </span>
                  <span style="color: #00ff41;">✓ ${truncateUrl(chain.finalDestination)}</span>
                ` : ''}
              </div>
            </div>
          `).join('')}
          ${analysis.longChains.length > 10 ? `<p style="color: #808080; font-size: 0.8rem;">+${analysis.longChains.length - 10} more long chains</p>` : ''}
        </div>
      ` : '<p style="color: #00ff41; margin-top: 1rem;">✅ No problematic redirect chains detected!</p>'}
      
      <!-- Loops Detail -->
      ${analysis.loops && analysis.loops.length > 0 ? `
        <h4 style="color: #ff0000; margin: 1rem 0 0.5rem 0; font-size: 0.95rem;">⚠️ Redirect Loops Detected</h4>
        <p style="color: #808080; font-size: 0.85rem; margin-bottom: 0.75rem;">
          These redirects form infinite loops. Fix immediately!
        </p>
        ${analysis.loops.slice(0, 5).map(loop => `
          <div style="
            padding: 0.75rem;
            background: rgba(255,0,0,0.15);
            border: 2px solid #ff0000;
            border-radius: 6px;
            margin-bottom: 0.5rem;
          ">
            <div style="color: #ff0000; font-weight: 600; margin-bottom: 0.25rem;">🔄 Loop starting from:</div>
            <a href="${loop.url}" target="_blank" rel="noopener" style="color: #ff6b6b; font-family: monospace; font-size: 0.85rem;">${loop.url}</a>
          </div>
        `).join('')}
      ` : ''}
      
      <!-- Redirects Ending in Error -->
      ${analysis.endsInError && analysis.endsInError.length > 0 ? `
        <h4 style="color: #ff4444; margin: 1rem 0 0.5rem 0; font-size: 0.95rem;">Redirects Ending in Errors</h4>
        <p style="color: #808080; font-size: 0.85rem; margin-bottom: 0.75rem;">
          These redirect chains end in error pages instead of valid content.
        </p>
        ${analysis.endsInError.slice(0, 5).map(err => `
          <div style="
            padding: 0.5rem 0.75rem;
            background: rgba(255,68,68,0.1);
            border-left: 3px solid #ff4444;
            margin-bottom: 0.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <a href="${err.url}" target="_blank" rel="noopener" style="color: #ff6b6b; font-size: 0.85rem;">${truncateUrl(err.url)}</a>
            <span style="background: #ff444420; color: #ff4444; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
              ${err.finalStatusCode || 'ERR'}
            </span>
          </div>
        `).join('')}
      ` : ''}
    </div>
  `;
}

// Helper functions
function truncateUrl(url) {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname + parsed.search;
    if (path.length > 50) {
      return parsed.hostname + path.substring(0, 47) + '...';
    }
    return parsed.hostname + path;
  } catch (e) {
    return url.length > 60 ? url.substring(0, 57) + '...' : url;
  }
}

function getAccentPrimaryHex() {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-primary').trim();
  return value || '#00ff41';
}

function getGradeColor(grade) {
  if (grade === 'A') return getAccentPrimaryHex();
  if (grade === 'B') return '#ffd700';
  if (grade === 'C') return '#ff8c00';
  if (grade === 'D') return '#ff4444';
  if (grade === 'F') return '#ff0000';
  return '#888888';
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
  if (score >= 80) return getAccentPrimaryHex();
  if (score >= 60) return '#ffd700';
  if (score >= 40) return '#ff8c00';
  return '#ff4444';
}

function createProUpgradePrompt(message) {
  return `
    <div style="
      text-align: center;
      padding: 2rem;
      background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,140,0,0.05) 100%);
      border: 1px dashed rgba(255,215,0,0.4);
      border-radius: 12px;
    ">
      <div style="
        width: 60px;
        height: 60px;
        margin: 0 auto 1rem;
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
      ">🔒</div>
      <h3 style="color: #ffd700; margin: 0 0 0.5rem 0; font-size: 1.1rem;">Pro Feature</h3>
      <p style="color: #c0c0c0; margin: 0 0 1.5rem 0; font-size: 0.9rem;">${message}</p>
      <button onclick="openPricingModal()" style="
        background: linear-gradient(135deg, #ffd700, #ff8c00);
        color: #000;
        border: none;
        padding: 0.75rem 2rem;
        border-radius: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
      " onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 20px rgba(255,215,0,0.3)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
        Upgrade to Pro
      </button>
    </div>
  `;
}

async function checkProAccess() {
  // Check if CreditsManager has Pro status
  if (window.CreditsManager && typeof window.CreditsManager.hasProAccess === 'function') {
    return await window.CreditsManager.hasProAccess();
  }
  // Fallback: check for reportUnlocked in session
  const reportId = document.body.getAttribute('data-report-id');
  if (reportId && window.CreditsManager && window.CreditsManager.isReportUnlocked) {
    return window.CreditsManager.isReportUnlocked(reportId);
  }
  return false;
}

function openPricingModal() {
  if (window.PricingModal && typeof window.PricingModal.open === 'function') {
    window.PricingModal.open();
  } else {
    alert('Please sign up for Pro access at sitemechanic.io/pricing');
  }
}

// Global export handler for ProReportBlock
window.exportExcel = async function(format, buttonEl) {
  const data = window.currentBrokenLinksResults;
  if (!data) {
    console.error('No broken links data available for export');
    return;
  }
  exportToExcel(data);
};

// ============================================
// EXPORT SECTION (Pro Feature)
// ============================================
function createExportSection() {
  return `
    <div style="
      background: linear-gradient(135deg, rgba(0,217,255,0.1) 0%, rgba(0,255,65,0.05) 100%);
      border: 1px solid rgba(0,217,255,0.3);
      border-radius: 12px;
      padding: 1.5rem;
    ">
      <h3 style="color: #00d9ff; margin: 0 0 0.75rem 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem;">
        📊 Export Broken Links Data
        <span style="
          background: linear-gradient(135deg, #ffd700, #ff8c00);
          color: #000;
          font-size: 0.6rem;
          font-weight: 700;
          padding: 0.15rem 0.4rem;
          border-radius: 3px;
          text-transform: uppercase;
        ">PRO</span>
      </h3>
      <p style="color: #808080; margin: 0 0 1rem 0; font-size: 0.85rem;">
        Download your broken links report in Excel format to share with your team or track fixes.
      </p>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button id="exportExcelBtn" style="
          background: rgba(0,217,255,0.15);
          color: #00d9ff;
          border: 1px solid rgba(0,217,255,0.4);
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(0,217,255,0.25)'" onmouseout="this.style.background='rgba(0,217,255,0.15)'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          Export to Excel
        </button>
        <button id="exportCsvBtn" style="
          background: rgba(0,255,65,0.1);
          color: #00ff41;
          border: 1px solid rgba(0,255,65,0.3);
          padding: 0.6rem 1.25rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        " onmouseover="this.style.background='rgba(0,255,65,0.2)'" onmouseout="this.style.background='rgba(0,255,65,0.1)'">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export to CSV
        </button>
      </div>
    </div>
  `;
}

function initExportHandlers(data) {
  const excelBtn = document.getElementById('exportExcelBtn');
  const csvBtn = document.getElementById('exportCsvBtn');

  if (excelBtn) {
    excelBtn.addEventListener('click', async () => {
      const hasPro = await checkProAccess();
      if (!hasPro) {
        openPricingModal();
        return;
      }
      exportToExcel(data);
    });
  }

  if (csvBtn) {
    csvBtn.addEventListener('click', async () => {
      const hasPro = await checkProAccess();
      if (!hasPro) {
        openPricingModal();
        return;
      }
      exportToCsv(data);
    });
  }
}

function exportToExcel(data) {
  // Create Excel-compatible XML (SpreadsheetML)
  const worksheets = [];

  // Sheet 1: Summary
  const summaryRows = [
    ['Broken Links Report'],
    ['URL', data.url],
    ['Scan Date', new Date().toLocaleString()],
    ['Pages Scanned', data.pagesScanned],
    ['Total Links', data.totalLinks],
    [''],
    ['Summary'],
    ['Broken Links', data.summary.broken],
    ['Redirects', data.summary.redirects],
    ['Working Links', data.summary.working],
    ['External Links', data.summary.external],
    ['Score', data.score],
    ['Grade', data.grade]
  ];
  worksheets.push({ name: 'Summary', rows: summaryRows });

  // Sheet 2: Broken Links
  if (data.links.broken && data.links.broken.length > 0) {
    const brokenRows = [['URL', 'Status Code', 'Link Text', 'Found On Pages']];
    data.links.broken.forEach(link => {
      brokenRows.push([
        link.url,
        link.statusCode || 'ERR',
        link.text || '',
        link.foundOn.length
      ]);
    });
    worksheets.push({ name: 'Broken Links', rows: brokenRows });
  }

  // Sheet 3: Redirects
  if (data.links.redirects && data.links.redirects.length > 0) {
    const redirectRows = [['Original URL', 'Status Code', 'Redirect Type', 'Chain Length', 'Final Destination']];
    data.links.redirects.forEach(link => {
      redirectRows.push([
        link.url,
        link.statusCode,
        link.redirectType || '',
        (link.redirectChain || []).length,
        link.finalDestination || ''
      ]);
    });
    worksheets.push({ name: 'Redirects', rows: redirectRows });
  }

  // Sheet 4: Recommendations
  if (data.recommendations && data.recommendations.length > 0) {
    const recRows = [['Priority', 'Category', 'Message', 'Detail', 'Impact']];
    data.recommendations.forEach(rec => {
      recRows.push([
        rec.priority,
        rec.category,
        rec.message,
        rec.detail,
        rec.impact
      ]);
    });
    worksheets.push({ name: 'Recommendations', rows: recRows });
  }

  // Generate Excel XML
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';

  worksheets.forEach(sheet => {
    xml += `<Worksheet ss:Name="${escapeXml(sheet.name)}">\n<Table>\n`;
    sheet.rows.forEach(row => {
      xml += '<Row>\n';
      row.forEach(cell => {
        const value = cell !== null && cell !== undefined ? String(cell) : '';
        const type = typeof cell === 'number' ? 'Number' : 'String';
        xml += `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>\n`;
      });
      xml += '</Row>\n';
    });
    xml += '</Table>\n</Worksheet>\n';
  });

  xml += '</Workbook>';

  // Download
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broken-links-report-${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Export working links to Excel - called from inline button
window.exportWorkingLinksToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.working) {
    alert('No link data available to export');
    return;
  }

  const rows = [
    ['Working Links Export'],
    ['URL', data.url],
    ['Scan Date', new Date().toLocaleString()],
    ['Total Working Links', data.summary.working],
    [''],
    ['URL', 'Link Text', 'Found On Pages']
  ];

  data.links.working.forEach(link => {
    rows.push([
      link.url,
      link.text || '',
      link.foundOn ? link.foundOn.length : 1
    ]);
  });

  // Generate Excel XML
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Worksheet ss:Name="Working Links">\n<Table>\n';

  rows.forEach(row => {
    xml += '<Row>\n';
    row.forEach(cell => {
      const value = cell !== null && cell !== undefined ? String(cell) : '';
      const type = typeof cell === 'number' ? 'Number' : 'String';
      xml += `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
  });

  xml += '</Table>\n</Worksheet>\n</Workbook>';

  // Download
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `working-links-${new Date().toISOString().split('T')[0]}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Export broken links to Excel
window.exportBrokenLinksToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.broken || data.links.broken.length === 0) {
    alert('No broken links to export');
    return;
  }

  const rows = [
    ['Broken Links Export'],
    ['URL', data.url],
    ['Scan Date', new Date().toLocaleString()],
    ['Total Broken Links', data.links.broken.length],
    [''],
    ['URL', 'Status Code', 'Link Text', 'Found On Pages']
  ];

  data.links.broken.forEach(link => {
    rows.push([
      link.url,
      link.statusCode || 'ERR',
      link.text || '',
      link.foundOn ? link.foundOn.length : 1
    ]);
  });

  downloadExcelFile(rows, 'Broken Links', `broken-links-${new Date().toISOString().split('T')[0]}.xls`);
};

// Export redirects to Excel
window.exportRedirectsToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.redirects || data.links.redirects.length === 0) {
    alert('No redirects to export');
    return;
  }

  const rows = [
    ['Redirects Export'],
    ['URL', data.url],
    ['Scan Date', new Date().toLocaleString()],
    ['Total Redirects', data.links.redirects.length],
    [''],
    ['Original URL', 'Status Code', 'Redirect Type', 'Chain Length', 'Final Destination']
  ];

  data.links.redirects.forEach(link => {
    rows.push([
      link.url,
      link.statusCode || '',
      link.redirectType || '',
      (link.redirectChain || []).length,
      link.finalDestination || ''
    ]);
  });

  downloadExcelFile(rows, 'Redirects', `redirects-${new Date().toISOString().split('T')[0]}.xls`);
};

// Export external links to Excel
window.exportExternalLinksToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.links || !data.links.external || data.links.external.length === 0) {
    alert('No external links to export');
    return;
  }

  const rows = [
    ['External Links Export'],
    ['URL', data.url],
    ['Scan Date', new Date().toLocaleString()],
    ['Total External Links', data.summary.external],
    [''],
    ['External URL', 'Link Text', 'Status Code', 'Found On Pages']
  ];

  data.links.external.forEach(link => {
    rows.push([
      link.url,
      link.text || '',
      link.statusCode || 'OK',
      link.foundOn ? link.foundOn.length : 1
    ]);
  });

  downloadExcelFile(rows, 'External Links', `external-links-${new Date().toISOString().split('T')[0]}.xls`);
};

// Export security issues (Link Attributes Audit) to Excel
window.exportSecurityIssuesToExcel = async function() {
  const hasPro = await checkProAccess();
  if (!hasPro) {
    openPricingModal();
    return;
  }
  
  const data = window.currentBrokenLinksResults;
  if (!data || !data.attributeAnalysis) {
    alert('No link attribute data to export');
    return;
  }

  const analysis = data.attributeAnalysis;
  const rows = [
    ['Link Attributes Audit Export'],
    ['URL', data.url],
    ['Scan Date', new Date().toLocaleString()],
    [''],
    ['SUMMARY'],
    ['Nofollow Links', analysis.nofollowCount],
    ['Sponsored Links', analysis.sponsoredCount],
    ['UGC Links', analysis.ugcCount],
    ['Secure External Links', analysis.secureExternalLinks],
    ['Insecure External Links', analysis.insecureExternalLinks],
    [''],
    ['INTERNAL LINK EQUITY FLOW'],
    ['Followed', analysis.internalLinkFlow?.followed || 0],
    ['Nofollowed', analysis.internalLinkFlow?.nofollowed || 0],
    ['Ratio', analysis.internalLinkFlow?.ratio || 'N/A'],
    ['']
  ];

  // Add security issues if any
  if (analysis.securityIssues && analysis.securityIssues.length > 0) {
    rows.push(['SECURITY ISSUES TO FIX']);
    rows.push(['URL', 'Issue', 'Recommended Fix']);
    analysis.securityIssues.forEach(issue => {
      rows.push([
        issue.url,
        issue.risk || 'Missing security attributes',
        issue.fix || 'Add rel="noopener noreferrer"'
      ]);
    });
  }

  downloadExcelFile(rows, 'Link Attributes', `link-attributes-audit-${new Date().toISOString().split('T')[0]}.xls`);
};
// Shared Excel download helper
function downloadExcelFile(rows, sheetName, filename) {
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += `<Worksheet ss:Name="${escapeXml(sheetName)}">\n<Table>\n`;

  rows.forEach(row => {
    xml += '<Row>\n';
    row.forEach(cell => {
      const value = cell !== null && cell !== undefined ? String(cell) : '';
      const type = typeof cell === 'number' ? 'Number' : 'String';
      xml += `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>\n`;
    });
    xml += '</Row>\n';
  });

  xml += '</Table>\n</Worksheet>\n</Workbook>';

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportToCsv(data) {
  const rows = [
    ['Broken Links Report'],
    ['URL', data.url],
    ['Scan Date', new Date().toLocaleString()],
    [''],
    ['BROKEN LINKS'],
    ['URL', 'Status Code', 'Link Text', 'Found On Pages']
  ];

  if (data.links.broken) {
    data.links.broken.forEach(link => {
      rows.push([
        link.url,
        link.statusCode || 'ERR',
        link.text || '',
        link.foundOn.length
      ]);
    });
  }

  rows.push(['']);
  rows.push(['REDIRECTS']);
  rows.push(['Original URL', 'Status Code', 'Redirect Type', 'Chain Length', 'Final Destination']);

  if (data.links.redirects) {
    data.links.redirects.forEach(link => {
      rows.push([
        link.url,
        link.statusCode,
        link.redirectType || '',
        (link.redirectChain || []).length,
        link.finalDestination || ''
      ]);
    });
  }

  // Convert to CSV
  const csv = rows.map(row =>
    row.map(cell => {
      const value = cell !== null && cell !== undefined ? String(cell) : '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(',')
  ).join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `broken-links-report-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// PAGINATION
// ============================================
const ITEMS_PER_PAGE = 25;
const paginationState = {
  'broken-links': { page: 1, total: 0 },
  'redirects': { page: 1, total: 0 },
  'working-links': { page: 1, total: 0 },
  'external-links': { page: 1, total: 0 }
};

function renderPaginatedTable(items, tableId, renderRow, headers) {
  const state = paginationState[tableId] || { page: 1, total: items.length };
  state.total = items.length;
  paginationState[tableId] = state;

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const startIdx = (state.page - 1) * ITEMS_PER_PAGE;
  const endIdx = Math.min(startIdx + ITEMS_PER_PAGE, items.length);
  const pageItems = items.slice(startIdx, endIdx);

  return `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
        <thead>
          <tr style="border-bottom: 2px solid #333;">
            ${headers.map(h => `<th style="text-align: ${h.align || 'left'}; padding: 0.75rem; color: #c0c0c0;">${h.label}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${pageItems.map(renderRow).join('')}
        </tbody>
      </table>
    </div>
    ${items.length > ITEMS_PER_PAGE ? renderPaginationControls(tableId, state.page, totalPages, items.length) : ''}
  `;
}

function renderPaginationControls(tableId, currentPage, totalPages, totalItems) {
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return `
    <div style="
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 1rem;
      padding: 0.75rem;
      background: rgba(255,255,255,0.03);
      border-radius: 8px;
    ">
      <span style="color: #808080; font-size: 0.85rem;">
        Showing ${startItem}-${endItem} of ${totalItems} items
      </span>
      <div style="display: flex; gap: 0.5rem;">
        <button
          onclick="changePage('${tableId}', ${currentPage - 1})"
          ${currentPage === 1 ? 'disabled' : ''}
          style="
            background: ${currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'rgba(0,217,255,0.15)'};
            color: ${currentPage === 1 ? '#555' : '#00d9ff'};
            border: 1px solid ${currentPage === 1 ? '#333' : 'rgba(0,217,255,0.3)'};
            padding: 0.4rem 0.75rem;
            border-radius: 4px;
            cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'};
            font-size: 0.85rem;
          "
        >← Prev</button>
        <span style="
          color: #00d9ff;
          padding: 0.4rem 0.75rem;
          font-size: 0.85rem;
          font-weight: 600;
        ">${currentPage} / ${totalPages}</span>
        <button
          onclick="changePage('${tableId}', ${currentPage + 1})"
          ${currentPage === totalPages ? 'disabled' : ''}
          style="
            background: ${currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'rgba(0,217,255,0.15)'};
            color: ${currentPage === totalPages ? '#555' : '#00d9ff'};
            border: 1px solid ${currentPage === totalPages ? '#333' : 'rgba(0,217,255,0.3)'};
            padding: 0.4rem 0.75rem;
            border-radius: 4px;
            cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'};
            font-size: 0.85rem;
          "
        >Next →</button>
      </div>
    </div>
  `;
}

function changePage(tableId, newPage) {
  const state = paginationState[tableId];
  if (!state) return;

  const totalPages = Math.ceil(state.total / ITEMS_PER_PAGE);
  if (newPage < 1 || newPage > totalPages) return;

  state.page = newPage;

  // Re-render the content
  const data = window.currentBrokenLinksResults;
  if (!data) return;

  const accordion = document.querySelector(`#accordion-${tableId}`);
  if (!accordion) return;

  const contentInner = accordion.querySelector('.accordion-content-inner');
  if (!contentInner) return;

  // Re-render based on table type
  switch(tableId) {
    case 'broken-links':
      contentInner.innerHTML = renderBrokenLinksContent(data.links.broken);
      break;
    case 'redirects':
      contentInner.innerHTML = renderRedirectsContent(data.links.redirects, data.redirectAnalysis);
      break;
    case 'working-links':
      contentInner.innerHTML = renderWorkingLinksContent(data.links.working, data.summary.working);
      break;
    case 'external-links':
      contentInner.innerHTML = renderExternalLinksContent(data.links.external, data.summary.external);
      break;
  }
}
