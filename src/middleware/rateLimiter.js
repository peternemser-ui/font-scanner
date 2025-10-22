/**
 * Enhanced Rate Limiting Middleware
 * 
 * Features:
 * - Per-IP rate limiting
 * - Different limits for different endpoints
 * - Prometheus metrics for rate limit hits
 * - Request ID correlation
 * - Detailed logging
 * - Configurable response messages
 */

const rateLimit = require('express-rate-limit');
const { createLogger } = require('../utils/logger');
const { rateLimitCounter } = require('./metrics');

const logger = createLogger('RateLimiter');

/**
 * In-memory tracking of rate limit violations
 * For production, this should be moved to Redis or similar persistent store
 */
const rateLimitStats = {
  violations: [], // Array of {timestamp, ip, endpoint, limiter}
  ipStats: new Map(), // Map of IP -> {totalHits, lastHit, endpoints[]}
  
  /**
   * Record a rate limit violation
   */
  recordViolation(ip, endpoint, limiter) {
    const violation = {
      timestamp: new Date().toISOString(),
      ip,
      endpoint,
      limiter,
    };
    
    // Keep last 1000 violations
    this.violations.push(violation);
    if (this.violations.length > 1000) {
      this.violations.shift();
    }
    
    // Update IP stats
    if (!this.ipStats.has(ip)) {
      this.ipStats.set(ip, {
        totalHits: 0,
        lastHit: null,
        endpoints: [],
      });
    }
    
    const ipStat = this.ipStats.get(ip);
    ipStat.totalHits++;
    ipStat.lastHit = violation.timestamp;
    if (!ipStat.endpoints.includes(endpoint)) {
      ipStat.endpoints.push(endpoint);
    }
    
    // Cleanup old IP stats (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [ip, stats] of this.ipStats.entries()) {
      if (new Date(stats.lastHit).getTime() < oneHourAgo) {
        this.ipStats.delete(ip);
      }
    }
  },
  
  /**
   * Get summary statistics
   */
  getSummary() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Filter violations by time period
    const lastHour = this.violations.filter(v => 
      new Date(v.timestamp).getTime() > oneHourAgo
    );
    const last24Hours = this.violations.filter(v => 
      new Date(v.timestamp).getTime() > oneDayAgo
    );
    
    // Count violations by limiter
    const byLimiter = {};
    last24Hours.forEach(v => {
      byLimiter[v.limiter] = (byLimiter[v.limiter] || 0) + 1;
    });
    
    // Top offending IPs
    const ipArray = Array.from(this.ipStats.entries())
      .map(([ip, stats]) => ({ ip, ...stats }))
      .sort((a, b) => b.totalHits - a.totalHits)
      .slice(0, 10);
    
    return {
      totalViolations: this.violations.length,
      lastHour: lastHour.length,
      last24Hours: last24Hours.length,
      byLimiter,
      topIPs: ipArray,
    };
  },
  
  /**
   * Get recent violations
   */
  getRecentViolations(limit = 50) {
    return this.violations.slice(-limit).reverse();
  },
};

/**
 * Create a standardized rate limit handler with logging and metrics
 * @param {string} name - Name for this rate limiter (for logging)
 * @param {object} options - express-rate-limit options
 */
const createRateLimiter = (name, options) => {
  const defaultOptions = {
    // Store hits in memory (use Redis in production for distributed systems)
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    
    // Custom handler for rate limit exceeded
    handler: (req, res) => {
      const requestId = req.id || 'unknown';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const endpoint = req.path || 'unknown';
      
      // Record violation for monitoring
      rateLimitStats.recordViolation(ip, endpoint, name);
      
      logger.warn('Rate limit exceeded', {
        requestId,
        ip,
        endpoint,
        limiter: name,
        limit: options.max,
        window: `${options.windowMs / 1000}s`,
      });

      // Increment Prometheus counter
      if (rateLimitCounter) {
        rateLimitCounter.inc({
          limiter: name,
          endpoint,
        });
      }

      res.status(429).json({
        error: 'Too Many Requests',
        message: options.message || 'You have exceeded the rate limit. Please try again later.',
        retryAfter: Math.ceil(options.windowMs / 1000),
        requestId,
        details: {
          limit: options.max,
          window: `${options.windowMs / 1000} seconds`,
          limiter: name,
        },
      });
    },

    // Skip successful requests from being counted
    skip: (req) => {
      // Don't count health checks
      if (req.path === '/api/health' || req.path === '/api/ready') {
        return true;
      }
      // Don't count monitoring/admin endpoints
      if (req.path === '/api/rate-limits' || req.path === '/api/admin/rate-limits' || req.path === '/metrics') {
        return true;
      }
      return false;
    },

    // Key generator - default is IP address
    keyGenerator: (req) => {
      return req.ip || req.socket.remoteAddress || 'unknown';
    },
  };

  // Merge options
  const mergedOptions = {
    ...defaultOptions,
    ...options,
  };

  return rateLimit(mergedOptions);
};

