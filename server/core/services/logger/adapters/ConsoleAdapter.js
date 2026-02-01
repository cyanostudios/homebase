// server/core/services/logger/adapters/ConsoleAdapter.js
// Console logger adapter for development

const LoggerService = require('../LoggerService');

class ConsoleAdapter extends LoggerService {
  constructor(config = {}) {
    super();
    this.level = config.level || 'info';
    this.enableColors = config.enableColors !== false;
  }

  _formatMessage(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const contextStr = Object.keys(context).length > 0 
      ? ` ${JSON.stringify(context)}` 
      : '';
    
    if (this.enableColors) {
      const colors = {
        info: '\x1b[36m',    // Cyan
        warn: '\x1b[33m',    // Yellow
        error: '\x1b[31m',   // Red
        debug: '\x1b[90m',   // Gray
        reset: '\x1b[0m',
      };
      return `${colors[level]}[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}${colors.reset}`;
    }
    
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  info(message, context = {}) {
    if (this._shouldLog('info')) {
      console.log(this._formatMessage('info', message, context));
    }
  }

  warn(message, context = {}) {
    if (this._shouldLog('warn')) {
      console.warn(this._formatMessage('warn', message, context));
    }
  }

  error(message, error = null, context = {}) {
    if (this._shouldLog('error')) {
      const errorContext = {
        ...context,
        ...(error && {
          error: {
            message: error.message,
            stack: error.stack,
            ...(error.code && { code: error.code }),
          },
        }),
      };
      console.error(this._formatMessage('error', message, errorContext));
    }
  }

  debug(message, context = {}) {
    if (this._shouldLog('debug')) {
      console.debug(this._formatMessage('debug', message, context));
    }
  }

  _shouldLog(level) {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.level] || 1;
    const messageLevel = levels[level] || 1;
    return messageLevel >= currentLevel;
  }
}

module.exports = ConsoleAdapter;
