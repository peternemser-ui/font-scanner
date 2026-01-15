// Security Analyzer JavaScript
// Frontend rendering and API interaction for security analysis

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'security';

let currentResults = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const analyzeButton = document.getElementById('analyzeButton');
  const urlInput = document.getElementById('urlInput');

  analyzeButton.addEventListener('click', () => analyzeSecurity());
  
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeSecurity();
    }
  });
  
  // Auto-start scan if URL parameter is present
  if (typeof window.getUrlParameter === 'function') {
    const autoUrl = window.getUrlParameter();
    if (autoUrl) {
      urlInput.value = autoUrl;
      setTimeout(() => {
        analyzeSecurity();
      }, 500);
    }
  }
});

// Main analysis function
async function analyzeSecurity() {
  const url = document.getElementById('urlInput').value.trim();
  const analyzeButton = document.getElementById('analyzeButton');
  
  if (!url) {
    showError('Please enter a valid URL');
    return;
  }

  // Update button state
  analyzeButton.disabled = true;
  const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
  buttonText.textContent = 'Running scan...';

  // Setup UI
  const resultsDiv = document.getElementById('results');
  const errorMessage = document.getElementById('errorMessage');

  resultsDiv.classList.add('hidden');
  errorMessage.classList.add('hidden');

  // Create loading container if it doesn't exist
  let loadingContainer = document.getElementById('loadingContainer');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'loadingContainer';
    resultsDiv.parentNode.insertBefore(loadingContainer, resultsDiv);
  }

  // Initialize the analyzer loader
  const loader = new window.AnalyzerLoaderClass('loadingContainer');
  
  // Add ASCII art patience message
  const loaderMessageEl = document.createElement('div');
  loaderMessageEl.id = 'patience-message';
  loaderMessageEl.style.cssText = `
    margin: 0 0 1.5rem 0;
    padding: 1rem;
    background: rgba(var(--accent-primary-rgb), 0.05);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\\\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\\\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /   
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: 0.9rem; color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em;">
      Comprehensive analysis in progress...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: 0.8rem; color: rgba(var(--accent-primary-rgb), 0.7);">
      This may take 30-60 seconds
    </p>
  `;

  // Add color cycling style if not already added
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
      #patience-message {
        overflow: visible;
      }
      #patience-message > div {
        -webkit-overflow-scrolling: touch;
      }
    `;
    document.head.appendChild(style);
  }
  
  const analysisSteps = [
    {
      label: 'Checking HTTPS configuration',
      detail: 'Verifying SSL/TLS certificate and encryption...'
    },
    {
      label: 'Analyzing security headers',
      detail: 'Testing CSP, HSTS, X-Frame-Options...'
    },
    {
      label: 'Scanning for vulnerabilities',
      detail: 'Checking OWASP Top 10 security risks...'
    },
    {
      label: 'Testing SSL/TLS strength',
      detail: 'Evaluating cipher suites and protocols...'
    },
    {
      label: 'Generating security report',
      detail: 'Compiling findings and recommendations...'
    }
  ];

  loader.start(analysisSteps, '[SECURITY ANALYZER]', 15);
  
  // Insert ASCII art message after loader starts
  setTimeout(() => {
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer && loaderMessageEl) {
      loadingContainer.insertBefore(loaderMessageEl, loadingContainer.firstChild);
    }
  }, 100);

  try {
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    // Call security API
    const response = await fetch('/api/security', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, scanStartedAt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Security analysis failed');
    }

    const results = await response.json();
    currentResults = results;

    // Complete the loader
    loader.complete();
    
    // Show results after animation completes
    setTimeout(() => {
      displaySecurityResults(results);
      resultsDiv.classList.remove('hidden');
    }, 1000);

  } catch (error) {
    console.error('Security analysis error:', error);
    loader.showError(`Security analysis failed: ${error.message}`);
  } finally {
    // Reset button state
    const analyzeButton = document.getElementById('analyzeButton');
    analyzeButton.disabled = false;
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = 'Run scan';
  }
}

// Display complete security results
function displaySecurityResults(data) {
  const resultsContent = document.getElementById('resultsContent');
  resultsContent.innerHTML = '';

  // Overall Security Summary with Circular Dials
  const summaryHtml = `
    <div class="summary-section security-summary-panel">
      <h2>◈ Security Audit Summary</h2>
      
      <!-- Circular Progress Dials -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; margin: 2rem 0;">
        <!-- Overall Security Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Overall Security Score</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
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
              stroke="${getScoreColor(data.overallScore)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${(data.overallScore / 100) * 471.24} 471.24"
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
              style="text-shadow: 0 0 18px ${getScoreColor(data.overallScore)}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${data.overallScore}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(data.overallScore)}; font-weight: 600; font-size: 1.1rem;">
            ${getGrade(data.overallScore)}
          </div>
        </div>

        <!-- SSL/TLS Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">SSL/TLS Security</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
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
              stroke="${getScoreColor(data.ssl.score)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${(data.ssl.score / 100) * 471.24} 471.24"
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
              style="text-shadow: 0 0 18px ${getScoreColor(data.ssl.score)}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${data.ssl.score}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(data.ssl.score)}; font-weight: 600; font-size: 1.1rem;">
            ${getGrade(data.ssl.score)}
          </div>
        </div>

        <!-- Security Headers Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Security Headers</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
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
              stroke="${getScoreColor(data.headers.score)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${(data.headers.score / 100) * 471.24} 471.24"
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
              style="text-shadow: 0 0 18px ${getScoreColor(data.headers.score)}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${data.headers.score}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(data.headers.score)}; font-weight: 600; font-size: 1.1rem;">
            ${data.headers.implemented}/${data.headers.total} Implemented
          </div>
        </div>

        <!-- Vulnerabilities Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Vulnerability Status</div>
          <svg class="circular-progress" width="180" height="180" viewBox="0 0 180 180">
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
              stroke="${getScoreColor(data.vulnerabilities.score)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${(data.vulnerabilities.score / 100) * 471.24} 471.24"
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
              style="text-shadow: 0 0 18px ${getScoreColor(data.vulnerabilities.score)}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${data.vulnerabilities.score}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${data.vulnerabilities.critical === 0 ? 'var(--accent-primary)' : '#ff4444'}; font-weight: 600; font-size: 1.1rem;">
            ${data.vulnerabilities.critical} Critical Issues
          </div>
        </div>
      </div>

      <!-- Summary Table -->
      <div style="overflow-x: auto; margin-top: 2rem;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(255, 68, 68, 0.3);">
          <thead>
            <tr style="background: rgba(255, 68, 68, 0.1); border-bottom: 2px solid rgba(255, 68, 68, 0.3);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff4444;">Category</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ff4444;">Score</th>
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: var(--accent-primary);">Status</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff4444;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 500;">◈ SSL/TLS Certificate</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.ssl.score)}; font-weight: bold;">${data.ssl.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.ssl.score)}; font-weight: bold;">${getGrade(data.ssl.score)}</td>
              <td style="padding: 0.75rem; color: ${data.ssl.valid ? 'var(--accent-primary)' : '#ff4444'};">${data.ssl.valid ? '✓ Valid Certificate' : '✗ Invalid Certificate'}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 500;">◈ Security Headers</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.headers.score)}; font-weight: bold;">${data.headers.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.headers.score)}; font-weight: bold;">${getGrade(data.headers.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${data.headers.implemented} of ${data.headers.total} headers implemented</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 500;">~ Vulnerabilities</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.vulnerabilities.score)}; font-weight: bold;">${data.vulnerabilities.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.vulnerabilities.score)}; font-weight: bold;">${getGrade(data.vulnerabilities.score)}</td>
              <td style="padding: 0.75rem; color: ${data.vulnerabilities.critical === 0 ? 'var(--accent-primary)' : '#ff4444'};">
                ${data.vulnerabilities.critical} Critical, ${data.vulnerabilities.high} High, ${data.vulnerabilities.medium} Medium
              </td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 500;">🍪 Cookie Security</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.cookies.score)}; font-weight: bold;">${data.cookies.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.cookies.score)}; font-weight: bold;">${getGrade(data.cookies.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${data.cookies.secure} of ${data.cookies.total} cookies properly secured</td>
            </tr>
            <tr>
              <td style="padding: 0.75rem; font-weight: 500;">R Third-Party Scripts</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.thirdPartyScripts.score)}; font-weight: bold;">${data.thirdPartyScripts.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.thirdPartyScripts.score)}; font-weight: bold;">${getGrade(data.thirdPartyScripts.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${data.thirdPartyScripts.withSRI} of ${data.thirdPartyScripts.total} scripts with SRI</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- OWASP Compliance Banner -->
      <div style="margin-top: 2rem; padding: 1.25rem; background: linear-gradient(135deg, rgba(255, 68, 68, 0.15), rgba(255, 165, 0, 0.15)); border: 2px solid ${data.owaspCompliance >= 70 ? 'var(--accent-primary)' : '#ff4444'}; border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 3rem;">${data.owaspCompliance >= 70 ? '✓' : '~'}</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 1.1rem; color: #ffffff; margin-bottom: 0.5rem;">
              OWASP Top 10 Compliance
            </div>
            <div style="color: ${data.owaspCompliance >= 70 ? 'var(--accent-primary)' : '#ff4444'}; font-size: 0.95rem;">
              <strong>${data.owaspCompliance}%</strong> of OWASP Top 10 security controls implemented
              ${data.owaspCompliance >= 70 ? '- Good security posture!' : '- Improvements needed'}
            </div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 2.5rem; font-weight: bold; color: ${data.owaspCompliance >= 70 ? 'var(--accent-primary)' : '#ff4444'};">
              ${data.owaspCompliance}%
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  resultsContent.innerHTML = summaryHtml;

  // Store results globally for export/share
  window.currentSecurityResults = {
    ...data,
    url: data.url || document.getElementById('urlInput').value.trim()
  };

  // PDF Download Button removed - monetization disabled

  // Desktop vs Mobile Comparison (for Lighthouse security metrics)
  if (data.desktop && data.mobile) {
    const comparisonSection = document.createElement('div');
    comparisonSection.className = 'comparison-section';
    createDesktopMobileComparison(comparisonSection, data.desktop, data.mobile);
    resultsContent.appendChild(comparisonSection);
  }

  // Accordion sections container
  const accordionsContainer = document.createElement('div');
  accordionsContainer.className = 'accordions-container';

  // 1. SSL/TLS Certificate
  createAccordionSection(
    accordionsContainer,
    'ssl-section',
    'SSL/TLS Certificate',
    () => renderSSLContent(data.ssl),
    data.ssl.score
  );

  // 2. Security Headers
  createAccordionSection(
    accordionsContainer,
    'headers-section',
    'Security Headers',
    () => renderHeadersContent(data.headers),
    data.headers.score
  );

  // 3. Vulnerabilities & Threats
  createAccordionSection(
    accordionsContainer,
    'vulnerabilities-section',
    'Vulnerabilities & Threats',
    () => renderVulnerabilitiesContent(data.vulnerabilities),
    data.vulnerabilities.score
  );

  // 4. Cookie Security
  createAccordionSection(
    accordionsContainer,
    'cookies-section',
    'Cookie Security',
    () => renderCookiesContent(data.cookies),
    data.cookies.score
  );

  // 5. Third-Party Scripts
  createAccordionSection(
    accordionsContainer,
    'thirdparty-section',
    'Third-Party Scripts',
    () => renderThirdPartyContent(data.thirdPartyScripts),
    data.thirdPartyScripts.score
  );

  // 6. Recommendations (Pro gated)
  createAccordionSection(
    accordionsContainer,
    'recommendations-section',
    'Security Recommendations',
    () => renderRecommendationsContent(data.recommendations),
    null,
    {
      isPro: true,
      previewHtml: renderLockedProPreview('Security Recommendations', [
        'Critical remediation steps',
        'OWASP-aligned fixes'
      ])
    }
  );

  resultsContent.appendChild(accordionsContainer);

  // Summary block (SEO-style footer)
  const summaryFooter = document.createElement('div');
  summaryFooter.className = 'section';
  summaryFooter.innerHTML = `
    <h2>[SUMMARY]</h2>
    <div class="seo-summary">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-value">${countSecurityIssues(data)}</span>
          <span class="stat-label">Issues Found</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countSecurityRecommendations(data)}</span>
          <span class="stat-label">Recommendations</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${countSecurityPassedChecks(data)}</span>
          <span class="stat-label">Checks Passed</span>
        </div>
      </div>
    </div>
  `;
  resultsContent.appendChild(summaryFooter);

  // Monetization actions (export/share)
  const actionsFooter = document.createElement('div');
  actionsFooter.className = 'section';

  // Use new ProReportBlock component if available
  if (window.ProReportBlock && window.ProReportBlock.render) {
    actionsFooter.innerHTML = window.ProReportBlock.render({
      context: 'security',
      features: ['pdf', 'csv', 'share'],
      title: 'Unlock Report',
      subtitle: 'PDF export, share link, export data, and fix packs for this scan.'
    });
  } else {
    // Fallback/legacy code
    actionsFooter.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(var(--accent-primary-rgb), 0.2);">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span style="color: var(--accent-primary); font-weight: 600;">Take Action</span>
          <span style="color: #666; font-size: 0.9rem;">Export or share this security report</span>
        </div>
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="exportSecurityPDF()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(var(--accent-primary-rgb), 0.4); background: rgba(var(--accent-primary-rgb), 0.1); color: var(--accent-primary); cursor: pointer; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            PDF Report
          </button>
          <button onclick="copySecurityShareLink()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share Link
          </button>
          <button onclick="downloadSecurityCSV()" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1rem; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; font-weight: 600;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7"/><path d="M3 7h18"/><path d="M10 11h4"/><path d="M10 15h4"/><path d="M6 11h.01"/><path d="M6 15h.01"/><path d="M18 11h.01"/><path d="M18 15h.01"/></svg>
            Export Data
          </button>
        </div>
      </div>
    `;
  }
  resultsContent.appendChild(actionsFooter);
}

// Create desktop vs mobile comparison section
function createDesktopMobileComparison(container, desktop, mobile) {
  const comparisonHtml = `
    <div class="platform-comparison" style="margin: 2rem 0;">
      <h3 style="margin-bottom: 1.5rem;">DM Desktop vs Mobile Security Analysis</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1rem;">
        <div style="background: rgba(0, 204, 255, 0.05); border: 2px solid rgba(0, 204, 255, 0.3); border-radius: 8px; padding: 1.5rem;">
          <div style="background: rgba(0, 204, 255, 0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; text-align: center;">
            <span style="font-size: 1.5rem; margin-right: 0.5rem;">D</span>
            <span style="font-weight: bold; color: #00ccff;">Desktop</span>
          </div>
          <div class="circular-progress-container" style="margin: 1.5rem 0;">
            <svg class="circular-progress" width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="${getScoreColor(desktop.securityScore)}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${(desktop.securityScore / 100) * 326.73} 326.73"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="60"
                text-anchor="middle"
                dy="0.35em"
                font-size="2.8rem"
                font-weight="bold"
                fill="#ffffff"
                style="text-shadow: 0 0 10px ${getScoreColor(desktop.securityScore)}, 0 0 20px ${getScoreColor(desktop.securityScore)};"
              >
                ${desktop.securityScore}
              </text>
            </svg>
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.9rem; color: #808080;">Security Score</div>
          </div>
          <div style="margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">HTTPS:</span>
              <span style="color: ${desktop.https ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${desktop.https ? '✓ Enabled' : '✗ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">Mixed Content:</span>
              <span style="color: ${desktop.mixedContent === 0 ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${desktop.mixedContent} issues</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">CSP:</span>
              <span style="color: ${desktop.csp ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${desktop.csp ? '✓ Present' : '⚠ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px;">
              <span style="font-weight: 500;">HSTS:</span>
              <span style="color: ${desktop.hsts ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${desktop.hsts ? '✓ Present' : '⚠ Missing'}</span>
            </div>
          </div>
        </div>
        
        <div style="background: rgba(255, 102, 0, 0.05); border: 2px solid rgba(255, 102, 0, 0.3); border-radius: 8px; padding: 1.5rem;">
          <div style="background: rgba(255, 102, 0, 0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; text-align: center;">
            <span style="font-size: 1.5rem; margin-right: 0.5rem;">M</span>
            <span style="font-weight: bold; color: #ff6600;">Mobile</span>
          </div>
          <div class="circular-progress-container" style="margin: 1.5rem 0;">
            <svg class="circular-progress" width="120" height="120" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="rgba(0, 0, 0, 0.1)"
                stroke-width="8"
              />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="${getScoreColor(mobile.securityScore)}"
                stroke-width="8"
                stroke-linecap="round"
                stroke-dasharray="${(mobile.securityScore / 100) * 326.73} 326.73"
                transform="rotate(-90 60 60)"
              />
              <text
                x="60"
                y="60"
                text-anchor="middle"
                dy="0.35em"
                font-size="2.8rem"
                font-weight="bold"
                fill="#ffffff"
                style="text-shadow: 0 0 10px ${getScoreColor(mobile.securityScore)}, 0 0 20px ${getScoreColor(mobile.securityScore)};"
              >
                ${mobile.securityScore}
              </text>
            </svg>
            <div style="text-align: center; margin-top: 0.5rem; font-size: 0.9rem; color: #808080;">Security Score</div>
          </div>
          <div style="margin-top: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">HTTPS:</span>
              <span style="color: ${mobile.https ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${mobile.https ? '✓ Enabled' : '✗ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">Mixed Content:</span>
              <span style="color: ${mobile.mixedContent === 0 ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">${mobile.mixedContent} issues</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">CSP:</span>
              <span style="color: ${mobile.csp ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${mobile.csp ? '✓ Present' : '⚠ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px;">
              <span style="font-weight: 500;">HSTS:</span>
              <span style="color: ${mobile.hsts ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">${mobile.hsts ? '✓ Present' : '⚠ Missing'}</span>
            </div>
          </div>
        </div>
      </div>
      
      ${Math.abs(desktop.securityScore - mobile.securityScore) > 10 ? `
        <div class="warning-message" style="background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); margin-top: 1rem; padding: 1rem; border-radius: 4px;">
          <strong style="color: #ffa500;">~ Platform Security Gap:</strong> 
          ${Math.abs(desktop.securityScore - mobile.securityScore)} point difference detected. Investigate platform-specific issues.
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = comparisonHtml;
}

// Create accordion section matching SEO/Accessibility style with optional Pro gating
function createAccordionSection(container, id, displayTitle, contentCreator, score, options = {}) {
  const { isPro = false, previewHtml = '' } = options;
  ensureProStyles();

  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  if (isPro) {
    accordion.classList.add('pro-section');
    accordion.dataset.pro = 'true';
  }
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  const proBadge = isPro ? '<span class="pro-pill">PRO</span>' : '';
  header.innerHTML = `
    <span style="display: inline-flex; align-items: center; gap: 0.5rem;">${displayTitle} ${proBadge}</span>
    <span style="display: flex; align-items: center; gap: 0.5rem;">
      ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
      <span class="accordion-toggle">▼</span>
    </span>
  `;
  
  const content = document.createElement('div');
  content.className = 'accordion-content';
  content.id = `accordion-${id}`;
  
  const contentInner = document.createElement('div');
  contentInner.className = 'accordion-content-inner';
  content.appendChild(contentInner);

  const renderContent = () => {
    const hasPro = !isPro || userHasPro();
    if (isPro && !hasPro) {
      contentInner.innerHTML = previewHtml || renderLockedProPreview(displayTitle, ['Security fixes preview', 'OWASP-aligned recommendations']);
      return;
    }
    const contentHTML = contentCreator();
    if (typeof contentHTML === 'string') {
      contentInner.innerHTML = contentHTML;
    } else {
      contentInner.appendChild(contentHTML);
    }
  };
  
  // Add click handler for accordion
  header.addEventListener('click', () => {
    const isExpanded = content.classList.contains('expanded');
    
    if (isExpanded) {
      // Collapse
      content.classList.remove('expanded');
      header.classList.remove('active');
      header.querySelector('.accordion-toggle').textContent = '▼';
      header.querySelector('.accordion-toggle').classList.remove('rotated');
    } else {
      // Pro paywall prompt on open if locked
      if (isPro && !userHasPro()) {
        safeOpenProPaywall({ domain: getCurrentDomain(), context: 'security' });
      }
      // Expand and create content if not already created
      if (!contentInner.hasChildNodes()) {
        renderContent();
      }
      
      content.classList.add('expanded');
      header.classList.add('active');
      header.querySelector('.accordion-toggle').textContent = '▲';
      header.querySelector('.accordion-toggle').classList.add('rotated');
    }
  });
  
  accordion.appendChild(header);
  accordion.appendChild(content);
  container.appendChild(accordion);
}

// Render SSL/TLS Certificate content
function renderSSLContent(ssl) {
  return `
    <div class="security-section">
      <h4>Certificate Information</h4>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">Valid:</span>
          <span class="info-value ${ssl.valid ? 'success' : 'error'}">${ssl.valid ? '✓ Yes' : '✗ No'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Issuer:</span>
          <span class="info-value">${ssl.issuer || 'Unknown'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Valid From:</span>
          <span class="info-value">${ssl.validFrom || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Valid Until:</span>
          <span class="info-value">${ssl.validUntil || 'N/A'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Days Remaining:</span>
          <span class="info-value ${ssl.daysRemaining > 30 ? 'success' : 'warning'}">${ssl.daysRemaining || 'N/A'} days</span>
        </div>
        <div class="info-item">
          <span class="info-label">Protocol:</span>
          <span class="info-value">${ssl.protocol || 'Unknown'}</span>
        </div>
      </div>

      ${ssl.issues && ssl.issues.length > 0 ? `
        <div class="issues-list" style="margin-top: 1rem;">
          <h5 style="color: #ff4444;">~ Certificate Issues:</h5>
          <ul>
            ${ssl.issues.map(issue => `<li style="color: #ff4444;">${issue}</li>`).join('')}
          </ul>
        </div>
      ` : '<p style="color: var(--accent-primary); margin-top: 1rem;">✓ No SSL/TLS issues detected</p>'}
    </div>
  `;
}

// Render Security Headers content
function renderHeadersContent(headers) {
  return `
    <div class="security-section">
      <h4>HTTP Security Headers Analysis</h4>
      <p style="margin-bottom: 1.5rem;">Implemented: ${headers.implemented} of ${headers.total} recommended headers</p>
      
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(255, 255, 255, 0.1);">
          <thead>
            <tr style="background: rgba(255, 255, 255, 0.05); border-bottom: 2px solid rgba(255, 255, 255, 0.2);">
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 10%;">Status</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 25%;">Header</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 30%;">Value</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: var(--accent-primary); width: 35%;">Description / Risk</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(headers.details).map(([header, info]) => `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${!info.present ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${info.present ? 'var(--accent-primary)' : '#ff4444'}; font-size: 1.2rem; font-weight: bold;">
                    ${info.present ? '✓' : '✗'}
                  </span>
                </td>
                <td style="padding: 0.75rem;">
                  <strong style="color: ${info.present ? '#ffffff' : '#ff4444'};">${header}</strong>
                </td>
                <td style="padding: 0.75rem; color: ${info.present ? 'var(--accent-primary)' : '#808080'}; font-family: monospace; font-size: 0.85rem; word-break: break-all;">
                  ${info.value || '<span style="color: #808080; font-style: italic;">Not set</span>'}
                </td>
                <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.9rem;">
                  <div>${info.description}</div>
                  ${!info.present ? `<div style="color: #ff4444; margin-top: 0.5rem; font-weight: 500;">~ Risk: ${info.risk}</div>` : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Render Vulnerabilities content
function renderVulnerabilitiesContent(vulnerabilities) {
  return `
    <div class="security-section">
      <h4>Detected Vulnerabilities & Threats</h4>
      
      <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
        <thead>
          <tr style="background: rgba(255, 255, 255, 0.05); border-bottom: 2px solid rgba(255, 255, 255, 0.1);">
            <th style="text-align: left; padding: 0.75rem; color: #bb86fc; font-weight: 600;">Severity Level</th>
            <th style="text-align: center; padding: 0.75rem; color: #bb86fc; font-weight: 600;">Count</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; color: #c0c0c0;">
              <span style="color: #ff4444; font-weight: 600;">● Critical</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.critical > 0 ? '#ff4444' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.critical}</span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; color: #c0c0c0;">
              <span style="color: #ff6b6b; font-weight: 600;">● High</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.high > 0 ? '#ff6b6b' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.high}</span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; color: #c0c0c0;">
              <span style="color: #ffa500; font-weight: 600;">● Medium</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.medium > 0 ? '#ffa500' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.medium}</span>
            </td>
          </tr>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
            <td style="padding: 0.75rem; color: #c0c0c0;">
              <span style="color: #00ccff; font-weight: 600;">● Low</span>
            </td>
            <td style="text-align: center; padding: 0.75rem;">
              <span style="color: ${vulnerabilities.low > 0 ? '#00ccff' : 'var(--accent-primary)'}; font-weight: 700; font-size: 1.1rem;">${vulnerabilities.low}</span>
            </td>
          </tr>
        </tbody>
      </table>

      ${vulnerabilities.issues && vulnerabilities.issues.length > 0 ? `
        <div class="vulnerabilities-list">
          ${vulnerabilities.issues.map(issue => `
            <div class="vulnerability-item ${issue.severity}">
              <div class="vuln-header">
                <span class="vuln-severity-badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
                <span class="vuln-title">${issue.title}</span>
              </div>
              <div class="vuln-description">${issue.description}</div>
              ${issue.cve ? `<div class="vuln-cve">CVE: ${issue.cve}</div>` : ''}
              ${issue.solution ? `<div class="vuln-solution"><strong>Solution:</strong> ${issue.solution}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: var(--accent-primary); margin-top: 1rem;">✓ No significant vulnerabilities detected</p>'}

      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 4px;">
        <p style="color: #ffa500; margin: 0; font-size: 0.9rem;">
          <strong>◈ OWASP Reference:</strong> This analysis covers OWASP Top 10 categories including Injection, 
          Broken Authentication, Sensitive Data Exposure, XML External Entities (XXE), and Security Misconfiguration.
        </p>
      </div>
    </div>
  `;
}

// Render Cookie Security content
function renderCookiesContent(cookies) {
  return `
    <div class="security-section">
      <h4>Cookie Security Analysis</h4>
      <p style="margin-bottom: 1rem;">Total cookies: ${cookies.total} | Secure cookies: ${cookies.secure}</p>

      ${cookies.list && cookies.list.length > 0 ? `
        <div class="cookies-table">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(255, 165, 0, 0.3);">
            <thead>
              <tr style="background: rgba(187, 134, 252, 0.1); border-bottom: 2px solid rgba(187, 134, 252, 0.3);">
                <th style="text-align: left; padding: 0.75rem; font-weight: 600; color: #bb86fc;">Name</th>
                <th style="text-align: center; padding: 0.75rem; font-weight: 600; color: #bb86fc; white-space: nowrap;">HttpOnly</th>
                <th style="text-align: center; padding: 0.75rem; font-weight: 600; color: #bb86fc; white-space: nowrap;">Secure</th>
                <th style="text-align: center; padding: 0.75rem; font-weight: 600; color: #bb86fc; white-space: nowrap;">SameSite</th>
                <th style="text-align: left; padding: 0.75rem; font-weight: 600; color: #bb86fc;">Issues</th>
              </tr>
            </thead>
            <tbody>
              ${cookies.list.map(cookie => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${(!cookie.httpOnly || !cookie.secure) ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                  <td style="padding: 0.75rem; font-family: 'Courier New', monospace; font-size: 0.9rem; color: #00ccff;">${cookie.name}</td>
                  <td style="text-align: center; padding: 0.75rem;">
                    <span style="color: ${cookie.httpOnly ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold; font-size: 1.1rem;">
                      ${cookie.httpOnly ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="text-align: center; padding: 0.75rem;">
                    <span style="color: ${cookie.secure ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold; font-size: 1.1rem;">
                      ${cookie.secure ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="text-align: center; padding: 0.75rem;">
                    <span style="color: ${cookie.sameSite && cookie.sameSite !== 'Not set' && cookie.sameSite !== 'None' ? 'var(--accent-primary)' : (cookie.sameSite === 'Lax' ? '#ffa500' : '#ff4444')}; font-weight: bold; font-size: 0.9rem;">
                      ${cookie.sameSite || 'Not set'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; color: ${cookie.issues && cookie.issues.length > 0 ? '#ff4444' : '#666'}; font-size: 0.85rem;">
                    ${cookie.issues && cookie.issues.length > 0 ? cookie.issues.join(', ') : 'None'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p style="padding: 1rem; background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); border-radius: 4px; color: var(--accent-primary);">✓ No cookies detected</p>'}

      ${cookies.issues && cookies.issues.length > 0 ? `
        <div class="cookie-issues" style="margin-top: 1rem;">
          <h5 style="color: #ff4444;">~ Cookie Security Issues:</h5>
          <ul>
            ${cookies.issues.map(issue => `<li style="color: #ff4444;">${issue}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

// Render Third-Party Scripts content
function renderThirdPartyContent(thirdParty) {
  return `
    <div class="security-section">
      <h4>Third-Party Scripts Analysis</h4>
      <p style="margin-bottom: 1.5rem;">
        <strong>Total external scripts:</strong> ${thirdParty.total} | 
        <strong>With SRI:</strong> ${thirdParty.withSRI} | 
        <strong>Coverage:</strong> ${thirdParty.total > 0 ? Math.round((thirdParty.withSRI / thirdParty.total) * 100) : 0}%
      </p>

      ${thirdParty.scripts && thirdParty.scripts.length > 0 ? `
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(255, 165, 0, 0.3);">
            <thead>
              <tr style="background: rgba(255, 165, 0, 0.1); border-bottom: 2px solid rgba(255, 165, 0, 0.3);">
                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ffa500; min-width: 300px;">Script URL</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">SRI</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">Async</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">HTTPS</th>
                <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ffa500; white-space: nowrap;">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              ${thirdParty.scripts.map((script) => `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${!script.hasSRI ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                  <td style="padding: 0.75rem; word-break: break-all; font-family: 'Courier New', monospace; font-size: 0.85rem; color: #00ccff;">
                    ${script.url}
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.hasSRI ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">
                      ${script.hasSRI ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.async ? 'var(--accent-primary)' : '#ffa500'}; font-weight: bold;">
                      ${script.async ? '✓' : '⚠'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.https ? 'var(--accent-primary)' : '#ff4444'}; font-weight: bold;">
                      ${script.https ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center; font-weight: 600; text-transform: capitalize; color: ${
                    script.risk === 'high' ? '#ff4444' : 
                    script.risk === 'medium' ? '#ffa500' : 
                    script.risk === 'low' ? '#ffff00' : 'var(--accent-primary)'
                  };">
                    ${script.risk || 'Low'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p style="padding: 1rem; background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); border-radius: 4px; color: var(--accent-primary);">✓ No third-party scripts detected - Excellent!</p>'}

      <div style="margin-top: 1.5rem; padding: 1.25rem; background: rgba(255, 165, 0, 0.1); border: 2px solid rgba(255, 165, 0, 0.3); border-radius: 8px;">
        <h5 style="margin: 0 0 0.75rem 0; color: #ffa500; font-size: 1rem;">
          K Subresource Integrity (SRI) Best Practices
        </h5>
        <ul style="margin: 0; padding-left: 1.5rem; color: #ffa500; font-size: 0.9rem; line-height: 1.6;">
          <li>Use SRI hashes to ensure third-party scripts haven't been tampered with</li>
          <li>Always load external resources over HTTPS to prevent man-in-the-middle attacks</li>
          <li>Use async/defer attributes to prevent blocking page rendering</li>
          <li>Regularly audit and minimize the number of third-party dependencies</li>
        </ul>
      </div>
    </div>
  `;
}

// Render Recommendations content
function renderRecommendationsContent(recommendations) {
  if (!recommendations || recommendations.length === 0) {
    return `
      <div class="security-section">
        <h4>Security Recommendations</h4>
        <p style="padding: 1rem; background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); border-radius: 4px; color: var(--accent-primary);">
          ✓ No major security issues detected - Excellent!
        </p>
      </div>
    `;
  }

  return `
    <div class="security-section">
      <h4>Security Recommendations</h4>
      <p style="margin-bottom: 1rem; color: #999; font-size: 0.9rem;">
        Prioritized security improvements based on OWASP guidelines and industry best practices.
      </p>

      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; border: 1px solid rgba(187, 134, 252, 0.3);">
          <thead>
            <tr style="background: rgba(187, 134, 252, 0.1); border-bottom: 2px solid rgba(187, 134, 252, 0.3);">
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #bb86fc; width: 8%;">Priority</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 22%;">Issue</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 25%;">Description</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 20%;">Impact</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #bb86fc; width: 25%;">Solution</th>
            </tr>
          </thead>
          <tbody>
            ${recommendations.map((rec) => {
              const priorityColor = 
                rec.priority === 'critical' ? '#ff4444' :
                rec.priority === 'high' ? '#ffa500' :
                rec.priority === 'medium' ? '#ffff00' : '#00ccff';
              
              const priorityLabel = 
                rec.priority === 'critical' ? 'H' :
                rec.priority === 'high' ? '●' :
                rec.priority === 'medium' ? 'M' : 'L';

              return `
                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${rec.priority === 'critical' ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${priorityColor}; font-weight: bold; font-size: 1.1rem; text-transform: uppercase;">
                      ${priorityLabel}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; font-weight: 600; color: #00ccff; font-size: 0.9rem; line-height: 1.4;">
                    ${rec.title}
                    ${rec.owaspRef ? `<br><span style="font-size: 0.75rem; color: #ffa500; font-weight: normal;">OWASP: ${rec.owaspRef}</span>` : ''}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.85rem; line-height: 1.4; color: #ccc;">
                    ${rec.description}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.85rem; line-height: 1.4; color: #ff6b6b;">
                    ${rec.impact || '-'}
                  </td>
                  <td style="padding: 0.75rem; font-size: 0.85rem; line-height: 1.4; color: var(--accent-primary);">
                    ${rec.solution || '-'}
                    ${rec.resources && rec.resources.length > 0 ? `
                      <div style="margin-top: 0.5rem;">
                        ${rec.resources.map(resource => 
                          `<a href="${resource.url}" target="_blank" rel="noopener" style="color: #00ccff; text-decoration: none; font-size: 0.75rem; display: block;">→ ${resource.title}</a>`
                        ).join('')}
                      </div>
                    ` : ''}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Open PDF purchase modal
 */
// PDF purchase modal removed - monetization disabled

// Helper: Get status label from score
// Standard: Excellent (90-100), Good (75-89), Needs Work (50-74), Critical (<50)
function getGrade(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

// Alias for clarity
function getStatus(score) {
  return getGrade(score);
}

// Helper: Get score color - Standardized status colors
// Excellent (90-100): Green
// Good (75-89): Teal
// Needs Work (50-74): Orange
// Critical (<50): Red
function getScoreColor(score) {
  if (score >= 90) return 'var(--accent-primary)';
  if (score >= 75) return '#00bcd4';  // Good: Teal
  if (score >= 50) return '#ffa500';  // Needs Work: Orange
  return '#ff4444';                   // Critical: Red
}

// Counts for summary footer
function countSecurityIssues(results) {
  if (!results) return 0;
  const vulnIssues = (results.vulnerabilities?.issues?.length || 0) +
    (results.vulnerabilities?.critical || 0) +
    (results.vulnerabilities?.high || 0) +
    (results.vulnerabilities?.medium || 0);
  const missingHeaders = Math.max((results.headers?.total || 0) - (results.headers?.implemented || 0), 0);
  const cookieIssues = results.cookies?.issues?.length || 0;
  const thirdPartyRisks = (results.thirdPartyScripts?.scripts || []).filter(s => s.risk === 'high' || s.risk === 'medium').length;
  return vulnIssues + missingHeaders + cookieIssues + thirdPartyRisks;
}

function countSecurityRecommendations(results) {
  return results?.recommendations?.length || 0;
}

function countSecurityPassedChecks(results) {
  if (!results) return 0;
  const headerPass = results.headers?.implemented || 0;
  const cookiePass = results.cookies?.secure || 0;
  const thirdPartyPass = results.thirdPartyScripts?.withSRI || 0;
  return headerPass + cookiePass + thirdPartyPass;
}

// Monetization actions (gated)
function ensureSecurityProAccess() {
  const domain = getCurrentDomain();
  if (userHasPro()) return true;
  safeOpenProPaywall({ domain, context: 'security' });
  return false;
}

function exportSecurityPDF() {
  if (!ensureSecurityProAccess()) return;
  const exporter = new PDFExportUtility({
    filename: 'security-report.pdf',
    reportTitle: 'Security Analysis Report',
    url: window.currentSecurityResults?.url || ''
  });
  exporter.export('#results');
}

function copySecurityShareLink() {
  if (!ensureSecurityProAccess()) return;
  const targetUrl = window.currentSecurityResults?.url || window.location.href;
  const shareUrl = `${window.location.origin}/security-analyzer.html?url=${encodeURIComponent(targetUrl)}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    alert('Share link copied to clipboard');
  });
}

function downloadSecurityCSV() {
  if (!ensureSecurityProAccess()) return;
  const r = window.currentSecurityResults;
  if (!r) return;

  const rows = [
    ['Metric', 'Value'],
    ['Overall Score', r.overallScore ?? ''],
    ['SSL Score', r.ssl?.score ?? ''],
    ['Headers Score', r.headers?.score ?? ''],
    ['Vulnerability Score', r.vulnerabilities?.score ?? ''],
    ['Critical Vulns', r.vulnerabilities?.critical ?? 0],
    ['High Vulns', r.vulnerabilities?.high ?? 0],
    ['Medium Vulns', r.vulnerabilities?.medium ?? 0],
    ['Missing Headers', Math.max((r.headers?.total || 0) - (r.headers?.implemented || 0), 0)],
    ['Recommendations', countSecurityRecommendations(r)],
    ['Checks Passed', countSecurityPassedChecks(r)],
    ['URL', r.url || '']
  ];

  const csv = rows
    .map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'security-report.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Pro gating helpers
function getCurrentDomain() {
  if (window.ProAccess && typeof window.ProAccess.getCurrentDomain === 'function') {
    return window.ProAccess.getCurrentDomain();
  }
  return window.location.hostname;
}

function userHasPro() {
  if (window.ProAccess && typeof window.ProAccess.hasProAccess === 'function') {
    return window.ProAccess.hasProAccess(getCurrentDomain());
  }
  if (window.ExportGate && window.ExportGate.isPro()) {
    return true;
  }
  return false;
}

function renderLockedProPreview(title = 'Pro content', previewLines = []) {
  const lines = previewLines.length ? previewLines : ['Recommendations preview', 'Code fixes preview'];
  return `
    <div class="pro-locked">
      <div class="pro-locked__header">
        <span class="pro-pill">PRO</span>
        <span>${title}</span>
      </div>
      <ul class="pro-locked__list">
        ${lines.slice(0, 2).map(line => `<li>${line}</li>`).join('')}
      </ul>
      <div class="pro-locked__blur"></div>
      <button class="pro-locked__unlock" onclick="safeOpenProPaywall({ domain: '${getCurrentDomain()}', context: 'security' })">Unlock Report ($10 USD)</button>
    </div>
  `;
}

function safeOpenProPaywall(payload = {}) {
  try {
    if (typeof window.openProPaywall === 'function') {
      window.openProPaywall(payload);
      return true;
    }
    if (window.ProAccess && typeof window.ProAccess.openProPaywall === 'function') {
      window.ProAccess.openProPaywall(payload);
      return true;
    }
    if (window.PricingModal && typeof window.PricingModal.open === 'function') {
      window.PricingModal.open();
      return true;
    }
  } catch (err) {
    return false;
  }

  return false;
}

function ensureProStyles() {
  if (document.getElementById('pro-lock-styles')) return;
  const style = document.createElement('style');
  style.id = 'pro-lock-styles';
  style.textContent = `
    .pro-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid rgba(var(--accent-primary-rgb), 0.4);
      background: rgba(var(--accent-primary-rgb), 0.1);
      color: var(--accent-primary);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.05em;
    }
    .pro-locked {
      position: relative;
      border: 1px dashed rgba(var(--accent-primary-rgb), 0.3);
      border-radius: 10px;
      padding: 1rem;
      background: rgba(255, 255, 255, 0.02);
      overflow: hidden;
    }
    .pro-locked__header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-weight: 600;
    }
    .pro-locked__list {
      margin: 0;
      padding-left: 1.25rem;
      color: #ccc;
      font-size: 0.9rem;
    }
    .pro-locked__blur {
      position: absolute;
      inset: 0;
      backdrop-filter: blur(3px);
      background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.4) 60%);
      pointer-events: none;
    }
    .pro-locked__unlock {
      position: relative;
      margin-top: 0.75rem;
      padding: 0.55rem 1rem;
      border-radius: 8px;
      border: 1px solid rgba(var(--accent-primary-rgb), 0.4);
      background: rgba(var(--accent-primary-rgb), 0.12);
      color: var(--accent-primary);
      font-weight: 700;
      cursor: pointer;
    }
  `;
  document.head.appendChild(style);
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('errorMessage');
  const resultsDiv = document.getElementById('results');
  
  errorDiv.textContent = message;
  errorDiv.classList.remove('hidden');
  resultsDiv.classList.add('hidden');
  
  setTimeout(() => {
    errorDiv.classList.add('hidden');
  }, 5000);
}
