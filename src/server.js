const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

const scanController = require('./controllers/scanController');
const config = require('./config');
const { createLogger } = require('./utils/logger');
const { errorMiddleware } = require('./utils/errorHandler');
const { metricsMiddleware, metricsHandler } = require('./middleware/metrics');

const logger = createLogger('Server');
const app = express();
const PORT = config.port;

// Health check state
let isShuttingDown = false;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
});

app.use(limiter);

// CORS
app.use(
  cors({
    origin: config.nodeEnv === 'production' ? false : true,
  })
);

// Compression
app.use(compression());

// Logging
app.use(morgan('combined'));

// Metrics middleware
app.use(metricsMiddleware);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/api/scan', scanController.scanWebsite);
app.post('/api/scan/best-in-class', scanController.performBestInClassScan);

// Download PDF report
app.get('/api/reports/:filename', scanController.downloadReport);

// Test endpoint for debugging
app.get('/api/test', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Font Scanner API is working',
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

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Font Scanner server running on port ${PORT}`);
  logger.info(`Access the application at http://localhost:${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  isShuttingDown = true;

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed. All connections finished.');

    // Cleanup tasks
    logger.info('Performing cleanup tasks...');

    // Close database connections, cleanup resources, etc.
    // Add your cleanup logic here

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

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

module.exports = app;
