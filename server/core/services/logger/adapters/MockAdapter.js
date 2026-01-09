// server/core/services/logger/adapters/MockAdapter.js
// Mock Logger Adapter for testing

const LoggerService = require('../LoggerService');

class MockAdapter extends LoggerService {
  constructor(config = {}) {
    super();
    this.logs = []; // Store all logs for testing
    this.config = config;
  }

  info(message, context = {}) {
    this.logs.push({ level: 'info', message, context, timestamp: new Date() });
  }

  warn(message, context = {}) {
    this.logs.push({ level: 'warn', message, context, timestamp: new Date() });
  }

  error(message, error = null, context = {}) {
    this.logs.push({ level: 'error', message, error, context, timestamp: new Date() });
  }

  debug(message, context = {}) {
    if (this.config.level === 'debug' || process.env.NODE_ENV === 'test') {
      this.logs.push({ level: 'debug', message, context, timestamp: new Date() });
    }
  }

  /**
   * Get all logs (useful for testing)
   */
  getLogs(level = null) {
    if (level) {
      return this.logs.filter(log => log.level === level);
    }
    return this.logs;
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Get last log entry
   */
  getLastLog() {
    return this.logs[this.logs.length - 1] || null;
  }
}

module.exports = MockAdapter;
