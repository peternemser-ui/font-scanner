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
      const { html, cookies: pageCookies } = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        try {
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const content = await page.content();
          const cookies = await page.cookies();
          return { html: content, cookies };
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
        cookies: this.analyzeCookiesFromPuppeteer(pageCookies),
        consentMode: this.detectConsentMode(html),
        dataLayer: this.analyzeDataLayer(html),
        thirdPartyScripts: this.detectThirdPartyScripts($, url),
        performanceImpact: this.estimatePerformanceImpact($)
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
   * Analyze cookies from Puppeteer's cookie array
   * @param {Array} puppeteerCookies - Array of cookies from page.cookies()
   */
  analyzeCookiesFromPuppeteer(puppeteerCookies) {
    if (!puppeteerCookies || puppeteerCookies.length === 0) {
      return {
        count: 0,
        cookies: [],
        types: {}
      };
    }

    const cookies = puppeteerCookies.map(c => {
      const cookie = {
        name: c.name,
        hasSecure: c.secure || false,
        hasHttpOnly: c.httpOnly || false,
        sameSite: c.sameSite || 'None',
        domain: c.domain
      };

      // Classify cookie
      if (c.name.match(/_ga|_gid|_gat/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Google Analytics';
      } else if (c.name.match(/_fbp|_fbc/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'Meta Pixel';
      } else if (c.name.match(/_gcl_|gclid/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'Google Ads';
      } else if (c.name.match(/hjid|hjSession/)) {
        cookie.type = 'analytics';
        cookie.vendor = 'Hotjar';
      } else if (c.name.match(/li_/)) {
        cookie.type = 'advertising';
        cookie.vendor = 'LinkedIn';
      } else {
        cookie.type = 'unknown';
      }

      return cookie;
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
