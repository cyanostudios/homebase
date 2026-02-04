// server/index.ts
// Minimal server entry point - all logic moved to core modules

const { execSync } = require('child_process');
const path = require('path');

const compression = require('compression');
const pgSession = require('connect-pg-simple');
const cors = require('cors');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { Pool } = require('pg');

require('dotenv').config({ path: '.env.local' });

const PluginLoader = require('../plugin-loader');

// Core infrastructure
const Bootstrap = require('./core/Bootstrap');
const { activityLogMiddleware } = require('./core/middleware/activityLog');
const { csrfTokenHandler } = require('./core/middleware/csrf');
const { errorHandler } = require('./core/middleware/errorHandler');
const { globalLimiter, authLimiter } = require('./core/middleware/rateLimit');
const { setupCoreRoutes } = require('./core/routes');
const ServiceManager = require('./core/ServiceManager');

// Initialize Bootstrap (loads all service providers)
Bootstrap.initializeServices();

const app = express();
const PORT = process.env.PORT || 3002;

// Trust Railway proxy
app.set('trust proxy', 1);

// Main database pool (for auth and tenant mapping)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://*.dropbox.com", "https://*.dropboxstatic.com"],
        imgSrc: ["'self'", 'data:', 'https:', "https://*.dropbox.com", "https://*.dropboxusercontent.com"],
        frameSrc: ["'self'", "https://*.dropbox.com", "https://*.dropboxusercontent.com"],
        connectSrc: ["'self'", "https://*.dropboxapi.com", "https://*.dropbox.com"],
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

// Session
app.use(
  session({
    store: new (pgSession(session))({
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

// Tenant Pool Middleware
app.use((req, res, next) => {
  if (req.session && req.session.tenantConnectionString) {
    const connectionPool = ServiceManager.get('connectionPool');
    req.tenantPool = connectionPool.getTenantPool(req.session.tenantConnectionString);
  }
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
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.session.user.role === 'superuser') {
      return next();
    }
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

// CSRF token endpoint
app.get('/api/csrf-token', csrfTokenHandler);

// Global rate limiting
app.use('/api', globalLimiter);

// Activity log middleware (after rate limiting, before routes)
app.use(activityLogMiddleware);

// Setup core routes (auth, admin, health)
setupCoreRoutes(app, { pool, authLimiter, requireAuth, pluginLoader });

// Serve static files (production)
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

// Load plugins
pluginLoader.loadPlugins(app);

// Plugin info endpoint
app.get('/api/plugins', requireAuth, (req, res) => {
  const plugins = pluginLoader.getAllPlugins();
  res.json(plugins);
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
let gitCommitHash = 'unknown';
try {
  gitCommitHash = execSync('git rev-parse --short HEAD', {
    encoding: 'utf-8',
    cwd: __dirname,
  }).trim();
} catch {
  gitCommitHash = process.env.GIT_COMMIT || 'unknown';
}

const server = app.listen(PORT, () => {
  console.log(`🚀 Homebase server running on port ${PORT}`);
  console.log(`BACKEND_VERSION=${gitCommitHash}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗄️  Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔌 Loaded ${pluginLoader.getAllPlugins().length} plugins`);
});

// Graceful shutdown - wait for server to drain before closing pool
async function gracefulShutdown() {
  console.log('🛑 Initiating graceful shutdown...');
  await new Promise<void>((resolve) => {
    let resolved = false;
    const done = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };
    server.close(() => {
      console.log('   Server connections drained');
      done();
    });
    // Fallback: force resolve after 10s if close hangs
    setTimeout(done, 10000);
  });
  await Bootstrap.shutdown();
  await pool.end();
  process.exit(0);
}

process.on('SIGTERM', () => {
  gracefulShutdown().catch((err) => {
    console.error('Shutdown error:', err);
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  gracefulShutdown().catch((err) => {
    console.error('Shutdown error:', err);
    process.exit(1);
  });
});
