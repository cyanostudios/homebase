// server/core/routes/auth.js
// Authentication routes: login, logout, signup, me

const express = require('express');
const router = express.Router();
const { ALL_DISCOVERED_PLUGINS } = require('../config/constants');
const AuthService = require('../services/auth/AuthService');
const PasswordResetService = require('../services/auth/PasswordResetService');
const ServiceManager = require('../ServiceManager');
const { emailLimiter } = require('../middleware/rateLimit');

// Dependencies will be injected by setupAuthRoutes()
let authLimiter = null;
let requireAuth = null;
let pluginLoader = null;

// Initialize AuthService
const authService = new AuthService();
const passwordResetService = new PasswordResetService();

/** Always-on plugin: ensure 'settings' is in the plugins array for nav/API consistency. */
function ensureSettingsInPlugins(plugins) {
  const list = Array.isArray(plugins) ? [...plugins] : [];
  if (!list.includes('settings')) {
    list.push('settings');
  }
  return list;
}

/**
 * Regenerate session ID after authentication to mitigate session fixation.
 * @param {import('express').Request} req
 * @param {object} sessionPayload
 * @param {(err: Error|null) => void} done
 */
function persistAuthenticatedSession(req, sessionPayload, done) {
  req.session.regenerate((regenErr) => {
    if (regenErr) {
      done(regenErr);
      return;
    }
    req.session.user = sessionPayload.user;
    req.session.tenantConnectionString = sessionPayload.tenantConnectionString;
    req.session.tenantId = sessionPayload.tenantId ?? null;
    req.session.tenantRole = sessionPayload.tenantRole ?? null;
    req.session.tenantOwnerUserId = sessionPayload.tenantOwnerUserId ?? null;
    req.session.currentTenantUserId = sessionPayload.currentTenantUserId ?? null;
    req.session.save(done);
  });
}

/**
 * Setup auth routes with dependencies
 * @param {Pool} _pool - Main database pool (unused; auth uses ServiceManager)
 * @param {Function} limiter - Auth rate limiter
 * @param {Function} authMiddleware - Auth middleware
 * @param {Object} loader - Plugin loader instance
 */
function setupAuthRoutes(_pool, limiter, authMiddleware, loader) {
  authLimiter = limiter;
  requireAuth = authMiddleware;
  pluginLoader = loader;
}

/**
 * POST /login
 * Authenticate user and create session
 */
router.post(
  '/login',
  (req, res, next) => authLimiter(req, res, next),
  async (req, res) => {
    const { email, password } = req.body;

    // Debug logging
    const logger = ServiceManager.get('logger');
    logger.info('Login request received', {
      email: email ? 'provided' : 'missing',
      hasPassword: !!password,
    });

    if (!email || !password) {
      logger.warn('Login attempt with missing credentials', {
        hasEmail: !!email,
        hasPassword: !!password,
      });
      return res.status(400).json({ error: 'Email and password required' });
    }

    try {
      const result = await authService.login(email, password);

      if (!result) {
        logger.warn('Login failed: Invalid credentials', { email });
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const { user, tenantConnectionString, tenantId, tenantRole, tenantOwnerUserId } = result;

      if (!user || !tenantConnectionString) {
        logger.error('Login result missing required fields', null, {
          hasUser: !!user,
          hasTenantConnectionString: !!tenantConnectionString,
          email,
        });
        return res.status(500).json({ error: 'Login failed: Invalid response from auth service' });
      }

      const sessionPlugins =
        user.role === 'superuser'
          ? ALL_DISCOVERED_PLUGINS
          : ensureSettingsInPlugins(user.plugins || []);

      const dbHost = tenantConnectionString.split('@')[1]?.split('/')[0] || 'unknown';
      logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        tenantDb: dbHost,
      });

      persistAuthenticatedSession(
        req,
        {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            plugins: ensureSettingsInPlugins(sessionPlugins),
          },
          tenantConnectionString,
          tenantId,
          tenantRole,
          tenantOwnerUserId,
          currentTenantUserId: tenantOwnerUserId ?? user.id,
        },
        (err) => {
          if (err) {
            logger.error('Session save failed after login', err, {
              userId: user.id,
              errorMessage: err.message,
              errorStack: err.stack,
            });
            return res.status(500).json({
              error: 'Session creation failed',
              code: 'SESSION_SAVE_FAILED',
              hint: 'Main DB sessions table may lack PRIMARY KEY on sid. Run: npm run fix:sessions-table',
            });
          }

          res.json({
            user: {
              id: user.id,
              email: user.email,
              role: user.role,
              plugins: ensureSettingsInPlugins(sessionPlugins),
            },
          });
        },
      );
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Login failed', error, {
        email: req.body.email,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      if (error?.message === 'Tenant database not configured') {
        return res.status(503).json({
          error:
            'No workspace database is linked to this account. Check DATABASE_URL / tenant setup or contact support.',
          code: 'TENANT_NOT_CONFIGURED',
        });
      }
      if (error?.code === '42P01') {
        return res.status(503).json({
          error:
            'Database schema missing on main DB (users/sessions/tenants). Run: DATABASE_URL=<neon-main> npm run railway:migrate',
          code: 'SCHEMA_MISSING',
        });
      }
      res.status(500).json({
        error: 'Internal server error',
        code: 'LOGIN_FAILED',
      });
    }
  },
);

/**
 * POST /forgot-password
 * Send password reset email (generic response — no email enumeration)
 */
