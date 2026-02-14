// server/core/middleware/authorization.js
// Tenant-scoped role checks. Use after requireAuth.

const { TENANT_ROLES } = require('../config/constants');

const ROLE_ORDER = { user: 0, editor: 1, admin: 2 };

/**
 * Require at least one of the given tenant roles (or higher in hierarchy).
 * Hierarchy: user < editor < admin.
 * Superuser bypass: platform superusers always pass.
 * @param {string[]} allowedRoles - e.g. ['admin'], ['editor', 'admin'], ['user', 'editor', 'admin']
 */
function requireTenantRole(allowedRoles) {
  if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
    throw new Error('requireTenantRole: allowedRoles must be a non-empty array');
  }
  const valid = new Set(Object.values(TENANT_ROLES));
  for (const r of allowedRoles) {
    if (!valid.has(r)) {
      throw new Error(`requireTenantRole: invalid role "${r}"`);
    }
  }

  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.session.user.role === 'superuser') {
      return next();
    }
    const tenantRole = req.session.tenantRole || 'user';
    const userLevel = ROLE_ORDER[tenantRole] ?? -1;
    const requiredLevel = Math.min(...allowedRoles.map((r) => ROLE_ORDER[r] ?? 999));
    // Pass if user's role level is at least the minimum of allowed roles (hierarchy)
    if (userLevel >= requiredLevel) {
      return next();
    }
    return res.status(403).json({
      error: 'Forbidden: insufficient tenant role',
      required: allowedRoles,
    });
  };
}

module.exports = { requireTenantRole };
