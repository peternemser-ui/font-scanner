const simpleAnalyzer = require('./simpleAnalyzer');
const { createLogger } = require('../utils/logger');

const logger = createLogger('FallbackScannerService');

class FallbackScannerService {
  async scanWebsite(url) {
    logger.info(`Fallback scanner: analyzing ${url}`);

    try {
      // Use simple HTTP-based analysis as fallback
      const results = await simpleAnalyzer.analyzeUrl(url);

      return {
        fonts: results.fonts || {
          totalFonts: 0,
          fonts: [],
          categorizedFonts: { system: [], webFonts: [], googleFonts: [], customFonts: [] },
        },
        performance: results.performance || { initialLoadTime: 0 },
        bestPractices: results.bestPractices || { score: 0, recommendations: [] },
        screenshot: null,
        metadata: {
          scannedUrl: url,
          method: 'fallback',
          userAgent: 'Font Scanner Fallback',
          loadTime: results.loadTime || 0,
        },
      };
    } catch (error) {
      logger.error('Fallback scanner error:', error);
      throw error;
    }
  }
}

module.exports = new FallbackScannerService();
