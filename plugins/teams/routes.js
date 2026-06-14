// plugins/teams/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

const TEAM_STATUSES = ['active', 'dormant', 'break'];
const TEAM_GENDERS = ['boys', 'girls', 'mixed'];
const TEAM_COLORS = ['green', 'blue', 'red', 'purple', 'orange', 'teal', 'white'];

function createTeamRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getById(req, res),
  );

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.plainString('name', 1, 255),
    commonRules.htmlContent('age_group', 50),
    commonRules.optionalEnum('gender', TEAM_GENDERS),
    commonRules.optionalInteger('player_count', 0, 9999),
    commonRules.optionalInteger('series_team_count', 0, 999),
    commonRules.optionalEnum('status', TEAM_STATUSES),
    commonRules.htmlContent('status_note', 20000),
    commonRules.optionalEnum('color', TEAM_COLORS),
    commonRules.optionalString('external_team_id', 100),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('name', 1, 255),
    commonRules.htmlContent('age_group', 50),
    commonRules.optionalEnum('gender', TEAM_GENDERS),
    commonRules.optionalInteger('player_count', 0, 9999),
    commonRules.optionalInteger('series_team_count', 0, 999),
    commonRules.optionalEnum('status', TEAM_STATUSES),
    commonRules.htmlContent('status_note', 20000),
    commonRules.optionalEnum('color', TEAM_COLORS),
    commonRules.optionalString('external_team_id', 100),
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  router.delete(
    '/batch',
    gate,
    csrfProtection,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.delete('/:id', gate, csrfProtection, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  return router;
}

module.exports = createTeamRoutes;
