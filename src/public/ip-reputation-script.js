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

  if (!input) {
    showError('Please enter a valid IP address or domain name');
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
      Comprehensive reputation check in progress...
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
        animation: color-cycle 4s linear infinite;
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
      label: 'Checking DNS blacklists',
      detail: 'Scanning major DNSBL databases...'
    },
    {
      label: 'Testing email deliverability',
      detail: 'Verifying SPF, DKIM, DMARC records...'
    },
    {
      label: 'Analyzing hosting reputation',
      detail: 'Checking ASN, geolocation, and ISP data...'
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

  loader.start(analysisSteps, '[IP REPUTATION ANALYZER]', 20);

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
            ${getGrade(data.overallScore)} Grade
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
    </div>
  `;

  resultsContent.innerHTML += summaryHtml;

  // Blacklist Details Section
  if (data.blacklists && data.blacklists.length > 0) {
    resultsContent.innerHTML += createBlacklistSection(data.blacklists);
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
}

// Create Blacklist Details Section
function createBlacklistSection(blacklists) {
  const listed = blacklists.filter(bl => bl.listed);
  const clean = blacklists.filter(bl => !bl.listed);

  return `
    <div class="section">
      <h2>🛡️ DNS Blacklist Status</h2>
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
    </div>
  `;
}

// Create Email Configuration Section
function createEmailSection(emailConfig) {
  return `
    <div class="section">
      <h2>📧 Email Deliverability</h2>

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
    </div>
  `;
}

// Create Hosting & Network Information Section
function createHostingSection(hostingInfo) {
  return `
    <div class="section">
      <h2>🌐 Hosting & Network Information</h2>

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
    </div>
  `;
}

// Create Threat Intelligence Section
function createThreatSection(threatIntel) {
  return `
    <div class="section">
      <h2>🛡️ Threat Intelligence</h2>

      <div style="background: ${threatIntel.hasThreats ? 'rgba(255, 68, 68, 0.1)' : 'rgba(0, 255, 65, 0.05)'}; border: 2px solid ${threatIntel.hasThreats ? '#ff4444' : 'rgba(0, 255, 65, 0.2)'}; border-radius: 8px; padding: 1.5rem; margin-top: 1.5rem;">
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
    </div>
  `;
}

// Create Recommendations Section
function createRecommendationsSection(recommendations) {
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const sorted = recommendations.sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  return `
    <div class="section">
      <h2>💡 Recommendations</h2>
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
    </div>
  `;
}

// Utility functions
function getScoreColor(score) {
  if (score >= 90) return '#00ff41'; // Excellent
  if (score >= 70) return '#00d9ff'; // Good
  if (score >= 50) return '#ffa500'; // Fair
  return '#ff4444'; // Poor
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
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

function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
}
