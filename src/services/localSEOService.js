/**
 * Local SEO Analyzer
 * Checks Google Business, NAP consistency, local schema
 */

const browserPool = require('../utils/browserPool');
const { createLogger } = require('../utils/logger');

const logger = createLogger('LocalSEOService');

class LocalSEOService {
  async analyzeLocalSEO(url) {
    logger.info(`Starting local SEO analysis for: ${url}`);
    const startTime = Date.now();

    try {
      const results = await browserPool.execute(async (browser) => {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
        
        const analysis = await page.evaluate(() => {
          // NAP (Name, Address, Phone) detection
          const text = document.body.textContent;
          const phoneRegex = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
          const phones = text.match(phoneRegex) || [];
          
          // Check for address keywords
          const addressKeywords = ['street', 'avenue', 'road', 'boulevard', 'suite', 'floor', 'city', 'state', 'zip'];
          const hasAddress = addressKeywords.some(kw => text.toLowerCase().includes(kw));
          
          // Local schema detection
          const schemas = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
          const localSchema = schemas.some(s => {
            try {
              const data = JSON.parse(s.textContent);
              return data['@type'] === 'LocalBusiness' || data['@type'] === 'Organization';
            } catch (e) {
              return false;
            }
          });
          
          // Check for local keywords
          const localKeywords = ['near me', 'in', 'local', 'nearby', 'area'];
          const title = document.title.toLowerCase();
          const hasLocalKeywords = localKeywords.some(kw => title.includes(kw));
          
          return {
            nap: {
              phoneCount: phones.length,
              hasAddress,
              phones: phones.slice(0, 3)
            },
            schema: {
              hasLocalBusinessSchema: localSchema
            },
            keywords: {
              hasLocalKeywords
            }
          };
        });
        
        await page.close();
        return analysis;
      });
      
      const score = this.calculateScore(results);
      
      return {
        url,
        timestamp: new Date().toISOString(),
        analysis: results,
        score,
        grade: this.getGrade(score),
        recommendations: this.generateRecommendations(results),
        analysisTime: ((Date.now() - startTime) / 1000).toFixed(2)
      };
      
    } catch (error) {
      logger.error('Local SEO analysis failed:', error);
      throw new Error(`Local SEO analysis failed: ${error.message}`);
    }
  }

  calculateScore(analysis) {
    let score = 0;
    
    if (analysis.nap.phoneCount > 0) score += 30;
    if (analysis.nap.hasAddress) score += 30;
    if (analysis.schema.hasLocalBusinessSchema) score += 40;
    
    return score;
  }

  generateRecommendations(analysis) {
    const recs = [];
    
    if (analysis.nap.phoneCount === 0) {
      recs.push({
        priority: 'critical',
        message: 'Add phone number',
        detail: 'Display your business phone number prominently for local customers.'
      });
    }
    
    if (!analysis.nap.hasAddress) {
      recs.push({
        priority: 'critical',
        message: 'Add business address',
        detail: 'Include your full business address for local SEO.'
      });
    }
    
    if (!analysis.schema.hasLocalBusinessSchema) {
      recs.push({
        priority: 'high',
        message: 'Add LocalBusiness schema',
        detail: 'Implement LocalBusiness structured data to help Google understand your location.'
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
