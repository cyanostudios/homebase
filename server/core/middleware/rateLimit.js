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
    // Skip rate limiting for health, CSRF, auth/me (session check), and debug-log
    // so reload with many parallel requests never returns 429 for auth and breaks "logged in" state
    return (
      req.path === '/api/health' ||
      req.path === '/api/csrf-token' ||
      req.path === '/api/auth/me' ||
      req.path === '/api/debug-log'
    );
  },
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks
 */
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: process.env.NODE_ENV === 'development' ? 50 : 5, // More lenient in development
  message: 'Too many login attempts, please try again later',
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
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

/**
 * Public intake webhook limiter
 * Limits abusive bursts while allowing normal webhook traffic.
 */
const intakeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: 'Too many intake requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  globalLimiter,
  authLimiter,
  emailLimiter,
  uploadLimiter,
  intakeLimiter,
};
