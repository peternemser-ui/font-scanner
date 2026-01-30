// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
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
  getRateLimitAnalytics
} = require('./middleware/rateLimiter');
const browserPool = require('./utils/browserPool');
const {
  startScheduledCleanup,
  stopScheduledCleanup,
  getCleanupStats
} = require('./utils/reportCleanup');
const { optionalAuth } = require('./middleware/requireAuth');

const logger = createLogger('Server');

// Production environment validation
if (config.nodeEnv === 'production') {
  if (!config.cors.origin) {
    logger.error('CORS_ORIGIN must be set in production');
    process.exit(1);
  }
  if (!process.env.JWT_SECRET) {
    logger.error('JWT_SECRET must be set in production');
    process.exit(1);
  }
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
let memoryMonitorInterval = setInterval(() => {
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

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.socket.io',
          'https://cdn.jsdelivr.net',
          'https://js.stripe.com'
        ],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.stripe.com', 'wss:', 'ws:'],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
// Rate limiting - Global limiter for all requests
app.use(globalLimiter);

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

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve generated report artifacts (PDFs, screenshots)
// NOTE: config.reports.dir is repo-relative by default (./reports)
app.use('/reports', express.static(path.resolve(process.cwd(), config.reports.dir)));

// Routes
// Liveness probe - checks if app is alive
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Version endpoint
app.get('/api/version', (req, res) => {
  const { execSync } = require('child_process');
  const packageJson = require('../package.json');
  
  let gitHash = 'unknown';
  let gitBranch = 'unknown';
  
  try {
    gitHash = execSync('git rev-parse --short HEAD').toString().trim();
    gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
  } catch (error) {
    logger.warn('Could not retrieve git information');
  }
  
  res.json({
    version: packageJson.version,
    git: {
      hash: gitHash,
      branch: gitBranch
    },
    build: `${packageJson.version}-${gitHash}`
  });
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
app.get('/metrics', metricsHandler);

// Rate limit stats endpoint (for monitoring)
app.get('/api/rate-limits', (req, res) => {
  res.json({
    limits: getRateLimitStats(),
    message: 'Current rate limit configuration',
  });
});

// Enhanced rate limit analytics endpoint (detailed monitoring)
app.get('/api/admin/rate-limits', (req, res) => {
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

// Error telemetry analytics endpoint
app.get('/api/admin/errors', (req, res) => {
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

// Get specific error details
app.get('/api/admin/errors/:errorId', (req, res) => {
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

// New async scan API
const scanRoutes = require('./routes/scan.routes');
app.use('/api/scans', scanRoutes);

// Legacy scan endpoints (keep for backwards compatibility)
app.post('/api/scan', scanLimiter, scanController.scanWebsite);
app.post('/api/scan/best-in-class', scanLimiter, scanController.performBestInClassScan);
app.post('/api/seo', scanLimiter, scanController.performSEOScan);

// Performance Analyzer
const performanceController = require('./controllers/performanceController');
app.post('/api/performance', scanLimiter, performanceController.analyzePerformance);
app.post('/api/performance/cross-browser', scanLimiter, performanceController.analyzeCrossBrowser);

// Core Web Vitals Analyzer (Google Ranking Factor)
const coreWebVitalsController = require('./controllers/coreWebVitalsController');
app.post('/api/core-web-vitals', scanLimiter, coreWebVitalsController.analyzeCoreWebVitals);

// Competitive Analysis Tool (VERY resource-intensive - strict rate limiting)
const competitiveAnalysisController = require('./controllers/competitiveAnalysisController');
competitiveAnalysisController.setSocketIO(io); // Inject Socket.IO for real-time progress
app.post('/api/competitive-analysis', competitiveAnalysisLimiter, competitiveAnalysisController.analyzeCompetitors);

// Broken Link Checker
const brokenLinkController = require('./controllers/brokenLinkController');
app.post('/api/broken-links', scanLimiter, brokenLinkController.checkBrokenLinks);

// Advanced Analyzers (CRO, Brand, Local SEO, GDPR)
const advancedAnalyzersController = require('./controllers/advancedAnalyzersController');
app.post('/api/cro-analysis', scanLimiter, advancedAnalyzersController.analyzeCRO);
app.post('/api/brand-consistency', scanLimiter, advancedAnalyzersController.analyzeBrand);
app.post('/api/local-seo', scanLimiter, advancedAnalyzersController.analyzeLocalSEO);
app.post('/api/gdpr-compliance', scanLimiter, advancedAnalyzersController.analyzeGDPR);

// Accessibility Analyzer
const accessibilityController = require('./controllers/accessibilityController');
app.post('/api/accessibility', scanLimiter, accessibilityController.analyzeAccessibility);

// Security Scanner
const securityController = require('./controllers/securityController');
app.post('/api/security', scanLimiter, securityController.analyzeSecurity);

// IP/Domain Reputation Analyzer
const ipReputationController = require('./controllers/ipReputationController');
app.post('/api/ip-reputation', scanLimiter, ipReputationController.analyzeIPReputation);

// Contact form
const contactController = require('./controllers/contactController');
app.post('/api/contact', contactLimiter, contactController.submitContact);

// Hosting Pricing Analyzer
const hostingController = require('./controllers/hostingController');
app.post('/api/hosting/analyze', scanLimiter, hostingController.analyzeHosting);
app.get('/api/hosting/providers', hostingController.getProviders);
app.get('/api/hosting/providers/:cmsType', hostingController.getProvidersByCMS);

// Tag Intelligence, Enhanced Fonts, Performance Snapshot, Crawler (monetization features)
const tagIntelligenceController = require('./controllers/tagIntelligenceController');
app.post('/api/tag-intelligence', scanLimiter, tagIntelligenceController.analyzeTagIntelligence);
app.post('/api/enhanced-fonts', scanLimiter, tagIntelligenceController.analyzeEnhancedFonts);
app.post('/api/performance-snapshot', scanLimiter, tagIntelligenceController.analyzePerformanceSnapshot);
app.post('/api/crawl', scanLimiter, tagIntelligenceController.crawlSite);

// Mobile Testing Suite
const mobileAnalyzerController = require('./controllers/mobileAnalyzerController');
app.post('/api/mobile-analyze', scanLimiter, mobileAnalyzerController.analyzeMobile);

// Download PDF report (legacy - for font scanner)
app.get('/api/reports/:filename', downloadLimiter, scanController.downloadReport);

// PDF Payment & Download endpoints
const pdfController = require('./controllers/pdfController');
app.get('/api/pdf/pricing', pdfController.getPricing);
app.post('/api/pdf/purchase', scanLimiter, pdfController.purchasePDFReport);
app.get('/api/pdf/download/:token', downloadLimiter, pdfController.downloadPDFReport);
app.post('/api/pdf/generate', scanLimiter, optionalAuth, pdfController.generatePDF);
app.post('/api/pdf/render', scanLimiter, optionalAuth, pdfController.renderPDF);

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
