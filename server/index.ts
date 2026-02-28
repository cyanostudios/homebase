// server/index.ts
// Minimal server entry point - all logic moved to core modules

/// <reference path="./types/express.d.ts" />

import type { Request, Response, NextFunction } from 'express';

const { execSync } = require('child_process');
const path = require('path');

const compression = require('compression');
const pgSession = require('connect-pg-simple');
const cors = require('cors');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { Pool } = require('pg');

// Load shared env first, then local overrides.
require('dotenv').config({ path: '.env' });
require('dotenv').config({ path: '.env.local', override: true });

if (!String(process.env.DATABASE_URL || '').trim()) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const REQUIRED_PRODUCTION_ENV = ['DATABASE_URL', 'SESSION_SECRET', 'CREDENTIALS_ENCRYPTION_KEY'];
if (process.env.NODE_ENV === 'production') {
  const missing = REQUIRED_PRODUCTION_ENV.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
}

const PluginLoader = require('../plugin-loader');

// Core infrastructure
const Bootstrap = require('./core/Bootstrap');
const { activityLogMiddleware } = require('./core/middleware/activityLog');
const { csrfProtection, csrfTokenHandler } = require('./core/middleware/csrf');
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

// Main database pool (for auth, tenant mapping, and app queries)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
pool.on('error', (err) => {
  console.error('[POOL] Database pool error (connection will be removed):', err.message);
});

// Dedicated session pool – avoids competing with app queries under load (fixes logout on rapid F5)
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
sessionPool.on('error', (err) => {
  console.error('[SESSION_POOL] Database session pool error (connection will be removed):', err.message);
});

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        frameSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  }),
);
app.use(compression());
// In development we only allow localhost origins to avoid cookie/session split across hosts.
const corsOrigin =
  process.env.NODE_ENV === 'production'
    ? false
    : ['http://localhost:3001', 'http://localhost:5173', 'http://localhost:3002'];
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// Session (dedicated pool so session load/save never competes with app queries)
app.use(
  session({
    store: new (pgSession(session))({
      pool: sessionPool,
      tableName: 'sessions',
    }),
    secret:
      process.env.SESSION_SECRET ||
      (process.env.NODE_ENV === 'production'
        ? (() => {
            throw new Error('SESSION_SECRET is required in production');
          })()
        : 'homebase-dev-secret-change-in-production'),
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

// DEBUG: Log session state after session is loaded (for troubleshooting logout on reload)
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    const sid = req.sessionID;
    const sidShort = typeof sid === 'string' ? sid.slice(0, 8) + '...' : '(no id)';
    const hasUser = !!(req.session && req.session.user);
    const userId = req.session?.user?.id;
    console.log('[SESSION]', req.method, req.path, '| sid:', sidShort, '| hasUser:', hasUser, '| userId:', userId ?? '—');
  }
  next();
});

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Tenant Pool Middleware
//
// - TENANT_PROVIDER=neon: database-per-tenant → req.tenantPool is resolved server-side from tenant user id.
// - TENANT_PROVIDER=local: schema-per-tenant in ONE database (often Neon Postgres via pooler).
//   IMPORTANT: Neon pooler does NOT support setting search_path via startup "options".
//   For local provider we therefore rely on PostgreSQLAdapter's per-query `SET search_path TO tenant_<userId>, public`
//   and DO NOT create a separate tenant pool based on a connection string with search_path options.
app.use(async (req: Request, res: Response, next: NextFunction) => {
  const userId = req.session?.user?.id;

  // Always keep currentTenantUserId in sync when logged in (used by DB adapter)
  if (req.session?.user && req.session.currentTenantUserId == null && userId != null) {
    req.session.currentTenantUserId = userId;
  }

  if (process.env.TENANT_PROVIDER === 'neon') {
    const tenantUserId = req.session?.currentTenantUserId ?? userId;
    if (tenantUserId) {
      const connectionPool = ServiceManager.get('connectionPool');
      try {
        const r = await pool.query(
          'SELECT neon_connection_string FROM tenants WHERE user_id = $1 AND neon_connection_string IS NOT NULL LIMIT 1',
          [tenantUserId],
        );
        if (r.rows?.length && r.rows[0].neon_connection_string) {
          req.tenantPool = connectionPool.getTenantPool(r.rows[0].neon_connection_string);
        } else {
          req.tenantPool = undefined;
        }
      } catch (_e) {
        req.tenantPool = undefined;
      }
    } else {
      req.tenantPool = undefined;
    }
  } else {
    // local (schema-per-tenant): no tenant pool; DB adapter will SET search_path per query.
    req.tenantPool = undefined;
  }

  ServiceManager.initialize(req);
  next();
});

// Auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    const poolStats =
      pool && typeof (pool as any).totalCount === 'number'
        ? ` pool total: ${(pool as any).totalCount} idle: ${(pool as any).idleCount}`
        : '';
    console.log(
      '[AUTH] 401 Unauthorized',
      req.method,
      req.path,
      '| sessionID:',
      typeof req.sessionID === 'string' ? req.sessionID.slice(0, 8) + '...' : req.sessionID,
      '| hasSession:',
      !!req.session,
      '| user:',
      req.session?.user ?? '—',
      poolStats,
    );
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requirePlugin(pluginName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
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
app.get('/api/csrf-token', csrfProtection, csrfTokenHandler);

// DEBUG: Client can send log lines here so everything appears in the server terminal (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.post('/api/debug-log', express.json(), (req: Request, res: Response) => {
    const msg = req.body?.message ?? req.body?.msg ?? String(req.body);
    console.log('[CLIENT]', msg);
    res.status(204).end();
  });
}

// Global rate limiting
app.use('/api', globalLimiter);

// Prevent browser/proxy from caching API responses (avoids stale Channels, Products, etc. on refresh)
app.use('/api', (_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Activity log middleware (after rate limiting, before routes)
app.use(activityLogMiddleware);

// Setup core routes (auth, admin, health)
setupCoreRoutes(app, { pool, authLimiter, requireAuth, pluginLoader });

// Serve static files (production)
if (process.env.NODE_ENV === 'production') {
  const buildPath = path.join(__dirname, 'public');
  app.use(express.static(buildPath));
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(buildPath, 'index.html'));
  });
}

// Load plugins
pluginLoader.loadPlugins(app);

// Plugin info endpoint
app.get('/api/plugins', requireAuth, (req: Request, res: Response) => {
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
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📋 Auth debug logs: [SESSION] [AUTH] [AUTH/ME] [CLIENT] — all appear in this terminal`);
  }
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
  await Promise.all([pool.end(), sessionPool.end()]);
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
