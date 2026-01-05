/**
 * Brand Consistency Checker (Best-in-Class)
 * Analyzes color palette, fonts, logo usage, and brand cohesion
 * Features: Color harmony analysis, typography pairing, visual consistency scoring
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

const logger = createLogger('BrandConsistencyService');

class BrandConsistencyService {
  async analyzeBrand(url) {
    logger.info(`Starting brand analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        
        // Set up stealth mode to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        });
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Try different wait strategies with increasing aggressiveness
        let navigationSucceeded = false;
        const waitStrategies = [
          { waitUntil: 'domcontentloaded', timeout: 15000 },
          { waitUntil: 'load', timeout: 20000 },
          { waitUntil: 'networkidle2', timeout: 30000 }
        ];
        
        for (const strategy of waitStrategies) {
          try {
            await page.goto(url, strategy);
            navigationSucceeded = true;
            logger.info(`Navigation succeeded with strategy: ${strategy.waitUntil}`);
            break;
          } catch (navError) {
            logger.warn(`Navigation with ${strategy.waitUntil} failed, trying next strategy`);
          }
        }
        
        if (!navigationSucceeded) {
          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            navigationSucceeded = true;
          } catch (finalError) {
            await page.close();
            throw new Error(`Could not load page: ${finalError.message}`);
          }
        }
        
        // Wait for JS rendering
        await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));
        
        const analysis = await page.evaluate(() => {
          const colorData = [];
          const colorSet = new Set();
          const elements = document.querySelectorAll('*');
          
          // Track color usage by type (text, background, accent)
          const colorUsage = { text: {}, background: {}, border: {}, accent: {} };
          
          elements.forEach(el => {
            const styles = window.getComputedStyle(el);
            const tagName = el.tagName.toLowerCase();
            
            // Text color
            const textColor = styles.color;
            if (textColor && textColor !== 'rgba(0, 0, 0, 0)') {
              colorSet.add(textColor);
              colorUsage.text[textColor] = (colorUsage.text[textColor] || 0) + 1;
            }
            
            // Background color
            const bgColor = styles.backgroundColor;
            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
              colorSet.add(bgColor);
              colorUsage.background[bgColor] = (colorUsage.background[bgColor] || 0) + 1;
            }
            
            // Border color (accents)
            const borderColor = styles.borderColor;
            if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
              colorSet.add(borderColor);
              colorUsage.border[borderColor] = (colorUsage.border[borderColor] || 0) + 1;
            }
            
            // Detect accent colors (buttons, links, focused elements)
            if (['a', 'button', 'input[type="submit"]'].includes(tagName) || 
                el.classList.contains('btn') || el.classList.contains('button')) {
              if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
                colorUsage.accent[bgColor] = (colorUsage.accent[bgColor] || 0) + 1;
              }
            }
          });
          
          // Extract fonts with usage context
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
          
          // Detect logos with more patterns
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
          
          // Detect favicon
          const favicon = document.querySelector('link[rel*="icon"]');
          
          // Get button styles
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
          
          // Get link styles
          const links = Array.from(document.querySelectorAll('a')).slice(0, 20);
          const linkColors = links.map(link => window.getComputedStyle(link).color).filter(c => c);
          
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
            linkColors: [...new Set(linkColors)]
          };
        });
        
        await page.close();
        return analysis;
      });
      
      // Enhanced consistency analysis
      const consistency = this.analyzeConsistency(results);
      const colorAnalysis = this.analyzeColorHarmony(results.colors);
      const typographyAnalysis = this.analyzeTypography(results);
      const score = this.calculateBrandScore(consistency, colorAnalysis, typographyAnalysis);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        brandElements: results,
        consistency,
        colorAnalysis,
        typographyAnalysis,
        score,
        scoreBreakdown: this.getScoreBreakdown(consistency, colorAnalysis, typographyAnalysis),
        grade: this.getGrade(score),
        recommendations: this.generateRecommendations(consistency, colorAnalysis, typographyAnalysis, results),
        analysisTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };
      
    } catch (error) {
      logger.error('Brand analysis failed:', error);
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
    
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100), raw: colorStr };
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
      neutralRatio: Math.round(neutralRatio * 100),
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

  calculateBrandScore(consistency, colorAnalysis, typographyAnalysis) {
    let score = 0;
    
    // Color score (30 points max)
    if (consistency.colorCount <= 10) score += 20;
    else if (consistency.colorCount <= 20) score += 15;
    else if (consistency.colorCount <= 35) score += 8;
    
    // Color harmony bonus (10 points)
    score += Math.round((colorAnalysis?.harmonyScore || 50) / 10);
    
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
    
    return Math.min(100, Math.max(0, score));
  }

  getScoreBreakdown(consistency, colorAnalysis, typographyAnalysis) {
    return {
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
        score: Math.round((colorAnalysis?.harmonyScore || 50) / 10),
        maxScore: 10,
        detail: `${colorAnalysis?.harmonyType || 'Unknown'} palette`
      }
    };
  }

  generateRecommendations(consistency, colorAnalysis, typographyAnalysis, brandElements) {
    const recs = [];
    
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
