// plugins/sportadmin/routes.js
const express = require('express');
const { body, query } = require('express-validator');

const { validatePublicHttpsUrl } = require('../../server/core/utils/ssrfUrlGuard');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { validationResult } = require('../../server/core/middleware/validation');
const config = require('./plugin.config');

/** Prefer first field message over generic "Validation failed". */
function validateSportadminRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const details = errors.array();
    const firstMsg = details[0]?.msg || 'Validation failed';
    const isHost = typeof firstMsg === 'string' && /allowed SportAdmin host/i.test(firstMsg);
    return res.status(400).json({
      error: firstMsg,
      code: isHost ? 'HOST_NOT_ALLOWED' : 'VALIDATION_ERROR',
      details,
    });
  }
  next();
}

function createSportadminRoutes(controller, context) {
  const router = express.Router();
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/', gate, (req, res) => controller.getStatus(req, res));

  router.post(
    '/config',
    gate,
    csrfProtection,
    body('siteUrl')
      .trim()
      .isLength({ min: 8, max: 2000 })
      .withMessage('siteUrl must be between 8 and 2000 characters')
      .custom((value) => {
        // Public HTTPS only here. Custom club domains are allowed as siteHost during
        // sync; controller requires SportAdmin detection before keeping them.
        const check = validatePublicHttpsUrl(value);
        if (!check.ok) {
          throw new Error(check.error);
        }
        return true;
      }),
    validateSportadminRequest,
    (req, res) => controller.saveConfig(req, res),
  );

  router.post(
    '/cron-settings',
    gate,
    csrfProtection,
    body('cronEnabled').isBoolean().withMessage('cronEnabled must be a boolean'),
    validateSportadminRequest,
    (req, res) => controller.saveCronSettings(req, res),
  );

  router.post('/sync', gate, csrfProtection, (req, res) => controller.syncNow(req, res));

  router.get('/errors', gate, (req, res) => controller.getErrors(req, res));
  router.get('/discovery', gate, (req, res) => controller.getDiscovery(req, res));

  router.get('/organization', gate, (req, res) => controller.listType(req, res, 'organization'));
  router.get('/pages', gate, (req, res) => controller.listType(req, res, 'page'));
  router.get('/teams', gate, (req, res) => controller.listType(req, res, 'team'));
  router.get(
    '/news',
    gate,
    query('limit').optional().isInt({ min: 1, max: 50 }),
    validateSportadminRequest,
    (req, res) => controller.listType(req, res, 'news'),
  );
  router.get(
    '/matches',
    gate,
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('upcoming').optional().isIn(['true', 'false']),
    query('team').optional().isLength({ max: 120 }),
    query('category').optional().isLength({ max: 120 }),
    validateSportadminRequest,
    (req, res) => controller.listType(req, res, 'match'),
  );
  router.get(
    '/events',
    gate,
    query('limit').optional().isInt({ min: 1, max: 200 }),
    validateSportadminRequest,
    (req, res) => controller.listType(req, res, 'event'),
  );
  router.get('/links', gate, (req, res) => controller.listType(req, res, 'link'));

  return router;
}

module.exports = createSportadminRoutes;
