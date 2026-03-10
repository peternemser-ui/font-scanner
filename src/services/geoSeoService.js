/**
 * GEO SEO Analyzer
 * Checks NAP consistency, local schema, citations, multi-location, reviews & reputation
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatDuration } = require('../utils/formatHelpers');
const { setDeviceProfile } = require('../utils/browserHelpers');

const logger = createLogger('GeoSeoService');

class GeoSeoService {
  async analyzeGeoSeo(url) {
    logger.info(`Starting GEO SEO analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        await setDeviceProfile(page, 'desktop');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

        const analysis = await page.evaluate(() => {
          const text = document.body.textContent;
          const html = document.body.innerHTML;

          // NAP (Name, Address, Phone) detection - More strict phone regex
          const phonePatterns = [
            /\(\d{3}\)\s*\d{3}[-.\s]\d{4}/g,
            /\(\d{3}\)\s*\d{3}\d{4}/g,
            /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g,
            /\+1\s*\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
            /1[-.\s]\d{3}[-.\s]\d{3}[-.\s]\d{4}/g
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
          const allPhones = [];
          phonePatterns.forEach(pattern => {
            const matches = visibleText.match(pattern) || [];
            allPhones.push(...matches);
          });

          // Clean and dedupe phones
          const phones = [...new Set(allPhones.map(p => p.replace(/\D/g, '').slice(-10)))];

          // Filter out obvious non-phone numbers
          const validPhones = phones.filter(p => {
            if (p.length !== 10) return false;
            if (/^(.)\1+$/.test(p)) return false;
            if (p === '1234567890' || p === '0987654321') return false;
            if (p[0] === '0' || p[0] === '1') return false;
            return true;
          });

          // Email detection
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const emails = [...new Set(visibleText.match(emailRegex) || [])].slice(0, 3);

          // Address detection
          const addressKeywords = ['street', 'st.', 'avenue', 'ave.', 'road', 'rd.', 'boulevard', 'blvd.', 'suite', 'ste.', 'floor', 'city', 'state', 'zip', 'drive', 'dr.', 'lane', 'ln.', 'way', 'court', 'ct.', 'place', 'pl.'];
          const hasAddress = addressKeywords.some(kw => visibleText.toLowerCase().includes(kw));

          // ZIP code detection
          const zipRegex = /\b\d{5}(-\d{4})?\b/g;
          const zipCodes = [...new Set(visibleText.match(zipRegex) || [])].slice(0, 3);

          // Local schema detection - enhanced
          const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          const schemaDetails = {
            hasLocalBusinessSchema: false,
            hasOrganizationSchema: false,
            hasContactPoint: false,
            hasGeoCoordinates: false,
            hasOpeningHours: false,
            businessName: null,
            businessType: null
          };

          // Reviews & reputation schema tracking
          let aggregateRatingData = null;
          let hasReviewSchema = false;
          let localBusinessCount = 0;
          let hasServiceAreaSchema = false;

          schemas.forEach(s => {
            try {
              const data = JSON.parse(s.textContent);
              const checkSchema = (obj) => {
                if (!obj) return;
                if (obj['@type'] === 'LocalBusiness' || (Array.isArray(obj['@type']) && obj['@type'].includes('LocalBusiness'))) {
                  schemaDetails.hasLocalBusinessSchema = true;
                  schemaDetails.businessName = obj.name || null;
                  schemaDetails.businessType = obj['@type'];
                  localBusinessCount++;
                }
                if (obj['@type'] === 'Organization') {
                  schemaDetails.hasOrganizationSchema = true;
                  schemaDetails.businessName = schemaDetails.businessName || obj.name || null;
                }
                if (obj.contactPoint) schemaDetails.hasContactPoint = true;
                if (obj.geo || obj.latitude || obj.longitude) schemaDetails.hasGeoCoordinates = true;
                if (obj.openingHours || obj.openingHoursSpecification) schemaDetails.hasOpeningHours = true;

                // AggregateRating detection
                if (obj.aggregateRating) {
                  aggregateRatingData = {
                    ratingValue: obj.aggregateRating.ratingValue || null,
                    reviewCount: obj.aggregateRating.reviewCount || null,
                    bestRating: obj.aggregateRating.bestRating || '5'
                  };
                }
                // Review schema detection
                if (obj['@type'] === 'Review' || (obj.review && Array.isArray(obj.review))) {
                  hasReviewSchema = true;
                }
                // ServiceArea schema detection
                if (obj.areaServed || obj.serviceArea) {
                  hasServiceAreaSchema = true;
                }

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

          // Hours of operation
          const hoursPatterns = ['hours', 'open', 'closed', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'am', 'pm', '24/7'];
          const hasHoursInfo = hoursPatterns.filter(p => text.toLowerCase().includes(p)).length >= 3;

          // Contact page detection
          const hasContactPage = document.querySelector('a[href*="contact"], a[href*="Contact"]') !== null;

          // Reviews/testimonials detection (basic)
          const reviewKeywords = ['review', 'testimonial', 'rating', 'stars', 'customer feedback'];
          const hasReviews = reviewKeywords.some(kw => text.toLowerCase().includes(kw));

          // ================================================================
          // NEW: Citations & Directories detection
          // ================================================================
          const directoryDomains = [
            'yelp.com', 'yellowpages.com', 'bbb.org', 'tripadvisor.com',
            'maps.google.com', 'google.com/maps', 'maps.apple.com',
            'bing.com/maps', 'foursquare.com', 'manta.com',
            'chamberofcommerce.com', 'hotfrog.com', 'superpages.com',
            'citysearch.com', 'angieslist.com', 'thumbtack.com',
            'homeadvisor.com', 'nextdoor.com', 'mapquest.com'
          ];
          const directoryLinks = [];
          document.querySelectorAll('a[href]').forEach(a => {
            const href = a.href.toLowerCase();
            directoryDomains.forEach(domain => {
              if (href.includes(domain)) {
                const existing = directoryLinks.find(d => d.domain === domain);
                if (!existing) {
                  directoryLinks.push({ domain, url: a.href, text: (a.textContent || '').trim().substring(0, 80) });
                }
              }
            });
          });

          // Citation section detection ("Find us on", directory badges)
          const citationKeywords = ['find us on', 'listed on', 'as seen on', 'featured on', 'our listings', 'directory listings', 'business directories'];
          const hasCitationSection = citationKeywords.some(kw => visibleText.toLowerCase().includes(kw));
          const badgeSelectors = ['[class*="badge"]', '[class*="directory"]', '[class*="listing"]', '[class*="citation"]', '[alt*="yelp"]', '[alt*="bbb"]', '[alt*="tripadvisor"]'];
          const hasDirectoryBadges = badgeSelectors.some(sel => document.querySelector(sel) !== null);

          // ================================================================
          // NEW: Multi-Location & Geo Pages detection
          // ================================================================
          const locationPatterns = ['/locations', '/branches', '/stores', '/offices', '/service-area', '/coverage', '/where-we-serve'];
          const locationLinks = [];
          document.querySelectorAll('a[href]').forEach(a => {
            const href = (a.getAttribute('href') || '').toLowerCase();
            locationPatterns.forEach(pattern => {
              if (href.includes(pattern)) {
                const existing = locationLinks.find(l => l.href === a.href);
                if (!existing) {
                  locationLinks.push({ href: a.href, text: (a.textContent || '').trim().substring(0, 80) });
                }
              }
            });
          });

          const hasStoreLocator = !!(
            document.querySelector('[class*="store-locator"], [class*="storelocator"], [id*="store-locator"], [class*="location-finder"], [class*="find-a-store"], [class*="store-finder"]') ||
            visibleText.toLowerCase().includes('find a store') ||
            visibleText.toLowerCase().includes('store locator') ||
            visibleText.toLowerCase().includes('find a location') ||
            visibleText.toLowerCase().includes('location finder')
          );

          // Geographic content targeting
          const geoContentKeywords = ['service area', 'serving', 'we serve', 'coverage area', 'our locations', 'visit us at', 'find us at'];
          const geoContentCount = geoContentKeywords.filter(kw => visibleText.toLowerCase().includes(kw)).length;

          // hreflang tags
          const hreflangTags = document.querySelectorAll('link[hreflang]');
          const hreflangCount = hreflangTags.length;

          // ================================================================
          // NEW: Reviews & Reputation detection
          // ================================================================
          const hasAggregateRating = aggregateRatingData !== null;

          // Testimonials section detection
          const testimonialSelectors = ['[class*="testimonial"]', '[class*="review"]', '[id*="testimonial"]', '[id*="reviews"]', '[class*="customer-feedback"]', '[class*="client-says"]'];
          const hasTestimonialsSection = testimonialSelectors.some(sel => document.querySelector(sel) !== null);

          // Star rating widgets
          const starSelectors = ['[class*="star-rating"]', '[class*="stars"]', '[class*="rating-stars"]', '[class*="star_rating"]', '.fa-star', '[data-rating]'];
          const hasStarWidgets = starSelectors.some(sel => document.querySelector(sel) !== null);

          // Review count display
          const reviewCountPattern = /(\d+)\s*(reviews?|ratings?|testimonials?)/gi;
          const hasReviewCount = reviewCountPattern.test(visibleText);

          // Review platform links
          const reviewPlatformDomains = ['trustpilot.com', 'g2.com', 'capterra.com', 'glassdoor.com', 'yelp.com', 'google.com/maps', 'bbb.org', 'sitejabber.com', 'consumeraffairs.com'];
          const reviewPlatformLinks = [];
          document.querySelectorAll('a[href]').forEach(a => {
            const href = a.href.toLowerCase();
            reviewPlatformDomains.forEach(domain => {
              if (href.includes(domain) && !reviewPlatformLinks.find(r => r.domain === domain)) {
                reviewPlatformLinks.push({ domain, url: a.href, text: (a.textContent || '').trim().substring(0, 80) });
              }
            });
          });

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
            },
            citations: {
              directoryLinks,
              directoryCount: directoryLinks.length,
              hasCitationSection,
              hasDirectoryBadges
            },
            multiLocation: {
              locationLinks,
              hasServiceAreaSchema,
              hasStoreLocator,
              multipleLocalBusinessEntries: localBusinessCount > 1,
              geoContentCount,
              hreflangCount
            },
            reviews: {
              hasAggregateRating,
              hasReviewSchema,
              aggregateRatingData,
              hasTestimonialsSection,
              hasStarWidgets,
              hasReviewCount,
              reviewPlatformLinks
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
      logger.error('GEO SEO analysis failed:', error);
      throw new Error(`GEO SEO analysis failed: ${error.message}`);
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

    // Citations Score (0-100)
    let citationsScore = 0;
    const citations = analysis.citations || {};
    // Directory count: 0=0, 1-2=15, 3-5=25, 6+=40
    if (citations.directoryCount >= 6) citationsScore += 40;
    else if (citations.directoryCount >= 3) citationsScore += 25;
    else if (citations.directoryCount >= 1) citationsScore += 15;
    if (citations.hasCitationSection) citationsScore += 25;
    if (citations.hasDirectoryBadges) citationsScore += 20;
    // NAP consistency proxy: phone + address present = consistent enough
    if (analysis.nap.phoneCount > 0 && analysis.nap.hasAddress) citationsScore += 15;

    // Multi-Location Score (0-100)
    let multiLocationScore = 0;
    const ml = analysis.multiLocation || {};
    if (ml.locationLinks && ml.locationLinks.length > 0) {
      multiLocationScore += Math.min(30, ml.locationLinks.length * 10);
    }
    if (ml.hasServiceAreaSchema) multiLocationScore += 25;
    if (ml.hasStoreLocator) multiLocationScore += 20;
    if (ml.geoContentCount >= 2) multiLocationScore += 15;
    else if (ml.geoContentCount >= 1) multiLocationScore += 8;
    if (ml.hreflangCount >= 2) multiLocationScore += 10;

    // Reviews Score (0-100)
    let reviewsScore = 0;
    const rev = analysis.reviews || {};
    if (rev.hasAggregateRating) reviewsScore += 30;
    if (rev.hasReviewSchema) reviewsScore += 20;
    if (rev.hasTestimonialsSection) reviewsScore += 15;
    if (rev.hasStarWidgets) reviewsScore += 10;
    if (rev.hasReviewCount) reviewsScore += 10;
    if (rev.reviewPlatformLinks && rev.reviewPlatformLinks.length > 0) {
      reviewsScore += Math.min(15, rev.reviewPlatformLinks.length * 5);
    }

    return {
      nap: Math.min(100, napScore),
      schema: Math.min(100, schemaScore),
      presence: Math.min(100, presenceScore),
      citations: Math.min(100, citationsScore),
      multiLocation: Math.min(100, multiLocationScore),
      reviews: Math.min(100, reviewsScore)
    };
  }

  calculateOverallScore(scores) {
    // Weighted average: NAP 20%, Schema 20%, Presence 15%, Citations 15%, Multi-Location 15%, Reviews 15%
    return roundTo(
      (scores.nap * 0.20) +
      (scores.schema * 0.20) +
      (scores.presence * 0.15) +
      (scores.citations * 0.15) +
      (scores.multiLocation * 0.15) +
      (scores.reviews * 0.15),
      0
    );
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

    if ((analysis.citations?.directoryCount || 0) === 0) {
      wins.push({
        icon: '📂',
        title: 'Get Listed on Directories',
        impact: '+12% local discovery',
        timeEstimate: '30 minutes',
        difficulty: 'Easy',
        steps: [
          'Create or claim your Yelp business profile',
          'Submit to Yellow Pages and BBB',
          'Add your business to Apple Maps and Bing Places'
        ]
      });
    }

    if (!analysis.reviews?.hasAggregateRating && !analysis.reviews?.hasTestimonialsSection) {
      wins.push({
        icon: '⭐',
        title: 'Add Reviews or Testimonials',
        impact: '+15% trust & conversions',
        timeEstimate: '20 minutes',
        difficulty: 'Easy',
        steps: [
          'Add a testimonials section to your homepage',
          'Implement AggregateRating schema markup',
          'Link to your review profiles (Google, Yelp, Trustpilot)'
        ]
      });
    }

    return wins.slice(0, 4);
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

    // Citations recommendations
    if ((analysis.citations?.directoryCount || 0) === 0) {
      recs.push({
        priority: 'high',
        category: 'citations',
        message: 'Build directory citations',
        detail: 'Get listed on major directories like Yelp, Yellow Pages, BBB, and industry-specific directories to boost local authority.'
      });
    } else if ((analysis.citations?.directoryCount || 0) < 5) {
      recs.push({
        priority: 'medium',
        category: 'citations',
        message: 'Expand directory presence',
        detail: 'You have some directory listings but should aim for 10+ quality citations across major platforms.'
      });
    }

    if (!analysis.citations?.hasCitationSection) {
      recs.push({
        priority: 'low',
        category: 'citations',
        message: 'Add directory badges or listing section',
        detail: 'Display "Find us on" badges or a section linking to your directory profiles to reinforce trust signals.'
      });
    }

    // Multi-Location recommendations
    if ((analysis.multiLocation?.locationLinks?.length || 0) === 0 && analysis.schema.hasLocalBusinessSchema) {
      recs.push({
        priority: 'medium',
        category: 'multiLocation',
        message: 'Create location-specific pages',
        detail: 'If you serve multiple locations, create dedicated pages for each with unique content, embedded maps, and local testimonials.'
      });
    }

    if (!analysis.multiLocation?.hasServiceAreaSchema && analysis.schema.hasLocalBusinessSchema) {
      recs.push({
        priority: 'low',
        category: 'multiLocation',
        message: 'Add ServiceArea schema',
        detail: 'Define your service area in schema markup to help search engines understand your geographic coverage.'
      });
    }

    // Reviews recommendations
    if (!analysis.reviews?.hasAggregateRating) {
      recs.push({
        priority: 'high',
        category: 'reviews',
        message: 'Add AggregateRating schema',
        detail: 'Implement AggregateRating structured data to display star ratings in search results, boosting click-through rates.'
      });
    }

    if (!analysis.reviews?.hasTestimonialsSection) {
      recs.push({
        priority: 'medium',
        category: 'reviews',
        message: 'Add testimonials section',
        detail: 'Display customer testimonials on your site to build trust and improve conversions for local visitors.'
      });
    }

    if ((analysis.reviews?.reviewPlatformLinks?.length || 0) === 0) {
      recs.push({
        priority: 'medium',
        category: 'reviews',
        message: 'Link to review platforms',
        detail: 'Add links to your profiles on Trustpilot, Google Reviews, or Yelp to encourage and showcase customer feedback.'
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

module.exports = new GeoSeoService();
