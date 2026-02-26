/**
 * Tiered Rate Limiting Middleware
 *
 * Features:
 * - Per-user rate limiting (keyed by userId for authenticated, IP for anonymous)
 * - Tiered limits: anonymous < free < pro (unlimited for most endpoints)
 * - Different limits for different endpoint categories
 * - Prometheus metrics for rate limit hits
 * - Request ID correlation
 * - Detailed logging
 * - User-friendly 429 responses with retryAfter and tier info
 */

const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { createLogger } = require('../utils/logger');
const { rateLimitCounter } = require('./metrics');
const config = require('../config');

const logger = createLogger('RateLimiter');

// JWT secret from centralized config
const JWT_SECRET = config.jwt.secret;

// ─── Tier definitions ────────────────────────────────────────────────────────
// Limits are per-window. 0 = blocked, -1 = unlimited (skip limiter).

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Parse a tier limit from env var. Returns the env value as int, or the default.
 * -1 means unlimited. In dev mode, defaults are always -1 (unlimited).
 */
function tierVal(envKey, prodDefault) {
  const envVal = process.env[envKey];
  if (envVal !== undefined) return parseInt(envVal, 10);
  return isDev ? -1 : prodDefault;
}

// All tier limits are overridable via env vars:
//   RL_{LIMITER}_{TIER}  e.g. RL_SCAN_ANON=5, RL_GLOBAL_FREE=1000
const TIER_LIMITS = {
  //                   anonymous                          free                           pro
  global:            { anon: tierVal('RL_GLOBAL_ANON', 300),  free: tierVal('RL_GLOBAL_FREE', 500),  pro: tierVal('RL_GLOBAL_PRO', -1) },
  scan:              { anon: tierVal('RL_SCAN_ANON',     3),  free: tierVal('RL_SCAN_FREE',    10),  pro: tierVal('RL_SCAN_PRO',   -1) },
  competitiveAnalysis:{ anon: tierVal('RL_COMPETITIVE_ANON', 1), free: tierVal('RL_COMPETITIVE_FREE', 2), pro: tierVal('RL_COMPETITIVE_PRO', -1) },
  download:          { anon: tierVal('RL_DOWNLOAD_ANON', 5),  free: tierVal('RL_DOWNLOAD_FREE', 20), pro: tierVal('RL_DOWNLOAD_PRO', -1) },
  contact:           { anon: tierVal('RL_CONTACT_ANON',  3),  free: tierVal('RL_CONTACT_FREE',  5),  pro: tierVal('RL_CONTACT_PRO', -1) },
  strict:            { anon: tierVal('RL_STRICT_ANON',   5),  free: tierVal('RL_STRICT_FREE',   5),  pro: tierVal('RL_STRICT_PRO',  -1) },
};

// ─── In-memory violation tracking ────────────────────────────────────────────

const rateLimitStats = {
  violations: [],
  ipStats: new Map(),

  recordViolation(ip, endpoint, limiter, tier) {
    const violation = {
      timestamp: new Date().toISOString(),
      ip,
      endpoint,
      limiter,
      tier,
    };

    this.violations.push(violation);
    if (this.violations.length > 1000) {
      this.violations.shift();
    }

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
    for (const [key, stats] of this.ipStats.entries()) {
      if (new Date(stats.lastHit).getTime() < oneHourAgo) {
        this.ipStats.delete(key);
      }
    }
  },

  getSummary() {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const lastHour = this.violations.filter(v =>
      new Date(v.timestamp).getTime() > oneHourAgo
    );
    const last24Hours = this.violations.filter(v =>
      new Date(v.timestamp).getTime() > oneDayAgo
    );

    const byLimiter = {};
    last24Hours.forEach(v => {
      byLimiter[v.limiter] = (byLimiter[v.limiter] || 0) + 1;
    });

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

  getRecentViolations(limit = 50) {
    return this.violations.slice(-limit).reverse();
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Lightweight user tier resolver from JWT (no DB call).
 * Returns 'pro' | 'free' | 'anon'.
 */
function resolveRequestTier(req) {
  // If optionalAuth already ran, use req.user
  if (req.user) {
    return isPro(req.user) ? 'pro' : 'free';
  }

  // Otherwise try to decode JWT without a DB roundtrip
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [config.jwt.algorithm] });
      // Stash minimal info so downstream code can use it
      req._rateLimitUserId = decoded.userId;
      // We can't tell plan from JWT alone; treat all authenticated users
      // as at least 'free' (optionalAuth will upgrade to 'pro' later).
      // For a better check, we peek at cached plan from the token payload.
      if (decoded.plan === 'pro' || decoded.isPro) {
        return 'pro';
      }
      return 'free';
    }
  } catch (_) {
    // Invalid/expired token — treat as anonymous
  }
  return 'anon';
}

/**
 * Lightweight pro check (mirrors stripeService.isPro without import)
 */
function isPro(user) {
  if (!user) return false;
  const status = user.stripe_subscription_status;
  const activeStatuses = ['active', 'trialing'];
  if (user.stripe_current_period_end) {
    const periodEnd = new Date(user.stripe_current_period_end);
    if (periodEnd < new Date()) return false;
  }
  return activeStatuses.includes(status);
}

/**
 * Build a rate limit key: userId for authenticated, IP for anonymous.
 */
function tieredKeyGenerator(req) {
  if (req.user && req.user.id) return `user:${req.user.id}`;
  if (req._rateLimitUserId) return `user:${req._rateLimitUserId}`;
  return `ip:${req.ip || req.socket.remoteAddress || 'unknown'}`;
}

// ─── Tiered rate limiter factory ─────────────────────────────────────────────

