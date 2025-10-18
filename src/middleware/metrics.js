const promClient = require('prom-client');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Metrics');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({
  register,
  prefix: 'font_scanner_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'font_scanner_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

const httpRequestTotal = new promClient.Counter({
  name: 'font_scanner_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

const scanDuration = new promClient.Histogram({
  name: 'font_scanner_scan_duration_seconds',
  help: 'Duration of font scan operations in seconds',
  labelNames: ['scan_type', 'status'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

const scanTotal = new promClient.Counter({
  name: 'font_scanner_scans_total',
  help: 'Total number of font scans',
  labelNames: ['scan_type', 'status'],
  registers: [register],
});

const activeScans = new promClient.Gauge({
  name: 'font_scanner_active_scans',
  help: 'Number of currently active font scans',
  registers: [register],
});

const errorTotal = new promClient.Counter({
  name: 'font_scanner_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route'],
  registers: [register],
});

// Middleware to track HTTP metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();

  // Track response
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route: route,
      status_code: res.statusCode,
    };

    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
  });

  next();
};

// Export metrics endpoint handler
const metricsHandler = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    logger.error('Error generating metrics:', error);
    res.status(500).end('Error generating metrics');
  }
};

// Helper functions to track scan metrics
const startScan = (scanType) => {
  activeScans.inc();
  return Date.now();
};

const endScan = (scanType, startTime, status) => {
  activeScans.dec();
  const duration = (Date.now() - startTime) / 1000;
  scanDuration.observe({ scan_type: scanType, status }, duration);
  scanTotal.inc({ scan_type: scanType, status });
};

const recordError = (type, route) => {
  errorTotal.inc({ type, route: route || 'unknown' });
};

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  startScan,
  endScan,
  recordError,
  metrics: {
    httpRequestDuration,
    httpRequestTotal,
    scanDuration,
    scanTotal,
    activeScans,
    errorTotal,
  },
};
