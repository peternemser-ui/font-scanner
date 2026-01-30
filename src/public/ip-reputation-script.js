// IP/Domain Reputation Analyzer JavaScript
// Frontend rendering and API interaction for reputation analysis

// Deterministic analyzer key (stable forever)
window.SM_ANALYZER_KEY = 'ip-reputation';

// Expose displayReputationResults globally EARLY so report-ui.js can find it during billing return
// (function declarations are hoisted, so displayReputationResults exists even though it's defined below)
window.displayReputationResults = displayReputationResults;

let currentResults = null;
// Also expose as window.currentResults for PricingModal to find
Object.defineProperty(window, 'currentResults', {
  get: () => currentResults,
  set: (val) => { currentResults = val; }
});

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  document.body.setAttribute('data-sm-analyzer-key', window.SM_ANALYZER_KEY);
  const analyzeButton = document.getElementById('analyzeButton');
  const urlInput = document.getElementById('urlInput');

  analyzeButton.addEventListener('click', () => analyzeReputation());

  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      analyzeReputation();
    }
  });

  // Check for stored report or auto-start scan
  (async function initFromUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const reportId = params.get('report_id') || '';
    const autoUrl = params.get('url') || (typeof window.getUrlParameter === 'function' ? window.getUrlParameter() : '');
    const billingSuccess = params.get('billing_success') === 'true';

    console.log('[IP Reputation] initFromUrlParams starting:', { reportId, autoUrl, billingSuccess });

    // If we have a report_id, set it immediately so hasAccess checks work
    if (reportId) {
      document.body.setAttribute('data-report-id', reportId);
    }

    // Fill URL input if we have a URL
    if (autoUrl) {
      urlInput.value = autoUrl;
    }

    // If returning from billing, wait for billing return processing to complete
    // This ensures the purchase is verified before we try to display the report
    if (billingSuccess && !window.__smBillingReturnComplete) {
      console.log('[IP Reputation] Waiting for billing return processing...');
      await new Promise(resolve => {
        if (window.__smBillingReturnComplete) {
          resolve();
          return;
        }
        const handler = () => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        };
        window.addEventListener('sm:billingReturnComplete', handler);
        // Timeout fallback in case event is missed
        setTimeout(() => {
          window.removeEventListener('sm:billingReturnComplete', handler);
          resolve();
        }, 5000);
      });
      console.log('[IP Reputation] Billing return processing complete');
      // After billing return, report-ui.js should have displayed the report
      // Show results container if it was hidden
      const resultsDiv = document.getElementById('results');
      if (resultsDiv) resultsDiv.classList.remove('hidden');
      return;
    }

    // Recovery: Check sessionStorage for checkout data when billing params are missing from URL
    // This handles cases where Stripe redirect loses the URL parameters
    const checkoutReportId = sessionStorage.getItem('sm_checkout_report_id');
    const checkoutUrl = sessionStorage.getItem('sm_checkout_url');
    if (checkoutReportId && checkoutUrl && !billingSuccess && !reportId) {
      console.log('[IP Reputation] Found checkout data in sessionStorage, checking if purchase completed...', { checkoutReportId, checkoutUrl });

      // Fetch billing status to verify purchase
      if (window.ProReportBlock?.fetchBillingStatus) {
        await window.ProReportBlock.fetchBillingStatus(true);

        if (window.ProReportBlock.hasAccess(checkoutReportId)) {
          console.log('[IP Reputation] Purchase confirmed! Attempting to load stored report...');
          document.body.setAttribute('data-report-id', checkoutReportId);
          urlInput.value = checkoutUrl;

          // Try to load from database storage
          if (window.ReportStorage) {
            const loaded = await window.ReportStorage.tryLoadAndDisplay(checkoutReportId, displayReputationResults);
            if (loaded) {
              console.log('[IP Reputation] Stored report loaded successfully after recovery');
              const resultsDiv = document.getElementById('results');
              if (resultsDiv) resultsDiv.classList.remove('hidden');
              sessionStorage.removeItem('sm_checkout_url');
              sessionStorage.removeItem('sm_checkout_report_id');
              return;
            }
          }

          // If no stored report, run scan with preserved report ID
          console.log('[IP Reputation] No stored report found, running scan with preserved report ID');
          sessionStorage.removeItem('sm_checkout_url');
          sessionStorage.removeItem('sm_checkout_report_id');
          setTimeout(() => analyzeReputation({ preserveReportId: true }), 500);
          return;
        } else {
          console.log('[IP Reputation] Purchase not confirmed, clearing checkout data');
          sessionStorage.removeItem('sm_checkout_url');
          sessionStorage.removeItem('sm_checkout_report_id');
        }
      }
    }

    // If we have a report_id (not from billing return), try to load the stored report first
    if (reportId && window.ReportStorage) {
      console.log('[IP Reputation] Checking for stored report:', reportId);

      // Fetch billing status to ensure we have access
      if (window.ProReportBlock?.fetchBillingStatus) {
        console.log('[IP Reputation] Fetching billing status for report recall...');
        await window.ProReportBlock.fetchBillingStatus(true);
        console.log('[IP Reputation] Billing status fetched, hasAccess:', window.ProReportBlock.hasAccess(reportId));
      }

      const loaded = await window.ReportStorage.tryLoadAndDisplay(reportId, displayReputationResults);
      if (loaded) {
        console.log('[IP Reputation] Stored report loaded successfully');
        // Show results container
        const resultsDiv = document.getElementById('results');
        if (resultsDiv) resultsDiv.classList.remove('hidden');
        return; // Don't auto-scan
      } else {
        console.log('[IP Reputation] No stored report found or failed to load');

        // If user has purchased this report but no stored data, auto-run scan
        if (autoUrl && window.ProReportBlock?.hasAccess && window.ProReportBlock.hasAccess(reportId)) {
          console.log('[IP Reputation] User has access but no stored report - auto-running scan');
          setTimeout(() => {
            analyzeReputation({ preserveReportId: true });
          }, 500);
          return;
        }
      }
    }

    // Auto-start scan if URL parameter is present and no stored report was loaded
    if (autoUrl && !reportId) {
      setTimeout(() => {
        analyzeReputation();
      }, 500);
    }
  })();
});

