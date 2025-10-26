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

  // Competitive Analysis (Resource-intensive operations)
  competitiveAnalysis: {
    // Maximum number of competitors to analyze per request
    maxCompetitors: parseInt(process.env.COMPETITIVE_MAX_COMPETITORS || '5', 10),
    
    // Timeout for individual analyzers (ms)
    analyzerTimeouts: {
      seo: parseInt(process.env.COMPETITIVE_SEO_TIMEOUT || '30000', 10), // 30s
      security: parseInt(process.env.COMPETITIVE_SECURITY_TIMEOUT || '30000', 10), // 30s
      accessibility: parseInt(process.env.COMPETITIVE_A11Y_TIMEOUT || '45000', 10), // 45s
      coreWebVitals: parseInt(process.env.COMPETITIVE_CWV_TIMEOUT || '60000', 10), // 60s
      performance: parseInt(process.env.COMPETITIVE_PERF_TIMEOUT || '90000', 10), // 90s
    },
    
    // Delays between operations (ms)
    delays: {
      betweenAnalyzers: parseInt(process.env.COMPETITIVE_ANALYZER_DELAY || '1000', 10), // 1s
      betweenSites: parseInt(process.env.COMPETITIVE_SITE_DELAY || '5000', 10), // 5s
      afterFailure: parseInt(process.env.COMPETITIVE_FAILURE_DELAY || '3000', 10), // 3s
    },
    
    // Circuit breaker configuration
    circuitBreaker: {
      maxConsecutiveFailures: parseInt(process.env.COMPETITIVE_MAX_FAILURES || '2', 10),
      resetTimeout: parseInt(process.env.COMPETITIVE_RESET_TIMEOUT || '300000', 10), // 5 minutes
    },
    
    // Rate limiting (very restrictive)
    rateLimit: {
      windowMs: parseInt(process.env.COMPETITIVE_RATE_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.COMPETITIVE_RATE_MAX_REQUESTS || '2', 10), // Only 2 per 15 min
    },
  },
};

module.exports = config;
