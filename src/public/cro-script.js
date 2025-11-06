// CRO Analyzer Script

document.getElementById('analyzeBtn').addEventListener('click', analyzeCRO);
document.getElementById('url').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') analyzeCRO();
});

async function analyzeCRO() {
  const url = document.getElementById('url').value.trim();
  
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
    const response = await fetch('/api/cro-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
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
      <div class="score-value">${data.overallScore}</div>
      <div class="score-grade">Grade: ${data.grade}</div>
      <div class="score-label">Conversion Optimization Score</div>
      <p style="margin: 0.5rem 0 0 0; font-size: 0.9rem;">${data.conversionPotential}</p>
    </div>
    
    ${renderScoreBreakdown(data.scores)}
    ${renderCTAAnalysis(data.analysis.ctas)}
    ${renderFormAnalysis(data.analysis.forms)}
    ${renderTrustSignals(data.analysis.trustSignals)}
    ${renderMobileUX(data.analysis.mobileUX)}
    ${renderRecommendations(data.recommendations)}
  `;
  
  document.getElementById('results').innerHTML = html;
}

function renderScoreBreakdown(scores) {
  return `
    <section class="section">
      <h2>C Score Breakdown</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" style="color: ${getScoreColor(scores.cta)}">${scores.cta}</div>
          <div class="stat-label">Call-to-Action</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: ${getScoreColor(scores.form)}">${scores.form}</div>
          <div class="stat-label">Forms</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: ${getScoreColor(scores.trust)}">${scores.trust}</div>
          <div class="stat-label">Trust Signals</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: ${getScoreColor(scores.mobile)}">${scores.mobile}</div>
          <div class="stat-label">Mobile UX</div>
        </div>
      </div>
    </section>
  `;
}

function renderCTAAnalysis(ctas) {
  return `
    <section class="section">
      <h2>T Call-to-Action Analysis</h2>
      <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="stat-card">
          <div class="stat-value">${ctas.count}</div>
          <div class="stat-label">Total CTAs</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #00ff41">${ctas.visible}</div>
          <div class="stat-label">Above the Fold</div>
        </div>
      </div>
      ${ctas.examples.length > 0 ? `
        <h3 style="margin-top: 1.5rem;">CTA Examples:</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          ${ctas.examples.map(text => `
            <span style="background: rgba(0, 255, 65, 0.1); padding: 0.5rem 1rem; border-radius: 4px; border: 1px solid rgba(0, 255, 65, 0.3);">
              ${text}
            </span>
          `).join('')}
        </div>
      ` : ''}
    </section>
  `;
}

function renderFormAnalysis(forms) {
  if (forms.count === 0) {
    return `
      <section class="section">
        <h2>📝 Forms</h2>
        <p style="color: #ff4444;">✗ No forms detected. Add a contact or signup form to capture leads.</p>
      </section>
    `;
  }
  
  return `
    <section class="section">
      <h2>📝 Forms (${forms.count})</h2>
      <div style="overflow-x: auto;">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Form #</th>
              <th>Fields</th>
              <th>Has Email</th>
              <th>Has Phone</th>
              <th>Validation</th>
              <th>Autocomplete</th>
            </tr>
          </thead>
          <tbody>
            ${forms.details.map((form, idx) => `
              <tr>
                <td>Form ${idx + 1}</td>
                <td>${form.fieldCount}</td>
                <td>${form.hasEmail ? '✓' : '✗'}</td>
                <td>${form.hasPhone ? '✓' : '✗'}</td>
                <td>${form.hasValidation ? '✓' : '✗'}</td>
                <td>${form.hasAutocomplete ? '✓' : '✗'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderTrustSignals(trust) {
  return `
    <section class="section">
      <h2>◈ Trust Signals</h2>
      <div style="display: grid; gap: 0.5rem;">
        ${renderTrustItem('SSL Certificate', trust.hasSSL)}
        ${renderTrustItem('Testimonials', trust.hasTestimonials)}
        ${renderTrustItem('Social Proof', trust.hasSocialProof)}
        ${renderTrustItem('Contact Information', trust.hasContactInfo)}
        ${renderTrustItem('Privacy Policy', trust.hasPrivacyPolicy)}
        ${renderTrustItem('Security Badges', trust.hasSecurityBadges)}
      </div>
    </section>
  `;
}

function renderTrustItem(label, hasIt) {
  return `
    <div style="padding: 0.75rem; background: rgba(255, 255, 255, 0.03); border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
      <span>${label}</span>
      <span style="color: ${hasIt ? '#00ff41' : '#ff4444'}; font-weight: bold;">${hasIt ? '✓' : '✗'}</span>
    </div>
  `;
}

function renderMobileUX(mobile) {
  const tapTargetPercent = (mobile.tapTargetCompliance * 100).toFixed(1);
  return `
    <section class="section">
      <h2>M Mobile UX</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" style="color: ${mobile.tapTargetCompliance > 0.7 ? '#00ff41' : '#ff4444'}">${tapTargetPercent}%</div>
          <div class="stat-label">Tap Target Compliance</div>
          <div class="stat-sublabel">44x44 pixels minimum</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: ${mobile.avgFontSize >= 16 ? '#00ff41' : '#ff8c00'}">${mobile.avgFontSize.toFixed(1)}px</div>
          <div class="stat-label">Average Font Size</div>
          <div class="stat-sublabel">16px minimum recommended</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: ${mobile.hasViewportMeta ? '#00ff41' : '#ff4444'}">${mobile.hasViewportMeta ? '✓' : '✗'}</div>
          <div class="stat-label">Viewport Meta Tag</div>
        </div>
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
            <p style="margin: 0.5rem 0 0 0; font-style: italic; font-size: 0.9rem;">ⓘ ${rec.impact}</p>
          </div>
        `).join('')}
      </div>
    </section>
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
