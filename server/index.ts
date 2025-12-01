# server/index.ts - Complete Fixed Version
```javascript
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

// Initialize Neon Service
import NeonService from './neon-service';
const neonService = new NeonService(process.env.NEON_API_KEY);

const app = express();
const PORT = process.env.PORT || 3002;

// Trust Railway proxy for secure cookies
app.set('trust proxy', 1);

// Database connection (Railway PostgreSQL - for auth and tenant mapping)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// 🆕 STEP 4: Tenant Pool Registry - cache pools for reuse
const tenantPools = new Map();

function getTenantPool(connectionString) {
  if (!tenantPools.has(connectionString)) {
    console.log(`🔌 Creating new tenant pool for: ${connectionString.split('@')[1]?.split('/')[0]}`);
    tenantPools.set(connectionString, new Pool({ 
      connectionString,
      max: 10, // Max 10 connections per tenant
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
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
    },
  }),
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 🆕 STEP 4: Tenant Pool Middleware - attach tenant pool to request
app.use((req, res, next) => {
  if (req.session && req.session.tenantConnectionString) {
    req.tenantPool = getTenantPool(req.session.tenantConnectionString);
  }
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

// Health check
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

// Auth routes
app.post('/api/auth/login', async (req, res) => {
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
      console.error(`❌ No tenant database found for user ${user.id}`);
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

    // Log tenant routing info
    const dbHost = tenantConnectionString.split('@')[1]?.split('/')[0] || 'unknown';
    console.log(`✅ User ${user.email} (ID: ${user.id}) logged in → Tenant DB: ${dbHost}`);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: req.session.user.plugins,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
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
    let selectedPlugins = ['contacts', 'notes']; // Default plugins
    
    if (plugins && Array.isArray(plugins) && plugins.length > 0) {
      // Validate that all requested plugins are available
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

    // Allow role to be set during signup (defaults to 'user')
    const userRole = req.body.role === 'superuser' ? 'superuser' : 'user';

    // Create user in Railway PostgreSQL
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, passwordHash, userRole]
    );

    const user = userResult.rows[0];
    console.log(`✅ Created user: ${user.email} (ID: ${user.id})`);

    // Create Neon tenant database
    console.log(`🏗️  Creating Neon database for user ${user.id}...`);
    const tenantDb = await neonService.createTenantDatabase(user.id, user.email);

    // Save tenant info in Railway PostgreSQL
    await pool.query(
      'INSERT INTO tenants (user_id, neon_project_id, neon_database_name, neon_connection_string) VALUES ($1, $2, $3, $4)',
      [user.id, tenantDb.projectId, tenantDb.databaseName, tenantDb.connectionString]
    );

    console.log(`✅ Created Neon database: ${tenantDb.databaseName}`);

    // Give selected plugin access
    for (const pluginName of selectedPlugins) {
      await pool.query(
        'INSERT INTO user_plugin_access (user_id, plugin_name, enabled) VALUES ($1, $2, true)',
        [user.id, pluginName]
      );
    }

    console.log(`✅ Granted access to ${selectedPlugins.length} plugins: ${selectedPlugins.join(', ')}`);

    // Auto-login
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      plugins: selectedPlugins,
    };

    // Set tenant connection string for auto-login
    req.session.tenantConnectionString = tenantDb.connectionString;

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: selectedPlugins,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

// 🆕 Admin: Update user role (temporary endpoint for setup)
app.post('/api/admin/update-role', requireAuth, async (req, res) => {
  try {
    // Only existing superusers can update roles
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
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Serve static files from React build (production only)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'public');
  app.use(express.static(buildPath));

  // Serve index.html for all non-API routes (React Router support)
  app.get('*', (req, res, next) => {
    // Skip API routes
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

// Error handling
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Homebase server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔌 Loaded ${pluginLoader.getAllPlugins().length} plugins`);
});
