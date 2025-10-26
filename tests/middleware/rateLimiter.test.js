/**
 * Rate Limiter Middleware Tests
 * Tests rate limiter configuration and analytics functions
 */

const { getRateLimitStats, getRateLimitAnalytics } = require('../../src/middleware/rateLimiter');

describe('Rate Limiting Configuration', () => {
  
  describe('getRateLimitStats', () => {
    it('should return rate limit configuration', () => {
      const stats = getRateLimitStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('global');
      expect(stats).toHaveProperty('scan');
      expect(stats).toHaveProperty('download');
    });

    it('should have correct global limits', () => {
      const stats = getRateLimitStats();
      
      expect(stats.global.window).toBe('15 minutes');
      expect(stats.global.limit).toBe(100);
    });

    it('should have correct scan limits', () => {
      const stats = getRateLimitStats();
      
      expect(stats.scan.window).toBe('15 minutes');
      expect(stats.scan.limit).toBe(20);
    });

    it('should have correct download limits', () => {
      const stats = getRateLimitStats();
      
      expect(stats.download.window).toBe('15 minutes');
      expect(stats.download.limit).toBe(50);
    });
  });

  describe('getRateLimitAnalytics', () => {
    it('should return analytics object', () => {
      const analytics = getRateLimitAnalytics();
      
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('configuration');
      expect(analytics).toHaveProperty('statistics');
      expect(analytics).toHaveProperty('recentViolations');
      expect(analytics).toHaveProperty('timestamp');
    });

    it('should have valid configuration', () => {
      const analytics = getRateLimitAnalytics();
      const config = analytics.configuration;
      
      expect(config).toBeDefined();
      expect(config.global.limit).toBe(100);
      expect(config.scan.limit).toBe(20);
      expect(config.download.limit).toBe(50);
      expect(config.global.window).toBe('15 minutes');
      expect(config.scan.window).toBe('15 minutes');
      expect(config.download.window).toBe('15 minutes');
    });

    it('should have valid statistics structure', () => {
      const analytics = getRateLimitAnalytics();
      const stats = analytics.statistics;
      
      expect(stats).toBeDefined();
      expect(typeof stats.totalViolations).toBe('number');
      expect(typeof stats.lastHour).toBe('number');
      expect(typeof stats.last24Hours).toBe('number');
      expect(typeof stats.byLimiter).toBe('object');
      expect(Array.isArray(stats.topIPs)).toBe(true);
      
      // All counts should be non-negative
      expect(stats.totalViolations).toBeGreaterThanOrEqual(0);
      expect(stats.lastHour).toBeGreaterThanOrEqual(0);
      expect(stats.last24Hours).toBeGreaterThanOrEqual(0);
    });

    it('should have valid timestamp format', () => {
      const analytics = getRateLimitAnalytics();
      
      expect(typeof analytics.timestamp).toBe('string');
      // Should be ISO 8601 format
      expect(() => new Date(analytics.timestamp)).not.toThrow();
      expect(new Date(analytics.timestamp).toISOString()).toBe(analytics.timestamp);
    });

    it('should have empty or valid recentViolations array', () => {
      const analytics = getRateLimitAnalytics();
      
      expect(Array.isArray(analytics.recentViolations)).toBe(true);
      
      // If there are violations, they should have correct structure
      analytics.recentViolations.forEach(violation => {
        expect(violation).toHaveProperty('timestamp');
        expect(violation).toHaveProperty('ip');
        expect(violation).toHaveProperty('endpoint');
        expect(violation).toHaveProperty('limiter');
        expect(typeof violation.timestamp).toBe('string');
        expect(typeof violation.ip).toBe('string');
        expect(typeof violation.endpoint).toBe('string');
        expect(typeof violation.limiter).toBe('string');
      });
    });

    it('should respect time hierarchy in statistics', () => {
      const analytics = getRateLimitAnalytics();
      const stats = analytics.statistics;
      
      // last24Hours should always be >= lastHour
      expect(stats.last24Hours).toBeGreaterThanOrEqual(stats.lastHour);
      
      // totalViolations should be >= last24Hours
      expect(stats.totalViolations).toBeGreaterThanOrEqual(stats.last24Hours);
    });

    it('should have valid topIPs structure', () => {
      const analytics = getRateLimitAnalytics();
      const topIPs = analytics.statistics.topIPs;
      
      expect(Array.isArray(topIPs)).toBe(true);
      expect(topIPs.length).toBeLessThanOrEqual(10); // Max 10 IPs
      
      // If there are IPs, they should have correct structure
      topIPs.forEach(ipData => {
        expect(ipData).toHaveProperty('ip');
        expect(ipData).toHaveProperty('totalHits');
        expect(ipData).toHaveProperty('lastHit');
        expect(ipData).toHaveProperty('endpoints');
        expect(typeof ipData.ip).toBe('string');
        expect(typeof ipData.totalHits).toBe('number');
        expect(ipData.totalHits).toBeGreaterThan(0);
        expect(Array.isArray(ipData.endpoints)).toBe(true);
      });
    });

    it('should have byLimiter counts matching total', () => {
      const analytics = getRateLimitAnalytics();
      const stats = analytics.statistics;
      
      // Sum of all limiter counts should equal last24Hours
      const limiterSum = Object.values(stats.byLimiter).reduce((sum, count) => sum + count, 0);
      expect(limiterSum).toBe(stats.last24Hours);
    });
  });

  describe('Environment Variable Configuration', () => {
    it('should use default values when env vars not set', () => {
      // Assuming env vars are not set or using defaults
      const stats = getRateLimitStats();
      
      // Check that limits are numeric
      expect(typeof stats.global.limit).toBe('number');
      expect(typeof stats.scan.limit).toBe('number');
      expect(typeof stats.download.limit).toBe('number');
      
      // Check that they have reasonable values
      expect(stats.global.limit).toBeGreaterThan(0);
      expect(stats.scan.limit).toBeGreaterThan(0);
      expect(stats.download.limit).toBeGreaterThan(0);
    });

    it('should have scan limit less than or equal to global limit', () => {
      const stats = getRateLimitStats();
      
      // Scan operations are expensive, so limit should be lower
      expect(stats.scan.limit).toBeLessThanOrEqual(stats.global.limit);
    });

    it('should have download limit less than or equal to global limit', () => {
      const stats = getRateLimitStats();
      
      // Downloads should be limited, but less restrictive than scans
      expect(stats.download.limit).toBeLessThanOrEqual(stats.global.limit);
    });
  });

  describe('Analytics Data Consistency', () => {
    it('should return consistent results on multiple calls', () => {
      const analytics1 = getRateLimitAnalytics();
      const analytics2 = getRateLimitAnalytics();
      
      // Configuration should be identical
      expect(analytics1.configuration).toEqual(analytics2.configuration);
      
      // Statistics might change if violations occur between calls, but structure should be same
      expect(Object.keys(analytics1.statistics)).toEqual(Object.keys(analytics2.statistics));
      expect(Object.keys(analytics1)).toEqual(Object.keys(analytics2));
    });

    it('should maintain referential integrity', () => {
      const analytics = getRateLimitAnalytics();
      
      // If an IP appears in topIPs, its violations should be in the stats
      analytics.statistics.topIPs.forEach(ipData => {
        expect(ipData.totalHits).toBeGreaterThan(0);
        expect(ipData.lastHit).toBeTruthy();
        expect(ipData.endpoints.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Rate Limiter Exporters', () => {
  it('should export getRateLimitStats function', () => {
    expect(typeof getRateLimitStats).toBe('function');
  });

  it('should export getRateLimitAnalytics function', () => {
    expect(typeof getRateLimitAnalytics).toBe('function');
  });
});

// Note: Integration tests with supertest should be added separately
// to test actual HTTP endpoints and rate limiting behavior in practice