/**
 * Create a tiered rate limiter.
 * @param {string} name - Limiter name (for logging/metrics)
 * @param {object} opts
 * @param {number} opts.windowMs - Window duration in ms
 * @param {string} opts.message - User-facing message on 429
 * @param {object} [opts.tierOverrides] - Optional { anon, free, pro } overrides
 */
function createTieredLimiter(name, opts) {
  const tiers = opts.tierOverrides || TIER_LIMITS[name] || TIER_LIMITS.global;
  const windowMs = opts.windowMs;

  return rateLimit({
    windowMs,
    standardHeaders: true,
    legacyHeaders: false,

    // Dynamic max based on user tier
    max: (req) => {
      const tier = resolveRequestTier(req);
      req._rateLimitTier = tier;
      const limit = tiers[tier] !== undefined ? tiers[tier] : tiers.anon;
      // -1 means unlimited — skip this request entirely
      if (limit === -1) return 0; // 0 with skip returning true = unlimited
      return limit;
    },

    // Skip unlimited tiers and health/monitoring endpoints
    skip: (req) => {
      const tier = req._rateLimitTier || resolveRequestTier(req);
      const limit = tiers[tier] !== undefined ? tiers[tier] : tiers.anon;
      if (limit === -1) return true;

      if (req.path === '/api/health' || req.path === '/api/ready') return true;
      if (req.path === '/api/rate-limits' || req.path === '/api/admin/rate-limits' || req.path === '/metrics') return true;
      return false;
    },

    keyGenerator: tieredKeyGenerator,

    handler: (req, res) => {
      const requestId = req.id || 'unknown';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const endpoint = req.path || 'unknown';
      const tier = req._rateLimitTier || 'anon';
      const limit = tiers[tier] !== undefined ? tiers[tier] : tiers.anon;
      const retryAfterSecs = Math.ceil(windowMs / 1000);
      const retryAfterMins = Math.ceil(windowMs / 60000);

      rateLimitStats.recordViolation(ip, endpoint, name, tier);

      logger.warn('Rate limit exceeded', {
        requestId,
        ip,
        endpoint,
        limiter: name,
        tier,
        limit,
        window: `${windowMs / 1000}s`,
      });

      if (rateLimitCounter) {
        rateLimitCounter.inc({ limiter: name, endpoint });
      }

      res.status(429).json({
        error: 'Too Many Requests',
        message: opts.message || `You have exceeded the rate limit. Please try again in ${retryAfterMins} minutes.`,
        retryAfter: retryAfterSecs,
        requestId,
        tier,
        upgradeUrl: tier !== 'pro' ? '/upgrade.html' : undefined,
        details: {
          limit,
          window: `${retryAfterSecs} seconds`,
          limiter: name,
          tier,
        },
      });
    },
  });
}

// ─── Limiter instances ───────────────────────────────────────────────────────

const globalLimiter = createTieredLimiter('global', {
  windowMs: config.rateLimit.windowMs,
  message: `Too many requests. Please try again in ${Math.ceil(config.rateLimit.windowMs / 60000)} minutes.`,
});

const scanLimiter = createTieredLimiter('scan', {
  windowMs: config.rateLimit.scanWindowMs,
  message: 'Too many scan requests. Scanning is resource-intensive. Please wait before trying again.',
});

const competitiveAnalysisLimiter = createTieredLimiter('competitiveAnalysis', {
  windowMs: process.env.COMPETITIVE_RATE_WINDOW_MS
    ? parseInt(process.env.COMPETITIVE_RATE_WINDOW_MS, 10)
    : 15 * 60 * 1000,
  message: 'Competitive analysis is very resource-intensive. Please wait before running another.',
});

const downloadLimiter = createTieredLimiter('download', {
  windowMs: config.rateLimit.downloadWindowMs,
  message: 'Too many download requests. Please wait before trying again.',
});

const contactLimiter = createTieredLimiter('contact', {
  windowMs: config.rateLimit.contactWindowMs,
  message: 'Too many contact requests. Please try again later.',
});

const strictLimiter = createTieredLimiter('strict', {
  windowMs: 5 * 60 * 1000,
  message: 'Too many failed attempts. Please wait 5 minutes before trying again.',
});

// ─── Rate limit logger middleware ────────────────────────────────────────────

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
          reset: reset ? new Date(reset * 1000).toISOString() : 'unknown',
        });
      }
    }

    return originalJson(body);
  };

  next();
};

// ─── Stats helpers ───────────────────────────────────────────────────────────

const getRateLimitStats = () => ({
  tiers: TIER_LIMITS,
  windows: {
    global: `${config.rateLimit.windowMs / 1000}s`,
    scan: `${config.rateLimit.scanWindowMs / 1000}s`,
    download: `${config.rateLimit.downloadWindowMs / 1000}s`,
    competitiveAnalysis: '900s',
    contact: `${config.rateLimit.contactWindowMs / 1000}s`,
    strict: '300s',
  },
});

const getRateLimitAnalytics = () => {
  const statsConfig = getRateLimitStats();
  const summary = rateLimitStats.getSummary();
  const recentViolations = rateLimitStats.getRecentViolations(20);

  return {
    configuration: statsConfig,
    statistics: summary,
    recentViolations,
    timestamp: new Date().toISOString(),
  };
};

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  createTieredLimiter,
  globalLimiter,
  scanLimiter,
  contactLimiter,
  downloadLimiter,
  strictLimiter,
  competitiveAnalysisLimiter,
  rateLimitLogger,
  getRateLimitStats,
  getRateLimitAnalytics,
  TIER_LIMITS,
  // Legacy alias
  createRateLimiter: createTieredLimiter,
};
