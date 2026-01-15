/**
 * GDPR/Privacy Compliance Scanner
 * Detects cookie consent, privacy policies, trackers
 * Target: $2k-10k per compliance audit
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('GDPRComplianceService');

class GDPRComplianceService {
  async analyzeCompliance(url) {
    logger.info(`Starting GDPR compliance analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        // Enable request interception to track third-party requests
        await page.setRequestInterception(true);
        const thirdPartyRequests = [];

        page.on('request', req => {
          try {
            const reqUrl = new URL(req.url());
            const pageUrl = new URL(url);
            if (reqUrl.hostname !== pageUrl.hostname) {
              thirdPartyRequests.push(reqUrl.hostname);
            }
          } catch (e) {
            // Ignore invalid URLs
          }
          req.continue();
        });

        // Use domcontentloaded first, then wait for network idle with a timeout
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          // Wait for networkidle with a shorter timeout, continue if it times out
          await Promise.race([
            page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }),
            new Promise(resolve => setTimeout(resolve, 15000))
          ]);
          logger.info('Page loaded successfully');
        } catch (navError) {
          logger.warn(`Navigation issue (continuing with partial load): ${navError.message}`);
        }

        // Wait a bit for cookie banners to appear
        await new Promise(resolve => setTimeout(resolve, 2000));

        const analysis = await page.evaluate(() => {
          // Cookie consent detection
          const cookieKeywords = ['cookie', 'consent', 'gdpr', 'privacy', 'we use cookies', 'accept cookies'];
          const allText = document.body ? document.body.textContent.toLowerCase() : '';
          const hasCookieBanner = cookieKeywords.some(kw => allText.includes(kw));

          // Check for common cookie consent libraries
          const cookieLibraries = ['cookiebot', 'onetrust', 'cookieconsent', 'gdpr-cookie', 'trustarc', 'quantcast', 'usercentrics', 'klaro', 'iubenda', 'termly'];
          const hasKnownLibrary = cookieLibraries.some(lib =>
            Array.from(document.querySelectorAll('script')).some(s => (s.src || '').toLowerCase().includes(lib))
          );
          
          // Detect which library is in use
          let detectedLibrary = null;
          for (const lib of cookieLibraries) {
            if (Array.from(document.querySelectorAll('script')).some(s => (s.src || '').toLowerCase().includes(lib))) {
              detectedLibrary = lib;
              break;
            }
          }

          // Check for reject/decline button (GDPR requirement)
          const rejectKeywords = ['reject', 'decline', 'refuse', 'deny', 'no thanks', 'only necessary', 'essential only'];
          const allButtons = Array.from(document.querySelectorAll('button, a.button, [role="button"], .btn'));
          const hasRejectOption = allButtons.some(btn => 
            rejectKeywords.some(kw => (btn.textContent || '').toLowerCase().includes(kw))
          );
          
          // Check for granular consent options
          const granularKeywords = ['preferences', 'customize', 'manage', 'settings', 'categories', 'functional', 'analytics', 'marketing'];
          const hasGranularConsent = granularKeywords.some(kw => allText.includes(kw));

          // Privacy policy check
          const privacyLinks = Array.from(document.querySelectorAll('a')).filter(a =>
            (a.textContent || '').toLowerCase().includes('privacy') || (a.href || '').toLowerCase().includes('privacy')
          );
          
          // Cookie policy (separate from privacy)
          const cookiePolicyLinks = Array.from(document.querySelectorAll('a')).filter(a =>
            ((a.textContent || '').toLowerCase().includes('cookie policy') || 
             (a.textContent || '').toLowerCase().includes('cookie notice') ||
             (a.href || '').toLowerCase().includes('cookie-policy') ||
             (a.href || '').toLowerCase().includes('cookies'))
          );
          
          // Terms of Service
          const termsLinks = Array.from(document.querySelectorAll('a')).filter(a =>
            (a.textContent || '').toLowerCase().includes('terms') || 
            (a.href || '').toLowerCase().includes('terms')
          );
          
          // Data Subject Rights (GDPR requirement)
          const dsrKeywords = ['delete my data', 'request data', 'access my data', 'data request', 'right to be forgotten', 'opt-out', 'unsubscribe', 'do not sell'];
          const hasDSRInfo = dsrKeywords.some(kw => allText.includes(kw));
          
          // CCPA specific (California)
          const ccpaKeywords = ['ccpa', 'california', 'do not sell my personal information', 'do not sell my info', 'california privacy'];
          const hasCCPACompliance = ccpaKeywords.some(kw => allText.includes(kw));
          
          // Check for contact/DPO information
          const dpoKeywords = ['data protection officer', 'dpo', 'privacy@', 'gdpr@', 'contact us about privacy'];
          const hasDPOContact = dpoKeywords.some(kw => allText.includes(kw));

          // Check for data collection forms
          const forms = Array.from(document.querySelectorAll('form'));
          const formsWithEmail = forms.filter(f => f.querySelector('input[type="email"]'));
          const formsWithPhone = forms.filter(f => f.querySelector('input[type="tel"]'));
          const formsWithCheckbox = forms.filter(f => f.querySelector('input[type="checkbox"]'));
          
          // Check for password/sensitive data fields
          const formsWithPassword = forms.filter(f => f.querySelector('input[type="password"]'));
          const formsWithCreditCard = forms.filter(f => {
            const inputs = Array.from(f.querySelectorAll('input'));
            return inputs.some(i => 
              (i.name || '').toLowerCase().includes('card') || 
              (i.name || '').toLowerCase().includes('cvv') ||
              (i.autocomplete || '').includes('cc-')
            );
          });
          
          // Check for newsletter signup consent
          const newsletterForms = forms.filter(f => {
            const text = (f.textContent || '').toLowerCase();
            return text.includes('newsletter') || text.includes('subscribe') || text.includes('email updates');
          });
          const newsletterWithConsent = newsletterForms.filter(f => {
            const checkboxes = Array.from(f.querySelectorAll('input[type="checkbox"]'));
            return checkboxes.some(cb => {
              const label = cb.closest('label')?.textContent || '';
              return label.toLowerCase().includes('agree') || label.toLowerCase().includes('consent');
            });
          });
          
          // Check for age verification
          const ageKeywords = ['age verification', 'are you 18', 'are you 16', 'date of birth', 'confirm age', 'age gate'];
          const hasAgeVerification = ageKeywords.some(kw => allText.includes(kw));
          
          // Check for SSL/HTTPS
          const isSecure = window.location.protocol === 'https:';
          
          // Check for security badges/seals
          const securityBadges = ['verisign', 'mcafee', 'norton', 'trustwave', 'ssl', 'secure', 'encryption'];
          const hasSecurityBadges = securityBadges.some(badge => 
            Array.from(document.querySelectorAll('img')).some(img => 
              (img.src || '').toLowerCase().includes(badge) || 
              (img.alt || '').toLowerCase().includes(badge)
            )
          );
          
          // Check for consent withdrawal instructions
          const withdrawalKeywords = ['withdraw consent', 'revoke consent', 'opt out', 'unsubscribe', 'delete account', 'close account'];
          const hasWithdrawalInfo = withdrawalKeywords.some(kw => allText.includes(kw));
          
          // Check for data retention information
          const retentionKeywords = ['how long we keep', 'data retention', 'keep your data', 'retention period', 'store your data'];
          const hasRetentionInfo = retentionKeywords.some(kw => allText.includes(kw));
          
          // Check for international data transfer info
          const transferKeywords = ['data transfer', 'transfer to', 'international transfer', 'outside', 'third countries', 'eu-us privacy shield', 'standard contractual clauses'];
          const hasTransferInfo = transferKeywords.some(kw => allText.includes(kw));
          
          // Check for automated decision making disclosure
          const automatedKeywords = ['automated decision', 'profiling', 'algorithm', 'automated processing'];
          const hasAutomatedDecisionInfo = automatedKeywords.some(kw => allText.includes(kw));

          return {
            cookieConsent: {
              detected: hasCookieBanner || hasKnownLibrary,
              hasKnownLibrary,
              detectedLibrary,
              hasRejectOption,
              hasGranularConsent
            },
            privacyPolicy: {
              hasLink: privacyLinks.length > 0,
              links: privacyLinks.map(l => l.href).slice(0, 3)
            },
            cookiePolicy: {
              hasLink: cookiePolicyLinks.length > 0,
              links: cookiePolicyLinks.map(l => l.href).slice(0, 3)
            },
            termsOfService: {
              hasLink: termsLinks.length > 0,
              links: termsLinks.map(l => l.href).slice(0, 3)
            },
            dataSubjectRights: {
              hasInfo: hasDSRInfo,
              hasDPOContact,
              hasWithdrawalInfo,
              hasRetentionInfo,
              hasTransferInfo,
              hasAutomatedDecisionInfo
            },
            internationalCompliance: {
              ccpa: hasCCPACompliance,
              gdpr: hasCookieBanner || hasKnownLibrary
            },
            dataCollection: {
              formCount: forms.length,
              emailFormCount: formsWithEmail.length,
              phoneFormCount: formsWithPhone.length,
              passwordFormCount: formsWithPassword.length,
              creditCardFormCount: formsWithCreditCard.length,
              hasConsentCheckboxes: formsWithCheckbox.length > 0,
              newsletterFormCount: newsletterForms.length,
              newsletterWithConsent: newsletterWithConsent.length
            },
            security: {
              isSecure,
              hasSecurityBadges,
              hasAgeVerification
            }
          };
        });

        // Analyze cookies with classification
        const cookies = await page.cookies();
        
        // Cookie classification patterns
        const cookiePatterns = {
          necessary: ['session', 'csrf', 'xsrf', 'security', 'auth', 'login', 'cart', 'basket'],
          functional: ['language', 'lang', 'locale', 'timezone', 'preferences', 'settings'],
          analytics: ['_ga', '_gid', '_gat', 'analytics', 'stat', 'matomo', 'piwik', 'plausible'],
          marketing: ['_fbp', '_fbc', 'ads', 'campaign', 'utm_', 'doubleclick', 'adroll', 'criteo', 'pixel'],
          social: ['facebook', 'twitter', 'linkedin', 'instagram', 'pinterest', 'social']
        };
        
        const classifiedCookies = {
          necessary: [],
          functional: [],
          analytics: [],
          marketing: [],
          social: [],
          unknown: []
        };
        
        for (const cookie of cookies) {
          const name = cookie.name.toLowerCase();
          let classified = false;
          
          for (const [category, patterns] of Object.entries(cookiePatterns)) {
            if (patterns.some(p => name.includes(p))) {
              classifiedCookies[category].push({
                name: cookie.name,
                domain: cookie.domain,
                expires: cookie.expires,
                httpOnly: cookie.httpOnly,
                secure: cookie.secure,
                sameSite: cookie.sameSite
              });
              classified = true;
              break;
            }
          }
          
          if (!classified) {
            classifiedCookies.unknown.push({
              name: cookie.name,
              domain: cookie.domain,
              expires: cookie.expires,
              httpOnly: cookie.httpOnly,
              secure: cookie.secure,
              sameSite: cookie.sameSite
            });
          }
        }
        
        // Calculate cookie lifespan stats
        const now = Date.now() / 1000;
        const sessionCookies = cookies.filter(c => c.expires === -1 || c.expires === 0);
        const persistentCookies = cookies.filter(c => c.expires > 0);
        const longLivedCookies = persistentCookies.filter(c => (c.expires - now) > 365 * 24 * 60 * 60); // > 1 year

        // Identify known trackers
        const knownTrackers = ['google-analytics', 'facebook', 'doubleclick', 'hotjar', 'mixpanel', 'segment', 'analytics', 'gtm', 'gtag', 'clarity', 'heap', 'amplitude', 'intercom', 'hubspot', 'marketo'];
        const detectedTrackers = [...new Set(thirdPartyRequests)]
          .filter(host => knownTrackers.some(tracker => host.includes(tracker)));
        
        // Classify trackers by type
        const trackerCategories = {
          analytics: ['google-analytics', 'analytics', 'gtm', 'gtag', 'matomo', 'plausible', 'clarity', 'heap', 'amplitude'],
          advertising: ['doubleclick', 'facebook', 'ads', 'adroll', 'criteo', 'taboola', 'outbrain'],
          social: ['facebook', 'twitter', 'linkedin', 'pinterest', 'instagram'],
          customer: ['intercom', 'hubspot', 'drift', 'zendesk', 'freshdesk'],
          heatmap: ['hotjar', 'mouseflow', 'crazyegg', 'fullstory', 'logrocket']
        };
        
        const classifiedTrackers = {};
        for (const [category, patterns] of Object.entries(trackerCategories)) {
          classifiedTrackers[category] = detectedTrackers.filter(t => 
            patterns.some(p => t.includes(p))
          );
        }

        await page.close();

        return {
          ...analysis,
          cookies: {
            count: cookies.length,
            hasThirdParty: cookies.some(c => c.domain.startsWith('.')),
            types: cookies.map(c => c.name.substring(0, 30)),
            classified: classifiedCookies,
            sessionCount: sessionCookies.length,
            persistentCount: persistentCookies.length,
            longLivedCount: longLivedCookies.length
          },
          trackers: {
            count: detectedTrackers.length,
            detected: detectedTrackers,
            classified: classifiedTrackers
          },
          thirdPartyDomains: [...new Set(thirdPartyRequests)].slice(0, 20)
        };
      });

      const score = this.calculateComplianceScore(results);
      const consentQuality = this.assessConsentQuality(results);

      return {
        url,
        timestamp: new Date().toISOString(),
        compliance: results,
        score,
        grade: this.getGrade(score),
        complianceLevel: this.getComplianceLevel(score),
        consentQuality,
        recommendations: this.generateRecommendations(results),
        risks: this.identifyRisks(results),
        analysisTime: formatDuration(Date.now() - startTime, 2)
      };

    } catch (error) {
      logger.error('GDPR compliance analysis failed:', error);
      throw new Error(`GDPR compliance analysis failed: ${error.message}`);
    }
  }

  calculateComplianceScore(compliance) {
    let score = 0;

    // Cookie consent (max 25 points)
    if (compliance.cookieConsent.detected) score += 15;
    if (compliance.cookieConsent.hasKnownLibrary) score += 5;
    if (compliance.cookieConsent.hasRejectOption) score += 5;
    
    // Privacy & legal pages (max 25 points)
    if (compliance.privacyPolicy.hasLink) score += 15;
    if (compliance.cookiePolicy?.hasLink) score += 5;
    if (compliance.termsOfService?.hasLink) score += 5;
    
    // Tracker management (max 20 points)
    if (compliance.trackers.count === 0) score += 20;
    else if (compliance.trackers.count <= 2) score += 15;
    else if (compliance.trackers.count <= 5) score += 10;
    else score += 5;
    
    // Data subject rights (max 15 points)
    if (compliance.dataSubjectRights?.hasInfo) score += 10;
    if (compliance.dataSubjectRights?.hasDPOContact) score += 5;
    
    // Consent quality (max 15 points)
    if (compliance.cookieConsent.hasGranularConsent) score += 10;
    if (compliance.dataCollection?.hasConsentCheckboxes) score += 5;

    return Math.min(100, score);
  }
  
  assessConsentQuality(compliance) {
    const quality = {
      score: 0,
      maxScore: 100,
      factors: []
    };
    
    // Banner presence (20 points)
    if (compliance.cookieConsent.detected) {
      quality.score += 20;
      quality.factors.push({ name: 'Cookie banner present', status: 'pass', points: 20 });
    } else {
      quality.factors.push({ name: 'Cookie banner present', status: 'fail', points: 0 });
    }
    
    // Known library (15 points)
    if (compliance.cookieConsent.hasKnownLibrary) {
      quality.score += 15;
      quality.factors.push({ name: 'Uses compliant consent library', status: 'pass', points: 15, library: compliance.cookieConsent.detectedLibrary });
    } else if (compliance.cookieConsent.detected) {
      quality.factors.push({ name: 'Uses compliant consent library', status: 'warn', points: 0, note: 'Custom implementation - verify compliance' });
    } else {
      quality.factors.push({ name: 'Uses compliant consent library', status: 'fail', points: 0 });
    }
    
    // Reject option (25 points - GDPR requirement)
    if (compliance.cookieConsent.hasRejectOption) {
      quality.score += 25;
      quality.factors.push({ name: 'Easy reject option available', status: 'pass', points: 25 });
    } else {
      quality.factors.push({ name: 'Easy reject option available', status: 'fail', points: 0, note: 'GDPR requires equally prominent reject option' });
    }
    
    // Granular consent (20 points)
    if (compliance.cookieConsent.hasGranularConsent) {
      quality.score += 20;
      quality.factors.push({ name: 'Granular consent options', status: 'pass', points: 20 });
    } else {
      quality.factors.push({ name: 'Granular consent options', status: 'warn', points: 0, note: 'Users should be able to choose cookie categories' });
    }
    
    // Pre-consent cookie loading (20 points)
    const nonEssentialCookies = (compliance.cookies.classified?.analytics?.length || 0) + 
                                 (compliance.cookies.classified?.marketing?.length || 0) +
                                 (compliance.cookies.classified?.social?.length || 0);
    if (nonEssentialCookies === 0) {
      quality.score += 20;
      quality.factors.push({ name: 'No pre-consent non-essential cookies', status: 'pass', points: 20 });
    } else {
      quality.factors.push({ name: 'No pre-consent non-essential cookies', status: 'fail', points: 0, note: `${nonEssentialCookies} non-essential cookies loaded before consent` });
    }
    
    quality.grade = quality.score >= 80 ? 'A' : quality.score >= 60 ? 'B' : quality.score >= 40 ? 'C' : 'F';
    quality.status = quality.score >= 80 ? 'Excellent' : quality.score >= 60 ? 'Good' : quality.score >= 40 ? 'Needs Work' : 'Poor';
    
    return quality;
  }

  getComplianceLevel(score) {
    if (score >= 80) return 'Fully Compliant';
    if (score >= 60) return 'Mostly Compliant';
    if (score >= 40) return 'Partially Compliant';
    return 'Non-Compliant';
  }

  identifyRisks(compliance) {
    const risks = [];

    if (!compliance.cookieConsent.detected && compliance.cookies.count > 0) {
      risks.push({
        severity: 'critical',
        risk: 'No cookie consent mechanism',
        detail: `${compliance.cookies.count} cookies found but no consent mechanism detected. This is a direct GDPR violation.`,
        fine: 'Up to €20 million or 4% of annual global revenue',
        remedy: 'Implement a GDPR-compliant cookie consent solution immediately'
      });
    }
    
    if (compliance.cookieConsent.detected && !compliance.cookieConsent.hasRejectOption) {
      risks.push({
        severity: 'high',
        risk: 'No easy reject option',
        detail: 'Cookie consent banner lacks an equally prominent reject option. GDPR requires consent to be as easy to withdraw as to give.',
        fine: 'Up to €10 million or 2% of annual revenue',
        remedy: 'Add a clear "Reject All" or "Only Essential" button'
      });
    }

    if (!compliance.privacyPolicy.hasLink && compliance.dataCollection.emailFormCount > 0) {
      risks.push({
        severity: 'critical',
        risk: 'No privacy policy with data collection',
        detail: 'Collecting email addresses without a visible privacy policy link. GDPR Article 13 violation.',
        fine: 'Up to €10 million or 2% of annual revenue',
        remedy: 'Create and link to a comprehensive privacy policy'
      });
    }
    
    // Pre-consent tracking
    const nonEssentialCookies = (compliance.cookies.classified?.analytics?.length || 0) + 
                                 (compliance.cookies.classified?.marketing?.length || 0);
    if (nonEssentialCookies > 0 && !compliance.cookieConsent.hasKnownLibrary) {
      risks.push({
        severity: 'high',
        risk: 'Pre-consent tracking cookies',
        detail: `${nonEssentialCookies} analytics/marketing cookies loaded before user consent. GDPR requires consent before non-essential cookies.`,
        fine: 'Up to €20 million or 4% of annual revenue',
        remedy: 'Defer loading analytics/marketing scripts until after consent'
      });
    }

    if (compliance.trackers.count > 5) {
      risks.push({
        severity: 'medium',
        risk: 'Excessive third-party trackers',
        detail: `${compliance.trackers.count} trackers detected. This increases data protection complexity and user privacy concerns.`,
        fine: 'Potential GDPR/ePrivacy violation',
        remedy: 'Audit and reduce unnecessary third-party trackers'
      });
    }
    
    if (compliance.cookies.longLivedCount > 0) {
      risks.push({
        severity: 'low',
        risk: 'Long-lived cookies detected',
        detail: `${compliance.cookies.longLivedCount} cookies have expiration over 1 year. GDPR recommends shorter retention periods.`,
        fine: 'Potential compliance issue',
        remedy: 'Review cookie retention and reduce to minimum necessary'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasInfo && compliance.dataCollection?.formCount > 0) {
      risks.push({
        severity: 'medium',
        risk: 'No data subject rights information',
        detail: 'No visible information about user rights (access, deletion, portability). GDPR requires clear communication of rights.',
        fine: 'Up to €10 million or 2% of annual revenue',
        remedy: 'Add clear information about user data rights in privacy policy'
      });
    }
    
    // New risks for enhanced analysis
    if (!compliance.security?.isSecure && compliance.dataCollection?.formCount > 0) {
      risks.push({
        severity: 'critical',
        risk: 'No HTTPS encryption',
        detail: 'Forms collecting data without HTTPS. GDPR Article 32 requires appropriate security measures.',
        fine: 'Up to €10 million or 2% of annual revenue',
        remedy: 'Implement SSL/TLS certificate immediately'
      });
    }
    
    if (compliance.dataCollection?.creditCardFormCount > 0 && !compliance.security?.isSecure) {
      risks.push({
        severity: 'critical',
        risk: 'Insecure payment collection',
        detail: 'Credit card data collected without HTTPS. PCI DSS and GDPR violation.',
        fine: 'Up to €20 million + PCI DSS fines + potential data breach liability',
        remedy: 'Implement HTTPS and ensure PCI DSS compliance'
      });
    }
    
    if (compliance.dataCollection?.newsletterFormCount > 0 && 
        compliance.dataCollection?.newsletterWithConsent === 0) {
      risks.push({
        severity: 'medium',
        risk: 'Newsletter signup without explicit consent',
        detail: `${compliance.dataCollection.newsletterFormCount} newsletter forms without consent checkboxes. GDPR requires active opt-in.`,
        fine: 'Up to €10 million or 2% of annual revenue',
        remedy: 'Add opt-in checkboxes to all newsletter forms'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasWithdrawalInfo && compliance.dataCollection?.formCount > 0) {
      risks.push({
        severity: 'low',
        risk: 'No consent withdrawal instructions',
        detail: 'No clear information on how users can withdraw consent or delete their data.',
        fine: 'GDPR Article 7(3) violation',
        remedy: 'Add withdrawal/deletion instructions to privacy policy'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasRetentionInfo && compliance.dataCollection?.emailFormCount > 0) {
      risks.push({
        severity: 'low',
        risk: 'No data retention disclosure',
        detail: 'No information about how long data is stored. GDPR Article 13(2)(a) requirement.',
        fine: 'Potential compliance issue',
        remedy: 'Disclose data retention periods in privacy policy'
      });
    }

    return risks;
  }

  generateRecommendations(compliance) {
    const recs = [];

    if (!compliance.cookieConsent.detected) {
      recs.push({
        priority: 'critical',
        category: 'Cookie Consent',
        message: 'Implement GDPR-compliant cookie consent',
        detail: 'Add a cookie consent banner using a compliant solution like Cookiebot, OneTrust, or Iubenda.',
        impact: 'Required by law - prevents significant fines',
        timeEstimate: '2-4 hours',
        cost: '$50-500/year for consent management platform'
      });
    } else if (!compliance.cookieConsent.hasRejectOption) {
      recs.push({
        priority: 'high',
        category: 'Cookie Consent',
        message: 'Add reject/decline option to cookie banner',
        detail: 'Include a visible "Reject All" or "Only Necessary" button that is as prominent as the accept button.',
        impact: 'GDPR requires equally easy consent withdrawal',
        timeEstimate: '1-2 hours',
        cost: 'Configuration change (no additional cost)'
      });
    }
    
    if (!compliance.cookieConsent.hasGranularConsent && compliance.cookieConsent.detected) {
      recs.push({
        priority: 'medium',
        category: 'Cookie Consent',
        message: 'Add granular consent options',
        detail: 'Allow users to select which cookie categories they accept (necessary, functional, analytics, marketing).',
        impact: 'Best practice for GDPR compliance',
        timeEstimate: '2-3 hours',
        cost: 'May be included in consent platform'
      });
    }

    if (!compliance.privacyPolicy.hasLink) {
      recs.push({
        priority: 'critical',
        category: 'Legal Pages',
        message: 'Add privacy policy',
        detail: 'Create and prominently link to a comprehensive privacy policy that explains data collection and processing.',
        impact: 'Legal requirement for all websites collecting data',
        timeEstimate: '4-8 hours (or use generator)',
        cost: '$200-1000 for legal review'
      });
    }
    
    if (!compliance.cookiePolicy?.hasLink && compliance.cookies.count > 0) {
      recs.push({
        priority: 'medium',
        category: 'Legal Pages',
        message: 'Add dedicated cookie policy',
        detail: 'Create a separate cookie policy page explaining what cookies are used and why.',
        impact: 'Improves transparency and compliance',
        timeEstimate: '2-4 hours',
        cost: 'Can use free generators'
      });
    }

    if (compliance.trackers.count > 0 && !compliance.cookieConsent.hasKnownLibrary) {
      recs.push({
        priority: 'high',
        category: 'Trackers',
        message: 'Control third-party tracker loading',
        detail: `${compliance.trackers.count} trackers detected. Ensure they only load after user consent.`,
        impact: 'GDPR requires consent before tracking',
        timeEstimate: '3-6 hours',
        cost: 'Development time'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasInfo) {
      recs.push({
        priority: 'medium',
        category: 'Data Rights',
        message: 'Add data subject rights information',
        detail: 'Explain how users can request access to, correction of, or deletion of their data.',
        impact: 'GDPR Article 12-23 requirement',
        timeEstimate: '1-2 hours',
        cost: 'Add section to privacy policy'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasDPOContact) {
      recs.push({
        priority: 'low',
        category: 'Contact',
        message: 'Add privacy contact information',
        detail: 'Provide a dedicated email or contact method for privacy-related inquiries.',
        impact: 'Improves user trust and compliance',
        timeEstimate: '30 minutes',
        cost: 'Free (create email alias)'
      });
    }
    
    if (!compliance.internationalCompliance?.ccpa && compliance.trackers.count > 0) {
      recs.push({
        priority: 'low',
        category: 'International',
        message: 'Consider CCPA compliance',
        detail: 'If serving California residents, add "Do Not Sell My Personal Information" link.',
        impact: 'Required for businesses serving California users',
        timeEstimate: '2-3 hours',
        cost: 'May require consent platform upgrade'
      });
    }
    
    // New recommendations for enhanced analysis
    if (!compliance.security?.isSecure) {
      recs.push({
        priority: 'critical',
        category: 'Security',
        message: 'Implement HTTPS encryption',
        detail: 'Secure your website with SSL/TLS certificate. Required for GDPR Article 32 security measures.',
        impact: 'Essential for data protection and user trust',
        timeEstimate: '1-2 hours',
        cost: '$0 (Let\'s Encrypt) - $200/year'
      });
    }
    
    if (compliance.dataCollection?.newsletterFormCount > 0 && 
        compliance.dataCollection?.newsletterWithConsent === 0) {
      recs.push({
        priority: 'medium',
        category: 'Forms',
        message: 'Add consent checkboxes to newsletter signups',
        detail: 'Include unchecked consent checkboxes for newsletter subscriptions. Pre-checked boxes are not valid consent.',
        impact: 'GDPR requires active, informed consent',
        timeEstimate: '1-2 hours',
        cost: 'Development time'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasWithdrawalInfo && compliance.dataCollection?.formCount > 0) {
      recs.push({
        priority: 'low',
        category: 'Data Rights',
        message: 'Add consent withdrawal instructions',
        detail: 'Explain how users can withdraw consent or request data deletion. Should be as easy as giving consent.',
        impact: 'GDPR Article 7(3) requirement',
        timeEstimate: '1 hour',
        cost: 'Add to privacy policy'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasRetentionInfo) {
      recs.push({
        priority: 'low',
        category: 'Transparency',
        message: 'Disclose data retention periods',
        detail: 'Clearly state how long you keep user data and the criteria for determining retention periods.',
        impact: 'GDPR Article 13(2)(a) transparency requirement',
        timeEstimate: '1-2 hours',
        cost: 'Update privacy policy'
      });
    }
    
    if (!compliance.dataSubjectRights?.hasTransferInfo && compliance.trackers.count > 0) {
      recs.push({
        priority: 'low',
        category: 'Transparency',
        message: 'Disclose international data transfers',
        detail: 'If data is transferred outside the EU/EEA, explain the safeguards in place (Standard Contractual Clauses, etc.).',
        impact: 'GDPR Chapter V requirement',
        timeEstimate: '1-2 hours',
        cost: 'Update privacy policy'
      });
    }
    
    if (!compliance.security?.hasAgeVerification && compliance.dataCollection?.formCount > 0) {
      recs.push({
        priority: 'low',
        category: 'Child Protection',
        message: 'Consider age verification',
        detail: 'GDPR requires parental consent for children under 16 (13-16 depending on country). Consider adding age verification.',
        impact: 'GDPR Article 8 requirement if targeting children',
        timeEstimate: '3-5 hours',
        cost: 'Development + UX design'
      });
    }

    return recs;
  }

  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    return 'F';
  }
}

module.exports = new GDPRComplianceService();
