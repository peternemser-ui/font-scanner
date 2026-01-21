/**
 * Error Telemetry Service
 * 
 * Tracks, aggregates, and analyzes application errors for monitoring and alerting.
 * Provides insights into error patterns, rates, and trends.
 * 
 * Features:
 * - Error aggregation by type and message
 * - Error rate tracking with time windows
 * - Configurable retention and limits
 * - Error categorization (operational vs programming)
 * - Context capture (request ID, user agent, etc.)
 * - Memory-efficient circular buffer storage
 * 
 * @module utils/errorTelemetry
 */

const { createLogger } = require('./logger');
const config = require('../config');

const logger = createLogger('ErrorTelemetry');

/**
 * Error telemetry storage and statistics
 */
class ErrorTelemetry {
  constructor(options = {}) {
    // Configuration
    this.maxErrors = options.maxErrors || config.errorTelemetry?.maxErrors || 1000;
    this.maxAggregations = options.maxAggregations || config.errorTelemetry?.maxAggregations || 100;
    this.retentionHours = options.retentionHours || config.errorTelemetry?.retentionHours || 24;
    
    // Storage
    this.errors = []; // Circular buffer of recent errors
    this.aggregations = new Map(); // Error type/message aggregations
    this.statistics = {
      total: 0,
      byType: {},
      byCategory: {},
      hourly: [],
      daily: []
    };
    
    // Error rate tracking
    this.errorRates = {
      lastMinute: [],
      lastHour: [],
      lastDay: []
    };
    
    // Initialize cleanup interval
    this.startCleanup();
  }

  /**
   * Record an error occurrence
   * @param {Error} error - The error object
   * @param {Object} context - Additional context (requestId, url, etc.)
   */
  recordError(error, context = {}) {
    try {
      const errorEntry = {
        id: this.generateErrorId(),
        timestamp: Date.now(),
        type: error.name || 'Error',
        message: error.message,
        stack: error.stack,
        category: this.categorizeError(error),
        statusCode: error.statusCode || context.statusCode || 500,
        isOperational: error.isOperational !== undefined ? error.isOperational : false,
        context: {
          requestId: context.requestId,
          url: context.url,
          method: context.method,
          userAgent: context.userAgent,
          ip: context.ip,
          userId: context.userId
        }
      };

      // Add to circular buffer
      if (this.errors.length >= this.maxErrors) {
        this.errors.shift(); // Remove oldest
      }
      this.errors.push(errorEntry);

      // Update aggregations
      this.aggregateError(errorEntry);

      // Update statistics
      this.updateStatistics(errorEntry);

      // Update error rates
      this.updateErrorRates(errorEntry);

      // Log the error
      logger.error('Error recorded in telemetry', {
        errorId: errorEntry.id,
        type: errorEntry.type,
        message: errorEntry.message,
        category: errorEntry.category,
        requestId: context.requestId
      });

      return errorEntry.id;
    } catch (err) {
      // Don't let telemetry errors break the application
      logger.error('Failed to record error in telemetry', { error: err.message });
      return null;
    }
  }

  /**
   * Get aggregated error statistics
   * @param {Object} options - Filter options
   * @returns {Object} Aggregated statistics
   */
  getStatistics(options = {}) {
    const { timeWindow = 'all', category = null, type = null } = options;

    const cutoffTime = this.getTimeWindowCutoff(timeWindow);
    const filteredErrors = this.errors.filter(err => {
      if (cutoffTime && err.timestamp < cutoffTime) return false;
      if (category && err.category !== category) return false;
      if (type && err.type !== type) return false;
      return true;
    });

    return {
      summary: {
        total: filteredErrors.length,
        timeWindow,
        startTime: cutoffTime ? new Date(cutoffTime).toISOString() : null,
        endTime: new Date().toISOString()
      },
      byType: this.groupBy(filteredErrors, 'type'),
      byCategory: this.groupBy(filteredErrors, 'category'),
      byStatusCode: this.groupBy(filteredErrors, 'statusCode'),
      errorRate: this.calculateErrorRate(filteredErrors, timeWindow),
      topErrors: this.getTopErrors(filteredErrors, 10),
      recentErrors: filteredErrors.slice(-20).reverse()
    };
  }

  /**
   * Get error rate information
   * @returns {Object} Error rate statistics
   */
  getErrorRates() {
    const now = Date.now();
    
    return {
      lastMinute: this.errorRates.lastMinute.filter(t => now - t < 60000).length,
      lastHour: this.errorRates.lastHour.filter(t => now - t < 3600000).length,
      lastDay: this.errorRates.lastDay.filter(t => now - t < 86400000).length,
      rates: {
        perMinute: this.calculateRate(this.errorRates.lastHour, 60),
        perHour: this.calculateRate(this.errorRates.lastDay, 24)
      },
      thresholds: {
        minute: config.errorTelemetry?.thresholds?.minute || 10,
        hour: config.errorTelemetry?.thresholds?.hour || 100,
        day: config.errorTelemetry?.thresholds?.day || 1000
      }
    };
  }

