/**
 * Formatting Helper Utilities
 *
 * Consolidates scattered formatting patterns used across 30+ services:
 * - Number formatting with .toFixed()
 * - Byte size formatting (KB, MB, GB)
 * - Duration formatting (milliseconds → seconds)
 * - Percentage formatting
 * - String truncation
 *
 * @module utils/formatHelpers
 */

/**
 * Format bytes to human-readable format (KB, MB, GB)
 *
 * Consolidates the pattern: (bytes / 1024 / 1024).toFixed(2)
 * Used in 20+ services for file sizes, transfer sizes, etc.
 *
 * @param {number} bytes - Size in bytes
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted string with unit (e.g., "2.45 MB")
 *
 * @example
 * formatBytes(1024) // "1.00 KB"
 * formatBytes(1536, 0) // "2 KB"
 * formatBytes(1048576) // "1.00 MB"
 * formatBytes(5242880) // "5.00 MB"
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0 || bytes === null || bytes === undefined) return '0 Bytes';
  if (isNaN(bytes)) return 'N/A';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  return `${roundTo(value, decimals)} ${sizes[i]}`;
}

/**
 * Format duration from milliseconds to seconds
 *
 * Consolidates the pattern: (ms / 1000).toFixed(1) or .toFixed(2)
 * Used in 30+ services for timing metrics, load times, etc.
 *
 * @param {number} milliseconds - Duration in milliseconds
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {string} Formatted duration with 's' suffix
 *
 * @example
 * formatDuration(1500) // "1.50s"
 * formatDuration(3250, 1) // "3.3s"
 * formatDuration(500, 0) // "1s"
 */
function formatDuration(milliseconds, decimals = 2) {
  if (milliseconds === null || milliseconds === undefined) return 'N/A';
  if (isNaN(milliseconds)) return 'N/A';

  const seconds = milliseconds / 1000;
  return `${roundTo(seconds, decimals)}s`;
}

/**
 * Format duration in long form (human-readable)
 *
 * Converts milliseconds to a readable format like "2m 30s" or "1h 15m"
 *
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Human-readable duration
 *
 * @example
 * formatDurationLong(1500) // "1s"
 * formatDurationLong(65000) // "1m 5s"
 * formatDurationLong(3665000) // "1h 1m"
 */
function formatDurationLong(milliseconds) {
  if (milliseconds === null || milliseconds === undefined) return 'N/A';
  if (isNaN(milliseconds)) return 'N/A';

  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  } else if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Round number to specified decimal places
 *
 * Consolidates the pattern: parseFloat(num.toFixed(decimals))
 * Returns a number (not string) for further calculations
 *
 * @param {number} num - Number to round
 * @param {number} decimals - Number of decimal places (default: 2)
 * @returns {number} Rounded number
 *
 * @example
 * roundTo(3.14159, 2) // 3.14
 * roundTo(42.7, 0) // 43
 * roundTo(1.005, 2) // 1.01
 */
function roundTo(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return 0;

  const multiplier = Math.pow(10, decimals);
  return Math.round(num * multiplier) / multiplier;
}

/**
 * Clamp number between min and max values
 *
 * Used extensively in scoring calculations to ensure 0-100 range
 *
 * @param {number} num - Number to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped number
 *
 * @example
 * clamp(150, 0, 100) // 100
 * clamp(-10, 0, 100) // 0
 * clamp(50, 0, 100) // 50
 */
function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

/**
 * Format percentage value
 *
 * Handles both decimal (0.85) and percentage (85) inputs
 * Consolidates Math.round(num * 100) pattern
 *
 * @param {number} value - Value to format (0-1 or 0-100)
 * @param {boolean} asDecimal - If true, value is 0-1; if false, value is 0-100
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage with '%' suffix
 *
 * @example
 * formatPercentage(0.856, true) // "85.6%"
 * formatPercentage(85.6, false) // "85.6%"
 * formatPercentage(0.5, true, 0) // "50%"
 */
function formatPercentage(value, asDecimal = false, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';

  const percentage = asDecimal ? value * 100 : value;
  return `${roundTo(percentage, decimals)}%`;
}

/**
 * Truncate string to max length with ellipsis
 *
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length (including ellipsis)
 * @returns {string} Truncated string
 *
 * @example
 * truncate("Long description here", 10) // "Long de..."
 * truncate("Short", 10) // "Short"
 */
function truncate(str, maxLength) {
  if (!str || str.length <= maxLength) return str || '';
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * Parse performance timing object and format durations
 *
 * Converts raw performance timing values to formatted seconds
 * Used in performance analyzers
 *
 * @param {Object} timing - Performance timing object
 * @returns {Object} Formatted timing object with durations in seconds
 *
 * @example
 * parsePerformanceTiming({ domContentLoaded: 1200, loadComplete: 2500 })
 * // { domContentLoaded: "1.20s", loadComplete: "2.50s" }
 */
function parsePerformanceTiming(timing) {
  if (!timing || typeof timing !== 'object') return {};

  const formatted = {};
  for (const [key, value] of Object.entries(timing)) {
    if (typeof value === 'number') {
      formatted[key] = formatDuration(value);
    } else {
      formatted[key] = value;
    }
  }
  return formatted;
}

/**
 * Format number with commas (thousands separator)
 *
 * @param {number} num - Number to format
 * @returns {string} Formatted number with commas
 *
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(999) // "999"
 */
function formatNumber(num) {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  return num.toLocaleString('en-US');
}

/**
 * Format score to grade letter (A-F)
 *
 * Common mapping used across analyzers
 *
 * @param {number} score - Score value (0-100)
 * @returns {string} Grade letter
 *
 * @example
 * scoreToGrade(95) // "A"
 * scoreToGrade(75) // "B"
 * scoreToGrade(45) // "D"
 */
function scoreToGrade(score) {
  if (score === null || score === undefined || isNaN(score)) return 'N/A';

  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

module.exports = {
  formatBytes,
  formatDuration,
  formatDurationLong,
  roundTo,
  clamp,
  formatPercentage,
  truncate,
  parsePerformanceTiming,
  formatNumber,
  scoreToGrade
};
