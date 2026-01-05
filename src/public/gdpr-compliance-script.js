// GDPR Compliance Scanner Script
// Uses AnalyzerLoader for consistent loading UI

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
      GDPR compliance scan in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(0, 255, 65, 0.7); padding: 0 0.5rem;">
      This may take 30-45 seconds
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
  
  loader.start(analysisSteps, '[GDPR COMPLIANCE SCANNER]', 40);
  
  // Insert patience message after loader content
  const loadingContainer = document.getElementById('loadingContainer');
  const analyzerLoading = loadingContainer.querySelector('.analyzer-loading');
  if (analyzerLoading) {
    analyzerLoading.insertBefore(loaderMessageEl, analyzerLoading.firstChild);
  }
  
  try {
    loader.nextStep(1);
    
    const response = await fetch('/api/gdpr-compliance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
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

function displayResults(data) {
  const results = document.getElementById('results');
  
  results.innerHTML = `
    <div class="score-banner" style="background: linear-gradient(135deg, ${getColor(data.grade)} 0%, ${getColor(data.grade)}dd 100%);">
      <div class="score-value">${data.score}</div>
      <div class="score-grade">Grade: ${data.grade}</div>
      <div class="score-label">GDPR Compliance Score</div>
      <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${data.complianceLevel}</p>
    </div>
    
    ${data.risks.length > 0 ? `
      <section class="section">
        <h2>⚠️ Compliance Risks (${data.risks.length})</h2>
        ${data.risks.map(risk => `
          <div style="padding: 1rem; margin: 0.5rem 0; background: ${risk.severity === 'critical' ? 'rgba(255,75,75,0.15)' : 'rgba(255,140,0,0.15)'}; border-left: 4px solid ${risk.severity === 'critical' ? '#ff4444' : '#ff8c00'}; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5rem;">
              <h3 style="margin: 0; color: ${risk.severity === 'critical' ? '#ff4444' : '#ff8c00'};">${risk.risk}</h3>
              <span style="background: rgba(0,0,0,0.3); padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.85rem; text-transform: uppercase;">${risk.severity}</span>
            </div>
            <p style="margin: 0.5rem 0;">${risk.detail}</p>
            <p style="margin: 0.5rem 0 0 0; font-style: italic; color: var(--text-secondary);">💶 Potential Fine: ${risk.fine}</p>
          </div>
        `).join('')}
      </section>
    ` : ''}
    
    <section class="section">
      <h2>🍪 Cookie & Privacy Analysis</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${data.compliance.cookies.count}</div>
          <div class="stat-label">Cookies Found</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.compliance.trackers.count}</div>
          <div class="stat-label">Third-Party Trackers</div>
        </div>
      </div>
      
      <h3 style="margin-top: 1.5rem;">Compliance Checks:</h3>
      <div style="display: grid; gap: 0.5rem;">
        ${renderItem('Cookie Consent Banner', data.compliance.cookieConsent.detected)}
        ${renderItem('Privacy Policy Link', data.compliance.privacyPolicy.hasLink)}
        ${renderItem('Known Cookie Library', data.compliance.cookieConsent.hasKnownLibrary)}
      </div>
      
      ${data.compliance.trackers.detected.length > 0 ? `
        <h3 style="margin-top: 1.5rem;">Detected Trackers:</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${data.compliance.trackers.detected.map(tracker => `
            <span style="background: rgba(255,140,0,0.1); padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid rgba(255,140,0,0.3); font-size: 0.85rem;">
              ${tracker}
            </span>
          `).join('')}
        </div>
      ` : ''}
    </section>
    
    ${data.recommendations.length > 0 ? `
      <section class="section">
        <h2>💡 Recommendations</h2>
        ${data.recommendations.map(rec => `
          <div style="padding: 1rem; margin: 0.5rem 0; background: ${rec.priority === 'critical' ? 'rgba(255,75,75,0.1)' : 'rgba(255,215,0,0.1)'}; border-left: 4px solid ${rec.priority === 'critical' ? '#ff4444' : '#ffd700'}; border-radius: 4px;">
            <h3 style="margin: 0 0 0.5rem 0;">${rec.message}</h3>
            <p style="margin: 0.5rem 0;">${rec.detail}</p>
            <p style="margin: 0.5rem 0 0 0; font-style: italic; font-size: 0.9rem;">💡 ${rec.impact}</p>
          </div>
        `).join('')}
      </section>
    ` : ''}
  `;
}

function renderItem(label, hasIt) {
  return `
    <div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.03); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
      <span>${label}</span>
      <span style="color: ${hasIt ? '#00ff41' : '#ff4444'}; font-weight: bold;">${hasIt ? '✅' : '❌'}</span>
    </div>
  `;
}

function getColor(grade) {
  return { 'A': '#00ff41', 'B': '#ffd700', 'C': '#ff8c00', 'F': '#ff4444' }[grade] || '#888';
}
