/**
 * URL validation utilities
 * @module validators
 */

/**
 * Test if a URL is actually reachable
 * @param {string} url - The URL to test
 * @param {number} timeout - Timeout in milliseconds (default: 5000)
 * @returns {Promise<boolean>} True if URL is reachable, false otherwise
 */
const testUrlReachability = async (url, timeout = 5000) => {
  try {
    const https = require('https');
    const http = require('http');
    const { URL } = require('url');
    
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    return new Promise((resolve) => {
      const req = client.request({
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: urlObj.pathname + urlObj.search,
        method: 'HEAD',
        timeout: timeout,
        headers: {
          'User-Agent': 'Font-Scanner/1.0'
        }
      }, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      
      req.end();
    });
  } catch (error) {
    return false;
  }
};

/**
 * Normalize URL by automatically adding protocol if missing
 * @param {string} url - The URL to normalize
 * @returns {string} Normalized URL with protocol
 */
const normalizeUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Trim whitespace
  url = url.trim();

  // If URL already has a protocol, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Remove any protocol-like prefixes that might be incomplete
  url = url.replace(/^[a-zA-Z]+:\/\//, '');

  // Try HTTPS first (more secure and common)
  return `https://${url}`;
};

/**
 * Validate if a string is a valid HTTP or HTTPS URL
 * @param {string} url - The URL to validate
 * @returns {boolean} True if valid HTTP/HTTPS URL, false otherwise
 * @example
 * validateUrl('https://example.com') // returns true
 * validateUrl('ftp://example.com') // returns false
 */
const validateUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Check URL length to prevent DoS
  if (url.length > 2048) {
    return false;
  }

  try {
    const urlObj = new URL(url);

    // Only allow HTTP and HTTPS protocols
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return false;
    }

    // Validate hostname exists and is not empty
    if (!urlObj.hostname || urlObj.hostname.length === 0) {
      return false;
    }

    // Prevent file:// and other dangerous protocols
    if (urlObj.protocol === 'file:' || urlObj.protocol === 'javascript:') {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Sanitize URL by removing potentially dangerous characters
 * @param {string} url - The URL to sanitize
 * @returns {string} Sanitized URL
 */
const sanitizeUrl = (url) => {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Trim whitespace
  url = url.trim();

  // Remove any potentially dangerous characters
  url = url.replace(/[<>"\s]/g, '');
  
  // Remove control characters using string methods
  url = url.split('').filter(char => {
    const code = char.charCodeAt(0);
    return code > 31 && code !== 127;
  }).join('');

  // Prevent URL confusion attacks
  url = url.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width characters

  return url;
};

/**
 * Validate if URL has a valid domain name
 * @param {string} url - The URL to validate
 * @returns {boolean} True if domain is valid, false otherwise
 */
const isValidDomain = (url) => {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Prevent localhost and private IPs in production
    if (process.env.NODE_ENV === 'production') {
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
        return false;
      }

      // Block private IP ranges
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipRegex.test(hostname)) {
        const parts = hostname.split('.').map(Number);

        // Validate IP octets are in valid range
        if (parts.some(part => part > 255)) {
          return false;
        }

        // Block private IP ranges:
        // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
        // Also block 169.254.0.0/16 (link-local), 127.0.0.0/8 (loopback)
        if (
          parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168) ||
          (parts[0] === 169 && parts[1] === 254) ||
          parts[0] === 127
        ) {
          return false;
        }
      }

      // Block IPv6 localhost and private addresses
      if (hostname === '::1' || hostname.startsWith('fe80:') || hostname.startsWith('fc00:')) {
        return false;
      }
    }

    // Basic domain validation - must have at least one dot (except localhost)
    if (process.env.NODE_ENV !== 'development' && !hostname.includes('.')) {
      return false;
    }

    // Validate domain format
    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9])*$/;

    // Allow localhost in development
    if (process.env.NODE_ENV === 'development' && hostname === 'localhost') {
      return true;
    }

    return domainRegex.test(hostname);
  } catch (error) {
    return false;
  }
};

/**
 * Validate scan type parameter
 * @param {string} scanType - The scan type to validate
 * @returns {boolean} True if valid scan type, false otherwise
 */
const validateScanType = (scanType) => {
  const validTypes = ['basic', 'comprehensive'];
  return validTypes.includes(scanType);
};

/**
 * Validate timeout value
 * @param {number} timeout - The timeout value in milliseconds
 * @param {number} min - Minimum allowed timeout (default: 1000ms)
 * @param {number} max - Maximum allowed timeout (default: 300000ms = 5 min)
 * @returns {boolean} True if timeout is valid, false otherwise
 */
const validateTimeout = (timeout, min = 1000, max = 300000) => {
  return typeof timeout === 'number' &&
         !isNaN(timeout) &&
         timeout >= min &&
         timeout <= max;
};

/**
 * Validate port number
 * @param {number} port - The port number to validate
 * @returns {boolean} True if port is valid, false otherwise
 */
const validatePort = (port) => {
  return typeof port === 'number' &&
         Number.isInteger(port) &&
         port >= 1 &&
         port <= 65535;
};

/**
 * Sanitize string to prevent injection attacks
 * @param {string} input - The string to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 1000)
 * @returns {string} Sanitized string
 */
const sanitizeString = (input, maxLength = 1000) => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Trim and limit length
  let sanitized = input.trim().substring(0, maxLength);

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[<>{}\\]/g, '');

  return sanitized;
};

module.exports = {
  testUrlReachability,
  normalizeUrl,
  validateUrl,
  sanitizeUrl,
  isValidDomain,
  validateScanType,
  validateTimeout,
  validatePort,
  sanitizeString,
};
