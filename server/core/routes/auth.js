// server/core/routes/auth.js
// Authentication routes: login, logout, signup, me

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const ServiceManager = require('../ServiceManager');

// Dependencies will be injected by setupAuthRoutes()
let pool = null;
let authLimiter = null;
let requireAuth = null;

/**
 * Setup auth routes with dependencies
 * @param {Pool} mainPool - Main database pool
 * @param {Function} limiter - Auth rate limiter
 * @param {Function} authMiddleware - Auth middleware
 */
function setupAuthRoutes(mainPool, limiter, authMiddleware) {
  pool = mainPool;
  authLimiter = limiter;
  requireAuth = authMiddleware;
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

    try {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

      if (!result.rows.length) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Get user's plugin access
      const pluginAccess = await pool.query(
        'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
        [user.id],
      );

      // Get tenant's connection string
      const tenantResult = await pool.query(
        'SELECT neon_connection_string FROM tenants WHERE user_id = $1',
        [user.id],
      );

      if (!tenantResult.rows.length) {
        const logger = ServiceManager.get('logger');
        logger.error('No tenant database found', null, { userId: user.id });
        return res.status(500).json({ error: 'Tenant database not configured' });
      }

      const tenantConnectionString = tenantResult.rows[0].neon_connection_string;

      // Save user info in session
      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: pluginAccess.rows.map((row) => row.plugin_name),
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
            plugins: req.session.user.plugins,
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
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Validate and set plugins (default to all main plugins if not provided)
    const availablePlugins = [
      'contacts',
      'notes',
      'estimates',
      'tasks',
      'invoices',
      'products',
      'channels',
      'files',
      'rail',
      'woocommerce-products',
    ];
    // Default plugins for new users - all main registered plugins
    let selectedPlugins = ['contacts', 'notes', 'tasks', 'estimates', 'invoices', 'files'];

    if (plugins && Array.isArray(plugins) && plugins.length > 0) {
      const invalidPlugins = plugins.filter((p) => !availablePlugins.includes(p));
      if (invalidPlugins.length > 0) {
        return res.status(400).json({
          error: `Invalid plugins: ${invalidPlugins.join(', ')}`,
          availablePlugins: availablePlugins,
        });
      }
      selectedPlugins = plugins;
    }

    // Check if user exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Always create regular users via signup (superusers must be created manually)
    const userRole = 'user';

    // Create user in main database
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, passwordHash, userRole],
    );

    const user = userResult.rows[0];
    const logger = ServiceManager.get('logger');
    logger.info('User created', { userId: user.id, email: user.email });

    // Create tenant database using TenantService
    logger.info('Creating tenant database', { userId: user.id });
    const tenantService = ServiceManager.get('tenant');
    const tenantDb = await tenantService.createTenant(user.id, user.email);

    // Save tenant info in main database
    await pool.query(
      'INSERT INTO tenants (user_id, neon_project_id, neon_database_name, neon_connection_string) VALUES ($1, $2, $3, $4)',
      [user.id, tenantDb.projectId, tenantDb.databaseName, tenantDb.connectionString],
    );

    logger.info('Tenant database created', {
      userId: user.id,
      databaseName: tenantDb.databaseName,
    });

    // Give selected plugin access
    for (const pluginName of selectedPlugins) {
      await pool.query(
        'INSERT INTO user_plugin_access (user_id, plugin_name, enabled) VALUES ($1, $2, true)',
        [user.id, pluginName],
      );
    }

    logger.info('Plugin access granted', {
      userId: user.id,
      plugins: selectedPlugins,
    });

    // Auto-login
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      plugins: selectedPlugins,
    };

    // Set tenant connection string for auto-login
    req.session.tenantConnectionString = tenantDb.connectionString;
    req.session.currentTenantUserId = user.id;

    // Save session before responding (important for signup auto-login)
    req.session.save((err) => {
      if (err) {
        logger.error('Session save failed after signup', err, { userId: user.id });
        return res.status(500).json({ error: 'Session creation failed' });
      }

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          plugins: selectedPlugins,
        },
      });
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Signup failed', error, { email: req.body.email });
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
        const tenantPlugins = await pool.query(
          'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
          [currentTenantUserId],
        );
        plugins = tenantPlugins.rows.map((row) => row.plugin_name);
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
