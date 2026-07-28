// server/core/routes/organization.js
// Shared account organization profile (tenant.organization on main DB).

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');
const {
  OrganizationService,
  normalizeOrganization,
} = require('../services/organization/OrganizationService');
const { requireTenantRole } = require('../middleware/authorization');
const { csrfProtection } = require('../middleware/csrf');

let requireAuth = null;
let organizationService = null;

function setupOrganizationRoutes(authMiddleware, mainPool) {
  requireAuth = authMiddleware;
  organizationService = new OrganizationService(mainPool);
}

/**
 * GET /organization
 * Read shared account organization profile (all tenant roles).
 */
router.get(
  '/',
  (req, res, next) => requireAuth(req, res, next),
  requireTenantRole(['user', 'editor', 'admin']),
  async (req, res) => {
    try {
      const tenantId = req.session.tenantId;
      if (tenantId == null) {
        return res.status(400).json({ error: 'No account context' });
      }
      const organization = await organizationService.getOrganization(tenantId);
      res.json({ organization });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Get organization failed', error, { tenantId: req.session?.tenantId });
      res.status(500).json({ error: 'Failed to load organization' });
    }
  },
);

/**
 * PUT /organization
 * Replace shared account organization profile (admin / editor).
 */
router.put(
  '/',
  (req, res, next) => requireAuth(req, res, next),
  requireTenantRole(['admin', 'editor']),
  csrfProtection,
  async (req, res) => {
    try {
      const tenantId = req.session.tenantId;
      if (tenantId == null) {
        return res.status(400).json({ error: 'No account context' });
      }
      const body = req.body?.organization ?? req.body ?? {};
      const organization = await organizationService.updateOrganization(
        tenantId,
        normalizeOrganization(body),
      );
      res.json({ organization });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Update organization failed', error, { tenantId: req.session?.tenantId });
      if (error.message === 'Account not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to save organization' });
    }
  },
);

module.exports = router;
module.exports.setupOrganizationRoutes = setupOrganizationRoutes;