/**
 * Global rate limiter - applies to all requests
 * Protects against general abuse
 * 
 * Default: 100 requests per 15 minutes per IP
 */
const globalLimiter = createRateLimiter('global', {
  windowMs: process.env.RATE_LIMIT_WINDOW_MS 
    ? parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) 
    : 15 * 60 * 1000, // 15 minutes
  max: process.env.RATE_LIMIT_MAX_REQUESTS 
    ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) 
    : 100,
  message: 'Too many requests from this IP. Please try again in 15 minutes.',
});

/**
 * Scan endpoint rate limiter - more restrictive for expensive operations
 * Protects against resource exhaustion
 * 
 * Default: 20 scans per 15 minutes per IP
 */
const scanLimiter = createRateLimiter('scan', {
  windowMs: process.env.SCAN_RATE_LIMIT_WINDOW_MS 
    ? parseInt(process.env.SCAN_RATE_LIMIT_WINDOW_MS, 10) 
    : 15 * 60 * 1000, // 15 minutes
  max: process.env.SCAN_RATE_LIMIT_MAX_REQUESTS 
    ? parseInt(process.env.SCAN_RATE_LIMIT_MAX_REQUESTS, 10) 
    : 20,
  message: 'Too many scan requests. Scanning is resource-intensive. Please try again in 15 minutes.',
});

/**
 * Report download rate limiter - prevent excessive downloads
 * 
 * Default: 50 downloads per 15 minutes per IP
 */
const downloadLimiter = createRateLimiter('download', {
  windowMs: process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS 
    ? parseInt(process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS, 10) 
    : 15 * 60 * 1000, // 15 minutes
  max: process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS 
    ? parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS, 10) 
    : 50,
  message: 'Too many download requests. Please try again in 15 minutes.',
});

/**
 * Strict limiter for brute force protection
 * Very aggressive limits for sensitive endpoints
 * 
 * Default: 5 requests per 5 minutes per IP
 */
const strictLimiter = createRateLimiter('strict', {
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  message: 'Too many failed attempts. Please wait 5 minutes before trying again.',
});

/**
 * Logging middleware to track rate limit headers
 * Helps monitor how close users are to hitting limits
 */
const rateLimitLogger = (req, res, next) => {
  const originalJson = res.json.bind(res);
  
  res.json = function (body) {
    const remaining = res.getHeader('RateLimit-Remaining');
    const limit = res.getHeader('RateLimit-Limit');
    const reset = res.getHeader('RateLimit-Reset');
    
    if (remaining !== undefined && limit !== undefined) {
      const usage = ((limit - remaining) / limit * 100).toFixed(1);
      
      if (usage > 80) {
        logger.info('High rate limit usage', {
          requestId: req.id,
          ip: req.ip || req.socket.remoteAddress,
          endpoint: req.path,
          remaining,
          limit,
          usage: `${usage}%`,
          reset: new Date(reset * 1000).toISOString(),
        });
      }
    }
    
    return originalJson(body);
  };
  
  next();
};

/**
 * Get rate limit statistics (for monitoring endpoints)
 */
const getRateLimitStats = () => {
  return {
    global: {
      window: '15 minutes',
      limit: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
    },
    scan: {
      window: '15 minutes',
      limit: process.env.SCAN_RATE_LIMIT_MAX_REQUESTS || 20,
    },
    download: {
      window: '15 minutes',
      limit: process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS || 50,
    },
  };
};

/**
 * Get detailed rate limit analytics
 */
const getRateLimitAnalytics = () => {
  const config = getRateLimitStats();
  const summary = rateLimitStats.getSummary();
  const recentViolations = rateLimitStats.getRecentViolations(20);
  
  return {
    configuration: config,
    statistics: summary,
    recentViolations,
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  createRateLimiter,
  globalLimiter,
  scanLimiter,
  downloadLimiter,
  strictLimiter,
  rateLimitLogger,
  getRateLimitStats,
  getRateLimitAnalytics,
};
