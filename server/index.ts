// server/index.ts
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const PluginLoader = require('../plugin-loader');
require('dotenv').config({ path: '.env.local' });

// Core infrastructure imports
const ServiceManager = require('./core/ServiceManager');
const { errorHandler } = require('./core/middleware/errorHandler');
const { globalLimiter, authLimiter } = require('./core/middleware/rateLimit');
const { csrfProtection, csrfTokenHandler } = require('./core/middleware/csrf');

// Initialize Neon Service
import NeonService from './neon-service';
const neonService = new NeonService(process.env.NEON_API_KEY);

const app = express();
const PORT = process.env.PORT || 3002;

// Trust Railway proxy for secure cookies and correct client IP
// WARNING: Only enable if behind a trusted proxy (Railway, Nginx, etc.)
app.set('trust proxy', 1);

// Database connection (Railway PostgreSQL - for auth and tenant mapping)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Tenant Pool Registry - cache pools for reuse
const tenantPools = new Map();

function getTenantPool(connectionString) {
  if (!tenantPools.has(connectionString)) {
    console.log(`🔌 Creating new tenant pool for: ${connectionString.split('@')[1]?.split('/')[0]}`);
    tenantPools.set(connectionString, new Pool({ 
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    }));
  }
  return tenantPools.get(connectionString);
}

// Security and performance middleware
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
app.use(compression());
app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3001',
    credentials: true,
  }),
);

// Session configuration
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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Tenant Pool Middleware - attach tenant pool to request and initialize ServiceManager
app.use((req, res, next) => {
  if (req.session && req.session.tenantConnectionString) {
    req.tenantPool = getTenantPool(req.session.tenantConnectionString);
  }
  
  // Initialize ServiceManager with request context
  // This ensures database service has correct tenant pool
  ServiceManager.initialize(req);
  
  next();
});

// Auth middleware
function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requirePlugin(pluginName) {
  return async (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Superuser has access to all plugins
    if (req.session.user.role === 'superuser') {
      return next();
    }

    // Check plugin access
    const result = await pool.query(
      'SELECT enabled FROM user_plugin_access WHERE user_id = $1 AND plugin_name = $2',
      [req.session.user.id, pluginName],
    );

    if (!result.rows.length || !result.rows[0].enabled) {
      return res.status(403).json({ error: `Access denied to ${pluginName} plugin` });
    }

    next();
  };
}

// Initialize plugin system
const pluginLoader = new PluginLoader(pool, requirePlugin);

// Health check (before rate limiting)
app.get('/api/health', (req, res) => {
  const loadedPlugins = pluginLoader.getAllPlugins();
  res.json({
    status: 'ok',
    database: 'connected',
    environment: process.env.NODE_ENV,
    plugins: loadedPlugins.map((p) => ({ name: p.name, route: p.routeBase })),
    tenantPools: tenantPools.size,
  });
});

// CSRF token endpoint (must be before rate limiting)
// Note: csurf requires session middleware (already applied above)
// Use the csrfTokenHandler function which handles initialization properly
app.get('/api/csrf-token', csrfTokenHandler);

// Global rate limiting (after health and CSRF token endpoints)
app.use('/api', globalLimiter);

