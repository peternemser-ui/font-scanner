/**
 * Application configuration
 * Centralizes all environment variables and default values
 */

const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'INFO',

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },

  // Security
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },

  // Puppeteer
  puppeteer: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    timeout: parseInt(process.env.PUPPETEER_TIMEOUT || '30000', 10),
  },

  // Browser Pool
  browserPool: {
    min: parseInt(process.env.BROWSER_POOL_MIN || '1', 10),
    max: parseInt(process.env.BROWSER_POOL_MAX || '5', 10),
    idleTimeout: parseInt(process.env.BROWSER_POOL_IDLE_TIMEOUT || '300000', 10), // 5 minutes
    acquireTimeout: parseInt(process.env.BROWSER_POOL_ACQUIRE_TIMEOUT || '30000', 10), // 30 seconds
  },

  // Reports
  reports: {
    dir: process.env.REPORTS_DIR || './reports',
    retentionDays: parseInt(process.env.REPORTS_RETENTION_DAYS || '7', 10),
  },

  // Performance
  performance: {
    maxPagesToScan: parseInt(process.env.MAX_PAGES_TO_SCAN || '10', 10),
    scanTimeout: parseInt(process.env.SCAN_TIMEOUT || '60000', 10),
  },
};

module.exports = config;
