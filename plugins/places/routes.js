const express = require('express');
const { query, param } = require('express-validator');
const { validateRequest } = require('../../server/core/middleware/validation');
const config = require('./plugin.config');

function createPlacesRoutes(controller, context) {
  const router = express.Router();
  const requirePlugin =
    context?.middleware?.requirePlugin || ((_name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get(
    '/search',
    gate,
    query('q').isString().trim().isLength({ min: 2, max: 200 }),
    query('limit').optional().isInt({ min: 1, max: 10 }),
    query('language').optional().isString().isLength({ max: 35 }),
    validateRequest,
    (req, res) => controller.search(req, res),
  );

  router.get(
    '/:providerRef',
    gate,
    param('providerRef').isString().trim().isLength({ min: 1, max: 255 }),
    query('language').optional().isString().isLength({ max: 35 }),
    validateRequest,
    (req, res) => controller.getByRef(req, res),
  );

  return router;
}

module.exports = createPlacesRoutes;
