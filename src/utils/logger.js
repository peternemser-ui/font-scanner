/**
 * Logger utility for consistent logging across the application
 * Provides different log levels and formatting
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG',
};

const COLORS = {
  ERROR: '\x1b[31m', // Red
  WARN: '\x1b[33m', // Yellow
  INFO: '\x1b[36m', // Cyan
  DEBUG: '\x1b[90m', // Gray
  RESET: '\x1b[0m',
};

class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.logLevel = process.env.LOG_LEVEL || 'INFO';
  }

  /**
   * Format log message with timestamp and context
   * @private
   */
  _formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const color = COLORS[level] || '';
    const reset = COLORS.RESET;

    let logMessage = `${color}[${timestamp}] [${level}] [${this.context}]${reset} ${message}`;

    if (data) {
      logMessage += ` ${JSON.stringify(data)}`;
    }

    return logMessage;
  }

  /**
   * Check if should log based on log level
   * @private
   */
  _shouldLog(level) {
    const levels = ['ERROR', 'WARN', 'INFO', 'DEBUG'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    return messageLevelIndex <= currentLevelIndex;
  }

  /**
   * Log error messages
   */
  error(message, data) {
    if (this._shouldLog(LOG_LEVELS.ERROR)) {
      // eslint-disable-next-line no-console
      console.error(this._formatMessage(LOG_LEVELS.ERROR, message, data));
    }
  }

  /**
   * Log warning messages
   */
  warn(message, data) {
    if (this._shouldLog(LOG_LEVELS.WARN)) {
      // eslint-disable-next-line no-console
      console.warn(this._formatMessage(LOG_LEVELS.WARN, message, data));
    }
  }

  /**
   * Log info messages
   */
  info(message, data) {
    if (this._shouldLog(LOG_LEVELS.INFO)) {
      // eslint-disable-next-line no-console
      console.log(this._formatMessage(LOG_LEVELS.INFO, message, data));
    }
  }

  /**
   * Log debug messages
   */
  debug(message, data) {
    if (this._shouldLog(LOG_LEVELS.DEBUG)) {
      // eslint-disable-next-line no-console
      console.log(this._formatMessage(LOG_LEVELS.DEBUG, message, data));
    }
  }
}

/**
 * Create a logger instance for a specific context
 * @param {string} context - The context/module name
 * @returns {Logger} Logger instance
 */
function createLogger(context) {
  return new Logger(context);
}

module.exports = { Logger, createLogger, LOG_LEVELS };
