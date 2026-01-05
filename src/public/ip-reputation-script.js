// IP/Domain Reputation Analyzer JavaScript
// Frontend rendering and API interaction for reputation analysis

let currentResults = null;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  const analyzeButton = document.getElementById('analyzeButton');
  const urlInput = document.getElementById('urlInput');

  analyzeButton.addEventListener('click', () => analyzeReputation());

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeReputation();
    }
  });

  // Auto-start scan if URL parameter is present
  if (typeof window.getUrlParameter === 'function') {
    const autoUrl = window.getUrlParameter();
    if (autoUrl) {
      console.log('→ Auto-starting Reputation analysis for:', autoUrl);
      urlInput.value = autoUrl;
      setTimeout(() => {
        analyzeReputation();
      }, 500);
    }
  }
});

// Main analysis function
async function analyzeReputation() {
  const input = document.getElementById('urlInput').value.trim();
  const analyzeButton = document.getElementById('analyzeButton');

  if (!input) {
    showError('Please enter a valid IP address or domain name');
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
      Checking IP reputation and blocklist status...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(0, 255, 65, 0.7); padding: 0 0.5rem;">
      This may take 15-30 seconds
    </p>
  `;

  // Add color cycling style if not already added
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
      #patience-message {
        overflow: visible;
      }
      #patience-message > div {
        -webkit-overflow-scrolling: touch;
      }

      /* Hide ASCII art on very small screens */
      @media (max-width: 480px) {
        .ascii-art-responsive {
          display: none;
        }
        #patience-message > div {
          display: none;
        }
        #patience-message p:first-of-type {
          font-size: 1rem !important;
          margin-top: 0 !important;
        }
      }

      /* Further optimize for extra small screens */
      @media (max-width: 375px) {
        #patience-message {
          padding: 0.5rem !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  const analysisSteps = [
    {
      label: 'Resolving IP and domain info',
      detail: 'Performing DNS lookups and IP resolution...'
    },
    {
      label: 'Checking 25+ DNS blacklists',
      detail: 'Scanning Spamhaus, Barracuda, SpamCop, SORBS, and more...'
    },
    {
      label: 'Analyzing SSL/TLS certificate',
      detail: 'Verifying certificate validity, expiry, and security...'
    },
    {
      label: 'Scanning security ports',
      detail: 'Checking for exposed services and attack vectors...'
    },
    {
      label: 'Testing email deliverability',
      detail: 'Verifying SPF, DKIM, DMARC records...'
    },
    {
      label: 'Checking DNS health',
      detail: 'Analyzing NS, MX, CAA records and configuration...'
    },
    {
      label: 'Querying threat intelligence',
      detail: 'Scanning threat databases and security feeds...'
    },
    {
      label: 'Generating reputation report',
      detail: 'Compiling findings and recommendations...'
    }
  ];

  loader.start(analysisSteps, '[IP REPUTATION ANALYZER]', 25);

  // Insert ASCII art message after loader starts
  setTimeout(() => {
    const loadingContainer = document.getElementById('loadingContainer');
    if (loadingContainer && loaderMessageEl) {
      loadingContainer.insertBefore(loaderMessageEl, loadingContainer.firstChild);
    }
  }, 100);

  try {
    // Call reputation API
    const response = await fetch('/api/ip-reputation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Reputation analysis failed');
    }

    const results = await response.json();
    currentResults = results;

    // Complete the loader
    loader.complete();

    // Show results after animation completes
    setTimeout(() => {
      displayReputationResults(results);
      resultsDiv.classList.remove('hidden');
    }, 1000);

  } catch (error) {
    console.error('Reputation analysis error:', error);
    loader.showError(`Reputation analysis failed: ${error.message}`);
  } finally {
    // Reset button state
    const analyzeButton = document.getElementById('analyzeButton');
    analyzeButton.disabled = false;
    const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
    buttonText.textContent = 'Run scan';
  }
}

// Display complete reputation results
function displayReputationResults(data) {
  const resultsContent = document.getElementById('resultsContent');
  resultsContent.innerHTML = '';

  // Overall Reputation Summary with Circular Dials
  const summaryHtml = `
    <div class="summary-section security-summary-panel">
      <h2>◈ IP/Domain Reputation Summary</h2>

      <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
        <div style="display: grid; grid-template-columns: auto 1fr; gap: 0.5rem; font-family: 'JetBrains Mono', monospace; font-size: 0.9rem;">
          <span style="color: #00ff41;">Target:</span>
          <span style="color: #ffffff;">${data.input || 'N/A'}</span>
          <span style="color: #00ff41;">IP Address:</span>
          <span style="color: #ffffff;">${data.ipAddress || 'N/A'}</span>
          <span style="color: #00ff41;">Hostname:</span>
          <span style="color: #ffffff;">${data.hostname || 'N/A'}</span>
          <span style="color: #00ff41;">Timestamp:</span>
          <span style="color: #ffffff;">${new Date(data.timestamp).toLocaleString()}</span>
        </div>
      </div>

      <!-- Circular Progress Dials -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 2rem; margin: 2rem 0;">
        <!-- Overall Reputation Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Overall Reputation</div>
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

        <!-- Blacklist Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Blacklist Status</div>
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
              stroke="${getScoreColor(data.blacklistScore || 0)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${((data.blacklistScore || 0) / 100) * 471.24} 471.24"
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
              style="text-shadow: 0 0 18px ${getScoreColor(data.blacklistScore || 0)}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${data.blacklistScore || 0}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(data.blacklistScore || 0)}; font-weight: 600; font-size: 1.1rem;">
            ${data.blacklistStatus || 'Unknown'}
          </div>
        </div>

        <!-- Email Reputation Score -->
        <div style="text-align: center;">
          <div style="margin-bottom: 0.75rem; font-weight: 600; color: #ffffff;">Email Reputation</div>
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
              stroke="${getScoreColor(data.emailScore || 0)}"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="${((data.emailScore || 0) / 100) * 471.24} 471.24"
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
              style="text-shadow: 0 0 18px ${getScoreColor(data.emailScore || 0)}, 0 0 30px rgba(0,0,0,0.6);"
            >
              ${data.emailScore || 0}
            </text>
          </svg>
          <div style="margin-top: 0.5rem; color: ${getScoreColor(data.emailScore || 0)}; font-weight: 600; font-size: 1.1rem;">
            ${data.emailStatus || 'Unknown'}
          </div>
        </div>
      </div>

      <!-- Additional Score Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
        <!-- SSL Score -->
        <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.85rem; color: #808080; margin-bottom: 0.5rem;">🔒 SSL/TLS</div>
          <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(data.sslScore || 0)};">${data.sslScore || 0}</div>
          <div style="font-size: 0.8rem; color: ${getScoreColor(data.sslScore || 0)};">${data.sslStatus || 'N/A'}</div>
        </div>

        <!-- DNS Score -->
        <div style="background: rgba(153, 51, 255, 0.05); border: 1px solid rgba(153, 51, 255, 0.2); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.85rem; color: #808080; margin-bottom: 0.5rem;">🌐 DNS Health</div>
          <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(data.dnsScore || 0)};">${data.dnsScore || 0}</div>
          <div style="font-size: 0.8rem; color: ${getScoreColor(data.dnsScore || 0)};">${data.dnsStatus || 'N/A'}</div>
        </div>

        <!-- Port Security Score -->
        <div style="background: rgba(255, 165, 0, 0.05); border: 1px solid rgba(255, 165, 0, 0.2); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.85rem; color: #808080; margin-bottom: 0.5rem;">🔓 Port Security</div>
          <div style="font-size: 2rem; font-weight: bold; color: ${getScoreColor(data.portSecurityScore || 0)};">${data.portSecurityScore || 0}</div>
          <div style="font-size: 0.8rem; color: ${getScoreColor(data.portSecurityScore || 0)};">${data.portSecurityScore >= 90 ? 'Secure' : data.portSecurityScore >= 70 ? 'Good' : 'At Risk'}</div>
        </div>

        <!-- Analysis Time -->
        <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1rem; text-align: center;">
          <div style="font-size: 0.85rem; color: #808080; margin-bottom: 0.5rem;">⏱️ Analysis Time</div>
          <div style="font-size: 2rem; font-weight: bold; color: #00ff41;">${((data.analysisTime || 0) / 1000).toFixed(1)}s</div>
          <div style="font-size: 0.8rem; color: #00ff41;">${data.blacklists?.length || 0} checks</div>
        </div>
      </div>
    </div>
  `;

  resultsContent.innerHTML += summaryHtml;

  // Blacklist Details Section
  if (data.blacklists && data.blacklists.length > 0) {
    resultsContent.innerHTML += createBlacklistSection(data.blacklists);
  }

  // SSL Certificate Section
  if (data.sslCert) {
    resultsContent.innerHTML += createSSLSection(data.sslCert, data.sslScore);
  }

  // DNS Health Section
  if (data.dnsHealth) {
    resultsContent.innerHTML += createDNSHealthSection(data.dnsHealth, data.dnsScore);
  }

  // Port Security Section
  if (data.portScan) {
    resultsContent.innerHTML += createPortSecuritySection(data.portScan);
  }

  // Email Configuration Section
  if (data.emailConfig) {
    resultsContent.innerHTML += createEmailSection(data.emailConfig);
  }

  // Hosting & Network Information Section
  if (data.hostingInfo) {
    resultsContent.innerHTML += createHostingSection(data.hostingInfo);
  }

  // Threat Intelligence Section
  if (data.threatIntel) {
    resultsContent.innerHTML += createThreatSection(data.threatIntel);
  }

  // Recommendations Section
  if (data.recommendations && data.recommendations.length > 0) {
    resultsContent.innerHTML += createRecommendationsSection(data.recommendations);
  }

  // Add PDF Export Button
  resultsContent.innerHTML += `
    <div class="section" style="text-align: center; margin-top: 2rem; padding: 2rem; border-top: 1px solid rgba(255,255,255,0.1);">
      <h3 style="margin-bottom: 1.5rem; color: var(--text-primary);">Export Report</h3>
      <button id="exportPdfBtn" class="export-pdf-btn" style="
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1.5rem;
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        border-radius: 8px;
        color: #ef4444;
        cursor: pointer;
        font-weight: 600;
        font-size: 0.95rem;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Download PDF Report
      </button>
    </div>
  `;
}

// Create Blacklist Details Section
function createBlacklistSection(blacklists) {
  const listed = blacklists.filter(bl => bl.listed);
  const clean = blacklists.filter(bl => !bl.listed);
  
  const score = Math.round((clean.length / blacklists.length) * 100);

  const content = `
    <p style="color: #808080; margin-bottom: 1.5rem;">Checked against ${blacklists.length} major DNSBL databases</p>

    ${listed.length > 0 ? `
      <div style="background: rgba(255, 68, 68, 0.1); border: 2px solid #ff4444; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="color: #ff4444; margin-top: 0;">⚠️ Listed on ${listed.length} Blacklist(s)</h3>
        <div style="display: grid; gap: 1rem;">
          ${listed.map(bl => `
            <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 4px;">
              <div style="font-weight: 600; color: #ff4444; margin-bottom: 0.5rem;">${bl.name}</div>
              <div style="color: #ffffff; font-size: 0.9rem;">${bl.description || 'This IP/domain is listed on this blacklist'}</div>
              ${bl.details ? `<div style="color: #808080; font-size: 0.85rem; margin-top: 0.5rem;">${bl.details}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: #00ff41; margin-top: 0;">✓ Clean on ${clean.length} Blacklist(s)</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${clean.map(bl => `
          <span style="background: rgba(0, 255, 65, 0.1); border: 1px solid rgba(0, 255, 65, 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: #00ff41;">
            ${bl.name}
          </span>
        `).join('')}
      </div>
    </div>
  `;

  return createAccordionSection('blacklist', '🛡️', 'DNS Blacklist Status', content, score);
}

// Create Email Configuration Section
function createEmailSection(emailConfig) {
  const content = `
    <div style="display: grid; gap: 1.5rem; margin-top: 1.5rem;">
        <!-- SPF Record -->
        <div style="background: rgba(0, 0, 0, 0.3); border-left: 4px solid ${emailConfig.spf?.valid ? '#00ff41' : '#ff4444'}; padding: 1rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; color: #ffffff;">SPF (Sender Policy Framework)</h3>
            <span style="background: ${emailConfig.spf?.valid ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.spf?.valid ? '#00ff41' : '#ff4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
              ${emailConfig.spf?.valid ? '✓ Valid' : '✗ Missing/Invalid'}
            </span>
          </div>
          <div style="color: #cccccc; font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
            ${emailConfig.spf?.record || 'No SPF record found'}
          </div>
          ${emailConfig.spf?.issues ? `<div style="color: #ffa500; margin-top: 0.5rem; font-size: 0.85rem;">⚠️ ${emailConfig.spf.issues}</div>` : ''}
        </div>

        <!-- DKIM Record -->
        <div style="background: rgba(0, 0, 0, 0.3); border-left: 4px solid ${emailConfig.dkim?.valid ? '#00ff41' : '#ffa500'}; padding: 1rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; color: #ffffff;">DKIM (DomainKeys Identified Mail)</h3>
            <span style="background: ${emailConfig.dkim?.valid ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 165, 0, 0.2)'}; color: ${emailConfig.dkim?.valid ? '#00ff41' : '#ffa500'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
              ${emailConfig.dkim?.valid ? '✓ Configured' : 'ℹ️ Check Required'}
            </span>
          </div>
          <div style="color: #cccccc; font-size: 0.9rem;">
            ${emailConfig.dkim?.status || 'DKIM requires selector-specific lookup'}
          </div>
        </div>

        <!-- DMARC Record -->
        <div style="background: rgba(0, 0, 0, 0.3); border-left: 4px solid ${emailConfig.dmarc?.valid ? '#00ff41' : '#ff4444'}; padding: 1rem; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; color: #ffffff;">DMARC (Domain-based Message Authentication)</h3>
            <span style="background: ${emailConfig.dmarc?.valid ? 'rgba(0, 255, 65, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.dmarc?.valid ? '#00ff41' : '#ff4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
              ${emailConfig.dmarc?.valid ? '✓ Valid' : '✗ Missing/Invalid'}
            </span>
          </div>
          <div style="color: #cccccc; font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
            ${emailConfig.dmarc?.record || 'No DMARC record found'}
          </div>
          ${emailConfig.dmarc?.policy ? `<div style="color: #00d9ff; margin-top: 0.5rem; font-size: 0.85rem;">Policy: ${emailConfig.dmarc.policy}</div>` : ''}
        </div>
      </div>
  `;

  // Calculate score based on SPF, DKIM, DMARC validity
  let score = 0;
  if (emailConfig.spf?.valid) score += 40;
  if (emailConfig.dkim?.valid) score += 30;
  if (emailConfig.dmarc?.valid) score += 30;

  return createAccordionSection('email-deliverability', '📧', 'Email Deliverability', content, score);
}

// Create Hosting & Network Information Section
function createHostingSection(hostingInfo) {
  const content = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
        <!-- Location Info -->
        <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #00ff41; margin-top: 0;">📍 Location</h3>
          <div style="display: grid; gap: 0.5rem;">
            <div style="color: #ffffff;"><span style="color: #808080;">Country:</span> ${hostingInfo.country || 'Unknown'} ${hostingInfo.countryCode ? `(${hostingInfo.countryCode})` : ''}</div>
            ${hostingInfo.city ? `<div style="color: #ffffff;"><span style="color: #808080;">City:</span> ${hostingInfo.city}</div>` : ''}
            ${hostingInfo.region ? `<div style="color: #ffffff;"><span style="color: #808080;">Region:</span> ${hostingInfo.region}</div>` : ''}
            ${hostingInfo.timezone ? `<div style="color: #ffffff;"><span style="color: #808080;">Timezone:</span> ${hostingInfo.timezone}</div>` : ''}
          </div>
        </div>

        <!-- ISP Info -->
        <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #00d9ff; margin-top: 0;">🔌 ISP/Hosting</h3>
          <div style="display: grid; gap: 0.5rem;">
            <div style="color: #ffffff;"><span style="color: #808080;">Provider:</span> ${hostingInfo.isp || 'Unknown'}</div>
            ${hostingInfo.org ? `<div style="color: #ffffff;"><span style="color: #808080;">Organization:</span> ${hostingInfo.org}</div>` : ''}
            ${hostingInfo.asn ? `<div style="color: #ffffff;"><span style="color: #808080;">ASN:</span> ${hostingInfo.asn}</div>` : ''}
            ${hostingInfo.asnName ? `<div style="color: #ffffff;"><span style="color: #808080;">AS Name:</span> ${hostingInfo.asnName}</div>` : ''}
          </div>
        </div>

        <!-- Network Type -->
        ${hostingInfo.isProxy !== undefined || hostingInfo.isVpn !== undefined || hostingInfo.isTor !== undefined ? `
          <div style="background: rgba(255, 165, 0, 0.05); border: 1px solid rgba(255, 165, 0, 0.2); border-radius: 8px; padding: 1.5rem;">
            <h3 style="color: #ffa500; margin-top: 0;">🔒 Network Type</h3>
            <div style="display: grid; gap: 0.5rem;">
              ${hostingInfo.isProxy !== undefined ? `<div style="color: #ffffff;"><span style="color: #808080;">Proxy:</span> ${hostingInfo.isProxy ? '⚠️ Yes' : '✓ No'}</div>` : ''}
              ${hostingInfo.isVpn !== undefined ? `<div style="color: #ffffff;"><span style="color: #808080;">VPN:</span> ${hostingInfo.isVpn ? '⚠️ Yes' : '✓ No'}</div>` : ''}
              ${hostingInfo.isTor !== undefined ? `<div style="color: #ffffff;"><span style="color: #808080;">Tor:</span> ${hostingInfo.isTor ? '⚠️ Yes' : '✓ No'}</div>` : ''}
              ${hostingInfo.isHosting !== undefined ? `<div style="color: #ffffff;"><span style="color: #808080;">Hosting:</span> ${hostingInfo.isHosting ? 'Yes' : 'No'}</div>` : ''}
            </div>
          </div>
        ` : ''}
      </div>
  `;

  return createAccordionSection('hosting-network', '🌐', 'Hosting & Network Information', content);
}

// Create Threat Intelligence Section
function createThreatSection(threatIntel) {
  const content = `
    <div style="background: ${threatIntel.hasThreats ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 65, 0.05)'}; border: 2px solid ${threatIntel.hasThreats ? '#ff4444' : 'rgba(0, 255, 65, 0.2)'}; border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: ${threatIntel.hasThreats ? '#ff4444' : '#00ff41'}; margin-top: 0;">
          ${threatIntel.hasThreats ? '⚠️ Threats Detected' : '✓ No Known Threats'}
        </h3>

        ${threatIntel.threats && threatIntel.threats.length > 0 ? `
          <div style="display: grid; gap: 1rem; margin-top: 1rem;">
            ${threatIntel.threats.map(threat => `
              <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 4px;">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 0.5rem;">
                  <div style="font-weight: 600; color: #ffffff;">${threat.type}</div>
                  <span style="background: ${getSeverityColor(threat.severity)}; color: #000000; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 1rem;">
                    ${threat.severity.toUpperCase()}
                  </span>
                </div>
                <div style="color: #cccccc; font-size: 0.9rem;">${threat.description}</div>
                ${threat.source ? `<div style="color: #808080; font-size: 0.85rem; margin-top: 0.5rem;">Source: ${threat.source}</div>` : ''}
              </div>
            `).join('')}
          </div>
        ` : `
          <p style="color: #00ff41; margin-top: 1rem;">
            No known malicious activity or security threats associated with this IP/domain.
          </p>
        `}

        ${threatIntel.riskLevel ? `
          <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(0, 0, 0, 0.3); border-radius: 4px;">
            <div style="color: #ffffff; font-weight: 600; margin-bottom: 0.5rem;">Risk Assessment</div>
            <div style="color: #cccccc;">Overall Risk Level: <span style="color: ${getRiskColor(threatIntel.riskLevel)}; font-weight: 600;">${threatIntel.riskLevel.toUpperCase()}</span></div>
          </div>
        ` : ''}
      </div>
  `;

  // Calculate score: 100 if no threats, reduce based on severity
  let score = 100;
  if (threatIntel.hasThreats && threatIntel.threats) {
    threatIntel.threats.forEach(threat => {
      if (threat.severity === 'critical') score -= 40;
      else if (threat.severity === 'high') score -= 25;
      else if (threat.severity === 'medium') score -= 15;
      else if (threat.severity === 'low') score -= 5;
    });
    score = Math.max(0, score);
  }

  return createAccordionSection('threat-intelligence', '🛡️', 'Threat Intelligence', content, score);
}

// Create Recommendations Section
function createRecommendationsSection(recommendations) {
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const sorted = recommendations.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const content = `
    <div style="display: grid; gap: 1rem; margin-top: 1.5rem;">
        ${sorted.map(rec => `
          <div style="background: rgba(0, 0, 0, 0.3); border-left: 4px solid ${getPriorityColor(rec.priority)}; padding: 1.5rem; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="margin: 0; color: #ffffff;">${rec.title}</h3>
              <span style="background: ${getPriorityColor(rec.priority)}; color: #000000; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                ${rec.priority.toUpperCase()}
              </span>
            </div>
            <div style="color: #cccccc; margin-bottom: 1rem;">${rec.description}</div>
            ${rec.action ? `
              <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); padding: 1rem; border-radius: 4px; margin-bottom: 1rem;">
                <div style="color: #00ff41; font-weight: 600; margin-bottom: 0.5rem;">Action Required:</div>
                <div style="color: #ffffff; font-size: 0.9rem;">${rec.action}</div>
              </div>
            ` : ''}
            ${rec.impact ? `
              <div style="color: #808080; font-size: 0.85rem;">
                <strong>Impact:</strong> ${rec.impact}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
  `;

  return createAccordionSection('recommendations', '💡', 'Recommendations', content);
}

// Utility functions
function getScoreColor(score) {
  if (score >= 90) return '#00ff41'; // Excellent
  if (score >= 70) return '#00d9ff'; // Good
  if (score >= 50) return '#ffa500'; // Fair
  return '#ff4444'; // Poor
}

// Standard: Excellent (90-100), Good (75-89), Needs Work (50-74), Critical (<50)
function getGrade(score) {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical';
}

function getStatus(score) {
  return getGrade(score);
}

function getPriorityColor(priority) {
  switch (priority.toLowerCase()) {
    case 'high': return '#ff4444';
    case 'medium': return '#ffa500';
    case 'low': return '#00d9ff';
    default: return '#808080';
  }
}

function getSeverityColor(severity) {
  switch (severity.toLowerCase()) {
    case 'critical': return '#ff0000';
    case 'high': return '#ff4444';
    case 'medium': return '#ffa500';
    case 'low': return '#ffff00';
    default: return '#808080';
  }
}

function getRiskColor(risk) {
  switch (risk.toLowerCase()) {
    case 'critical': return '#ff0000';
    case 'high': return '#ff4444';
    case 'medium': return '#ffa500';
    case 'low': return '#00ff41';
    case 'minimal': return '#00ff41';
    default: return '#808080';
  }
}

// Create SSL Certificate Section
function createSSLSection(sslCert, sslScore) {
  if (!sslCert) return '';

  const isValid = sslCert.valid;
  const statusColor = isValid ? '#00ff41' : '#ff4444';

  const content = `
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
        <!-- Certificate Status -->
        <div style="background: rgba(${isValid ? '0, 255, 65' : '255, 68, 68'}, 0.05); border: 1px solid ${statusColor}40; border-radius: 8px; padding: 1.5rem; text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">${isValid ? '✅' : '❌'}</div>
          <div style="color: ${statusColor}; font-weight: 600; font-size: 1.2rem;">${isValid ? 'Valid Certificate' : 'Invalid/Missing'}</div>
          <div style="color: #808080; font-size: 0.9rem; margin-top: 0.5rem;">Score: ${sslScore || 0}/100</div>
        </div>

        ${isValid ? `
        <!-- Certificate Details -->
        <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #00d9ff; margin-top: 0;">📋 Certificate Details</h3>
          <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
            <div><span style="color: #808080;">Issuer:</span> <span style="color: #fff;">${sslCert.issuer}</span></div>
            <div><span style="color: #808080;">Subject:</span> <span style="color: #fff;">${sslCert.subject}</span></div>
            <div><span style="color: #808080;">Protocol:</span> <span style="color: ${sslCert.protocol === 'TLSv1.3' ? '#00ff41' : sslCert.protocol === 'TLSv1.2' ? '#00d9ff' : '#ffa500'};">${sslCert.protocol}</span></div>
            <div><span style="color: #808080;">Cipher:</span> <span style="color: #fff;">${sslCert.cipher || 'N/A'}</span></div>
          </div>
        </div>

        <!-- Expiry Info -->
        <div style="background: rgba(${sslCert.daysUntilExpiry > 30 ? '0, 255, 65' : sslCert.daysUntilExpiry > 14 ? '255, 165, 0' : '255, 68, 68'}, 0.05); border: 1px solid rgba(${sslCert.daysUntilExpiry > 30 ? '0, 255, 65' : sslCert.daysUntilExpiry > 14 ? '255, 165, 0' : '255, 68, 68'}, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: ${sslCert.daysUntilExpiry > 30 ? '#00ff41' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ff4444'}; margin-top: 0;">⏰ Validity Period</h3>
          <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
            <div><span style="color: #808080;">Valid From:</span> <span style="color: #fff;">${new Date(sslCert.validFrom).toLocaleDateString()}</span></div>
            <div><span style="color: #808080;">Valid Until:</span> <span style="color: #fff;">${new Date(sslCert.validTo).toLocaleDateString()}</span></div>
            <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px; text-align: center;">
              <span style="font-size: 1.5rem; font-weight: bold; color: ${sslCert.daysUntilExpiry > 30 ? '#00ff41' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ff4444'};">${sslCert.daysUntilExpiry}</span>
              <span style="color: #808080;"> days remaining</span>
            </div>
          </div>
        </div>
        ` : `
        <div style="background: rgba(255, 68, 68, 0.05); border: 1px solid rgba(255, 68, 68, 0.2); border-radius: 8px; padding: 1.5rem; grid-column: span 2;">
          <h3 style="color: #ff4444; margin-top: 0;">⚠️ Certificate Issue</h3>
          <p style="color: #cccccc;">${sslCert.error || 'SSL certificate could not be verified'}</p>
        </div>
        `}
      </div>

      ${sslCert.selfSigned ? `
        <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 4px;">
          <span style="color: #ffa500;">⚠️ Self-Signed Certificate:</span> <span style="color: #cccccc;">This certificate is self-signed and will show warnings in browsers.</span>
        </div>
      ` : ''}
  `;
  
  return createAccordionSection('ssl', '🔒', 'SSL/TLS Certificate', content, sslScore);
}

// Create DNS Health Section
function createDNSHealthSection(dnsHealth, dnsScore) {
  if (!dnsHealth) return '';

  const content = `
    <p style="color: #808080; margin-bottom: 1.5rem;">DNS configuration and infrastructure analysis</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">\n      <!-- NS Records -->
        <!-- NS Records -->
        <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #00ff41; margin-top: 0;">📡 Nameservers</h3>
          ${dnsHealth.nsRecords && dnsHealth.nsRecords.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
              ${dnsHealth.nsRecords.map(ns => `
                <span style="background: rgba(0, 255, 65, 0.1); border: 1px solid rgba(0, 255, 65, 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: #00ff41; font-family: monospace;">
                  ${ns}
                </span>
              `).join('')}
            </div>
            <div style="margin-top: 0.75rem; color: ${dnsHealth.nsRecords.length >= 2 ? '#00ff41' : '#ffa500'}; font-size: 0.85rem;">
              ${dnsHealth.nsRecords.length >= 2 ? '✓ Redundancy: OK' : '⚠️ Add more nameservers for redundancy'}
            </div>
          ` : '<p style="color: #808080;">No NS records found</p>'}
        </div>

        <!-- MX Records -->
        <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #00d9ff; margin-top: 0;">📧 Mail Servers (MX)</h3>
          ${dnsHealth.mxRecords && dnsHealth.mxRecords.length > 0 ? `
            <div style="display: grid; gap: 0.5rem;">
              ${dnsHealth.mxRecords.slice(0, 5).map(mx => `
                <div style="display: flex; justify-content: space-between; background: rgba(0, 0, 0, 0.3); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                  <span style="color: #fff; font-family: monospace;">${mx.exchange}</span>
                  <span style="color: #00d9ff;">Priority: ${mx.priority}</span>
                </div>
              `).join('')}
            </div>
          ` : '<p style="color: #808080;">No MX records found (email may not be configured)</p>'}
        </div>

        <!-- CAA Records -->
        <div style="background: rgba(153, 51, 255, 0.05); border: 1px solid rgba(153, 51, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #9933ff; margin-top: 0;">🔐 CAA Records</h3>
          ${dnsHealth.hasCAA ? `
            <div style="display: grid; gap: 0.5rem;">
              ${dnsHealth.caaRecords.map(caa => `
                <div style="background: rgba(0, 0, 0, 0.3); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem; color: #fff;">
                  ${caa.issue || caa.issuewild || 'CAA record'}
                </div>
              `).join('')}
            </div>
            <div style="margin-top: 0.75rem; color: #00ff41; font-size: 0.85rem;">✓ CAA configured</div>
          ` : `
            <p style="color: #808080;">No CAA records found</p>
            <div style="margin-top: 0.75rem; color: #ffa500; font-size: 0.85rem;">⚠️ Consider adding CAA to restrict certificate issuance</div>
          `}
        </div>
      </div>

      ${dnsHealth.issues && dnsHealth.issues.length > 0 ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 8px;">
          <h4 style="color: #ffa500; margin: 0 0 0.75rem 0;">⚠️ DNS Issues Detected</h4>
          <ul style="margin: 0; padding-left: 1.5rem; color: #cccccc;">
            ${dnsHealth.issues.map(issue => `<li style="margin-bottom: 0.5rem;">${issue}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
  `;

  return createAccordionSection('dns-health', '🌐', 'DNS Health', content, dnsScore);
}

// Create Port Security Section
function createPortSecuritySection(portScan) {
  if (!portScan || !portScan.scanned) return '';

  const openPorts = portScan.openPorts || [];
  const hasIssues = portScan.securityIssues && portScan.securityIssues.length > 0;

  const content = `
    <p style="color: #808080; margin-bottom: 1.5rem;">Scanning common security-sensitive ports for exposure</p>

    ${hasIssues ? `
      <div style="background: rgba(255, 68, 68, 0.1); border: 2px solid #ff4444; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="color: #ff4444; margin-top: 0;">⚠️ Security Issues Found</h3>
        <div style="display: grid; gap: 1rem;">
          ${portScan.securityIssues.map(issue => `
            <div style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: 4px; border-left: 4px solid ${issue.severity === 'critical' ? '#ff0000' : issue.severity === 'high' ? '#ff4444' : '#ffa500'};">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; color: #ffffff;">Port ${issue.port} (${issue.service})</span>
                <span style="background: ${issue.severity === 'critical' ? '#ff0000' : issue.severity === 'high' ? '#ff4444' : '#ffa500'}; color: #000; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">
                  ${issue.severity.toUpperCase()}
                </span>
              </div>
              <div style="color: #cccccc; font-size: 0.9rem;">${issue.description}</div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : `
      <div style="background: rgba(0, 255, 65, 0.05); border: 1px solid rgba(0, 255, 65, 0.2); border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">✅</div>
        <div style="color: #00ff41; font-weight: 600;">No Critical Exposed Services</div>
        <div style="color: #808080; font-size: 0.9rem; margin-top: 0.5rem;">No high-risk ports detected as publicly accessible</div>
      </div>
    `}

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.75rem;">
      ${openPorts.length > 0 ? openPorts.map(port => `
        <div style="background: rgba(${port.risk === 'critical' ? '255, 0, 0' : port.risk === 'high' ? '255, 68, 68' : port.risk === 'medium' ? '255, 165, 0' : '0, 217, 255'}, 0.1); border: 1px solid rgba(${port.risk === 'critical' ? '255, 0, 0' : port.risk === 'high' ? '255, 68, 68' : port.risk === 'medium' ? '255, 165, 0' : '0, 217, 255'}, 0.3); padding: 0.75rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.25rem; font-weight: bold; color: #fff;">${port.port}</div>
          <div style="font-size: 0.8rem; color: #808080;">${port.name}</div>
          <div style="font-size: 0.7rem; color: #00ff41; margin-top: 0.25rem;">OPEN</div>
        </div>
      `).join('') : `
        <div style="grid-column: span 6; text-align: center; color: #808080; padding: 1rem;">
          No commonly-attacked ports found open
        </div>
      `}
    </div>

    <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(0, 0, 0, 0.3); border-radius: 4px; font-size: 0.85rem; color: #808080;">
      <strong>Scanned Ports:</strong> FTP (21), SSH (22), Telnet (23), SMTP (25), HTTP (80), HTTPS (443), SMB (445), MySQL (3306), RDP (3389), PostgreSQL (5432), Redis (6379), MongoDB (27017)
    </div>
  `;

  // Calculate score: 100 if no issues, otherwise reduce based on severity
  let score = 100;
  if (hasIssues) {
    portScan.securityIssues.forEach(issue => {
      if (issue.severity === 'critical') score -= 30;
      else if (issue.severity === 'high') score -= 20;
      else if (issue.severity === 'medium') score -= 10;
    });
    score = Math.max(0, score);
  }

  return createAccordionSection('port-security', '🔓', 'Port Security Scan', content, score);
}

function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}

// Helper function to create accordion sections
function createAccordionSection(id, icon, title, contentHTML, score = null) {
  const accordionId = `accordion-${id}`;
  
  return `
    <div class="accordion" style="margin-bottom: 0.5rem;">
      <button class="accordion-header" onclick="toggleIPAccordion('${accordionId}')">
        <span>${icon} ${title}</span>
        <span style="display: flex; align-items: center; gap: 0.5rem;">
          ${score !== null ? `<span style="color: ${getScoreColor(score)}; font-size: 0.9rem;">${score}/100</span>` : ''}
          <span class="accordion-toggle" id="${accordionId}-toggle">▼</span>
        </span>
      </button>
      <div class="accordion-content" id="${accordionId}" style="max-height: 0; padding: 0; overflow: hidden; border-top: none; transition: max-height 0.3s ease, padding 0.3s ease;">
        <div class="accordion-content-inner">
          ${contentHTML}
        </div>
      </div>
    </div>
  `;
}

// Toggle accordion function
function toggleIPAccordion(accordionId) {
  const content = document.getElementById(accordionId);
  const toggle = document.getElementById(accordionId + '-toggle');
  
  if (!content || !toggle) return;
  
  const isExpanded = content.style.maxHeight !== '0px' && content.style.maxHeight !== '';
  
  if (isExpanded) {
    content.style.maxHeight = '0';
    content.style.padding = '0';
    content.style.borderTop = 'none';
    toggle.textContent = '▼';
  } else {
    content.style.maxHeight = content.scrollHeight + 'px';
    content.style.padding = '1rem 1.25rem';
    content.style.borderTop = '1px solid #333';
    toggle.textContent = '▲';
  }
}

/**
 * Initialize PDF Export for IP Reputation Analyzer
 */
function initIPReputationPDFExport() {
  if (typeof initPDFExport === 'function') {
    initPDFExport({
      contentSelector: '#results, #resultsContent, .results-container',
      buttonSelector: '#exportPdfBtn, .export-pdf-btn, #downloadPdfButton',
      reportSubtitle: 'IP Reputation & Security Analysis',
      urlInputSelector: '#urlInput, input[type="url"], input[type="text"]',
      filename: `ip-reputation-${new Date().toISOString().split('T')[0]}.pdf`
    });
    console.log('IP Reputation Analyzer PDF export initialized');
  } else {
    console.warn('PDF export utility not loaded');
  }
}

// Initialize PDF export when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIPReputationPDFExport);
} else {
  initIPReputationPDFExport();
}
