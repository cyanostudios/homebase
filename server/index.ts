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

// Load from project root (not process.cwd — tools may start the API from another directory)
const projectRoot = path.join(__dirname, '..');
require('dotenv').config({ path: path.join(projectRoot, '.env') });
require('dotenv').config({ path: path.join(projectRoot, '.env.local') });

// Puppeteer (ingest browser_fetch): use project .cache/puppeteer by default. Cursor/sandbox may inject
// PUPPETEER_CACHE_DIR under a temp path where Chrome was never installed — override that.
const defaultPuppeteerCacheDir = path.join(projectRoot, '.cache', 'puppeteer');
const rawPuppeteerCache = process.env.PUPPETEER_CACHE_DIR;
const sandboxInjectedPuppeteerCache =
  typeof rawPuppeteerCache === 'string' &&
  (rawPuppeteerCache.includes('cursor-sandbox-cache') ||
    rawPuppeteerCache.includes('sandbox-cache'));
if (!rawPuppeteerCache || sandboxInjectedPuppeteerCache) {
  process.env.PUPPETEER_CACHE_DIR = defaultPuppeteerCacheDir;
}

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

if (!process.env.DATABASE_URL) {
  console.error(
    '❌ DATABASE_URL is not set. Add it to .env or .env.local (e.g. DATABASE_URL=postgresql://user:pass@localhost:5432/dbname)',
  );
  process.exit(1);
}

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
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  }),
);
app.use(compression());
// CORS: allow frontend origin so login/session work when frontend and API are on different hosts
// Also allows PUBLIC_BOOKING_URL and PUBLIC_CUPS_URL for public apps
const allowedOrigins: (string | boolean)[] = [];
if (process.env.NODE_ENV === 'production') {
  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }
  if (process.env.PUBLIC_BOOKING_URL) {
    allowedOrigins.push(process.env.PUBLIC_BOOKING_URL);
  }
  if (process.env.PUBLIC_CUPS_URL) {
    allowedOrigins.push(process.env.PUBLIC_CUPS_URL);
  }
} else {
  const devUi = process.env.FRONTEND_URL || 'http://localhost:3001';
  allowedOrigins.push(devUi);
  // Same UI on 127.0.0.1 (CORS if client ever calls API cross-origin; also documents intent)
  if (devUi.includes('localhost')) {
    allowedOrigins.push(devUi.replace('localhost', '127.0.0.1'));
  }
  if (process.env.PUBLIC_BOOKING_URL) {
    allowedOrigins.push(process.env.PUBLIC_BOOKING_URL);
  }
  if (process.env.PUBLIC_CUPS_URL) {
    allowedOrigins.push(process.env.PUBLIC_CUPS_URL);
  }
  // Public cups static app local dev defaults (works even without .env override)
  allowedOrigins.push('http://localhost:3004');
  allowedOrigins.push('http://127.0.0.1:3004');
  allowedOrigins.push('http://localhost:3002');
  allowedOrigins.push('http://127.0.0.1:3002');
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }),
);

const sessionSecret = process.env.SESSION_SECRET;
if (
  process.env.NODE_ENV === 'production' &&
  (!sessionSecret || sessionSecret === 'homebase-dev-secret-change-in-production')
) {
  console.error('❌ CRITICAL: SESSION_SECRET must be set to a strong random string in production!');
  process.exit(1);
}

// Session
app.use(
  session({
    store: new (pgSession(session))({
      pool: pool,
      tableName: 'sessions',
    }),
    secret: sessionSecret || 'homebase-dev-secret-change-in-production',
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
app.use((req: any, res: any, next: any) => {
  if (req.session && req.session.tenantConnectionString) {
    const connectionPool = ServiceManager.get('connectionPool');
    req.tenantPool = connectionPool.getTenantPool(req.session.tenantConnectionString);
  }
  ServiceManager.initialize(req);
  next();
});

// Auth middleware
function requireAuth(req: any, res: any, next: any) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requirePlugin(pluginName: string) {
  return async (req: any, res: any, next: any) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.session.user.role === 'superuser') {
      return next();
    }
    const tenantId = req.session.tenantId;
    if (tenantId !== undefined && tenantId !== null) {
      try {
        const result = await pool.query(
          'SELECT enabled FROM tenant_plugin_access WHERE tenant_id = $1 AND plugin_name = $2 AND enabled = true',
          [tenantId, pluginName],
        );
        if (result.rows.length > 0) {
          return next();
        }
      } catch {
        // tenant_plugin_access may not exist before migration; fall back to user_plugin_access
      }
    }
    const fallback = await pool.query(
      'SELECT enabled FROM user_plugin_access WHERE user_id = $1 AND plugin_name = $2',
      [req.session.user.id, pluginName],
    );
    if (!fallback.rows.length || !fallback.rows[0].enabled) {
      return res.status(403).json({ error: `Access denied to ${pluginName} plugin` });
    }
    next();
  };
}

// Initialize plugin system
const pluginLoader = new PluginLoader(pool, requirePlugin, requireAuth);

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
  app.get('*', (req: any, res: any, next: any) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// Load plugins
pluginLoader.loadPlugins(app);

// Plugin info endpoint
app.get('/api/plugins', requireAuth, (req: any, res: any) => {
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

  try {
    const {
      runBrowserFetchStartupDiagnostics,
    } = require('../plugins/ingest/services/browserFetchStartupDiagnostics');
    void runBrowserFetchStartupDiagnostics();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[ingest:browser_fetch] startup diagnostics skipped:', msg);
  }
});

/**
 * Close HTTP listener. Without forcing connections closed, open keep-alive sockets
 * can block `server.close()` indefinitely — tsx watch then hits "Process didn't exit in 5s".
 * Node 18+: closeAllConnections() drops those clients after a short grace period.
 */
function closeHttpServer(
  httpServer: ReturnType<typeof app.listen>,
  forceAfterMs = 2000,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    httpServer.close(() => done());
    setTimeout(() => {
      const s = httpServer as typeof httpServer & { closeAllConnections?: () => void };
      if (typeof s.closeAllConnections === 'function') {
        s.closeAllConnections();
      }
      done();
    }, forceAfterMs);
  });
}

let shutdownStarted = false;

async function gracefulShutdown(signal: string) {
  if (shutdownStarted) {
    return;
  }
  shutdownStarted = true;
  console.log(`🛑 ${signal} received`);
  try {
    await closeHttpServer(server);
    await Bootstrap.shutdown();
    await pool.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Error during shutdown:', msg);
  } finally {
    process.exit(0);
  }
}

process.once('SIGTERM', () => {
  void gracefulShutdown('SIGTERM');
});

process.once('SIGINT', () => {
  void gracefulShutdown('SIGINT');
});
