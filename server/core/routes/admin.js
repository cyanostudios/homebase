// server/core/routes/admin.js
// Admin routes: user management, tenant management, role updates

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');

// Dependencies will be injected by setupAdminRoutes()
let pool = null;
let requireAuth = null;

/**
 * Setup admin routes with dependencies
 * @param {Pool} mainPool - Main database pool
 * @param {Function} authMiddleware - Auth middleware
 */
function setupAdminRoutes(mainPool, authMiddleware) {
  pool = mainPool;
  requireAuth = authMiddleware;
}

/**
 * Middleware to check superuser access
 */
function requireSuperuser(req, res, next) {
  if (req.session.user.role !== 'superuser') {
    return res.status(403).json({ error: 'Forbidden: Superuser access required' });
  }
  next();
}

/**
 * POST /update-role
 * Update user role (superuser only)
 */
router.post(
  '/update-role',
  (req, res, next) => requireAuth(req, res, next),
  requireSuperuser,
  async (req, res) => {
    try {
      const { email, role } = req.body;

      if (!email || !role) {
        return res.status(400).json({ error: 'Email and role are required' });
      }

      if (!['user', 'superuser'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "user" or "superuser"' });
      }

      await pool.query('UPDATE public.users SET role = $1 WHERE email = $2', [role, email]);

      const result = await pool.query('SELECT id, email, role FROM public.users WHERE email = $1', [
        email,
      ]);

      res.json({
        message: 'Role updated successfully',
        user: result.rows[0],
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to update role', error, { email: req.body.email });
      res.status(500).json({ error: 'Failed to update role' });
    }
  },
);

/**
 * GET /tenants
 * Get all tenants with active databases (superuser only)
 */
router.get(
  '/tenants',
  (req, res, next) => requireAuth(req, res, next),
  requireSuperuser,
  async (req, res) => {
    try {
      const result = await pool.query(`
      SELECT u.id, u.email, u.role, t.neon_project_id, t.neon_database_name
      FROM public.users u
      INNER JOIN public.tenants t ON u.id = t.user_id
      WHERE t.neon_connection_string IS NOT NULL
      ORDER BY u.id
    `);

      res.json({ tenants: result.rows });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch tenants', error, { adminId: req.session.user.id });
      res.status(500).json({ error: 'Failed to fetch tenants' });
    }
  },
);

/**
 * POST /switch-tenant
 * Switch to another tenant's database (superuser only)
 */
router.post(
  '/switch-tenant',
  (req, res, next) => requireAuth(req, res, next),
  requireSuperuser,
  async (req, res) => {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

      const tenantResult = await pool.query(
        'SELECT user_id FROM public.tenants WHERE user_id = $1 AND neon_connection_string IS NOT NULL',
        [userId],
      );

      if (!tenantResult.rows.length) {
        return res.status(404).json({ error: 'Tenant not found' });
      }

      // Update tenant context reference only (no DB credentials in session)
      req.session.currentTenantUserId = userId;

      const logger = ServiceManager.get('logger');
      logger.info('Admin switched tenant', {
        adminId: req.session.user.id,
        tenantUserId: userId,
      });

      res.json({
        message: 'Switched tenant successfully',
        tenantUserId: userId,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to switch tenant', error, {
        adminId: req.session.user.id,
        targetUserId: req.body.userId,
      });
      res.status(500).json({ error: 'Failed to switch tenant' });
    }
  },
);

/**
 * DELETE /tenants/:userId
 * Delete tenant entry (without deleting user) (superuser only)
 */
router.delete(
  '/tenants/:userId',
  (req, res, next) => requireAuth(req, res, next),
  requireSuperuser,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Get user info before deletion
      const userResult = await pool.query('SELECT email FROM public.users WHERE id = $1', [userId]);
      if (!userResult.rows.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Delete from tenants only (user remains)
      const tenantResult = await pool.query(
        'DELETE FROM public.tenants WHERE user_id = $1 RETURNING id',
        [userId],
      );

      if (!tenantResult.rows.length) {
        return res.status(404).json({ error: 'Tenant entry not found' });
      }

      const logger = ServiceManager.get('logger');
      logger.info('Admin deleted tenant entry', {
        adminId: req.session.user.id,
        tenantUserId: userId,
        userEmail: userResult.rows[0].email,
      });

      res.json({
        message: 'Tenant entry deleted successfully',
        userId: userId,
        email: userResult.rows[0].email,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete tenant entry', error, {
        adminId: req.session.user.id,
        targetUserId: req.params.userId,
      });
      res.status(500).json({ error: 'Failed to delete tenant entry' });
    }
  },
);

/**
 * DELETE /users/:userId
 * Delete user and all associated data (superuser only)
 */
router.delete(
  '/users/:userId',
  (req, res, next) => requireAuth(req, res, next),
  requireSuperuser,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Delete from user_plugin_access
      await pool.query('DELETE FROM public.user_plugin_access WHERE user_id = $1', [userId]);

      // Delete from tenants
      await pool.query('DELETE FROM public.tenants WHERE user_id = $1', [userId]);

      // Delete from users
      const result = await pool.query('DELETE FROM public.users WHERE id = $1 RETURNING email', [
        userId,
      ]);

      if (!result.rows.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({ message: 'User deleted', email: result.rows[0].email });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete user', error, {
        adminId: req.session.user.id,
        targetUserId: req.params.userId,
      });
      res.status(500).json({ error: 'Failed to delete user' });
    }
  },
);

module.exports = router;
module.exports.setupAdminRoutes = setupAdminRoutes;
