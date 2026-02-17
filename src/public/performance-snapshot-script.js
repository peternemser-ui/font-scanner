/**
 * Performance Snapshot Script
 * Fast performance analysis without full Lighthouse
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'performance-snapshot';

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const results = document.getElementById('results');
  const loadingMessage = document.getElementById('loadingMessage');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');

  // Handle analysis
  analyzeButton.addEventListener('click', analyzeUrl);
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') analyzeUrl();
  });

  // Check for URL in query params
  const params = new URLSearchParams(window.location.search);
  const urlParam = params.get('url');
  if (urlParam) {
    urlInput.value = urlParam;
    analyzeUrl();
  }

  async function analyzeUrl() {
    const url = urlInput.value.trim();
    if (!url) {
      showError(t('reports.common.enterValidUrl', 'Please enter a valid URL'));
      return;
    }

    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    // Show loading
    results.classList.remove('hidden');
    loadingMessage.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;

    try {
      updateProgress(10, t('reports.common.connectingToWebsite', 'Connecting to website...'));

      const token = localStorage.getItem('sm_auth_token') || localStorage.getItem('sm_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/performance-snapshot', {
        method: 'POST',
        headers,
        body: JSON.stringify({ url, scanStartedAt, lang: window.i18n?.getActiveLocale?.() || document.documentElement.lang || 'en' })
      });

      updateProgress(50, t('reports.performance.analyzingPerformance', 'Analyzing performance...'));

      if (!response.ok) {
        const error = await response.json();
        if (error.code === 'SCAN_QUOTA_EXCEEDED') {
          const limit = error.scansLimit || 10;
          loadingMessage.classList.add('hidden');
          showError(t('errors.scanQuotaExceeded', 'Daily scan limit reached ({{limit}} scans). Upgrade to Pro for unlimited scans.').replace('{{limit}}', limit));
          if (window.PricingModal && typeof window.PricingModal.open === 'function') {
            window.PricingModal.open();
          }
          return;
        }
        throw new Error(error.message || error.error || t('reports.common.analysisFailed', 'Analysis failed'));
      }

      const data = await response.json();
      updateProgress(100, t('reports.common.complete', 'Complete!'));

      setTimeout(() => {
        loadingMessage.classList.add('hidden');
        displayResults(data);
        window.__REPORT_READY__ = true;
        window.dispatchEvent(new CustomEvent('report:ready'));
      }, 500);

    } catch (error) {
      loadingMessage.classList.add('hidden');
      showError(error.message);
    } finally {
      analyzeButton.disabled = false;
    }
  }

  function updateProgress(percent, text) {
    progressBar.style.width = `${percent}%`;
    progressText.textContent = text;
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function displayResults(data) {
    const summary = data.summary || {};
    const resources = data.resources || {};
    const issues = data.issues || [];
    const recommendations = data.recommendations || {};

    const html = `
      <!-- Score Overview -->
      <div class="score-section" style="text-align: center; margin-bottom: 2rem;">
        <h2 style="margin-bottom: 1rem;">${t('reports.performance.performanceScore', 'Performance Score')}</h2>
        <div class="score-circle" style="
          width: 120px; height: 120px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 2.5rem; font-weight: bold; margin: 0 auto;
          border: 4px solid ${getScoreColor(data.performanceScore)};
          color: ${getScoreColor(data.performanceScore)};
        ">
          ${data.performanceScore || 0}
        </div>
        <p style="margin-top: 1rem; color: var(--r-text-faint, #9CA3AF);">
          ${data.pagesScanned || 1} ${t('reports.performance.pagesAnalyzed', 'page(s) analyzed')}
        </p>
      </div>

      <!-- Key Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div class="metric-card">
          <div class="metric-value" style="color: ${getMetricColor(summary.totalRequests, 50, 100)}">${summary.totalRequests || 0}</div>
          <div class="metric-label">${t('reports.performance.totalRequests', 'Total Requests')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color: ${getMetricColor(summary.estimatedPageWeightKB, 1000, 3000)}">${formatKB(summary.estimatedPageWeightKB)}</div>
          <div class="metric-label">${t('reports.performance.pageWeight', 'Page Weight (KB)')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color: ${getMetricColor(summary.renderBlockingCount, 3, 5)}">${summary.renderBlockingCount || 0}</div>
          <div class="metric-label">${t('reports.performance.renderBlocking', 'Render Blocking')}</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color: ${getMetricColor(summary.serverResponseTime, 500, 1000)}">${summary.serverResponseTime || 0}ms</div>
          <div class="metric-label">${t('reports.performance.serverResponse', 'Server Response')}</div>
        </div>
      </div>

      <!-- Likely Causes -->
      ${recommendations.likelyCauses && recommendations.likelyCauses.length > 0 ? `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 2rem;">
          <h3 style="color: #ef4444; margin: 0 0 0.5rem 0;">🔍 ${t('reports.performance.likelyPerformanceIssues', 'Likely Performance Issues')}</h3>
          <ul style="margin: 0; padding-left: 1.5rem;">
            ${recommendations.likelyCauses.map(cause => `<li style="color: #f87171;">${cause}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      <!-- Resource Breakdown -->
      <div style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">📊 ${t('reports.performance.resourceBreakdown', 'Resource Breakdown')}</h3>
        <div style="display: grid; gap: 0.5rem;">
          
          <!-- CSS -->
          ${resources.css ? `
            <details class="resource-details">
              <summary class="resource-summary">
                <span class="resource-badge resource-css">CSS</span>
                <span style="font-weight: bold;">${resources.css.totalFiles || 0} ${t('reports.performance.external', 'external')}, ${resources.css.totalInline || 0} ${t('reports.performance.inline', 'inline')}</span>
                <span style="font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.estimated', 'Estimated')}: ${formatKB(resources.css.estimatedSizeKB)}</span>
              </summary>
              <div class="resource-details-content">
                ${(resources.css.files || []).length > 0 ? `
                  <table class="resource-table">
                    <thead><tr><th>${t('reports.performance.url', 'URL')}</th><th>${t('reports.performance.media', 'Media')}</th></tr></thead>
                    <tbody>
                      ${(resources.css.files || []).map(f => `
                        <tr><td class="url-cell">${truncateUrl(f.url)}</td><td>${f.media || 'all'}</td></tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : '<p style="color: var(--r-text-faint, #9CA3AF); padding: 0.5rem;">' + t('reports.performance.noExternalCssFiles', 'No external CSS files') + '</p>'}
              </div>
            </details>
          ` : ''}
          
          <!-- JavaScript -->
          ${resources.js ? `
            <details class="resource-details">
              <summary class="resource-summary">
                <span class="resource-badge resource-js">JavaScript</span>
                <span style="font-weight: bold;">${resources.js.totalFiles || 0} ${t('reports.performance.external', 'external')}, ${resources.js.totalInline || 0} ${t('reports.performance.inline', 'inline')}</span>
                <span style="font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.async', 'Async')}: ${(resources.js.async || []).length} | ${t('reports.performance.defer', 'Defer')}: ${(resources.js.defer || []).length}</span>
              </summary>
              <div class="resource-details-content">
                ${(resources.js.files || []).length > 0 ? `
                  <table class="resource-table">
                    <thead><tr><th>${t('reports.performance.url', 'URL')}</th><th>${t('reports.performance.async', 'Async')}</th><th>${t('reports.performance.defer', 'Defer')}</th><th>${t('reports.performance.location', 'Location')}</th></tr></thead>
                    <tbody>
                      ${(resources.js.files || []).map(f => `
                        <tr>
                          <td class="url-cell">${truncateUrl(f.url)}</td>
                          <td>${f.async ? '✓' : '—'}</td>
                          <td>${f.defer ? '✓' : '—'}</td>
                          <td>${f.location || 'body'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                ` : '<p style="color: var(--r-text-faint, #9CA3AF); padding: 0.5rem;">' + t('reports.performance.noExternalJsFiles', 'No external JavaScript files') + '</p>'}
              </div>
            </details>
          ` : ''}
          
          <!-- Images -->
          ${resources.images ? `
            <details class="resource-details">
              <summary class="resource-summary">
                <span class="resource-badge resource-image">${t('reports.performance.imagesLabel', 'Images')}</span>
                <span style="font-weight: bold;">${resources.images.total || 0} ${t('reports.performance.images', 'Images')}</span>
                <span style="font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.missingAlt', 'Missing alt')}: ${resources.images.withoutAlt || 0} | ${t('reports.performance.lazy', 'Lazy')}: ${resources.images.lazyLoaded || 0}</span>
              </summary>
              <div class="resource-details-content">
                ${resources.images.formats && Object.keys(resources.images.formats).length > 0 ? `
                  <table class="resource-table">
                    <thead><tr><th>${t('reports.performance.format', 'Format')}</th><th>${t('reports.performance.count', 'Count')}</th><th>${t('reports.performance.percentOfTotal', '% of Total')}</th></tr></thead>
                    <tbody>
                      ${Object.entries(resources.images.formats)
                        .filter(([format]) => ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'ico', 'bmp', 'tiff', 'dynamic'].includes(format.toLowerCase()))
                        .sort((a, b) => b[1] - a[1])
                        .map(([format, count]) => `
                          <tr>
                            <td style="text-transform: uppercase; font-weight: bold;">${format}</td>
                            <td>${count}</td>
                            <td>${((count / (resources.images.total || 1)) * 100).toFixed(1)}%</td>
                          </tr>
                        `).join('')}
                    </tbody>
                  </table>
                ` : '<p style="color: var(--r-text-faint, #9CA3AF); padding: 0.5rem;">' + t('reports.performance.noImageFormatData', 'No image format data') + '</p>'}
              </div>
            </details>
          ` : ''}
          
          <!-- Third-Party -->
          ${resources.thirdParty ? `
            <details class="resource-details">
              <summary class="resource-summary">
                <span class="resource-badge resource-third-party">${t('reports.performance.thirdParty', 'Third-Party')}</span>
                <span style="font-weight: bold;">${resources.thirdParty.count || 0} ${t('reports.performance.resources', 'resources')}</span>
              </summary>
              <div class="resource-details-content">
                ${resources.thirdParty.categories && Object.keys(resources.thirdParty.categories).length > 0 ? `
                  <table class="resource-table">
                    <thead><tr><th>${t('reports.performance.category', 'Category')}</th><th>${t('reports.performance.count', 'Count')}</th></tr></thead>
                    <tbody>
                      ${Object.entries(resources.thirdParty.categories)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, count]) => `
                          <tr><td>${cat}</td><td>${count}</td></tr>
                        `).join('')}
                    </tbody>
                  </table>
                  ${(resources.thirdParty.domains || []).length > 0 ? `
                    <div style="margin-top: 1rem;">
                      <strong style="font-size: 0.85rem;">${t('reports.performance.domains', 'Domains')}:</strong>
                      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                        ${(resources.thirdParty.domains || []).slice(0, 20).map(d => `
                          <span style="background: rgba(236, 72, 153, 0.15); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem;">${d}</span>
                        `).join('')}
                        ${(resources.thirdParty.domains || []).length > 20 ? `<span style="color: var(--r-text-faint, #9CA3AF); font-size: 0.75rem;">+${resources.thirdParty.domains.length - 20} ${t('reports.common.more', 'more')}</span>` : ''}
                      </div>
                    </div>
                  ` : ''}
                ` : '<p style="color: var(--r-text-faint, #9CA3AF); padding: 0.5rem;">' + t('reports.performance.noThirdPartyResources', 'No third-party resources detected') + '</p>'}
              </div>
            </details>
          ` : ''}
          
          <!-- Fonts -->
          ${resources.fonts ? `
            <details class="resource-details">
              <summary class="resource-summary">
                <span class="resource-badge resource-font">${t('reports.performance.fonts', 'Fonts')}</span>
                <span style="font-weight: bold;">${resources.fonts.preloaded || 0} ${t('reports.performance.preloaded', 'preloaded')}</span>
                <span style="font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">${t('reports.performance.missingFontDisplay', 'Missing font-display')}: ${resources.fonts.withoutDisplay || 0}</span>
              </summary>
              <div class="resource-details-content">
                ${(resources.fonts.providers || []).length > 0 ? `
                  <table class="resource-table">
                    <thead><tr><th>${t('reports.performance.provider', 'Provider')}</th></tr></thead>
                    <tbody>
                      ${(resources.fonts.providers || []).map(p => `<tr><td>${p}</td></tr>`).join('')}
                    </tbody>
                  </table>
                ` : '<p style="color: var(--r-text-faint, #9CA3AF); padding: 0.5rem;">' + t('reports.performance.noFontProviders', 'No font providers detected') + '</p>'}
                ${(resources.fonts.issues || []).length > 0 ? `
                  <div style="margin-top: 1rem;">
                    <strong style="font-size: 0.85rem; color: #f59e0b;">${t('reports.common.issues', 'issues')}:</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem; padding: 0;">
                      ${resources.fonts.issues.map(i => `<li style="font-size: 0.85rem;">${i.message}</li>`).join('')}
                    </ul>
                  </div>
                ` : ''}
              </div>
            </details>
          ` : ''}
        </div>
      </div>

      <!-- Issues -->
      ${issues.length > 0 ? `
        <div style="margin-bottom: 2rem;">
          <h3 style="margin-bottom: 1rem;">⚠️ ${t('reports.common.issuesDetected', '{{count}} issues detected')} (${issues.length})</h3>
          ${issues.map(issue => `
            <div class="issue-card ${issue.severity === 'warning' ? 'warning' : issue.severity === 'info' ? 'info' : ''}">
              <div style="font-weight: bold; color: ${issue.severity === 'high' ? '#ef4444' : issue.severity === 'warning' ? '#f59e0b' : '#3b82f6'};">
                ${issue.title || issue.type || t('reports.common.issue', 'issue')}
              </div>
              <p style="margin: 0.5rem 0 0 0; color: var(--r-text-muted, #6B7280); font-size: 0.9rem;">${issue.message || issue.description || ''}</p>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 2rem;">
          <h3 style="color: #10b981; margin: 0;">✅ ${t('reports.performance.noMajorIssues', 'No Major Performance Issues')}</h3>
        </div>
      `}

      <!-- Recommendations -->
      ${recommendations.recommendations && recommendations.recommendations.length > 0 ? `
        <div style="margin-bottom: 2rem;">
          <h3 style="margin-bottom: 1rem;">💡 ${t('reports.common.recommendations', 'Recommendations')}</h3>
          ${recommendations.recommendations.map(rec => `
            <div style="background: rgba(16, 185, 129, 0.05); border-left: 3px solid ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#10b981'}; padding: 1rem; margin-bottom: 0.5rem; border-radius: 0 4px 4px 0;">
              <div style="font-weight: bold; color: ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#10b981'};">${rec.title}</div>
              <p style="margin: 0.5rem 0; color: var(--r-text-muted, #6B7280);">${rec.description}</p>
              ${rec.impact ? `<p style="margin: 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">📈 ${t('reports.common.impact', 'Impact')}: ${rec.impact}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Quick Wins -->
      <div style="margin-bottom: 2rem;">
        <h3 style="margin-bottom: 1rem;">⚡ ${t('reports.performance.quickWins', 'Quick Performance Wins')}</h3>
        <div style="display: grid; gap: 0.5rem;">
          ${summary.renderBlockingCount > 0 ? `
            <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 4px;">
              <div style="font-weight: bold; margin-bottom: 0.5rem;">1. ${t('reports.performance.eliminateRenderBlocking', 'Eliminate Render-Blocking Resources')}</div>
              <code style="display: block; background: var(--r-surface-2, #F8FAFC); padding: 0.5rem; border-radius: 4px; font-size: 0.8rem; overflow-x: auto;">
&lt;script src="app.js" defer&gt;&lt;/script&gt;
&lt;link rel="preload" href="styles.css" as="style" onload="this.rel='stylesheet'"&gt;
              </code>
            </div>
          ` : ''}
          ${resources.images && resources.images.missingAlt > 0 ? `
            <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 4px;">
              <div style="font-weight: bold; margin-bottom: 0.5rem;">2. ${t('reports.performance.addLazyLoading', 'Add Lazy Loading to Images')}</div>
              <code style="display: block; background: var(--r-surface-2, #F8FAFC); padding: 0.5rem; border-radius: 4px; font-size: 0.8rem;">
&lt;img src="image.jpg" loading="lazy" alt="Description"&gt;
              </code>
            </div>
          ` : ''}
          <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 4px;">
            <div style="font-weight: bold; margin-bottom: 0.5rem;">3. ${t('reports.performance.enableCompression', 'Enable Compression')}</div>
            <p style="margin: 0; font-size: 0.85rem; color: var(--r-text-faint, #9CA3AF);">
              ${t('reports.performance.enableCompressionDesc', 'Enable Gzip/Brotli compression on your server to reduce file sizes by 70-90%.')}
            </p>
          </div>
        </div>
      </div>
    `;

    resultsContent.innerHTML = html;

    // Dispatch report:ready for PDF export and ReportJump triggers
    window.__REPORT_READY__ = true;
    window.dispatchEvent(new CustomEvent('report:ready'));
  }

  function getScoreColor(score) {
    const stops = [
      [0,'#E53935'],[5,'#E14127'],[10,'#DD4E1A'],[15,'#DA5B0E'],
      [20,'#D96A06'],[25,'#E07E00'],[30,'#E89200'],[35,'#F0A400'],
      [40,'#F5B300'],[45,'#FAC200'],[50,'#FFD000'],[55,'#FFD600'],
      [60,'#FFDC00'],[65,'#FFE100'],[70,'#F0DD00'],[75,'#D2D400'],
      [80,'#A0C800'],[85,'#6BBD28'],[90,'#38B249'],[95,'#1FAD4F'],
      [100,'#0AA64F']
    ];
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const idx = Math.min(Math.floor(s / 5), 19);
    const [s1, c1] = stops[idx];
    const [, c2] = stops[Math.min(idx + 1, 20)];
    const t = (s - s1) / 5;
    const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r1,g1,b1] = p(c1);
    const [r2,g2,b2] = p(c2);
    const r = Math.round(r1+(r2-r1)*t);
    const g = Math.round(g1+(g2-g1)*t);
    const b = Math.round(b1+(b2-b1)*t);
    return '#' + r.toString(16).padStart(2,'0') + g.toString(16).padStart(2,'0') + b.toString(16).padStart(2,'0');
  }

  function getMetricColor(value, warnThreshold, badThreshold) {
    if (value === undefined || value === null) return '#888';
    if (value <= warnThreshold) return '#10b981';
    if (value <= badThreshold) return '#f59e0b';
    return '#ef4444';
  }

  function formatKB(kb) {
    if (!kb) return '0';
    if (kb >= 1024) return (kb / 1024).toFixed(1) + ' ' + t('reports.common.mb', 'MB');
    return Math.round(kb) + ' ' + t('reports.common.kb', 'KB');
  }

  function truncateUrl(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      if (path.length > 60) {
        return parsed.hostname + path.substring(0, 50) + '...';
      }
      return parsed.hostname + path;
    } catch {
      if (url.length > 70) return url.substring(0, 60) + '...';
      return url;
    }
  }
});
