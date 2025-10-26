/**
 * CRO (Conversion Rate Optimization) Analyzer
 * Analyzes conversion elements: CTAs, forms, trust signals, mobile UX
 * Target: $2k-10k per CRO audit
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

const logger = createLogger('CROAnalyzerService');

class CROAnalyzerService {
  async analyzeCRO(url) {
    logger.info(`Starting CRO analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        // Analyze page elements
        const analysis = await page.evaluate(() => {
          // CTA Detection
          const buttons = Array.from(document.querySelectorAll('button, a.btn, a.button, input[type="submit"], input[type="button"]'));
          const ctas = buttons.filter(btn => {
            const text = btn.textContent.toLowerCase();
            const actionWords = ['buy', 'purchase', 'order', 'subscribe', 'sign up', 'register', 'download', 'get started', 'try', 'join', 'contact', 'book', 'request'];
            return actionWords.some(word => text.includes(word));
          });
          
          // Form Analysis
          const forms = Array.from(document.querySelectorAll('form'));
          const formAnalysis = forms.map(form => {
            const inputs = form.querySelectorAll('input, select, textarea');
            return {
              fieldCount: inputs.length,
              hasEmail: form.querySelector('input[type="email"]') !== null,
              hasPhone: form.querySelector('input[type="tel"]') !== null,
              hasValidation: form.querySelector('[required]') !== null,
              hasAutocomplete: form.querySelector('[autocomplete]') !== null
            };
          });
          
          // Trust Signals
          const trustSignals = {
            hasSSL: window.location.protocol === 'https:',
            hasTestimonials: document.querySelectorAll('[class*="testimonial"], [class*="review"]').length > 0,
            hasSocialProof: document.querySelectorAll('[class*="trust"], [class*="badge"], [class*="certified"]').length > 0,
            hasContactInfo: document.body.textContent.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/) !== null,
            hasPrivacyPolicy: Array.from(document.querySelectorAll('a')).some(a => a.textContent.toLowerCase().includes('privacy')),
            hasSecurityBadges: document.querySelectorAll('img[alt*="secure"], img[alt*="verified"], img[alt*="trusted"]').length > 0
          };
          
          // Mobile UX Elements
          const mobileUX = {
            tapTargets: buttons.filter(btn => {
              const rect = btn.getBoundingClientRect();
              return rect.width >= 44 && rect.height >= 44; // Apple's recommended minimum
            }).length,
            totalButtons: buttons.length,
            hasViewportMeta: document.querySelector('meta[name="viewport"]') !== null,
            fontSizes: Array.from(document.querySelectorAll('p, span, div')).slice(0, 50).map(el => {
              return parseFloat(window.getComputedStyle(el).fontSize);
            }).filter(size => size > 0)
          };
          
          // Value Proposition
          const headlines = Array.from(document.querySelectorAll('h1, h2')).slice(0, 5);
          
          return {
            ctas: {
              count: ctas.length,
              visible: ctas.filter(cta => {
                const rect = cta.getBoundingClientRect();
                return rect.top >= 0 && rect.top <= window.innerHeight;
              }).length,
              examples: ctas.slice(0, 5).map(cta => cta.textContent.trim())
            },
            forms: {
              count: forms.length,
              details: formAnalysis
            },
            trustSignals,
            mobileUX: {
              tapTargetCompliance: mobileUX.tapTargets / mobileUX.totalButtons,
              hasViewportMeta: mobileUX.hasViewportMeta,
              avgFontSize: mobileUX.fontSizes.length > 0 
                ? mobileUX.fontSizes.reduce((a, b) => a + b, 0) / mobileUX.fontSizes.length 
                : 0
            },
            headlines: headlines.map(h => h.textContent.trim().substring(0, 100))
          };
        });
        
        await page.close();
        return analysis;
      });
      
      // Calculate scores
      const scores = this.calculateScores(results);
      const recommendations = this.generateRecommendations(results, scores);
      
      const analysisTime = ((Date.now() - startTime) / 1000).toFixed(2);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        analysis: results,
        scores,
        overallScore: scores.overall,
        grade: this.getGrade(scores.overall),
        recommendations,
        conversionPotential: this.assessConversionPotential(scores),
        analysisTime
      };
      
    } catch (error) {
      logger.error('CRO analysis failed:', error);
      throw new Error(`CRO analysis failed: ${error.message}`);
    }
  }

  calculateScores(analysis) {
    let ctaScore = 0;
    if (analysis.ctas.count > 0) ctaScore += 40;
    if (analysis.ctas.visible > 0) ctaScore += 30;
    if (analysis.ctas.count >= 3) ctaScore += 30;
    
    let formScore = 0;
    if (analysis.forms.count > 0) {
      formScore += 50;
      const avgFields = analysis.forms.details.reduce((sum, f) => sum + f.fieldCount, 0) / analysis.forms.details.length;
      if (avgFields <= 5) formScore += 30; // Short forms convert better
      if (analysis.forms.details.some(f => f.hasValidation)) formScore += 20;
    }
    
    let trustScore = 0;
    if (analysis.trustSignals.hasSSL) trustScore += 20;
    if (analysis.trustSignals.hasTestimonials) trustScore += 20;
    if (analysis.trustSignals.hasSocialProof) trustScore += 20;
    if (analysis.trustSignals.hasContactInfo) trustScore += 15;
    if (analysis.trustSignals.hasPrivacyPolicy) trustScore += 15;
    if (analysis.trustSignals.hasSecurityBadges) trustScore += 10;
    
    let mobileScore = 0;
    if (analysis.mobileUX.hasViewportMeta) mobileScore += 30;
    if (analysis.mobileUX.tapTargetCompliance > 0.7) mobileScore += 40;
    if (analysis.mobileUX.avgFontSize >= 16) mobileScore += 30;
    
    const overall = Math.round((ctaScore + formScore + trustScore + mobileScore) / 4);
    
    return { cta: ctaScore, form: formScore, trust: trustScore, mobile: mobileScore, overall };
  }

  generateRecommendations(analysis, scores) {
    const recs = [];
    
    if (scores.cta < 70) {
      recs.push({
        priority: 'critical',
        category: 'CTAs',
        message: 'Add more clear call-to-action buttons',
        detail: `Found only ${analysis.ctas.count} CTAs. Add prominent buttons with action-oriented text like "Get Started" or "Buy Now".`,
        impact: 'High - directly affects conversions'
      });
    }
    
    if (analysis.forms.count === 0) {
      recs.push({
        priority: 'high',
        category: 'Lead Capture',
        message: 'No forms detected',
        detail: 'Add a contact or signup form to capture leads.',
        impact: 'Critical - missing conversion opportunity'
      });
    }
    
    if (scores.trust < 60) {
      recs.push({
        priority: 'high',
        category: 'Trust',
        message: 'Add trust signals',
        detail: 'Include testimonials, reviews, security badges, and clear contact information to build trust.',
        impact: 'High - trust increases conversion rates by 20-40%'
      });
    }
    
    if (scores.mobile < 70) {
      recs.push({
        priority: 'medium',
        category: 'Mobile UX',
        message: 'Improve mobile experience',
        detail: 'Ensure tap targets are at least 44x44 pixels and fonts are at least 16px.',
        impact: 'Medium - mobile traffic is 60%+ of users'
      });
    }
    
    return recs;
  }

  assessConversionPotential(scores) {
    if (scores.overall >= 80) return 'Excellent - optimized for conversions';
    if (scores.overall >= 60) return 'Good - minor improvements needed';
    if (scores.overall >= 40) return 'Fair - significant optimization opportunities';
    return 'Poor - major conversion barriers detected';
  }

  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }
}

module.exports = new CROAnalyzerService();
