// server/index-modular.ts
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const path = require('path');
const PluginLoader = require('../plugin-loader');
require('dotenv').config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3002;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Security and performance middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? false : 'http://localhost:3001',
  credentials: true,
}));

// Session configuration
app.use(session({
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
  },
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
      [req.session.user.id, pluginName]
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
    plugins: loadedPlugins.map(p => ({ name: p.name, route: p.routeBase }))
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
      [user.id]
    );
    
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      plugins: pluginAccess.rows.map(row => row.plugin_name),
    };
    
    res.json({ 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        plugins: req.session.user.plugins,
      }
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

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.session.user });
});

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
  console.log(`🔌 Plugin system: Enabled`);
});

module.exports = app;