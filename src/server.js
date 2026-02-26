// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
const http = require('http');
const { Server: SocketIO } = require('socket.io');

const scanController = require('./controllers/scanController');
const config = require('./config');
const { createLogger } = require('./utils/logger');
const { errorMiddleware } = require('./utils/errorHandler');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');
const requestIdMiddleware = require('./middleware/requestId');

// New async scan system
const { initializeDatabase, getDatabase } = require('./db');
const { getQueue } = require('./queue/scanQueue');
const ScanWorker = require('./queue/scanWorker');
const {
  globalLimiter,
  scanLimiter,
  downloadLimiter,
  competitiveAnalysisLimiter,
  contactLimiter,
  rateLimitLogger,
  getRateLimitStats,
  getRateLimitAnalytics,
} = require('./middleware/rateLimiter');
const { abuseFilter } = require('./middleware/abuseFilter');
const browserPool = require('./utils/browserPool');
const {
  startScheduledCleanup,
  stopScheduledCleanup,
  getCleanupStats
} = require('./utils/reportCleanup');
const { optionalAuth, requireAuth } = require('./middleware/requireAuth');
const { requireAdmin } = require('./middleware/requireAdmin');
const stripeService = require('./services/stripeService');
const { checkScanQuota, resolveEffectivePlan } = require('./middleware/scanQuota');
const usageService = require('./services/usageService');

const logger = createLogger('Server');

// Production environment validation
if (config.nodeEnv === 'production') {
  if (!config.cors.origin) {
    logger.error('CORS_ORIGIN must be set in production');
    process.exit(1);
  }
  // JWT_SECRET check is handled by config/index.js at import time
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.error('STRIPE_SECRET_KEY must be set in production');
    process.exit(1);
  }
}
const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: config.cors.origin || '*',
    methods: ['GET', 'POST']
  }
});

const PORT = config.port;

// Health check state
let isShuttingDown = false;

// Initialize database and scan worker
let scanWorker = null;
(async () => {
  try {
    logger.info('Initializing database...');
    await initializeDatabase();
    logger.info('Database initialized successfully');

    // Initialize scan worker
    const queue = getQueue();
    scanWorker = new ScanWorker(queue);
    logger.info('Scan worker initialized');
  } catch (error) {
    logger.error('Failed to initialize async scan system:', error);
    process.exit(1);
  }
})();

// Start report cleanup scheduler (runs daily)
let cleanupInterval = null;
try {
  cleanupInterval = startScheduledCleanup();
  logger.info('Report cleanup scheduler started');
} catch (error) {
  logger.error('Failed to start report cleanup scheduler:', error);
}

// Memory monitoring - check every 5 minutes and warn if memory is high
const MEMORY_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const MEMORY_WARNING_THRESHOLD_MB = 512; // Warn if heap exceeds 512MB
const memoryMonitorInterval = setInterval(() => {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  
  if (heapUsedMB > MEMORY_WARNING_THRESHOLD_MB) {
    logger.warn('High memory usage detected', {
      heapUsedMB,
      heapTotalMB: Math.round(used.heapTotal / 1024 / 1024),
      rssMB: Math.round(used.rss / 1024 / 1024),
      threshold: MEMORY_WARNING_THRESHOLD_MB
    });
    
    // Trigger cleanup of expired cache entries
    try {
      const { defaultCache } = require('./utils/cache');
      defaultCache.cleanup();
    } catch (e) {
      // Ignore cleanup errors
    }
    
    // Hint garbage collection if available
    if (global.gc) {
      global.gc();
      logger.info('Garbage collection triggered due to high memory');
    }
  }
}, MEMORY_CHECK_INTERVAL);

// Admin health dashboard — push metrics every 4s to connected admins
const HEALTH_EMIT_INTERVAL = 4000;
let _prevCpuUsage = process.cpuUsage();
let _prevCpuTime = Date.now();
let _prevHttpTotal = 0;
let _prevHttpTime = Date.now();

