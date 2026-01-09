// server/core/services/logger/LoggerService.js
// Base Logger Service interface

class LoggerService {
  info(message, context = {}) {
    throw new Error('Method not implemented');
  }

  warn(message, context = {}) {
    throw new Error('Method not implemented');
  }

  error(message, error = null, context = {}) {
    throw new Error('Method not implemented');
  }

  debug(message, context = {}) {
    throw new Error('Method not implemented');
  }
}

module.exports = LoggerService;
