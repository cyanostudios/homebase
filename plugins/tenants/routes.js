// plugins/tenants/routes.js
const express = require('express');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const {
  requirePlatformTenantsAdmin,
} = require('../../server/core/middleware/platformTenantsAdmin');

/**
 * @param {import('./controller')} controller
 * @param {object} context
 */
function createTenantsRoutes(controller, context) {
  const router = express.Router();
  const requireAuth =
    context?.middleware?.requireAuth ||
    ((req, res, next) => {
      if (!req.session?.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      next();
    });

  // Code allowlist only — do not use requirePlugin('tenants') as the sole gate.
  router.use(requireAuth, requirePlatformTenantsAdmin);

  router.get('/', controller.list);
  router.get('/:tenantId', controller.get);
  router.put('/:tenantId/plugins', csrfProtection, controller.updatePlugins);

  return router;
}

module.exports = createTenantsRoutes;
