/**
 * Rate Limiter Middleware Tests
 * Tests rate limiter configuration and analytics functions
 */

const { getRateLimitStats, getRateLimitAnalytics } = require('../../src/middleware/rateLimiter');

describe('Rate Limiting Configuration', () => {
  
  describe('getRateLimitStats', () => {
    it('should return rate limit configuration with tiers and windows', () => {
      const stats = getRateLimitStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('tiers');
      expect(stats).toHaveProperty('windows');
      expect(stats.tiers).toHaveProperty('global');
      expect(stats.tiers).toHaveProperty('scan');
      expect(stats.tiers).toHaveProperty('download');
    });

    it('should have tiered global limits (anon/free/pro)', () => {
      const stats = getRateLimitStats();

      expect(stats.windows.global).toBeDefined();
      expect(stats.tiers.global).toHaveProperty('anon');
      expect(stats.tiers.global).toHaveProperty('free');
      expect(stats.tiers.global).toHaveProperty('pro');
    });

    it('should have tiered scan limits (anon/free/pro)', () => {
      const stats = getRateLimitStats();

      expect(stats.windows.scan).toBeDefined();
      expect(stats.tiers.scan).toHaveProperty('anon');
      expect(stats.tiers.scan).toHaveProperty('free');
      expect(stats.tiers.scan).toHaveProperty('pro');
    });

    it('should have tiered download limits (anon/free/pro)', () => {
      const stats = getRateLimitStats();

      expect(stats.windows.download).toBeDefined();
      expect(stats.tiers.download).toHaveProperty('anon');
      expect(stats.tiers.download).toHaveProperty('free');
      expect(stats.tiers.download).toHaveProperty('pro');
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

    it('should have valid configuration with tiers and windows', () => {
      const analytics = getRateLimitAnalytics();
      const config = analytics.configuration;

      expect(config).toBeDefined();
      expect(config).toHaveProperty('tiers');
      expect(config).toHaveProperty('windows');
      expect(config.tiers.global).toHaveProperty('anon');
      expect(config.tiers.scan).toHaveProperty('anon');
      expect(config.tiers.download).toHaveProperty('anon');
      expect(config.windows.global).toBeDefined();
      expect(config.windows.scan).toBeDefined();
      expect(config.windows.download).toBeDefined();
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

      // Check that tier limits exist and are numeric for each tier
      expect(typeof stats.tiers.global.anon).toBe('number');
      expect(typeof stats.tiers.scan.anon).toBe('number');
      expect(typeof stats.tiers.download.anon).toBe('number');

      // Check that windows are defined
      expect(stats.windows.global).toBeDefined();
      expect(stats.windows.scan).toBeDefined();
      expect(stats.windows.download).toBeDefined();
    });

    it('should have scan anon limit less than or equal to global anon limit', () => {
      const stats = getRateLimitStats();

      // In dev mode, limits may be -1 (unlimited), so skip comparison when both are -1
      if (stats.tiers.scan.anon === -1 && stats.tiers.global.anon === -1) return;
      // Scan operations are expensive, so limit should be lower
      expect(stats.tiers.scan.anon).toBeLessThanOrEqual(stats.tiers.global.anon);
    });

    it('should have download anon limit less than or equal to global anon limit', () => {
      const stats = getRateLimitStats();

      // In dev mode, limits may be -1 (unlimited), so skip comparison when both are -1
      if (stats.tiers.download.anon === -1 && stats.tiers.global.anon === -1) return;
      // Downloads should be limited, but less restrictive than scans
      expect(stats.tiers.download.anon).toBeLessThanOrEqual(stats.tiers.global.anon);
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