// Main analysis function
async function analyzeReputation(options = {}) {
  const input = document.getElementById('urlInput').value.trim();
  const analyzeButton = document.getElementById('analyzeButton');

  if (!input) {
    showError('Please enter a valid IP address or domain name');
    return;
  }

  // If this is a recovery scan (after purchase), preserve the report ID
  // Otherwise, clear old report ID when starting a NEW scan
  if (!options.preserveReportId) {
    document.body.removeAttribute('data-report-id');
    const currentParams = new URLSearchParams(window.location.search);
    if (currentParams.has('report_id')) {
      currentParams.delete('report_id');
      currentParams.delete('billing_success');
      const cleanUrl = `${window.location.pathname}${currentParams.toString() ? `?${currentParams.toString()}` : ''}`;
      window.history.replaceState({}, document.title, cleanUrl);
      console.log('[IP Reputation] Cleared old report_id for new scan');
    }
  } else {
    console.log('[IP Reputation] Preserving report_id for recovery scan:', document.body.getAttribute('data-report-id'));
  }

  // Update button state
  analyzeButton.disabled = true;
  const buttonText = analyzeButton.querySelector('#buttonText') || analyzeButton;
  buttonText.textContent = 'Analyzing...';

  // Setup UI
  const resultsDiv = document.getElementById('results');
  const errorMessage = document.getElementById('errorMessage');

  // For recalled scans (loaded from storage), report_id would be on the body
  // For new scans, we generate a fresh one
  const preservedReportId = document.body.getAttribute('data-report-id') || '';

  // Clear report metadata from previous scans (but preserve URL-based report_id)
  if (!preservedReportId) {
    document.body.removeAttribute('data-report-id');
  }
  document.body.removeAttribute('data-sm-screenshot-url');
  document.body.removeAttribute('data-sm-scan-started-at');

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
    background: rgba(var(--accent-primary-rgb), 0.05);
    border: 1px solid rgba(var(--accent-primary-rgb), 0.3);
    border-radius: 6px;
    text-align: center;
    overflow: visible;
  `;
  loaderMessageEl.innerHTML = `
    <div style="overflow-x: auto; overflow-y: visible; -webkit-overflow-scrolling: touch;">
      <pre class="ascii-art-responsive" style="margin: 0 auto; font-size: 0.65rem; line-height: 1.1; color: var(--accent-primary); font-family: monospace; text-shadow: 2px 2px 0px rgba(var(--accent-primary-rgb), 0.3), 3px 3px 0px rgba(0, 200, 50, 0.2), 4px 4px 0px rgba(0, 150, 35, 0.1); display: inline-block; text-align: left;">
   ___   __    ____  ___   ___  ____     ___   ____     ___   ___   ______  ____  ____  _  __  ______
  / _ \\ / /   / __/ / _ | / __/ / __/    / _ ) / __/    / _ \\ / _ | /_  __/ /  _/ / __/ / |/ / /_  __/
 / ___// /__ / _/  / __ |/_  /  / _/     / _  |/ _/     / ___// __ |  / /   _/ /  / _/  /    /   / /
/_/   /____//___/ /_/ |_|/___/ /___/    /____//___/    /_/   /_/ |_| /_/   /___/ /___/ /_/|_/   /_/    </pre>
    </div>
    <p style="margin: 0.75rem 0 0 0; font-size: clamp(0.75rem, 2.5vw, 0.9rem); color: var(--accent-primary); font-weight: 600; letter-spacing: 0.05em; padding: 0 0.5rem;">
      Checking IP reputation and blocklist status...
    </p>
    <p style="margin: 0.35rem 0 0 0; font-size: clamp(0.7rem, 2vw, 0.8rem); color: rgba(var(--accent-primary-rgb), 0.7); padding: 0 0.5rem;">
      This may take 15-30 seconds
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
    const scanStartedAt = new Date().toISOString();
    window.SM_SCAN_STARTED_AT = scanStartedAt;
    document.body.setAttribute('data-sm-scan-started-at', scanStartedAt);

    // Call reputation API
    const response = await fetch('/api/ip-reputation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input, scanStartedAt }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Reputation analysis failed');
    }

    const results = await response.json();
    currentResults = results;

    // Set report metadata from API response
    const reportId = results && results.reportId ? String(results.reportId) : '';
    const screenshotUrl = results && results.screenshotUrl ? String(results.screenshotUrl) : '';
    if (reportId) {
      if (window.ReportUI && typeof window.ReportUI.setCurrentReportId === 'function') {
        window.ReportUI.setCurrentReportId(reportId);
      } else {
        document.body.setAttribute('data-report-id', reportId);
      }
    }
    if (screenshotUrl) {
      document.body.setAttribute('data-sm-screenshot-url', screenshotUrl);
    }

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
    buttonText.textContent = 'Analyze';
  }
}

