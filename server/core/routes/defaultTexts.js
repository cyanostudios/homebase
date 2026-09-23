// server/core/routes/defaultTexts.js
// Shared account default mail texts (tenant.default_texts on main DB).

const express = require('express');
const router = express.Router();
const ServiceManager = require('../ServiceManager');
const {
  DefaultTextsService,
  normalizeDefaultTexts,
} = require('../services/default-texts/DefaultTextsService');
const { requireTenantRole } = require('../middleware/authorization');
const { csrfProtection } = require('../middleware/csrf');

let requireAuth = null;
let defaultTextsService = null;

function setupDefaultTextsRoutes(authMiddleware, mainPool) {
  requireAuth = authMiddleware;
  defaultTextsService = new DefaultTextsService(mainPool);
}

/**
 * GET /default-texts
 * Read shared account default mail texts (all tenant roles).
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
      const defaultTexts = await defaultTextsService.getDefaultTexts(tenantId);
      res.json({ defaultTexts });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Get default texts failed', error, { tenantId: req.session?.tenantId });
      res.status(500).json({ error: 'Failed to load default texts' });
    }
  },
);

/**
 * PUT /default-texts
 * Replace shared account default mail texts (admin / editor).
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
      const body = req.body?.defaultTexts ?? req.body ?? {};
      const defaultTexts = await defaultTextsService.updateDefaultTexts(
        tenantId,
        normalizeDefaultTexts(body),
      );
      res.json({ defaultTexts });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Update default texts failed', error, { tenantId: req.session?.tenantId });
      if (error.message === 'Account not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to save default texts' });
    }
  },
);

module.exports = router;
module.exports.setupDefaultTextsRoutes = setupDefaultTextsRoutes;