const healthEmitterInterval = setInterval(async () => {
  try {
    // Skip collection if no admin is watching
    const room = io.sockets.adapter.rooms.get('admin-health');
    if (!room || room.size === 0) return;

    // Memory
    const mem = process.memoryUsage();
    const memory = {
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
      rss: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
      external: Math.round((mem.external || 0) / 1024 / 1024 * 10) / 10
    };

    // CPU % from delta
    const nowCpu = process.cpuUsage(_prevCpuUsage);
    const elapsedMs = Date.now() - _prevCpuTime;
    const cpuPercent = elapsedMs > 0
      ? Math.min(100, Math.round(((nowCpu.user + nowCpu.system) / 1000) / elapsedMs * 100 * 10) / 10)
      : 0;
    _prevCpuUsage = process.cpuUsage();
    _prevCpuTime = Date.now();

    // Active scans from prom-client gauge (async in v15)
    let activeScans = 0;
    try {
      const { metrics: promMetrics } = require('./middleware/metrics');
      if (promMetrics && promMetrics.activeScans) {
        const result = await promMetrics.activeScans.get();
        if (result && result.values) {
          for (const v of result.values) {
            activeScans += v.value || 0;
          }
        }
      }
    } catch (_) { /* ignore */ }

    // Requests per minute from httpRequestTotal counter delta
    let requestsPerMinute = 0;
    try {
      const { metrics: promMetrics } = require('./middleware/metrics');
      if (promMetrics && promMetrics.httpRequestTotal) {
        const result = await promMetrics.httpRequestTotal.get();
        let currentTotal = 0;
        if (result && result.values) {
          for (const v of result.values) {
            currentTotal += v.value || 0;
          }
        }
        const elapsed = (Date.now() - _prevHttpTime) / 1000;
        if (elapsed > 0) {
          requestsPerMinute = Math.round((currentTotal - _prevHttpTotal) / elapsed * 60 * 10) / 10;
        }
        _prevHttpTotal = currentTotal;
        _prevHttpTime = Date.now();
      }
    } catch (_) { /* ignore */ }

    // Error rates
    let errors = { lastMinute: 0, lastHour: 0, thresholdViolations: [] };
    try {
      const errorTelemetry = require('./utils/errorTelemetry');
      const rates = errorTelemetry.getErrorRates();
      const thresholds = errorTelemetry.checkThresholds();
      errors = {
        lastMinute: rates.lastMinute || 0,
        lastHour: rates.lastHour || 0,
        thresholdViolations: thresholds.violations || []
      };
    } catch (_) { /* ignore */ }

    // Rate limit stats
    let rateLimits = { totalViolations: 0, lastHour: 0 };
    try {
      const analytics = getRateLimitAnalytics();
      rateLimits = {
        totalViolations: analytics.statistics?.totalViolations || 0,
        lastHour: analytics.statistics?.lastHour || 0
      };
    } catch (_) { /* ignore */ }

    // Browser pool status
    let browserPoolStatus = { available: 0, borrowed: 0, max: 0 };
    try {
      const stats = browserPool.getStats();
      browserPoolStatus = {
        available: stats.available || 0,
        borrowed: stats.borrowed || 0,
        max: stats.max || 0
      };
    } catch (_) { /* ignore */ }

    io.to('admin-health').emit('admin:health-tick', {
      timestamp: Date.now(),
      memory,
      cpu: { percent: cpuPercent },
      uptime: process.uptime(),
      activeScans,
      requestsPerMinute,
      errors,
      rateLimits,
      browserPool: browserPoolStatus
    });
  } catch (err) {
    // Never crash the interval
  }
}, HEALTH_EMIT_INTERVAL);

// Security middleware - Content Security Policy
// Note: 'unsafe-inline' is still required for some page-specific initialization scripts.
// Inline onclick handlers have been migrated to data-action attributes with event delegation.
// Critical billing/redirect scripts have been moved to external files.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'", // TODO: Remove when all inline scripts are externalized
          'https://cdn.socket.io',
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
          'https://js.stripe.com',
          'https://www.googletagmanager.com',
          'https://www.google-analytics.com'
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: [
          "'self'",
          'https://api.stripe.com',
          'https://www.google-analytics.com',
          'https://analytics.google.com',
          'wss:',
          'ws:'
        ],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
// Abuse filter — hard IP-based limit to block DoS/spam (applies to ALL requests)
app.use(abuseFilter);

// Rate limiting — tiered global limiter for API and page requests (skip static assets)
const STATIC_ASSET_RE = /\.(js|css|svg|png|jpg|jpeg|gif|ico|woff2?|ttf|eot|map|json|webp|avif)(\?.*)?$/i;
app.use((req, res, next) => {
  if (STATIC_ASSET_RE.test(req.path)) return next();
  return globalLimiter(req, res, next);
});

