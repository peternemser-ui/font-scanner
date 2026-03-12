const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo } = require('../utils/formatHelpers');
const { calculateWeightedScore, scoreSecurityHeaders } = require('../utils/scoringHelpers');
const { dismissPageOverlays, setDeviceProfile } = require('../utils/browserHelpers');

const logger = createLogger('SecurityAnalyzerService');

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

class SecurityAnalyzerService {
  /**
   * Main security analysis orchestrator
   * Runs dual Lighthouse + Puppeteer security checks
   */
  async analyzeSecurity(url) {
    logger.info('Starting comprehensive security analysis', { url });

    try {
      // Use allSettled for resilience - don't let one failure break everything
      const [desktopResult, mobileResult] = await Promise.allSettled([
        this.runLighthouseSecurityAnalysis(url, 'desktop'),
        this.runLighthouseSecurityAnalysis(url, 'mobile'),
      ]);

      const desktopResults = desktopResult.status === 'fulfilled' ? desktopResult.value : {
        device: 'desktop',
        securityScore: 0,
        https: false,
        csp: false,
        hsts: false,
        mixedContent: 0,
        error: desktopResult.reason?.message || 'Analysis failed'
      };
      const mobileResults = mobileResult.status === 'fulfilled' ? mobileResult.value : {
        device: 'mobile',
        securityScore: 0,
        https: false,
        csp: false,
        hsts: false,
        mixedContent: 0,
        error: mobileResult.reason?.message || 'Analysis failed'
      };

      // Puppeteer-based deep analysis (platform-agnostic) - also use allSettled
      const [sslResult, headersResult, vulnerabilitiesResult, cookiesResult, thirdPartyResult] = await Promise.allSettled([
        this.analyzeSSL(url),
        this.analyzeSecurityHeaders(url),
        this.analyzeVulnerabilities(url),
        this.analyzeCookies(url),
        this.analyzeThirdPartyScripts(url),
      ]);

      // Extract results with fallbacks
      const sslData = sslResult.status === 'fulfilled' ? sslResult.value : { valid: false, protocol: null, issuer: null, validFrom: null, validUntil: null, daysRemaining: null, score: 0, issues: ['Analysis failed'], error: true };
      const headersData = headersResult.status === 'fulfilled' ? headersResult.value : { score: 0, implemented: 0, total: 6, details: {}, error: true };
      const vulnerabilitiesData = vulnerabilitiesResult.status === 'fulfilled' ? vulnerabilitiesResult.value : { issues: [], score: 0, critical: 0, high: 0, medium: 0, low: 0, error: true };
      const cookiesData = cookiesResult.status === 'fulfilled' ? cookiesResult.value : { list: [], total: 0, secure: 0, issues: [], score: 0, error: true };
      const thirdPartyData = thirdPartyResult.status === 'fulfilled' ? thirdPartyResult.value : { scripts: [], total: 0, withSRI: 0, score: 0, error: true };

      // Calculate overall security score
      const overallScore = this.calculateOverallScore({
        ssl: sslData,
        headers: headersData,
        vulnerabilities: vulnerabilitiesData,
        cookies: cookiesData,
        thirdParty: thirdPartyData,
      });

      // Generate OWASP compliance with detailed breakdown
      const owaspResult = this.calculateOwaspCompliance({
        ssl: sslData,
        headers: headersData,
        vulnerabilities: vulnerabilitiesData,
        cookies: cookiesData,
        thirdParty: thirdPartyData,
      });
      const owaspCompliance = owaspResult.score;
      const owaspDetails = owaspResult.details;

      // Generate prioritized recommendations
      const recommendations = this.generateRecommendations({
        ssl: sslData,
        headers: headersData,
        vulnerabilities: vulnerabilitiesData,
        cookies: cookiesData,
        thirdParty: thirdPartyData,
      });

      logger.info('Security analysis completed successfully', { 
        url, 
        overallScore,
        owaspCompliance 
      });

      return {
        url,
        timestamp: new Date().toISOString(),
        overallScore,
        owaspCompliance,
        owaspDetails,
        desktop: desktopResults,
        mobile: mobileResults,
        ssl: sslData,
        headers: headersData,
        vulnerabilities: vulnerabilitiesData,
        cookies: cookiesData,
        thirdPartyScripts: thirdPartyData,
        recommendations,
      };
    } catch (error) {
      logger.error('Security analysis failed completely, returning fallback data:', error);

      // Return fallback data instead of throwing
      return {
        url,
        timestamp: new Date().toISOString(),
        overallScore: 0,
        owaspCompliance: 0,
        owaspDetails: {},
        desktop: { device: 'desktop', securityScore: 0, https: false, csp: false, hsts: false, mixedContent: 0, error: error.message },
        mobile: { device: 'mobile', securityScore: 0, https: false, csp: false, hsts: false, mixedContent: 0, error: error.message },
        ssl: { score: 0, valid: false, issues: ['Analysis failed'], error: true },
        headers: { score: 0, implemented: 0, total: 6, details: {}, error: true },
        vulnerabilities: { issues: [], score: 0, critical: 0, high: 0, medium: 0, low: 0, error: true },
        cookies: { cookies: [], total: 0, secure: 0, score: 0, error: true },
        thirdPartyScripts: { scripts: [], total: 0, withSRI: 0, score: 0, error: true },
        recommendations: ['Security analysis failed: ' + error.message],
        error: true,
        errorMessage: error.message
      };
    }
  }

