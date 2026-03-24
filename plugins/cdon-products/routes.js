// plugins/cdon-products/routes.js
const express = require('express');
const router = express.Router();
const { csrfProtection } = require('../../server/core/middleware/csrf');
const {
  body,
  param,
  commonRules,
  validateRequest,
} = require('../../server/core/middleware/validation');

function createCdonProductsRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('cdon-products');

  // ---- Settings ----
  router.get('/settings', gate, (req, res) => controller.getSettings(req, res));

  router.put(
    '/settings',
    gate,
    csrfProtection,
    [commonRules.optionalString('apiKey', 500), commonRules.optionalString('apiSecret', 500)],
    validateRequest,
    (req, res) => controller.putSettings(req, res),
  );

  // ---- Connection test ----
  router.post(
    '/test',
    gate,
    csrfProtection,
    [commonRules.optionalString('apiKey', 500), commonRules.optionalString('apiSecret', 500)],
    validateRequest,
    (req, res) => controller.testConnection(req, res),
  );

  // ---- Categories (read-only) ----
  // With market+language: Merchants API v1/categories/{market}/{language}/. Without: public categorization API.
  router.get('/categories', gate, (req, res) => controller.getCategories(req, res));
  router.get('/categories/google', gate, (req, res) => controller.getGoogleCategories(req, res));
  router.get('/categories/:categoryId/attributes', gate, (req, res) =>
    controller.getCategoryAttributes(req, res),
  );

  // ---- Articles (Merchants API v2) ----
  router.post('/articles/bulk', gate, csrfProtection, (req, res) =>
    controller.bulkCreateArticles(req, res),
  );
  router.put('/articles/bulk', gate, csrfProtection, (req, res) =>
    controller.bulkUpdateArticles(req, res),
  );

  // ---- Status tracking (Merchants API v1) ----
  router.post('/statuses/batch', gate, csrfProtection, (req, res) =>
    controller.statusesBatch(req, res),
  );
  router.post('/statuses/sku', gate, csrfProtection, (req, res) =>
    controller.statusesSku(req, res),
  );

  // ---- Tracking (Merchants API) ----
  router.get('/deliveries', gate, (req, res) => controller.getDeliveries(req, res));
  router.get('/deliveries/:receiptId', gate, (req, res) => controller.getDeliveryStatus(req, res));
  router.get('/deliveries/:receiptId/failures', gate, (req, res) =>
    controller.getDeliveryFailures(req, res),
  );

  // ---- Export ----
  router.post(
    '/products/export',
    gate,
    csrfProtection,
    [
      body('mode')
        .optional()
        .isIn(['update_only_strict'])
        .withMessage('mode must be update_only_strict when provided'),
      commonRules.array('products', 500),
      body('products').custom((products, { req }) => {
        const mode = String(req.body?.mode || '')
          .trim()
          .toLowerCase();
        if (mode !== 'update_only_strict') return true;
        if (!Array.isArray(products)) throw new Error('products must be an array');
        for (const item of products) {
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            throw new Error('each product must be an object');
          }
          const id = String(item.id || '').trim();
          if (!id) throw new Error('product.id is required in update_only_strict');
          const sku = String(item.sku || '').trim();
          if (!sku) throw new Error('product.sku is required in update_only_strict');
          const quantity = Number(item.quantity);
          if (!Number.isFinite(quantity) || quantity < 0) {
            throw new Error('product.quantity must be a non-negative number in update_only_strict');
          }
          const priceAmount = Number(item.priceAmount);
          if (!Number.isFinite(priceAmount) || priceAmount < 0) {
            throw new Error(
              'product.priceAmount must be a non-negative number in update_only_strict',
            );
          }
          const currency = String(item.currency || '')
            .trim()
            .toUpperCase();
          if (!/^[A-Z]{3}$/.test(currency)) {
            throw new Error('product.currency must be ISO 4217 (3 letters) in update_only_strict');
          }
        }
        return true;
      }),
      body('markets')
        .optional()
        .isArray()
        .withMessage('markets must be an array')
        .custom((val) => {
          if (!val || val.length === 0) return true;
          const allowed = ['se', 'dk', 'fi', 'no'];
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
          const allowed = ['se', 'dk', 'fi', 'no'];
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
    [param('orderId').trim().notEmpty().withMessage('orderId is required')],
    validateRequest,
    (req, res) => controller.fulfillOrder(req, res),
  );
  router.put(
    '/orders/:orderId/cancel',
    gate,
    csrfProtection,
    [param('orderId').trim().notEmpty().withMessage('orderId is required')],
    validateRequest,
    (req, res) => controller.cancelOrder(req, res),
  );

  return router;
}

module.exports = createCdonProductsRoutes;
