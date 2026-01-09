/**
 * Tag Analyzer - Detects analytics, tracking, and marketing tags
 * High-value feature for SaaS differentiation
 */

const cheerio = require('cheerio');
const browserPool = require('../utils/browserPool');

class TagAnalyzer {
  constructor() {
    this.knownTags = this.initializeKnownTags();
  }

  /**
   * Initialize known tag patterns
   */
  initializeKnownTags() {
    return {
      // Google Analytics
      ga4: {
        name: 'Google Analytics 4 (GA4)',
        patterns: [
          /gtag\(['"]config['"],\s*['"]G-[A-Z0-9]+['"]/gi,
          /gtag\.js\?id=G-[A-Z0-9]+/gi,
          /G-[A-Z0-9]{10}/g
        ],
        scriptPatterns: [
          /googletagmanager\.com\/gtag\/js/
        ],
        category: 'analytics'
      },
      gaUniversal: {
        name: 'Google Analytics (Universal)',
        patterns: [
          /UA-\d{4,10}-\d{1,4}/g,
          /analytics\.js/,
          /ga\(['"]create['"]/
        ],
        category: 'analytics'
      },
      gtm: {
        name: 'Google Tag Manager',
        patterns: [
          /GTM-[A-Z0-9]+/g,
          /googletagmanager\.com\/gtm\.js/
        ],
        category: 'tag_manager'
      },

      // Tealium
      tealium: {
        name: 'Tealium iQ',
        patterns: [
          /tealiumiq\.com/,
          /utag\.js/,
          /utag\.sync\.js/,
          /tealiumProfile/i,
          /tealium_data/i,
          /window\.utag/
        ],
        scriptPatterns: [
          /tags\.tiqcdn\.com/,
          /tealiumiq\.com/
        ],
        category: 'tag_manager'
      },

      // Adobe
      adobeLaunch: {
        name: 'Adobe Experience Platform (Launch)',
        patterns: [
          /assets\.adobedtm\.com/,
          /_satellite\./,
          /launch-[a-z0-9]+\.adobedtm\.com/
        ],
        scriptPatterns: [
          /assets\.adobedtm\.com/,
          /adobedtm\.com.*launch/
        ],
        category: 'tag_manager'
      },
      adobeAnalytics: {
        name: 'Adobe Analytics',
        patterns: [
          /s_code\.js/,
          /AppMeasurement\.js/,
          /s\.t\(\)/,
          /s\.tl\(/,
          /omniture/i
        ],
        category: 'analytics'
      },

      // Facebook/Meta
      metaPixel: {
        name: 'Meta Pixel (Facebook Pixel)',
        patterns: [
          /fbq\(['"]init['"],\s*['"](\d+)['"]/gi,
          /connect\.facebook\.net\/.*\/fbevents\.js/
        ],
        category: 'advertising'
      },

      // Other Analytics
      hotjar: {
        name: 'Hotjar',
        patterns: [
          /static\.hotjar\.com/,
          /hjid:\s*(\d+)/
        ],
        category: 'analytics'
      },
      mixpanel: {
        name: 'Mixpanel',
        patterns: [
          /mixpanel\.init\(['"]([\w-]+)['"]/gi,
          /cdn\.mxpnl\.com/
        ],
        category: 'analytics'
      },
      amplitude: {
        name: 'Amplitude',
        patterns: [
          /amplitude\.getInstance\(\)\.init\(['"]([\w-]+)['"]/gi,
          /cdn\.amplitude\.com/
        ],
        category: 'analytics'
      },
      segment: {
        name: 'Segment',
        patterns: [
          /analytics\.load\(['"]([\w-]+)['"]/gi,
          /cdn\.segment\.com/
        ],
        category: 'analytics'
      },

      // Advertising
      googleAds: {
        name: 'Google Ads',
        patterns: [
          /AW-\d{10}/g,
          /googleadservices\.com\/pagead\/conversion/
        ],
        category: 'advertising'
      },
      linkedInInsight: {
        name: 'LinkedIn Insight Tag',
        patterns: [
          /_linkedin_data_partner_ids/,
          /snap\.licdn\.com\/li\.lms-analytics/
        ],
        category: 'advertising'
      },
      twitterPixel: {
        name: 'Twitter Pixel (X Pixel)',
        patterns: [
          /twq\(['"]init['"],\s*['"]([\w-]+)['"]/gi,
          /static\.ads-twitter\.com/
        ],
        category: 'advertising'
      },

      // Consent Management
      oneTrust: {
        name: 'OneTrust',
        patterns: [
          /cdn\.cookielaw\.org/,
          /optanon\.blob\.core\.windows\.net/
        ],
        category: 'consent'
      },
      cookiebot: {
        name: 'Cookiebot',
        patterns: [
          /consent\.cookiebot\.com/,
          /CookieConsent\.js/
        ],
        category: 'consent'
      },

      // Other Tools
      intercom: {
        name: 'Intercom',
        patterns: [
          /window\.Intercom/,
          /widget\.intercom\.io/
        ],
        category: 'customer_support'
      },
      drift: {
        name: 'Drift',
        patterns: [
          /drift\.load\(['"]([\w-]+)['"]/gi,
          /js\.driftt\.com/
        ],
        category: 'customer_support'
      },
      hubspot: {
        name: 'HubSpot',
        patterns: [
          /\/\/js\.hs-scripts\.com\/(\d+)\.js/gi,
          /hbspt\.forms\.create/
        ],
        category: 'marketing'
      },

      // A/B Testing & Experimentation
      optimizely: {
        name: 'Optimizely',
        patterns: [
          /cdn\.optimizely\.com/,
          /optimizely\.push/,
          /window\['optimizely'\]/
        ],
        scriptPatterns: [
          /cdn\.optimizely\.com/
        ],
        category: 'ab_testing'
      },
      vwo: {
        name: 'VWO (Visual Website Optimizer)',
        patterns: [
          /dev\.visualwebsiteoptimizer\.com/,
          /_vwo_code/,
          /vwoCode/
        ],
        scriptPatterns: [
          /dev\.visualwebsiteoptimizer\.com/
        ],
        category: 'ab_testing'
      },
      abTasty: {
        name: 'AB Tasty',
        patterns: [
          /abtasty\.com/,
          /ABTasty/
        ],
        scriptPatterns: [
          /try\.abtasty\.com/
        ],
        category: 'ab_testing'
      },
      googleOptimize: {
        name: 'Google Optimize',
        patterns: [
          /googleoptimize\.com/,
          /OPT-[A-Z0-9]+/
        ],
        scriptPatterns: [
          /googleoptimize\.com\/optimize\.js/
        ],
        category: 'ab_testing'
      },
      launchDarkly: {
        name: 'LaunchDarkly',
        patterns: [
          /launchdarkly\.com/,
          /LDClient/
        ],
        scriptPatterns: [
          /sdk\.launchdarkly\.com/
        ],
        category: 'ab_testing'
      },

      // Session Recording & Heatmaps
      fullstory: {
        name: 'FullStory',
        patterns: [
          /fullstory\.com/,
          /FS\.identify/,
          /window\['_fs_host'\]/
        ],
        scriptPatterns: [
          /fullstory\.com\/s\/fs\.js/
        ],
        category: 'session_recording'
      },
      clarity: {
        name: 'Microsoft Clarity',
        patterns: [
          /clarity\.ms/,
          /window\.clarity/
        ],
        scriptPatterns: [
          /clarity\.ms\/tag/
        ],
        category: 'session_recording'
      },
      luckyOrange: {
        name: 'Lucky Orange',
        patterns: [
          /luckyorange\.com/,
          /w\.luckyorange\.com/
        ],
        scriptPatterns: [
          /d10lpsik1i8c69\.cloudfront\.net/,
          /luckyorange\.com/
        ],
        category: 'session_recording'
      },
      mouseflow: {
        name: 'Mouseflow',
        patterns: [
          /mouseflow\.com/,
          /window\._mfq/
        ],
        scriptPatterns: [
          /cdn\.mouseflow\.com/
        ],
        category: 'session_recording'
      },
      crazyEgg: {
        name: 'Crazy Egg',
        patterns: [
          /crazyegg\.com/,
          /script\.crazyegg\.com/
        ],
        scriptPatterns: [
          /script\.crazyegg\.com/
        ],
        category: 'session_recording'
      },
      logrocket: {
        name: 'LogRocket',
        patterns: [
          /logrocket\.com/,
          /LogRocket\.init/
        ],
        scriptPatterns: [
          /cdn\.logrocket\.com/,
          /cdn\.lr-ingest\.io/
        ],
        category: 'session_recording'
      },
      smartlook: {
        name: 'Smartlook',
        patterns: [
          /smartlook\.com/,
          /window\.smartlook/
        ],
        scriptPatterns: [
          /rec\.smartlook\.com/
        ],
        category: 'session_recording'
      },

      // Error Monitoring
      sentry: {
        name: 'Sentry',
        patterns: [
          /sentry\.io/,
          /Sentry\.init/,
          /browser\.sentry-cdn\.com/
        ],
        scriptPatterns: [
          /browser\.sentry-cdn\.com/
        ],
        category: 'error_monitoring'
      },
      bugsnag: {
        name: 'Bugsnag',
        patterns: [
          /bugsnag\.com/,
          /Bugsnag\.start/
        ],
        scriptPatterns: [
          /d2wy8f7a9ursnm\.cloudfront\.net/
        ],
        category: 'error_monitoring'
      },
      rollbar: {
        name: 'Rollbar',
        patterns: [
          /rollbar\.com/,
          /Rollbar\.init/
        ],
        scriptPatterns: [
          /cdnjs\.cloudflare\.com.*rollbar/
        ],
        category: 'error_monitoring'
      },

      // Customer Data Platforms
      segmentCDP: {
        name: 'Segment',
        patterns: [
          /cdn\.segment\.com/,
          /analytics\.load/,
          /analytics\.track/
        ],
        scriptPatterns: [
          /cdn\.segment\.com\/analytics\.js/
        ],
        category: 'cdp'
      },
      mparticle: {
        name: 'mParticle',
        patterns: [
          /mparticle\.com/,
          /mParticle\.init/
        ],
        scriptPatterns: [
          /jssdkcdns\.mparticle\.com/
        ],
        category: 'cdp'
      },

      // Additional Advertising
      pinterestTag: {
        name: 'Pinterest Tag',
        patterns: [
          /pintrk\(['"]load['"]/,
          /s\.pinimg\.com\/ct\/core\.js/
        ],
        scriptPatterns: [
          /s\.pinimg\.com.*ct/
        ],
        category: 'advertising'
      },
      snapchatPixel: {
        name: 'Snapchat Pixel',
        patterns: [
          /snaptr\(['"]init['"]/,
          /sc-static\.net\/scevent\.min\.js/
        ],
        scriptPatterns: [
          /sc-static\.net.*scevent/
        ],
        category: 'advertising'
      },
      tiktokPixel: {
        name: 'TikTok Pixel',
        patterns: [
          /ttq\.load/,
          /analytics\.tiktok\.com/
        ],
        scriptPatterns: [
          /analytics\.tiktok\.com/
        ],
        category: 'advertising'
      },
      criteo: {
        name: 'Criteo',
        patterns: [
          /criteo\.com/,
          /window\.criteo_q/
        ],
        scriptPatterns: [
          /static\.criteo\.net/
        ],
        category: 'advertising'
      },
      taboola: {
        name: 'Taboola',
        patterns: [
          /taboola\.com/,
          /_tfa\.push/
        ],
        scriptPatterns: [
          /cdn\.taboola\.com/
        ],
        category: 'advertising'
      },
      outbrain: {
        name: 'Outbrain',
        patterns: [
          /outbrain\.com/,
          /obApi/
        ],
        scriptPatterns: [
          /widgets\.outbrain\.com/
        ],
        category: 'advertising'
      }
    };
  }

  /**
   * Analyze tags on a webpage
   */
  async analyzeTags(url) {
    try {
      console.log(`🏷️ Analyzing tags for: ${url}`);

      // Use browser pool for better bot protection bypass
      const { html, cookies: pageCookies, resourceTimings, navigationTiming } = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        try {
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          
          // Wait a bit for scripts to load
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const content = await page.content();
          const cookies = await page.cookies();
          
          // Capture resource timings for waterfall
          const timings = await page.evaluate(() => {
            const resources = performance.getEntriesByType('resource');
            return resources
              .filter(r => r.initiatorType === 'script')
              .map(r => ({
                name: r.name,
                startTime: Math.round(r.startTime),
                duration: Math.round(r.duration),
                transferSize: r.transferSize || 0,
                responseEnd: Math.round(r.responseEnd),
                initiatorType: r.initiatorType
              }))
              .sort((a, b) => a.startTime - b.startTime)
              .slice(0, 50); // Top 50 scripts
          });
          
          // Get navigation timing
          const navTiming = await page.evaluate(() => {
            const timing = performance.getEntriesByType('navigation')[0];
            if (!timing) return null;
            return {
              domContentLoaded: Math.round(timing.domContentLoadedEventEnd),
              loadComplete: Math.round(timing.loadEventEnd),
              firstPaint: Math.round(timing.responseStart)
            };
          });
          
          return { html: content, cookies, resourceTimings: timings, navigationTiming: navTiming };
        } finally {
          await page.close();
        }
      });

      const $ = cheerio.load(html);

      const results = {
        url,
        analyzedAt: new Date().toISOString(),
        tags: [],
        duplicates: [],
        issues: [],
        summary: {
          totalTags: 0,
          byCategory: {}
        },
        cookies: this.analyzeCookiesEnhanced(pageCookies),
        consentMode: this.detectConsentMode(html),
        dataLayer: this.analyzeDataLayer(html),
        thirdPartyScripts: this.detectThirdPartyScripts($, url),
        performanceImpact: this.estimatePerformanceImpact($),
        tagLoadWaterfall: this.buildTagWaterfall(resourceTimings, navigationTiming)
      };

      // Detect all tags
      for (const [key, tagDef] of Object.entries(this.knownTags)) {
        const detected = this.detectTag(html, $, tagDef, url);
        if (detected) {
          results.tags.push(detected);
        }
      }

      // Calculate summary
      results.summary.totalTags = results.tags.length;
      results.tags.forEach(tag => {
        const category = tag.category || 'other';
        results.summary.byCategory[category] = (results.summary.byCategory[category] || 0) + 1;
      });

      // Detect duplicates
      results.duplicates = this.findDuplicates(results.tags);

      // Detect issues
      results.issues = this.findIssues(results.tags, html);

      // Calculate health score
      results.healthScore = this.calculateHealthScore(results);

      console.log(`✅ Found ${results.tags.length} tags on ${url}`);

      return results;

    } catch (error) {
      console.error(`Error analyzing tags for ${url}:`, error.message);
      return {
        url,
        error: error.message,
        tags: [],
        healthScore: 0
      };
    }
  }

  /**
   * Detect a specific tag in HTML
   */
  detectTag(html, $, tagDef, url) {
    const matches = [];
    let foundInline = false;
    let foundScript = false;

    // Check inline patterns
    tagDef.patterns.forEach(pattern => {
      const matched = html.match(pattern);
      if (matched) {
        matches.push(...matched);
        foundInline = true;
      }
    });

    // Check script src patterns
    if (tagDef.scriptPatterns) {
      $('script[src]').each((i, elem) => {
        const src = $(elem).attr('src');
        tagDef.scriptPatterns.forEach(pattern => {
          if (pattern.test(src)) {
            matches.push(src);
            foundScript = true;
          }
        });
      });
    }

    if (matches.length === 0) {
      return null;
    }

    // Extract IDs/codes
    const ids = this.extractIds(matches, tagDef);

    return {
      name: tagDef.name,
      category: tagDef.category,
      foundInline,
      foundScript,
      ids: [...new Set(ids)], // Unique IDs
      instances: matches.length,
      rawMatches: matches.slice(0, 5) // First 5 matches
    };
  }

  /**
   * Extract IDs from tag matches
   */
  extractIds(matches, tagDef) {
    const ids = [];

    matches.forEach(match => {
      // GA4: G-XXXXXXXXXX
      if (tagDef.name.includes('GA4')) {
        const ga4Match = match.match(/G-[A-Z0-9]{10}/);
        if (ga4Match) ids.push(ga4Match[0]);
      }

      // Universal Analytics: UA-XXXXX-X
      if (tagDef.name.includes('Universal')) {
        const uaMatch = match.match(/UA-\d{4,10}-\d{1,4}/);
        if (uaMatch) ids.push(uaMatch[0]);
      }

      // GTM: GTM-XXXXXXX
      if (tagDef.name.includes('Tag Manager')) {
        const gtmMatch = match.match(/GTM-[A-Z0-9]+/);
        if (gtmMatch) ids.push(gtmMatch[0]);
      }

      // Meta Pixel: numeric ID
      if (tagDef.name.includes('Meta Pixel')) {
        const pixelMatch = match.match(/['"](\d{15,16})['"]/);
        if (pixelMatch) ids.push(pixelMatch[1]);
      }

      // Google Ads: AW-XXXXXXXXXX
      if (tagDef.name.includes('Google Ads')) {
        const adsMatch = match.match(/AW-\d{10}/);
        if (adsMatch) ids.push(adsMatch[0]);
      }
    });

    return ids;
  }

  /**
   * Find duplicate tags
   */
  findDuplicates(tags) {
    const duplicates = [];
    const tagCounts = {};

    tags.forEach(tag => {
      const key = tag.name;
      tagCounts[key] = (tagCounts[key] || 0) + 1;
    });

    Object.entries(tagCounts).forEach(([name, count]) => {
      if (count > 1) {
        const tag = tags.find(t => t.name === name);
        duplicates.push({
          tag: name,
          count,
          category: tag?.category,
          severity: 'warning',
          message: `${name} loaded ${count} times (may cause double-tracking)`
        });
      }
    });

    return duplicates;
  }

  /**
   * Find tag implementation issues
   */
  findIssues(tags, html) {
    const issues = [];

    // Check for GA4 + Universal Analytics together
    const hasGA4 = tags.some(t => t.name.includes('GA4'));
    const hasUA = tags.some(t => t.name.includes('Universal'));
    if (hasGA4 && hasUA) {
      issues.push({
        type: 'migration',
        severity: 'info',
        message: 'Both GA4 and Universal Analytics detected. Universal Analytics is deprecated (July 2023).',
        recommendation: 'Complete migration to GA4'
      });
    }

    // Check for GTM without other tags
    const hasGTM = tags.some(t => t.name.includes('Tag Manager'));
    const hasHardcodedGA = tags.some(t =>
      (t.name.includes('GA4') || t.name.includes('Universal')) &&
      t.foundInline
    );

    if (hasGTM && hasHardcodedGA) {
      issues.push({
        type: 'conflict',
        severity: 'warning',
        message: 'Google Analytics loaded both via GTM and hardcoded. This may cause duplicate tracking.',
        recommendation: 'Use GTM exclusively for GA or remove hardcoded implementation'
      });
    }

    // Check for consent management
    const hasConsentTool = tags.some(t => t.category === 'consent');
    const hasAdvertising = tags.some(t => t.category === 'advertising');

    if (hasAdvertising && !hasConsentTool) {
      issues.push({
        type: 'compliance',
        severity: 'high',
        message: 'Advertising tags detected without consent management solution',
        recommendation: 'Implement consent management (OneTrust, Cookiebot, etc.) to comply with GDPR/CCPA'
      });
    }

    return issues;
  }

  /**
   * Analyze cookies from Puppeteer's cookie array - ENHANCED
   * @param {Array} puppeteerCookies - Array of cookies from page.cookies()
   */
  analyzeCookiesEnhanced(puppeteerCookies) {
    if (!puppeteerCookies || puppeteerCookies.length === 0) {
      return {
        count: 0,
        cookies: [],
        types: {},
        complianceScore: 100,
        issues: []
      };
    }

    const issues = [];
    const cookies = puppeteerCookies.map(c => {
      const cookie = {
        name: c.name,
        hasSecure: c.secure || false,
        hasHttpOnly: c.httpOnly || false,
        sameSite: c.sameSite || 'None',
        domain: c.domain,
        path: c.path || '/',
        expires: c.expires ? new Date(c.expires * 1000).toISOString() : 'Session',
        size: c.size || (c.name.length + (c.value ? c.value.length : 0)),
        firstParty: true // Will be updated below
      };

      // Classify cookie by vendor
      if (c.name.match(/_ga|_gid|_gat|__utm/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Google Analytics';
        cookie.purpose = 'Tracks user sessions and behavior';
        cookie.retention = c.name === '_ga' ? '2 years' : '24 hours';
      } else if (c.name.match(/_fbp|_fbc/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'Meta (Facebook)';
        cookie.purpose = 'Tracks conversions and ad targeting';
        cookie.retention = '90 days';
      } else if (c.name.match(/_gcl_|gclid|_gac/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'Google Ads';
        cookie.purpose = 'Tracks ad clicks and conversions';
        cookie.retention = '90 days';
      } else if (c.name.match(/hjid|hjSession|_hj/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Hotjar';
        cookie.purpose = 'Session recording and heatmaps';
        cookie.retention = '1 year';
      } else if (c.name.match(/li_|lidc|bcookie|bscookie/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'LinkedIn';
        cookie.purpose = 'Ad targeting and analytics';
        cookie.retention = '1 year';
      } else if (c.name.match(/ttclid|_ttp|_tt_/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'TikTok';
        cookie.purpose = 'Conversion tracking';
        cookie.retention = '13 months';
      } else if (c.name.match(/OptanonConsent|OptanonAlertBoxClosed/)) {
        cookie.type = 'necessary';
        cookie.vendor = 'OneTrust';
        cookie.purpose = 'Stores consent preferences';
        cookie.retention = '1 year';
      } else if (c.name.match(/CookieConsent/)) {
        cookie.type = 'necessary';
        cookie.vendor = 'Cookiebot';
        cookie.purpose = 'Stores consent preferences';
        cookie.retention = '1 year';
      } else if (c.name.match(/_clck|_clsk|CLID/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Microsoft Clarity';
        cookie.purpose = 'Session recording';
        cookie.retention = '1 year';
      } else if (c.name.match(/_fs_/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'FullStory';
        cookie.purpose = 'Session recording';
        cookie.retention = '1 year';
      } else if (c.name.match(/intercom-/)) {
        cookie.type = 'functional';
        cookie.vendor = 'Intercom';
        cookie.purpose = 'Customer support chat';
        cookie.retention = '9 months';
      } else if (c.name.match(/_pk_|_paq/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Matomo';
        cookie.purpose = 'Website analytics';
        cookie.retention = '13 months';
      } else if (c.name.match(/hubspotutk|__hs/)) {
        cookie.type = 'marketing';
        cookie.vendor = 'HubSpot';
        cookie.purpose = 'Marketing automation';
        cookie.retention = '13 months';
      } else if (c.name.match(/ajs_/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Segment';
        cookie.purpose = 'Customer data platform';
        cookie.retention = '1 year';
      } else if (c.name.match(/vwo_|_vwo_/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'VWO';
        cookie.purpose = 'A/B testing';
        cookie.retention = '100 days';
      } else if (c.name.match(/optimizelyEndUserId/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Optimizely';
        cookie.purpose = 'A/B testing';
        cookie.retention = '6 months';
      } else {
        cookie.type = 'unknown';
        cookie.purpose = 'Unknown purpose';
      }

      return cookie;
    });

    // Check for compliance issues
    const advertisingCookies = cookies.filter(c => c.type === 'advertising');
    const consentCookies = cookies.filter(c => c.vendor === 'OneTrust' || c.vendor === 'Cookiebot');
    
    if (advertisingCookies.length > 0 && consentCookies.length === 0) {
      issues.push({
        severity: 'high',
        message: `${advertisingCookies.length} advertising cookie(s) set without detected consent`,
        recommendation: 'Implement consent management before setting advertising cookies'
      });
    }

    // Check for insecure cookies
    const insecureCookies = cookies.filter(c => !c.hasSecure && c.type !== 'necessary');
    if (insecureCookies.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${insecureCookies.length} cookie(s) without Secure flag`,
        recommendation: 'Add Secure flag to cookies to prevent transmission over HTTP'
      });
    }

    // Check for SameSite None without Secure
    const sameSiteIssues = cookies.filter(c => c.sameSite === 'None' && !c.hasSecure);
    if (sameSiteIssues.length > 0) {
      issues.push({
        severity: 'warning',
        message: `${sameSiteIssues.length} cookie(s) with SameSite=None but no Secure flag`,
        recommendation: 'Cookies with SameSite=None require the Secure attribute'
      });
    }

    // Calculate compliance score
    let complianceScore = 100;
    complianceScore -= issues.filter(i => i.severity === 'high').length * 20;
    complianceScore -= issues.filter(i => i.severity === 'warning').length * 5;
    complianceScore = Math.max(0, Math.min(100, complianceScore));

    const types = cookies.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});

    const byVendor = cookies.reduce((acc, c) => {
      if (c.vendor) {
        acc[c.vendor] = (acc[c.vendor] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      count: cookies.length,
      cookies,
      types,
      byVendor,
      complianceScore,
      issues,
      summary: {
        necessary: types.necessary || 0,
        analytics: types.analytics || 0,
        advertising: types.advertising || 0,
        functional: types.functional || 0,
        marketing: types.marketing || 0,
        unknown: types.unknown || 0
      }
    };
  }

  /**
   * Build tag load waterfall from resource timings
   */
  buildTagWaterfall(resourceTimings, navigationTiming) {
    if (!resourceTimings || resourceTimings.length === 0) {
      return {
        scripts: [],
        totalScripts: 0,
        totalLoadTime: 0,
        timeline: null
      };
    }

    // Categorize scripts for the waterfall
    const categorizedScripts = resourceTimings.map(r => {
      let category = 'other';
      let vendor = 'Unknown';
      const url = r.name.toLowerCase();

      // Categorize by URL pattern
      if (url.includes('google')) {
        if (url.includes('analytics') || url.includes('gtag') || url.includes('gtm')) {
          category = 'analytics';
          vendor = url.includes('gtm') ? 'Google Tag Manager' : 'Google Analytics';
        } else if (url.includes('ads') || url.includes('doubleclick')) {
          category = 'advertising';
          vendor = 'Google Ads';
        }
      } else if (url.includes('facebook') || url.includes('fbcdn') || url.includes('connect.facebook')) {
        category = 'advertising';
        vendor = 'Meta (Facebook)';
      } else if (url.includes('hotjar')) {
        category = 'session_recording';
        vendor = 'Hotjar';
      } else if (url.includes('clarity.ms')) {
        category = 'session_recording';
        vendor = 'Microsoft Clarity';
      } else if (url.includes('fullstory')) {
        category = 'session_recording';
        vendor = 'FullStory';
      } else if (url.includes('linkedin')) {
        category = 'advertising';
        vendor = 'LinkedIn';
      } else if (url.includes('tiktok')) {
        category = 'advertising';
        vendor = 'TikTok';
      } else if (url.includes('twitter') || url.includes('ads-twitter')) {
        category = 'advertising';
        vendor = 'Twitter/X';
      } else if (url.includes('optimizely')) {
        category = 'ab_testing';
        vendor = 'Optimizely';
      } else if (url.includes('visualwebsiteoptimizer') || url.includes('vwo')) {
        category = 'ab_testing';
        vendor = 'VWO';
      } else if (url.includes('abtasty')) {
        category = 'ab_testing';
        vendor = 'AB Tasty';
      } else if (url.includes('segment')) {
        category = 'cdp';
        vendor = 'Segment';
      } else if (url.includes('sentry')) {
        category = 'error_monitoring';
        vendor = 'Sentry';
      } else if (url.includes('intercom')) {
        category = 'customer_support';
        vendor = 'Intercom';
      } else if (url.includes('hubspot') || url.includes('hs-scripts')) {
        category = 'marketing';
        vendor = 'HubSpot';
      } else if (url.includes('cookielaw') || url.includes('onetrust')) {
        category = 'consent';
        vendor = 'OneTrust';
      } else if (url.includes('cookiebot')) {
        category = 'consent';
        vendor = 'Cookiebot';
      }

      return {
        url: r.name.length > 80 ? r.name.substring(0, 77) + '...' : r.name,
        fullUrl: r.name,
        startTime: r.startTime,
        duration: r.duration,
        endTime: r.responseEnd,
        size: r.transferSize,
        sizeFormatted: r.transferSize > 1024 ? `${(r.transferSize / 1024).toFixed(1)}KB` : `${r.transferSize}B`,
        category,
        vendor,
        blocking: r.startTime < (navigationTiming?.domContentLoaded || 1000)
      };
    });

    // Calculate totals
    const totalLoadTime = Math.max(...categorizedScripts.map(s => s.endTime), 0);
    const totalSize = categorizedScripts.reduce((sum, s) => sum + s.size, 0);
    const blockingScripts = categorizedScripts.filter(s => s.blocking);

    // Group by category for summary
    const byCategory = categorizedScripts.reduce((acc, s) => {
      if (!acc[s.category]) {
        acc[s.category] = { count: 0, totalSize: 0, totalDuration: 0 };
      }
      acc[s.category].count++;
      acc[s.category].totalSize += s.size;
      acc[s.category].totalDuration += s.duration;
      return acc;
    }, {});

    return {
      scripts: categorizedScripts,
      totalScripts: categorizedScripts.length,
      totalLoadTime: Math.round(totalLoadTime),
      totalSize,
      totalSizeFormatted: totalSize > 1024 * 1024 
        ? `${(totalSize / 1024 / 1024).toFixed(2)}MB` 
        : `${(totalSize / 1024).toFixed(1)}KB`,
      blockingCount: blockingScripts.length,
      byCategory,
      timeline: navigationTiming,
      insights: this.generateWaterfallInsights(categorizedScripts, navigationTiming)
    };
  }

  /**
   * Generate insights from waterfall data
   */
  generateWaterfallInsights(scripts, navigationTiming) {
    const insights = [];
    
    // Check for early-loading tracking scripts
    const earlyTrackers = scripts.filter(s => 
      s.startTime < 100 && 
      (s.category === 'advertising' || s.category === 'session_recording')
    );
    if (earlyTrackers.length > 0) {
      insights.push({
        type: 'warning',
        message: `${earlyTrackers.length} tracking script(s) loading before DOM ready`,
        recommendation: 'Consider deferring non-essential tracking scripts'
      });
    }

    // Check for large scripts
    const largeScripts = scripts.filter(s => s.size > 100000); // >100KB
    if (largeScripts.length > 0) {
      insights.push({
        type: 'warning',
        message: `${largeScripts.length} script(s) over 100KB detected`,
        scripts: largeScripts.map(s => s.vendor).join(', '),
        recommendation: 'Large scripts impact page load time'
      });
    }

    // Check for slow scripts
    const slowScripts = scripts.filter(s => s.duration > 500); // >500ms
    if (slowScripts.length > 0) {
      insights.push({
        type: 'info',
        message: `${slowScripts.length} script(s) taking >500ms to load`,
        recommendation: 'Consider preconnecting to slow third-party domains'
      });
    }

    // A/B testing early load check
    const abScripts = scripts.filter(s => s.category === 'ab_testing');
    if (abScripts.length > 0) {
      const earlyAB = abScripts.filter(s => s.startTime < 50);
      if (earlyAB.length > 0) {
        insights.push({
          type: 'good',
          message: 'A/B testing scripts loading early (good for preventing flicker)'
        });
      } else {
        insights.push({
          type: 'warning',
          message: 'A/B testing scripts loading late may cause page flicker',
          recommendation: 'Load A/B testing scripts as early as possible'
        });
      }
    }

    return insights;
  }

  /**
   * Analyze cookies from Puppeteer's cookie array
   * @param {Array} puppeteerCookies - Array of cookies from page.cookies()
   */
  analyzeCookiesFromPuppeteer(puppeteerCookies) {
    // Redirect to enhanced version
    return this.analyzeCookiesEnhanced(puppeteerCookies);
  }

  /**
   * Analyze cookies from response headers (deprecated - kept for reference)
   */
  async analyzeCookies(headers) {
    const cookies = [];
    const setCookie = headers['set-cookie'];

    if (!setCookie) {
      return {
        count: 0,
        cookies: [],
        types: {}
      };
    }

    const cookieArray = Array.isArray(setCookie) ? setCookie : [setCookie];

    cookieArray.forEach(cookieStr => {
      const parts = cookieStr.split(';');
      const [nameValue] = parts;
      const [name, value] = nameValue.split('=');

      const cookie = {
        name: name.trim(),
        hasSecure: cookieStr.includes('Secure'),
        hasHttpOnly: cookieStr.includes('HttpOnly'),
        sameSite: cookieStr.match(/SameSite=(Strict|Lax|None)/i)?.[1] || 'None'
      };

      // Classify cookie
      if (name.match(/_ga|_gid|_gat/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Google Analytics';
      } else if (name.match(/_fbp|_fbc/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'Meta Pixel';
      } else {
        cookie.type = 'unknown';
      }

      cookies.push(cookie);
    });

    const types = cookies.reduce((acc, c) => {
      acc[c.type] = (acc[c.type] || 0) + 1;
      return acc;
    }, {});

    return {
      count: cookies.length,
      cookies,
      types
    };
  }

  /**
   * Detect Google Consent Mode
   */
  detectConsentMode(html) {
    const hasConsentMode = /gtag\(['"]consent['"]/i.test(html);
    const consentDefaults = html.match(/gtag\(['"]consent['"],\s*['"]default['"],\s*\{([^}]+)\}/i);

    return {
      implemented: hasConsentMode,
      defaults: consentDefaults ? consentDefaults[1] : null,
      recommendation: !hasConsentMode ?
        'Implement Google Consent Mode v2 for better analytics with privacy' :
        'Consent Mode detected'
    };
  }

  /**
   * Analyze dataLayer contents
   */
  analyzeDataLayer(html) {
    const result = {
      found: false,
      events: [],
      variables: [],
      ecommerce: null
    };

    // Check for dataLayer initialization
    const dataLayerMatch = html.match(/dataLayer\s*=\s*\[([^\]]*)\]/s);
    if (dataLayerMatch) {
      result.found = true;
      
      // Extract pushed events
      const pushMatches = html.matchAll(/dataLayer\.push\(\s*(\{[^}]+\})\s*\)/g);
      for (const match of pushMatches) {
        try {
          // Extract event name if present
          const eventMatch = match[1].match(/['"]event['"]\s*:\s*['"]([^'"]+)['"]/);
          if (eventMatch) {
            result.events.push(eventMatch[1]);
          }
        } catch (e) {}
      }

      // Check for ecommerce data
      if (html.includes('ecommerce') && (html.includes('purchase') || html.includes('add_to_cart') || html.includes('view_item'))) {
        result.ecommerce = {
          detected: true,
          type: html.includes('items') ? 'GA4 Ecommerce' : 'Universal Analytics Enhanced Ecommerce'
        };
      }
    }

    // Dedupe events
    result.events = [...new Set(result.events)];
    result.eventCount = result.events.length;

    return result;
  }

  /**
   * Detect third-party scripts
   */
  detectThirdPartyScripts($, baseUrl) {
    const scripts = [];
    const baseHostname = new URL(baseUrl).hostname.replace('www.', '');
    
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      if (!src) return;
      
      try {
        const scriptUrl = new URL(src, baseUrl);
        const scriptHost = scriptUrl.hostname.replace('www.', '');
        
        // Is it third-party?
        if (!scriptHost.includes(baseHostname) && !baseHostname.includes(scriptHost)) {
          // Categorize the script
          let category = 'unknown';
          let name = scriptHost;
          
          if (scriptHost.includes('google')) {
            category = scriptHost.includes('ads') || scriptHost.includes('doubleclick') ? 'advertising' : 'analytics';
            name = 'Google';
          } else if (scriptHost.includes('facebook') || scriptHost.includes('fbcdn')) {
            category = 'advertising';
            name = 'Meta/Facebook';
          } else if (scriptHost.includes('twitter') || scriptHost.includes('twimg')) {
            category = 'advertising';
            name = 'Twitter/X';
          } else if (scriptHost.includes('linkedin')) {
            category = 'advertising';
            name = 'LinkedIn';
          } else if (scriptHost.includes('tiktok')) {
            category = 'advertising';
            name = 'TikTok';
          } else if (scriptHost.includes('hotjar')) {
            category = 'analytics';
            name = 'Hotjar';
          } else if (scriptHost.includes('cloudflare') || scriptHost.includes('cdn')) {
            category = 'cdn';
            name = scriptHost;
          } else if (scriptHost.includes('jquery') || scriptHost.includes('jsdelivr') || scriptHost.includes('unpkg')) {
            category = 'library';
            name = scriptHost;
          }
          
          scripts.push({
            src: src.substring(0, 100), // Truncate long URLs
            host: scriptHost,
            category,
            name,
            async: $(elem).attr('async') !== undefined,
            defer: $(elem).attr('defer') !== undefined
          });
        }
      } catch (e) {}
    });
    
    // Group and count
    const grouped = scripts.reduce((acc, s) => {
      const key = s.host;
      if (!acc[key]) {
        acc[key] = { ...s, count: 0 };
      }
      acc[key].count++;
      return acc;
    }, {});
    
    return {
      total: scripts.length,
      scripts: Object.values(grouped).sort((a, b) => b.count - a.count).slice(0, 20),
      byCategory: scripts.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Estimate performance impact of tags
   */
  estimatePerformanceImpact($) {
    let score = 100;
    const issues = [];
    
    // Count synchronous scripts (blocking)
    let syncScripts = 0;
    let asyncScripts = 0;
    let deferScripts = 0;
    
    $('script[src]').each((i, elem) => {
      const hasAsync = $(elem).attr('async') !== undefined;
      const hasDefer = $(elem).attr('defer') !== undefined;
      
      if (hasAsync) asyncScripts++;
      else if (hasDefer) deferScripts++;
      else syncScripts++;
    });
    
    // Inline scripts
    const inlineScripts = $('script:not([src])').length;
    
    // Head vs body script placement
    const headScripts = $('head script[src]').length;
    const bodyScripts = $('body script[src]').length;
    
    // Scoring
    if (syncScripts > 5) {
      score -= (syncScripts - 5) * 5;
      issues.push({
        type: 'blocking_scripts',
        severity: 'warning',
        message: `${syncScripts} synchronous scripts may block page rendering`
      });
    }
    
    if (headScripts > 10) {
      score -= 10;
      issues.push({
        type: 'head_scripts',
        severity: 'info',
        message: `${headScripts} scripts in <head> - consider moving non-critical scripts to body`
      });
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D',
      stats: {
        syncScripts,
        asyncScripts,
        deferScripts,
        inlineScripts,
        headScripts,
        bodyScripts
      },
      issues,
      recommendation: syncScripts > 3 
        ? 'Consider adding async or defer attributes to non-critical scripts'
        : 'Script loading strategy looks good'
    };
  }

  /**
   * Calculate overall tag health score (0-100)
   */
  calculateHealthScore(results) {
    let score = 100;

    // Deduct for duplicates
    score -= results.duplicates.length * 10;

    // Deduct for high-severity issues
    const highIssues = results.issues.filter(i => i.severity === 'high').length;
    score -= highIssues * 15;

    // Deduct for warning issues
    const warnings = results.issues.filter(i => i.severity === 'warning').length;
    score -= warnings * 5;

    // Bonus for having consent management
    const hasConsent = results.tags.some(t => t.category === 'consent');
    if (hasConsent) score += 5;

    // Bonus for consent mode
    if (results.consentMode?.implemented) score += 5;

    return Math.max(0, Math.min(100, score));
  }
}

module.exports = new TagAnalyzer();
