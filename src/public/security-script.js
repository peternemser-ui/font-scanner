// Security Analyzer JavaScript
// Frontend rendering and API interaction for security analysis

let currentResults = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  const analyzeButton = document.getElementById('analyzeButton');
  const urlInput = document.getElementById('urlInput');

  analyzeButton.addEventListener('click', () => analyzeSecurity());
  
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeSecurity();
    }
  });
});

// Main analysis function
async function analyzeSecurity() {
  const url = document.getElementById('urlInput').value.trim();
  
  if (!url) {
    showError('Please enter a valid URL');
    return;
  }

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
  const loader = new AnalyzerLoader('loadingContainer');
  
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

  try {
    // Call security API
    const response = await fetch('/api/security', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
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
  }
}

// Display complete security results
function displaySecurityResults(data) {
  const resultsContent = document.getElementById('resultsContent');
  resultsContent.innerHTML = '';

  // Overall Security Summary with Circular Dials
  const summaryHtml = `
    <div class="summary-section" style="border-left: 4px solid #ff4444; margin-bottom: 2rem;">
      <h2>🔒 Security Audit Summary</h2>
      
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
              fill="#ffffff"
              style="text-shadow: 0 0 10px ${getScoreColor(data.overallScore)}, 0 0 20px ${getScoreColor(data.overallScore)};"
            >
              ${data.overallScore}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(data.overallScore)}; font-weight: 600; font-size: 1.1rem;">
            ${getGrade(data.overallScore)} Grade
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
              fill="#ffffff"
              style="text-shadow: 0 0 10px ${getScoreColor(data.ssl.score)}, 0 0 20px ${getScoreColor(data.ssl.score)};"
            >
              ${data.ssl.score}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(data.ssl.score)}; font-weight: 600; font-size: 1.1rem;">
            ${getGrade(data.ssl.score)} Grade
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
              fill="#ffffff"
              style="text-shadow: 0 0 10px ${getScoreColor(data.headers.score)}, 0 0 20px ${getScoreColor(data.headers.score)};"
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
              fill="#ffffff"
              style="text-shadow: 0 0 10px ${getScoreColor(data.vulnerabilities.score)}, 0 0 20px ${getScoreColor(data.vulnerabilities.score)};"
            >
              ${data.vulnerabilities.score}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${data.vulnerabilities.critical === 0 ? '#00ff41' : '#ff4444'}; font-weight: 600; font-size: 1.1rem;">
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
              <th style="padding: 0.75rem; text-align: center; font-weight: 600; color: #ff4444;">Grade</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #ff4444;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 500;">🔒 SSL/TLS Certificate</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.ssl.score)}; font-weight: bold;">${data.ssl.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.ssl.score)}; font-weight: bold;">${getGrade(data.ssl.score)}</td>
              <td style="padding: 0.75rem; color: ${data.ssl.valid ? '#00ff41' : '#ff4444'};">${data.ssl.valid ? '✓ Valid Certificate' : '✗ Invalid Certificate'}</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 500;">🛡️ Security Headers</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.headers.score)}; font-weight: bold;">${data.headers.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.headers.score)}; font-weight: bold;">${getGrade(data.headers.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${data.headers.implemented} of ${data.headers.total} headers implemented</td>
            </tr>
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
              <td style="padding: 0.75rem; font-weight: 500;">⚠️ Vulnerabilities</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.vulnerabilities.score)}; font-weight: bold;">${data.vulnerabilities.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.vulnerabilities.score)}; font-weight: bold;">${getGrade(data.vulnerabilities.score)}</td>
              <td style="padding: 0.75rem; color: ${data.vulnerabilities.critical === 0 ? '#00ff41' : '#ff4444'};">
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
              <td style="padding: 0.75rem; font-weight: 500;">📦 Third-Party Scripts</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.thirdPartyScripts.score)}; font-weight: bold;">${data.thirdPartyScripts.score}/100</td>
              <td style="padding: 0.75rem; text-align: center; color: ${getScoreColor(data.thirdPartyScripts.score)}; font-weight: bold;">${getGrade(data.thirdPartyScripts.score)}</td>
              <td style="padding: 0.75rem; color: #00ccff;">${data.thirdPartyScripts.withSRI} of ${data.thirdPartyScripts.total} scripts with SRI</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- OWASP Compliance Banner -->
      <div style="margin-top: 2rem; padding: 1.25rem; background: linear-gradient(135deg, rgba(255, 68, 68, 0.15), rgba(255, 165, 0, 0.15)); border: 2px solid ${data.owaspCompliance >= 70 ? '#00ff41' : '#ff4444'}; border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="font-size: 3rem;">${data.owaspCompliance >= 70 ? '✅' : '⚠️'}</div>
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 1.1rem; color: #ffffff; margin-bottom: 0.5rem;">
              OWASP Top 10 Compliance
            </div>
            <div style="color: ${data.owaspCompliance >= 70 ? '#00ff41' : '#ff4444'}; font-size: 0.95rem;">
              <strong>${data.owaspCompliance}%</strong> of OWASP Top 10 security controls implemented
              ${data.owaspCompliance >= 70 ? '- Good security posture!' : '- Improvements needed'}
            </div>
          </div>
          <div style="text-align: center;">
            <div style="font-size: 2.5rem; font-weight: bold; color: ${data.owaspCompliance >= 70 ? '#00ff41' : '#ff4444'};">
              ${data.owaspCompliance}%
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  resultsContent.innerHTML = summaryHtml;

  // Store results globally for PDF generation
  window.currentSecurityResults = data;

  // Add PDF Download Button
  const pdfButtonHtml = `
    <div style="margin: 2rem 0; padding: 1.5rem; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(109, 40, 217, 0.1) 100%); border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.3); text-align: center;">
      <h3 style="margin: 0 0 1rem 0; color: #bb86fc; font-size: 1.25rem;">
        📥 Get Detailed Security Report
      </h3>
      <p style="margin: 0 0 1.5rem 0; color: #b0b0b0; font-size: 0.95rem;">
        Get a comprehensive PDF report with SSL/TLS details, security headers audit, vulnerability analysis, and OWASP compliance recommendations.
      </p>
      <button 
        onclick="openPdfPurchaseModal('security')"
        style="
          background: linear-gradient(135deg, #bb86fc 0%, #9d5fdb 100%);
          color: #000000;
          border: none;
          padding: 0.875rem 2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(187, 134, 252, 0.4);
          transition: all 0.3s ease;
        "
        onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(187, 134, 252, 0.6)';"
        onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 15px rgba(187, 134, 252, 0.4)';"
      >
        📥 Download PDF Report ($5)
      </button>
    </div>
  `;
  
  const pdfButtonDiv = document.createElement('div');
  pdfButtonDiv.innerHTML = pdfButtonHtml;
  resultsContent.appendChild(pdfButtonDiv);

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

  // 6. Recommendations
  createAccordionSection(
    accordionsContainer,
    'recommendations-section',
    'Security Recommendations',
    () => renderRecommendationsContent(data.recommendations),
    null // No score for recommendations
  );

  resultsContent.appendChild(accordionsContainer);
}

// Create desktop vs mobile comparison section
function createDesktopMobileComparison(container, desktop, mobile) {
  const comparisonHtml = `
    <div class="platform-comparison" style="margin: 2rem 0;">
      <h3 style="margin-bottom: 1.5rem;">🖥️📱 Desktop vs Mobile Security Analysis</h3>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 1rem;">
        <div style="background: rgba(0, 204, 255, 0.05); border: 2px solid rgba(0, 204, 255, 0.3); border-radius: 8px; padding: 1.5rem;">
          <div style="background: rgba(0, 204, 255, 0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; text-align: center;">
            <span style="font-size: 1.5rem; margin-right: 0.5rem;">🖥️</span>
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
              <span style="color: ${desktop.https ? '#00ff41' : '#ff4444'}; font-weight: bold;">${desktop.https ? '✓ Enabled' : '✗ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">Mixed Content:</span>
              <span style="color: ${desktop.mixedContent === 0 ? '#00ff41' : '#ff4444'}; font-weight: bold;">${desktop.mixedContent} issues</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">CSP:</span>
              <span style="color: ${desktop.csp ? '#00ff41' : '#ffa500'}; font-weight: bold;">${desktop.csp ? '✓ Present' : '⚠ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px;">
              <span style="font-weight: 500;">HSTS:</span>
              <span style="color: ${desktop.hsts ? '#00ff41' : '#ffa500'}; font-weight: bold;">${desktop.hsts ? '✓ Present' : '⚠ Missing'}</span>
            </div>
          </div>
        </div>
        
        <div style="background: rgba(255, 102, 0, 0.05); border: 2px solid rgba(255, 102, 0, 0.3); border-radius: 8px; padding: 1.5rem;">
          <div style="background: rgba(255, 102, 0, 0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem; text-align: center;">
            <span style="font-size: 1.5rem; margin-right: 0.5rem;">📱</span>
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
              <span style="color: ${mobile.https ? '#00ff41' : '#ff4444'}; font-weight: bold;">${mobile.https ? '✓ Enabled' : '✗ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">Mixed Content:</span>
              <span style="color: ${mobile.mixedContent === 0 ? '#00ff41' : '#ff4444'}; font-weight: bold;">${mobile.mixedContent} issues</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px; margin-bottom: 0.5rem;">
              <span style="font-weight: 500;">CSP:</span>
              <span style="color: ${mobile.csp ? '#00ff41' : '#ffa500'}; font-weight: bold;">${mobile.csp ? '✓ Present' : '⚠ Missing'}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: rgba(0, 0, 0, 0.2); border-radius: 4px;">
              <span style="font-weight: 500;">HSTS:</span>
              <span style="color: ${mobile.hsts ? '#00ff41' : '#ffa500'}; font-weight: bold;">${mobile.hsts ? '✓ Present' : '⚠ Missing'}</span>
            </div>
          </div>
        </div>
      </div>
      
      ${Math.abs(desktop.securityScore - mobile.securityScore) > 10 ? `
        <div class="warning-message" style="background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); margin-top: 1rem; padding: 1rem; border-radius: 4px;">
          <strong style="color: #ffa500;">⚠️ Platform Security Gap:</strong> 
          ${Math.abs(desktop.securityScore - mobile.securityScore)} point difference detected. Investigate platform-specific issues.
        </div>
      ` : ''}
    </div>
  `;

  container.innerHTML = comparisonHtml;
}

// Create accordion section matching Performance/Accessibility style
function createAccordionSection(container, id, displayTitle, contentCreator, score) {
  const accordion = document.createElement('div');
  accordion.className = 'accordion';
  
  const header = document.createElement('button');
  header.className = 'accordion-header';
  header.innerHTML = `
    <span>${displayTitle}</span>
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
      // Expand and create content if not already created
      if (!contentInner.hasChildNodes()) {
        const contentHTML = contentCreator();
        if (typeof contentHTML === 'string') {
          contentInner.innerHTML = contentHTML;
        } else {
          contentInner.appendChild(contentHTML);
        }
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
          <h5 style="color: #ff4444;">⚠️ Certificate Issues:</h5>
          <ul>
            ${ssl.issues.map(issue => `<li style="color: #ff4444;">${issue}</li>`).join('')}
          </ul>
        </div>
      ` : '<p style="color: #00ff41; margin-top: 1rem;">✓ No SSL/TLS issues detected</p>'}
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
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; width: 10%;">Status</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; width: 25%;">Header</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; width: 30%;">Value</th>
              <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #00ff41; width: 35%;">Description / Risk</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(headers.details).map(([header, info]) => `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); ${!info.present ? 'background: rgba(255, 68, 68, 0.05);' : ''}">
                <td style="padding: 0.75rem; text-align: center;">
                  <span style="color: ${info.present ? '#00ff41' : '#ff4444'}; font-size: 1.2rem; font-weight: bold;">
                    ${info.present ? '✓' : '✗'}
                  </span>
                </td>
                <td style="padding: 0.75rem;">
                  <strong style="color: ${info.present ? '#ffffff' : '#ff4444'};">${header}</strong>
                </td>
                <td style="padding: 0.75rem; color: ${info.present ? '#00ff41' : '#808080'}; font-family: monospace; font-size: 0.85rem; word-break: break-all;">
                  ${info.value || '<span style="color: #808080; font-style: italic;">Not set</span>'}
                </td>
                <td style="padding: 0.75rem; color: #c0c0c0; font-size: 0.9rem;">
                  <div>${info.description}</div>
                  ${!info.present ? `<div style="color: #ff4444; margin-top: 0.5rem; font-weight: 500;">⚠️ Risk: ${info.risk}</div>` : ''}
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
      
      <div class="vulnerability-summary">
        <div class="vuln-stat critical">
          <span class="vuln-count">${vulnerabilities.critical}</span>
          <span class="vuln-label">Critical</span>
        </div>
        <div class="vuln-stat high">
          <span class="vuln-count">${vulnerabilities.high}</span>
          <span class="vuln-label">High</span>
        </div>
        <div class="vuln-stat medium">
          <span class="vuln-count">${vulnerabilities.medium}</span>
          <span class="vuln-label">Medium</span>
        </div>
        <div class="vuln-stat low">
          <span class="vuln-count">${vulnerabilities.low}</span>
          <span class="vuln-label">Low</span>
        </div>
      </div>

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
      ` : '<p style="color: #00ff41; margin-top: 1rem;">✓ No significant vulnerabilities detected</p>'}

      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 4px;">
        <p style="color: #ffa500; margin: 0; font-size: 0.9rem;">
          <strong>🛡️ OWASP Reference:</strong> This analysis covers OWASP Top 10 categories including Injection, 
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
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid #333;">Name</th>
                <th style="text-align: center; padding: 0.5rem; border-bottom: 1px solid #333;">HttpOnly</th>
                <th style="text-align: center; padding: 0.5rem; border-bottom: 1px solid #333;">Secure</th>
                <th style="text-align: center; padding: 0.5rem; border-bottom: 1px solid #333;">SameSite</th>
                <th style="text-align: left; padding: 0.5rem; border-bottom: 1px solid #333;">Issues</th>
              </tr>
            </thead>
            <tbody>
              ${cookies.list.map(cookie => `
                <tr>
                  <td style="padding: 0.5rem; border-bottom: 1px solid #222;">${cookie.name}</td>
                  <td style="text-align: center; padding: 0.5rem; border-bottom: 1px solid #222;">
                    <span class="${cookie.httpOnly ? 'success' : 'error'}">${cookie.httpOnly ? '✓' : '✗'}</span>
                  </td>
                  <td style="text-align: center; padding: 0.5rem; border-bottom: 1px solid #222;">
                    <span class="${cookie.secure ? 'success' : 'error'}">${cookie.secure ? '✓' : '✗'}</span>
                  </td>
                  <td style="text-align: center; padding: 0.5rem; border-bottom: 1px solid #222;">
                    <span class="${cookie.sameSite !== 'None' ? 'success' : 'warning'}">${cookie.sameSite || 'Not set'}</span>
                  </td>
                  <td style="padding: 0.5rem; border-bottom: 1px solid #222; color: #ff4444;">
                    ${cookie.issues && cookie.issues.length > 0 ? cookie.issues.join(', ') : 'None'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p>No cookies detected</p>'}

      ${cookies.issues && cookies.issues.length > 0 ? `
        <div class="cookie-issues" style="margin-top: 1rem;">
          <h5 style="color: #ff4444;">⚠️ Cookie Security Issues:</h5>
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
                    <span style="color: ${script.hasSRI ? '#00ff41' : '#ff4444'}; font-weight: bold;">
                      ${script.hasSRI ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.async ? '#00ff41' : '#ffa500'}; font-weight: bold;">
                      ${script.async ? '✓' : '⚠'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center;">
                    <span style="color: ${script.https ? '#00ff41' : '#ff4444'}; font-weight: bold;">
                      ${script.https ? '✓' : '✗'}
                    </span>
                  </td>
                  <td style="padding: 0.75rem; text-align: center; font-weight: 600; text-transform: capitalize; color: ${
                    script.risk === 'high' ? '#ff4444' : 
                    script.risk === 'medium' ? '#ffa500' : 
                    script.risk === 'low' ? '#ffff00' : '#00ff41'
                  };">
                    ${script.risk || 'Low'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<p style="padding: 1rem; background: rgba(0, 255, 65, 0.1); border: 1px solid rgba(0, 255, 65, 0.3); border-radius: 4px; color: #00ff41;">✓ No third-party scripts detected - Excellent!</p>'}

      <div style="margin-top: 1.5rem; padding: 1.25rem; background: rgba(255, 165, 0, 0.1); border: 2px solid rgba(255, 165, 0, 0.3); border-radius: 8px;">
        <h5 style="margin: 0 0 0.75rem 0; color: #ffa500; font-size: 1rem;">
          🔗 Subresource Integrity (SRI) Best Practices
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
  // Group by priority
  const critical = recommendations.filter(r => r.priority === 'critical');
  const high = recommendations.filter(r => r.priority === 'high');
  const medium = recommendations.filter(r => r.priority === 'medium');
  const low = recommendations.filter(r => r.priority === 'low');

  return `
    <div class="security-section">
      <h4>Security Recommendations</h4>
      <p style="margin-bottom: 1.5rem;">
        Prioritized security improvements based on OWASP guidelines and industry best practices.
      </p>

      ${critical.length > 0 ? `
        <div class="recommendations-group critical">
          <h5 style="color: #ff4444;">🔴 Critical Priority</h5>
          ${critical.map(rec => `
            <div class="recommendation-item critical">
              <div class="rec-header">
                <span class="rec-title">${rec.title}</span>
                ${rec.owaspRef ? `<span class="rec-owasp">OWASP: ${rec.owaspRef}</span>` : ''}
              </div>
              <div class="rec-description">${rec.description}</div>
              <div class="rec-impact"><strong>Impact:</strong> ${rec.impact}</div>
              ${rec.solution ? `<div class="rec-solution"><strong>Solution:</strong> ${rec.solution}</div>` : ''}
              ${rec.resources ? `
                <div class="rec-resources">
                  <strong>Resources:</strong>
                  <ul>
                    ${rec.resources.map(resource => `<li><a href="${resource.url}" target="_blank" rel="noopener">${resource.title}</a></li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${high.length > 0 ? `
        <div class="recommendations-group high">
          <h5 style="color: #ffa500;">🟠 High Priority</h5>
          ${high.map(rec => `
            <div class="recommendation-item high">
              <div class="rec-header">
                <span class="rec-title">${rec.title}</span>
                ${rec.owaspRef ? `<span class="rec-owasp">OWASP: ${rec.owaspRef}</span>` : ''}
              </div>
              <div class="rec-description">${rec.description}</div>
              <div class="rec-impact"><strong>Impact:</strong> ${rec.impact}</div>
              ${rec.solution ? `<div class="rec-solution"><strong>Solution:</strong> ${rec.solution}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${medium.length > 0 ? `
        <div class="recommendations-group medium">
          <h5 style="color: #ffff00;">🟡 Medium Priority</h5>
          ${medium.map(rec => `
            <div class="recommendation-item medium">
              <div class="rec-header">
                <span class="rec-title">${rec.title}</span>
                ${rec.owaspRef ? `<span class="rec-owasp">OWASP: ${rec.owaspRef}</span>` : ''}
              </div>
              <div class="rec-description">${rec.description}</div>
              ${rec.solution ? `<div class="rec-solution"><strong>Solution:</strong> ${rec.solution}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${low.length > 0 ? `
        <div class="recommendations-group low">
          <h5 style="color: #00ccff;">🔵 Low Priority</h5>
          ${low.map(rec => `
            <div class="recommendation-item low">
              <div class="rec-header">
                <span class="rec-title">${rec.title}</span>
              </div>
              <div class="rec-description">${rec.description}</div>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Open PDF purchase modal
 */
function openPdfPurchaseModal(reportType) {
  if (!window.pdfPaymentModal) {
    console.error('PDF payment modal not initialized');
    return;
  }

  let reportData;
  switch (reportType) {
    case 'seo':
      reportData = window.currentSeoResults;
      break;
    case 'performance':
      reportData = window.currentPerformanceResults;
      break;
    case 'accessibility':
      reportData = window.currentAccessibilityResults;
      break;
    case 'security':
      reportData = window.currentSecurityResults;
      break;
    case 'fonts':
      reportData = window.currentFontResults;
      break;
    default:
      console.error('Unknown report type:', reportType);
      return;
  }

  if (!reportData) {
    console.error('No report data available for', reportType);
    return;
  }

  window.pdfPaymentModal.open(reportType, reportData, () => {
    console.log('PDF download successful!');
  });
}

// Helper: Get letter grade from score
function getGrade(score) {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 85) return 'A-';
  if (score >= 80) return 'B+';
  if (score >= 75) return 'B';
  if (score >= 70) return 'B-';
  if (score >= 65) return 'C+';
  if (score >= 60) return 'C';
  if (score >= 55) return 'C-';
  if (score >= 50) return 'D';
  return 'F';
}

// Helper: Get score color - Traditional traffic light system
// A grades (90-100): Green
// B grades (70-89): Yellow
// C grades (50-69): Orange
// Below C (<50): Red
function getScoreColor(score) {
  if (score >= 90) return '#00ff41';  // A: Bright green (terminal green)
  if (score >= 70) return '#ffd700';  // B: Yellow (gold)
  if (score >= 50) return '#ff8c00';  // C: Dark orange
  return '#ff4444';                   // D/F: Red
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
