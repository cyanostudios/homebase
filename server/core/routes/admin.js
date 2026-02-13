// server/core/routes/admin.js
// Admin routes: user management, tenant management, role updates

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');
const AdminService = require('../services/admin/AdminService');

// Dependencies will be injected by setupAdminRoutes()
let requireAuth = null;

const adminService = new AdminService();

/**
 * Setup admin routes with dependencies
 * @param {Pool} mainPool - Main database pool (Unused in new Service pattern)
 * @param {Function} authMiddleware - Auth middleware
 */
function setupAdminRoutes(mainPool, authMiddleware) {
  // pool = mainPool; // Managed by Service layer
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

      const user = await adminService.updateRole(email, role);

      res.json({
        message: 'Role updated successfully',
        user: { id: user.id, email: user.email, role: user.role },
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to update role', error, { email: req.body.email });
      if (error.message.includes('Invalid role')) {
        return res.status(400).json({ error: error.message });
      }
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
      const tenants = await adminService.getAllTenants();
      res.json({ tenants });
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

      const { tenantConnectionString, targetUserId } = await adminService.switchTenant(
        req.session.user,
        userId,
      );

      // Update session with new tenant connection
      req.session.tenantConnectionString = tenantConnectionString;
      req.session.currentTenantUserId = targetUserId;

      res.json({
        message: 'Switched tenant successfully',
        tenantUserId: targetUserId,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to switch tenant', error, {
        adminId: req.session.user.id,
        targetUserId: req.body.userId,
      });
      if (error.message === 'Tenant not found') {
        return res.status(404).json({ error: 'Tenant not found' });
      }
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
      const result = await adminService.deleteTenantEntry(req.session.user.id, userId);

      res.json({
        message: 'Tenant entry deleted successfully',
        userId: userId,
        email: result.email,
      });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete tenant entry', error, {
        adminId: req.session.user.id,
        targetUserId: req.params.userId,
      });
      if (error.message === 'User not found' || error.message === 'Tenant entry not found') {
        return res.status(404).json({ error: error.message });
      }
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
      const result = await adminService.deleteUser(req.session.user.id, userId);

      res.json({ message: 'User deleted', email: result.email });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete user', error, {
        adminId: req.session.user.id,
        targetUserId: req.params.userId,
      });
      if (error.message === 'User not found') {
        return res.status(404).json({ error: 'User not found' });
      }
      res.status(500).json({ error: 'Failed to delete user' });
    }
  },
);

module.exports = router;
module.exports.setupAdminRoutes = setupAdminRoutes;
