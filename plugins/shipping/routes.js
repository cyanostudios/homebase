const express = require('express');
const { body, param } = require('express-validator');

const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createShippingRoutes(controller, context) {
  const router = express.Router();
  const requirePlugin = context?.middleware?.requirePlugin || (() => (_req, _res, next) => next());
  const gate = requirePlugin('shipping');

  router.get('/settings', gate, validateRequest, (req, res) => controller.getSettings(req, res));
  router.put(
    '/settings',
    gate,
    csrfProtection,
    [
      body('bookingUrl').optional().trim().isLength({ max: 2000 }),
      body('authScheme').optional().trim().isLength({ max: 64 }),
      body('integrationId').optional().trim().isLength({ max: 500 }),
      body('apiKey').optional().trim().isLength({ max: 1000 }),
      body('apiSecret').optional().trim().isLength({ max: 1000 }),
      body('apiKeyHeaderName').optional().trim().isLength({ max: 200 }),
      body('labelFormat').optional().isIn(['PDF', 'ZPL', 'BOTH']),
    ],
    validateRequest,
    (req, res) => controller.upsertSettings(req, res),
  );

  router.get('/senders', gate, validateRequest, (req, res) => controller.listSenders(req, res));
  router.get(
    '/senders/:id',
    gate,
    [param('id').isInt({ min: 1 })],
    validateRequest,
    (req, res) => controller.getSenderById(req, res),
  );
  router.post(
    '/senders',
    gate,
    csrfProtection,
    [
      commonRules.string('name', 1, 255),
      body('street').optional().trim().isLength({ max: 255 }),
      body('postalCode').optional().trim().isLength({ max: 50 }),
      body('city').optional().trim().isLength({ max: 255 }),
      body('country').optional().trim().isLength({ max: 2 }),
      body('contactName').optional().trim().isLength({ max: 255 }),
      body('contactPhone').optional().trim().isLength({ max: 100 }),
    ],
    validateRequest,
    (req, res) => controller.createSender(req, res),
  );
  router.put(
    '/senders/:id',
    gate,
    csrfProtection,
    [
      param('id').isInt({ min: 1 }),
      commonRules.string('name', 1, 255),
      body('street').optional().trim().isLength({ max: 255 }),
      body('postalCode').optional().trim().isLength({ max: 50 }),
      body('city').optional().trim().isLength({ max: 255 }),
      body('country').optional().trim().isLength({ max: 2 }),
      body('contactName').optional().trim().isLength({ max: 255 }),
      body('contactPhone').optional().trim().isLength({ max: 100 }),
    ],
    validateRequest,
    (req, res) => controller.updateSender(req, res),
  );
  router.delete(
    '/senders/:id',
    gate,
    csrfProtection,
    [param('id').isInt({ min: 1 })],
    validateRequest,
    (req, res) => controller.deleteSender(req, res),
  );

  router.get('/services', gate, validateRequest, (req, res) => controller.listServices(req, res));
  router.post(
    '/services',
    gate,
    csrfProtection,
    [commonRules.string('code', 1, 100), commonRules.string('name', 1, 255)],
    validateRequest,
    (req, res) => controller.createService(req, res),
  );
  router.put(
    '/services/:id',
    gate,
    csrfProtection,
    [
      param('id').isInt({ min: 1 }),
      commonRules.string('code', 1, 100),
      commonRules.string('name', 1, 255),
    ],
    validateRequest,
    (req, res) => controller.updateService(req, res),
  );
  router.delete(
    '/services/:id',
    gate,
    csrfProtection,
    [param('id').isInt({ min: 1 })],
    validateRequest,
    (req, res) => controller.deleteService(req, res),
  );

  router.get('/postnord/services', gate, validateRequest, (req, res) =>
    controller.getPostnordServices(req, res),
  );
  router.post(
    '/postnord/book',
    gate,
    csrfProtection,
    [
      ...commonRules.requiredArray('orderIds', 500),
      body('senderId').trim().notEmpty(),
      body('serviceId').trim().notEmpty(),
      body('labelFormat').optional().isIn(['PDF', 'ZPL', 'BOTH']),
      body('weightsKgByOrder').optional().isObject(),
    ],
    validateRequest,
    (req, res) => controller.bookPostnord(req, res),
  );

  return router;
}

module.exports = createShippingRoutes;
