/**
 * Centralized error handling utilities
 */

const { createLogger } = require('./logger');
const { recordError } = require('./errorTelemetry');
const config = require('../config');

const logger = createLogger('ErrorHandler');

/**
 * Custom application errors
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

class TimeoutError extends AppError {
  constructor(message = 'Request timeout') {
    super(message, 408);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503);
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Parse Puppeteer/network errors and convert to appropriate AppError
 * @param {Error} error - The error to parse
 * @returns {AppError} Parsed and categorized error
 */
function parsePuppeteerError(error) {
  const message = error.message || '';

  // Timeout errors
  if (error.name === 'TimeoutError' || message.includes('timeout') || message.includes('Navigation timeout')) {
    return new TimeoutError('The website took too long to load. Please try again or check if the site is accessible.');
  }

  // DNS resolution errors
  if (message.includes('net::ERR_NAME_NOT_RESOLVED') || message.includes('ENOTFOUND')) {
    return new NotFoundError('Could not resolve the website address. Please check the URL and try again.');
  }

  // Connection errors
  if (message.includes('net::ERR_CONNECTION_REFUSED') || message.includes('ECONNREFUSED')) {
    return new ServiceUnavailableError('Could not connect to the website. The server may be down or refusing connections.');
  }

  if (message.includes('net::ERR_CONNECTION_TIMED_OUT') || message.includes('ETIMEDOUT')) {
    return new TimeoutError('Connection to the website timed out. The server may be slow or unreachable.');
  }

  if (message.includes('net::ERR_CONNECTION_RESET') || message.includes('ECONNRESET')) {
    return new ServiceUnavailableError('Connection was reset by the server. Please try again.');
  }

  // SSL/TLS errors
  if (message.includes('net::ERR_CERT') || message.includes('certificate') || message.includes('SSL')) {
    return new AppError('SSL certificate error. The website may have security issues or an invalid certificate.', 502);
  }

  // Redirect errors
  if (message.includes('net::ERR_TOO_MANY_REDIRECTS')) {
    return new AppError('Too many redirects encountered. The website may have a redirect loop.', 508);
  }

  // Access denied / bot detection errors
  if (message.includes('net::ERR_ACCESS_DENIED') || 
      message.includes('403') ||
      message.includes('blocked') ||
      message.includes('captcha') ||
      message.includes('bot detection') ||
      message.includes('cloudflare') ||
      message.includes('access denied')) {
    return new AppError('Access denied. This website uses bot protection and cannot be analyzed. Try a different website or contact the site owner.', 403);
  }

  // Protocol errors
  if (message.includes('ERR_ABORTED') || message.includes('ERR_FAILED')) {
    return new AppError('Request failed or was aborted. Please try again.', 500);
  }

  // Browser/Puppeteer specific errors
  if (message.includes('browser has disconnected') || message.includes('Target closed')) {
    return new ServiceUnavailableError('Browser connection lost. Please try again.');
  }

  // Scanner overloaded: pool couldn't serve the request in time
  if (message.includes('Browser pool execute timed out') ||
      message.includes('Browser pool acquisition failed')) {
    return new TimeoutError('The analysis timed out because the scanner is busy. Please try again in a minute.');
  }

  // Browser crashed mid-scan (renderer killed, e.g. under memory pressure)
  if (message.includes('Requesting main frame too early') ||
      message.includes('Target crashed') ||
      message.includes('Session closed')) {
    return new ServiceUnavailableError('The scanning browser crashed while analyzing this site. Please try again.');
  }

  if (message.includes('Protocol error')) {
    return new AppError('Browser protocol error occurred. Please try again.', 500);
  }

  // Default to original error if not recognized
  return error;
}

/**
 * Format error response — safe for public consumption.
 * In production, 5xx errors get a generic message to avoid leaking internals.
 */
function formatErrorResponse(error, includeStack = false) {
  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;
  const isProduction = process.env.NODE_ENV === 'production';

  const response = {
    error: (isServerError && isProduction) ? 'InternalError' : (error.name || 'Error'),
    message: (isServerError && isProduction && !error.isOperational)
      ? 'An unexpected error occurred. Please try again later.'
      : (error.message || 'An unexpected error occurred'),
    timestamp: new Date().toISOString(),
  };

  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Redact sensitive fields from an object before logging.
 */
const SENSITIVE_KEYS = new Set([
  'password', 'currentPassword', 'newPassword', 'confirmPassword',
  'token', 'resetToken', 'authorization', 'secret',
  'credit_card', 'card_number', 'cvv', 'ssn',
]);

function redactSensitive(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const redacted = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase ? key.toLowerCase() : key)) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

/**
 * Error logging with context
 */
function logError(error, context = {}) {
  // Redact sensitive data from request body before logging
  if (context.body) {
    context = { ...context, body: redactSensitive(context.body) };
  }

  const errorInfo = {
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    stack: error.stack,
    ...context,
  };

  if (error.isOperational) {
    logger.warn('Operational error', errorInfo);
  } else {
    logger.error('Unexpected error', errorInfo);
  }
}

/**
 * Express error middleware
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  // Parse special error types. Only raw errors (no statusCode) — typed
  // AppErrors already carry an intentional status and message, and their
  // text could false-match the keyword patterns.
  let error = err;
  if (err.message && !err.statusCode) {
    error = parsePuppeteerError(err);
  }

  // Stripe errors: never forward Stripe's HTTP status to the client.
  // A Stripe 401 (invalid API key) or 402 (card declined) is a server-side
  // payment provider issue, not a client auth failure. Map to 502.
  if (err.type === 'StripeAuthenticationError' || err.type === 'StripeAPIError' ||
      err.type === 'StripeConnectionError' || err.type === 'StripeRateLimitError' ||
      (err.raw && err.raw.type && err.raw.type.startsWith('invalid_request'))) {
    error = new AppError(
      'Payment service error. Please try again later.',
      502,
      true
    );
  }

  // Log error
  logError(error, {
    url: req.url,
    method: req.method,
    body: req.body,
  });

  // Record in telemetry (if enabled)
  if (config.errorTelemetry?.enabled) {
    recordError(error, {
      requestId: req.id,
      url: req.url,
      method: req.method,
      userAgent: req.get('user-agent'),
      ip: req.ip,
      statusCode: error.statusCode
    });
  }

  // Send response
  const statusCode = error.statusCode || 500;
  const includeStack = process.env.NODE_ENV === 'development';

  res.status(statusCode).json(formatErrorResponse(error, includeStack));
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  TimeoutError,
  ServiceUnavailableError,
  asyncHandler,
  parsePuppeteerError,
  formatErrorResponse,
  logError,
  errorMiddleware,
};