// Display complete reputation results
function displayReputationResults(data) {
  const resultsContent = document.getElementById('resultsContent');
  resultsContent.innerHTML = '';

  const reportInput = (data && data.input) || (document.getElementById('urlInput')?.value || '').trim();
  const scanStartedAt = data.scanStartedAt || window.SM_SCAN_STARTED_AT || new Date().toISOString();
  const analyzerKey = window.SM_ANALYZER_KEY || 'ip-reputation';

  // Check for preserved report_id from URL params (recall scan)
  const params = new URLSearchParams(window.location.search);
  const preservedReportId = params.get('report_id') || '';

  // Use preserved report_id if available, otherwise generate new one
  let reportId = preservedReportId || null;
  if (!reportId) {
    if (window.ReportUI && typeof window.ReportUI.makeReportId === 'function') {
      reportId = window.ReportUI.makeReportId({
        analyzerKey,
        normalizedUrl: reportInput,
        startedAtISO: scanStartedAt
      });
    } else if (window.ReportUI && typeof window.ReportUI.computeReportId === 'function') {
      reportId = window.ReportUI.computeReportId(reportInput, scanStartedAt, analyzerKey);
    }
  }

  // Check if report is unlocked (follows SEO pattern - checks both new and legacy billing)
  const isUnlocked = !!(
    reportId && (
      // New billing model: Pro subscription or purchased single report
      (window.ProReportBlock && typeof window.ProReportBlock.hasAccess === 'function' && window.ProReportBlock.hasAccess(reportId)) ||
      // Legacy CreditsManager
      (window.CreditsManager && (
        (typeof window.CreditsManager.isUnlocked === 'function' && window.CreditsManager.isUnlocked(reportId)) ||
        (typeof window.CreditsManager.isReportUnlocked === 'function' && window.CreditsManager.isReportUnlocked(reportId))
      ))
    )
  );
  console.log('[IP Reputation] isUnlocked check:', { reportId, isUnlocked, hasProReportBlock: !!window.ProReportBlock });

  if (reportId) {
    document.body.setAttribute('data-report-id', reportId);
    resultsContent.setAttribute('data-sm-report-id', reportId);
  }

  // Build summary donuts (matching SEO pattern)
  const summary = [
    { label: 'Overall', score: data.overallScore || 0 },
    { label: 'Blacklist', score: data.blacklistScore || 0 },
    { label: 'Email', score: data.emailScore || 0 },
    { label: 'SSL/TLS', score: data.sslScore || 0 },
    { label: 'DNS Health', score: data.dnsScore || 0 },
    { label: 'Port Security', score: data.portSecurityScore || 0 }
  ];

  // Build sections array for accordions
  const sections = [];

  // Blacklist Details Section
  if (data.blacklists && data.blacklists.length > 0) {
    const listed = data.blacklists.filter(bl => bl.listed);
    const clean = data.blacklists.filter(bl => !bl.listed);
    const score = Math.round((clean.length / data.blacklists.length) * 100);
    sections.push({
      id: 'blacklist',
      title: 'DNS Blacklist Status',
      scoreTextRight: `${score}/100`,
      contentHTML: createBlacklistContent(data.blacklists)
    });
  }

  // SSL Certificate Section
  if (data.sslCert) {
    sections.push({
      id: 'ssl',
      title: 'SSL/TLS Certificate',
      scoreTextRight: `${Math.round(data.sslScore || 0)}/100`,
      contentHTML: createSSLContent(data.sslCert, data.sslScore)
    });
  }

  // DNS Health Section
  if (data.dnsHealth) {
    sections.push({
      id: 'dns-health',
      title: 'DNS Health',
      scoreTextRight: `${Math.round(data.dnsScore || 0)}/100`,
      contentHTML: createDNSHealthContent(data.dnsHealth, data.dnsScore)
    });
  }

  // Email Configuration Section
  if (data.emailConfig) {
    let emailScore = 0;
    if (data.emailConfig.spf?.valid) emailScore += 40;
    if (data.emailConfig.dkim?.valid) emailScore += 30;
    if (data.emailConfig.dmarc?.valid) emailScore += 30;
    sections.push({
      id: 'email-deliverability',
      title: 'Email Deliverability',
      scoreTextRight: `${Math.round(emailScore)}/100`,
      contentHTML: createEmailContent(data.emailConfig)
    });
  }

  // Hosting & Network Information Section
  if (data.hostingInfo) {
    sections.push({
      id: 'hosting-network',
      title: 'Hosting & Network Information',
      contentHTML: createHostingContent(data.hostingInfo)
    });
  }

  // Threat Intelligence Section
  if (data.threatIntel) {
    let threatScore = 100;
    if (data.threatIntel.hasThreats && data.threatIntel.threats) {
      data.threatIntel.threats.forEach(threat => {
        if (threat.severity === 'critical') threatScore -= 40;
        else if (threat.severity === 'high') threatScore -= 25;
        else if (threat.severity === 'medium') threatScore -= 15;
        else if (threat.severity === 'low') threatScore -= 5;
      });
      threatScore = Math.max(0, threatScore);
    }
    sections.push({
      id: 'threat-intelligence',
      title: 'Threat Intelligence',
      scoreTextRight: `${Math.round(threatScore)}/100`,
      contentHTML: createThreatContent(data.threatIntel)
    });
  }

  // Recommendations Section (Pro) - follows SEO pattern with conditional content
  if (data.recommendations && data.recommendations.length > 0) {
    sections.push({
      id: 'report-recommendations',
      title: 'Report and Recommendations',
      isPro: true,
      locked: !isUnlocked,
      context: 'ip-reputation',
      reportId: reportId,
      contentHTML: isUnlocked 
        ? createRecommendationsContent(data.recommendations) 
        : getRecommendationsPreviewContent(data.recommendations)
    });
  }

  // Note: Screenshots are automatically handled by report-ui.js ensurePageScreenshotCard()
  // Don't pass screenshots to ReportContainer to avoid duplicates

  // Use ReportContainer.create() for consistent rendering (like SEO)
  if (window.ReportContainer && typeof window.ReportContainer.create === 'function') {
    const reportHTML = window.ReportContainer.create({
      url: data.input || data.hostname || '',
      timestamp: data.timestamp || new Date().toISOString(),
      mode: 'ip-reputation',
      title: 'IP Reputation Analysis',
      subtitle: '',
      summary,
      sections,
      screenshots: [], // Handled by report-ui.js
      proBlock: true,
      proBlockOptions: {
        context: 'ip-reputation',
        features: ['pdf', 'csv', 'share'],
        title: 'Unlock Report',
        subtitle: 'PDF export, share link, export data, and fix packs for this scan.',
        reportId
      }
    });
    // Wrap in report-scope for proper CSS styling of accordions
    resultsContent.innerHTML = `<div class="report-scope">${reportHTML}</div>`;
  } else {
    // Fallback: manual rendering with report-scope wrapper
    let fallbackHTML = `<div class="report-header"><h1 class="report-header__title">IP Reputation Analysis</h1></div>`;
    sections.forEach(section => {
      if (window.ReportAccordion && window.ReportAccordion.createSection) {
        fallbackHTML += window.ReportAccordion.createSection(section);
      }
    });
    resultsContent.innerHTML = `<div class="report-scope">${fallbackHTML}</div>`;
  }

  // Initialize ReportAccordion interactions
  if (window.ReportAccordion && window.ReportAccordion.initInteractions) {
    window.ReportAccordion.initInteractions();
  }

  if (window.ReportUI && reportId) {
    window.ReportUI.setCurrentReportId(reportId);
  }

  if (window.CreditsManager && reportId) {
    const render = window.CreditsManager.renderPaywallState || window.CreditsManager.updateProUI;
    if (typeof render === 'function') render(reportId);
  }

  // Auto-save report snapshot if user has access (Pro or purchased)
  if (reportId && window.ReportStorage && typeof window.ReportStorage.autoSaveIfEligible === 'function') {
    window.ReportStorage.autoSaveIfEligible(reportId, data, {
      siteUrl: reportInput,
      analyzerType: 'ip-reputation',
      scannedAt: scanStartedAt
    });
  }
}

