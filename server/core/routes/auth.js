// server/core/routes/auth.js
// Authentication routes: login, logout, signup, me, MFA

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const QRCode = require('qrcode');
const CredentialsCrypto = require('../services/security/CredentialsCrypto');
const mfaService = require('../services/mfaService');
const ServiceManager = require('../ServiceManager');
const TenantContextService = require('../services/tenant/TenantContextService');

// Dependencies will be injected by setupAuthRoutes()
let pool = null;
let authLimiter = null;
let requireAuth = null;
let pluginLoader = null;
let csrfProtection = null;

/** In-memory MFA token store: mfaToken -> { userId, expiresAt } */
const mfaTokenStore = new Map();
const MFA_TOKEN_TTL_MS = 5 * 60 * 1000;

function isMfaEnabledInEnvironment() {
  return process.env.MFA_ENABLED === 'true';
}

/**
 * Setup auth routes with dependencies
 * @param {Pool} mainPool - Main database pool
 * @param {Function} limiter - Auth rate limiter
 * @param {Function} authMiddleware - Auth middleware
 * @param {Object} loader - Plugin loader instance
 * @param {Function} csrf - CSRF protection middleware
 */
function setupAuthRoutes(mainPool, limiter, authMiddleware, loader, csrf) {
  pool = mainPool;
  authLimiter = limiter;
  requireAuth = authMiddleware;
  pluginLoader = loader;
  csrfProtection = csrf || (() => (req, res, next) => next());
}

/**
 * Ensure tenant has access to all available plugins.
 * Auto-grants new plugins at tenant level so existing tenants see them.
 */