// Rate limit monitoring
app.use(rateLimitLogger);

// CORS
app.use(

  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET' , 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Compression
app.use(compression());

// Cookie parsing (required for anon_id usage tracking)
app.use(cookieParser());

// Logging
app.use(morgan('combined'));

// Request ID tracking - adds unique ID to each request
app.use(requestIdMiddleware);

// Metrics middleware
app.use(metricsMiddleware);

// Stripe webhooks (MUST be before body parsing to get raw body)
const webhookRoutes = require('./routes/webhooks');
app.use('/api/webhooks', webhookRoutes);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Locale resolution middleware
// Extracts locale from Accept-Language header and attaches to request
app.use((req, res, next) => {
  const acceptLanguage = req.headers['accept-language'] || 'en';
  const supportedLocales = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ru'];

  // Parse Accept-Language header (format: "en-US,en;q=0.9,es;q=0.8")
  const parsedLocales = acceptLanguage.split(',').map(lang => {
    const [code, qValue] = lang.trim().split(';q=');
    return {
      code: code.split('-')[0].toLowerCase(),
      quality: qValue ? parseFloat(qValue) : 1.0
    };
  }).sort((a, b) => b.quality - a.quality);

  // Find first supported locale
  const matchedLocale = parsedLocales.find(l => supportedLocales.includes(l.code));
  req.locale = matchedLocale ? matchedLocale.code : 'en';
  req.rawAcceptLanguage = acceptLanguage;

  next();
});

// Language prefix routing middleware
// Handles URLs like /ja/seo-analyzer.html, /en/dashboard.html, etc.
const SUPPORTED_LANG_PREFIXES = ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ru'];

app.use((req, res, next) => {
  // Check if URL starts with a language prefix
  const pathParts = req.path.split('/').filter(Boolean);
  const firstPart = pathParts[0];

  if (firstPart && SUPPORTED_LANG_PREFIXES.includes(firstPart)) {
    // Extract language from URL
    const urlLang = firstPart;

    // Rewrite URL to remove language prefix for static file serving
    const newPath = '/' + pathParts.slice(1).join('/') || '/';
    req.url = newPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');

    // Set language cookie for client-side detection
    res.cookie('sm_url_lang', urlLang, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false, // Allow JS to read it
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    // Also set on request for API routes
    req.urlLang = urlLang;
    req.locale = urlLang;
  }

  next();
});

// Root redirect - redirect / to /:lang/ based on Accept-Language
app.get('/', (req, res, next) => {
  // If URL was already language-prefixed (e.g., /ja/ -> /), serve index.html
  if (req.urlLang) return next();

  // If already handled by static middleware or has a file extension, skip
  if (req.path !== '/') return next();

  // Detect preferred language from Accept-Language header
  const acceptLang = req.headers['accept-language'] || '';
  const preferredLang = detectPreferredLanguage(acceptLang, SUPPORTED_LANG_PREFIXES) || 'en';

  // Redirect to language-prefixed URL
  res.redirect(302, `/${preferredLang}/`);
});

/**
 * Detect preferred language from Accept-Language header
 */
function detectPreferredLanguage(acceptLanguage, supportedLangs) {
  if (!acceptLanguage) return null;

  // Parse Accept-Language header (e.g., "ja,en-US;q=0.9,en;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map(lang => {
      const [code, qValue] = lang.trim().split(';q=');
      return {
        code: code.split('-')[0].toLowerCase(), // 'en-US' -> 'en'
        q: qValue ? parseFloat(qValue) : 1.0
      };
    })
    .sort((a, b) => b.q - a.q);

  // Find first supported language
  for (const { code } of languages) {
    if (supportedLangs.includes(code)) {
      return code;
    }
  }

  return null;
}

// Static files — cache for 1 year (cache-busted via ?v= query string)
const STATIC_MAX_AGE = process.env.NODE_ENV === 'production' ? '1y' : '0';
app.use(express.static(path.join(__dirname, 'public'), { maxAge: STATIC_MAX_AGE }));

// Serve generated report artifacts (PDFs, screenshots)
// NOTE: config.reports.dir is repo-relative by default (./reports)
app.use('/reports', express.static(path.resolve(process.cwd(), config.reports.dir), { maxAge: STATIC_MAX_AGE }));

