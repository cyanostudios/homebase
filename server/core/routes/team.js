// server/core/routes/team.js
// Tenant team management: list members, add, update role, remove.

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');
const TeamService = require('../services/team/TeamService');
const { requireTenantRole } = require('../middleware/authorization');

let requireAuth = null;
let teamService = null;

function setupTeamRoutes(authMiddleware, mainPool) {
  requireAuth = authMiddleware;
  teamService = new TeamService(mainPool);
}

/**
 * GET /team/users
 * List members of the current account (user, editor, admin – all can view)
 */
router.get(
  '/users',
  (req, res, next) => requireAuth(req, res, next),
  requireTenantRole(['user', 'editor', 'admin']),
  async (req, res) => {
    try {
      const tenantId = req.session.tenantId;
      if (tenantId == null) {
        return res.status(400).json({ error: 'No account context' });
      }
      const members = await teamService.listMembers(tenantId);
      res.json({ members });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('List team members failed', error, { tenantId: req.session?.tenantId });
      res.status(500).json({ error: 'Failed to list team members' });
    }
  },
);

/**
 * POST /team/users
 * Add a user to the current tenant (admin only)
 * Body: { email, password?, role? }. password required when creating a new user.
 */
router.post(
  '/users',
  (req, res, next) => requireAuth(req, res, next),
  requireTenantRole(['admin']),
  async (req, res) => {
    try {
      const tenantId = req.session.tenantId;
      if (tenantId == null) {
        return res.status(400).json({ error: 'No account context' });
      }
      const { email, password, role } = req.body || {};
      if (!email || typeof email !== 'string' || !email.trim()) {
        return res.status(400).json({ error: 'Email is required' });
      }
      const member = await teamService.addMember(tenantId, req.session.user.id, {
        email: email.trim(),
        password: password || undefined,
        role: role || 'user',
      });
      res.status(201).json(member);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Add team member failed', error, { email: req.body?.email });
      if (
        error.message.includes('already a member') ||
        error.message.includes('Password required')
      ) {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to add team member' });
    }
  },
);

/**
 * PATCH /team/users/:userId/role
 * Update a member's role (admin only)
 * Body: { role: 'user' | 'editor' | 'admin' }
 */
router.patch(
  '/users/:userId/role',
  (req, res, next) => requireAuth(req, res, next),
  requireTenantRole(['admin']),
  async (req, res) => {
    try {
      const tenantId = req.session.tenantId;
      const userId = parseInt(req.params.userId, 10);
      if (tenantId == null || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid account or user id' });
      }
      const { role } = req.body || {};
      if (!role) {
        return res.status(400).json({ error: 'Role is required' });
      }
      const result = await teamService.updateMemberRole(tenantId, userId, role);
      res.json(result);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Update member role failed', error, { userId: req.params.userId });
      if (error.message.includes('Invalid role') || error.message.includes('not found')) {
        return res.status(400).json({ error: error.message });
      }
      if (error.message.includes('last admin')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update role' });
    }
  },
);

/**
 * DELETE /team/users/:userId
 * Remove a member from the tenant (admin only). User account is not deleted.
 */
router.delete(
  '/users/:userId',
  (req, res, next) => requireAuth(req, res, next),
  requireTenantRole(['admin']),
  async (req, res) => {
    try {
      const tenantId = req.session.tenantId;
      const userId = parseInt(req.params.userId, 10);
      if (tenantId == null || isNaN(userId)) {
        return res.status(400).json({ error: 'Invalid account or user id' });
      }
      await teamService.removeMember(tenantId, userId);
      res.json({ message: 'Member removed', userId });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Remove team member failed', error, { userId: req.params.userId });
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('last admin')) {
        return res.status(403).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to remove member' });
    }
  },
);

module.exports = router;
module.exports.setupTeamRoutes = setupTeamRoutes;
