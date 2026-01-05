// Broken Links Analyzer Script
// Uses AnalyzerLoader for consistent loading UI

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
      Link analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(0, 255, 65, 0.7); padding: 0 0.5rem;">
      This may take 30-90 seconds depending on site size
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
  
  loader.start(analysisSteps, '[BROKEN LINK CHECKER]', 60);
  
  // Insert patience message after loader content
  const loadingContainer = document.getElementById('loadingContainer');
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }
  
  try {
    loader.nextStep(1);
    
    const response = await fetch('/api/broken-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, maxPages, maxDepth, followExternal })
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

  // 1. Overview Section with Score Circle
  const overviewSection = document.createElement('div');
  overviewSection.className = 'section';
  overviewSection.innerHTML = createOverviewSection(data);
  resultsContainer.appendChild(overviewSection);

  // 2. Summary Cards
  const summarySection = document.createElement('div');
  summarySection.className = 'section';
  summarySection.innerHTML = createSummaryCards(data.summary);
  resultsContainer.appendChild(summarySection);

  // 3. Accordion Sections
  if (data.links.broken && data.links.broken.length > 0) {
    createAccordionSection(resultsContainer, 'broken-links', `🔴 Broken Links (${data.links.broken.length})`, 
      () => renderBrokenLinksContent(data.links.broken), null, true);
  }
  
  if (data.links.redirects && data.links.redirects.length > 0) {
    createAccordionSection(resultsContainer, 'redirects', `🟡 Redirects (${data.links.redirects.length})`, 
      () => renderRedirectsContent(data.links.redirects), null, false);
  }
  
  if (data.links.working && data.links.working.length > 0) {
    createAccordionSection(resultsContainer, 'working-links', `🟢 Working Links (${data.summary.working} total)`, 
      () => renderWorkingLinksContent(data.links.working, data.summary.working), null, false);
  }
  
  if (data.links.external && data.links.external.length > 0) {
    createAccordionSection(resultsContainer, 'external-links', `🔵 External Links (${data.summary.external} total)`, 
      () => renderExternalLinksContent(data.links.external, data.summary.external), null, false);
  }

  // 4. Recommendations
  if (data.recommendations && data.recommendations.length > 0) {
    createAccordionSection(resultsContainer, 'recommendations', '💡 Recommendations', 
      () => renderRecommendationsContent(data.recommendations), null, false);
  }
}

function createOverviewSection(data) {
  const gradeColor = getGradeColor(data.grade);
  const s = data.summary;
  
  return `
    <h2>[LINK_HEALTH_OVERVIEW]</h2>
    
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
            ">${data.score}</div>
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
          <h3 style="color: ${gradeColor}; margin: 0 0 1rem 0; font-size: 1.3rem;">>> Scan Summary</h3>
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
              <span style="color: ${s.broken > 0 ? '#ff4444' : '#00ff41'}; font-weight: bold;">${s.broken}</span>
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
  const cards = [
    { key: 'broken', label: 'Broken', icon: '🔴', color: summary.broken > 0 ? '#ff4444' : '#00ff41', desc: 'Dead links' },
    { key: 'redirects', label: 'Redirects', icon: '🟡', color: summary.redirects > 5 ? '#ff8c00' : '#ffd700', desc: '301/302 chains' },
    { key: 'working', label: 'Working', icon: '🟢', color: '#00ff41', desc: 'Healthy links' },
    { key: 'external', label: 'External', icon: '🔵', color: '#00d9ff', desc: 'Outbound links' }
  ];

  return `
    <h2>[LINK_BREAKDOWN]</h2>
    <p style="color: #c0c0c0; margin-bottom: 1rem;">>> Link status breakdown</p>
    
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.5rem;">
      ${cards.map(cat => {
        const count = summary[cat.key] || 0;
        return `
          <div style="
            background: linear-gradient(135deg, ${cat.color}15 0%, ${cat.color}05 100%);
            border: 2px solid ${cat.color}80;
            border-radius: 12px;
            padding: 1.5rem;
            text-align: center;
          ">
            <div style="
              width: 70px;
              height: 70px;
              margin: 0 auto 1rem;
              border-radius: 50%;
              background: #ffffff;
              border: 3px solid ${cat.color};
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 1.75rem;
              font-weight: 900;
              color: #000000;
              box-shadow: 0 0 15px ${cat.color}40;
            ">${count}</div>
            <div style="font-size: 1.25rem; margin-bottom: 0.5rem;">${cat.icon}</div>
            <div style="color: #ffffff; font-size: 1rem; font-weight: 600;">${cat.label}</div>
            <div style="color: #808080; font-size: 0.8rem; margin-top: 0.25rem;">${cat.desc}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function createAccordionSection(container, id, title, contentCreator, score, startOpen = false) {
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
  
  // Start collapsed or expanded based on startOpen
  if (startOpen) {
    content.style.cssText = 'max-height: 5000px; padding: 1rem 1.25rem; overflow: visible; border-top: 1px solid #333;';
    content.classList.add('expanded');
    header.classList.add('active');
  } else {
    content.style.cssText = 'max-height: 0; padding: 0; overflow: hidden; border-top: none; transition: max-height 0.3s ease, padding 0.3s ease;';
  }
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  
  // Load content immediately if startOpen
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

function renderBrokenLinksContent(broken) {
  return `
    <div>
      <h3 style="color: #ff4444; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Critical: Fix These Links</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Broken links hurt SEO and user experience. These need immediate attention.
      </p>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 2px solid #333;">
              <th style="text-align: left; padding: 0.75rem; color: #c0c0c0;">Broken URL</th>
              <th style="text-align: center; padding: 0.75rem; color: #c0c0c0;">Status</th>
              <th style="text-align: center; padding: 0.75rem; color: #c0c0c0;">Found On</th>
              <th style="text-align: left; padding: 0.75rem; color: #c0c0c0;">Link Text</th>
            </tr>
          </thead>
          <tbody>
            ${broken.slice(0, 50).map(link => `
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
            `).join('')}
          </tbody>
        </table>
        ${broken.length > 50 ? `<p style="margin-top: 1rem; color: #808080; font-size: 0.85rem;">Showing first 50 of ${broken.length} broken links</p>` : ''}
      </div>
    </div>
  `;
}

function renderRedirectsContent(redirects) {
  return `
    <div>
      <h3 style="color: #ffd700; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Redirect Chains</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Update these links to point directly to their final destination to improve page speed.
      </p>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr style="border-bottom: 2px solid #333;">
              <th style="text-align: left; padding: 0.75rem; color: #c0c0c0;">Original URL</th>
              <th style="text-align: center; padding: 0.75rem; color: #c0c0c0;">Status</th>
              <th style="text-align: left; padding: 0.75rem; color: #c0c0c0;">Redirects To</th>
            </tr>
          </thead>
          <tbody>
            ${redirects.slice(0, 30).map(link => `
              <tr style="border-bottom: 1px solid #222;">
                <td style="padding: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                  <a href="${link.url}" target="_blank" rel="noopener" style="color: #ffd700;">${truncateUrl(link.url)}</a>
                </td>
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="background: rgba(255,215,0,0.2); color: #ffd700; padding: 0.25rem 0.5rem; border-radius: 4px; font-weight: 600;">
                    ${link.statusCode}
                  </span>
                </td>
                <td style="padding: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #00ff41;">
                  ${link.redirectChain.length > 0 ? truncateUrl(link.redirectChain[0]) : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${redirects.length > 30 ? `<p style="margin-top: 1rem; color: #808080; font-size: 0.85rem;">Showing first 30 of ${redirects.length} redirects</p>` : ''}
      </div>
    </div>
  `;
}

function renderWorkingLinksContent(working, total) {
  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Healthy Internal Links</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        All these links are working correctly. Showing sample of ${working.length} (${total} total).
      </p>
      
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${working.slice(0, 20).map(link => `
          <a href="${link.url}" target="_blank" rel="noopener" style="
            background: rgba(0,255,65,0.1);
            color: #00ff41;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.85rem;
            border: 1px solid rgba(0,255,65,0.3);
            max-width: 250px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${truncateUrl(link.url)}</a>
        `).join('')}
      </div>
    </div>
  `;
}

function renderExternalLinksContent(external, total) {
  return `
    <div>
      <h3 style="color: #00d9ff; margin: 0 0 0.75rem 0; font-size: 1rem;">>> External Outbound Links</h3>
      <p style="color: #c0c0c0; margin-bottom: 1rem; font-size: 0.9rem;">
        Links pointing to other domains. Showing sample of ${external.length} (${total} total).
      </p>
      
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${external.slice(0, 20).map(link => `
          <a href="${link.url}" target="_blank" rel="noopener" style="
            background: rgba(0,217,255,0.1);
            color: #00d9ff;
            padding: 0.5rem 1rem;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.85rem;
            border: 1px solid rgba(0,217,255,0.3);
            max-width: 250px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          ">${truncateUrl(link.url)}</a>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRecommendationsContent(recommendations) {
  const grouped = {
    critical: recommendations.filter(r => r.priority === 'critical'),
    high: recommendations.filter(r => r.priority === 'high'),
    medium: recommendations.filter(r => r.priority === 'medium'),
    success: recommendations.filter(r => r.priority === 'success')
  };

  return `
    <div>
      <h3 style="color: #00ff41; margin: 0 0 0.75rem 0; font-size: 1rem;">>> Action Items</h3>
      
      ${grouped.critical.length > 0 ? `
        <h4 style="color: #ff4444; margin: 1rem 0 0.5rem; font-size: 0.9rem;">🔴 Critical</h4>
        ${grouped.critical.map(rec => renderRecommendation(rec, '#ff4444')).join('')}
      ` : ''}
      
      ${grouped.high.length > 0 ? `
        <h4 style="color: #ff8c00; margin: 1rem 0 0.5rem; font-size: 0.9rem;">🟠 High Priority</h4>
        ${grouped.high.map(rec => renderRecommendation(rec, '#ff8c00')).join('')}
      ` : ''}
      
      ${grouped.medium.length > 0 ? `
        <h4 style="color: #ffd700; margin: 1rem 0 0.5rem; font-size: 0.9rem;">🟡 Medium Priority</h4>
        ${grouped.medium.map(rec => renderRecommendation(rec, '#ffd700')).join('')}
      ` : ''}
      
      ${grouped.success.length > 0 ? `
        ${grouped.success.map(rec => renderRecommendation(rec, '#00ff41')).join('')}
      ` : ''}
    </div>
  `;
}

function renderRecommendation(rec, color) {
  return `
    <div style="
      padding: 1rem 1rem 1rem 1.25rem;
      margin: 0.5rem 0;
      background: ${color}10;
      border-left: 4px solid ${color};
      border-radius: 4px;
    ">
      <h4 style="margin: 0 0 0.5rem 0; color: #ffffff;">${rec.message}</h4>
      <p style="margin: 0; color: #c0c0c0; font-size: 0.9rem;">${rec.detail}</p>
      <p style="margin: 0.5rem 0 0 0; color: #808080; font-size: 0.85rem; font-style: italic;">ⓘ ${rec.impact}</p>
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
