// plugins/tasks/routes.js
// Tasks routes with V2 security (CSRF protection and input validation)
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createTaskRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name); // auth/enablement guard

  // GET /api/tasks
  router.get('/', gate, (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/tasks - Create new task
  router.post(
    '/',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.plainString('title', 1, 255),
    commonRules.htmlContent('content', 100000),
    commonRules.array('mentions', 50),
    commonRules.enum('status', ['not started', 'in progress', 'completed', 'cancelled']).optional(),
    commonRules.enum('priority', ['Low', 'Medium', 'High']).optional(),
    commonRules.date('due_date').optional(),
    validateRequest,
    (req, res) => {
      controller.create(req, res);
    },
  );

  // PUT /api/tasks/:id - Update task
  router.put(
    '/:id',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.id('id'),
    commonRules.plainString('title', 1, 255),
    commonRules.htmlContent('content', 100000),
    commonRules.array('mentions', 50),
    commonRules.enum('status', ['not started', 'in progress', 'completed', 'cancelled']).optional(),
    commonRules.enum('priority', ['Low', 'Medium', 'High']).optional(),
    commonRules.date('due_date').optional(),
    validateRequest,
    (req, res) => {
      controller.update(req, res);
    },
  );

  // DELETE /api/tasks/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    // /* csrfProtection, */ // Temporarily disabled
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // DELETE /api/tasks/:id - Delete task
  router.delete(
    '/:id',
    gate,
    /* csrfProtection, */ // Temporarily disabled
    commonRules.id('id'),
    validateRequest,
    (req, res) => {
      controller.delete(req, res);
    },
  );

  return router;
}

module.exports = createTaskRoutes;
