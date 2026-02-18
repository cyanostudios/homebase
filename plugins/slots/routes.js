// plugins/kiosk/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createKioskRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.post(
    '/',
    gate,
    commonRules.optionalString('location', 255),
    commonRules.requiredDate('slot_time'),
    commonRules.optionalInteger('capacity', 1, 5),
    commonRules.optionalInteger('contact_id', 1, Number.MAX_SAFE_INTEGER),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
    commonRules.id('id'),
    commonRules.optionalString('location', 255),
    commonRules.requiredDate('slot_time'),
    commonRules.optionalInteger('capacity', 1, 5),
    commonRules.optionalInteger('contact_id', 1, Number.MAX_SAFE_INTEGER),
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

  return router;
}

module.exports = createKioskRoutes;
