/**
 * Enhanced Font Analyzer
 * Provider detection, duplicate detection, unused fonts, performance optimization
 * Font delivery metrics, fallback stability analysis
 */

const cheerio = require('cheerio');
const browserPool = require('../utils/browserPool');

class EnhancedFontAnalyzer {
  constructor() {
    this.providers = {
      googleFonts: /fonts\.googleapis\.com|fonts\.gstatic\.com/i,
      adobeFonts: /use\.typekit\.net|typekit\.com/i,
      fontAwesome: /fontawesome\.com|font-awesome/i,
      bunny: /fonts\.bunny\.net/i,
      cdnFonts: /cdn\.fonts\.net/i
    };

    // Font file extensions for network detection
    this.fontExtensions = /\.(woff2?|ttf|otf|eot|svg)(\?|$)/i;
  }

  /**
   * Analyze fonts on a webpage with enhanced features
   */
  async analyzeFont(url) {
    // Store regex in local variable to ensure it's accessible in callbacks
    const fontExtensionsRegex = this.fontExtensions;

    try {
      // Use browser pool for better bot protection bypass
      const { html, stylesheets, computedFonts, fontRequests, preconnects } = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();

        // Track font network requests
        const fontNetworkRequests = [];
        const requestStartTimes = new Map();
        const pendingResponses = [];

        // Helper to check if URL is a font resource
        const isFontResource = (resourceUrl) => {
          return fontExtensionsRegex.test(resourceUrl) ||
                 resourceUrl.includes('fonts.gstatic.com') ||
                 resourceUrl.includes('fonts.googleapis.com') ||
                 resourceUrl.includes('use.typekit.net') ||
                 resourceUrl.includes('fonts.bunny.net') ||
                 resourceUrl.includes('kit.fontawesome.com');
        };

        // Enable request interception for font tracking
        await page.setRequestInterception(true);

        page.on('request', (request) => {
          const resourceUrl = request.url();
          if (isFontResource(resourceUrl)) {
            requestStartTimes.set(resourceUrl, Date.now());
          }
          request.continue();
        });

        page.on('response', (response) => {
          const resourceUrl = response.url();
          // Only track actual font files, not CSS files
          if (fontExtensionsRegex.test(resourceUrl) ||
              (resourceUrl.includes('fonts.gstatic.com') && !resourceUrl.endsWith('.css'))) {
            const responsePromise = (async () => {
              try {
                const headers = response.headers();
                const startTime = requestStartTimes.get(resourceUrl) || Date.now();
                const loadTime = Date.now() - startTime;

                // Determine font format from URL
                let format = 'unknown';
                if (resourceUrl.includes('.woff2')) format = 'woff2';
                else if (resourceUrl.includes('.woff') && !resourceUrl.includes('.woff2')) format = 'woff';
                else if (resourceUrl.includes('.ttf')) format = 'ttf';
                else if (resourceUrl.includes('.otf')) format = 'otf';
                else if (resourceUrl.includes('.eot')) format = 'eot';
                else if (resourceUrl.includes('.svg')) format = 'svg';

                // Try to get content length
                let size = 0;
                const contentLength = headers['content-length'];
                if (contentLength) {
                  size = parseInt(contentLength, 10);
                } else {
                  try {
                    const buffer = await response.buffer();
                    size = buffer.length;
                  } catch (e) { /* ignore buffer errors */ }
                }

                fontNetworkRequests.push({
                  url: resourceUrl,
                  size,
                  format,
                  loadTime,
                  status: response.status(),
                  cacheControl: headers['cache-control'] || null,
                  cacheStatus: headers['x-cache'] || headers['cf-cache-status'] || (headers['age'] ? 'HIT' : 'MISS'),
                  contentType: headers['content-type'] || null,
                  priority: headers['priority'] || 'auto'
                });
              } catch (e) { /* ignore response errors */ }
            })();
            pendingResponses.push(responsePromise);
          }
        });

        try {
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

          // Try with networkidle2 first, fallback to domcontentloaded if timeout
          try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
          } catch (navError) {
            // Fallback to faster wait condition if networkidle2 times out
            if (navError.message.includes('timeout') || navError.message.includes('Navigation')) {
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
              // Give extra time for fonts to load
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              throw navError;
            }
          }

          // Wait for all pending response handlers to complete
          if (pendingResponses.length > 0) {
            await Promise.all(pendingResponses);
          }

          // Get page HTML
          const pageHtml = await page.content();

          // Get all stylesheet contents
          const styleContents = await page.evaluate(() => {
            const styles = [];
            // Get inline styles
            document.querySelectorAll('style').forEach(s => styles.push(s.textContent));
            // Get linked stylesheet contents (if same-origin)
            document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
              try {
                for (let sheet of document.styleSheets) {
                  if (sheet.href === link.href) {
                    try {
                      const rules = Array.from(sheet.cssRules || []).map(r => r.cssText).join('\\n');
                      styles.push(rules);
                    } catch (e) { /* cross-origin */ }
                  }
                }
              } catch (e) { /* ignore */ }
            });
            return styles;
          });

