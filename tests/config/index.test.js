const config = require('../../src/config');

describe('Config', () => {
  it('should have default port', () => {
    expect(config.port).toBeDefined();
    expect(typeof config.port).toBe('number');
  });

  it('should have node environment', () => {
    expect(config.nodeEnv).toBeDefined();
    expect(typeof config.nodeEnv).toBe('string');
  });

  it('should have rate limit configuration', () => {
    expect(config.rateLimit).toBeDefined();
    expect(config.rateLimit.windowMs).toBeDefined();
    expect(config.rateLimit.maxRequests).toBeDefined();
  });

  it('should have puppeteer configuration', () => {
    expect(config.puppeteer).toBeDefined();
    expect(typeof config.puppeteer.headless).toBe('boolean');
    expect(typeof config.puppeteer.timeout).toBe('number');
  });

  it('should have reports configuration', () => {
    expect(config.reports).toBeDefined();
    expect(config.reports.dir).toBeDefined();
    expect(config.reports.retentionDays).toBeDefined();
  });

  it('should have performance configuration', () => {
    expect(config.performance).toBeDefined();
    expect(config.performance.maxPagesToScan).toBeDefined();
    expect(config.performance.scanTimeout).toBeDefined();
  });
});
