// plugins/woocommerce-products/routes.js
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

// storeUrl: trim + length + isURL, but NO escape() (escape turns / into &#x2F; and breaks URL validation)
const storeUrlRequired = () =>
  body('storeUrl')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('storeUrl must be between 1 and 500 characters')
    .isURL()
    .withMessage('storeUrl must be a valid URL');

const storeUrlOptional = () =>
  body('storeUrl')
    .optional({ values: 'falsy' })
    .customSanitizer((v) => (v == null || v === '' ? '' : String(v).trim()))
    .isLength({ max: 500 })
    .withMessage('storeUrl must not exceed 500 characters')
    .custom((v) => {
      if (!v) return true;
      try {
        new URL(v);
        return true;
      } catch {
        throw new Error('storeUrl must be a valid URL');
      }
    });

function createWooCommerceRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('woocommerce-products');

  // ---- Instances (multi-store support) ----
  router.get('/instances', gate, (req, res) => controller.listInstances(req, res));
  
  router.post('/instances',
    gate,
    csrfProtection,
    [
      commonRules.string('instanceKey', 1, 50),
      commonRules.optionalString('label', 255),
      storeUrlRequired(),
      commonRules.string('consumerKey', 1, 255),
      commonRules.string('consumerSecret', 1, 255),
      body('useQueryAuth').optional().isBoolean(),
    ],
    validateRequest,
    (req, res) => controller.createInstance(req, res)
  );

  router.put('/instances/:id',
    gate,
    csrfProtection,
    [
      commonRules.id('id'),
      commonRules.optionalString('label', 255),
      storeUrlOptional(),
      commonRules.optionalString('consumerKey', 255),
      commonRules.optionalString('consumerSecret', 255),
      body('useQueryAuth').optional().isBoolean(),
    ],
    validateRequest,
    (req, res) => controller.updateInstance(req, res)
  );

  router.delete('/instances/:id',
    gate,
    csrfProtection,
    [
      commonRules.id('id'),
    ],
    validateRequest,
    (req, res) => controller.deleteInstance(req, res)
  );

  // ---- Connection test ----
  router.post('/test',
    gate,
    csrfProtection,
    [
      storeUrlOptional(),
      commonRules.optionalString('consumerKey', 255),
      commonRules.optionalString('consumerSecret', 255),
      body('useQueryAuth').optional().isBoolean(),
    ],
    validateRequest,
    (req, res) => controller.testConnection(req, res)
  );

  // ---- Batch export ----
  router.post('/products/export',
    gate,
    csrfProtection,
    [
      commonRules.array('products', 500),
      body('instanceIds').optional().isArray(),
      body('instanceIds.*').optional().isString().trim(),
    ],
    validateRequest,
    (req, res) => controller.exportProducts(req, res)
  );

  // ---- IMPORT (read-only) by SKU ----
  router.get('/products/import',
    gate,
    [
      query('sku').trim().notEmpty().withMessage('sku is required'),
    ],
    validateRequest,
    (req, res) => controller.importProductBySku(req, res)
  );

  // ---- Categories (read-only) ----
  // GET /api/woocommerce-products/categories?perPage=100&search=...
  router.get('/categories', gate, (req, res) => controller.getCategories(req, res));

  // ---- Batch delete (Woo) ----
  // DELETE /api/woocommerce-products/batch
  router.delete('/batch',
    gate,
    csrfProtection,
    [
      body('productIds').optional().isArray(),
      body('productIds.*').optional().isString().trim(),
      body('externalIds').optional().isArray(),
      body('skus').optional().isArray(),
      body('instanceIds').optional().isArray(),
      body('instanceIds.*').optional().isString().trim(),
    ],
    validateRequest,
    (req, res) => controller.batchDelete(req, res)
  );

  // ---- Orders pull (MVP: session-auth pull -> normalized ingest) ----
  // POST /api/woocommerce-products/orders/pull
  router.post(
    '/orders/pull',
    gate,
    csrfProtection,
    [
      body('after').optional().isISO8601().withMessage('after must be ISO 8601'),
      body('perPage').optional().isInt({ min: 1, max: 100 }).withMessage('perPage must be 1-100'),
    ],
    validateRequest,
    (req, res) => controller.pullOrders(req, res),
  );

  // ---- Template parity CRUD (optional) ----
  return router;
}

module.exports = createWooCommerceRoutes;