          // Get computed font-family from key elements
          const fonts = await page.evaluate(() => {
            const fontFamilies = new Set();
            const elements = document.querySelectorAll('body, h1, h2, h3, h4, h5, h6, p, a, span, div, button, input, li');
            elements.forEach(el => {
              const computed = window.getComputedStyle(el);
              if (computed.fontFamily) {
                fontFamilies.add(computed.fontFamily);
              }
            });
            return Array.from(fontFamilies);
          });

          // Extract preconnect hints from the page
          const preconnectHints = await page.evaluate(() => {
            const hints = [];
            document.querySelectorAll('link[rel="preconnect"]').forEach(link => {
              hints.push({
                href: link.href,
                crossorigin: link.hasAttribute('crossorigin')
              });
            });
            return hints;
          });

          return {
            html: pageHtml,
            stylesheets: styleContents,
            computedFonts: fonts,
            fontRequests: fontNetworkRequests,
            preconnects: preconnectHints
          };
        } finally {
          await page.close();
        }
      });

      // Combine HTML with stylesheet contents for better font detection
      const combinedContent = html + '\n' + stylesheets.join('\n');
      const $ = cheerio.load(html);

      // Extract all font-related information
      const fonts = {
        url,
        analyzedAt: new Date().toISOString(),
        providers: this.detectProviders(combinedContent, $),
        declarations: this.extractFontDeclarations(combinedContent, $),
        preloads: this.extractPreloads($),
        families: new Map(),
        computedFonts: computedFonts || [],
        issues: [],
        performance: {},
        summary: {}
      };

      // Process font-face declarations
      this.processFontFaces(fonts);

      // Also add computed fonts as detected families
      this.processComputedFonts(fonts);

      // Detect duplicates
      fonts.duplicates = this.findDuplicates(fonts.families);

      // Detect unused fonts
      fonts.unused = this.detectUnusedFonts(fonts);

      // Validate font-display
      fonts.displayIssues = this.validateFontDisplay(fonts);

      // Check for missing preloads
      fonts.preloadIssues = this.checkPreloads(fonts);

      // Calculate performance impact
      fonts.performance = this.calculatePerformanceImpact(fonts);

      // Generate recommendations
      fonts.recommendations = this.generateRecommendations(fonts);

      // Calculate font health score
      fonts.healthScore = this.calculateHealthScore(fonts);

      // NEW: Build font delivery data
      fonts.fontDelivery = this.buildFontDeliveryData(fontRequests, fonts.preloads, preconnects, fonts.providers, combinedContent);

      // NEW: Build fallback stability data
      fonts.fallbackStability = this.buildFallbackStabilityData(fonts.declarations, fonts.displayIssues, computedFonts, combinedContent);

      // Build summary
      fonts.summary = {
        totalFamilies: fonts.families.size,
        totalVariants: Array.from(fonts.families.values()).reduce((sum, f) => sum + f.variants.length, 0),
        providers: fonts.providers.map(p => p.name),
        duplicateCount: fonts.duplicates.length,
        unusedCount: fonts.unused.length,
        missingPreloads: fonts.preloadIssues.length,
        healthScore: fonts.healthScore
      };
      return fonts;

    } catch (error) {
      console.error(`Error analyzing fonts for ${url}:`, error.message);
      return {
        url,
        error: error.message,
        healthScore: 0
      };
    }
  }

  /**
   * Detect font providers
   */
  detectProviders(html, $) {
    const detected = [];

    // Check link elements
    $('link[href]').each((i, elem) => {
      const href = $(elem).attr('href');

      Object.entries(this.providers).forEach(([key, pattern]) => {
        if (pattern.test(href)) {
          const provider = {
            name: this.getProviderName(key),
            type: 'link',
            url: href,
            families: this.extractFamiliesFromUrl(href)
          };

          detected.push(provider);
        }
      });
    });

    // Check @import in style tags
    $('style').each((i, elem) => {
      const content = $(elem).html() || '';
      const importMatches = content.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/g);

      if (importMatches) {
        importMatches.forEach(match => {
          const url = match.match(/@import\s+url\(['"]?([^'"]+)['"]?\)/)?.[1];

          Object.entries(this.providers).forEach(([key, pattern]) => {
            if (pattern.test(url)) {
              detected.push({
                name: this.getProviderName(key),
                type: '@import',
                url,
                families: this.extractFamiliesFromUrl(url)
              });
            }
          });
        });
      }
    });

    // Check script sources (Adobe Fonts)
    $('script[src]').each((i, elem) => {
      const src = $(elem).attr('src');

      if (this.providers.adobeFonts.test(src)) {
        const kitId = src.match(/\/([a-z0-9]+)\.js/)?.[1];
        detected.push({
          name: 'Adobe Fonts',
          type: 'script',
          url: src,
          kitId
        });
      }
    });

    // Check for self-hosted fonts in @font-face
    const fontFaceMatches = html.match(/@font-face\s*\{[^}]+\}/g);
    if (fontFaceMatches) {
      const selfHostedFamilies = [];

      fontFaceMatches.forEach(ff => {
        // Check if URL is self-hosted (same domain or relative)
        const urlMatch = ff.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch) {
          const fontUrl = urlMatch[1];
          const isSelfHosted = !Object.values(this.providers).some(p => p.test(fontUrl));

          if (isSelfHosted) {
            // Extract font family name from this @font-face declaration
            const familyMatch = ff.match(/font-family:\s*['"]?([^'";]+)['"]?/i);
            if (familyMatch) {
              const familyName = familyMatch[1].trim();
              if (!selfHostedFamilies.includes(familyName)) {
                selfHostedFamilies.push(familyName);
              }
            }
          }
        }
      });

      if (selfHostedFamilies.length > 0) {
        detected.push({
          name: 'Self-Hosted',
          type: '@font-face',
          count: fontFaceMatches.length,
          families: selfHostedFamilies
        });
      }
    }

    return this.deduplicateProviders(detected);
  }

  /**
   * Get friendly provider name
   */
  getProviderName(key) {
    const names = {
      googleFonts: 'Google Fonts',
      adobeFonts: 'Adobe Fonts',
      fontAwesome: 'Font Awesome',
      bunny: 'Bunny Fonts',
      cdnFonts: 'Fonts.com'
    };
    return names[key] || key;
  }

  /**
   * Extract font families from URL
   * Returns array of family name strings for consistent aggregation
   */
  extractFamiliesFromUrl(url) {
    const families = [];

    try {
      const urlObj = new URL(url, 'https://example.com');
      const family = urlObj.searchParams.get('family');

      if (family) {
        // Google Fonts format: family=Roboto:wght@400;700|Open+Sans:wght@300
        family.split('|').forEach(f => {
          const [name] = f.split(':');
          const cleanName = name.replace(/\+/g, ' ').trim();

          if (cleanName && !families.includes(cleanName)) {
            families.push(cleanName);
          }
        });
      }
    } catch (error) {
      // Invalid URL, skip
    }

    return families;
  }

  /**
   * Parse font variants from URL
   */
  parseVariants(variantString) {
    const variants = [];
    // Format: wght@400;700 or ital,wght@0,400;1,700
    const match = variantString.match(/@(.+)/);
    if (match) {
      const weights = match[1].split(';');
      weights.forEach(w => {
        const parts = w.split(',');
        if (parts.length === 2) {
          variants.push({
            style: parts[0] === '1' ? 'italic' : 'normal',
            weight: parts[1]
          });
        } else {
          variants.push({
            style: 'normal',
            weight: parts[0]
          });
        }
      });
    }
    return variants;
  }

  /**
   * Deduplicate providers
   */
  deduplicateProviders(providers) {
    const seen = new Set();
    return providers.filter(p => {
      const key = `${p.name}-${p.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract @font-face declarations
   */
  extractFontDeclarations(html, $) {
    const declarations = [];

    // Extract from style tags
    $('style').each((i, elem) => {
      const content = $(elem).html() || '';
      const fontFaceMatches = content.match(/@font-face\s*\{[^}]+\}/g);

      if (fontFaceMatches) {
        fontFaceMatches.forEach(ff => {
          const declaration = this.parseFontFace(ff);
          if (declaration) {
            declarations.push(declaration);
          }
        });
      }
    });

    return declarations;
  }

  /**
   * Parse @font-face rule
   */
  parseFontFace(rule) {
    const fontFamily = rule.match(/font-family:\s*['"]?([^'";]+)['"]?/i)?.[1];
    const fontWeight = rule.match(/font-weight:\s*([^;]+)/i)?.[1];
    const fontStyle = rule.match(/font-style:\s*([^;]+)/i)?.[1];
    const fontDisplay = rule.match(/font-display:\s*([^;]+)/i)?.[1];
    const src = rule.match(/src:\s*([^;]+)/i)?.[1];

    if (!fontFamily) return null;

    return {
      family: fontFamily.trim(),
      weight: fontWeight ? fontWeight.trim() : 'normal',
      style: fontStyle ? fontStyle.trim() : 'normal',
      display: fontDisplay ? fontDisplay.trim() : 'auto',
      src: src ? src.trim() : null
    };
  }

  /**
   * Extract preload hints
   */
  extractPreloads($) {
    const preloads = [];

    $('link[rel="preload"][as="font"]').each((i, elem) => {
      preloads.push({
        href: $(elem).attr('href'),
        type: $(elem).attr('type'),
        crossorigin: $(elem).attr('crossorigin')
      });
    });

    return preloads;
  }

  /**
   * Process font faces into family map
   */
  processFontFaces(fonts) {
    fonts.declarations.forEach(decl => {
      if (!fonts.families.has(decl.family)) {
        fonts.families.set(decl.family, {
          name: decl.family,
          variants: [],
          sources: []
        });
      }

      const family = fonts.families.get(decl.family);
      family.variants.push({
        weight: decl.weight,
        style: decl.style,
        display: decl.display
      });

      if (decl.src) {
        family.sources.push(decl.src);
      }
    });
  }

  /**
   * Process computed fonts from browser into family map
   */
  processComputedFonts(fonts) {
    if (!fonts.computedFonts || !Array.isArray(fonts.computedFonts)) {
      return;
    }

    fonts.computedFonts.forEach(fontStack => {
      // Parse font-family stack like '"Open Sans", Arial, sans-serif'
      const families = fontStack.split(',').map(f => 
        f.trim().replace(/^["']|["']$/g, '').trim()
      );

      families.forEach(familyName => {
        // Skip generic families
        if (['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded', 'emoji', 'math', 'fangsong'].includes(familyName.toLowerCase())) {
          return;
        }

        // Skip empty or very short names
        if (!familyName || familyName.length < 2) {
          return;
        }

        if (!fonts.families.has(familyName)) {
          fonts.families.set(familyName, {
            name: familyName,
            variants: [{ weight: '400', style: 'normal', display: 'unknown' }],
            sources: ['computed-style'],
            detectedFrom: 'computed-styles'
          });
        }
      });
    });
  }

  /**
   * Find duplicate font families
   */
  findDuplicates(families) {
    const duplicates = [];
    const familyNames = new Map();

    families.forEach((family, key) => {
      const normalized = family.name.toLowerCase().trim();
      if (!familyNames.has(normalized)) {
        familyNames.set(normalized, []);
      }
      familyNames.get(normalized).push(family);
    });

    familyNames.forEach((instances, name) => {
      if (instances.length > 1) {
        duplicates.push({
          family: name,
          instances: instances.length,
          variants: instances.flatMap(i => i.variants),
          severity: 'warning',
          message: `"${instances[0].name}" loaded ${instances.length} times`,
          recommendation: 'Consolidate font loading to a single source'
        });
      }
    });

    return duplicates;
  }

  /**
   * Detect potentially unused fonts
   */
  detectUnusedFonts(fonts) {
    const unused = [];

    // Check if a family has many variants loaded
    fonts.families.forEach(family => {
      if (family.variants.length > 6) {
        unused.push({
          family: family.name,
          variantCount: family.variants.length,
          severity: 'info',
          message: `${family.name} has ${family.variants.length} variants loaded`,
          recommendation: 'Review if all font weights/styles are actually used'
        });
      }
    });

    return unused;
  }

  /**
   * Validate font-display property
   */
  validateFontDisplay(fonts) {
    const issues = [];

    fonts.declarations.forEach(decl => {
      if (decl.display === 'auto' || !decl.display) {
        issues.push({
          family: decl.family,
          variant: `${decl.weight} ${decl.style}`,
          severity: 'warning',
          message: `${decl.family} missing font-display property`,
          recommendation: 'Add font-display: swap for better performance'
        });
      } else if (decl.display === 'block') {
        issues.push({
          family: decl.family,
          variant: `${decl.weight} ${decl.style}`,
          severity: 'info',
          message: `${decl.family} uses font-display: block`,
          recommendation: 'Consider font-display: swap to prevent invisible text'
        });
      }
    });

    return issues;
  }

  /**
   * Check for missing preloads
   */
  checkPreloads(fonts) {
    const issues = [];

    // If using web fonts but no preloads
    if (fonts.providers.length > 0 && fonts.preloads.length === 0) {
      issues.push({
        severity: 'warning',
        message: 'Web fonts detected but no preload hints found',
        recommendation: 'Add <link rel="preload" as="font"> for critical fonts'
      });
    }

    return issues;
  }

  /**
   * Calculate performance impact
   */
  calculatePerformanceImpact(fonts) {
    let impact = 'low';
    let score = 100;

    // Deduct for number of families
    const familyCount = fonts.families.size;
    if (familyCount > 3) score -= (familyCount - 3) * 5;

    // Deduct for total variants
    const variantCount = Array.from(fonts.families.values())
      .reduce((sum, f) => sum + f.variants.length, 0);
    if (variantCount > 6) score -= (variantCount - 6) * 3;

    // Deduct for missing font-display
    score -= fonts.displayIssues.filter(i => i.severity === 'warning').length * 5;

    // Deduct for missing preloads
    score -= fonts.preloadIssues.length * 10;

    // Deduct for duplicates
    score -= fonts.duplicates.length * 15;

    score = Math.max(0, score);

    if (score < 60) impact = 'high';
    else if (score < 80) impact = 'medium';

    return {
      score,
      impact,
      familyCount,
      variantCount,
      estimatedKB: variantCount * 20 // Rough estimate: 20KB per variant
    };
  }

  /**
   * Generate actionable recommendations
   */
  generateRecommendations(fonts) {
    const recommendations = [];

    // Duplicate fonts
    if (fonts.duplicates.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'duplicates',
        title: 'Remove Duplicate Fonts',
        description: `${fonts.duplicates.length} font families are loaded multiple times`,
        impact: 'Reduces HTTP requests and page weight',
        action: 'Consolidate font loading to a single method (Google Fonts OR self-hosted, not both)'
      });
    }

    // Font-display
    const displayIssues = fonts.displayIssues.filter(i => i.severity === 'warning');
    if (displayIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Add font-display: swap',
        description: `${displayIssues.length} fonts missing font-display property`,
        impact: 'Prevents invisible text during font loading',
        action: 'Add font-display: swap to all @font-face declarations'
      });
    }

    // Preloads
    if (fonts.preloadIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'performance',
        title: 'Add Font Preloads',
        description: 'Critical fonts should be preloaded',
        impact: 'Faster font loading and reduced layout shift',
        action: 'Add <link rel="preload" as="font" crossorigin> for above-the-fold fonts'
      });
    }

    // Too many variants
    const heavyFamilies = fonts.unused.filter(u => u.variantCount > 8);
    if (heavyFamilies.length > 0) {
      recommendations.push({
        priority: 'low',
        category: 'optimization',
        title: 'Reduce Font Variants',
        description: `${heavyFamilies.length} families have 8+ variants loaded`,
        impact: 'Reduces page weight and improves load time',
        action: 'Audit font usage and remove unused weights/styles'
      });
    }

    return recommendations;
  }

  /**
   * Calculate overall font health score
   */
  calculateHealthScore(fonts) {
    let score = 100;

    // Deduct for duplicates
    score -= fonts.duplicates.length * 15;

    // Deduct for display issues
    score -= fonts.displayIssues.filter(i => i.severity === 'warning').length * 5;

    // Deduct for missing preloads
    score -= fonts.preloadIssues.length * 10;

    // Deduct for too many families
    if (fonts.families.size > 4) {
      score -= (fonts.families.size - 4) * 5;
    }

    // Bonus for good practices
    if (fonts.preloads.length > 0) score += 5;
    if (fonts.displayIssues.length === 0) score += 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Build font delivery data (network metrics, preconnects, preloads, formats)
   */
  buildFontDeliveryData(fontRequests, preloads, preconnects, providers, cssContent) {
    // Categorize font formats
    const formats = {
      woff2: [],
      woff: [],
      ttf: [],
      otf: [],
      eot: [],
      svg: [],
      unknown: []
    };

    let totalBytes = 0;
    let totalLoadTime = 0;

    // Process network requests
    const requests = (fontRequests || []).map(req => {
      totalBytes += req.size || 0;
      totalLoadTime += req.loadTime || 0;

      // Categorize by format
      if (formats[req.format]) {
        formats[req.format].push(req.url);
      } else {
        formats.unknown.push(req.url);
      }

      return {
        url: req.url,
        size: req.size,
        sizeKB: req.size ? (req.size / 1024).toFixed(1) : '0',
        format: req.format,
        loadTime: req.loadTime,
        cacheStatus: req.cacheStatus || 'MISS',
        cacheControl: req.cacheControl,
        status: req.status,
        contentType: req.contentType
      };
    });

    // Check which font domains need preconnect
    const fontDomains = new Set();
    providers.forEach(p => {
      if (p.url) {
        try {
          const domain = new URL(p.url, 'https://example.com').hostname;
          fontDomains.add(domain);
        } catch (e) { /* ignore */ }
      }
    });

    // Common font domains to check for preconnect
    const knownFontDomains = [
      'fonts.googleapis.com',
      'fonts.gstatic.com',
      'use.typekit.net',
      'fonts.bunny.net',
      'kit.fontawesome.com',
      'cdn.fontawesome.com'
    ];

    const preconnectStatus = [];
    const existingPreconnects = new Set((preconnects || []).map(p => {
      try {
        return new URL(p.href).hostname;
      } catch (e) {
        return p.href;
      }
    }));

    // Check if needed font domains have preconnect
    fontDomains.forEach(domain => {
      preconnectStatus.push({
        domain,
        found: existingPreconnects.has(domain),
        recommended: knownFontDomains.some(d => domain.includes(d))
      });
    });

    // Also check known domains that might be used
    knownFontDomains.forEach(domain => {
      if (!fontDomains.has(domain)) {
        // Check if this domain appears in CSS
        if (cssContent.includes(domain)) {
          preconnectStatus.push({
            domain,
            found: existingPreconnects.has(domain),
            recommended: true
          });
        }
      }
    });

    // Calculate format distribution score
    const totalFormats = requests.length;
    const woff2Count = formats.woff2.length;
    const modernFormatPercentage = totalFormats > 0 ? Math.round((woff2Count / totalFormats) * 100) : 0;

    // Calculate delivery score
    let deliveryScore = 100;
    // Deduct for non-WOFF2 formats
    if (modernFormatPercentage < 100 && totalFormats > 0) {
      deliveryScore -= Math.round((100 - modernFormatPercentage) * 0.3);
    }
    // Deduct for missing preconnects
    const missingPreconnects = preconnectStatus.filter(p => !p.found && p.recommended);
    deliveryScore -= missingPreconnects.length * 10;
    // Deduct for missing preloads
    if (requests.length > 0 && preloads.length === 0) {
      deliveryScore -= 15;
    }
    // Deduct for large total size (>200KB)
    if (totalBytes > 200 * 1024) {
      deliveryScore -= Math.min(20, Math.round((totalBytes - 200 * 1024) / (50 * 1024)));
    }
    deliveryScore = Math.max(0, Math.min(100, deliveryScore));

    return {
      requests,
      totalBytes,
      totalBytesKB: (totalBytes / 1024).toFixed(1),
      totalRequests: requests.length,
      averageLoadTime: requests.length > 0 ? Math.round(totalLoadTime / requests.length) : 0,
      preconnects: preconnectStatus,
      preconnectsMissing: missingPreconnects.length,
      preloads: preloads.map(p => ({
        href: p.href,
        type: p.type,
        crossorigin: p.crossorigin
      })),
      preloadsCount: preloads.length,
      formats: {
        woff2: formats.woff2.length,
        woff: formats.woff.length,
        ttf: formats.ttf.length,
        otf: formats.otf.length,
        legacy: formats.eot.length + formats.svg.length,
        unknown: formats.unknown.length
      },
      modernFormatPercentage,
      hasLegacyFormats: formats.eot.length > 0 || formats.svg.length > 0,
      score: deliveryScore,
      loadingHints: {
        preconnectCount: existingPreconnects.size,
        preloadCount: preloads.length,
        criticalFontCount: preloads.length
      }
    };
  }

  /**
   * Build fallback stability data (fallback stacks, metric overrides, CLS risk)
   */
  buildFallbackStabilityData(declarations, displayIssues, computedFonts, cssContent) {
    // Extract metric overrides from CSS
    const metricOverrides = this.extractMetricOverrides(cssContent);

    // Build font-display breakdown
    const fontDisplayBreakdown = {
      swap: [],
      optional: [],
      block: [],
      fallback: [],
      auto: []
    };

    declarations.forEach(decl => {
      const display = (decl.display || 'auto').toLowerCase();
      if (fontDisplayBreakdown[display]) {
        fontDisplayBreakdown[display].push(decl.family);
      } else {
        fontDisplayBreakdown.auto.push(decl.family);
      }
    });

    // Analyze fallback stacks
    const fallbackStacks = this.analyzeFallbackStackQuality(computedFonts);

    // Calculate CLS risk
    const clsRisk = this.calculateCLSRisk(declarations, fallbackStacks, metricOverrides);

    // Calculate stability score
    let stabilityScore = 100;

    // Deduct for poor fallback stacks
    const poorStacks = fallbackStacks.filter(s => s.quality === 'poor');
    stabilityScore -= poorStacks.length * 10;

    // Deduct for missing metric overrides when needed
    const displayProblems = fontDisplayBreakdown.block.length + fontDisplayBreakdown.auto.length;
    if (displayProblems > 0 && metricOverrides.length === 0) {
      stabilityScore -= displayProblems * 5;
    }

    // Deduct for high CLS risk
    if (clsRisk.level === 'high') stabilityScore -= 20;
    else if (clsRisk.level === 'medium') stabilityScore -= 10;

    // Bonus for using metric overrides
    if (metricOverrides.length > 0) stabilityScore += 10;

    stabilityScore = Math.max(0, Math.min(100, stabilityScore));

    return {
      fallbackStacks,
      fallbackStacksSummary: {
        total: fallbackStacks.length,
        excellent: fallbackStacks.filter(s => s.quality === 'excellent').length,
        good: fallbackStacks.filter(s => s.quality === 'good').length,
        poor: poorStacks.length
      },
      metricOverrides,
      hasMetricOverrides: metricOverrides.length > 0,
      fontDisplayBreakdown,
      fontDisplaySummary: {
        optimal: fontDisplayBreakdown.swap.length + fontDisplayBreakdown.optional.length,
        acceptable: fontDisplayBreakdown.fallback.length,
        problematic: fontDisplayBreakdown.block.length + fontDisplayBreakdown.auto.length
      },
      clsRisk,
      score: stabilityScore
    };
  }

  /**
   * Extract metric overrides from CSS (size-adjust, ascent-override, etc.)
   */
  extractMetricOverrides(cssContent) {
    const overrides = [];
    const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi;
    let match;

    while ((match = fontFaceRegex.exec(cssContent)) !== null) {
      const block = match[1];
      const familyMatch = block.match(/font-family:\s*['"]?([^'";]+)['"]?/i);

      if (familyMatch) {
        const family = familyMatch[1].trim();

        // Check for metric override properties
        const sizeAdjust = block.match(/size-adjust:\s*([^;]+)/i)?.[1]?.trim();
        const ascentOverride = block.match(/ascent-override:\s*([^;]+)/i)?.[1]?.trim();
        const descentOverride = block.match(/descent-override:\s*([^;]+)/i)?.[1]?.trim();
        const lineGapOverride = block.match(/line-gap-override:\s*([^;]+)/i)?.[1]?.trim();

        if (sizeAdjust || ascentOverride || descentOverride || lineGapOverride) {
          overrides.push({
            family,
            sizeAdjust,
            ascentOverride,
            descentOverride,
            lineGapOverride
          });
        }
      }
    }

    return overrides;
  }

  /**
   * Analyze fallback stack quality
   */
  analyzeFallbackStackQuality(computedFonts) {
    const stacks = [];
    const seen = new Set();

    const systemFonts = [
      'arial', 'helvetica', 'times', 'times new roman', 'georgia',
      'verdana', 'tahoma', 'trebuchet ms', 'segoe ui', 'roboto',
      'system-ui', '-apple-system', 'blinkmacsystemfont'
    ];
    const genericFonts = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy'];

    (computedFonts || []).forEach(stack => {
      if (seen.has(stack)) return;
      seen.add(stack);

      const fonts = stack.split(',').map(f => f.trim().replace(/['"]/g, '').toLowerCase());
      const hasSystemFallback = fonts.some(f => systemFonts.includes(f));
      const hasGenericFallback = fonts.some(f => genericFonts.includes(f));
      const fontCount = fonts.length;

      let quality = 'poor';
      let recommendation = '';

      if (fontCount >= 3 && hasSystemFallback && hasGenericFallback) {
        quality = 'excellent';
        recommendation = 'Well-structured fallback stack with system and generic fallbacks';
      } else if (fontCount >= 2 && (hasSystemFallback || hasGenericFallback)) {
        quality = 'good';
        recommendation = hasSystemFallback
          ? 'Add a generic fallback (e.g., sans-serif)'
          : 'Add a system font fallback (e.g., Arial, Helvetica)';
      } else {
        recommendation = 'Add system font and generic fallbacks to prevent layout shifts';
      }

      stacks.push({
        stack: stack.substring(0, 100) + (stack.length > 100 ? '...' : ''),
        fullStack: stack,
        fontCount,
        hasSystemFallback,
        hasGenericFallback,
        quality,
        recommendation
      });
    });

    return stacks;
  }

  /**
   * Calculate CLS (Cumulative Layout Shift) risk from fonts
   */
  calculateCLSRisk(declarations, fallbackStacks, metricOverrides) {
    const risks = [];
    let riskLevel = 'low';
    let score = 100;

    // Check for fonts without font-display: swap/optional
    const problematicDisplay = declarations.filter(d =>
      !d.display || d.display === 'auto' || d.display === 'block'
    );

    if (problematicDisplay.length > 0) {
      risks.push({
        type: 'warning',
        title: 'Missing font-display optimization',
        detail: `${problematicDisplay.length} font(s) may cause Flash of Invisible Text (FOIT)`,
        families: problematicDisplay.map(d => d.family).slice(0, 5)
      });
      score -= problematicDisplay.length * 5;
    }

    // Check for poor fallback stacks
    const poorStacks = fallbackStacks.filter(s => s.quality === 'poor');
    if (poorStacks.length > 0) {
      risks.push({
        type: 'warning',
        title: 'Poor fallback font stacks',
        detail: `${poorStacks.length} element(s) have insufficient fallback fonts, increasing layout shift risk`,
        stacks: poorStacks.slice(0, 3).map(s => s.stack)
      });
      score -= poorStacks.length * 8;
    }

    // Check if metric overrides are used (positive signal)
    if (metricOverrides.length > 0) {
      score += 15; // Bonus for using metric overrides
    } else if (declarations.length > 0 && poorStacks.length > 0) {
      risks.push({
        type: 'info',
        title: 'No metric overrides detected',
        detail: 'Consider using size-adjust and ascent-override to minimize layout shifts'
      });
    }

    // Determine overall risk level
    score = Math.max(0, Math.min(100, score));
    if (score < 60) riskLevel = 'high';
    else if (score < 80) riskLevel = 'medium';

    return {
      level: riskLevel,
      score,
      risks,
      hasMetricOverrides: metricOverrides.length > 0
    };
  }
}

module.exports = new EnhancedFontAnalyzer();
