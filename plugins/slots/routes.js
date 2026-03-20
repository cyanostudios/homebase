// plugins/slots/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createSlotsRoutes(controller, context) {
  const requirePlugin = context?.middleware?.requirePlugin || (() => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.post(
    '/',
    gate,
    commonRules.optionalString('name', 255),
    commonRules.optionalString('location', 255),
    commonRules.requiredDate('slot_time'),
    commonRules.optionalDate('slot_end'),
    commonRules.optionalString('address', 500),
    commonRules.optionalString('category', 100),
    commonRules.optionalInteger('capacity', 1, 5),
    commonRules.optionalInteger('contact_id', 1, Number.MAX_SAFE_INTEGER),
    commonRules.optionalString('description', 5000),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.post(
    '/batch',
    gate,
    (req, res, next) => {
      if (!req.body || !Array.isArray(req.body.slots)) {
        return res.status(400).json({
          error: 'Request body must contain a slots array',
          code: 'VALIDATION_ERROR',
        });
      }
      if (req.body.slots.length > 50) {
        return res.status(400).json({
          error: 'Too many slots (max 50 per request)',
          code: 'VALIDATION_ERROR',
        });
      }
      next();
    },
    (req, res) => controller.batchCreate(req, res),
  );

  router.put(
    '/:id',
    gate,
    commonRules.id('id'),
    commonRules.optionalString('name', 255),
    commonRules.optionalString('location', 255),
    commonRules.requiredDate('slot_time'),
    commonRules.optionalDate('slot_end'),
    commonRules.optionalString('address', 500),
    commonRules.optionalString('category', 100),
    commonRules.optionalInteger('capacity', 1, 5),
    commonRules.optionalInteger('contact_id', 1, Number.MAX_SAFE_INTEGER),
    commonRules.optionalString('description', 5000),
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  router.delete(
    '/batch',
    gate,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.delete('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  router.get('/:id/bookings', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getBookings(req, res),
  );

  router.delete(
    '/bookings/:bookingId',
    gate,
    commonRules.id('bookingId'),
    validateRequest,
    (req, res) => controller.deleteBooking(req, res),
  );

  return router;
}

module.exports = createSlotsRoutes;