  /**
   * Get detailed error information by ID
   * @param {string} errorId - The error ID
   * @returns {Object|null} Error details
   */
  getErrorById(errorId) {
    return this.errors.find(err => err.id === errorId) || null;
  }

  /**
   * Get similar errors (by type and message similarity)
   * @param {string} errorId - The reference error ID
   * @param {number} limit - Maximum number of similar errors
   * @returns {Array} Similar errors
   */
  getSimilarErrors(errorId, limit = 10) {
    const error = this.getErrorById(errorId);
    if (!error) return [];

    return this.errors
      .filter(err => 
        err.id !== errorId && 
        err.type === error.type &&
        this.calculateSimilarity(err.message, error.message) > 0.7
      )
      .slice(0, limit);
  }

  /**
   * Check if error rates exceed thresholds
   * @returns {Object} Threshold violations
   */
  checkThresholds() {
    const rates = this.getErrorRates();
    const violations = [];

    if (rates.lastMinute > rates.thresholds.minute) {
      violations.push({
        level: 'critical',
        window: 'minute',
        current: rates.lastMinute,
        threshold: rates.thresholds.minute,
        message: `Error rate (${rates.lastMinute}/min) exceeds threshold (${rates.thresholds.minute}/min)`
      });
    }

    if (rates.lastHour > rates.thresholds.hour) {
      violations.push({
        level: 'warning',
        window: 'hour',
        current: rates.lastHour,
        threshold: rates.thresholds.hour,
        message: `Error rate (${rates.lastHour}/hour) exceeds threshold (${rates.thresholds.hour}/hour)`
      });
    }

    if (rates.lastDay > rates.thresholds.day) {
      violations.push({
        level: 'warning',
        window: 'day',
        current: rates.lastDay,
        threshold: rates.thresholds.day,
        message: `Error rate (${rates.lastDay}/day) exceeds threshold (${rates.thresholds.day}/day)`
      });
    }

    return {
      hasViolations: violations.length > 0,
      violations,
      rates
    };
  }

  /**
   * Clear all telemetry data
   */
  clear() {
    this.errors = [];
    this.aggregations.clear();
    this.statistics = {
      total: 0,
      byType: {},
      byCategory: {},
      hourly: [],
      daily: []
    };
    this.errorRates = {
      lastMinute: [],
      lastHour: [],
      lastDay: []
    };
    logger.info('Error telemetry data cleared');
  }

  // Private methods

  /**
   * Generate unique error ID
   * @private
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Categorize error type
   * @private
   */
  categorizeError(error) {
    // Operational errors (expected, recoverable)
    if (error.isOperational || error.statusCode < 500) {
      return 'operational';
    }

    // Validation errors
    if (error.name === 'ValidationError' || error.statusCode === 400) {
      return 'validation';
    }

    // Timeout errors
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return 'timeout';
    }

