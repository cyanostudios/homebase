// server/core/middleware/platformTenantsAdmin.js
const ServiceManager = require('../ServiceManager');
const { isPlatformTenantsAdminSession } = require('../config/platformTenantsAdmin');

/**
 * Require hardcoded platform-tenants allowlist (not superuser alone, not requirePlugin alone).
 */
function requirePlatformTenantsAdmin(req, res, next) {
  void (async () => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    let db;
    try {
      db = ServiceManager.get('database');
    } catch {
      db = null;
    }
    const allowed = await isPlatformTenantsAdminSession(req, db);
    if (!allowed) {
      return res.status(403).json({ error: 'Forbidden: platform tenants admin access required' });
    }
    next();
  })().catch((err) => next(err));
}

module.exports = { requirePlatformTenantsAdmin };
