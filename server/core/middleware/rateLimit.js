// server/core/middleware/rateLimit.js
// Rate limiting middleware

const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter
 * Applies to all API routes
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // More lenient in development
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // app.use('/api', globalLimiter) strips "/api" from req.path, so support both prefixed and stripped paths.
    const path = req.path || '';
    return (
      path === '/health' ||
      path === '/csrf-token' ||
      path === '/auth/me' ||
      path === '/auth/login' ||
      path === '/api/health' ||
      path === '/api/csrf-token' ||
      path === '/api/auth/me' ||
      path === '/api/auth/login'
    );
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 200 : 5, // Lenient in dev; strict in prod
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production', // Only enforce in production; dev/local login never blocked
});

/**
 * Email sending rate limiter
 * Prevents spam
 */
const emailLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 emails per hour
  message: 'Email sending limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * File upload rate limiter
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: 'Upload limit exceeded, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  authLimiter,
  emailLimiter,
  uploadLimiter,
};
