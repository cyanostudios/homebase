// server/core/middleware/errorHandler.js
// Centralized error handling middleware

const { AppError } = require('../errors/AppError');

/**
 * Error handling middleware
 * Must be last in the middleware stack
 */
function errorHandler(error, req, res, next) {
  let logger;
  try {
    const ServiceManager = require('../ServiceManager');
    // Try to get logger, but don't fail if ServiceManager isn't initialized
    try {
      logger = ServiceManager.get('logger');
    } catch (e) {
      logger = { error: console.error, warn: console.warn, info: console.log, debug: console.log };
    }
  } catch (e) {
    // Fallback to console if ServiceManager not available
    logger = { error: console.error, warn: console.warn, info: console.log, debug: console.log };
  }

  console.error('Error handler caught:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.session?.user?.id,
  });

  logger.error('Request failed', error, {
    userId: req.session?.user?.id,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  if (error.message === 'misconfigured csrf') {
    logger.error('CSRF middleware misconfigured (session/cookie-parser)', error);
    return res.status(500).json({
      error: 'CSRF middleware misconfigured',
      code: 'CSRF_MISCONFIGURED',
    });
  }

  // CSRF (csurf) — client should refresh token via GET /api/csrf-token
  if (error.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'Invalid or missing CSRF token',
      code: 'CSRF_INVALID',
    });
  }

  if (error.array && typeof error.array === 'function') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.array(),
    });
  }

  if (error.code && error.code.startsWith('23')) {
    // PostgreSQL constraint violation
    return res.status(400).json({
      error: 'Database constraint violation',
      code: 'CONSTRAINT_ERROR',
    });
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  console.error('=== ERROR HANDLER ===');
  console.error('Error:', error);
  console.error('Message:', error.message);
  console.error('Stack:', error.stack);
  console.error('Path:', req.path);
  console.error('Method:', req.method);
  console.error('====================');

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    details: isDevelopment ? error.message : undefined,
    stack: isDevelopment ? error.stack : undefined,
  });
}

module.exports = { errorHandler };
