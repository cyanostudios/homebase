// plugins/cdon-products/routes.js
const express = require('express');
const router = express.Router();
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createCdonProductsRoutes(controller, context) {
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('cdon-products');

  // ---- Settings ----
  router.get('/settings', gate, (req, res) => controller.getSettings(req, res));

  router.put(
    '/settings',
    gate,
    csrfProtection,
    [
      commonRules.optionalString('apiKey', 500),
      commonRules.optionalString('apiSecret', 500),
    ],
    validateRequest,
    (req, res) => controller.putSettings(req, res),
  );

  // ---- Connection test ----
  router.post(
    '/test',
    gate,
    csrfProtection,
    [
      commonRules.optionalString('apiKey', 500),
      commonRules.optionalString('apiSecret', 500),
    ],
    validateRequest,
    (req, res) => controller.testConnection(req, res),
  );

  // ---- Categories (read-only, public categorization API) ----
  router.get('/categories', gate, (req, res) => controller.getCategories(req, res));
  router.get('/categories/google', gate, (req, res) => controller.getGoogleCategories(req, res));
  router.get('/categories/:categoryId/attributes', gate, (req, res) => controller.getCategoryAttributes(req, res));

  // ---- Tracking (Merchants API) ----
  router.get('/deliveries', gate, (req, res) => controller.getDeliveries(req, res));
  router.get('/deliveries/:receiptId', gate, (req, res) => controller.getDeliveryStatus(req, res));
  router.get('/deliveries/:receiptId/failures', gate, (req, res) => controller.getDeliveryFailures(req, res));

  // ---- Export ----
  router.post(
    '/products/export',
    gate,
    csrfProtection,
    [
      commonRules.array('products', 500),
      body('markets')
        .optional()
        .isArray()
        .withMessage('markets must be an array')
        .custom((val) => {
          if (!val || val.length === 0) return true;
          const allowed = ['se', 'dk', 'fi'];
          const bad = val.some((m) => !allowed.includes(String(m).toLowerCase()));
          if (bad) throw new Error('markets may only contain se, dk, fi');
          return true;
        }),
    ],
    validateRequest,
    (req, res) => controller.exportProducts(req, res),
  );

  // ---- Batch delete ----
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    [
      commonRules.array('productIds', 500),
      body('markets')
        .optional()
        .isArray()
        .withMessage('markets must be an array')
        .custom((val) => {
          if (!val || val.length === 0) return true;
          const allowed = ['se', 'dk', 'fi'];
          const bad = val.some((m) => !allowed.includes(String(m).toLowerCase()));
          if (bad) throw new Error('markets may only contain se, dk, fi');
          return true;
        }),
    ],
    validateRequest,
    (req, res) => controller.batchDelete(req, res),
  );

  // ---- Orders (Merchants API) ----
  router.post(
    '/orders/pull',
    gate,
    csrfProtection,
    [commonRules.integer('limit', 1, 1000)],
    validateRequest,
    (req, res) => controller.pullOrders(req, res),
  );
  router.put(
    '/orders/:orderId/fulfill',
    gate,
    csrfProtection,
    (req, res) => controller.fulfillOrder(req, res),
  );
  router.put(
    '/orders/:orderId/cancel',
    gate,
    csrfProtection,
    (req, res) => controller.cancelOrder(req, res),
  );

  return router;
}

module.exports = createCdonProductsRoutes;