// Routes
// Liveness probe - checks if app is alive (no internal details for public callers)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Detailed health stats — admin only
app.get('/api/health/details', requireAuth, requireAdmin, (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Version endpoint — git info cached at startup to avoid spawning processes per request
const _versionInfo = (() => {
  const { execSync } = require('child_process');
  const packageJson = require('../package.json');
  let gitHash = 'unknown';
  let gitBranch = 'unknown';
  try {
    gitHash = execSync('git rev-parse --short HEAD').toString().trim();
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    // git may not be available in Docker/CI
  }
  return {
    version: packageJson.version,
    git: { hash: gitHash, branch: gitBranch },
    build: `${packageJson.version}-${gitHash}`
  };
})();

app.get('/api/version', (req, res) => {
  // Only expose version number publicly; git details are admin-only via /api/health/details
  res.json({ version: _versionInfo.version });
});

// Readiness probe - checks if app is ready to accept traffic
app.get('/api/ready', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({
      status: 'NOT_READY',
      reason: 'Server is shutting down',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    status: 'READY',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Prometheus metrics endpoint
// Prometheus metrics — only from localhost/internal or authenticated admin
app.get('/metrics', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (isLocal) return next();
  // Non-local requests must be authenticated admin
  requireAuth(req, res, (err) => {
    if (err) return res.status(401).json({ error: 'Unauthorized' });
    requireAdmin(req, res, next);
  });
}, metricsHandler);

// Rate limit stats endpoint (for monitoring — admin only)
app.get('/api/rate-limits', requireAuth, requireAdmin, (req, res) => {
  res.json({
    limits: getRateLimitStats(),
    message: 'Current rate limit configuration',
  });
});

// Enhanced rate limit analytics endpoint (detailed monitoring)
app.get('/api/admin/rate-limits', requireAuth, requireAdmin, (req, res) => {
  try {
    const analytics = getRateLimitAnalytics();
    res.json(analytics);
  } catch (error) {
    logger.error('Error fetching rate limit analytics:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch rate limit analytics',
    });
  }
});

// Error telemetry analytics endpoint (admin only)
app.get('/api/admin/errors', requireAuth, requireAdmin, (req, res) => {
  try {
    const { timeWindow, category, type } = req.query;
    const errorTelemetry = require('./utils/errorTelemetry');
    
    const statistics = errorTelemetry.getStatistics({ 
      timeWindow, 
      category, 
      type 
    });
    const rates = errorTelemetry.getErrorRates();
    const thresholds = errorTelemetry.checkThresholds();
    
    res.json({
      status: 'ok',
      statistics,
      rates,
      thresholds,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching error telemetry:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch error telemetry',
    });
  }
});

// Get specific error details (admin only)
app.get('/api/admin/errors/:errorId', requireAuth, requireAdmin, (req, res) => {
  try {
    const { errorId } = req.params;
    const errorTelemetry = require('./utils/errorTelemetry');
    
    const errorDetails = errorTelemetry.getErrorById(errorId);
    if (!errorDetails) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Error not found'
      });
    }
    
    const similarErrors = errorTelemetry.getSimilarErrors(errorId, 10);
    
    res.json({
      status: 'ok',
      error: errorDetails,
      similarErrors,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error fetching error details:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch error details',
    });
  }
});

// Report cleanup statistics endpoint
app.get('/api/reports/stats', async (req, res) => {
  try {
    const stats = await getCleanupStats();
    res.json({
      status: 'ok',
      stats,
      message: 'Report cleanup statistics',
    });
  } catch (error) {
    logger.error('Error fetching report stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch report statistics',
    });
  }
});

// Authentication API
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