  /**
   * Run Lighthouse security analysis (desktop or mobile)
   */
  async runLighthouseSecurityAnalysis(url, device = 'desktop') {
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        // Set viewport and realistic user agent for device
        if (device === 'mobile') {
          await page.setViewport({ width: 375, height: 812, isMobile: true });
          await page.setUserAgent(MOBILE_UA);
        } else {
          await page.setViewport({ width: 1920, height: 1080 });
          await page.setUserAgent(DESKTOP_UA);
        }

        // Navigate to page
        const response = await page.goto(url, {
          waitUntil: 'load',
          timeout: 30000
        });

        await dismissPageOverlays(page, { timeout: 4000 });

        // Collect security metrics
        const securityInfo = await page.evaluate(() => {
          return {
            https: location.protocol === 'https:',
            csp: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]'),
            mixedContentElements: document.querySelectorAll('img[src^="http:"], script[src^="http:"]').length,
          };
        });

        // Check response headers from initial navigation
        const headers = response ? response.headers() : {};

        const securityScore = this.calculateDeviceSecurityScore({
          https: securityInfo.https,
          csp: securityInfo.csp || !!headers['content-security-policy'],
          hsts: !!headers['strict-transport-security'],
          mixedContent: securityInfo.mixedContentElements,
        });

        return {
          device,
          securityScore,
          https: securityInfo.https,
          csp: securityInfo.csp || !!headers['content-security-policy'],
          hsts: !!headers['strict-transport-security'],
          mixedContent: securityInfo.mixedContentElements,
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Analyze SSL/TLS certificate
   */
  async analyzeSSL(url) {
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        await page.setUserAgent(DESKTOP_UA);
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        await dismissPageOverlays(page, { timeout: 4000 });

        const securityDetails = await page.evaluate(() => {
          return {
            protocol: location.protocol,
            isSecure: location.protocol === 'https:',
          };
        });

        // Get certificate info from response
        const securityInfo = response.securityDetails();
        
        let sslData = {
          valid: securityDetails.isSecure,
          protocol: securityDetails.protocol,
          issuer: null,
          validFrom: null,
          validUntil: null,
          daysRemaining: null,
          issues: [],
          score: 0,
        };

        if (securityInfo) {
          const validFrom = new Date(securityInfo.validFrom() * 1000);
          const validTo = new Date(securityInfo.validTo() * 1000);
          const now = new Date();
          const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

          sslData = {
            valid: true,
            protocol: securityInfo.protocol(),
            issuer: securityInfo.issuer(),
            validFrom: validFrom.toISOString().split('T')[0],
            validUntil: validTo.toISOString().split('T')[0],
            daysRemaining,
            issues: [],
            score: 100,
          };

          // Check for issues
          if (daysRemaining < 30) {
            sslData.issues.push(`Certificate expires in ${daysRemaining} days`);
            sslData.score -= 20;
          }
          if (daysRemaining < 7) {
            sslData.issues.push('Certificate expiring very soon - CRITICAL');
            sslData.score -= 30;
          }
          if (securityInfo.protocol() !== 'TLS 1.3' && securityInfo.protocol() !== 'TLS 1.2') {
            sslData.issues.push('Using outdated TLS protocol');
            sslData.score -= 25;
          }
        } else if (securityDetails.isSecure) {
          // Page loaded over HTTPS but Puppeteer didn't expose certificate details
          // (common with redirects, CDNs, or certain server configs)
          sslData.valid = true;
          sslData.score = 80;
          sslData.issues.push('HTTPS active but certificate details unavailable for inspection');
        } else {
          sslData.issues.push('No HTTPS - website is not secure');
          sslData.score = 0;
        }

        return sslData;
      } catch (error) {
        logger.error('SSL analysis failed:', error);
        return {
          valid: false,
          protocol: 'http:',
          issuer: null,
          validFrom: null,
          validUntil: null,
          daysRemaining: null,
          issues: ['Failed to analyze SSL certificate'],
          score: 0,
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Analyze HTTP security headers
   */
  async analyzeSecurityHeaders(url) {
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        await page.setUserAgent(DESKTOP_UA);
        const response = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        });

        const headers = response.headers();

        const securityHeaders = {
          'Content-Security-Policy': {
            present: !!headers['content-security-policy'],
            value: headers['content-security-policy'] || null,
            description: 'Controls resources the browser is allowed to load',
            risk: 'XSS and data injection attacks',
          },
          'Strict-Transport-Security': {
            present: !!headers['strict-transport-security'],
            value: headers['strict-transport-security'] || null,
            description: 'Forces HTTPS connections',
            risk: 'Man-in-the-middle attacks',
          },
          'X-Frame-Options': {
            present: !!headers['x-frame-options'],
            value: headers['x-frame-options'] || null,
            description: 'Prevents clickjacking attacks',
            risk: 'Clickjacking and UI redressing',
          },
          'X-Content-Type-Options': {
            present: !!headers['x-content-type-options'],
            value: headers['x-content-type-options'] || null,
            description: 'Prevents MIME type sniffing',
            risk: 'MIME confusion attacks',
          },
          'Referrer-Policy': {
            present: !!headers['referrer-policy'],
            value: headers['referrer-policy'] || null,
            description: 'Controls referrer information',
            risk: 'Information leakage',
          },
          'Permissions-Policy': {
            present: !!headers['permissions-policy'] || !!headers['feature-policy'],
            value: headers['permissions-policy'] || headers['feature-policy'] || null,
            description: 'Controls browser features and APIs',
            risk: 'Unauthorized feature access',
          },
        };

        const implemented = Object.values(securityHeaders).filter(h => h.present).length;
        const total = Object.keys(securityHeaders).length;
        const score = roundTo((implemented / total) * 100, 0);

        return {
          score,
          implemented,
          total,
          details: securityHeaders,
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Analyze vulnerabilities and threats
   */
  async analyzeVulnerabilities(url) {
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        await page.setUserAgent(DESKTOP_UA);
        await page.goto(url, {
          waitUntil: 'load',
          timeout: 30000
        });

        await dismissPageOverlays(page, { timeout: 4000 });

        const vulnerabilities = await page.evaluate(() => {
          const issues = [];

          // Check for mixed content
          const mixedContent = document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[href^="http:"]');
          if (mixedContent.length > 0 && location.protocol === 'https:') {
            issues.push({
              severity: 'high',
              title: 'Mixed Content Detected',
              description: `${mixedContent.length} resources loaded over HTTP on HTTPS page`,
              solution: 'Update all resources to use HTTPS URLs',
            });
          }

          // Check for inline scripts (potential XSS)
          const inlineScripts = document.querySelectorAll('script:not([src])');
          if (inlineScripts.length > 10) {
            issues.push({
              severity: 'medium',
              title: 'Excessive Inline Scripts',
              description: `${inlineScripts.length} inline scripts found - increases XSS risk`,
              solution: 'Move scripts to external files and use CSP',
            });
          }

          // Check for forms without HTTPS action
          const unsecuredForms = document.querySelectorAll('form[action^="http:"]');
          if (unsecuredForms.length > 0) {
            issues.push({
              severity: 'critical',
              title: 'Insecure Form Submission',
              description: `${unsecuredForms.length} form(s) submitting data over HTTP`,
              solution: 'Update form actions to use HTTPS',
            });
          }

          // Check for password inputs without autocomplete=off
          const passwordFields = document.querySelectorAll('input[type="password"]:not([autocomplete])');
          if (passwordFields.length > 0) {
            issues.push({
              severity: 'low',
              title: 'Password Field Configuration',
              description: `${passwordFields.length} password field(s) without autocomplete attribute`,
              solution: 'Add autocomplete="current-password" or "new-password"',
            });
          }

          // Check for iframes without sandbox
          const unsandboxedIframes = document.querySelectorAll('iframe:not([sandbox])');
          if (unsandboxedIframes.length > 0) {
            issues.push({
              severity: 'medium',
              title: 'Unsandboxed Iframes',
              description: `${unsandboxedIframes.length} iframe(s) without sandbox attribute`,
              solution: 'Add sandbox attribute to restrict iframe capabilities',
            });
          }

          return issues;
        });

        // Count by severity
        const critical = vulnerabilities.filter(v => v.severity === 'critical').length;
        const high = vulnerabilities.filter(v => v.severity === 'high').length;
        const medium = vulnerabilities.filter(v => v.severity === 'medium').length;
        const low = vulnerabilities.filter(v => v.severity === 'low').length;

        // Calculate score (lower is better for vulnerabilities)
        let score = 100;
        score -= critical * 25;
        score -= high * 15;
        score -= medium * 10;
        score -= low * 5;
        score = Math.max(0, score);

        return {
          score,
          critical,
          high,
          medium,
          low,
          issues: vulnerabilities,
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Analyze cookie security
   */
  async analyzeCookies(url) {
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        await page.setUserAgent(DESKTOP_UA);
        await page.goto(url, {
          waitUntil: 'load',
          timeout: 30000
        });

        const cookies = await page.cookies();

        const cookieAnalysis = cookies.map(cookie => {
          const issues = [];
          
          if (!cookie.httpOnly) {
            issues.push('Missing HttpOnly flag');
          }
          if (!cookie.secure && url.startsWith('https')) {
            issues.push('Missing Secure flag');
          }
          if (!cookie.sameSite || cookie.sameSite === 'None') {
            issues.push('Weak SameSite policy');
          }

          return {
            name: cookie.name,
            httpOnly: cookie.httpOnly,
            secure: cookie.secure,
            sameSite: cookie.sameSite,
            issues,
          };
        });

        const total = cookies.length;
        const secure = cookieAnalysis.filter(c => c.httpOnly && c.secure && c.sameSite !== 'None').length;
        const score = total > 0 ? roundTo((secure / total) * 100, 0) : 100;

        const allIssues = [];
        if (total > 0 && secure === 0) {
          allIssues.push('No cookies are properly secured');
        }
        if (cookieAnalysis.some(c => !c.httpOnly)) {
          allIssues.push('Some cookies are vulnerable to XSS (missing HttpOnly)');
        }
        if (cookieAnalysis.some(c => !c.secure)) {
          allIssues.push('Some cookies can be transmitted over HTTP (missing Secure)');
        }

        return {
          score,
          total,
          secure,
          list: cookieAnalysis,
          issues: allIssues,
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Analyze third-party scripts and SRI
   */
  async analyzeThirdPartyScripts(url) {
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();

      try {
        await page.setUserAgent(DESKTOP_UA);
        await page.goto(url, {
          waitUntil: 'load',
          timeout: 30000
        });

        const scripts = await page.evaluate(() => {
          const externalScripts = Array.from(document.querySelectorAll('script[src]'));
          const pageOrigin = location.origin;

          return externalScripts
            .filter(script => {
              const src = script.src;
              return !src.startsWith(pageOrigin) && src.startsWith('http');
            })
            .map(script => ({
              url: script.src,
              hasSRI: !!script.integrity,
              async: script.async,
              https: script.src.startsWith('https://'),
              crossOrigin: script.crossOrigin,
            }));
        });

        // Analyze risk levels
        const analyzedScripts = scripts.map(script => {
          let risk = 'low';
          
          if (!script.https) {
            risk = 'critical';
          } else if (!script.hasSRI) {
            risk = 'medium';
          }

          return {
            ...script,
            risk,
          };
        });

        const total = scripts.length;
        const withSRI = scripts.filter(s => s.hasSRI).length;
        const score = total > 0 ? roundTo((withSRI / total) * 100, 0) : 100;

        return {
          score,
          total,
          withSRI,
          scripts: analyzedScripts,
        };
      } finally {
        await page.close();
      }
    });
  }

  /**
   * Calculate device-specific security score
   */
  calculateDeviceSecurityScore({ https, csp, hsts, mixedContent }) {
    let score = 0;

    if (https) score += 40;
    if (csp) score += 25;
    if (hsts) score += 25;
    if (mixedContent === 0) score += 10;
    else score -= Math.min(mixedContent * 2, 20);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate overall security score
   */
  calculateOverallScore({ ssl, headers, vulnerabilities, cookies, thirdParty }) {
    // Use scoring helper for weighted score calculation
    return Math.round(calculateWeightedScore([
      { score: ssl.score, weight: 0.3 },
      { score: headers.score, weight: 0.25 },
      { score: vulnerabilities.score, weight: 0.25 },
      { score: cookies.score, weight: 0.1 },
      { score: thirdParty.score, weight: 0.1 }
    ]));
  }

  /**
   * Calculate OWASP Top 10 (2021) compliance
   * Returns both percentage and detailed breakdown for each control
   * @see https://owasp.org/Top10/
   */
  calculateOwaspCompliance({ ssl, headers, vulnerabilities, cookies, thirdParty }) {
    const details = {};
    let passCount = 0;
    let partialCount = 0;
    const totalControls = 10;

    // A01:2021 - Broken Access Control
    // Check: X-Frame-Options prevents clickjacking, proper CORS
    const hasXFrameOptions = headers.details['X-Frame-Options']?.present;
    const hasPermissionsPolicy = headers.details['Permissions-Policy']?.present;
    if (hasXFrameOptions && hasPermissionsPolicy) {
      details.a01 = 'pass';
      passCount++;
    } else if (hasXFrameOptions || hasPermissionsPolicy) {
      details.a01 = 'partial';
      partialCount++;
    } else {
      details.a01 = 'fail';
    }

    // A02:2021 - Cryptographic Failures
    // Check: Valid HTTPS with strong TLS
    if (ssl.valid && ssl.score >= 80) {
      details.a02 = 'pass';
      passCount++;
    } else if (ssl.valid) {
      details.a02 = 'partial';
      partialCount++;
    } else {
      details.a02 = 'fail';
    }

    // A03:2021 - Injection
    // Check: CSP header prevents script injection
    const hasCSP = headers.details['Content-Security-Policy']?.present;
    const hasXContentType = headers.details['X-Content-Type-Options']?.present;
    if (hasCSP && hasXContentType) {
      details.a03 = 'pass';
      passCount++;
    } else if (hasCSP || hasXContentType) {
      details.a03 = 'partial';
      partialCount++;
    } else {
      details.a03 = 'fail';
    }

    // A04:2021 - Insecure Design
    // Check: Multiple security headers indicate security-conscious design
    if (headers.score >= 70) {
      details.a04 = 'pass';
      passCount++;
    } else if (headers.score >= 50) {
      details.a04 = 'partial';
      partialCount++;
    } else {
      details.a04 = 'fail';
    }

    // A05:2021 - Security Misconfiguration
    // Check: Comprehensive security header implementation
    if (headers.implemented >= 5) {
      details.a05 = 'pass';
      passCount++;
    } else if (headers.implemented >= 3) {
      details.a05 = 'partial';
      partialCount++;
    } else {
      details.a05 = 'fail';
    }

    // A06:2021 - Vulnerable and Outdated Components
    // Check: No critical/high vulnerabilities, third-party scripts secured
    const noCritical = (vulnerabilities.critical || 0) === 0;
    const noHigh = (vulnerabilities.high || 0) === 0;
    const scriptsSecured = !thirdParty || thirdParty.total === 0 || thirdParty.score >= 50;
    if (noCritical && noHigh && scriptsSecured) {
      details.a06 = 'pass';
      passCount++;
    } else if (noCritical && scriptsSecured) {
      details.a06 = 'partial';
      partialCount++;
    } else {
      details.a06 = 'fail';
    }

    // A07:2021 - Identification and Authentication Failures
    // Check: Secure cookie configuration
    const cookiesSecured = cookies.total === 0 || cookies.score >= 70;
    const hasHSTS = headers.details['Strict-Transport-Security']?.present;
    if (cookiesSecured && hasHSTS) {
      details.a07 = 'pass';
      passCount++;
    } else if (cookiesSecured || hasHSTS) {
      details.a07 = 'partial';
      partialCount++;
    } else {
      details.a07 = 'fail';
    }

    // A08:2021 - Software and Data Integrity Failures
    // Check: Third-party scripts use SRI
    const sriScore = thirdParty?.score || 0;
    const hasThirdParty = thirdParty?.total > 0;
    if (!hasThirdParty || sriScore >= 70) {
      details.a08 = 'pass';
      passCount++;
    } else if (sriScore >= 40) {
      details.a08 = 'partial';
      partialCount++;
    } else {
      details.a08 = 'fail';
    }

    // A09:2021 - Security Logging and Monitoring Failures
    // Cannot fully verify client-side; mark as partial if basic security present
    if (headers.score >= 70 && ssl.valid) {
      details.a09 = 'partial'; // Best we can determine client-side
      partialCount++;
    } else {
      details.a09 = 'fail';
    }

    // A10:2021 - Server-Side Request Forgery (SSRF)
    // Cannot verify client-side; mark based on overall security posture
    if (hasCSP && headers.score >= 70) {
      details.a10 = 'partial'; // CSP can mitigate some SSRF vectors
      partialCount++;
    } else {
      details.a10 = 'fail';
    }

    // Calculate compliance: pass = 1.0, partial = 0.5, fail = 0
    const score = roundTo(((passCount + partialCount * 0.5) / totalControls) * 100, 0);

    return { score, details, passCount, partialCount, failCount: totalControls - passCount - partialCount };
  }

  /**
   * Generate prioritized security recommendations
   */
  generateRecommendations({ ssl, headers, vulnerabilities, cookies, thirdParty }) {
    const recommendations = [];

    // SSL recommendations
    if (!ssl.valid) {
      recommendations.push({
        priority: 'critical',
        title: 'Implement HTTPS',
        description: 'Website is not using HTTPS encryption',
        impact: 'All data transmitted in plain text - vulnerable to interception',
        solution: 'Obtain and install an SSL/TLS certificate from a trusted CA',
        location: 'Web Server Config / Hosting Provider',
        owaspRef: 'A3:2017 - Sensitive Data Exposure',
        resources: [
          { title: 'Let\'s Encrypt Free SSL', url: 'https://letsencrypt.org/' },
        ],
      });
    } else if (ssl.issues.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Fix SSL/TLS Issues',
        description: ssl.issues.join('. '),
        impact: 'Certificate or protocol issues may compromise security',
        solution: 'Update certificate or upgrade TLS protocol version',
        location: 'SSL Certificate Provider / Hosting Control Panel',
        owaspRef: 'A3:2017 - Sensitive Data Exposure',
      });
    }

    // Security headers recommendations
    const hd = headers.details || {};
    if (!(hd['Content-Security-Policy'] || {}).present) {
      recommendations.push({
        priority: 'critical',
        title: 'Implement Content Security Policy',
        description: 'No CSP header found - site vulnerable to XSS attacks',
        impact: 'Attackers can inject malicious scripts',
        solution: 'Add Content-Security-Policy header with restrictive directives',
        location: 'Web Server Config (Response Headers)',
        owaspRef: 'A7:2017 - Cross-Site Scripting (XSS)',
        resources: [
          { title: 'CSP Reference', url: 'https://content-security-policy.com/' },
        ],
      });
    }

    if (!(hd['Strict-Transport-Security'] || {}).present) {
      recommendations.push({
        priority: 'high',
        title: 'Enable HTTP Strict Transport Security',
        description: 'HSTS header not present',
        impact: 'Site vulnerable to protocol downgrade attacks',
        solution: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains',
        location: 'Web Server Config (Response Headers)',
        owaspRef: 'A3:2017 - Sensitive Data Exposure',
      });
    }

    if (!(hd['X-Frame-Options'] || {}).present) {
      recommendations.push({
        priority: 'medium',
        title: 'Prevent Clickjacking Attacks',
        description: 'X-Frame-Options header not set',
        impact: 'Site can be embedded in malicious iframes',
        solution: 'Add X-Frame-Options: DENY or SAMEORIGIN',
        location: 'Web Server Config (Response Headers)',
        owaspRef: 'A5:2017 - Broken Access Control',
      });
    }

    if (!(hd['X-Content-Type-Options'] || {}).present) {
      recommendations.push({
        priority: 'medium',
        title: 'Prevent MIME Sniffing',
        description: 'X-Content-Type-Options header missing',
        impact: 'Browsers may misinterpret file types',
        solution: 'Add X-Content-Type-Options: nosniff',
        location: 'Web Server Config (Response Headers)',
        owaspRef: 'A6:2017 - Security Misconfiguration',
      });
    }

    // Vulnerability recommendations
    (vulnerabilities.issues || []).forEach(vuln => {
      if (vuln.severity === 'critical') {
        recommendations.push({
          priority: 'critical',
          title: vuln.title,
          description: vuln.description,
          impact: 'Critical security vulnerability',
          solution: vuln.solution,
          owaspRef: 'A1:2017 - Injection',
        });
      } else if (vuln.severity === 'high') {
        recommendations.push({
          priority: 'high',
          title: vuln.title,
          description: vuln.description,
          impact: 'High-severity security issue',
          solution: vuln.solution,
        });
      }
    });

    // Cookie recommendations
    if (cookies.score < 70 && cookies.total > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve Cookie Security',
        description: 'Cookies not properly secured with HttpOnly, Secure, and SameSite flags',
        impact: 'Cookies vulnerable to XSS and CSRF attacks',
        solution: 'Set HttpOnly, Secure, and SameSite=Strict flags on all cookies',
        location: 'Application Code (Server-Side)',
        owaspRef: 'A2:2017 - Broken Authentication',
      });
    }

    // Third-party script recommendations
    if (thirdParty.score < 50 && thirdParty.total > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Add Subresource Integrity Checks',
        description: `${thirdParty.total - thirdParty.withSRI} third-party scripts without SRI`,
        impact: 'Third-party scripts could be compromised',
        solution: 'Add integrity and crossorigin attributes to external scripts',
        location: 'HTML Source Code (Webpage)',
        owaspRef: 'A9:2017 - Using Components with Known Vulnerabilities',
      });
    }

    return recommendations;
  }
}

module.exports = new SecurityAnalyzerService();
