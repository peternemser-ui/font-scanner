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

const logger = createLogger('Server');
const app = express();
const PORT = config.port;

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

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/scan', scanController.scanWebsite);

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
app.listen(PORT, () => {
  logger.info(`Font Scanner server running on port ${PORT}`);
  logger.info(`Access the application at http://localhost:${PORT}`);
});

module.exports = app;
