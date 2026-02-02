// packages/core/src/Logger.js
// Logger interface for plugins - wraps ServiceManager logger

const ServiceManager = require('../../../server/core/ServiceManager');

/**
 * Logger interface for plugins
 * Provides structured logging with consistent format
 */
class Logger {
  /**
   * Get logger instance
   * @returns {Object} Logger instance
   */
  static get() {
    return ServiceManager.get('logger');
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  static info(message, meta = {}) {
    const logger = ServiceManager.get('logger');
    logger.info(message, meta);
  }

  /**
   * Log error message
   * @param {string} message - Error message
   * @param {Error} error - Error object
   * @param {Object} meta - Additional metadata
   */
  static error(message, error = null, meta = {}) {
    const logger = ServiceManager.get('logger');
    logger.error(message, error, meta);
  }

  /**
   * Log warning message
   * @param {string} message - Warning message
   * @param {Object} meta - Additional metadata
   */
  static warn(message, meta = {}) {
    const logger = ServiceManager.get('logger');
    logger.warn(message, meta);
  }

  /**
   * Log debug message
   * @param {string} message - Debug message
   * @param {Object} meta - Additional metadata
   */
  static debug(message, meta = {}) {
    const logger = ServiceManager.get('logger');
    logger.debug(message, meta);
  }
}

module.exports = Logger;