// Expose displayReputationResults globally so report-ui.js can use it for billing return
window.displayReputationResults = displayReputationResults;

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

  return ReportAccordion.createSection({
    id: 'blacklist',
    title: 'DNS Blacklist Status',
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
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

  return ReportAccordion.createSection({
    id: 'email-deliverability',
    title: 'Email Deliverability',
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
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

  return ReportAccordion.createSection({
    id: 'hosting-network',
    title: 'Hosting & Network Information',
    contentHTML: content
  });
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

  return ReportAccordion.createSection({
    id: 'threat-intelligence',
    title: 'Threat Intelligence',
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
}

// Create Recommendations Section
function createRecommendationsSection(recommendations, options = {}) {
  const { locked = false, context = 'ip-reputation', reportId = null } = options;
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

  return ReportAccordion.createSection({
    id: 'report-recommendations',
    title: 'Report and Recommendations',
    isPro: true,
    locked: locked,
    context: context,
    reportId: reportId,
    contentHTML: content
  });
}

// Utility functions
function getScoreColor(score) {
  if (score >= 90) return getAccentPrimaryHex(); // Excellent
  if (score >= 70) return '#00d9ff'; // Good
  if (score >= 50) return '#ffa500'; // Fair
  return '#ff4444'; // Poor
}

function getAccentPrimaryHex() {
  const computed = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-primary')
    .trim();
  if (computed) return computed;

  const isLight = document.body?.classList?.contains('white-theme');
  return isLight ? '#dd3838' : '#5bf4e7';
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
    case 'low': return getAccentPrimaryHex();
    case 'minimal': return getAccentPrimaryHex();
    default: return '#808080';
  }
}

// Content-only helper functions (for use with ReportContainer.create())
function createBlacklistContent(blacklists) {
  const listed = blacklists.filter(bl => bl.listed);
  const clean = blacklists.filter(bl => !bl.listed);

  return `
    <p style="color: var(--text-secondary, #808080); margin-bottom: 1.5rem;">Checked against ${blacklists.length} major DNSBL databases</p>

    ${listed.length > 0 ? `
      <div style="background: rgba(255, 68, 68, 0.1); border: 2px solid #ff4444; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem;">
        <h3 style="color: #ff4444; margin-top: 0;">⚠️ Listed on ${listed.length} Blacklist(s)</h3>
        <div style="display: grid; gap: 1rem;">
          ${listed.map(bl => `
            <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 1rem; border-radius: 4px;">
              <div style="font-weight: 600; color: #ff4444; margin-bottom: 0.5rem;">${bl.name}</div>
              <div style="color: var(--text-primary, #ffffff); font-size: 0.9rem;">${bl.description || 'This IP/domain is listed on this blacklist'}</div>
              ${bl.details ? `<div style="color: var(--text-secondary, #808080); font-size: 0.85rem; margin-top: 0.5rem;">${bl.details}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <div style="background: rgba(var(--accent-primary-rgb), 0.05); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: var(--accent-primary); margin-top: 0;">✓ Clean on ${clean.length} Blacklist(s)</h3>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
        ${clean.map(bl => `
          <span style="background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: var(--accent-primary);">
            ${bl.name}
          </span>
        `).join('')}
      </div>
    </div>
  `;
}

function createSSLContent(sslCert, sslScore) {
  if (!sslCert) return '';
  const isValid = sslCert.valid;

  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
      <div style="background: ${isValid ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${isValid ? 'rgba(var(--accent-primary-rgb), 0.25)' : 'rgba(255, 68, 68, 0.25)'}; border-radius: 8px; padding: 1.5rem; text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">${isValid ? '✅' : '❌'}</div>
        <div style="color: ${isValid ? 'var(--accent-primary)' : '#ff4444'}; font-weight: 600; font-size: 1.2rem;">${isValid ? 'Valid Certificate' : 'Invalid/Missing'}</div>
        <div style="color: var(--text-secondary, #808080); font-size: 0.9rem; margin-top: 0.5rem;">Score: ${sslScore || 0}/100</div>
      </div>

      ${isValid ? `
      <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #00d9ff; margin-top: 0;">📋 Certificate Details</h3>
        <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
          <div><span style="color: var(--text-secondary, #808080);">Issuer:</span> <span style="color: var(--text-primary, #fff);">${sslCert.issuer}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">Subject:</span> <span style="color: var(--text-primary, #fff);">${sslCert.subject}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">Protocol:</span> <span style="color: ${sslCert.protocol === 'TLSv1.3' ? 'var(--accent-primary)' : sslCert.protocol === 'TLSv1.2' ? '#00d9ff' : '#ffa500'};">${sslCert.protocol}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">Cipher:</span> <span style="color: var(--text-primary, #fff);">${sslCert.cipher || 'N/A'}</span></div>
        </div>
      </div>

      <div style="background: ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.05)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.2)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ff4444'}; margin-top: 0;">⏰ Validity Period</h3>
        <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
          <div><span style="color: var(--text-secondary, #808080);">Valid From:</span> <span style="color: var(--text-primary, #fff);">${new Date(sslCert.validFrom).toLocaleDateString()}</span></div>
          <div><span style="color: var(--text-secondary, #808080);">Valid Until:</span> <span style="color: var(--text-primary, #fff);">${new Date(sslCert.validTo).toLocaleDateString()}</span></div>
          <div style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-tertiary, rgba(0,0,0,0.3)); border-radius: 4px; text-align: center;">
            <span style="font-size: 1.5rem; font-weight: bold; color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ff4444'};">${sslCert.daysUntilExpiry}</span>
            <span style="color: var(--text-secondary, #808080);"> days remaining</span>
          </div>
        </div>
      </div>
      ` : `
      <div style="background: rgba(255, 68, 68, 0.05); border: 1px solid rgba(255, 68, 68, 0.2); border-radius: 8px; padding: 1.5rem; grid-column: span 2;">
        <h3 style="color: #ff4444; margin-top: 0;">⚠️ Certificate Issue</h3>
        <p style="color: var(--text-secondary, #cccccc);">${sslCert.error || 'SSL certificate could not be verified'}</p>
      </div>
      `}
    </div>
    ${sslCert.selfSigned ? `
      <div style="margin-top: 1rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 4px;">
        <span style="color: #ffa500;">⚠️ Self-Signed Certificate:</span> <span style="color: var(--text-secondary, #cccccc);">This certificate is self-signed and will show warnings in browsers.</span>
      </div>
    ` : ''}
  `;
}

function createDNSHealthContent(dnsHealth, dnsScore) {
  if (!dnsHealth) return '';

  return `
    <p style="color: var(--text-secondary, #808080); margin-bottom: 1.5rem;">DNS configuration and infrastructure analysis</p>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
      <div style="background: rgba(var(--accent-primary-rgb), 0.05); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: var(--accent-primary); margin-top: 0;">📡 Nameservers</h3>
        ${dnsHealth.nsRecords && dnsHealth.nsRecords.length > 0 ? `
          <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
            ${dnsHealth.nsRecords.map(ns => `
              <span style="background: rgba(var(--accent-primary-rgb), 0.1); border: 1px solid rgba(var(--accent-primary-rgb), 0.3); padding: 0.4rem 0.8rem; border-radius: 4px; font-size: 0.85rem; color: var(--accent-primary); font-family: monospace;">
                ${ns}
              </span>
            `).join('')}
          </div>
          <div style="margin-top: 0.75rem; color: ${dnsHealth.nsRecords.length >= 2 ? 'var(--accent-primary)' : '#ffa500'}; font-size: 0.85rem;">
            ${dnsHealth.nsRecords.length >= 2 ? '✓ Redundancy: OK' : '⚠️ Add more nameservers for redundancy'}
          </div>
        ` : '<p style="color: var(--text-secondary, #808080);">No NS records found</p>'}
      </div>

      <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #00d9ff; margin-top: 0;">📧 Mail Servers (MX)</h3>
        ${dnsHealth.mxRecords && dnsHealth.mxRecords.length > 0 ? `
          <div style="display: grid; gap: 0.5rem;">
            ${dnsHealth.mxRecords.slice(0, 5).map(mx => `
              <div style="display: flex; justify-content: space-between; background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem;">
                <span style="color: var(--text-primary, #fff); font-family: monospace;">${mx.exchange}</span>
                <span style="color: #00d9ff;">Priority: ${mx.priority}</span>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: var(--text-secondary, #808080);">No MX records found (email may not be configured)</p>'}
      </div>

      <div style="background: rgba(153, 51, 255, 0.05); border: 1px solid rgba(153, 51, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #9933ff; margin-top: 0;">🔐 CAA Records</h3>
        ${dnsHealth.hasCAA ? `
          <div style="display: grid; gap: 0.5rem;">
            ${dnsHealth.caaRecords.map(caa => `
              <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 0.5rem; border-radius: 4px; font-size: 0.85rem; color: var(--text-primary, #fff);">
                ${caa.issue || caa.issuewild || 'CAA record'}
              </div>
            `).join('')}
          </div>
          <div style="margin-top: 0.75rem; color: var(--accent-primary); font-size: 0.85rem;">✓ CAA configured</div>
        ` : `
          <p style="color: var(--text-secondary, #808080);">No CAA records found</p>
          <div style="margin-top: 0.75rem; color: #ffa500; font-size: 0.85rem;">⚠️ Consider adding CAA to restrict certificate issuance</div>
        `}
      </div>
    </div>

    ${dnsHealth.issues && dnsHealth.issues.length > 0 ? `
      <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 8px;">
        <h4 style="color: #ffa500; margin: 0 0 0.75rem 0;">⚠️ DNS Issues Detected</h4>
        <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-secondary, #cccccc);">
          ${dnsHealth.issues.map(issue => `<li style="margin-bottom: 0.5rem;">${issue}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  `;
}

function createEmailContent(emailConfig) {
  return `
    <div style="display: grid; gap: 1.5rem;">
      <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-left: 4px solid ${emailConfig.spf?.valid ? 'var(--accent-primary)' : '#ff4444'}; padding: 1rem; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="margin: 0; color: var(--text-primary, #ffffff);">SPF (Sender Policy Framework)</h3>
          <span style="background: ${emailConfig.spf?.valid ? 'rgba(var(--accent-primary-rgb), 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.spf?.valid ? 'var(--accent-primary)' : '#ff4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
            ${emailConfig.spf?.valid ? '✓ Valid' : '✗ Missing/Invalid'}
          </span>
        </div>
        <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
          ${emailConfig.spf?.record || 'No SPF record found'}
        </div>
        ${emailConfig.spf?.issues ? `<div style="color: #ffa500; margin-top: 0.5rem; font-size: 0.85rem;">⚠️ ${emailConfig.spf.issues}</div>` : ''}
      </div>

      <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-left: 4px solid ${emailConfig.dkim?.valid ? 'var(--accent-primary)' : '#ffa500'}; padding: 1rem; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="margin: 0; color: var(--text-primary, #ffffff);">DKIM (DomainKeys Identified Mail)</h3>
          <span style="background: ${emailConfig.dkim?.valid ? 'rgba(var(--accent-primary-rgb), 0.2)' : 'rgba(255, 165, 0, 0.2)'}; color: ${emailConfig.dkim?.valid ? 'var(--accent-primary)' : '#ffa500'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
            ${emailConfig.dkim?.valid ? '✓ Configured' : 'ℹ️ Check Required'}
          </span>
        </div>
        <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem;">
          ${emailConfig.dkim?.status || 'DKIM requires selector-specific lookup'}
        </div>
      </div>

      <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-left: 4px solid ${emailConfig.dmarc?.valid ? 'var(--accent-primary)' : '#ff4444'}; padding: 1rem; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="margin: 0; color: var(--text-primary, #ffffff);">DMARC (Domain-based Message Authentication)</h3>
          <span style="background: ${emailConfig.dmarc?.valid ? 'rgba(var(--accent-primary-rgb), 0.2)' : 'rgba(255, 68, 68, 0.2)'}; color: ${emailConfig.dmarc?.valid ? 'var(--accent-primary)' : '#ff4444'}; padding: 0.3rem 0.8rem; border-radius: 4px; font-size: 0.85rem; font-weight: 600;">
            ${emailConfig.dmarc?.valid ? '✓ Valid' : '✗ Missing/Invalid'}
          </span>
        </div>
        <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem; font-family: 'JetBrains Mono', monospace; word-break: break-all;">
          ${emailConfig.dmarc?.record || 'No DMARC record found'}
        </div>
        ${emailConfig.dmarc?.policy ? `<div style="color: #00d9ff; margin-top: 0.5rem; font-size: 0.85rem;">Policy: ${emailConfig.dmarc.policy}</div>` : ''}
      </div>
    </div>
  `;
}

function createHostingContent(hostingInfo) {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
      <div style="background: rgba(var(--accent-primary-rgb), 0.05); border: 1px solid rgba(var(--accent-primary-rgb), 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: var(--accent-primary); margin-top: 0;">📍 Location</h3>
        <div style="display: grid; gap: 0.5rem;">
          <div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Country:</span> ${hostingInfo.country || 'Unknown'} ${hostingInfo.countryCode ? `(${hostingInfo.countryCode})` : ''}</div>
          ${hostingInfo.city ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">City:</span> ${hostingInfo.city}</div>` : ''}
          ${hostingInfo.region ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Region:</span> ${hostingInfo.region}</div>` : ''}
          ${hostingInfo.timezone ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Timezone:</span> ${hostingInfo.timezone}</div>` : ''}
        </div>
      </div>

      <div style="background: rgba(0, 217, 255, 0.05); border: 1px solid rgba(0, 217, 255, 0.2); border-radius: 8px; padding: 1.5rem;">
        <h3 style="color: #00d9ff; margin-top: 0;">🔌 ISP/Hosting</h3>
        <div style="display: grid; gap: 0.5rem;">
          <div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Provider:</span> ${hostingInfo.isp || 'Unknown'}</div>
          ${hostingInfo.org ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Organization:</span> ${hostingInfo.org}</div>` : ''}
          ${hostingInfo.asn ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">ASN:</span> ${hostingInfo.asn}</div>` : ''}
          ${hostingInfo.asnName ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">AS Name:</span> ${hostingInfo.asnName}</div>` : ''}
        </div>
      </div>

      ${hostingInfo.isProxy !== undefined || hostingInfo.isVpn !== undefined || hostingInfo.isTor !== undefined ? `
        <div style="background: rgba(255, 165, 0, 0.05); border: 1px solid rgba(255, 165, 0, 0.2); border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: #ffa500; margin-top: 0;">🔒 Network Type</h3>
          <div style="display: grid; gap: 0.5rem;">
            ${hostingInfo.isProxy !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Proxy:</span> ${hostingInfo.isProxy ? '⚠️ Yes' : '✓ No'}</div>` : ''}
            ${hostingInfo.isVpn !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">VPN:</span> ${hostingInfo.isVpn ? '⚠️ Yes' : '✓ No'}</div>` : ''}
            ${hostingInfo.isTor !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Tor:</span> ${hostingInfo.isTor ? '⚠️ Yes' : '✓ No'}</div>` : ''}
            ${hostingInfo.isHosting !== undefined ? `<div style="color: var(--text-primary, #ffffff);"><span style="color: var(--text-secondary, #808080);">Hosting:</span> ${hostingInfo.isHosting ? 'Yes' : 'No'}</div>` : ''}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function createThreatContent(threatIntel) {
  return `
    <div style="background: ${threatIntel.hasThreats ? 'rgba(255, 68, 68, 0.1)' : 'rgba(var(--accent-primary-rgb), 0.05)'}; border: 2px solid ${threatIntel.hasThreats ? '#ff4444' : 'rgba(var(--accent-primary-rgb), 0.2)'}; border-radius: 8px; padding: 1.5rem;">
      <h3 style="color: ${threatIntel.hasThreats ? '#ff4444' : 'var(--accent-primary)'}; margin-top: 0;">
        ${threatIntel.hasThreats ? '⚠️ Threats Detected' : '✓ No Known Threats'}
      </h3>

      ${threatIntel.threats && threatIntel.threats.length > 0 ? `
        <div style="display: grid; gap: 1rem; margin-top: 1rem;">
          ${threatIntel.threats.map(threat => `
            <div style="background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); padding: 1rem; border-radius: 4px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <div style="font-weight: 600; color: var(--text-primary, #ffffff);">${threat.type}</div>
                <span style="background: ${getSeverityColor(threat.severity)}; color: #000000; padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; margin-left: 1rem;">
                  ${threat.severity.toUpperCase()}
                </span>
              </div>
              <div style="color: var(--text-secondary, #cccccc); font-size: 0.9rem;">${threat.description}</div>
              ${threat.source ? `<div style="color: var(--text-secondary, #808080); font-size: 0.85rem; margin-top: 0.5rem;">Source: ${threat.source}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `
        <p style="color: var(--accent-primary); margin-top: 1rem;">
          No known malicious activity or security threats associated with this IP/domain.
        </p>
      `}

      ${threatIntel.riskLevel ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-tertiary, rgba(0, 0, 0, 0.3)); border-radius: 4px;">
          <div style="color: var(--text-primary, #ffffff); font-weight: 600; margin-bottom: 0.5rem;">Risk Assessment</div>
          <div style="color: var(--text-secondary, #cccccc);">Overall Risk Level: <span style="color: ${getRiskColor(threatIntel.riskLevel)}; font-weight: 600;">${threatIntel.riskLevel.toUpperCase()}</span></div>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Render preview content for locked recommendations section
 */
function getRecommendationsPreviewContent(recommendations = []) {
  const high = recommendations.filter(r => r.priority === 'high').length;
  const medium = recommendations.filter(r => r.priority === 'medium').length;
  const low = recommendations.filter(r => r.priority === 'low').length;

  const previewItems = [];
  if (high > 0) previewItems.push(`${high} high-priority fixes`);
  if (medium > 0) previewItems.push(`${medium} medium-priority improvements`);
  if (low > 0) previewItems.push(`${low} low-priority suggestions`);
  
  if (previewItems.length === 0) {
    previewItems.push('Actionable recommendations', 'Priority-based fixes');
  }

  return `
    <div style="padding: 1rem;">
      <p style="margin: 0 0 0.75rem 0; color: var(--text-secondary);">
        Unlock to view:
      </p>
      <ul style="margin: 0; padding-left: 1.25rem; color: var(--text-secondary);">
        ${previewItems.slice(0, 3).map(item => `<li>${item}</li>`).join('')}
      </ul>
    </div>
  `;
}

function createRecommendationsContent(recommendations) {
  ensureIpRepFixStyles();
  const priorityOrder = { high: 1, medium: 2, low: 3 };
  const sorted = [...recommendations].sort((a, b) =>
    priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  const fixCount = sorted.length;

  return `
    <div class="iprep-fixes-container" style="margin-top: 1rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔍</span> Reputation Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixCount} improvement${fixCount !== 1 ? 's' : ''} found)</span>
      </h3>
      <div class="iprep-fixes-list">
        ${sorted.map((rec, index) => renderIpRepFixAccordion(rec, index)).join('')}
      </div>
    </div>
  `;
}

function renderIpRepFixAccordion(rec, index) {
  const accordionId = `iprepfix-${rec.id || index}`;
  const severityColors = {
    high: { bg: 'rgba(255,68,68,0.1)', border: '#ff4444', color: '#ff4444', icon: '🔴' },
    medium: { bg: 'rgba(255,165,0,0.1)', border: '#ffa500', color: '#ffa500', icon: '🟠' },
    low: { bg: 'rgba(0,204,255,0.1)', border: '#00ccff', color: '#00ccff', icon: '🟢' }
  };
  const style = severityColors[rec.priority] || severityColors.medium;
  const category = rec.category || 'IP Reputation';

  return `
    <div class="iprep-fix-accordion" data-fix-id="${accordionId}" style="
      border: 1px solid ${style.border}33;
      border-radius: 12px;
      margin-bottom: 1rem;
      overflow: hidden;
      background: ${style.bg};
    ">
      <div class="iprep-fix-header" onclick="toggleIpRepFixAccordion('${accordionId}')" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.25rem;
        cursor: pointer;
        transition: background 0.2s;
      ">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.25rem;">${style.icon}</span>
          <div>
            <h4 style="margin: 0; font-size: 1rem; color: #fff;">${rec.title}</h4>
            <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: #888;">${category}</p>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: 600;
            background: ${style.color}20;
            color: ${style.color};
            border: 1px solid ${style.color}40;
          ">${rec.priority.toUpperCase()}</span>
          <span class="iprep-fix-expand-icon" style="color: #888; transition: transform 0.3s;">▼</span>
        </div>
      </div>

      <div class="iprep-fix-content" id="${accordionId}-content" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
        <div style="padding: 0 1.25rem 1.25rem 1.25rem;">
          ${renderIpRepFixTabs(rec, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderIpRepFixTabs(rec, accordionId) {
  return `
    <div class="iprep-fix-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.75rem;">
      <button class="iprep-fix-tab active" onclick="switchIpRepFixTab('${accordionId}', 'summary')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.2);
        border-radius: 6px;
        background: rgba(255,255,255,0.1);
        color: #fff;
        cursor: pointer;
        font-size: 0.85rem;
      ">📋 Summary</button>
      <button class="iprep-fix-tab" onclick="switchIpRepFixTab('${accordionId}', 'code')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">💻 Code</button>
      <button class="iprep-fix-tab" onclick="switchIpRepFixTab('${accordionId}', 'guide')" style="
        padding: 0.5rem 1rem;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 6px;
        background: transparent;
        color: #aaa;
        cursor: pointer;
        font-size: 0.85rem;
      ">🔧 Fix Guide</button>
    </div>

    <!-- Summary Tab -->
    <div class="iprep-fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin: 0 0 1rem 0;">
        ${rec.description}
      </p>
      ${rec.impact ? `
      <div style="background: rgba(0,255,65,0.1); border-left: 3px solid #00ff41; padding: 0.75rem; border-radius: 4px;">
        <div style="color: #00ff41; font-size: 0.85rem; font-weight: bold; margin-bottom: 0.25rem;">✓ Expected Impact</div>
        <div style="color: #c0c0c0; font-size: 0.9rem;">${rec.impact}</div>
      </div>
      ` : ''}
    </div>

    <!-- Code Tab -->
    <div class="iprep-fix-tab-content" id="${accordionId}-code" style="display: none;">
      <div style="display: grid; gap: 1rem;">
        <!-- Recommended Action -->
        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden; border: 1px solid rgba(0,255,65,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: rgba(0,255,65,0.1); border-bottom: 1px solid rgba(0,255,65,0.2);">
            <span style="color: #00ff41; font-weight: 600; font-size: 0.85rem;">✅ Recommended Action</span>
            <button onclick="copyIpRepCode('${accordionId}-action')" style="
              padding: 0.25rem 0.75rem;
              border-radius: 4px;
              border: 1px solid rgba(255,255,255,0.2);
              background: rgba(255,255,255,0.05);
              color: #fff;
              cursor: pointer;
              font-size: 0.75rem;
            ">📋 Copy</button>
          </div>
          <pre id="${accordionId}-action" style="margin: 0; padding: 1rem; overflow-x: auto; color: #e0e0e0; font-size: 0.85rem; white-space: pre-wrap;">${escapeHtmlIpRep(rec.action || rec.description)}</pre>
        </div>
      </div>
    </div>

    <!-- Fix Guide Tab -->
    <div class="iprep-fix-tab-content" id="${accordionId}-guide" style="display: none;">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${getIpRepDefaultSteps(rec).map(step => `<li style="margin-bottom: 0.5rem;">${step}</li>`).join('')}
      </ol>
    </div>
  `;
}

function getIpRepDefaultSteps(rec) {
  const stepsMap = {
    'Configure SPF Record': [
      'Access your domain DNS settings',
      'Add a TXT record with SPF configuration',
      'Example: "v=spf1 include:_spf.yourprovider.com ~all"',
      'Test with SPF validation tools'
    ],
    'Implement DMARC Policy': [
      'Create a DMARC record at _dmarc.yourdomain.com',
      'Start with p=none for monitoring',
      'Add rua= for aggregate reports',
      'Gradually increase policy strictness'
    ],
    'Configure DKIM': [
      'Generate DKIM keys through your email provider',
      'Add the public key as a TXT record',
      'Enable DKIM signing in your email server',
      'Verify with DKIM testing tools'
    ],
    'Add CAA DNS Records': [
      'Identify your certificate authority',
      'Add CAA record specifying allowed CAs',
      'Example: "0 issue \\"letsencrypt.org\\""',
      'Test with CAA lookup tools'
    ],
    'Monitor Reputation Regularly': [
      'Set up monitoring with blacklist check services',
      'Configure alerts for reputation changes',
      'Review email authentication weekly',
      'Address issues promptly when detected'
    ]
  };
  return stepsMap[rec.title] || [
    'Review the current issue',
    'Follow the recommended action',
    'Test and verify the fix',
    'Monitor for improvements'
  ];
}

// Toggle accordion
function toggleIpRepFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);
  const icon = accordion?.querySelector('.iprep-fix-expand-icon');

  if (!accordion || !content) return;

  const isExpanded = accordion.classList.contains('expanded');

  if (isExpanded) {
    accordion.classList.remove('expanded');
    content.style.maxHeight = '0';
    if (icon) icon.style.transform = 'rotate(0deg)';
  } else {
    accordion.classList.add('expanded');
    content.style.maxHeight = content.scrollHeight + 'px';
    if (icon) icon.style.transform = 'rotate(180deg)';
  }
}

// Switch tabs
function switchIpRepFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.iprep-fix-tab');
  const contents = accordion.querySelectorAll('.iprep-fix-tab-content');

  tabs.forEach(tab => {
    tab.style.background = 'transparent';
    tab.style.color = '#aaa';
    tab.style.borderColor = 'rgba(255,255,255,0.1)';
    tab.classList.remove('active');
  });
  contents.forEach(content => {
    content.style.display = 'none';
    content.classList.remove('active');
  });

  const activeTab = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(tabName));
  const activeContent = document.getElementById(`${accordionId}-${tabName}`);

  if (activeTab) {
    activeTab.style.background = 'rgba(255,255,255,0.1)';
    activeTab.style.color = '#fff';
    activeTab.style.borderColor = 'rgba(255,255,255,0.2)';
    activeTab.classList.add('active');
  }
  if (activeContent) {
    activeContent.style.display = 'block';
    activeContent.classList.add('active');
  }

  // Update accordion height
  const content = document.getElementById(`${accordionId}-content`);
  if (content && accordion.classList.contains('expanded')) {
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 50);
  }
}

// Expose accordion functions to window
window.toggleIpRepFixAccordion = toggleIpRepFixAccordion;
window.switchIpRepFixTab = switchIpRepFixTab;

// Add click event delegation for IP reputation fix accordions and tabs
document.addEventListener('click', function(e) {
  // Handle tab clicks first
  const tab = e.target.closest('.iprep-fix-tab');
  if (tab) {
    const accordion = tab.closest('.iprep-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      const tabText = tab.textContent.toLowerCase();
      let tabName = 'summary';
      if (tabText.includes('code')) tabName = 'code';
      else if (tabText.includes('guide')) tabName = 'guide';
      if (fixId && typeof window.switchIpRepFixTab === 'function') {
        e.preventDefault();
        e.stopPropagation();
        window.switchIpRepFixTab(fixId, tabName);
      }
    }
    return;
  }
  // Handle accordion header clicks
  const header = e.target.closest('.iprep-fix-header');
  if (header) {
    const accordion = header.closest('.iprep-fix-accordion');
    if (accordion) {
      const fixId = accordion.getAttribute('data-fix-id');
      if (fixId && typeof window.toggleIpRepFixAccordion === 'function') {
        window.toggleIpRepFixAccordion(fixId);
      }
    }
  }
});

// Copy code
function copyIpRepCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = codeElement.parentElement.querySelector('button');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => { btn.textContent = originalText; }, 2000);
    }
  });
}

function ensureIpRepFixStyles() {
  if (document.getElementById('iprep-fixes-styles')) return;
  const style = document.createElement('style');
  style.id = 'iprep-fixes-styles';
  style.textContent = `
    .iprep-fix-accordion.expanded .iprep-fix-expand-icon {
      transform: rotate(180deg);
    }
    .iprep-fix-header:hover {
      background: rgba(255,255,255,0.03);
    }
  `;
  document.head.appendChild(style);
}

function escapeHtmlIpRep(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Create SSL Certificate Section
function createSSLSection(sslCert, sslScore) {
  if (!sslCert) return '';

  const isValid = sslCert.valid;
  const statusColor = isValid ? 'var(--accent-primary)' : '#ff4444';

  const content = `
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem; margin-top: 1.5rem;">
        <!-- Certificate Status -->
        <div style="background: ${isValid ? 'rgba(var(--accent-primary-rgb), 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${isValid ? 'rgba(var(--accent-primary-rgb), 0.25)' : 'rgba(255, 68, 68, 0.25)'}; border-radius: 8px; padding: 1.5rem; text-align: center;">
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
            <div><span style="color: #808080;">Protocol:</span> <span style="color: ${sslCert.protocol === 'TLSv1.3' ? 'var(--accent-primary)' : sslCert.protocol === 'TLSv1.2' ? '#00d9ff' : '#ffa500'};">${sslCert.protocol}</span></div>
            <div><span style="color: #808080;">Cipher:</span> <span style="color: #fff;">${sslCert.cipher || 'N/A'}</span></div>
          </div>
        </div>

        <!-- Expiry Info -->
        <div style="background: ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.05)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.05)' : 'rgba(255, 68, 68, 0.05)'}; border: 1px solid ${sslCert.daysUntilExpiry > 30 ? 'rgba(var(--accent-primary-rgb), 0.2)' : sslCert.daysUntilExpiry > 14 ? 'rgba(255, 165, 0, 0.2)' : 'rgba(255, 68, 68, 0.2)'}; border-radius: 8px; padding: 1.5rem;">
          <h3 style="color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ff4444'}; margin-top: 0;">⏰ Validity Period</h3>
          <div style="display: grid; gap: 0.5rem; font-size: 0.9rem;">
            <div><span style="color: #808080;">Valid From:</span> <span style="color: #fff;">${new Date(sslCert.validFrom).toLocaleDateString()}</span></div>
            <div><span style="color: #808080;">Valid Until:</span> <span style="color: #fff;">${new Date(sslCert.validTo).toLocaleDateString()}</span></div>
            <div style="margin-top: 0.5rem; padding: 0.5rem; background: rgba(0,0,0,0.3); border-radius: 4px; text-align: center;">
              <span style="font-size: 1.5rem; font-weight: bold; color: ${sslCert.daysUntilExpiry > 30 ? 'var(--accent-primary)' : sslCert.daysUntilExpiry > 14 ? '#ffa500' : '#ff4444'};">${sslCert.daysUntilExpiry}</span>
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
  
  return ReportAccordion.createSection({
    id: 'ssl',
    title: 'SSL/TLS Certificate',
    scoreTextRight: `${Math.round(sslScore)}/100`,
    contentHTML: content
  });
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

  return ReportAccordion.createSection({
    id: 'dns-health',
    title: 'DNS Health',
    scoreTextRight: `${Math.round(dnsScore)}/100`,
    contentHTML: content
  });
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

  return ReportAccordion.createSection({
    id: 'port-security',
    title: 'Port Security Scan',
    scoreTextRight: `${Math.round(score)}/100`,
    contentHTML: content
  });
}

function showError(message) {
  const errorMessage = document.getElementById('errorMessage');
  errorMessage.textContent = message;
  errorMessage.classList.remove('hidden');

  setTimeout(() => {
    errorMessage.classList.add('hidden');
  }, 5000);
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
  } else {
  }
}

// Initialize PDF export when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initIPReputationPDFExport);
} else {
  initIPReputationPDFExport();
}
