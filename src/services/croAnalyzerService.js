/**
 * CRO (Conversion Rate Optimization) Analyzer
 * Analyzes conversion elements: CTAs, forms, trust signals, mobile UX
 * Target: $2k-10k per CRO audit
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('CROAnalyzerService');

class CROAnalyzerService {
  async analyzeCRO(url) {
    logger.info(`Starting CRO analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Use domcontentloaded for faster initial load, then wait for network to settle
        try {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
          // Give additional time for dynamic content to load
          await page.waitForNetworkIdle({ idleTime: 1000, timeout: 15000 }).catch(() => {
            logger.info('Network idle timeout - proceeding with available content');
          });
        } catch (navError) {
          // If domcontentloaded also fails, the site is truly unreachable
          if (navError.name === 'TimeoutError') {
            throw new Error(`Could not load website: ${url} - the site may be blocking automated access or is too slow`);
          }
          throw navError;
        }
        
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
      const quickWins = this.generateQuickWins(results, scores);

      const analysisTime = formatDuration(Date.now() - startTime, 2);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        analysis: results,
        scores,
        overallScore: scores.overall,
        grade: this.getGrade(scores.overall),
        recommendations,
        quickWins,
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

    const overall = roundTo((ctaScore + formScore + trustScore + mobileScore) / 4, 0);

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

  generateQuickWins(analysis, scores) {
    const quickWins = [];
    
    // Quick Win 1: Add visible CTA above the fold
    if (analysis.ctas.visible === 0 && analysis.ctas.count > 0) {
      quickWins.push({
        title: 'Move a CTA above the fold',
        timeEstimate: '2 min',
        impact: '+15-25% click rate',
        icon: '🎯',
        steps: [
          'Identify your most important CTA button',
          'Move it to be visible without scrolling',
          'Use contrasting colors to make it stand out'
        ],
        difficulty: 'Easy'
      });
    } else if (analysis.ctas.count === 0) {
      quickWins.push({
        title: 'Add a clear call-to-action button',
        timeEstimate: '5 min',
        impact: '+20-40% conversions',
        icon: '🎯',
        steps: [
          'Add a button with action text like "Get Started" or "Contact Us"',
          'Place it prominently in the hero section',
          'Use a contrasting color that stands out'
        ],
        difficulty: 'Easy'
      });
    }
    
    // Quick Win 2: SSL/Security
    if (!analysis.trustSignals.hasSSL) {
      quickWins.push({
        title: 'Enable HTTPS/SSL certificate',
        timeEstimate: '10 min',
        impact: '+10-15% trust',
        icon: '🔒',
        steps: [
          'Get a free SSL certificate from Let\'s Encrypt',
          'Install it on your hosting provider',
          'Redirect all HTTP traffic to HTTPS'
        ],
        difficulty: 'Medium'
      });
    }
    
    // Quick Win 3: Contact info
    if (!analysis.trustSignals.hasContactInfo) {
      quickWins.push({
        title: 'Add visible phone number',
        timeEstimate: '1 min',
        impact: '+5-10% trust',
        icon: '📞',
        steps: [
          'Add your phone number to the header or footer',
          'Make it clickable for mobile users (tel: link)',
          'Consider adding a WhatsApp or chat option'
        ],
        difficulty: 'Easy'
      });
    }
    
    // Quick Win 4: Privacy Policy
    if (!analysis.trustSignals.hasPrivacyPolicy) {
      quickWins.push({
        title: 'Add privacy policy link',
        timeEstimate: '3 min',
        impact: '+5% trust, legal compliance',
        icon: '📋',
        steps: [
          'Create a privacy policy page (use a generator if needed)',
          'Add a link to it in the footer',
          'Link it near any forms that collect data'
        ],
        difficulty: 'Easy'
      });
    }
    
    // Quick Win 5: Tap targets for mobile
    if (analysis.mobileUX.tapTargetCompliance < 0.8 && analysis.mobileUX.tapTargetCompliance > 0) {
      quickWins.push({
        title: 'Increase button sizes for mobile',
        timeEstimate: '5 min',
        impact: '+10-20% mobile conversions',
        icon: '📱',
        steps: [
          'Set minimum button height to 44px',
          'Add padding of at least 12px around button text',
          'Increase spacing between clickable elements'
        ],
        difficulty: 'Easy'
      });
    }
    
    // Quick Win 6: Font size
    if (analysis.mobileUX.avgFontSize < 16 && analysis.mobileUX.avgFontSize > 0) {
      quickWins.push({
        title: 'Increase base font size to 16px',
        timeEstimate: '2 min',
        impact: '+5-10% readability',
        icon: '🔤',
        steps: [
          'Set body font-size to 16px minimum in CSS',
          'Check that paragraph text is readable on mobile',
          'Increase line-height to 1.5 for better readability'
        ],
        difficulty: 'Easy'
      });
    }
    
    // Quick Win 7: Form optimization
    if (analysis.forms.count > 0) {
      const longForms = analysis.forms.details.filter(f => f.fieldCount > 5);
      if (longForms.length > 0) {
        quickWins.push({
          title: 'Reduce form fields',
          timeEstimate: '5 min',
          impact: '+25-50% form completions',
          icon: '📝',
          steps: [
            'Remove non-essential form fields',
            'Only ask for email initially (get other info later)',
            'Use smart defaults and autofill attributes'
          ],
          difficulty: 'Easy'
        });
      }
      
      const noValidation = analysis.forms.details.filter(f => !f.hasValidation);
      if (noValidation.length > 0) {
        quickWins.push({
          title: 'Add inline form validation',
          timeEstimate: '10 min',
          impact: '+15% form completions',
          icon: '✅',
          steps: [
            'Add "required" attribute to mandatory fields',
            'Use type="email" for email fields',
            'Show validation errors inline, not after submit'
          ],
          difficulty: 'Medium'
        });
      }
    }
    
    // Quick Win 8: No testimonials
    if (!analysis.trustSignals.hasTestimonials && !analysis.trustSignals.hasSocialProof) {
      quickWins.push({
        title: 'Add a customer testimonial',
        timeEstimate: '5 min',
        impact: '+15-20% trust',
        icon: '💬',
        steps: [
          'Ask your best customer for a short quote',
          'Add their name and photo if possible',
          'Place near your main CTA or pricing section'
        ],
        difficulty: 'Easy'
      });
    }
    
    // Sort by time estimate (shortest first) and limit to top 3
    return quickWins
      .sort((a, b) => parseInt(a.timeEstimate) - parseInt(b.timeEstimate))
      .slice(0, 3);
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
