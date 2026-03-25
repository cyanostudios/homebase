// plugins/matches/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

const MATCH_FORMATS = ['3vs3', '5vs5', '6vs6', '7vs7', '8vs8', '9vs9', '11vs11'];

function createMatchRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.post(
    '/',
    gate,
    commonRules.optionalString('name', 255),
    commonRules.optionalInteger('match_number', 1, 999999),
    commonRules.optionalEnum('match_type', ['series', 'cup', 'friendly']),
    commonRules.optionalInteger('referee_count', 0, 99),
    commonRules.optionalUrl('map_link', 500),
    commonRules.string('home_team', 1, 255),
    commonRules.string('away_team', 1, 255),
    commonRules.optionalString('location', 255),
    commonRules.requiredDate('start_time'),
    commonRules.enum('sport_type', ['football', 'handball']).optional(),
    commonRules.optionalEnum('format', MATCH_FORMATS),
    commonRules.optionalInteger('total_minutes', 1, 999),
    commonRules.optionalInteger('contact_id', 1, Number.MAX_SAFE_INTEGER),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
    commonRules.id('id'),
    commonRules.optionalString('name', 255),
    commonRules.optionalInteger('match_number', 1, 999999),
    commonRules.optionalEnum('match_type', ['series', 'cup', 'friendly']),
    commonRules.optionalInteger('referee_count', 0, 99),
    commonRules.optionalUrl('map_link', 500),
    commonRules.string('home_team', 1, 255),
    commonRules.string('away_team', 1, 255),
    commonRules.optionalString('location', 255),
    commonRules.requiredDate('start_time'),
    commonRules.enum('sport_type', ['football', 'handball']).optional(),
    commonRules.optionalEnum('format', MATCH_FORMATS),
    commonRules.optionalInteger('total_minutes', 1, 999),
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

module.exports = createMatchRoutes;
