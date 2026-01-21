/**
 * Brand Consistency Checker (Best-in-Class)
 * Analyzes color palette, fonts, logo usage, and brand cohesion
 * Features: Multi-page crawling, color harmony analysis, typography pairing, cross-page consistency scoring
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');
const { roundTo, formatDuration } = require('../utils/formatHelpers');

const logger = createLogger('BrandConsistencyService');

class BrandConsistencyService {
  
  // Main entry point - supports both single and multi-page analysis
  async analyzeBrand(url, options = {}) {
    const { multiPage = false, maxPages = 5 } = options;
    
    if (multiPage) {
      return this.analyzeMultiPage(url, maxPages);
    }
    return this.analyzeSinglePage(url);
  }

  // Multi-page brand analysis - crawls homepage + key internal pages
  async analyzeMultiPage(url, maxPages = 5) {
    logger.info(`Starting multi-page brand analysis for: ${url} (max ${maxPages} pages)`);
    const startTime = Date.now();
    
    try {
      // First, discover internal links from homepage
      const pagesToAnalyze = await this.discoverPages(url, maxPages);
      logger.info(`Discovered ${pagesToAnalyze.length} pages to analyze`);
      
      // Analyze each page
      const pageResults = [];
      for (const pageUrl of pagesToAnalyze) {
        try {
          logger.info(`Analyzing page: ${pageUrl}`);
          const pageData = await this.extractPageData(pageUrl);
          pageResults.push({
            url: pageUrl,
            pageName: this.getPageName(pageUrl),
            ...pageData
          });
        } catch (pageError) {
          logger.warn(`Failed to analyze page ${pageUrl}: ${pageError.message}`);
        }
      }
      
      if (pageResults.length === 0) {
        throw new Error('Could not analyze any pages');
      }
      
      // Aggregate results across all pages
      const aggregated = this.aggregateMultiPageResults(pageResults);
      
      // Calculate cross-page consistency
      const crossPageConsistency = this.analyzeCrossPageConsistency(pageResults);
      
      // Standard analysis on aggregated data
      const consistency = this.analyzeConsistency(aggregated);
      const colorAnalysis = this.analyzeColorHarmony(aggregated.colors);
      const typographyAnalysis = this.analyzeTypography(aggregated);
      const contrastAnalysis = this.analyzeColorContrast(aggregated.colorPairs || []);
      const hierarchyAnalysis = this.analyzeVisualHierarchy(aggregated.headingHierarchy || [], aggregated.bodyTextStyle);
      const colorUsageAnalysis = this.analyzeColorUsage(aggregated.colorUsage || {});
      const score = this.calculateBrandScore(consistency, colorAnalysis, typographyAnalysis, crossPageConsistency);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        multiPage: true,
        pagesAnalyzed: pageResults.length,
        pageBreakdown: pageResults.map(p => ({
          url: p.url,
          pageName: p.pageName,
          colorCount: p.colors?.length || 0,
          fontCount: p.fonts?.length || 0,
          hasLogo: p.logos?.length > 0,
          buttonCount: p.buttonStyles?.length || 0
        })),
        crossPageConsistency,
        brandElements: aggregated,
        consistency,
        colorAnalysis,
        typographyAnalysis,
        contrastAnalysis,
        hierarchyAnalysis,
        colorUsageAnalysis,
        score,
        scoreBreakdown: this.getScoreBreakdown(consistency, colorAnalysis, typographyAnalysis, crossPageConsistency),
        grade: this.getGrade(score),
        recommendations: this.generateRecommendations(consistency, colorAnalysis, typographyAnalysis, aggregated, contrastAnalysis, hierarchyAnalysis, crossPageConsistency),
        analysisTime: formatDuration(Date.now() - startTime, 2)
      };
      
    } catch (error) {
      logger.error('Multi-page brand analysis failed:', error);
      throw new Error(`Multi-page brand analysis failed: ${error.message}`);
    }
  }

  // Discover internal pages to analyze
  async discoverPages(url, maxPages) {
    const baseUrl = new URL(url);
    const baseOrigin = baseUrl.origin;
    const baseDomain = baseUrl.hostname.replace(/^www\./, ''); // Handle www vs non-www
    
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      await this.setupPage(page);
      
      try {
        // Use networkidle0 for better JavaScript rendering, with longer timeout
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Wait for navigation to be visible (common selectors)
        try {
          await page.waitForSelector('nav, header, [role="navigation"], .nav, .menu, .navigation', { timeout: 5000 });
        } catch (e) {
          // Navigation might not exist or be named differently, continue anyway
        }
        
        // Additional wait for JS-heavy sites
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
        
        // Get the actual origin after any redirects
        const actualOrigin = await page.evaluate(() => window.location.origin);
        logger.info(`Page loaded at origin: ${actualOrigin} (requested: ${baseOrigin})`);
        
        // Extract all internal links
        const links = await page.evaluate((origin, baseDomain) => {
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          const internalLinks = new Set();
          
          // Priority keywords for important pages
          const priorityKeywords = ['about', 'contact', 'product', 'service', 'team', 'pricing', 'blog', 'portfolio', 'work', 'case', 'client', 'testimonial', 'feature'];
          
          allLinks.forEach(link => {
            try {
              const href = link.href;
              if (!href) return;
              
              const linkUrl = new URL(href);
              
              // Only internal links - check both origin and domain (handles www vs non-www)
              const linkDomain = linkUrl.hostname.replace(/^www\./, '');
              if (linkUrl.origin !== origin && linkDomain !== baseDomain) return;
              
              // Skip anchors-only links, files, and special paths
              const path = linkUrl.pathname.toLowerCase();
              if (path === '/' && linkUrl.hash) return; // Skip hash-only links to homepage
              if (path.match(/\.(pdf|jpg|jpeg|png|gif|svg|css|js|xml|txt|zip)$/i) ||
                  path.includes('/wp-admin') ||
                  path.includes('/cart') ||
                  path.includes('/checkout') ||
                  path.includes('/login') ||
                  path.includes('/register') ||
                  path.includes('/search')) return;
              
              // Calculate priority score
              let priority = 0;
              const text = (link.textContent || '').toLowerCase();
              priorityKeywords.forEach(kw => {
                if (path.includes(kw) || text.includes(kw)) priority += 10;
              });
              
              // Prefer shorter paths (usually main pages)
              const depth = path.split('/').filter(p => p).length;
              priority -= depth * 2;
              
              // Navigation links get priority
              if (link.closest('nav, header, [role="navigation"]')) priority += 5;
              
              internalLinks.add(JSON.stringify({ url: linkUrl.origin + linkUrl.pathname, priority }));
            } catch (e) {}
          });
          
          return Array.from(internalLinks).map(l => JSON.parse(l));
        }, actualOrigin, baseDomain);
        
        await page.close();
        
        logger.info(`Found ${links.length} raw internal links from page`);
        
        // Sort by priority and take top pages
        const sortedLinks = links
          .sort((a, b) => b.priority - a.priority)
          .map(l => l.url)
          .filter((url, idx, arr) => arr.indexOf(url) === idx); // Dedupe
        
        logger.info(`After deduplication: ${sortedLinks.length} unique links`);
        if (sortedLinks.length > 0) {
          logger.debug(`Top 5 discovered links: ${sortedLinks.slice(0, 5).join(', ')}`);
        }
        
        // Always include homepage first
        const pagesToAnalyze = [url];
        for (const link of sortedLinks) {
          if (pagesToAnalyze.length >= maxPages) break;
          if (!pagesToAnalyze.includes(link)) {
            pagesToAnalyze.push(link);
          }
        }
        
        logger.info(`Final pages to analyze: ${pagesToAnalyze.length} (max: ${maxPages})`);
        return pagesToAnalyze;
        
      } catch (error) {
        await page.close();
        logger.warn(`Page discovery failed: ${error.message}`);
        return [url]; // Fallback to just homepage
      }
    });
  }

  // Get friendly page name from URL
  getPageName(url) {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      if (path === '/' || path === '') return 'Homepage';
      
      // Extract page name from path
      const segments = path.split('/').filter(s => s);
      const lastSegment = segments[segments.length - 1] || 'Page';
      
      // Clean up and capitalize
      return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\.\w+$/, '') // Remove extension
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    } catch {
      return 'Page';
    }
  }

  // Setup page with stealth settings
  async setupPage(page) {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
    });
    await page.setViewport({ width: 1920, height: 1080 });
  }

  // Extract brand data from a single page
  async extractPageData(url) {
    return await browserPool.execute(async (browser) => {
      const page = await browser.newPage();
      await this.setupPage(page);
      
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
        
        const analysis = await page.evaluate(() => {
          const colorSet = new Set();
          const colorUsage = { text: {}, background: {}, border: {}, accent: {} };
          const elements = document.querySelectorAll('*');
          
          elements.forEach(el => {
            const styles = window.getComputedStyle(el);
            const tagName = el.tagName.toLowerCase();
            
            const textColor = styles.color;
            if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
              colorSet.add(textColor);
              colorUsage.text[textColor] = (colorUsage.text[textColor] || 0) + 1;
            }
            
            const bgColor = styles.backgroundColor;
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
              colorSet.add(bgColor);
              colorUsage.background[bgColor] = (colorUsage.background[bgColor] || 0) + 1;
            }
            
            const borderColor = styles.borderColor;
            if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
              colorSet.add(borderColor);
              colorUsage.border[borderColor] = (colorUsage.border[borderColor] || 0) + 1;
            }
            
            if (['a', 'button', 'input[type="submit"]'].includes(tagName) || 
                el.classList.contains('btn') || el.classList.contains('button')) {
              if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                colorUsage.accent[bgColor] = (colorUsage.accent[bgColor] || 0) + 1;
              }
            }
          });
          
          const fontUsage = {};
          const headingFonts = new Set();
          const bodyFonts = new Set();
          
          elements.forEach(el => {
            const styles = window.getComputedStyle(el);
            const font = styles.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
            const tagName = el.tagName.toLowerCase();
            
            if (font) {
              fontUsage[font] = (fontUsage[font] || 0) + 1;
              if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                headingFonts.add(font);
              } else if (['p', 'span', 'div', 'li', 'td'].includes(tagName)) {
                bodyFonts.add(font);
              }
            }
          });
          
          const logos = Array.from(document.querySelectorAll('img, svg')).filter(el => {
            if (el.tagName === 'IMG') {
              const alt = (el.alt || '').toLowerCase();
              const src = (el.src || '').toLowerCase();
              const className = (el.className || '').toLowerCase();
              const id = (el.id || '').toLowerCase();
              const parentClass = (el.parentElement?.className || '').toLowerCase();
              return alt.includes('logo') || src.includes('logo') || 
                     className.includes('logo') || id.includes('logo') ||
                     parentClass.includes('logo') || parentClass.includes('brand');
            } else if (el.tagName === 'svg') {
              const className = (el.className?.baseVal || '').toLowerCase();
              const id = (el.id || '').toLowerCase();
              const parentClass = (el.parentElement?.className || '').toLowerCase();
              return className.includes('logo') || id.includes('logo') ||
                     parentClass.includes('logo') || parentClass.includes('brand');
            }
            return false;
          });
          
          const favicon = document.querySelector('link[rel*="icon"]');
          
          const buttons = Array.from(document.querySelectorAll('button, .btn, .button, input[type="submit"]'));
          const buttonStyles = buttons.slice(0, 10).map(btn => {
            const styles = window.getComputedStyle(btn);
            return {
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              borderRadius: styles.borderRadius,
              fontSize: styles.fontSize,
              fontFamily: styles.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
            };
          });
          
          const links = Array.from(document.querySelectorAll('a')).slice(0, 20);
          const linkColors = links.map(link => window.getComputedStyle(link).color).filter(c => c);
          
          const brandAssets = {
            ogImage: document.querySelector('meta[property="og:image"]')?.content || null,
            ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
            ogDescription: document.querySelector('meta[property="og:description"]')?.content || null,
            twitterImage: document.querySelector('meta[name="twitter:image"]')?.content || null,
            twitterCard: document.querySelector('meta[name="twitter:card"]')?.content || null,
            appleTouchIcon: document.querySelector('link[rel="apple-touch-icon"]')?.href || null,
            themeColor: document.querySelector('meta[name="theme-color"]')?.content || null
          };
          
          const headingHierarchy = [];
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].forEach(tag => {
            const el = document.querySelector(tag);
            if (el) {
              const styles = window.getComputedStyle(el);
              headingHierarchy.push({
                tag,
                fontSize: parseFloat(styles.fontSize),
                fontSizeUnit: styles.fontSize,
                fontWeight: styles.fontWeight,
                fontFamily: styles.fontFamily.split(',')[0].replace(/['"]/g, '').trim(),
                count: document.querySelectorAll(tag).length
              });
            }
          });
          
          const bodyEl = document.querySelector('p') || document.querySelector('body');
          const bodyStyles = bodyEl ? window.getComputedStyle(bodyEl) : null;
          const bodyTextStyle = bodyStyles ? {
            fontSize: bodyStyles.fontSize,
            lineHeight: bodyStyles.lineHeight,
            fontWeight: bodyStyles.fontWeight,
            fontFamily: bodyStyles.fontFamily.split(',')[0].replace(/['"]/g, '').trim()
          } : null;
          
          const colorPairs = [];
          const sampleElements = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, li')).slice(0, 30);
          sampleElements.forEach(el => {
            const styles = window.getComputedStyle(el);
            const textColor = styles.color;
            const bgColor = styles.backgroundColor;
            if (textColor && bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
              colorPairs.push({ textColor, bgColor, element: el.tagName.toLowerCase() });
            }
          });
          
          return {
            colors: Array.from(colorSet).slice(0, 100),
            colorUsage,
            fonts: Object.entries(fontUsage).sort((a, b) => b[1] - a[1]).map(([font, count]) => ({ font, count })),
            headingFonts: Array.from(headingFonts),
            bodyFonts: Array.from(bodyFonts),
            logos: logos.map(l => ({
              type: l.tagName.toLowerCase(),
              src: l.src || 'SVG inline',
              alt: l.alt || '',
              width: l.width || l.clientWidth,
              height: l.height || l.clientHeight
            })),
            hasFavicon: !!favicon,
            faviconHref: favicon?.href,
            buttonStyles,
            linkColors: [...new Set(linkColors)],
            brandAssets,
            headingHierarchy,
            bodyTextStyle,
            colorPairs: colorPairs.slice(0, 20)
          };
        });
        
        await page.close();
        return analysis;
        
      } catch (error) {
        await page.close();
        throw error;
      }
    });
  }

  // Aggregate results from multiple pages
  aggregateMultiPageResults(pageResults) {
    const allColors = new Set();
    const allColorUsage = { text: {}, background: {}, border: {}, accent: {} };
    const allFontUsage = {};
    const allHeadingFonts = new Set();
    const allBodyFonts = new Set();
    const allLogos = [];
    const allButtonStyles = [];
    const allLinkColors = [];
    const allColorPairs = [];
    let hasFavicon = false;
    let faviconHref = null;
    let brandAssets = null;
    let headingHierarchy = [];
    let bodyTextStyle = null;
    
    pageResults.forEach((page, idx) => {
      // Colors
      (page.colors || []).forEach(c => allColors.add(c));
      
      // Color usage - merge counts
      Object.keys(allColorUsage).forEach(type => {
        const pageUsage = page.colorUsage?.[type] || {};
        Object.entries(pageUsage).forEach(([color, count]) => {
          allColorUsage[type][color] = (allColorUsage[type][color] || 0) + count;
        });
      });
      
      // Fonts
      (page.fonts || []).forEach(f => {
        allFontUsage[f.font] = (allFontUsage[f.font] || 0) + f.count;
      });
      
      (page.headingFonts || []).forEach(f => allHeadingFonts.add(f));
      (page.bodyFonts || []).forEach(f => allBodyFonts.add(f));
      
      // Logos
      (page.logos || []).forEach(logo => {
        const exists = allLogos.some(l => l.src === logo.src);
        if (!exists) allLogos.push({ ...logo, foundOnPage: page.pageName });
      });
      
      // Button styles
      (page.buttonStyles || []).forEach(btn => {
        allButtonStyles.push({ ...btn, foundOnPage: page.pageName });
      });
      
      // Link colors
      (page.linkColors || []).forEach(c => {
        if (!allLinkColors.includes(c)) allLinkColors.push(c);
      });
      
      // Color pairs
      (page.colorPairs || []).forEach(pair => allColorPairs.push(pair));
      
      // Favicon - use first found
      if (page.hasFavicon && !hasFavicon) {
        hasFavicon = true;
        faviconHref = page.faviconHref;
      }
      
      // Brand assets - use first found (usually homepage)
      if (!brandAssets && page.brandAssets) {
        brandAssets = page.brandAssets;
      }
      
      // Heading hierarchy - use homepage
      if (idx === 0 && page.headingHierarchy) {
        headingHierarchy = page.headingHierarchy;
      }
      
      // Body text style - use homepage
      if (idx === 0 && page.bodyTextStyle) {
        bodyTextStyle = page.bodyTextStyle;
      }
    });
    
    return {
      colors: Array.from(allColors).slice(0, 150),
      colorUsage: allColorUsage,
      fonts: Object.entries(allFontUsage)
        .sort((a, b) => b[1] - a[1])
        .map(([font, count]) => ({ font, count })),
      headingFonts: Array.from(allHeadingFonts),
      bodyFonts: Array.from(allBodyFonts),
      logos: allLogos,
      hasFavicon,
      faviconHref,
      buttonStyles: allButtonStyles.slice(0, 20),
      linkColors: [...new Set(allLinkColors)],
      brandAssets: brandAssets || {},
      headingHierarchy,
      bodyTextStyle,
      colorPairs: allColorPairs.slice(0, 30)
    };
  }

  // Analyze consistency across pages
  analyzeCrossPageConsistency(pageResults) {
    if (pageResults.length < 2) {
      return { score: 100, issues: [], pageVariations: [] };
    }
    
    const issues = [];
    const pageVariations = [];
    let consistencyScore = 100;
    
    // Analyze color variation across pages
    const colorCounts = pageResults.map(p => ({ 
      page: p.pageName, 
      count: p.colors?.length || 0 
    }));
    const avgColors = colorCounts.reduce((sum, p) => sum + p.count, 0) / colorCounts.length;
    const maxColorDiff = Math.max(...colorCounts.map(p => Math.abs(p.count - avgColors)));
    
    if (maxColorDiff > 15) {
      issues.push({
        type: 'colorVariation',
        severity: 'high',
        message: 'Significant color count variation between pages',
        details: colorCounts
      });
      consistencyScore -= 15;
    } else if (maxColorDiff > 8) {
      issues.push({
        type: 'colorVariation',
        severity: 'medium',
        message: 'Moderate color count variation between pages',
        details: colorCounts
      });
      consistencyScore -= 8;
    }
    
    pageVariations.push({
      metric: 'colors',
      values: colorCounts,
      variation: roundTo(maxColorDiff, 0)
    });
    
    // Analyze font variation across pages
    const fontCounts = pageResults.map(p => ({ 
      page: p.pageName, 
      count: p.fonts?.length || 0 
    }));
    const maxFontDiff = Math.max(...fontCounts.map((p, i, arr) => 
      Math.abs(p.count - (arr[0]?.count || 0))
    ));
    
    if (maxFontDiff > 3) {
      issues.push({
        type: 'fontVariation',
        severity: 'high',
        message: 'Different font counts across pages',
        details: fontCounts
      });
      consistencyScore -= 12;
    }
    
    pageVariations.push({
      metric: 'fonts',
      values: fontCounts,
      variation: maxFontDiff
    });
    
    // Check logo presence consistency
    const pagesWithLogo = pageResults.filter(p => (p.logos?.length || 0) > 0);
    const logoConsistency = pagesWithLogo.length / pageResults.length;
    
    if (logoConsistency < 1 && logoConsistency > 0) {
      issues.push({
        type: 'logoInconsistency',
        severity: 'medium',
        message: `Logo found on ${pagesWithLogo.length} of ${pageResults.length} pages`,
        details: pageResults.map(p => ({ page: p.pageName, hasLogo: (p.logos?.length || 0) > 0 }))
      });
      consistencyScore -= 10;
    }
    
    pageVariations.push({
      metric: 'logo',
      values: pageResults.map(p => ({ page: p.pageName, hasLogo: (p.logos?.length || 0) > 0 })),
      variation: logoConsistency < 1 ? 'inconsistent' : 'consistent'
    });
    
    // Check button style consistency
    const allButtonBgColors = new Set();
    pageResults.forEach(p => {
      (p.buttonStyles || []).forEach(btn => {
        if (btn.backgroundColor && btn.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          allButtonBgColors.add(btn.backgroundColor);
        }
      });
    });
    
    if (allButtonBgColors.size > 4) {
      issues.push({
        type: 'buttonStyleVariation',
        severity: 'medium',
        message: `Found ${allButtonBgColors.size} different button colors across pages`,
        details: Array.from(allButtonBgColors)
      });
      consistencyScore -= 8;
    }
    
    pageVariations.push({
      metric: 'buttonColors',
      uniqueCount: allButtonBgColors.size,
      variation: allButtonBgColors.size > 3 ? 'high' : 'low'
    });
    
    return {
      score: Math.max(0, consistencyScore),
      issues,
      pageVariations,
      pagesAnalyzed: pageResults.length
    };
  }

  // Single page analysis (original behavior)
  async analyzeSinglePage(url) {
    logger.info(`Starting single-page brand analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await this.extractPageData(url);
      
      // Enhanced consistency analysis
      const consistency = this.analyzeConsistency(results);
      const colorAnalysis = this.analyzeColorHarmony(results.colors);
      const typographyAnalysis = this.analyzeTypography(results);
      const contrastAnalysis = this.analyzeColorContrast(results.colorPairs || []);
      const hierarchyAnalysis = this.analyzeVisualHierarchy(results.headingHierarchy || [], results.bodyTextStyle);
      const colorUsageAnalysis = this.analyzeColorUsage(results.colorUsage || {});
      const score = this.calculateBrandScore(consistency, colorAnalysis, typographyAnalysis);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        multiPage: false,
        pagesAnalyzed: 1,
        brandElements: results,
        consistency,
        colorAnalysis,
        typographyAnalysis,
        contrastAnalysis,
        hierarchyAnalysis,
        colorUsageAnalysis,
        score,
        scoreBreakdown: this.getScoreBreakdown(consistency, colorAnalysis, typographyAnalysis),
        grade: this.getGrade(score),
        recommendations: this.generateRecommendations(consistency, colorAnalysis, typographyAnalysis, results, contrastAnalysis, hierarchyAnalysis),
        analysisTime: formatDuration(Date.now() - startTime, 2)
      };
      
    } catch (error) {
      logger.error('Single-page brand analysis failed:', error);
      throw new Error(`Brand analysis failed: ${error.message}`);
    }
  }

  // Parse RGB/RGBA color string to HSL values
  parseColor(colorStr) {
    const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!rgbMatch) return null;
    
    const r = parseInt(rgbMatch[1]) / 255;
    const g = parseInt(rgbMatch[2]) / 255;
    const b = parseInt(rgbMatch[3]) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    
    let h = 0, s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return { h: roundTo(h * 360, 0), s: roundTo(s * 100, 0), l: roundTo(l * 100, 0), raw: colorStr };
  }

  // Parse RGB to get luminance for contrast calculation
  getLuminance(colorStr) {
    const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!rgbMatch) return null;
    
    const rgb = [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3])].map(val => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  // Calculate contrast ratio between two colors
  getContrastRatio(color1, color2) {
    const lum1 = this.getLuminance(color1);
    const lum2 = this.getLuminance(color2);
    if (lum1 === null || lum2 === null) return null;
    
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
  }

  // Analyze color contrast accessibility (WCAG)
  analyzeColorContrast(colorPairs) {
    if (!colorPairs || colorPairs.length === 0) {
      return { pairs: [], summary: { total: 0, passAA: 0, passAAA: 0, failAA: 0 }, score: 50 };
    }

    const analyzedPairs = colorPairs.map(pair => {
      const ratio = this.getContrastRatio(pair.textColor, pair.bgColor);
      const isLargeText = pair.element && ['h1', 'h2', 'h3'].includes(pair.element);
      
      // WCAG 2.1 thresholds
      const aaThreshold = isLargeText ? 3 : 4.5;
      const aaaThreshold = isLargeText ? 4.5 : 7;
      
      return {
        ...pair,
        ratio: ratio ? roundTo(ratio, 2) : null,
        passAA: ratio >= aaThreshold,
        passAAA: ratio >= aaaThreshold,
        isLargeText,
        level: ratio >= aaaThreshold ? 'AAA' : ratio >= aaThreshold ? 'AA' : 'Fail'
      };
    });

    const validPairs = analyzedPairs.filter(p => p.ratio !== null);
    const passAA = validPairs.filter(p => p.passAA).length;
    const passAAA = validPairs.filter(p => p.passAAA).length;
    const failAA = validPairs.filter(p => !p.passAA).length;
    
    // Score based on AA compliance percentage
    const complianceRate = validPairs.length > 0 ? (passAA / validPairs.length) * 100 : 50;
    
    return {
      pairs: analyzedPairs.slice(0, 10), // Top 10 for display
      summary: {
        total: validPairs.length,
        passAA,
        passAAA,
        failAA,
        complianceRate: roundTo(complianceRate, 0)
      },
      score: roundTo(complianceRate, 0)
    };
  }

  // Analyze visual hierarchy
  analyzeVisualHierarchy(headingHierarchy, bodyTextStyle) {
    if (!headingHierarchy || headingHierarchy.length === 0) {
      return { isProgressive: false, issues: ['noHeadings'], score: 30 };
    }

    const issues = [];
    let score = 100;
    
    // Check if headings are progressively smaller
    let isProgressive = true;
    for (let i = 1; i < headingHierarchy.length; i++) {
      if (headingHierarchy[i].fontSize >= headingHierarchy[i - 1].fontSize) {
        isProgressive = false;
        issues.push({
          type: 'sizeNotProgressive',
          from: headingHierarchy[i - 1].tag,
          to: headingHierarchy[i].tag,
          fromSize: headingHierarchy[i - 1].fontSizeUnit,
          toSize: headingHierarchy[i].fontSizeUnit
        });
        score -= 15;
      }
    }
    
    // Check for consistent font family in headings
    const headingFonts = [...new Set(headingHierarchy.map(h => h.fontFamily))];
    if (headingFonts.length > 2) {
      issues.push({ type: 'inconsistentHeadingFonts', count: headingFonts.length });
      score -= 10;
    }
    
    // Check heading to body ratio (h1 should be ~2-3x body size)
    if (bodyTextStyle && headingHierarchy[0]) {
      const h1Size = headingHierarchy[0].fontSize;
      const bodySize = parseFloat(bodyTextStyle.fontSize);
      const ratio = h1Size / bodySize;

      if (ratio < 1.5) {
        issues.push({ type: 'h1TooSmall', ratio: roundTo(ratio, 1) });
        score -= 15;
      } else if (ratio > 4) {
        issues.push({ type: 'h1TooLarge', ratio: roundTo(ratio, 1) });
        score -= 10;
      }
    }
    
    // Calculate type scale (ratio between heading levels)
    const typeScale = [];
    for (let i = 1; i < headingHierarchy.length; i++) {
      const ratio = headingHierarchy[i - 1].fontSize / headingHierarchy[i].fontSize;
      typeScale.push({
        from: headingHierarchy[i - 1].tag,
        to: headingHierarchy[i].tag,
        ratio: roundTo(ratio, 2)
      });
    }
    
    return {
      headings: headingHierarchy,
      bodyStyle: bodyTextStyle,
      isProgressive,
      headingFonts,
      typeScale,
      issues,
      score: Math.max(0, score)
    };
  }

  // Analyze color usage distribution
  analyzeColorUsage(colorUsage) {
    const usage = {
      text: Object.entries(colorUsage.text || {}).map(([color, count]) => ({ color, count, type: 'text' })).sort((a, b) => b.count - a.count),
      background: Object.entries(colorUsage.background || {}).map(([color, count]) => ({ color, count, type: 'background' })).sort((a, b) => b.count - a.count),
      border: Object.entries(colorUsage.border || {}).map(([color, count]) => ({ color, count, type: 'border' })).sort((a, b) => b.count - a.count),
      accent: Object.entries(colorUsage.accent || {}).map(([color, count]) => ({ color, count, type: 'accent' })).sort((a, b) => b.count - a.count)
    };
    
    // Calculate distribution percentages
    const totalUsage = 
      usage.text.reduce((sum, c) => sum + c.count, 0) +
      usage.background.reduce((sum, c) => sum + c.count, 0) +
      usage.border.reduce((sum, c) => sum + c.count, 0) +
      usage.accent.reduce((sum, c) => sum + c.count, 0);
    
    const distribution = {
      text: {
        count: usage.text.length,
        total: usage.text.reduce((sum, c) => sum + c.count, 0),
        percentage: totalUsage > 0 ? roundTo((usage.text.reduce((sum, c) => sum + c.count, 0) / totalUsage) * 100, 0) : 0
      },
      background: {
        count: usage.background.length,
        total: usage.background.reduce((sum, c) => sum + c.count, 0),
        percentage: totalUsage > 0 ? roundTo((usage.background.reduce((sum, c) => sum + c.count, 0) / totalUsage) * 100, 0) : 0
      },
      border: {
        count: usage.border.length,
        total: usage.border.reduce((sum, c) => sum + c.count, 0),
        percentage: totalUsage > 0 ? roundTo((usage.border.reduce((sum, c) => sum + c.count, 0) / totalUsage) * 100, 0) : 0
      },
      accent: {
        count: usage.accent.length,
        total: usage.accent.reduce((sum, c) => sum + c.count, 0),
        percentage: totalUsage > 0 ? roundTo((usage.accent.reduce((sum, c) => sum + c.count, 0) / totalUsage) * 100, 0) : 0
      }
    };
    
    // Top colors by category
    const topColors = {
      text: usage.text.slice(0, 5),
      background: usage.background.slice(0, 5),
      border: usage.border.slice(0, 5),
      accent: usage.accent.slice(0, 5)
    };
    
    return {
      distribution,
      topColors,
      totalUsage,
      uniqueColors: {
        text: usage.text.length,
        background: usage.background.length,
        border: usage.border.length,
        accent: usage.accent.length,
        total: new Set([
          ...usage.text.map(c => c.color),
          ...usage.background.map(c => c.color),
          ...usage.border.map(c => c.color),
          ...usage.accent.map(c => c.color)
        ]).size
      }
    };
  }

  // Analyze color harmony (complementary, analogous, triadic patterns)
  analyzeColorHarmony(colors) {
    const parsed = colors.map(c => this.parseColor(c)).filter(c => c !== null);
    if (parsed.length === 0) return { harmonyType: 'unknown', score: 50 };
    
    // Get unique hues (excluding very dark/light colors)
    const significantColors = parsed.filter(c => c.s > 15 && c.l > 10 && c.l < 90);
    const hues = significantColors.map(c => c.h);
    const uniqueHues = [...new Set(hues.map(h => Math.round(h / 30) * 30))]; // Group by 30-degree ranges
    
    // Determine primary colors (most saturated, most used)
    const primaryColors = significantColors
      .sort((a, b) => b.s - a.s)
      .slice(0, 5);
    
    // Check for harmony patterns
    let harmonyType = 'custom';
    let harmonyScore = 70;
    
    if (uniqueHues.length <= 2) {
      harmonyType = 'monochromatic';
      harmonyScore = 95;
    } else if (uniqueHues.length === 3) {
      // Check for triadic (120° apart)
      const sorted = uniqueHues.sort((a, b) => a - b);
      const diff1 = sorted[1] - sorted[0];
      const diff2 = sorted[2] - sorted[1];
      if (Math.abs(diff1 - 120) < 30 && Math.abs(diff2 - 120) < 30) {
        harmonyType = 'triadic';
        harmonyScore = 85;
      } else {
        harmonyType = 'analogous';
        harmonyScore = 80;
      }
    } else if (uniqueHues.length <= 5) {
      harmonyType = 'split-complementary';
      harmonyScore = 75;
    } else {
      harmonyType = 'diverse';
      harmonyScore = 50;
    }
    
    // Check for neutral balance
    const neutrals = parsed.filter(c => c.s < 15).length;
    const neutralRatio = neutrals / parsed.length;
    const hasGoodNeutralBalance = neutralRatio >= 0.3 && neutralRatio <= 0.7;
    
    return {
      harmonyType,
      harmonyScore,
      uniqueHueCount: uniqueHues.length,
      primaryColors: primaryColors.slice(0, 3).map(c => c.raw),
      neutralRatio: roundTo(neutralRatio * 100, 0),
      hasGoodNeutralBalance,
      totalColors: colors.length,
      significantColors: significantColors.length
    };
  }

  // Analyze typography hierarchy and pairing
  analyzeTypography(brand) {
    const fonts = brand.fonts || [];
    const headingFonts = brand.headingFonts || [];
    const bodyFonts = brand.bodyFonts || [];
    
    const fontCount = fonts.length;
    const hasTypographyHierarchy = headingFonts.length > 0 && bodyFonts.length > 0;
    const headingBodyDifferent = headingFonts.length > 0 && bodyFonts.length > 0 && 
      !headingFonts.some(h => bodyFonts.includes(h));
    
    // Check for system fonts (good for performance)
    const systemFonts = ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Arial', 'Helvetica'];
    const usesSystemFonts = fonts.some(f => systemFonts.some(sf => f.font?.toLowerCase().includes(sf.toLowerCase())));
    
    // Calculate typography score
    let typographyScore = 50;
    if (fontCount <= 2) typographyScore += 30;
    else if (fontCount <= 3) typographyScore += 20;
    else if (fontCount <= 4) typographyScore += 10;
    else typographyScore -= 10;
    
    if (hasTypographyHierarchy) typographyScore += 10;
    if (headingBodyDifferent) typographyScore += 10;
    
    // Classify font quality
    let fontQuality = 'poor';
    if (typographyScore >= 80) fontQuality = 'excellent';
    else if (typographyScore >= 60) fontQuality = 'good';
    else if (typographyScore >= 40) fontQuality = 'fair';
    
    return {
      fontCount,
      topFonts: fonts.slice(0, 5),
      headingFonts,
      bodyFonts,
      hasTypographyHierarchy,
      headingBodyDifferent,
      usesSystemFonts,
      typographyScore: Math.min(100, Math.max(0, typographyScore)),
      fontQuality
    };
  }

  analyzeConsistency(brand) {
    const colorCount = brand.colors?.length || 0;
    const fontCount = brand.fonts?.length || 0;
    
    return {
      colorCount,
      colorConsistency: colorCount <= 10 ? 'Excellent' : colorCount <= 20 ? 'Good' : colorCount <= 35 ? 'Fair' : 'Poor',
      fontCount,
      fontConsistency: fontCount <= 2 ? 'Excellent' : fontCount <= 3 ? 'Good' : fontCount <= 5 ? 'Fair' : 'Poor',
      hasLogo: (brand.logos?.length || 0) > 0,
      logoCount: brand.logos?.length || 0,
      hasFavicon: brand.hasFavicon || false,
      buttonStyleConsistency: this.checkButtonConsistency(brand.buttonStyles || []),
      linkColorConsistency: this.checkLinkConsistency(brand.linkColors || [])
    };
  }

  checkButtonConsistency(buttonStyles) {
    if (buttonStyles.length < 2) return 'N/A';
    
    const bgColors = new Set(buttonStyles.map(b => b.backgroundColor));
    const borderRadii = new Set(buttonStyles.map(b => b.borderRadius));
    
    if (bgColors.size <= 2 && borderRadii.size <= 2) return 'Excellent';
    if (bgColors.size <= 3 && borderRadii.size <= 3) return 'Good';
    return 'Poor';
  }

  checkLinkConsistency(linkColors) {
    if (linkColors.length < 2) return 'N/A';
    const uniqueColors = new Set(linkColors);
    if (uniqueColors.size === 1) return 'Excellent';
    if (uniqueColors.size <= 2) return 'Good';
    return 'Poor';
  }

  calculateBrandScore(consistency, colorAnalysis, typographyAnalysis, crossPageConsistency = null) {
    let score = 0;
    
    // Color score (30 points max)
    if (consistency.colorCount <= 10) score += 20;
    else if (consistency.colorCount <= 20) score += 15;
    else if (consistency.colorCount <= 35) score += 8;
    
    // Color harmony bonus (10 points)
    score += roundTo((colorAnalysis?.harmonyScore || 50) / 10, 0);
    
    // Typography score (25 points max)
    if (consistency.fontCount <= 2) score += 25;
    else if (consistency.fontCount <= 3) score += 20;
    else if (consistency.fontCount <= 5) score += 10;
    
    // Logo & brand identity (20 points)
    if (consistency.hasLogo) score += 15;
    if (consistency.hasFavicon) score += 5;
    
    // UI consistency (15 points)
    if (consistency.buttonStyleConsistency === 'Excellent') score += 10;
    else if (consistency.buttonStyleConsistency === 'Good') score += 5;
    
    if (consistency.linkColorConsistency === 'Excellent') score += 5;
    else if (consistency.linkColorConsistency === 'Good') score += 3;
    
    // Cross-page consistency bonus (10 points) - only for multi-page mode
    if (crossPageConsistency && crossPageConsistency.score !== undefined) {
      score += roundTo(crossPageConsistency.score / 10, 0);
    }
    
    return Math.min(100, Math.max(0, score));
  }

  getScoreBreakdown(consistency, colorAnalysis, typographyAnalysis, crossPageConsistency = null) {
    const breakdown = {
      colorPalette: {
        score: consistency.colorCount <= 10 ? 30 : consistency.colorCount <= 20 ? 20 : 10,
        maxScore: 30,
        detail: `${consistency.colorCount} colors detected`
      },
      typography: {
        score: consistency.fontCount <= 2 ? 25 : consistency.fontCount <= 3 ? 20 : 10,
        maxScore: 25,
        detail: `${consistency.fontCount} fonts detected`
      },
      brandIdentity: {
        score: (consistency.hasLogo ? 15 : 0) + (consistency.hasFavicon ? 5 : 0),
        maxScore: 20,
        detail: `Logo: ${consistency.hasLogo ? 'Yes' : 'No'}, Favicon: ${consistency.hasFavicon ? 'Yes' : 'No'}`
      },
      uiConsistency: {
        score: (consistency.buttonStyleConsistency === 'Excellent' ? 10 : 5) + 
               (consistency.linkColorConsistency === 'Excellent' ? 5 : 2),
        maxScore: 15,
        detail: `Buttons: ${consistency.buttonStyleConsistency}, Links: ${consistency.linkColorConsistency}`
      },
      colorHarmony: {
        score: roundTo((colorAnalysis?.harmonyScore || 50) / 10, 0),
        maxScore: 10,
        detail: `${colorAnalysis?.harmonyType || 'Unknown'} palette`
      }
    };

    // Add cross-page consistency breakdown if multi-page
    if (crossPageConsistency && crossPageConsistency.score !== undefined) {
      breakdown.crossPageConsistency = {
        score: roundTo(crossPageConsistency.score / 10, 0),
        maxScore: 10,
        detail: `${crossPageConsistency.pagesAnalyzed || 0} pages analyzed, ${crossPageConsistency.issues?.length || 0} inconsistencies`
      };
    }
    
    return breakdown;
  }

  generateRecommendations(consistency, colorAnalysis, typographyAnalysis, brandElements, contrastAnalysis, hierarchyAnalysis, crossPageConsistency = null) {
    const recs = [];
    
    // Cross-page consistency recommendations (priority for multi-page mode)
    if (crossPageConsistency && crossPageConsistency.issues?.length > 0) {
      crossPageConsistency.issues.forEach(issue => {
        if (issue.type === 'colorVariation' && issue.severity === 'high') {
          recs.push({
            priority: 'high',
            category: 'crossPage',
            type: 'colorVariationHigh',
            params: { details: issue.details }
          });
        } else if (issue.type === 'colorVariation' && issue.severity === 'medium') {
          recs.push({
            priority: 'medium',
            category: 'crossPage',
            type: 'colorVariationMedium',
            params: { details: issue.details }
          });
        } else if (issue.type === 'fontVariation') {
          recs.push({
            priority: 'high',
            category: 'crossPage',
            type: 'fontVariation',
            params: { details: issue.details }
          });
        } else if (issue.type === 'logoInconsistency') {
          recs.push({
            priority: 'medium',
            category: 'crossPage',
            type: 'logoInconsistency',
            params: { message: issue.message }
          });
        } else if (issue.type === 'buttonStyleVariation') {
          recs.push({
            priority: 'medium',
            category: 'crossPage',
            type: 'buttonStyleVariation',
            params: { colorCount: issue.details?.length || 0 }
          });
        }
      });
    }
    
    // Color recommendations - use type + params for i18n on frontend
    if (consistency.colorCount > 35) {
      recs.push({
        priority: 'critical',
        category: 'colors',
        type: 'excessiveColors',
        params: { count: consistency.colorCount }
      });
    } else if (consistency.colorCount > 20) {
      recs.push({
        priority: 'high',
        category: 'colors',
        type: 'tooManyColors',
        params: { count: consistency.colorCount }
      });
    }
    
    // Color harmony recommendations
    if (colorAnalysis?.harmonyType === 'diverse') {
      recs.push({
        priority: 'medium',
        category: 'colors',
        type: 'inconsistentHarmony',
        params: {}
      });
    }
    
    // Color contrast accessibility recommendations
    if (contrastAnalysis?.summary) {
      const { complianceRate, failAA } = contrastAnalysis.summary;
      if (complianceRate < 50) {
        recs.push({
          priority: 'critical',
          category: 'accessibility',
          type: 'poorContrast',
          params: { complianceRate, failCount: failAA }
        });
      } else if (complianceRate < 80) {
        recs.push({
          priority: 'high',
          category: 'accessibility',
          type: 'lowContrast',
          params: { complianceRate, failCount: failAA }
        });
      }
    }
    
    // Visual hierarchy recommendations
    if (hierarchyAnalysis?.issues) {
      hierarchyAnalysis.issues.forEach(issue => {
        if (issue.type === 'sizeNotProgressive') {
          recs.push({
            priority: 'medium',
            category: 'hierarchy',
            type: 'headingSizeNotProgressive',
            params: { from: issue.from, to: issue.to, fromSize: issue.fromSize, toSize: issue.toSize }
          });
        } else if (issue.type === 'h1TooSmall') {
          recs.push({
            priority: 'medium',
            category: 'hierarchy',
            type: 'h1TooSmall',
            params: { ratio: issue.ratio }
          });
        } else if (issue.type === 'inconsistentHeadingFonts') {
          recs.push({
            priority: 'low',
            category: 'hierarchy',
            type: 'inconsistentHeadingFonts',
            params: { count: issue.count }
          });
        }
      });
    }
    
    // Brand assets recommendations
    if (brandElements?.brandAssets) {
      const assets = brandElements.brandAssets;
      if (!assets.ogImage) {
        recs.push({
          priority: 'high',
          category: 'identity',
          type: 'noOgImage',
          params: {}
        });
      }
      if (!assets.twitterImage && !assets.twitterCard) {
        recs.push({
          priority: 'medium',
          category: 'identity',
          type: 'noTwitterCard',
          params: {}
        });
      }
      if (!assets.appleTouchIcon && !assets.appleTouchIconPrecomposed) {
        recs.push({
          priority: 'low',
          category: 'identity',
          type: 'noAppleTouchIcon',
          params: {}
        });
      }
    }
    
    // Typography recommendations
    if (consistency.fontCount > 5) {
      recs.push({
        priority: 'critical',
        category: 'typography',
        type: 'tooManyFonts',
        params: { count: consistency.fontCount }
      });
    } else if (consistency.fontCount > 3) {
      recs.push({
        priority: 'high',
        category: 'typography',
        type: 'reduceFontCount',
        params: { count: consistency.fontCount }
      });
    }
    
    if (typographyAnalysis && !typographyAnalysis.hasTypographyHierarchy) {
      recs.push({
        priority: 'medium',
        category: 'typography',
        type: 'noTypographyHierarchy',
        params: {}
      });
    }
    
    // Logo recommendations
    if (!consistency.hasLogo) {
      recs.push({
        priority: 'critical',
        category: 'identity',
        type: 'noLogo',
        params: {}
      });
    }
    
    if (!consistency.hasFavicon) {
      recs.push({
        priority: 'medium',
        category: 'identity',
        type: 'noFavicon',
        params: {}
      });
    }
    
    // UI consistency recommendations
    if (consistency.buttonStyleConsistency === 'Poor') {
      recs.push({
        priority: 'high',
        category: 'ui',
        type: 'inconsistentButtons',
        params: {}
      });
    }
    
    if (consistency.linkColorConsistency === 'Poor') {
      recs.push({
        priority: 'medium',
        category: 'ui',
        type: 'inconsistentLinks',
        params: {}
      });
    }
    
    // Add positive feedback if score is good
    if (recs.length === 0) {
      recs.push({
        priority: 'success',
        category: 'overall',
        type: 'excellent',
        params: {}
      });
    }
    
    return recs;
  }

  getGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }
}

module.exports = new BrandConsistencyService();
