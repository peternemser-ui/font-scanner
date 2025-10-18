/**
 * Request ID Middleware
 * Generates unique IDs for each request to track it through the entire lifecycle
 * Enables correlation of logs across services and components
 */

const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../utils/logger');

const logger = createLogger('RequestId');

/**
 * Middleware to attach a unique request ID to each incoming request
 * The ID is available in:
 * - req.id - For use in route handlers
 * - res.locals.requestId - For use in templates
 * - X-Request-ID header - Returned to client
 */
const requestIdMiddleware = (req, res, next) => {
  // Check if client sent a request ID (useful for tracing across services)
  const clientRequestId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  
  // Generate new ID or use client's ID
  const requestId = clientRequestId || uuidv4();
  
  // Attach to request object
  req.id = requestId;
  req.requestId = requestId; // Alias for convenience
  
  // Make available in response locals
  res.locals.requestId = requestId;
  
  // Set response header so client can track their request
  res.setHeader('X-Request-ID', requestId);
  
  // Log request received
  logger.debug(`Request received`, {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  });
  
  // Track request timing
  const startTime = Date.now();
  
  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info(`Request completed`, {
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
    });
  });
  
  next();
};

module.exports = requestIdMiddleware;
