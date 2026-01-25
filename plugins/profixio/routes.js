// plugins/profixio/routes.js
const express = require('express');
const { body, param, query } = require('express-validator');
const router = express.Router();
const config = require('./plugin.config');

function createProfixioRoutes(controller, requirePlugin, csrfProtection, validateRequest) {
  const gate = requirePlugin(config.name);

  // Debug: Check if controller and methods exist
  if (!controller) {
    console.error('Profixio: controller is undefined');
    return router;
  }
  if (typeof controller.getSettings !== 'function') {
    console.error('Profixio: controller.getSettings is not a function', {
      controllerType: typeof controller,
      controllerKeys: controller ? Object.keys(controller) : [],
      hasGetSettings: controller ? 'getSettings' in controller : false,
    });
  }

  // GET /api/profixio/matches
  router.get(
    '/matches',
    gate,
    [
      query('seasonId').optional().isInt().withMessage('seasonId must be an integer'),
      query('tournamentId').optional().isInt().withMessage('tournamentId must be an integer'),
      query('teamFilter').optional().trim().isLength({ max: 255 }),
      query('fromDate').optional().isISO8601().withMessage('fromDate must be a valid date'),
      query('toDate').optional().isISO8601().withMessage('toDate must be a valid date'),
      query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
      query('limit')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('limit must be between 1 and 500'),
      validateRequest,
    ],
    (req, res, next) => controller.getMatches(req, res, next),
  );

  // GET /api/profixio/matches/:tournamentId/:matchId
  router.get(
    '/matches/:tournamentId/:matchId',
    gate,
    [
      param('tournamentId').isInt().withMessage('tournamentId must be an integer'),
      param('matchId').isInt().withMessage('matchId must be an integer'),
      validateRequest,
    ],
    (req, res, next) => controller.getMatch(req, res, next),
  );

  // GET /api/profixio/seasons
  router.get(
    '/seasons',
    gate,
    [
      query('organisationId').notEmpty().withMessage('organisationId is required'),
      query('sportId').optional().trim().isLength({ min: 2, max: 10 }),
      validateRequest,
    ],
    (req, res, next) => controller.getSeasons(req, res, next),
  );

  // GET /api/profixio/tournaments
  router.get(
    '/tournaments',
    gate,
    [
      query('seasonId')
        .notEmpty()
        .isInt()
        .withMessage('seasonId is required and must be an integer'),
      query('categoryId').optional().isInt().withMessage('categoryId must be an integer'),
      query('sportId').optional().trim().isLength({ min: 2, max: 10 }),
      validateRequest,
    ],
    (req, res, next) => controller.getTournaments(req, res, next),
  );

  // GET /api/profixio/settings
  router.get('/settings', gate, (req, res, next) => {
    if (controller && typeof controller.getSettings === 'function') {
      return controller.getSettings(req, res, next);
    } else {
      return res.status(500).json({ error: 'Profixio settings endpoint not available' });
    }
  });

  // PUT /api/profixio/settings
  router.put(
    '/settings',
    gate,
    csrfProtection,
    [
      body('settings').isObject().withMessage('Settings must be an object'),
      body('settings.apiKey').optional().trim().isLength({ min: 1, max: 500 }),
      body('settings.defaultTeamFilter').optional().trim().isLength({ max: 255 }),
      body('settings.defaultSeasonId')
        .optional()
        .isInt()
        .withMessage('defaultSeasonId must be an integer'),
      body('settings.defaultTournamentId')
        .optional()
        .isInt()
        .withMessage('defaultTournamentId must be an integer'),
      validateRequest,
    ],
    (req, res, next) => controller.updateSettings(req, res, next),
  );

  return router;
}

module.exports = createProfixioRoutes;