async function ensureTenantPluginAccess(tenantId, existingPluginNames) {
  if (!tenantId) return existingPluginNames;
  try {
    if (!pluginLoader) return existingPluginNames;
    const availablePlugins = pluginLoader.getAllPlugins().map((p) => p.name);
    const missing = availablePlugins.filter((p) => !existingPluginNames.includes(p));
    for (const pluginName of missing) {
      await pool.query(
        `INSERT INTO public.tenant_plugin_access (tenant_id, plugin_name, enabled)
         VALUES ($1::int, $2::text, true)
         ON CONFLICT (tenant_id, plugin_name) DO NOTHING`,
        [tenantId, String(pluginName)],
      );
    }
    return missing.length ? [...existingPluginNames, ...missing] : existingPluginNames;
  } catch (err) {
    const logger = ServiceManager.get('logger');
    logger?.warn?.('ensureTenantPluginAccess failed, using existing plugins', {
      tenantId,
      err: err?.message,
    });
    return existingPluginNames;
  }
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
      const result = await pool.query('SELECT * FROM public.users WHERE email = $1', [email]);

      if (!result.rows.length) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Resolve canonical tenant context (no legacy lookups).
      const tenantContextService = new TenantContextService(pool, {
        logger: ServiceManager.get('logger'),
      });
      const tenantContext = await tenantContextService.getTenantContextByUserId(user.id);
      if (!tenantContext) {
        const logger = ServiceManager.get('logger');
        logger.error('No tenant membership found for user', null, { userId: user.id });
        return res.status(500).json({ error: 'Tenant membership not configured' });
      }

      // MFA: if enabled globally and user has MFA on, require TOTP before session
      if (isMfaEnabledInEnvironment()) {
        const mfaResult = await pool.query(
          'SELECT enabled, secret_encrypted FROM public.user_mfa WHERE user_id = $1',
          [user.id],
        );
        const mfaRow = mfaResult.rows[0];
        if (mfaRow && mfaRow.enabled && mfaRow.secret_encrypted) {
          const mfaToken = crypto.randomBytes(32).toString('hex');
          const expiresAt = Date.now() + MFA_TOKEN_TTL_MS;
          mfaTokenStore.set(mfaToken, { userId: user.id, expiresAt });
          return res.json({
            requiresMfa: true,
            mfaToken,
          });
        }
      }

      // Save user info in session (plugins are tenant-scoped)
      const tenantPlugins = await tenantContextService.getTenantPluginNames(tenantContext.tenantId);
      const finalPlugins = await ensureTenantPluginAccess(tenantContext.tenantId, tenantPlugins);

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: finalPlugins,
      };

      // Canonical tenant context in session
      req.session.tenantConnectionString = tenantContext.tenantConnectionString || null;
      req.session.tenantSchemaName = tenantContext.tenantSchemaName || null;
      req.session.tenantId = tenantContext.tenantId;
      req.session.tenantRole = tenantContext.tenantRole;
      req.session.tenantOwnerUserId = tenantContext.tenantOwnerUserId;

      // Log tenant routing info without exposing connection details
      const logger = ServiceManager.get('logger');
      logger.info('User logged in', {
        userId: user.id,
        email: user.email,
        tenantId: tenantContext.tenantId,
        tenantOwnerUserId: tenantContext.tenantOwnerUserId,
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
          tenantId: req.session.tenantId,
          tenantRole: req.session.tenantRole,
          tenantOwnerUserId: req.session.tenantOwnerUserId,
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
    // Use dynamic plugin list from PluginLoader if available, otherwise fallback (failsafe)
    let availablePlugins = [];
    if (pluginLoader) {
      availablePlugins = pluginLoader.getAllPlugins().map((p) => p.name);
    } else {
      // Fallback if pluginLoader not injected (should not happen in prod)
      availablePlugins = [
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
        'orders',
        'analytics',
      ];
    }
    // Default plugins for new users - all main registered plugins
    let selectedPlugins = [
      'contacts',
      'notes',
      'tasks',
      'estimates',
      'invoices',
      'files',
      'mail',
      'inspection',
      'channels',
      'products',
      'woocommerce-products',
      'orders',
      'analytics',
    ];

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
    const existingUser = await pool.query('SELECT id FROM public.users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Always create regular users via signup (superusers must be created manually)
    const userRole = 'user';

    // Create user in main database
    const userResult = await pool.query(
      'INSERT INTO public.users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
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
    const tenantRow = await pool.query(
      `INSERT INTO public.tenants (owner_user_id, neon_project_id, neon_database_name, neon_connection_string)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [user.id, tenantDb.projectId, tenantDb.databaseName, tenantDb.connectionString],
    );
    const tenantId = tenantRow.rows?.[0]?.id;
    if (!tenantId) {
      throw new Error('Failed to create tenant row');
    }

    logger.info('Tenant database created', {
      userId: user.id,
      databaseName: tenantDb.databaseName,
    });

    // Membership: owner is admin
    await pool.query(
      `INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, created_by)
       VALUES ($1, $2, 'admin', 'active', $2)`,
      [tenantId, user.id],
    );

    // Tenant plugin access (shared)
    for (const pluginName of selectedPlugins) {
      await pool.query(
        `INSERT INTO public.tenant_plugin_access (tenant_id, plugin_name, enabled, granted_by_user_id)
         VALUES ($1, $2, true, $3)
         ON CONFLICT (tenant_id, plugin_name) DO NOTHING`,
        [tenantId, pluginName, user.id],
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

    req.session.tenantConnectionString = tenantDb.connectionString;
    req.session.tenantSchemaName = tenantDb.databaseName || null;
    req.session.tenantId = tenantId;
    req.session.tenantRole = 'admin';
    req.session.tenantOwnerUserId = user.id;

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
        tenantId: tenantId,
        tenantRole: 'admin',
        tenantOwnerUserId: user.id,
      });
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Signup failed', error, { email: req.body.email });
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

/**
 * POST /verify-mfa
 * Complete login after TOTP verification (no session yet)
 */
router.post(
  '/verify-mfa',
  (req, res, next) => authLimiter(req, res, next),
  async (req, res) => {
    const { mfaToken, code } = req.body;

    try {
      if (!mfaToken || !code) {
        return res.status(401).json({ error: 'Invalid verification' });
      }

      const entry = mfaTokenStore.get(mfaToken);
      if (!entry) {
        return res
          .status(401)
          .json({ error: 'Invalid or expired verification. Please log in again.' });
      }
      if (Date.now() > entry.expiresAt) {
        mfaTokenStore.delete(mfaToken);
        return res.status(401).json({ error: 'Verification expired. Please log in again.' });
      }

      const userId = entry.userId;

      const mfaResult = await pool.query(
        'SELECT secret_encrypted FROM public.user_mfa WHERE user_id = $1 AND enabled = true',
        [userId],
      );
      if (!mfaResult.rows.length || !mfaResult.rows[0].secret_encrypted) {
        mfaTokenStore.delete(mfaToken);
        return res.status(401).json({ error: 'Invalid verification' });
      }

      const secret = CredentialsCrypto.decrypt(mfaResult.rows[0].secret_encrypted);
      if (!mfaService.verifyToken(secret, code)) {
        return res.status(401).json({ error: 'Invalid code' });
      }

      mfaTokenStore.delete(mfaToken);

      const userResult = await pool.query(
        'SELECT id, email, role FROM public.users WHERE id = $1',
        [userId],
      );
      if (!userResult.rows.length) {
        return res.status(401).json({ error: 'Invalid verification' });
      }
      const user = userResult.rows[0];
      const tenantContextService = new TenantContextService(pool, {
        logger: ServiceManager.get('logger'),
      });
      const tenantContext = await tenantContextService.getTenantContextByUserId(user.id);
      if (!tenantContext) {
        return res.status(500).json({ error: 'Tenant membership not configured' });
      }

      const tenantPlugins = await tenantContextService.getTenantPluginNames(tenantContext.tenantId);
      const pluginNames = await ensureTenantPluginAccess(tenantContext.tenantId, tenantPlugins);

      req.session.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: pluginNames,
      };
      req.session.tenantConnectionString = tenantContext.tenantConnectionString || null;
      req.session.tenantSchemaName = tenantContext.tenantSchemaName || null;
      req.session.tenantId = tenantContext.tenantId;
      req.session.tenantRole = tenantContext.tenantRole;
      req.session.tenantOwnerUserId = tenantContext.tenantOwnerUserId;

      const logger = ServiceManager.get('logger');
      logger.info('User logged in (MFA)', { userId: user.id, email: user.email });

      req.session.save((err) => {
        if (err) {
          logger.error('Session save failed after MFA verify', err, { userId: user.id });
          return res.status(500).json({ error: 'Session creation failed' });
        }
        res.json({
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            plugins: req.session.user.plugins,
          },
          tenantId: req.session.tenantId,
          tenantRole: req.session.tenantRole,
          tenantOwnerUserId: req.session.tenantOwnerUserId,
        });
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('MFA verify failed', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

/**
 * GET /mfa/status
 * Get MFA status for current user (requires auth)
 */
router.get(
  '/mfa/status',
  (req, res, next) => requireAuth(req, res, next),
  async (req, res) => {
    if (!isMfaEnabledInEnvironment()) {
      return res.json({ mfaEnabled: false, mfaDisabledInEnvironment: true });
    }

    try {
      const userId = req.session.user.id;
      const result = await pool.query('SELECT enabled FROM public.user_mfa WHERE user_id = $1', [
        userId,
      ]);
      const mfaEnabled = result.rows[0]?.enabled ?? false;
      return res.json({ mfaEnabled });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('MFA status failed', error, { userId: req.session?.user?.id });
      res.status(500).json({ error: 'Failed to get MFA status' });
    }
  },
);

/**
 * POST /mfa/setup
 * Start MFA setup: generate secret, save (enabled=false), return QR
 */
router.post(
  '/mfa/setup',
  (req, res, next) => requireAuth(req, res, next),
  (req, res, next) => csrfProtection(req, res, next),
  async (req, res) => {
    if (!isMfaEnabledInEnvironment()) {
      return res.status(403).json({ error: 'MFA is disabled in this environment' });
    }

    try {
      const userId = req.session.user.id;
      const email = req.session.user.email;

      const { secret, otpauthUrl } = mfaService.generateSecret(email);
      const secretEncrypted = CredentialsCrypto.encrypt(secret);

      await pool.query(
        `INSERT INTO public.user_mfa (user_id, secret_encrypted, enabled, updated_at)
         VALUES ($1, $2, false, NOW())
         ON CONFLICT (user_id) DO UPDATE SET secret_encrypted = $2, enabled = false, updated_at = NOW()`,
        [userId, secretEncrypted],
      );

      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
      return res.json({ otpauthUrl, qrCodeDataUrl, secret });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('MFA setup failed', error, { userId: req.session?.user?.id });
      res.status(500).json({ error: 'Failed to setup MFA' });
    }
  },
);

/**
 * POST /mfa/verify
 * Verify TOTP during setup and enable MFA
 */
router.post(
  '/mfa/verify',
  (req, res, next) => requireAuth(req, res, next),
  (req, res, next) => csrfProtection(req, res, next),
  async (req, res) => {
    if (!isMfaEnabledInEnvironment()) {
      return res.status(403).json({ error: 'MFA is disabled in this environment' });
    }

    const { code } = req.body;

    try {
      const userId = req.session.user.id;

      const result = await pool.query(
        'SELECT secret_encrypted FROM public.user_mfa WHERE user_id = $1',
        [userId],
      );
      if (!result.rows.length || !result.rows[0].secret_encrypted) {
        return res.status(400).json({ error: 'MFA setup not started. Please run setup first.' });
      }

      const secret = CredentialsCrypto.decrypt(result.rows[0].secret_encrypted);
      if (!mfaService.verifyToken(secret, code)) {
        return res.status(401).json({ error: 'Invalid code' });
      }

      await pool.query(
        'UPDATE public.user_mfa SET enabled = true, updated_at = NOW() WHERE user_id = $1',
        [userId],
      );

      return res.json({ success: true });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('MFA verify (setup) failed', error, { userId: req.session?.user?.id });
      res.status(500).json({ error: 'Failed to verify MFA' });
    }
  },
);

/**
 * POST /mfa/disable
 * Disable MFA (requires password verification)
 */
router.post(
  '/mfa/disable',
  (req, res, next) => requireAuth(req, res, next),
  (req, res, next) => csrfProtection(req, res, next),
  async (req, res) => {
    if (!isMfaEnabledInEnvironment()) {
      return res.status(403).json({ error: 'MFA is disabled in this environment' });
    }

    const { password } = req.body;

    try {
      if (!password) {
        return res.status(400).json({ error: 'Password required' });
      }

      const userId = req.session.user.id;

      const userResult = await pool.query('SELECT password_hash FROM public.users WHERE id = $1', [
        userId,
      ]);
      if (!userResult.rows.length) {
        return res.status(401).json({ error: 'Invalid request' });
      }

      const validPassword = await bcrypt.compare(password, userResult.rows[0].password_hash);
      if (!validPassword) {
        return res.status(403).json({ error: 'Invalid password' });
      }

      await pool.query(
        'UPDATE public.user_mfa SET enabled = false, secret_encrypted = NULL, updated_at = NOW() WHERE user_id = $1',
        [userId],
      );

      return res.json({ success: true });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('MFA disable failed', error, { userId: req.session?.user?.id });
      res.status(500).json({ error: 'Failed to disable MFA' });
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
    console.log(
      '[AUTH/ME] GET /me | hasSession:',
      !!req.session,
      'hasUser:',
      !!req.session?.user,
      'userId:',
      req.session?.user?.id,
    );
    try {
      const tenantContextService = new TenantContextService(pool, {
        logger: ServiceManager.get('logger'),
      });
      const tenantContext = await tenantContextService.getTenantContextByUserId(
        req.session.user.id,
      );
      if (!tenantContext) {
        return res.status(500).json({ error: 'Tenant membership not configured' });
      }

      // Refresh session tenant context (single source of truth)
      req.session.tenantConnectionString = tenantContext.tenantConnectionString || null;
      req.session.tenantSchemaName = tenantContext.tenantSchemaName || null;
      req.session.tenantId = tenantContext.tenantId;
      req.session.tenantRole = tenantContext.tenantRole;
      req.session.tenantOwnerUserId = tenantContext.tenantOwnerUserId;

      const plugins = await tenantContextService.getTenantPluginNames(tenantContext.tenantId);

      if (req.session.user) {
        req.session.user.plugins = plugins;
      }

      console.log('[AUTH/ME] 200 OK tenantId:', req.session.tenantId);
      res.json({
        user: {
          ...req.session.user,
          plugins,
        },
        tenantId: req.session.tenantId,
        tenantRole: req.session.tenantRole,
        tenantOwnerUserId: req.session.tenantOwnerUserId,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      console.log('[AUTH/ME] 500', error?.message);
      logger.error('Failed to fetch user info', error, { userId: req.session?.user?.id });
      res.status(500).json({ error: 'Failed to fetch user info' });
    }
  },
);

module.exports = router;
module.exports.setupAuthRoutes = setupAuthRoutes;
