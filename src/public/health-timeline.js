/**
 * Health Timeline System
 * Tracks scan history, visualizes trends, and compares performance over time
 */

class HealthTimeline {
  constructor() {
    this.storageKey = 'font_scanner_history';
    this.maxHistoryItems = 30; // Keep last 30 scans
    this.history = this.loadHistory();
    console.log('C HealthTimeline initialized with', this.history.length, 'historical scans');
  }

  /**
   * Load scan history from localStorage
   */
  loadHistory() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return [];
      
      const history = JSON.parse(stored);
      
      // Validate and clean up history
      return history
        .filter(item => item && item.timestamp && item.url)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, this.maxHistoryItems);
    } catch (error) {
      console.error('Error loading history:', error);
      return [];
    }
  }

  /**
   * Save scan history to localStorage
   */
  saveHistory() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
      console.log('✓ Saved history with', this.history.length, 'items');
    } catch (error) {
      console.error('Error saving history:', error);
      
      // If quota exceeded, remove oldest items
      if (error.name === 'QuotaExceededError') {
        this.history = this.history.slice(0, 10);
        this.saveHistory();
      }
    }
  }

  /**
   * Add a new scan result to history
   */
  addScan(url, results) {
    const scan = {
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      url: url,
      timestamp: Date.now(),
      scores: this.extractScores(results),
      metrics: this.extractMetrics(results)
    };

    // Remove duplicate scans (same URL within 5 minutes)
    this.history = this.history.filter(item => {
      const timeDiff = scan.timestamp - item.timestamp;
      const isSameUrl = item.url === url;
      return !(isSameUrl && timeDiff < 5 * 60 * 1000);
    });

    // Add new scan at the beginning
    this.history.unshift(scan);

    // Limit history size
    if (this.history.length > this.maxHistoryItems) {
      this.history = this.history.slice(0, this.maxHistoryItems);
    }

    this.saveHistory();
    console.log('✓ Added scan to history:', url);
    return scan;
  }

  /**
   * Extract key scores from scan results
   */
  extractScores(results) {
    const scores = {
      overall: 0,
      performance: 0,
      accessibility: 0,
      seo: 0,
      fonts: 0
    };

    try {
      // Overall score from executive summary
      if (results.executiveSummary?.overallScore) {
        scores.overall = results.executiveSummary.overallScore;
      }

      // Lighthouse scores
      if (results.lighthouse?.categories) {
        scores.performance = Math.round((results.lighthouse.categories.performance?.score || 0) * 100);
        scores.accessibility = Math.round((results.lighthouse.categories.accessibility?.score || 0) * 100);
        scores.seo = Math.round((results.lighthouse.categories.seo?.score || 0) * 100);
      }

      // Font score (custom calculation)
      if (results.fonts?.summary) {
        const fontData = results.fonts.summary;
        scores.fonts = this.calculateFontScore(fontData);
      }
    } catch (error) {
      console.error('Error extracting scores:', error);
    }

    return scores;
  }

  /**
   * Calculate font performance score
   */
  calculateFontScore(fontData) {
    let score = 100;

    // Penalize for too many fonts
    const fontCount = fontData.totalFonts || 0;
    if (fontCount > 10) score -= 20;
    else if (fontCount > 5) score -= 10;

    // Penalize for large font files
    const totalSize = fontData.totalSize || 0;
    if (totalSize > 500000) score -= 30;
    else if (totalSize > 200000) score -= 15;

    // Bonus for using system fonts
    if (fontData.systemFonts > 0) score += 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Extract key metrics from scan results
   */
  extractMetrics(results) {
    const metrics = {
      lcp: null,
      fid: null,
      cls: null,
      fcp: null,
      ttfb: null,
      totalSize: 0,
      requests: 0
    };

    try {
      // Core Web Vitals
      if (results.lighthouse?.audits) {
        const audits = results.lighthouse.audits;
        
        metrics.lcp = audits['largest-contentful-paint']?.numericValue || null;
        metrics.fid = audits['max-potential-fid']?.numericValue || null;
        metrics.cls = audits['cumulative-layout-shift']?.numericValue || null;
        metrics.fcp = audits['first-contentful-paint']?.numericValue || null;
        metrics.ttfb = audits['server-response-time']?.numericValue || null;
      }

      // Resource metrics
      if (results.fonts?.summary) {
        metrics.totalSize = results.fonts.summary.totalSize || 0;
        metrics.requests = results.fonts.summary.totalFonts || 0;
      }
    } catch (error) {
      console.error('Error extracting metrics:', error);
    }

    return metrics;
  }

  /**
   * Get scan history for a specific URL
   */
  getUrlHistory(url, limit = 10) {
    return this.history
      .filter(scan => scan.url === url)
      .slice(0, limit);
  }

  /**
   * Get all unique URLs in history
   */
  getUniqueUrls() {
    const urls = new Set();
    this.history.forEach(scan => urls.add(scan.url));
    return Array.from(urls);
  }

  /**
   * Get the previous scan for comparison
   */
  getPreviousScan(url) {
    const urlHistory = this.getUrlHistory(url, 2);
    return urlHistory.length >= 2 ? urlHistory[1] : null;
  }

  /**
   * Calculate improvement between two scans
   */
  calculateImprovement(current, previous) {
    if (!previous) return null;

    const improvements = {};

    // Compare scores
    for (const [key, currentValue] of Object.entries(current.scores)) {
      const previousValue = previous.scores[key];
      if (typeof currentValue === 'number' && typeof previousValue === 'number') {
        const diff = currentValue - previousValue;
        const percentChange = previousValue !== 0 
          ? ((diff / previousValue) * 100).toFixed(1)
          : 0;
        
        improvements[key] = {
          current: currentValue,
          previous: previousValue,
          diff: diff,
          percentChange: parseFloat(percentChange),
          improved: diff > 0
        };
      }
    }

    // Compare metrics
    for (const [key, currentValue] of Object.entries(current.metrics)) {
      const previousValue = previous.metrics[key];
      if (currentValue !== null && previousValue !== null) {
        const diff = currentValue - previousValue;
        const percentChange = previousValue !== 0
          ? ((diff / previousValue) * 100).toFixed(1)
          : 0;
        
        improvements[`metric_${key}`] = {
          current: currentValue,
          previous: previousValue,
          diff: diff,
          percentChange: parseFloat(percentChange),
          improved: diff < 0 // Lower is better for metrics like LCP
        };
      }
    }

    return improvements;
  }

  /**
   * Clear all history
   */
  clearHistory() {
    this.history = [];
    this.saveHistory();
    console.log('🗑️ History cleared');
  }

  /**
   * Export history as JSON
   */
  exportHistory() {
    return JSON.stringify(this.history, null, 2);
  }

  /**
   * Import history from JSON
   */
  importHistory(jsonData) {
    try {
      const imported = JSON.parse(jsonData);
      if (Array.isArray(imported)) {
        this.history = imported;
        this.saveHistory();
        console.log('✓ Imported', this.history.length, 'scans');
        return true;
      }
    } catch (error) {
      console.error('Error importing history:', error);
    }
    return false;
  }
}

// Create singleton instance
const healthTimeline = new HealthTimeline();

// Export for use in other scripts (both browser and Node.js)
if (typeof window !== 'undefined') {
  window.healthTimeline = healthTimeline;
  window.HealthTimeline = HealthTimeline;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HealthTimeline, healthTimeline };
}
