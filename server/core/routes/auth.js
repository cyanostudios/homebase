// server/core/routes/auth.js
// Authentication routes: login, logout, signup, me

const express = require('express');
const router = express.Router();
const { DEFAULT_AVAILABLE_PLUGINS } = require('../config/constants');
const AuthService = require('../services/auth/AuthService');
const ServiceManager = require('../ServiceManager');

// Dependencies will be injected by setupAuthRoutes()
let authLimiter = null;
let requireAuth = null;
let pluginLoader = null;

// Initialize AuthService
const authService = new AuthService();

/** Always-on plugin: ensure 'settings' is in the plugins array for nav/API consistency. */
function ensureSettingsInPlugins(plugins) {
  const list = Array.isArray(plugins) ? [...plugins] : [];
  if (!list.includes('settings')) {
    list.push('settings');
  }
  return list;
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

      // Save user info in session (settings plugin always in plugins)
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: ensureSettingsInPlugins(user.plugins || []),
      };

      req.session.tenantConnectionString = tenantConnectionString;
      req.session.tenantId = tenantId ?? null;
      req.session.tenantRole = tenantRole ?? null;
      req.session.tenantOwnerUserId = tenantOwnerUserId ?? null;
      // Tenant DB scope: use owner id so all members see shared data (existing tables filter by user_id)
      req.session.currentTenantUserId = tenantOwnerUserId ?? user.id;

      // Log tenant routing info
      const dbHost = tenantConnectionString.split('@')[1]?.split('/')[0] || 'unknown';
      logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        tenantDb: dbHost,
      });

      // Save session explicitly before responding
      req.session.save((err) => {
        if (err) {
          logger.error('Session save failed after login', err, {
            userId: user.id,
            errorMessage: err.message,
            errorStack: err.stack,
          });
          return res.status(500).json({ error: 'Session creation failed' });
        }

        res.json({
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            plugins: ensureSettingsInPlugins(user.plugins || []),
          },
        });
      });
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
      res.status(500).json({ error: 'Internal server error' });
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
router.post('/signup', async (req, res) => {
  const { email, password, plugins } = req.body;

  try {
    const { user, tenantDb } = await authService.signup({ email, password, plugins });

    // Auto-login: new account is tenant owner
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      plugins: ensureSettingsInPlugins(user.plugins || []),
    };

    req.session.tenantConnectionString = tenantDb.connectionString;
    req.session.tenantId = tenantDb.tenantId ?? null;
    req.session.tenantRole = 'admin';
    req.session.tenantOwnerUserId = user.id;
    req.session.currentTenantUserId = user.id;

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        const logger = ServiceManager.get('logger');
        logger.error('Session save failed after signup', err, { userId: user.id });
        return res.status(500).json({ error: 'Session creation failed' });
      }

      res.status(201).json({
        user: { ...user, plugins: ensureSettingsInPlugins(user.plugins || []) },
      });
    });
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

    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

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
      // Superuser always gets all available plugins (including newly added ones)
      let plugins = req.session.user.plugins || [];
      if (req.session.user.role === 'superuser') {
        plugins = DEFAULT_AVAILABLE_PLUGINS || [];
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