router.post(
  '/forgot-password',
  (req, res, next) => emailLimiter(req, res, next),
  async (req, res) => {
    const logger = ServiceManager.get('logger');
    const { email } = req.body || {};

    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }

    try {
      const result = await passwordResetService.requestReset(email);
      const body = {
        message:
          'If an account exists for that email, we sent instructions to reset your password.',
      };
      if (result.devLink && process.env.NODE_ENV === 'development') {
        body.devLink = result.devLink;
      }
      res.json(body);
    } catch (error) {
      logger.error('Forgot password failed', error, { email: String(email).trim() });
      if (error.code === 'EMAIL_NOT_CONFIGURED') {
        return res.status(503).json({
          error: error.message,
          code: error.code,
        });
      }
      res.status(500).json({ error: 'Could not process password reset request' });
    }
  },
);

/**
 * POST /reset-password
 * Set a new password using a token from the reset email
 */
router.post(
  '/reset-password',
  (req, res, next) => authLimiter(req, res, next),
  async (req, res) => {
    const logger = ServiceManager.get('logger');
    const { token, password } = req.body || {};

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    try {
      await passwordResetService.resetPassword(token, password);
      res.json({ message: 'Password updated. You can sign in with your new password.' });
    } catch (error) {
      logger.warn('Reset password failed', { message: error.message });
      if (error.message.includes('at least 8')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Invalid or expired')) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Could not reset password' });
    }
  },
);

/**
 * POST /logout
 * Destroy user session
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

/**
 * POST /signup
 * Create new user account with tenant database
 */
router.post(
  '/signup',
  (req, res, next) => authLimiter(req, res, next),
  async (req, res) => {
    const { email, password, plugins } = req.body;

    try {
      const { user, tenantDb } = await authService.signup({ email, password, plugins });

      persistAuthenticatedSession(
        req,
        {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            plugins: ensureSettingsInPlugins(user.plugins || []),
          },
          tenantConnectionString: tenantDb.connectionString,
          tenantId: tenantDb.tenantId ?? null,
          tenantRole: 'admin',
          tenantOwnerUserId: user.id,
          currentTenantUserId: user.id,
        },
        (err) => {
          if (err) {
            const logger = ServiceManager.get('logger');
            logger.error('Session save failed after signup', err, { userId: user.id });
            return res.status(500).json({
              error: 'Session creation failed',
              code: 'SESSION_SAVE_FAILED',
              hint: 'Main DB sessions table may lack PRIMARY KEY on sid. Run: npm run fix:sessions-table',
            });
          }

          res.status(201).json({
            user: { ...user, plugins: ensureSettingsInPlugins(user.plugins || []) },
          });
        },
      );
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Signup failed', error, { email: req.body.email });

      if (error.message.includes('Email already registered')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('Invalid plugins')) {
        return res.status(400).json({
          error: error.message,
          availablePlugins: error.availablePlugins,
        });
      }
      if (error.message.includes('Password')) {
        return res.status(400).json({ error: error.message });
      }
      if (error?.code === '42P01') {
        return res.status(503).json({
          error:
            'Database schema missing on main DB. Run: DATABASE_URL=<neon-main> npm run railway:migrate',
          code: 'SCHEMA_MISSING',
        });
      }

      res.status(500).json({ error: 'Failed to create account. Please try again.' });
    }
  },
);

/**
 * GET /me
 * Get current user info
 */
router.get(
  '/me',
  (req, res, next) => requireAuth(req, res, next),
  async (req, res) => {
    try {
      if (!req.session || !req.session.user) {
        const logger = ServiceManager.get('logger');
        logger.error('Session or user missing in /me endpoint', null, {
          hasSession: !!req.session,
          hasUser: !!(req.session && req.session.user),
        });
        return res.status(401).json({ error: 'Authentication required' });
      }

      const currentTenantUserId = req.session.currentTenantUserId || req.session.user.id;
      const tenantId = req.session.tenantId ?? null;
      const tenantRole = req.session.tenantRole ?? null;
      const tenantOwnerUserId = req.session.tenantOwnerUserId ?? null;

      // Resolve plugins for current tenant context (owner = currentTenantUserId)
      // Superuser gets every discovered plugin (including DEFAULT_DISABLED_PLUGINS e.g. mail)
      let plugins = req.session.user.plugins || [];
      if (req.session.user.role === 'superuser') {
        plugins = ALL_DISCOVERED_PLUGINS || [];
      } else {
        try {
          const ctx =
            await authService.tenantContextService.getTenantContextByUserId(currentTenantUserId);
          if (ctx) {
            plugins = await authService.tenantContextService.getTenantPluginNames(
              ctx.tenantId,
              ctx.tenantOwnerUserId,
            );
          }
        } catch (pluginError) {
          const logger = ServiceManager.get('logger');
          logger.error('Failed to get tenant plugins for /me', pluginError, {
            currentTenantUserId,
            userId: req.session.user.id,
          });
        }
      }

      res.json({
        user: {
          ...req.session.user,
          plugins: ensureSettingsInPlugins(plugins),
        },
        currentTenantUserId,
        tenantId,
        tenantRole,
        tenantOwnerUserId,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch user info', error, {
        userId: req.session?.user?.id,
        errorMessage: error.message,
        errorStack: error.stack,
      });
      res.status(500).json({ error: 'Failed to fetch user info' });
    }
  },
);

module.exports = router;
module.exports.setupAuthRoutes = setupAuthRoutes;
