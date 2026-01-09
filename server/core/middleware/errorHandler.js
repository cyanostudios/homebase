// server/core/middleware/errorHandler.js
// Centralized error handling middleware

const { AppError } = require('../errors/AppError');

/**
 * Error handling middleware
 * Must be last in the middleware stack
 */
function errorHandler(error, req, res, next) {
  // Get logger from ServiceManager
  let logger;
  try {
    const ServiceManager = require('../ServiceManager');
    logger = ServiceManager.get('logger');
  } catch (e) {
    // Fallback to console if ServiceManager not available
    logger = { error: console.error };
  }

  // Log error details (server-side only)
  logger.error('Request failed', error, {
    userId: req.session?.user?.id,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  // Handle AppError (operational errors)
  if (error instanceof AppError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Handle validation errors from express-validator
  if (error.array && typeof error.array === 'function') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.array(),
    });
  }

  // Handle database errors
  if (error.code && error.code.startsWith('23')) {
    // PostgreSQL constraint violation
    return res.status(400).json({
      error: 'Database constraint violation',
      code: 'CONSTRAINT_ERROR',
    });
  }

  // Handle unknown errors (don't expose internal details)
  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
  });
}

module.exports = { errorHandler };
