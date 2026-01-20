// server/core/middleware/setup.js
// Centralized middleware configuration

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const ServiceManager = require('../ServiceManager');
const { csrfTokenHandler } = require('./csrf');
const { globalLimiter, authLimiter } = require('./rateLimit');
const { activityLogMiddleware } = require('./activityLog');

/**
 * Setup all middleware for Express app
 * @param {Express} app - Express application
 */
function setupMiddleware(app) {
  // Trust Railway proxy for secure cookies and correct client IP
  // WARNING: Only enable if behind a trusted proxy (Railway, Nginx, etc.)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // Compression
  app.use(compression());

  // CORS
  app.use(
    cors({
      origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3001',
      credentials: true,
    }),
  );

  // Session configuration
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  app.use(
    session({
      store: new pgSession({
        pool: pool,
        tableName: 'sessions',
      }),
      secret: process.env.SESSION_SECRET || 'homebase-dev-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      },
    }),
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Tenant Pool Middleware - attach tenant pool to request
  app.use((req, res, next) => {
    if (req.session && req.session.tenantConnectionString) {
      const connectionPool = ServiceManager.get('connectionPool');
      req.tenantPool = connectionPool.getTenantPool(req.session.tenantConnectionString);
    }

    // Initialize ServiceManager with request context
    ServiceManager.initialize(req);

    next();
  });

  // CSRF token endpoint (before rate limiting)
  app.get('/api/csrf-token', csrfTokenHandler);

  // Global rate limiting (after health and CSRF endpoints)
  app.use('/api', globalLimiter);

  // Activity log middleware (after rate limiting, before routes)
  app.use(activityLogMiddleware);

  // Store auth limiter for use in routes
  app.locals.authLimiter = authLimiter;
  app.locals.mainPool = pool;
}

module.exports = { setupMiddleware };
