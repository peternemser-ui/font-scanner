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

  // Rate Limiting (production defaults)
  rateLimit: {
    // Global rate limit (all endpoints)
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 per minute

    // Scan endpoint rate limit (more restrictive - resource intensive)
    scanWindowMs: parseInt(process.env.SCAN_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    scanMaxRequests: parseInt(process.env.SCAN_RATE_LIMIT_MAX_REQUESTS || '20', 10), // 20 per minute

    // Download endpoint rate limit
    downloadWindowMs: parseInt(process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS || '60000', 10), // 1 minute
    downloadMaxRequests: parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS || '50', 10), // 50 per minute

    // Contact form endpoint rate limit (anti-spam)
    contactWindowMs: parseInt(process.env.CONTACT_RATE_LIMIT_WINDOW_MS || '3600000', 10), // 1 hour
    contactMaxRequests: parseInt(process.env.CONTACT_RATE_LIMIT_MAX_REQUESTS || '5', 10), // 5 per hour
  },

  // Security
  cors: {
    // CORS_ORIGIN must be set in production (e.g., 'https://yourdomain.com')
    // In development, defaults to '*' for convenience
    origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV === 'production' ? null : '*'),
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

  // Lighthouse (centralized config)
  lighthouse: {
    // Overall execution timeout guard for a single LH run (reduced for speed)
    timeoutMs: parseInt(process.env.LIGHTHOUSE_TIMEOUT_MS || '90000', 10), // Default 90s; heavy sites often exceed 60s
    // How long LH will wait for page load internally
    maxWaitForLoadMs: parseInt(process.env.LIGHTHOUSE_MAX_WAIT_MS || '50000', 10), // Reduced from 75s to 50s
    // Retries for common flaky failures (NO_FCP, Chrome internal error)
    retries: parseInt(process.env.LIGHTHOUSE_RETRIES || '1', 10), // Reduced from 2 to 1 for speed
    // Desktop settle pauses (increased for better reliability)
    pauseAfterFcpMsDesktop: parseInt(process.env.LH_DESKTOP_PAUSE_FCP_MS || '2000', 10), // Increased from 1500
    pauseAfterLoadMsDesktop: parseInt(process.env.LH_DESKTOP_PAUSE_LOAD_MS || '2000', 10), // Increased from 1500
    // Mobile settle pauses
    pauseAfterFcpMsMobile: parseInt(process.env.LH_MOBILE_PAUSE_FCP_MS || '1000', 10),
    pauseAfterLoadMsMobile: parseInt(process.env.LH_MOBILE_PAUSE_LOAD_MS || '1000', 10),
    // Mobile throttling (use LH "mobileSlow4G"-like defaults for reliability)
    mobileThrottling: {
      rttMs: parseInt(process.env.LH_MOBILE_RTT_MS || '150', 10),
      throughputKbps: parseInt(process.env.LH_MOBILE_THROUGHPUT_KBPS || '1638', 10),
      cpuSlowdownMultiplier: parseInt(process.env.LH_MOBILE_CPU_SLOWDOWN || '4', 10),
      requestLatencyMs: parseInt(process.env.LH_MOBILE_REQUEST_LATENCY_MS || '150', 10),
      downloadThroughputKbps: parseInt(process.env.LH_MOBILE_DOWNLOAD_KBPS || '1638', 10),
      uploadThroughputKbps: parseInt(process.env.LH_MOBILE_UPLOAD_KBPS || '732', 10),
    },
    // Error tolerance and fallback strategies
    errorTolerance: {
      // Use fallback scoring when Lighthouse fails
      useFallbackScoring: process.env.LH_USE_FALLBACK !== 'false',
      // Continue analysis even if desktop Lighthouse fails
      continueOnDesktopFailure: process.env.LH_CONTINUE_ON_DESKTOP_FAILURE !== 'false',
      // Use mobile scores as fallback for desktop when desktop fails
      useMobileAsFallback: process.env.LH_USE_MOBILE_FALLBACK !== 'false',
      // Delay between retries (ms) - increased for better recovery
      retryDelayMs: parseInt(process.env.LH_RETRY_DELAY_MS || '5000', 10),
    },
    // Circuit breaker to skip Lighthouse temporarily after repeated failures
    circuitBreaker: {
      enabled: process.env.LH_CIRCUIT_BREAKER_ENABLED !== 'false',
      failureThreshold: parseInt(process.env.LH_FAILURE_THRESHOLD || '3', 10),
      resetTimeoutMs: parseInt(process.env.LH_CIRCUIT_RESET_MS || '300000', 10), // 5 min
    }
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

  // Billing Configuration
  billing: {
    // Stripe Price IDs
    priceProMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY || process.env.STRIPE_PRO_PRICE_ID,
    priceProYearly: process.env.STRIPE_PRICE_PRO_YEARLY || process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    priceSingleReport: process.env.STRIPE_PRICE_SINGLE_REPORT || process.env.STRIPE_PRICE_SINGLE_REPORT_10,
    // App Base URL
    appBaseUrl: process.env.APP_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
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
    
    // Rate limiting (production defaults - resource intensive)
    rateLimit: {
      windowMs: parseInt(process.env.COMPETITIVE_RATE_WINDOW_MS || '60000', 10), // 1 minute
      maxRequests: parseInt(process.env.COMPETITIVE_RATE_MAX_REQUESTS || '5', 10), // 5 per minute
    },
  },
};

module.exports = config;
