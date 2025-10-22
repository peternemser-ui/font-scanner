/**
 * Data Sanitization Utility
 * 
 * Removes sensitive information from logs, preventing exposure of:
 * - API keys and tokens in URLs
 * - Passwords and secrets
 * - Personal identifiable information (PII)
 * - Authentication credentials
 */

/**
 * Sanitize a URL by removing sensitive query parameters and credentials
 * @param {string} url - The URL to sanitize
 * @returns {string} - Sanitized URL safe for logging
 */
function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  try {
    const urlObj = new URL(url);
    
    // Remove username and password
    urlObj.username = '';
    urlObj.password = '';
    
    // List of sensitive query parameter names to redact
    const sensitiveParams = [
      'api_key', 'apikey', 'api-key',
      'token', 'access_token', 'accesstoken', 'auth_token', 'authtoken',
      'secret', 'api_secret', 'apisecret',
      'password', 'pass', 'pwd',
      'key', 'private_key', 'privatekey',
      'session', 'sessionid', 'session_id',
      'oauth', 'oauth_token', 'bearer',
      'credentials', 'auth', 'authorization',
      'client_secret', 'clientsecret',
      'refresh_token', 'refreshtoken'
    ];

    // Iterate through query parameters and redact sensitive ones
    const params = urlObj.searchParams;
    sensitiveParams.forEach(param => {
      if (params.has(param)) {
        params.set(param, '[REDACTED]');
      }
    });

    return urlObj.toString();
  } catch (error) {
    // If URL parsing fails, try basic sanitization
    return url
      .replace(/([?&])(api[_-]?key|token|secret|password|key)=([^&]+)/gi, '$1$2=[REDACTED]')
      .replace(/:\/\/([^:]+):([^@]+)@/g, '://[REDACTED]:[REDACTED]@');
  }
}

/**
 * Sanitize an object by removing or redacting sensitive fields
 * @param {Object} obj - The object to sanitize
 * @param {Array<string>} sensitiveKeys - Additional keys to redact
 * @returns {Object} - Sanitized object safe for logging
 */
function sanitizeObject(obj, sensitiveKeys = []) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  // Default sensitive keys
  const defaultSensitiveKeys = [
    'password', 'pwd', 'pass',
    'secret', 'api_secret', 'apiSecret',
    'token', 'access_token', 'accessToken', 'auth_token', 'authToken',
    'apiKey', 'api_key',
    'privateKey', 'private_key',
    'credentials', 'authorization', 'auth',
    'sessionId', 'session_id', 'session',
    'clientSecret', 'client_secret',
    'refreshToken', 'refresh_token',
    'bearer'
  ];

  const allSensitiveKeys = [...defaultSensitiveKeys, ...sensitiveKeys];

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    // If value is an object (not null, not Date), recurse first before checking sensitivity
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      // Recursively sanitize nested objects/arrays
      sanitized[key] = sanitizeObject(value, sensitiveKeys);
    } else if (key.toLowerCase() === 'url' && typeof value === 'string') {
      // Sanitize URLs
      sanitized[key] = sanitizeUrl(value);
    } else {
      // Check if this key is sensitive (case-insensitive match)
      const isSensitive = allSensitiveKeys.some(sensitiveKey => 
        key.toLowerCase().includes(sensitiveKey.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize error objects for safe logging
 * @param {Error} error - The error to sanitize
 * @returns {Object} - Sanitized error object
 */
function sanitizeError(error) {
  if (!(error instanceof Error)) {
    return sanitizeObject(error);
  }

  return {
    name: error.name,
    message: sanitizeString(error.message),
    stack: error.stack ? sanitizeString(error.stack) : undefined,
    code: error.code,
    ...sanitizeObject(error)
  };
}

/**
 * Sanitize a string by removing potential sensitive data patterns
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') {
    return str;
  }

  return str
    // Redact email addresses
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]')
    // Redact IP addresses (be careful not to break URLs)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[IP_REDACTED]')
    // Redact potential JWTs (three base64 segments separated by dots) - check before generic keys
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT_REDACTED]')
    // Redact potential API keys (long alphanumeric strings)
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[KEY_REDACTED]');
}

/**
 * Create a safe logging wrapper that sanitizes all arguments
 * @param {Function} logFn - The original logging function
 * @returns {Function} - Wrapped logging function with sanitization
 */
function createSafeLogger(logFn) {
  return function(message, data = {}) {
    const sanitizedMessage = typeof message === 'string' ? sanitizeString(message) : message;
    const sanitizedData = sanitizeObject(data);
    return logFn.call(this, sanitizedMessage, sanitizedData);
  };
}

/**
 * Sanitize request data for logging
 * @param {Object} req - Express request object
 * @returns {Object} - Sanitized request data
 */
function sanitizeRequest(req) {
  return {
    method: req.method,
    url: sanitizeUrl(req.url),
    originalUrl: sanitizeUrl(req.originalUrl),
    headers: sanitizeObject({
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'accept': req.headers['accept'],
      // Redact authorization header
      'authorization': req.headers['authorization'] ? '[REDACTED]' : undefined
    }),
    query: sanitizeObject(req.query),
    body: sanitizeObject(req.body),
    ip: req.ip || req.connection?.remoteAddress,
    requestId: req.requestId
  };
}

module.exports = {
  sanitizeUrl,
  sanitizeObject,
  sanitizeError,
  sanitizeString,
  createSafeLogger,
  sanitizeRequest
};