    // Network errors
    if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
      return 'network';
    }

    // Programming errors (bugs)
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return 'programming';
    }

    // Database errors
    if (error.message?.includes('database') || error.message?.includes('query')) {
      return 'database';
    }

    return 'unknown';
  }

  /**
   * Aggregate error occurrences
   * @private
   */
  aggregateError(errorEntry) {
    const key = `${errorEntry.type}:${errorEntry.message}`;
    
    if (!this.aggregations.has(key)) {
      this.aggregations.set(key, {
        type: errorEntry.type,
        message: errorEntry.message,
        category: errorEntry.category,
        count: 0,
        firstSeen: errorEntry.timestamp,
        lastSeen: errorEntry.timestamp,
        instances: []
      });
    }

    const aggregation = this.aggregations.get(key);
    aggregation.count++;
    aggregation.lastSeen = errorEntry.timestamp;
    aggregation.instances.push({
      id: errorEntry.id,
      timestamp: errorEntry.timestamp,
      context: errorEntry.context
    });

    // Keep only recent instances
    if (aggregation.instances.length > 20) {
      aggregation.instances = aggregation.instances.slice(-20);
    }

    // Limit aggregations
    if (this.aggregations.size > this.maxAggregations) {
      const oldest = Array.from(this.aggregations.entries())
        .sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
      this.aggregations.delete(oldest[0]);
    }
  }

  /**
   * Update statistics
   * @private
   */
  updateStatistics(errorEntry) {
    this.statistics.total++;

    // By type
    this.statistics.byType[errorEntry.type] = 
      (this.statistics.byType[errorEntry.type] || 0) + 1;

    // By category
    this.statistics.byCategory[errorEntry.category] = 
      (this.statistics.byCategory[errorEntry.category] || 0) + 1;
  }

  /**
   * Update error rates
   * @private
   */
  updateErrorRates(errorEntry) {
    const timestamp = errorEntry.timestamp;
    
    this.errorRates.lastMinute.push(timestamp);
    this.errorRates.lastHour.push(timestamp);
    this.errorRates.lastDay.push(timestamp);

    // Cleanup old entries - aggressively trim rate arrays to prevent memory bloat
    const now = Date.now();
    this.errorRates.lastMinute = this.errorRates.lastMinute.filter(t => now - t < 60000);
    this.errorRates.lastHour = this.errorRates.lastHour.filter(t => now - t < 3600000);
    this.errorRates.lastDay = this.errorRates.lastDay.filter(t => now - t < 86400000);
    
    // Cap array sizes to prevent unbounded growth
    const maxRateEntries = 1000;
    if (this.errorRates.lastMinute.length > maxRateEntries) {
      this.errorRates.lastMinute = this.errorRates.lastMinute.slice(-maxRateEntries);
    }
    if (this.errorRates.lastHour.length > maxRateEntries) {
      this.errorRates.lastHour = this.errorRates.lastHour.slice(-maxRateEntries);
    }
    if (this.errorRates.lastDay.length > maxRateEntries * 10) {
      this.errorRates.lastDay = this.errorRates.lastDay.slice(-maxRateEntries * 10);
    }
  }

  /**
   * Get time window cutoff timestamp
   * @private
   */
  getTimeWindowCutoff(timeWindow) {
    const now = Date.now();
    switch (timeWindow) {
      case 'minute': return now - 60000;
      case 'hour': return now - 3600000;
      case 'day': return now - 86400000;
      case 'week': return now - 604800000;
      default: return null;
    }
  }

  /**
   * Group errors by field
   * @private
   */
  groupBy(errors, field) {
    const groups = {};
    errors.forEach(err => {
      const key = err[field] || 'unknown';
      groups[key] = (groups[key] || 0) + 1;
    });
    return groups;
  }

  /**
   * Calculate error rate
   * @private
   */
  calculateErrorRate(errors, timeWindow) {
    if (errors.length === 0) return 0;

    const cutoff = this.getTimeWindowCutoff(timeWindow);
    if (!cutoff) return 0;

    const duration = (Date.now() - cutoff) / 1000; // seconds
    return (errors.length / duration * 60).toFixed(2); // errors per minute
  }

  /**
   * Get top errors by frequency
   * @private
   */
  getTopErrors(errors, limit) {
    const errorCounts = new Map();
    
    errors.forEach(err => {
      const key = `${err.type}:${err.message}`;
      if (!errorCounts.has(key)) {
        errorCounts.set(key, { ...err, count: 0 });
      }
      errorCounts.get(key).count++;
    });

    return Array.from(errorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map(({ id, stack, context, ...rest }) => rest); // Remove heavy fields
  }

  /**
   * Calculate message similarity (simple Jaccard similarity)
   * @private
   */
  calculateSimilarity(str1, str2) {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * Calculate rate over time window
   * @private
   */
  calculateRate(timestamps, hours) {
    const now = Date.now();
    const windowMs = hours * 3600000;
    const recentErrors = timestamps.filter(t => now - t < windowMs);
    return (recentErrors.length / hours).toFixed(2);
  }

  /**
   * Start cleanup interval
   * @private
   */
  startCleanup() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  /**
   * Cleanup old errors beyond retention period
   * @private
   */
  cleanup() {
    const cutoff = Date.now() - (this.retentionHours * 3600000);
    const beforeCount = this.errors.length;
    
    this.errors = this.errors.filter(err => err.timestamp > cutoff);
    
    const removed = beforeCount - this.errors.length;
    if (removed > 0) {
      logger.info('Error telemetry cleanup completed', {
        removed,
        remaining: this.errors.length,
        retentionHours: this.retentionHours
      });
    }
  }

  /**
   * Stop cleanup interval
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const errorTelemetry = new ErrorTelemetry();

module.exports = {
  ErrorTelemetry,
  errorTelemetry,
  
  // Convenience methods
  recordError: (error, context) => errorTelemetry.recordError(error, context),
  getStatistics: (options) => errorTelemetry.getStatistics(options),
  getErrorRates: () => errorTelemetry.getErrorRates(),
  getErrorById: (id) => errorTelemetry.getErrorById(id),
  getSimilarErrors: (id, limit) => errorTelemetry.getSimilarErrors(id, limit),
  checkThresholds: () => errorTelemetry.checkThresholds(),
  clear: () => errorTelemetry.clear()
};