// Canonical entitlements endpoint at /api/me/entitlements
// Delegates to the canonical resolver in utils/entitlements.js
app.get('/api/me/entitlements', requireAuth, async (req, res) => {
  try {
    const { getFullEntitlements } = require('./utils/entitlements');
    const entitlements = await getFullEntitlements(req.user.id);
    res.json(entitlements);
  } catch (error) {
    logger.error('Failed to fetch entitlements', { error: error.message, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch entitlements' });
  }
});

// Payment API (Stripe Checkout & Customer Portal)
const paymentRoutes = require('./routes/payment');
app.use('/api/payment', paymentRoutes);

// Billing API (no-account checkout for reports/credits)
const billingRoutes = require('./routes/billing');
app.use('/api/billing', billingRoutes);

// Reports API (stored report snapshots)
const reportsRoutes = require('./routes/reports');
app.use('/api/reports', reportsRoutes);

// Usage Stats API
const usageRoutes = require('./routes/usage');
app.use('/api/usage', usageRoutes);

// Admin API (requires authentication + admin privileges)
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Pro Report Snapshot API (paid report capture flow)
const proReportRoutes = require('./routes/proReport');
app.use('/api/pro-report', proReportRoutes);

// AI Recommendations (Claude-powered strategic analysis)
const aiRecommendationsRoutes = require('./routes/aiRecommendations');
app.use('/api/ai/recommendations', aiRecommendationsRoutes);

// New async scan API
const scanRoutes = require('./routes/scan.routes');
app.use('/api/scans', scanRoutes);

/**
 * Helper to wrap analyzer handlers with scan usage tracking
 * Increments usage count and records scan in database after successful response
 *
 * Deduplication: The dashboard fires 5 parallel API calls for one user-initiated
 * scan, all sharing the same `scanStartedAt` timestamp. We use this to ensure
 * a single user action only increments the scan counter once.
 */
const _recentScanKeys = new Map(); // dedupKey -> timestamp
const _SCAN_DEDUP_WINDOW_MS = 30000; // 30 seconds

function withUsageTracking(handler) {
  return async (req, res, next) => {
    // Track original json method
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      // Increment usage on successful response (non-error)
      if (!data?.error) {
        const userId = req.user?.id || null;
        const anonId = req.anonId || req.cookies?.anon_id || null;

        // Skip usage tracking for billing re-scans (post-purchase page reload).
        // The user already consumed a scan credit on the original scan; the re-scan
        // only re-fetches data so the purchased pro sections render unlocked.
        const isBillingRescan = req.body?.billingRescan === true && userId;

        // Deduplicate: only count once per scanStartedAt per user
        const scanStartedAt = req.body?.scanStartedAt || null;
        const identity = userId || anonId || 'unknown';
        const dedupKey = scanStartedAt ? `${identity}:${scanStartedAt}` : null;
        const now = Date.now();

        // Prune expired entries
        for (const [key, ts] of _recentScanKeys) {
          if (now - ts > _SCAN_DEDUP_WINDOW_MS) _recentScanKeys.delete(key);
        }

        const alreadyCounted = dedupKey && _recentScanKeys.has(dedupKey);
        if (dedupKey && !alreadyCounted) {
          _recentScanKeys.set(dedupKey, now);
        }

        if (!isBillingRescan && !alreadyCounted && (userId || anonId)) {
          usageService.incrementScanUsage(userId, anonId).catch(err => {
            logger.error('Failed to increment scan usage', { error: err.message });
          });
        }
        if (isBillingRescan) {
          logger.info('Billing re-scan: skipped scan usage increment', {
            userId: userId.substring(0, 8) + '...'
          });
        }

        // Record scan in scans table so it appears in the reports dashboard
        // Skip for billing re-scans to avoid duplicate entries
        if (userId && !isBillingRescan) {
          const targetUrl = req.body?.url || req.body?.site_url || 'unknown';
          // Derive analyzer type from the route path (e.g. /api/core-web-vitals -> core-web-vitals)
          const routePath = (req.route?.path || req.originalUrl || '').split('?')[0];
          const analyzerType = routePath.replace(/^\/api\//, '').replace(/\/$/, '') || 'unknown';
          const crypto = require('crypto');
          const scanId = crypto.randomUUID();
          // Extract reportId from response data (set by controllers via buildReportMetadata)
          const reportId = data?.reportId || data?.results?.reportId || null;
          // Capture the user's active locale so PDFs render in the scan's original language
          const scanLocale = req.body?.lang || req.locale || 'en';
          const db = getDatabase();
          db.run(
            `INSERT INTO scans (id, target_url, status, options_json, user_id, report_id, result_json, locale, started_at, finished_at)
             VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [scanId, targetUrl, JSON.stringify({ analyzerType }), userId, reportId, JSON.stringify(data), scanLocale]
          ).catch(err => {
            logger.error('Failed to record scan in database', { error: err.message });
          });

          // Decrement day_pass report counter
          if (reportId && req.user) {
            const effectivePlan = resolveEffectivePlan(req.user);
            if (effectivePlan === 'day_pass') {
              usageService.incrementReportUsage(userId, reportId).catch(err => {
                logger.error('Failed to increment report usage for day_pass', { error: err.message });
              });
            }
          }
        }
      }
      return originalJson(data);
    };

    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}

// Legacy scan endpoints (keep for backwards compatibility)
app.post('/api/scan', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(scanController.scanWebsite));
app.post('/api/scan/best-in-class', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(scanController.performBestInClassScan));
app.post('/api/seo', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(scanController.performSEOScan));

// Performance Analyzer
const performanceController = require('./controllers/performanceController');
app.post('/api/performance', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(performanceController.analyzePerformance));
app.post('/api/performance/cross-browser', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(performanceController.analyzeCrossBrowser));

// Core Web Vitals Analyzer (Google Ranking Factor)
const coreWebVitalsController = require('./controllers/coreWebVitalsController');
app.post('/api/core-web-vitals', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(coreWebVitalsController.analyzeCoreWebVitals));

// Competitive Analysis Tool (VERY resource-intensive - strict rate limiting)
const competitiveAnalysisController = require('./controllers/competitiveAnalysisController');
competitiveAnalysisController.setSocketIO(io); // Inject Socket.IO for real-time progress
app.post('/api/competitive-analysis', optionalAuth, checkScanQuota, competitiveAnalysisLimiter, withUsageTracking(competitiveAnalysisController.analyzeCompetitors));

// Broken Link Checker
const brokenLinkController = require('./controllers/brokenLinkController');
app.post('/api/broken-links', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(brokenLinkController.checkBrokenLinks));

// Advanced Analyzers (CRO, Brand, GEO SEO, GDPR)
const advancedAnalyzersController = require('./controllers/advancedAnalyzersController');
app.post('/api/cro-analysis', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(advancedAnalyzersController.analyzeCRO));
app.post('/api/brand-consistency', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(advancedAnalyzersController.analyzeBrand));
app.post('/api/geo-seo', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(advancedAnalyzersController.analyzeGeoSEO));
// Backward compat: redirect old local-seo endpoint
app.post('/api/local-seo', optionalAuth, checkScanQuota, scanLimiter, (req, res) => res.redirect(307, '/api/geo-seo'));
app.post('/api/gdpr-compliance', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(advancedAnalyzersController.analyzeGDPR));

// Accessibility Analyzer
const accessibilityController = require('./controllers/accessibilityController');
app.post('/api/accessibility', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(accessibilityController.analyzeAccessibility));

// Security Scanner
const securityController = require('./controllers/securityController');
app.post('/api/security', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(securityController.analyzeSecurity));

// IP/Domain Reputation Analyzer
const ipReputationController = require('./controllers/ipReputationController');
app.post('/api/ip-reputation', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(ipReputationController.analyzeIPReputation));

// Contact form
const contactController = require('./controllers/contactController');
app.post('/api/contact', contactLimiter, contactController.submitContact);


// Tag Intelligence, Enhanced Fonts, Performance Snapshot, Crawler (monetization features)
const tagIntelligenceController = require('./controllers/tagIntelligenceController');
app.post('/api/tag-intelligence', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(tagIntelligenceController.analyzeTagIntelligence));
app.post('/api/enhanced-fonts', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(tagIntelligenceController.analyzeEnhancedFonts));
app.post('/api/performance-snapshot', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(tagIntelligenceController.analyzePerformanceSnapshot));
app.post('/api/crawl', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(tagIntelligenceController.crawlSite));

// Mobile Testing Suite
const mobileAnalyzerController = require('./controllers/mobileAnalyzerController');
app.post('/api/mobile-analyze', optionalAuth, checkScanQuota, scanLimiter, withUsageTracking(mobileAnalyzerController.analyzeMobile));

// Download PDF report (legacy - for font scanner)
app.get('/api/reports/:filename', downloadLimiter, scanController.downloadReport);

// PDF Payment & Download endpoints
const pdfController = require('./controllers/pdfController');
app.get('/api/pdf/pricing', pdfController.getPricing);
app.post('/api/pdf/purchase', scanLimiter, pdfController.purchasePDFReport);
app.get('/api/pdf/download/:token', downloadLimiter, pdfController.downloadPDFReport);
const { requirePdfExport, enforcePageLimit } = require('./middleware/entitlementGuard');
app.post('/api/pdf/generate', scanLimiter, requireAuth, requirePdfExport, pdfController.generatePDF);
app.post('/api/pdf/render', scanLimiter, requireAuth, requirePdfExport, pdfController.renderPDF);

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Site Mechanic API is working',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: [
      'Basic font analysis',
      'Comprehensive multi-page scanning',
      'Lighthouse integration',
      'Desktop/Mobile comparison',
      'PDF report generation',
    ],
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.ico'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware (must be last)
app.use(errorMiddleware);

// Socket.IO connection handling
io.on('connection', (socket) => {
  logger.info('Client connected to WebSocket', { socketId: socket.id });
  
  // Handle scan room joining
  socket.on('join-scan', (scanId) => {
    socket.join(scanId);
    logger.info(`Socket ${socket.id} joined scan room: ${scanId}`);
  });
  
  // Handle competitive analysis session joining
  socket.on('join-session', (sessionId) => {
    socket.join(sessionId);
    logger.info(`Socket ${socket.id} joined competitive analysis session: ${sessionId}`);
  });

  // Admin health dashboard — authenticated room join
  socket.on('join-admin-health', async (token) => {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, config.jwt.secret, { algorithms: [config.jwt.algorithm] });
      const db = getDatabase();
      const user = await db.get('SELECT is_admin FROM users WHERE id = ?', [decoded.id || decoded.userId]);
      if (!user || !user.is_admin) {
        socket.emit('admin:health-error', { error: 'Not authorized' });
        return;
      }
      socket.join('admin-health');
      logger.info(`Socket ${socket.id} joined admin-health room`);
    } catch (err) {
      socket.emit('admin:health-error', { error: 'Authentication failed' });
    }
  });

  socket.on('leave-admin-health', () => {
    socket.leave('admin-health');
  });

  socket.on('disconnect', () => {
    logger.info('Client disconnected from WebSocket', { socketId: socket.id });
  });
  
  socket.on('error', (error) => {
    logger.error('Socket.IO error:', error);
  });
});

// Make io globally accessible for scan services
global.io = io;

// Start server
server.listen(PORT, () => {
  logger.info(`Site Mechanic server running on port ${PORT}`);
  logger.info(`Access the application at http://localhost:${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info('WebSocket server ready');
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed. All connections finished.');

    // Cleanup tasks
    logger.info('Performing cleanup tasks...');

    // Stop memory monitor interval
    try {
      if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        logger.info('Memory monitor stopped');
      }
    } catch (error) {
      logger.error('Error stopping memory monitor:', error);
    }

    // Stop health emitter interval
    try {
      if (healthEmitterInterval) {
        clearInterval(healthEmitterInterval);
        logger.info('Health emitter stopped');
      }
    } catch (error) {
      logger.error('Error stopping health emitter:', error);
    }

    // Stop report cleanup scheduler
    try {
      logger.info('Stopping report cleanup scheduler...');
      stopScheduledCleanup(cleanupInterval);
      logger.info('Report cleanup scheduler stopped');
    } catch (error) {
      logger.error('Error stopping report cleanup scheduler:', error);
    }

    // Drain browser pool
    try {
      logger.info('Draining browser pool...');
      await browserPool.drain();
      logger.info('Browser pool drained successfully');
    } catch (error) {
      logger.error('Error draining browser pool:', error);
    }

    // Close database connections
    try {
      logger.info('Closing database connection...');
      const db = getDatabase();
      await db.close();
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database:', error);
    }

    // Clear scan queue
    try {
      logger.info('Clearing scan queue...');
      const queue = getQueue();
      queue.clear();
      logger.info('Scan queue cleared');
    } catch (error) {
      logger.error('Error clearing scan queue:', error);
    }

    logger.info('Cleanup complete. Exiting process.');
    process.exit(0);
  });

  // Force shutdown after 30 seconds if graceful shutdown takes too long
  setTimeout(() => {
    logger.error('Graceful shutdown timeout exceeded. Forcing shutdown.');
    process.exit(1);
  }, 30000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Handle unhandled promise rejections - LOG BUT DON'T CRASH
// Lighthouse timeouts should fail gracefully without killing the server
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise);
  logger.error('Rejection reason:', reason);
  // DO NOT shutdown - let the request fail but keep server running
  // Only track for monitoring purposes
  if (global.io) {
    // Notify monitoring/admin endpoints if needed
    logger.warn('Server continuing despite unhandled rejection');
  }
});

module.exports = app;
