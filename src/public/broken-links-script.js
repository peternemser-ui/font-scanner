// Broken Links Analyzer Script

document.getElementById('analyzeBtn').addEventListener('click', analyzeLinks);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeLinks();
});

async function analyzeLinks() {
  const url = document.getElementById('url').value.trim();
  const maxPages = parseInt(document.getElementById('maxPages').value);
  const maxDepth = parseInt(document.getElementById('maxDepth').value);
  const followExternal = document.getElementById('followExternal').checked;
  
  if (!url) {
    alert('Please enter a URL');
    return;
  }
  
  const loading = document.getElementById('loadingIndicator');
  const results = document.getElementById('results');
  const btn = document.getElementById('analyzeBtn');
  
  loading.style.display = 'block';
  results.style.display = 'none';
  btn.disabled = true;
  
  try {
    const response = await fetch('/api/broken-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, maxPages, maxDepth, followExternal })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Analysis failed');
    }
    
    const data = await response.json();
    displayResults(data);
    
    loading.style.display = 'none';
    results.style.display = 'block';
    
  } catch (error) {
    alert(`Error: ${error.message}`);
    loading.style.display = 'none';
  } finally {
    btn.disabled = false;
  }
}

function displayResults(data) {
  const html = `
    <div class="score-banner" style="background: linear-gradient(135deg, ${getGradeColor(data.grade)} 0%, ${getGradeColor(data.grade)}dd 100%);">
      <div class="score-value">${data.score}</div>
      <div class="score-grade">Grade: ${data.grade}</div>
      <div class="score-label">Link Health Score</div>
      <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">Scanned ${data.pagesScanned} pages in ${data.analysisTime}s</p>
    </div>
    
    ${renderSummary(data.summary)}
    ${renderBrokenLinks(data.links.broken)}
    ${renderRedirects(data.links.redirects)}
    ${renderRecommendations(data.recommendations)}
  `;
  
  document.getElementById('results').innerHTML = html;
}

function renderSummary(summary) {
  return `
    <section class="section">
      <h2>C Summary</h2>
      <div class="stats-grid">
        <div class="stat-card" style="border-left: 4px solid ${summary.broken > 0 ? '#ff4444' : '#00ff41'}">
          <div class="stat-value" style="color: ${summary.broken > 0 ? '#ff4444' : '#00ff41'}">${summary.broken}</div>
          <div class="stat-label">Broken Links</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid ${summary.redirects > 5 ? '#ff8c00' : '#ffd700'}">
          <div class="stat-value" style="color: ${summary.redirects > 5 ? '#ff8c00' : '#ffd700'}">${summary.redirects}</div>
          <div class="stat-label">Redirects</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #00ff41">
          <div class="stat-value" style="color: #00ff41">${summary.working}</div>
          <div class="stat-label">Working Links</div>
        </div>
        <div class="stat-card" style="border-left: 4px solid #0096ff">
          <div class="stat-value" style="color: #0096ff">${summary.external}</div>
          <div class="stat-label">External Links</div>
        </div>
      </div>
    </section>
  `;
}

function renderBrokenLinks(broken) {
  if (!broken || broken.length === 0) {
    return `
      <section class="section">
        <h2>✓ No Broken Links Found!</h2>
        <p style="color: #00ff41;">Great job! All your links are working correctly.</p>
      </section>
    `;
  }
  
  return `
    <section class="section">
      <h2>✗ Broken Links (${broken.length})</h2>
      <div style="overflow-x: auto;">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Broken URL</th>
              <th>Status Code</th>
              <th>Found On</th>
              <th>Link Text</th>
            </tr>
          </thead>
          <tbody>
            ${broken.slice(0, 50).map(link => `
              <tr>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">
                  <a href="${link.url}" target="_blank" style="color: #ff4444;">${link.url}</a>
                </td>
                <td><span style="background: rgba(255,75,75,0.2); padding: 0.25rem 0.5rem; border-radius: 4px;">${link.statusCode || 'N/A'}</span></td>
                <td style="font-size: 0.85rem;">${link.foundOn.length} page(s)</td>
                <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${link.text || 'No text'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${broken.length > 50 ? `<p style="margin-top: 1rem; color: var(--text-secondary);">Showing first 50 of ${broken.length} broken links</p>` : ''}
      </div>
    </section>
  `;
}

function renderRedirects(redirects) {
  if (!redirects || redirects.length === 0) return '';
  
  return `
    <section class="section">
      <h2>↪️ Redirects (${redirects.length})</h2>
      <p style="color: var(--text-secondary); margin-bottom: 1rem;">Update these links to point directly to their destination to improve page speed.</p>
      <div style="overflow-x: auto;">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Original URL</th>
              <th>Status</th>
              <th>Redirects To</th>
              <th>Found On</th>
            </tr>
          </thead>
          <tbody>
            ${redirects.slice(0, 30).map(link => `
              <tr>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis;">
                  <a href="${link.url}" target="_blank">${link.url}</a>
                </td>
                <td><span style="background: rgba(255,215,0,0.2); padding: 0.25rem 0.5rem; border-radius: 4px;">${link.statusCode}</span></td>
                <td style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; font-size: 0.85rem;">
                  ${link.redirectChain.length > 0 ? link.redirectChain[0] : 'Unknown'}
                </td>
                <td style="font-size: 0.85rem;">${link.foundOn.length} page(s)</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${redirects.length > 30 ? `<p style="margin-top: 1rem; color: var(--text-secondary);">Showing first 30 of ${redirects.length} redirects</p>` : ''}
      </div>
    </section>
  `;
}

function renderRecommendations(recommendations) {
  if (!recommendations || recommendations.length === 0) return '';
  
  return `
    <section class="section">
      <h2>T Recommendations</h2>
      <div style="display: grid; gap: 1rem;">
        ${recommendations.map(rec => `
          <div class="insight-card ${rec.priority === 'critical' ? 'insight-critical' : rec.priority === 'high' ? 'insight-warning' : 'insight-success'}" style="padding: 1rem; border-radius: 8px; border-left: 4px solid;">
            <h3 style="margin: 0 0 0.5rem 0;">${rec.message}</h3>
            <p style="margin: 0.5rem 0; color: var(--text-secondary);">${rec.detail}</p>
            <p style="margin: 0.5rem 0 0 0; font-style: italic; font-size: 0.9rem;">ⓘ Impact: ${rec.impact}</p>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function getGradeColor(grade) {
  const colors = {
    'A': '#00ff41',
    'B': '#ffd700',
    'C': '#ff8c00',
    'D': '#ff4444',
    'F': '#ff4444'
  };
  return colors[grade] || '#888';
}
