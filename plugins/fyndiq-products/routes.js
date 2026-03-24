// plugins/fyndiq-products/routes.js
const express = require('express');
const router = express.Router();
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { body, commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createFyndiqProductsRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('fyndiq-products');

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
  // GET /api/fyndiq-products/categories?market=se&language=sv
  router.get('/categories', gate, (req, res) => controller.getCategories(req, res));

  // ---- Articles (Merchants API proxy) ----
  // GET by SKU first so :articleId does not capture "sku"
  router.get('/articles/sku/:sku', gate, (req, res) => controller.getArticleBySku(req, res));
  router.post('/articles/bulk', gate, csrfProtection, (req, res) =>
    controller.bulkCreateArticles(req, res),
  );
  router.put('/articles/bulk', gate, csrfProtection, (req, res) =>
    controller.bulkUpdateArticles(req, res),
  );
  router.get('/articles', gate, (req, res) => controller.listArticles(req, res));
  router.post('/articles', gate, csrfProtection, (req, res) => controller.createArticle(req, res));
  router.get('/articles/:articleId', gate, (req, res) => controller.getArticle(req, res));
  router.put('/articles/:articleId', gate, csrfProtection, (req, res) =>
    controller.updateArticle(req, res),
  );
  router.put('/articles/:articleId/price', gate, csrfProtection, (req, res) =>
    controller.updateArticlePrice(req, res),
  );
  router.put('/articles/:articleId/quantity', gate, csrfProtection, (req, res) =>
    controller.updateArticleQuantity(req, res),
  );
  router.delete('/articles/:articleId', gate, csrfProtection, (req, res) =>
    controller.deleteArticle(req, res),
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

  // ---- Orders pull (MVP: fetch orders -> normalized ingest) ----
  // POST /api/fyndiq-products/orders/pull
  router.post(
    '/orders/pull',
    gate,
    csrfProtection,
    [commonRules.integer('perPage', 1, 100), commonRules.optionalString('status', 50)],
    validateRequest,
    (req, res) => controller.pullOrders(req, res),
  );

  return router;
}

module.exports = createFyndiqProductsRoutes;
