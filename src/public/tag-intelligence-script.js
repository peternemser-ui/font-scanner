/**
 * Tag Intelligence Analyzer Script
 * Detects and analyzes analytics, advertising, and tracking tags
 */

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'tag-intelligence';

document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const urlInput = document.getElementById('urlInput');
  const analyzeButton = document.getElementById('analyzeButton');
  const multiPageOption = document.getElementById('multiPageOption');
  const multiPageOptions = document.getElementById('multiPageOptions');
  const results = document.getElementById('results');
  const loadingContainer = document.getElementById('loadingContainer');
  const resultsContent = document.getElementById('resultsContent');
  const errorMessage = document.getElementById('errorMessage');

  // Initialize AnalyzerLoader
  let loader = null;
  if (typeof AnalyzerLoader !== 'undefined') {
    loader = new AnalyzerLoader('loadingContainer');
  }

  // Define analysis steps
  const analysisSteps = [
    { label: 'Connecting to website', detail: 'Loading page and resources...' },
    { label: 'Detecting tag managers', detail: 'Scanning for GTM, Adobe Launch, Tealium...' },
    { label: 'Analyzing tracking tags', detail: 'Checking analytics and advertising tags...' },
    { label: 'Generating report', detail: 'Compiling results and recommendations...' }
  ];

  // Toggle multi-page options
  multiPageOption.addEventListener('change', () => {
    multiPageOptions.style.display = multiPageOption.checked ? 'block' : 'none';
  });

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
      showError('Please enter a valid URL');
      return;
    }

    // Show loading
    results.classList.remove('hidden');
    resultsContent.innerHTML = '';
    errorMessage.classList.add('hidden');
    analyzeButton.disabled = true;

    if (loader) {
      loader.start(analysisSteps, '🏷️ ANALYZING TAGS', 30);
      
      // Add ASCII art patience message
      addPatienceMessage(loadingContainer);
    }

    // Build options
    const options = {};
    const comprehensiveScan = document.getElementById('comprehensiveScan');
    if (comprehensiveScan && comprehensiveScan.checked) {
      options.comprehensive = true;
      options.includePerformanceImpact = true;
      options.includeDataLayer = true;
      options.includeConsentMode = true;
      options.includeThirdPartyScripts = true;
    }
    if (multiPageOption.checked) {
      options.maxPages = parseInt(document.getElementById('maxPages').value) || 5;
      options.maxDepth = 2;
    }

    try {
      if (loader) loader.nextStep(1);

      const scanStartedAt = new Date().toISOString();
      window.SM_SCAN_STARTED_AT = scanStartedAt;
      document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

      const response = await fetch('/api/tag-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, options, scanStartedAt })
      });

      if (loader) loader.nextStep(3);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Analysis failed');
      }

      const data = await response.json();
      
      if (loader) {
        loader.complete();
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          displayResults(data);
        }, 800);
      } else {
        displayResults(data);
      }

    } catch (error) {
      if (loader) {
        loader.showError(error.message);
        setTimeout(() => {
          loadingContainer.style.display = 'none';
          showError(error.message);
        }, 2000);
      } else {
        showError(error.message);
      }
    } finally {
      analyzeButton.disabled = false;
    }
  }

  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
  }

  function displayResults(data) {
    const url = document.getElementById('url') ? document.getElementById('url').value : (document.getElementById('urlInput') ? document.getElementById('urlInput').value : '');
    const timestamp = new Date().toLocaleString();
    const scoreColor = getScoreColor(data.healthScore);
    
    const html = `
      <!-- SEO-Style Header -->
      <div class="section">
        <h2>[TAG_ANALYSIS_RESULTS]</h2>
        <p>>> url: ${url}</p>
        <p>>> timestamp: ${timestamp}</p>
        
        <div style="
          background: linear-gradient(135deg, rgba(0,255,65,0.05) 0%, rgba(0,255,65,0.02) 100%);
          border: 2px solid ${scoreColor};
          border-radius: 12px;
          padding: 2rem;
          margin: 2rem 0;
          box-shadow: 0 4px 20px rgba(0,255,65,0.15);
        ">
          <h3 style="color: #00ff41; margin: 0 0 1.5rem 0; font-size: 1.3rem;">>> Tag Audit Summary</h3>
          
          <!-- Score Overview -->
          <div class="score-section" style="text-align: center; margin-bottom: 1rem;">
            <div class="score-circle ${getScoreClass(data.healthScore)}" style="
              width: 120px; height: 120px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: 2.5rem; font-weight: bold; margin: 0 auto;
              border: 4px solid ${scoreColor};
              color: ${scoreColor};
            ">
              ${data.healthScore}
            </div>
            <p style="margin-top: 1rem; color: #808080;">
              Scanned ${data.pagesScanned} page(s) • ${data.summary.totalTags} tag(s) detected
            </p>
          </div>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="summary-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        ${Object.entries(data.summary.byCategory).map(([cat, count]) => `
          <div class="stat-card" style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; text-align: center;">
            <span class="tag-badge tag-${cat}">${formatCategory(cat)}</span>
            <div style="font-size: 1.5rem; font-weight: bold; margin-top: 0.5rem;">${count}</div>
          </div>
        `).join('')}
      </div>

      <!-- Charts Section -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Tags by Category Chart -->
        <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px;">
          <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #888;">Tags by Category</h4>
          <canvas id="tagsCategoryChart" style="max-height: 220px;"></canvas>
        </div>
        
        <!-- Script Loading Strategy Chart -->
        ${data.pageResults && data.pageResults[0]?.performanceImpact ? `
          <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px;">
            <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #888;">Script Loading Strategy</h4>
            <canvas id="scriptLoadingChart" style="max-height: 220px;"></canvas>
          </div>
        ` : ''}
        
        <!-- Third-Party Scripts Chart -->
        ${data.pageResults && data.pageResults[0]?.thirdPartyScripts?.total > 0 ? `
          <div style="background: rgba(255,255,255,0.03); padding: 1.5rem; border-radius: 8px;">
            <h4 style="margin: 0 0 1rem 0; font-size: 0.9rem; color: #888;">Third-Party Scripts</h4>
            <canvas id="thirdPartyChart" style="max-height: 220px;"></canvas>
          </div>
        ` : ''}
      </div>

      <!-- Issues Alert -->
      ${data.issues.length > 0 || data.duplicates.length > 0 ? `
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 2rem;">
          <h3 style="color: #ef4444; margin: 0 0 0.5rem 0;">⚠️ Issues Detected</h3>
          <ul style="margin: 0; padding-left: 1.5rem;">
            ${data.duplicates.map(d => `<li class="severity-warning">${d.message}</li>`).join('')}
            ${data.issues.map(i => `<li class="severity-${i.severity}">${i.message}</li>`).join('')}
          </ul>
        </div>
      ` : `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 2rem;">
          <h3 style="color: #10b981; margin: 0;">✅ No Critical Issues Detected</h3>
        </div>
      `}

      <!-- Tags Detected -->
      ${createTagAccordionSection('tags-detected', '🏷️', `Tags Detected (${data.tags.length})`, `
        <div style="padding: 1rem 0;">
          ${data.tags.length === 0 ? '<p style="color: #666;">No analytics or tracking tags detected.</p>' : ''}
          ${data.tags.map(tag => `
            <div class="tag-card" style="margin-bottom: 1rem; padding: 1rem; background: rgba(255,255,255,0.05); border-radius: 8px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <span class="tag-badge tag-${tag.category}">${formatCategory(tag.category)}</span>
                  <strong>${tag.name}</strong>
                </div>
                <div style="color: #808080; font-size: 0.85rem;">
                  ${tag.instances} instance(s) • ${tag.pagesFound ? tag.pagesFound.length : 1} page(s)
                </div>
              </div>
              ${tag.ids && tag.ids.length > 0 ? `
                <div style="margin-top: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #a78bfa;">
                  ID(s): ${tag.ids.join(', ')}
                </div>
              ` : ''}
              <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #666;">
                ${tag.foundInline ? '📝 Found inline' : ''}
                ${tag.foundScript ? '📜 Found in script src' : ''}
              </div>
            </div>
          `).join('')}
        </div>
      `, null)}

      <!-- Tags by Category -->
      ${createTagAccordionSection('tags-by-category', '📊', 'Tags by Category', `
        <div style="padding: 1rem 0;">
          ${Object.entries(data.tagsByCategory).map(([category, tags]) => `
            <div style="margin-bottom: 2rem;">
              <h4 style="margin-bottom: 1rem;">
                <span class="tag-badge tag-${category}">${formatCategory(category)}</span>
                ${tags.length} Tag(s)
              </h4>
              <div style="display: grid; gap: 0.5rem;">
                ${tags.map(t => `
                  <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px;">
                    <span>${t.name}</span>
                    <span style="color: #666;">${t.ids?.join(', ') || 'N/A'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      `, null)}

      <!-- Recommendations -->
      ${data.recommendations && data.recommendations.length > 0 ? createTagAccordionSection('recommendations', '💡', 'Recommendations', `
        <div style="padding: 1rem 0;">
          ${data.recommendations.map(rec => `
            <div style="background: rgba(139, 92, 246, 0.05); border-left: 3px solid ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'}; padding: 1rem; margin-bottom: 0.5rem; border-radius: 0 4px 4px 0;">
              <div style="font-weight: bold; color: ${rec.priority === 'high' ? '#ef4444' : rec.priority === 'medium' ? '#f59e0b' : '#3b82f6'};">${rec.title}</div>
              <p style="margin: 0.5rem 0; color: #ccc;">${rec.description}</p>
              <p style="margin: 0; font-size: 0.85rem; color: #888;">👉 ${rec.action}</p>
            </div>
          `).join('')}
        </div>
      `, null) : ''}

      <!-- Performance Impact -->
      ${data.pageResults && data.pageResults[0]?.performanceImpact ? createTagAccordionSection('performance-impact', '⚡', 'Script Performance Impact', `
        <div style="padding: 1rem 0;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="font-size: 2rem; font-weight: bold; color: ${data.pageResults[0].performanceImpact.score >= 80 ? '#10b981' : data.pageResults[0].performanceImpact.score >= 60 ? '#f59e0b' : '#ef4444'};">
                ${data.pageResults[0].performanceImpact.grade}
              </div>
              <div style="font-size: 0.75rem; color: #888;">Performance Grade</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #3b82f6;">
                ${data.pageResults[0].performanceImpact.stats?.syncScripts || 0}
              </div>
              <div style="font-size: 0.75rem; color: #888;">Blocking Scripts</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">
                ${data.pageResults[0].performanceImpact.stats?.asyncScripts || 0}
              </div>
              <div style="font-size: 0.75rem; color: #888;">Async Scripts</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">
                ${data.pageResults[0].performanceImpact.stats?.deferScripts || 0}
              </div>
              <div style="font-size: 0.75rem; color: #888;">Deferred Scripts</div>
            </div>
          </div>
          ${data.pageResults[0].performanceImpact.issues?.length > 0 ? `
            <div style="margin-top: 1rem;">
              ${data.pageResults[0].performanceImpact.issues.map(issue => `
                <div style="background: rgba(${issue.severity === 'warning' ? '239, 68, 68' : '59, 130, 246'}, 0.1); padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.85rem;">
                  ${issue.severity === 'warning' ? '⚠️' : 'ℹ️'} ${issue.message}
                </div>
              `).join('')}
            </div>
          ` : ''}
          <p style="margin-top: 1rem; color: #888; font-size: 0.85rem;">💡 ${data.pageResults[0].performanceImpact.recommendation}</p>
        </div>
      `, data.pageResults[0].performanceImpact.score) : ''}

      <!-- Third-Party Scripts -->
      ${data.pageResults && data.pageResults[0]?.thirdPartyScripts?.total > 0 ? createTagAccordionSection('third-party-scripts', '🌐', `Third-Party Scripts (${data.pageResults[0].thirdPartyScripts.total})`, `
        <div style="padding: 1rem 0;">
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
            ${Object.entries(data.pageResults[0].thirdPartyScripts.byCategory || {}).map(([cat, count]) => `
              <span style="background: ${getCategoryColor(cat)}; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">
                ${formatScriptCategory(cat)}: ${count}
              </span>
            `).join('')}
          </div>
          <div style="display: grid; gap: 0.5rem;">
            ${data.pageResults[0].thirdPartyScripts.scripts.slice(0, 10).map(script => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px; font-size: 0.85rem;">
                <div>
                  <span style="color: #fff;">${script.name}</span>
                  <span style="color: #666; margin-left: 0.5rem;">${script.host}</span>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                  ${script.async ? '<span style="background: #10b981; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem;">async</span>' : ''}
                  ${script.defer ? '<span style="background: #3b82f6; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem;">defer</span>' : ''}
                  ${!script.async && !script.defer ? '<span style="background: #ef4444; padding: 0.15rem 0.4rem; border-radius: 3px; font-size: 0.7rem;">blocking</span>' : ''}
                  <span style="color: #888;">×${script.count}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `, null) : ''}

      <!-- DataLayer Analysis -->
      ${data.pageResults && data.pageResults[0]?.dataLayer?.found ? createTagAccordionSection('datalayer-analysis', '📊', 'DataLayer Analysis', `
        <div style="padding: 1rem 0;">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div style="text-align: center; padding: 1rem; background: rgba(167, 139, 250, 0.1); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #a78bfa;">
                ${data.pageResults[0].dataLayer.eventCount || 0}
              </div>
              <div style="font-size: 0.75rem; color: #888;">Events Detected</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(${data.pageResults[0].dataLayer.ecommerce ? '16, 185, 129' : '100, 100, 100'}, 0.1); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${data.pageResults[0].dataLayer.ecommerce ? '#10b981' : '#666'};">
                ${data.pageResults[0].dataLayer.ecommerce ? '✓' : '✗'}
              </div>
              <div style="font-size: 0.75rem; color: #888;">Ecommerce Tracking</div>
            </div>
          </div>
          ${data.pageResults[0].dataLayer.events?.length > 0 ? `
            <div style="margin-top: 1rem;">
              <div style="font-size: 0.85rem; color: #888; margin-bottom: 0.5rem;">Events Found:</div>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${data.pageResults[0].dataLayer.events.map(event => `
                  <code style="background: rgba(167, 139, 250, 0.2); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem;">${event}</code>
                `).join('')}
              </div>
            </div>
          ` : ''}
          ${data.pageResults[0].dataLayer.ecommerce ? `
            <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(16, 185, 129, 0.1); border-radius: 4px; font-size: 0.85rem;">
              🛒 <strong>${data.pageResults[0].dataLayer.ecommerce.type}</strong> detected
            </div>
          ` : ''}
        </div>
      `, null) : ''}

      <!-- Consent Mode -->
      ${data.pageResults && data.pageResults[0]?.consentMode ? createTagAccordionSection('consent-mode', '🍪', 'Consent Mode', `
        <div style="padding: 1rem 0;">
          <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
            <div style="width: 60px; height: 60px; border-radius: 50%; background: ${data.pageResults[0].consentMode.implemented ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
              ${data.pageResults[0].consentMode.implemented ? '✓' : '✗'}
            </div>
            <div>
              <div style="font-weight: bold; color: ${data.pageResults[0].consentMode.implemented ? '#10b981' : '#ef4444'};">
                ${data.pageResults[0].consentMode.implemented ? 'Consent Mode Detected' : 'Consent Mode Not Detected'}
              </div>
              <div style="font-size: 0.85rem; color: #888;">${data.pageResults[0].consentMode.recommendation}</div>
            </div>
          </div>
        </div>
      `, null) : ''}

      <!-- Cookie Audit Section -->
      ${data.pageResults && data.pageResults[0]?.cookies?.count > 0 ? createTagAccordionSection('cookie-audit', '🍪', `Cookie Audit (${data.pageResults[0].cookies.count})`, `
        <div style="padding: 1rem 0;">
          <!-- Cookie Compliance Score -->
          <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
            <div style="text-align: center;">
              <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(data.pageResults[0].cookies.complianceScore || 100)};">
                ${data.pageResults[0].cookies.complianceScore || 100}
              </div>
              <div style="font-size: 0.75rem; color: #888;">Compliance Score</div>
            </div>
            <div style="flex: 1;">
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                ${Object.entries(data.pageResults[0].cookies.summary || {}).map(([type, count]) => count > 0 ? `
                  <span style="background: ${getCookieTypeColor(type)}; padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.8rem;">
                    ${formatCookieType(type)}: ${count}
                  </span>
                ` : '').join('')}
              </div>
            </div>
          </div>
          
          <!-- Cookie Issues -->
          ${data.pageResults[0].cookies.issues?.length > 0 ? `
            <div style="margin-bottom: 1rem;">
              ${data.pageResults[0].cookies.issues.map(issue => `
                <div style="background: rgba(${issue.severity === 'high' ? '239, 68, 68' : '245, 158, 11'}, 0.1); padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.85rem; border-left: 3px solid ${issue.severity === 'high' ? '#ef4444' : '#f59e0b'};">
                  <strong>${issue.severity === 'high' ? '⚠️' : '⚡'} ${issue.message}</strong>
                  <p style="margin: 0.25rem 0 0 0; color: #888;">${issue.recommendation}</p>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <!-- Cookie List -->
          <div style="max-height: 400px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
              <thead style="position: sticky; top: 0; background: #1a1a1a;">
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <th style="text-align: left; padding: 0.5rem; color: #888;">Name</th>
                  <th style="text-align: left; padding: 0.5rem; color: #888;">Type</th>
                  <th style="text-align: left; padding: 0.5rem; color: #888;">Vendor</th>
                  <th style="text-align: left; padding: 0.5rem; color: #888;">Purpose</th>
                  <th style="text-align: center; padding: 0.5rem; color: #888;">Secure</th>
                </tr>
              </thead>
              <tbody>
                ${data.pageResults[0].cookies.cookies.slice(0, 30).map(cookie => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.5rem; font-family: monospace; color: #a78bfa;">${cookie.name.substring(0, 25)}${cookie.name.length > 25 ? '...' : ''}</td>
                    <td style="padding: 0.5rem;"><span style="background: ${getCookieTypeColor(cookie.type)}; padding: 0.15rem 0.5rem; border-radius: 3px; font-size: 0.7rem;">${cookie.type}</span></td>
                    <td style="padding: 0.5rem; color: #ccc;">${cookie.vendor || 'Unknown'}</td>
                    <td style="padding: 0.5rem; color: #888; font-size: 0.75rem;">${cookie.purpose || '-'}</td>
                    <td style="padding: 0.5rem; text-align: center;">${cookie.hasSecure ? '✓' : '✗'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${data.pageResults[0].cookies.cookies.length > 30 ? `<p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">... and ${data.pageResults[0].cookies.cookies.length - 30} more cookies</p>` : ''}
          </div>
        </div>
      `, data.pageResults[0].cookies.complianceScore) : ''}

      <!-- A/B Testing & Session Recording -->
      ${renderABTestingSection(data)}

      <!-- Tag Load Waterfall -->
      ${data.pageResults && data.pageResults[0]?.tagLoadWaterfall?.scripts?.length > 0 ? createTagAccordionSection('tag-waterfall', '⏱️', `Tag Load Waterfall (${data.pageResults[0].tagLoadWaterfall.totalScripts} scripts)`, `
        <div style="padding: 1rem 0;">
          <!-- Waterfall Stats -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #3b82f6;">${data.pageResults[0].tagLoadWaterfall.totalLoadTime}ms</div>
              <div style="font-size: 0.75rem; color: #888;">Total Load Time</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: #10b981;">${data.pageResults[0].tagLoadWaterfall.totalSizeFormatted}</div>
              <div style="font-size: 0.75rem; color: #888;">Total Size</div>
            </div>
            <div style="text-align: center; padding: 1rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
              <div style="font-size: 1.5rem; font-weight: bold; color: ${data.pageResults[0].tagLoadWaterfall.blockingCount > 5 ? '#ef4444' : '#10b981'};">${data.pageResults[0].tagLoadWaterfall.blockingCount}</div>
              <div style="font-size: 0.75rem; color: #888;">Blocking Scripts</div>
            </div>
          </div>
          
          <!-- Insights -->
          ${data.pageResults[0].tagLoadWaterfall.insights?.length > 0 ? `
            <div style="margin-bottom: 1.5rem;">
              ${data.pageResults[0].tagLoadWaterfall.insights.map(insight => `
                <div style="background: rgba(${insight.type === 'warning' ? '245, 158, 11' : insight.type === 'good' ? '16, 185, 129' : '59, 130, 246'}, 0.1); padding: 0.75rem; border-radius: 4px; margin-bottom: 0.5rem; font-size: 0.85rem;">
                  ${insight.type === 'warning' ? '⚠️' : insight.type === 'good' ? '✅' : 'ℹ️'} ${insight.message}
                  ${insight.recommendation ? `<span style="color: #888;"> - ${insight.recommendation}</span>` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          <!-- Waterfall Visualization -->
          <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 1rem; overflow-x: auto;">
            <div style="min-width: 600px;">
              ${data.pageResults[0].tagLoadWaterfall.scripts.slice(0, 20).map(script => `
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; font-size: 0.75rem;">
                  <div style="width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #ccc;" title="${script.vendor}">${script.vendor}</div>
                  <div style="flex: 1; height: 20px; background: rgba(255,255,255,0.05); border-radius: 3px; position: relative; overflow: hidden;">
                    <div style="
                      position: absolute;
                      left: ${(script.startTime / data.pageResults[0].tagLoadWaterfall.totalLoadTime) * 100}%;
                      width: ${Math.max((script.duration / data.pageResults[0].tagLoadWaterfall.totalLoadTime) * 100, 2)}%;
                      height: 100%;
                      background: ${getWaterfallColor(script.category)};
                      border-radius: 3px;
                    " title="${script.vendor}: ${script.duration}ms"></div>
                  </div>
                  <div style="width: 60px; text-align: right; color: #888;">${script.duration}ms</div>
                  <div style="width: 50px; text-align: right; color: #666;">${script.sizeFormatted}</div>
                </div>
              `).join('')}
            </div>
            
            <!-- Legend -->
            <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
              <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #3b82f6; border-radius: 2px; margin-right: 4px;"></span>Analytics</span>
              <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #f59e0b; border-radius: 2px; margin-right: 4px;"></span>Advertising</span>
              <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #ec4899; border-radius: 2px; margin-right: 4px;"></span>Session Recording</span>
              <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #8b5cf6; border-radius: 2px; margin-right: 4px;"></span>A/B Testing</span>
              <span style="font-size: 0.7rem; color: #888;"><span style="display: inline-block; width: 12px; height: 12px; background: #6b7280; border-radius: 2px; margin-right: 4px;"></span>Other</span>
            </div>
          </div>
        </div>
      `, null) : ''}

      <!-- Raw Data (collapsible) -->
      <details style="margin-top: 2rem;">
        <summary style="cursor: pointer; color: #888;">📋 View Raw Data</summary>
        <pre style="background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 4px; overflow-x: auto; font-size: 0.75rem; margin-top: 1rem;">
${JSON.stringify(data, null, 2)}
        </pre>
      </details>

      <!-- Pro Report Block -->
      ${window.ProReportBlock && window.ProReportBlock.render ? `
        <div class="section" style="margin-top: 2rem;">
          ${window.ProReportBlock.render({
            context: 'tag-intelligence',
            features: ['pdf', 'csv', 'share'],
            title: 'Unlock Report',
            subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
          })}
        </div>
      ` : ''}
    `;

    resultsContent.innerHTML = '<div class="report-scope">' + html + '</div>';
    
    // Render charts after DOM is updated
    setTimeout(() => renderCharts(data), 100);
  }

  /**
   * Render Chart.js charts
   */
  function renderCharts(data) {
    const chartColors = {
      analytics: '#3b82f6',
      advertising: '#f59e0b',
      tag_manager: '#8b5cf6',
      consent: '#10b981',
      customer_support: '#ec4899',
      marketing: '#ef4444',
      other: '#6b7280'
    };

    // Tags by Category Doughnut Chart
    const categoryCanvas = document.getElementById('tagsCategoryChart');
    if (categoryCanvas && data.summary?.byCategory) {
      const categories = Object.keys(data.summary.byCategory);
      const counts = Object.values(data.summary.byCategory);
      
      new Chart(categoryCanvas, {
        type: 'doughnut',
        data: {
          labels: categories.map(c => formatCategory(c)),
          datasets: [{
            data: counts,
            backgroundColor: categories.map(c => chartColors[c] || '#6b7280'),
            borderWidth: 0,
            hoverOffset: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#888',
                padding: 10,
                font: { size: 11 }
              }
            }
          },
          cutout: '60%'
        }
      });
    }

    // Script Loading Strategy Pie Chart
    const scriptCanvas = document.getElementById('scriptLoadingChart');
    if (scriptCanvas && data.pageResults?.[0]?.performanceImpact?.stats) {
      const stats = data.pageResults[0].performanceImpact.stats;
      
      new Chart(scriptCanvas, {
        type: 'pie',
        data: {
          labels: ['Async', 'Deferred', 'Blocking', 'Inline'],
          datasets: [{
            data: [stats.asyncScripts, stats.deferScripts, stats.syncScripts, stats.inlineScripts],
            backgroundColor: ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: '#888',
                padding: 10,
                font: { size: 11 }
              }
            }
          }
        }
      });
    }

    // Third-Party Scripts Bar Chart
    const thirdPartyCanvas = document.getElementById('thirdPartyChart');
    if (thirdPartyCanvas && data.pageResults?.[0]?.thirdPartyScripts?.byCategory) {
      const byCategory = data.pageResults[0].thirdPartyScripts.byCategory;
      const categories = Object.keys(byCategory);
      const counts = Object.values(byCategory);
      
      const categoryColors = {
        analytics: '#a78bfa',
        advertising: '#ef4444',
        cdn: '#3b82f6',
        library: '#10b981',
        unknown: '#6b7280'
      };
      
      new Chart(thirdPartyCanvas, {
        type: 'bar',
        data: {
          labels: categories.map(c => formatScriptCategory(c).replace(/[^\w\s]/g, '').trim()),
          datasets: [{
            data: counts,
            backgroundColor: categories.map(c => categoryColors[c] || '#6b7280'),
            borderRadius: 4,
            barThickness: 24
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'y',
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: '#888', stepSize: 1 },
              grid: { color: 'rgba(255,255,255,0.05)' }
            },
            y: {
              ticks: { color: '#888' },
              grid: { display: false }
            }
          }
        }
      });
    }
  }

  function getScoreClass(score) {
    if (score >= 80) return 'score-good';
    if (score >= 60) return 'score-warning';
    return 'score-poor';
  }

  function getScoreColor(score) {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    return '#ef4444';
  }

  function formatCategory(category) {
    const labels = {
      analytics: 'Analytics',
      advertising: 'Advertising',
      tag_manager: 'Tag Manager',
      consent: 'Consent',
      customer_support: 'Support',
      marketing: 'Marketing',
      ab_testing: 'A/B Testing',
      session_recording: 'Session Recording',
      error_monitoring: 'Error Monitoring',
      cdp: 'CDP',
      other: 'Other'
    };
    return labels[category] || category;
  }

  function formatScriptCategory(category) {
    const labels = {
      analytics: '📊 Analytics',
      advertising: '📢 Advertising',
      cdn: '🌐 CDN',
      library: '📚 Library',
      unknown: '❓ Other'
    };
    return labels[category] || category;
  }

  function getCategoryColor(category) {
    const colors = {
      analytics: 'rgba(167, 139, 250, 0.3)',
      advertising: 'rgba(239, 68, 68, 0.3)',
      cdn: 'rgba(59, 130, 246, 0.3)',
      library: 'rgba(16, 185, 129, 0.3)',
      unknown: 'rgba(100, 100, 100, 0.3)'
    };
    return colors[category] || 'rgba(100, 100, 100, 0.3)';
  }

  /**
   * Get color for cookie type badges
   */
  function getCookieTypeColor(type) {
    const colors = {
      necessary: 'rgba(16, 185, 129, 0.3)',
      analytics: 'rgba(59, 130, 246, 0.3)',
      advertising: 'rgba(239, 68, 68, 0.3)',
      functional: 'rgba(167, 139, 250, 0.3)',
      marketing: 'rgba(245, 158, 11, 0.3)',
      unknown: 'rgba(100, 100, 100, 0.3)'
    };
    return colors[type] || colors.unknown;
  }

  /**
   * Format cookie type for display
   */
  function formatCookieType(type) {
    const labels = {
      necessary: 'Essential',
      analytics: 'Analytics',
      advertising: 'Advertising',
      functional: 'Functional',
      marketing: 'Marketing',
      unknown: 'Unknown'
    };
    return labels[type] || type;
  }

  /**
   * Get color for waterfall chart bars
   */
  function getWaterfallColor(category) {
    const colors = {
      analytics: '#3b82f6',
      advertising: '#f59e0b',
      session_recording: '#ec4899',
      ab_testing: '#8b5cf6',
      consent: '#10b981',
      customer_support: '#06b6d4',
      marketing: '#ef4444',
      error_monitoring: '#f97316',
      cdp: '#14b8a6',
      other: '#6b7280'
    };
    return colors[category] || colors.other;
  }

  /**
   * Render A/B Testing & Session Recording section
   */
  function renderABTestingSection(data) {
    // Collect A/B testing and session recording tags
    const abTags = data.tags?.filter(t => t.category === 'ab_testing') || [];
    const sessionTags = data.tags?.filter(t => t.category === 'session_recording') || [];
    const errorTags = data.tags?.filter(t => t.category === 'error_monitoring') || [];
    const cdpTags = data.tags?.filter(t => t.category === 'cdp') || [];
    
    const totalCount = abTags.length + sessionTags.length + errorTags.length + cdpTags.length;
    
    if (totalCount === 0) {
      return '';
    }

    return createTagAccordionSection('ab-session-tools', '🧪', `A/B Testing & Session Recording (${totalCount})`, `
      <div style="padding: 1rem 0;">
        <!-- A/B Testing Tools -->
        ${abTags.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #8b5cf6; font-size: 0.9rem;">🧪 A/B Testing (${abTags.length})</h4>
            <div style="display: grid; gap: 0.5rem;">
              ${abTags.map(tag => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(139, 92, 246, 0.1); border-radius: 6px; border-left: 3px solid #8b5cf6;">
                  <div>
                    <strong style="color: #fff;">${tag.name}</strong>
                    ${tag.ids?.length ? `<span style="color: #888; font-size: 0.8rem; margin-left: 0.5rem;">${tag.ids.join(', ')}</span>` : ''}
                  </div>
                  <span style="color: #888; font-size: 0.8rem;">${tag.instances} instance(s)</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Session Recording Tools -->
        ${sessionTags.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #ec4899; font-size: 0.9rem;">🎥 Session Recording & Heatmaps (${sessionTags.length})</h4>
            <div style="display: grid; gap: 0.5rem;">
              ${sessionTags.map(tag => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(236, 72, 153, 0.1); border-radius: 6px; border-left: 3px solid #ec4899;">
                  <div>
                    <strong style="color: #fff;">${tag.name}</strong>
                  </div>
                  <span style="color: #888; font-size: 0.8rem;">${tag.instances} instance(s)</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Error Monitoring Tools -->
        ${errorTags.length > 0 ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #f97316; font-size: 0.9rem;">🐛 Error Monitoring (${errorTags.length})</h4>
            <div style="display: grid; gap: 0.5rem;">
              ${errorTags.map(tag => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(249, 115, 22, 0.1); border-radius: 6px; border-left: 3px solid #f97316;">
                  <div>
                    <strong style="color: #fff;">${tag.name}</strong>
                  </div>
                  <span style="color: #888; font-size: 0.8rem;">${tag.instances} instance(s)</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- CDP Tools -->
        ${cdpTags.length > 0 ? `
          <div style="margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.75rem 0; color: #14b8a6; font-size: 0.9rem;">🔄 Customer Data Platforms (${cdpTags.length})</h4>
            <div style="display: grid; gap: 0.5rem;">
              ${cdpTags.map(tag => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(20, 184, 166, 0.1); border-radius: 6px; border-left: 3px solid #14b8a6;">
                  <div>
                    <strong style="color: #fff;">${tag.name}</strong>
                  </div>
                  <span style="color: #888; font-size: 0.8rem;">${tag.instances} instance(s)</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <!-- Summary Tips -->
        <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.1); border-radius: 6px; font-size: 0.85rem;">
          <strong style="color: #3b82f6;">💡 Tip:</strong>
          ${abTags.length > 1 ? `<span style="color: #ccc;"> Multiple A/B testing tools detected. Consider consolidating to reduce page weight.</span>` : ''}
          ${sessionTags.length > 0 && abTags.length > 0 ? `<span style="color: #ccc;"> Session recordings can help analyze A/B test user behavior.</span>` : ''}
          ${sessionTags.length > 0 && abTags.length === 0 ? `<span style="color: #ccc;"> Session recordings detected. Consider adding A/B testing to optimize based on insights.</span>` : ''}
          ${totalCount === 1 ? `<span style="color: #ccc;"> Good foundation! Consider adding complementary tools as needed.</span>` : ''}
        </div>
      </div>
    `, null);
  }

  /**
   * Add ASCII art patience message to loading container
   */
  function addPatienceMessage(container) {
    // Remove existing patience message if any
    const existing = document.getElementById('patience-message');
    if (existing) existing.remove();
    
    const patienceEl = document.createElement('div');
    patienceEl.id = 'patience-message';
    patienceEl.style.cssText = `
      margin: 0 0 1.5rem 0;
      padding: 1rem;
      background: rgba(0, 255, 65, 0.05);
      border: 1px solid rgba(0, 255, 65, 0.3);
      border-radius: 6px;
      text-align: center;
      overflow: visible;
    `;
    patienceEl.innerHTML = `
      <div style="overflow-x: auto; overflow-y: visible;">
        <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: #00ff41; font-family: monospace; text-shadow: 2px 2px 0px rgba(0, 255, 65, 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
      </div>
      <div style="margin-top: 0.75rem; font-size: 0.85rem; color: #00ff41;">
        🏷️ Detecting analytics and tracking tags...<br>
        <span style="font-size: 0.75rem; color: #00ffaa;">This may take 20-45 seconds</span>
      </div>
    `;
    
    // Add animations if not already added
    if (!document.getElementById('patience-animations')) {
      const style = document.createElement('style');
      style.id = 'patience-animations';
      style.textContent = `
        @keyframes color-cycle {
          0% { color: #00ff41; }
          20% { color: #00ffaa; }
          40% { color: #00aaff; }
          60% { color: #aa00ff; }
          80% { color: #ff00aa; }
          100% { color: #00ff41; }
        }
        @keyframes fade-in-out {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        .ascii-art-responsive {
          font-size: clamp(0.35rem, 1.2vw, 0.65rem);
          white-space: pre;
          max-width: 100%;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Insert at the beginning of the loading container
    const loaderDiv = container.querySelector('.analyzer-loading');
    if (loaderDiv) {
      loaderDiv.insertBefore(patienceEl, loaderDiv.firstChild);
    } else {
      container.insertBefore(patienceEl, container.firstChild);
    }
  }

  // Accordion helper functions
  /**
   * Create SEO-style accordion section (matches SEO analyzer)
   */
  function createTagAccordionSection(id, icon, title, contentHTML, score = null) {
    const scoreColor = score !== null ? getScoreColor(score) : '#808080';
    const scoreDisplay = score !== null ? `<span style="color: ${scoreColor}; font-size: 0.9rem;">${score}/100</span>` : '';

    return `
      <div class="accordion" data-accordion-id="${id}" style="
        margin-bottom: 0.5rem;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        overflow: hidden;
        background: rgba(0, 0, 0, 0.3);
      ">
        <button class="accordion-header" type="button" onclick="toggleTagAccordion('${id}')" style="
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.03);
          border: none;
          color: #ffffff;
          transition: background 0.2s ease;
        ">
          <span style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600;">
            ${title}
          </span>
          <span style="display: flex; align-items: center; gap: 0.5rem;">
            ${scoreDisplay}
            <span class="accordion-toggle" style="transition: transform 0.2s ease; color: #808080;">▼</span>
          </span>
        </button>
        <div class="accordion-content" id="${id}" style="
          max-height: 0;
          padding: 0;
          overflow: hidden;
          border-top: none;
          transition: max-height 0.3s ease, padding 0.3s ease;
        ">
          <div class="accordion-content-inner" style="padding: 0 1.25rem;">${contentHTML}</div>
        </div>
      </div>
    `;
  }

  window.toggleTagAccordion = function(accordionId) {
    const content = document.getElementById(accordionId);
    if (!content) return;
    
    const accordion = content.closest('.accordion');
    const header = accordion ? accordion.querySelector('.accordion-header') : content.previousElementSibling;
    const toggle = header ? header.querySelector('.accordion-toggle') : null;
    
    const isExpanded = content.style.maxHeight && content.style.maxHeight !== '0px';
    
    if (isExpanded) {
      // Collapse
      content.style.maxHeight = '0';
      content.style.padding = '0';
      content.style.borderTop = 'none';
      if (toggle) {
        toggle.textContent = '▼';
        toggle.style.transform = '';
      }
      if (header) header.classList.remove('active');
    } else {
      // Expand
      content.style.maxHeight = content.scrollHeight + 100 + 'px';
      content.style.padding = '1rem 1.25rem';
      content.style.borderTop = '1px solid #333';
      if (toggle) {
        toggle.textContent = '▲';
        toggle.style.transform = 'rotate(180deg)';
      }
      if (header) header.classList.add('active');
      
      // Adjust max-height after content loads
      setTimeout(() => {
        if (content.style.maxHeight !== '0px' && content.style.maxHeight !== '0') {
          content.style.maxHeight = content.scrollHeight + 100 + 'px';
        }
      }, 100);
    }
  };
});
