// plugins/channels/routes.js
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createChannelsRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('channels'); // auth/enablement guard

  // Read-only summaries
  router.get('/', gate, (req, res) => controller.getAll(req, res));

  // List channel/instance targets for a product (for sync-on-save)
  router.get(
    '/product-targets',
    gate,
    [query('productId').trim().notEmpty().withMessage('productId is required')],
    validateRequest,
    (req, res) => controller.getProductTargets(req, res),
  );

  // Read single product↔channel mapping
  router.get('/map',
    gate,
    [
      query('productId').trim().notEmpty().withMessage('productId is required'),
      query('channel').trim().notEmpty().withMessage('channel is required'),
    ],
    validateRequest,
    (req, res) => controller.getProductMap(req, res)
  );

  // Per-product enable/disable (safe SELECT→INSERT/UPDATE)
  // Body: { productId: string, channel: string, enabled: boolean, channelInstanceId?: number }
  router.put('/map',
    gate,
    csrfProtection,
    [
      commonRules.string('productId', 1, 255),
      commonRules.string('channel', 1, 255),
      body('enabled').isBoolean().withMessage('enabled must be a boolean'),
      body('channelInstanceId').optional().isInt({ min: 1 }).withMessage('channelInstanceId must be a positive integer'),
    ],
    validateRequest,
    (req, res) => controller.setProductEnabled(req, res)
  );

  // Recent error logs for a channel
  router.get(
    '/errors',
    gate,
    [
      query('channel').trim().notEmpty().withMessage('channel is required'),
      query('limit').optional().isInt({ min: 1, max: 200 }).withMessage('limit must be 1-200'),
    ],
    validateRequest,
    (req, res) => controller.getErrors(req, res),
  );

  // ---- Channel instances (Selloklon) ----
  router.get(
    '/instances',
    gate,
    [
      query('channel').optional().trim().isLength({ min: 1, max: 255 }).withMessage('channel is too long'),
      query('includeDisabled').optional().isIn(['true', 'false', '1', '0']).withMessage('includeDisabled must be true/false/1/0'),
    ],
    validateRequest,
    (req, res) => controller.listInstances(req, res),
  );

  router.post(
    '/instances',
    gate,
    csrfProtection,
    [
      commonRules.string('channel', 1, 255),
      commonRules.string('instanceKey', 1, 50),
      commonRules.optionalString('market', 10),
      commonRules.optionalString('label', 500),
      body('credentials').optional().isObject().withMessage('credentials must be an object'),
    ],
    validateRequest,
    (req, res) => controller.upsertInstance(req, res),
  );

  router.put(
    '/instances/:id',
    gate,
    csrfProtection,
    [
      commonRules.id('id'),
      commonRules.optionalString('market', 10),
      commonRules.optionalString('label', 500),
      body('credentials').optional().isObject().withMessage('credentials must be an object'),
      body('enabled').optional().isBoolean().withMessage('enabled must be a boolean'),
    ],
    validateRequest,
    (req, res) => controller.updateInstance(req, res),
  );

  // ---- Per-product overrides ----
  router.get(
    '/overrides',
    gate,
    [
      query('productId').trim().notEmpty().withMessage('productId is required'),
      query('channel').optional().trim().isLength({ min: 1, max: 255 }).withMessage('channel is too long'),
    ],
    validateRequest,
    (req, res) => controller.listOverrides(req, res),
  );

  router.put(
    '/overrides',
    gate,
    csrfProtection,
    [
      commonRules.string('productId', 1, 255),
      body('channelInstanceId').isInt({ min: 1 }).withMessage('channelInstanceId is required'),
      body('active').optional().isBoolean(),
      body('priceAmount').optional().isNumeric(),
      commonRules.optionalString('currency', 10),
      body('vatRate').optional().isNumeric(),
      body('category').optional().isString(),
    ],
    validateRequest,
    (req, res) => controller.upsertOverride(req, res),
  );

  // ---- Import template (CSV) ----
  router.get('/template', gate, (req, res) => controller.getImportTemplate(req, res));

  return router;
}

module.exports = createChannelsRoutes;
