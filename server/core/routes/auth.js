// server/core/routes/auth.js
// Authentication routes: login, logout, signup, me

const express = require('express');
const router = express.Router();
const AuthService = require('../services/auth/AuthService');
const ServiceManager = require('../ServiceManager');

// Dependencies will be injected by setupAuthRoutes()
let authLimiter = null;
let requireAuth = null;
let pluginLoader = null;

// Initialize AuthService
const authService = new AuthService();

/**
 * Setup auth routes with dependencies
 * @param {Pool} mainPool - Main database pool (Unused in new Service pattern, kept for compatibility)
 * @param {Function} limiter - Auth rate limiter
 * @param {Function} authMiddleware - Auth middleware
 * @param {Object} loader - Plugin loader instance
 */
function setupAuthRoutes(mainPool, limiter, authMiddleware, loader) {
  // pool = mainPool; // Managed by Service layer now
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

      const { user, tenantConnectionString } = result;

      // Save user info in session
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: user.plugins,
      };

      // Save tenant connection string in session
      req.session.tenantConnectionString = tenantConnectionString;

      // Set currentTenantUserId to logged-in user by default
      req.session.currentTenantUserId = user.id;

      // Log tenant routing info
      const logger = ServiceManager.get('logger');
      const dbHost = tenantConnectionString.split('@')[1]?.split('/')[0] || 'unknown';
      logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        tenantDb: dbHost,
      });

      // Save session explicitly before responding
      req.session.save((err) => {
        if (err) {
          logger.error('Session save failed after login', err, { userId: user.id });
          return res.status(500).json({ error: 'Session creation failed' });
        }

        res.json({
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            plugins: user.plugins,
          },
        });
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Login failed', error, { email: req.body.email });
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

    // Auto-login logic
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      plugins: user.plugins,
    };

    req.session.tenantConnectionString = tenantDb.connectionString;
    req.session.currentTenantUserId = user.id;

    // Save session before responding
    req.session.save((err) => {
      if (err) {
        const logger = ServiceManager.get('logger');
        logger.error('Session save failed after signup', err, { userId: user.id });
        return res.status(500).json({ error: 'Session creation failed' });
      }

      res.status(201).json({
        user,
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
      const currentTenantUserId = req.session.currentTenantUserId || req.session.user.id;

      // If admin has switched to another tenant, get that tenant's plugins
      let plugins = req.session.user.plugins;

      if (req.session.user.role === 'superuser' && currentTenantUserId !== req.session.user.id) {
        // We can use UserService for this lookup now strictly speaking, but keeping it simple for "me" route
        // Or we can import UserService here too.
        // Let's use authService.userService
        plugins = await authService.userService.getPluginAccess(currentTenantUserId);
      }

      res.json({
        user: {
          ...req.session.user,
          plugins: plugins,
        },
        currentTenantUserId: currentTenantUserId,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch user info', error, { userId: req.session.user.id });
      res.status(500).json({ error: 'Failed to fetch user info' });
    }
  },
);

module.exports = router;
module.exports.setupAuthRoutes = setupAuthRoutes;
