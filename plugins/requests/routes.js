// plugins/requests/routes.js
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

// request_type is user-configurable via settings; validate as a plain string instead of enum
const REQUEST_STATUSES = ['not started', 'in progress', 'completed', 'cancelled'];
const REQUEST_PRIORITIES = ['Low', 'Medium', 'High'];

function createRequestRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  // Public routes — no auth, no gate, uses publicRequestsPool
  router.get('/public/teams', (req, res) => controller.publicGetTeams(req, res));
  router.post('/public/submit', (req, res) => controller.publicSubmit(req, res));

  // Authenticated routes
  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getById(req, res),
  );

  router.post(
    '/',
    gate,
    csrfProtection,
    commonRules.plainString('title', 1, 500),
    commonRules.htmlContent('description', 10000),
    commonRules.optionalString('request_type', 100),
    commonRules.optionalEnum('status', REQUEST_STATUSES),
    commonRules.optionalEnum('priority', REQUEST_PRIORITIES),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    commonRules.id('id'),
    commonRules.plainString('title', 1, 500),
    commonRules.htmlContent('description', 10000),
    commonRules.optionalString('request_type', 100),
    commonRules.optionalEnum('status', REQUEST_STATUSES),
    commonRules.optionalEnum('priority', REQUEST_PRIORITIES),
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

module.exports = createRequestRoutes;
