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
    // Global rate limit (all endpoints)
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    
    // Scan endpoint rate limit (more restrictive)
    scanWindowMs: parseInt(process.env.SCAN_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    scanMaxRequests: parseInt(process.env.SCAN_RATE_LIMIT_MAX_REQUESTS || '20', 10),
    
    // Download endpoint rate limit
    downloadWindowMs: parseInt(process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    downloadMaxRequests: parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS || '50', 10),
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

  // Error Telemetry
  errorTelemetry: {
    enabled: process.env.ERROR_TELEMETRY_ENABLED !== 'false',
    maxErrors: parseInt(process.env.ERROR_TELEMETRY_MAX_ERRORS || '1000', 10),
    maxAggregations: parseInt(process.env.ERROR_TELEMETRY_MAX_AGGREGATIONS || '100', 10),
    retentionHours: parseInt(process.env.ERROR_TELEMETRY_RETENTION_HOURS || '24', 10),
    thresholds: {
      minute: parseInt(process.env.ERROR_TELEMETRY_THRESHOLD_MINUTE || '10', 10),
      hour: parseInt(process.env.ERROR_TELEMETRY_THRESHOLD_HOUR || '100', 10),
      day: parseInt(process.env.ERROR_TELEMETRY_THRESHOLD_DAY || '1000', 10),
    },
  },
};

module.exports = config;