// Auth routes
app.post('/api/auth/login', authLimiter, async (req, res) => {
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

    // Get tenant's Neon connection string
    const tenantResult = await pool.query(
      'SELECT neon_connection_string FROM tenants WHERE user_id = $1',
      [user.id]
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
      tenantDb: dbHost 
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: req.session.user.plugins,
      },
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Login failed', error, { email: req.body.email });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Signup endpoint with Neon tenant creation and dynamic plugin selection
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, plugins } = req.body;

  try {
    // Validate input
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Validate and set plugins (default to contacts and notes if not provided)
    const availablePlugins = ['contacts', 'notes', 'estimates', 'tasks', 'invoices', 'products', 'channels', 'files', 'rail', 'woocommerce-products'];
    let selectedPlugins = ['contacts', 'notes'];
    
    if (plugins && Array.isArray(plugins) && plugins.length > 0) {
      const invalidPlugins = plugins.filter(p => !availablePlugins.includes(p));
      if (invalidPlugins.length > 0) {
        return res.status(400).json({ 
          error: `Invalid plugins: ${invalidPlugins.join(', ')}`,
          availablePlugins: availablePlugins
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

    // Create user in Railway PostgreSQL
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, passwordHash, userRole]
    );

    const user = userResult.rows[0];
    const logger = ServiceManager.get('logger');
    logger.info('User created', { userId: user.id, email: user.email });

    // Create Neon tenant database
    logger.info('Creating Neon database', { userId: user.id });
    const tenantDb = await neonService.createTenantDatabase(user.id, user.email);

    // Save tenant info in Railway PostgreSQL
    await pool.query(
      'INSERT INTO tenants (user_id, neon_project_id, neon_database_name, neon_connection_string) VALUES ($1, $2, $3, $4)',
      [user.id, tenantDb.projectId, tenantDb.databaseName, tenantDb.connectionString]
    );

    logger.info('Neon database created', { 
      userId: user.id, 
      databaseName: tenantDb.databaseName 
    });

    // Give selected plugin access
    for (const pluginName of selectedPlugins) {
      await pool.query(
        'INSERT INTO user_plugin_access (user_id, plugin_name, enabled) VALUES ($1, $2, true)',
        [user.id, pluginName]
      );
    }

    logger.info('Plugin access granted', { 
      userId: user.id, 
      plugins: selectedPlugins 
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

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: selectedPlugins,
      },
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Signup failed', error, { email: req.body.email });
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const currentTenantUserId = req.session.currentTenantUserId || req.session.user.id;
    
    // If admin has switched to another tenant, get that tenant's plugins
    let plugins = req.session.user.plugins;
    
    if (req.session.user.role === 'superuser' && currentTenantUserId !== req.session.user.id) {
      const tenantPlugins = await pool.query(
        'SELECT plugin_name FROM user_plugin_access WHERE user_id = $1 AND enabled = true',
        [currentTenantUserId]
      );
      plugins = tenantPlugins.rows.map(row => row.plugin_name);
    }
    
    res.json({ 
      user: {
        ...req.session.user,
        plugins: plugins
      },
      currentTenantUserId: currentTenantUserId
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Failed to fetch user info', error, { userId: req.session.user.id });
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

// Admin: Update user role
app.post('/api/admin/update-role', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'superuser') {
      return res.status(403).json({ error: 'Forbidden: Superuser access required' });
    }

    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    if (!['user', 'superuser'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be "user" or "superuser"' });
    }

    await pool.query(
      'UPDATE users SET role = $1 WHERE email = $2',
      [role, email]
    );

    const result = await pool.query(
      'SELECT id, email, role FROM users WHERE email = $1',
      [email]
    );

    res.json({ 
      message: 'Role updated successfully',
      user: result.rows[0] 
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Failed to update role', error, { email: req.body.email });
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Admin: Get all tenants (only those with active Neon databases)
app.get('/api/admin/tenants', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'superuser') {
      return res.status(403).json({ error: 'Forbidden: Superuser access required' });
    }

    const result = await pool.query(`
      SELECT u.id, u.email, u.role, t.neon_project_id, t.neon_database_name, t.neon_connection_string
      FROM users u
      INNER JOIN tenants t ON u.id = t.user_id
      WHERE t.neon_connection_string IS NOT NULL
      ORDER BY u.id
    `);

    res.json({ tenants: result.rows });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Failed to fetch tenants', error, { adminId: req.session.user.id });
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Admin: Switch to another tenant's database
app.post('/api/admin/switch-tenant', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'superuser') {
      return res.status(403).json({ error: 'Forbidden: Superuser access required' });
    }

    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const tenantResult = await pool.query(
      'SELECT neon_connection_string FROM tenants WHERE user_id = $1',
      [userId]
    );

    if (!tenantResult.rows.length) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const newTenantConnectionString = tenantResult.rows[0].neon_connection_string;
    
    // Update session with new tenant connection
    req.session.tenantConnectionString = newTenantConnectionString;
    req.session.currentTenantUserId = userId;

    const logger = ServiceManager.get('logger');
    const dbHost = newTenantConnectionString.split('@')[1]?.split('/')[0] || 'unknown';
    logger.info('Admin switched tenant', { 
      adminId: req.session.user.id, 
      tenantUserId: userId, 
      tenantDb: dbHost 
    });

    res.json({ 
      message: 'Switched tenant successfully',
      tenantUserId: userId
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Failed to switch tenant', error, { 
      adminId: req.session.user.id, 
      targetUserId: req.body.userId 
    });
    res.status(500).json({ error: 'Failed to switch tenant' });
  }
});

// Admin: Delete tenant entry (without deleting user)
app.delete('/api/admin/tenants/:userId', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'superuser') {
      return res.status(403).json({ error: 'Forbidden: Superuser access required' });
    }

    const { userId } = req.params;

    // Get user info before deletion
    const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete from tenants only (user remains)
    const tenantResult = await pool.query('DELETE FROM tenants WHERE user_id = $1 RETURNING id', [userId]);

    if (!tenantResult.rows.length) {
      return res.status(404).json({ error: 'Tenant entry not found' });
    }

    const logger = ServiceManager.get('logger');
    logger.info('Admin deleted tenant entry', { 
      adminId: req.session.user.id, 
      tenantUserId: userId,
      userEmail: userResult.rows[0].email
    });

    res.json({ 
      message: 'Tenant entry deleted successfully',
      userId: userId,
      email: userResult.rows[0].email
    });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Failed to delete tenant entry', error, { 
      adminId: req.session.user.id, 
      targetUserId: req.params.userId 
    });
    res.status(500).json({ error: 'Failed to delete tenant entry' });
  }
});

// Admin: Delete user and cleanup
app.delete('/api/admin/users/:userId', requireAuth, async (req, res) => {
  try {
    if (req.session.user.role !== 'superuser') {
      return res.status(403).json({ error: 'Forbidden: Superuser access required' });
    }

    const { userId } = req.params;

    // Delete from user_plugin_access
    await pool.query('DELETE FROM user_plugin_access WHERE user_id = $1', [userId]);
    
    // Delete from tenants
    await pool.query('DELETE FROM tenants WHERE user_id = $1', [userId]);
    
    // Delete from users
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING email', [userId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted', email: result.rows[0].email });
  } catch (error) {
    const logger = ServiceManager.get('logger');
    logger.error('Failed to delete user', error, { 
      adminId: req.session.user.id, 
      targetUserId: req.params.userId 
    });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Serve static files from React build (production only)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'public');
  app.use(express.static(buildPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// Load all plugins
pluginLoader.loadPlugins(app);

// Plugin info endpoint
app.get('/api/plugins', requireAuth, (req, res) => {
  const plugins = pluginLoader.getAllPlugins();
  res.json(plugins);
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
// Get git commit hash for version logging
const { execSync } = require('child_process');
let gitCommitHash = 'unknown';
try {
  gitCommitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: __dirname }).trim();
} catch (e) {
  // Git not available or not a git repo - use process.env or default
  gitCommitHash = process.env.GIT_COMMIT || 'unknown';
}

app.listen(PORT, () => {
  console.log(`🚀 Homebase server running on port ${PORT}`);
  console.log(`BACKEND_VERSION=${gitCommitHash}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔌 Loaded ${pluginLoader.getAllPlugins().length} plugins`);
});