// plugins/orders/routes.js
// Orders routes with auth, CSRF, and validation.

const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');

const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createOrdersRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('orders');

  // GET /api/orders?status=&channel=&from=&to=&limit=&offset=
  router.get(
    '/',
    gate,
    [
      query('status').optional().trim().isLength({ max: 50 }),
      query('channel').optional().trim().isLength({ max: 50 }),
      query('from').optional().isISO8601(),
      query('to').optional().isISO8601(),
      query('limit').optional().isInt({ min: 1, max: 200 }),
      query('offset').optional().isInt({ min: 0, max: 100000 }),
    ],
    validateRequest,
    (req, res) => controller.list(req, res),
  );

  // DELETE /api/orders (delete all orders for current user) - must be before /:id route
  router.delete('/', gate, csrfProtection, validateRequest, (req, res) =>
    controller.deleteAll(req, res),
  );

  // POST /api/orders/sync - Trigger quick-sync (background). Returns { started, reason? }.
  router.post('/sync', gate, csrfProtection, validateRequest, (req, res) =>
    controller.quickSync(req, res),
  );

  // GET /api/orders/sync/status - Whether any sync is running for current user (for UI spinner).
  router.get('/sync/status', gate, validateRequest, (req, res) => controller.syncStatus(req, res));

  // POST /api/orders/renumber - Renumber order_number by placed_at (oldest = 1) across all channels
  router.post('/renumber', gate, csrfProtection, validateRequest, (req, res) =>
    controller.renumber(req, res),
  );

  // DELETE /api/orders/batch - Delete selected orders (body: { ids: string[] })
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    [commonRules.array('ids', 500)],
    validateRequest,
    (req, res) => controller.deleteByIds(req, res),
  );

  // PUT /api/orders/batch/status - Batch update status (must be before /:id route)
  router.put(
    '/batch/status',
    gate,
    csrfProtection,
    [
      commonRules.array('ids', 500),
      body('status')
        .trim()
        .isIn(['processing', 'shipped', 'delivered', 'cancelled'])
        .withMessage('status must be one of: processing, shipped, delivered, cancelled'),
      commonRules.optionalString('carrier', 255),
      commonRules.optionalString('trackingNumber', 255),
      body('forceUpdate').optional().isBoolean().withMessage('forceUpdate must be a boolean'),
    ],
    validateRequest,
    (req, res) => controller.batchUpdateStatus(req, res),
  );

  // POST /api/orders/plocklista/pdf - Export pick list PDF for selected orders (body: { ids: string[] })
  router.post(
    '/plocklista/pdf',
    gate,
    csrfProtection,
    [commonRules.array('ids', 200)],
    validateRequest,
    (req, res) => controller.generatePlocklistaPdf(req, res),
  );

  // GET /api/orders/:id
  router.get('/:id', gate, [commonRules.id('id')], validateRequest, (req, res) =>
    controller.getById(req, res),
  );

  // PUT /api/orders/:id/status
  router.put(
    '/:id/status',
    gate,
    csrfProtection,
    [
      commonRules.id('id'),
      body('status')
        .trim()
        .isIn(['processing', 'shipped', 'delivered', 'cancelled'])
        .withMessage('status must be one of: processing, shipped, delivered, cancelled'),
      commonRules.optionalString('carrier', 255),
      commonRules.optionalString('trackingNumber', 255),
      body('forceUpdate').optional().isBoolean().withMessage('forceUpdate must be a boolean'),
    ],
    validateRequest,
    (req, res) => controller.updateStatus(req, res),
  );

  // POST /api/orders/ingest (internal normalized ingest)
  router.post(
    '/ingest',
    gate,
    csrfProtection,
    [
      commonRules.string('channel', 1, 50),
      commonRules.string('channelOrderId', 1, 255),
      commonRules.optionalString('platformOrderNumber', 100),
      body('placedAt')
        .optional({ values: 'falsy' })
        .isISO8601()
        .withMessage('placedAt must be ISO 8601'),
      body('totalAmount').optional({ values: 'falsy' }).isFloat({ min: 0, max: 99999999 }),
      commonRules.optionalString('currency', 10),
      commonRules.optionalString('status', 50),
      commonRules.array('items', 1000),
    ],
    validateRequest,
    (req, res) => controller.ingest(req, res),
  );

  return router;
}

module.exports = createOrdersRoutes;
