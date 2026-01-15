/**
 * Local SEO Analyzer
 * Checks Google Business, NAP consistency, local schema, citations
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('LocalSEOService');

class LocalSEOService {
  async analyzeLocalSEO(url) {
    logger.info(`Starting local SEO analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        const analysis = await page.evaluate(() => {
          const text = document.body.textContent;
          const html = document.body.innerHTML;
          
          // NAP (Name, Address, Phone) detection - More strict phone regex
          // Must have proper formatting (parentheses, dashes, dots, or spaces as separators)
          // Avoid matching random digit sequences in scripts/styles
          const phonePatterns = [
            /\(\d{3}\)\s*\d{3}[-.\s]\d{4}/g,           // (123) 456-7890
            /\(\d{3}\)\s*\d{3}\d{4}/g,                  // (123) 4567890
            /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,            // 123-456-7890, 123.456.7890, 123 456 7890
            /\+1\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, // +1 (123) 456-7890
            /1[-.\s]\d{3}[-.\s]\d{3}[-.\s]\d{4}/g      // 1-800-123-4567
          ];
          
          // Get visible text only (exclude scripts, styles, and hidden elements)
          const getVisibleText = () => {
            const walker = document.createTreeWalker(
              document.body,
              NodeFilter.SHOW_TEXT,
              {
                acceptNode: (node) => {
                  const parent = node.parentElement;
                  if (!parent) return NodeFilter.FILTER_REJECT;
                  const tag = parent.tagName.toLowerCase();
                  if (['script', 'style', 'noscript', 'svg', 'path'].includes(tag)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                  const style = window.getComputedStyle(parent);
                  if (style.display === 'none' || style.visibility === 'hidden') {
                    return NodeFilter.FILTER_REJECT;
                  }
                  return NodeFilter.FILTER_ACCEPT;
                }
              }
            );
            
            let visibleText = '';
            while (walker.nextNode()) {
              visibleText += walker.currentNode.textContent + ' ';
            }
            return visibleText;
          };
          
          const visibleText = getVisibleText();
          
          // Find phones in visible text only
          let allPhones = [];
          phonePatterns.forEach(pattern => {
            const matches = visibleText.match(pattern) || [];
            allPhones.push(...matches);
          });
          
          // Clean and dedupe phones
          const phones = [...new Set(allPhones.map(p => p.replace(/\D/g, '').slice(-10)))];
          
          // Filter out obvious non-phone numbers (all same digit, sequential, etc.)
          const validPhones = phones.filter(p => {
            // Must be exactly 10 digits
            if (p.length !== 10) return false;
            // Not all same digit (e.g., 0000000000)
            if (/^(.)\1+$/.test(p)) return false;
            // Not sequential (e.g., 1234567890)
            if (p === '1234567890' || p === '0987654321') return false;
            // Area code shouldn't start with 0 or 1
            if (p[0] === '0' || p[0] === '1') return false;
            return true;
          });
          
          // Email detection - use visible text only
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const emails = [...new Set(visibleText.match(emailRegex) || [])].slice(0, 3);
          
          // Address detection - more comprehensive (use visible text)
          const addressKeywords = ['street', 'st.', 'avenue', 'ave.', 'road', 'rd.', 'boulevard', 'blvd.', 'suite', 'ste.', 'floor', 'city', 'state', 'zip', 'drive', 'dr.', 'lane', 'ln.', 'way', 'court', 'ct.', 'place', 'pl.'];
          const hasAddress = addressKeywords.some(kw => visibleText.toLowerCase().includes(kw));
          
          // ZIP code detection (use visible text)
          const zipRegex = /\b\d{5}(-\d{4})?\b/g;
          const zipCodes = [...new Set(visibleText.match(zipRegex) || [])].slice(0, 3);
          
          // Local schema detection - enhanced
          const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          let schemaDetails = {
            hasLocalBusinessSchema: false,
            hasOrganizationSchema: false,
            hasContactPoint: false,
            hasGeoCoordinates: false,
            hasOpeningHours: false,
            businessName: null,
            businessType: null
          };
          
          schemas.forEach(s => {
            try {
              const data = JSON.parse(s.textContent);
              const checkSchema = (obj) => {
                if (!obj) return;
                if (obj['@type'] === 'LocalBusiness' || (Array.isArray(obj['@type']) && obj['@type'].includes('LocalBusiness'))) {
                  schemaDetails.hasLocalBusinessSchema = true;
                  schemaDetails.businessName = obj.name || null;
                  schemaDetails.businessType = obj['@type'];
                }
                if (obj['@type'] === 'Organization') {
                  schemaDetails.hasOrganizationSchema = true;
                  schemaDetails.businessName = schemaDetails.businessName || obj.name || null;
                }
                if (obj.contactPoint) schemaDetails.hasContactPoint = true;
                if (obj.geo || obj.latitude || obj.longitude) schemaDetails.hasGeoCoordinates = true;
                if (obj.openingHours || obj.openingHoursSpecification) schemaDetails.hasOpeningHours = true;
                
                // Check @graph array
                if (obj['@graph']) {
                  obj['@graph'].forEach(item => checkSchema(item));
                }
              };
              checkSchema(data);
            } catch (e) {
              // Invalid JSON
            }
          });
          
          // Check for local keywords in title/h1
          const localKeywords = ['near me', 'in ', 'local', 'nearby', 'area', 'serving', 'located'];
          const title = document.title.toLowerCase();
          const h1 = document.querySelector('h1')?.textContent?.toLowerCase() || '';
          const hasLocalKeywords = localKeywords.some(kw => title.includes(kw) || h1.includes(kw));
          
          // Map embed detection
          const hasGoogleMap = html.includes('maps.google.com') || html.includes('google.com/maps') || html.includes('maps.googleapis.com');
          const hasMapEmbed = document.querySelector('iframe[src*="google.com/maps"], iframe[src*="maps.google"], .google-map, #map, [class*="map-container"]') !== null;
          
          // Social profiles detection
          const socialPlatforms = ['facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'linkedin.com', 'youtube.com', 'yelp.com', 'tiktok.com'];
          const socialLinks = [];
          document.querySelectorAll('a[href]').forEach(a => {
            const href = a.href.toLowerCase();
            socialPlatforms.forEach(platform => {
              if (href.includes(platform) && !socialLinks.includes(platform)) {
                socialLinks.push(platform.replace('.com', ''));
              }
            });
          });
          
          // Hours of operation - look for common patterns
          const hoursPatterns = ['hours', 'open', 'closed', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'am', 'pm', '24/7'];
          const hasHoursInfo = hoursPatterns.filter(p => text.toLowerCase().includes(p)).length >= 3;
          
          // Contact page detection
          const hasContactPage = document.querySelector('a[href*="contact"], a[href*="Contact"]') !== null;
          
          // Reviews/testimonials detection
          const reviewKeywords = ['review', 'testimonial', 'rating', 'stars', 'customer feedback'];
          const hasReviews = reviewKeywords.some(kw => text.toLowerCase().includes(kw));
          
          return {
            nap: {
              phoneCount: validPhones.length,
              phones: validPhones.slice(0, 5),
              hasAddress,
              zipCodes,
              emails
            },
            schema: schemaDetails,
            keywords: {
              hasLocalKeywords
            },
            localPresence: {
              hasGoogleMap: hasGoogleMap || hasMapEmbed,
              socialProfiles: socialLinks,
              hasHoursInfo,
              hasContactPage,
              hasReviews
            }
          };
        });
        
        await page.close();
        return analysis;
      });
      
      // Calculate component scores
      const scores = this.calculateComponentScores(results);
      const overallScore = this.calculateOverallScore(scores);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        analysis: results,
        scores,
        overallScore,
        grade: this.getGrade(overallScore),
        recommendations: this.generateRecommendations(results),
        quickWins: this.generateQuickWins(results),
        analysisTime: formatDuration(Date.now() - startTime, 2)
      };
      
    } catch (error) {
      logger.error('Local SEO analysis failed:', error);
      throw new Error(`Local SEO analysis failed: ${error.message}`);
    }
  }

  calculateComponentScores(analysis) {
    // NAP Score (0-100)
    let napScore = 0;
    if (analysis.nap.phoneCount > 0) napScore += 40;
    if (analysis.nap.hasAddress) napScore += 30;
    if (analysis.nap.emails.length > 0) napScore += 15;
    if (analysis.nap.zipCodes.length > 0) napScore += 15;
    
    // Schema Score (0-100)
    let schemaScore = 0;
    if (analysis.schema.hasLocalBusinessSchema) schemaScore += 40;
    else if (analysis.schema.hasOrganizationSchema) schemaScore += 20;
    if (analysis.schema.hasContactPoint) schemaScore += 15;
    if (analysis.schema.hasGeoCoordinates) schemaScore += 25;
    if (analysis.schema.hasOpeningHours) schemaScore += 20;
    
    // Local Presence Score (0-100)
    let presenceScore = 0;
    if (analysis.localPresence.hasGoogleMap) presenceScore += 25;
    if (analysis.localPresence.socialProfiles.length > 0) {
      presenceScore += Math.min(25, analysis.localPresence.socialProfiles.length * 8);
    }
    if (analysis.localPresence.hasHoursInfo) presenceScore += 20;
    if (analysis.localPresence.hasContactPage) presenceScore += 15;
    if (analysis.localPresence.hasReviews) presenceScore += 15;
    
    return {
      nap: Math.min(100, napScore),
      schema: Math.min(100, schemaScore),
      presence: Math.min(100, presenceScore)
    };
  }

  calculateOverallScore(scores) {
    // Weighted average
    return roundTo((scores.nap * 0.35) + (scores.schema * 0.35) + (scores.presence * 0.30), 0);
  }

  generateQuickWins(analysis) {
    const wins = [];
    
    if (!analysis.localPresence.hasGoogleMap) {
      wins.push({
        icon: '🗺️',
        title: 'Add Google Maps Embed',
        impact: '+10% local visibility',
        timeEstimate: '10 minutes',
        difficulty: 'Easy',
        steps: [
          'Go to Google Maps and search your business address',
          'Click "Share" → "Embed a map"',
          'Copy the iframe code and paste into your contact page'
        ]
      });
    }
    
    if (!analysis.schema.hasLocalBusinessSchema) {
      wins.push({
        icon: '📋',
        title: 'Add LocalBusiness Schema',
        impact: '+15% search visibility',
        timeEstimate: '15 minutes',
        difficulty: 'Medium',
        steps: [
          'Use Google\'s Structured Data Markup Helper',
          'Select "Local Business" and enter your details',
          'Add the generated JSON-LD to your homepage'
        ]
      });
    }
    
    if (analysis.nap.phoneCount === 0) {
      wins.push({
        icon: '📞',
        title: 'Display Phone Number',
        impact: '+20% customer inquiries',
        timeEstimate: '5 minutes',
        difficulty: 'Easy',
        steps: [
          'Add phone number to your header or footer',
          'Use tel: link for click-to-call on mobile',
          'Format consistently across all pages'
        ]
      });
    }
    
    if (analysis.localPresence.socialProfiles.length < 2) {
      wins.push({
        icon: '📱',
        title: 'Add Social Profile Links',
        impact: '+10% trust signals',
        timeEstimate: '10 minutes',
        difficulty: 'Easy',
        steps: [
          'Add links to your Google Business Profile',
          'Include Facebook, Instagram, or LinkedIn',
          'Place icons in footer for visibility'
        ]
      });
    }
    
    return wins.slice(0, 3);
  }

  generateRecommendations(analysis) {
    const recs = [];
    
    // NAP recommendations
    if (analysis.nap.phoneCount === 0) {
      recs.push({
        priority: 'critical',
        category: 'nap',
        message: 'Add phone number',
        detail: 'Display your business phone number prominently. Use click-to-call links for mobile users.'
      });
    }
    
    if (!analysis.nap.hasAddress) {
      recs.push({
        priority: 'critical',
        category: 'nap',
        message: 'Add business address',
        detail: 'Include your full business address with street, city, state, and ZIP code.'
      });
    }
    
    if (analysis.nap.emails.length === 0) {
      recs.push({
        priority: 'medium',
        category: 'nap',
        message: 'Add contact email',
        detail: 'Display a business email address for customer inquiries.'
      });
    }
    
    // Schema recommendations
    if (!analysis.schema.hasLocalBusinessSchema) {
      recs.push({
        priority: 'high',
        category: 'schema',
        message: 'Add LocalBusiness schema',
        detail: 'Implement LocalBusiness structured data to help Google understand your business type and location.'
      });
    }
    
    if (!analysis.schema.hasGeoCoordinates && analysis.schema.hasLocalBusinessSchema) {
      recs.push({
        priority: 'medium',
        category: 'schema',
        message: 'Add geo coordinates to schema',
        detail: 'Include latitude and longitude in your LocalBusiness schema for precise location mapping.'
      });
    }
    
    if (!analysis.schema.hasOpeningHours) {
      recs.push({
        priority: 'medium',
        category: 'schema',
        message: 'Add opening hours to schema',
        detail: 'Include openingHoursSpecification in your schema to display hours in search results.'
      });
    }
    
    // Local presence recommendations
    if (!analysis.localPresence.hasGoogleMap) {
      recs.push({
        priority: 'high',
        category: 'presence',
        message: 'Embed Google Maps',
        detail: 'Add an interactive Google Maps embed to help customers find your location easily.'
      });
    }
    
    if (analysis.localPresence.socialProfiles.length === 0) {
      recs.push({
        priority: 'medium',
        category: 'presence',
        message: 'Add social media links',
        detail: 'Link to your business profiles on Facebook, Instagram, LinkedIn, or Yelp.'
      });
    }
    
    if (!analysis.localPresence.hasReviews) {
      recs.push({
        priority: 'medium',
        category: 'presence',
        message: 'Display customer reviews',
        detail: 'Add testimonials or review badges to build trust with local customers.'
      });
    }
    
    return recs;
  }

  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    return 'D';
  }
}

module.exports = new LocalSEOService();
