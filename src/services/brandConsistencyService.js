/**
 * Brand Consistency Checker
 * Analyzes color palette, fonts, logo usage
 * Target: $150-300 per brand audit
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
        await page.setViewport({ width: 1920, height: 1080 });
        
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        const analysis = await page.evaluate(() => {
          // Extract all colors
          const colorSet = new Set();
          const elements = document.querySelectorAll('*');
          elements.forEach(el => {
            const styles = window.getComputedStyle(el);
            [styles.color, styles.backgroundColor, styles.borderColor].forEach(color => {
              if (color && color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
                colorSet.add(color);
              }
            });
          });
          
          // Extract all fonts
          const fontSet = new Set();
          elements.forEach(el => {
            const font = window.getComputedStyle(el).fontFamily;
            if (font) fontSet.add(font.split(',')[0].replace(/['"]/g, '').trim());
          });
          
          // Detect logos
          const logos = Array.from(document.querySelectorAll('img')).filter(img => {
            const alt = img.alt.toLowerCase();
            const src = img.src.toLowerCase();
            return alt.includes('logo') || src.includes('logo') || img.className.toLowerCase().includes('logo');
          });
          
          return {
            colors: Array.from(colorSet).slice(0, 50),
            fonts: Array.from(fontSet),
            logos: logos.map(l => ({ src: l.src, alt: l.alt, width: l.width, height: l.height }))
          };
        });
        
        await page.close();
        return analysis;
      });
      
      // Analyze consistency
      const consistency = this.analyzeConsistency(results);
      const score = this.calculateBrandScore(consistency);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        brandElements: results,
        consistency,
        score,
        grade: this.getGrade(score),
        recommendations: this.generateRecommendations(consistency),
        analysisTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };
      
    } catch (error) {
      logger.error('Brand analysis failed:', error);
      throw new Error(`Brand analysis failed: ${error.message}`);
    }
  }

  analyzeConsistency(brand) {
    return {
      colorCount: brand.colors.length,
      colorConsistency: brand.colors.length <= 10 ? 'Good' : brand.colors.length <= 20 ? 'Fair' : 'Poor',
      fontCount: brand.fonts.length,
      fontConsistency: brand.fonts.length <= 3 ? 'Excellent' : brand.fonts.length <= 5 ? 'Good' : 'Poor',
      hasLogo: brand.logos.length > 0,
      logoCount: brand.logos.length
    };
  }

  calculateBrandScore(consistency) {
    let score = 0;
    
    if (consistency.colorCount <= 10) score += 30;
    else if (consistency.colorCount <= 20) score += 15;
    
    if (consistency.fontCount <= 3) score += 40;
    else if (consistency.fontCount <= 5) score += 20;
    
    if (consistency.hasLogo) score += 30;
    
    return Math.min(100, score);
  }

  generateRecommendations(consistency) {
    const recs = [];
    
    if (consistency.colorCount > 20) {
      recs.push({
        priority: 'high',
        message: 'Too many colors',
        detail: `Using ${consistency.colorCount} colors. Limit to 5-10 brand colors for consistency.`
      });
    }
    
    if (consistency.fontCount > 5) {
      recs.push({
        priority: 'high',
        message: 'Too many fonts',
        detail: `Using ${consistency.fontCount} different fonts. Limit to 2-3 fonts maximum.`
      });
    }
    
    if (!consistency.hasLogo) {
      recs.push({
        priority: 'critical',
        message: 'No logo detected',
        detail: 'Add a logo to strengthen brand identity.'
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

module.exports = new BrandConsistencyService();
