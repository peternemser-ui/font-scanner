/**
 * GDPR/Privacy Compliance Scanner
 * Detects cookie consent, privacy policies, trackers
 * Target: $2k-10k per compliance audit
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

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
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Wait a bit for cookie banners to appear
        await page.waitForTimeout(2000);
        
        const analysis = await page.evaluate(() => {
          // Cookie consent detection
          const cookieKeywords = ['cookie', 'consent', 'gdpr', 'privacy', 'we use cookies', 'accept cookies'];
          const allText = document.body.textContent.toLowerCase();
          const hasCookieBanner = cookieKeywords.some(kw => allText.includes(kw));
          
          // Check for common cookie consent libraries
          const cookieLibraries = ['cookiebot', 'onetrust', 'cookieconsent', 'gdpr-cookie'];
          const hasKnownLibrary = cookieLibraries.some(lib => 
            Array.from(document.querySelectorAll('script')).some(s => s.src.toLowerCase().includes(lib))
          );
          
          // Privacy policy check
          const privacyLinks = Array.from(document.querySelectorAll('a')).filter(a => 
            a.textContent.toLowerCase().includes('privacy') || a.href.toLowerCase().includes('privacy')
          );
          
          // Check for data collection forms
          const forms = Array.from(document.querySelectorAll('form'));
          const formsWithEmail = forms.filter(f => f.querySelector('input[type="email"]'));
          
          return {
            cookieConsent: {
              detected: hasCookieBanner || hasKnownLibrary,
              hasKnownLibrary
            },
            privacyPolicy: {
              hasLink: privacyLinks.length > 0,
              links: privacyLinks.map(l => l.href).slice(0, 3)
            },
            dataCollection: {
              formCount: forms.length,
              emailFormCount: formsWithEmail.length
            }
          };
        });
        
        // Analyze cookies
        const cookies = await page.cookies();
        
        // Identify known trackers
        const knownTrackers = ['google-analytics', 'facebook', 'doubleclick', 'hotjar', 'mixpanel', 'segment'];
        const detectedTrackers = [...new Set(thirdPartyRequests)]
          .filter(host => knownTrackers.some(tracker => host.includes(tracker)));
        
        await page.close();
        
        return {
          ...analysis,
          cookies: {
            count: cookies.length,
            hasThirdParty: cookies.some(c => c.domain.startsWith('.')),
            types: cookies.map(c => c.name.substring(0, 30))
          },
          trackers: {
            count: detectedTrackers.length,
            detected: detectedTrackers
          },
          thirdPartyDomains: [...new Set(thirdPartyRequests)].slice(0, 20)
        };
      });
      
      const score = this.calculateComplianceScore(results);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        compliance: results,
        score,
        grade: this.getGrade(score),
        complianceLevel: this.getComplianceLevel(score),
        recommendations: this.generateRecommendations(results),
        risks: this.identifyRisks(results),
        analysisTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };
      
    } catch (error) {
      logger.error('GDPR compliance analysis failed:', error);
      throw new Error(`GDPR compliance analysis failed: ${error.message}`);
    }
  }

  calculateComplianceScore(compliance) {
    let score = 0;
    
    if (compliance.cookieConsent.detected) score += 40;
    if (compliance.privacyPolicy.hasLink) score += 30;
    if (compliance.trackers.count === 0) score += 30;
    
    return score;
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
        risk: 'No cookie consent',
        detail: `${compliance.cookies.count} cookies found but no consent mechanism. GDPR violation.`,
        fine: 'Up to €20 million or 4% of annual revenue'
      });
    }
    
    if (!compliance.privacyPolicy.hasLink && compliance.dataCollection.emailFormCount > 0) {
      risks.push({
        severity: 'high',
        risk: 'No privacy policy',
        detail: 'Collecting email addresses without privacy policy. GDPR violation.',
        fine: 'Up to €10 million or 2% of annual revenue'
      });
    }
    
    if (compliance.trackers.count > 3) {
      risks.push({
        severity: 'medium',
        risk: 'Multiple third-party trackers',
        detail: `${compliance.trackers.count} trackers detected. May require explicit consent.`,
        fine: 'Potential GDPR violation'
      });
    }
    
    return risks;
  }

  generateRecommendations(compliance) {
    const recs = [];
    
    if (!compliance.cookieConsent.detected) {
      recs.push({
        priority: 'critical',
        message: 'Implement cookie consent',
        detail: 'Add a GDPR-compliant cookie consent banner (Cookiebot, OneTrust, etc.).',
        impact: 'Required by law - prevents fines'
      });
    }
    
    if (!compliance.privacyPolicy.hasLink) {
      recs.push({
        priority: 'critical',
        message: 'Add privacy policy',
        detail: 'Create and link to a comprehensive privacy policy.',
        impact: 'Legal requirement for data collection'
      });
    }
    
    if (compliance.trackers.count > 0 && !compliance.cookieConsent.hasKnownLibrary) {
      recs.push({
        priority: 'high',
        message: 'Manage third-party trackers',
        detail: `${compliance.trackers.count} trackers detected. Ensure consent before loading.`,
        impact: 'GDPR compliance requirement'
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
