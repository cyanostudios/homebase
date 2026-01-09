// plugins/tasks/routes.js
// Tasks routes with V2 security (CSRF protection and input validation)
const express = require('express');
const router = express.Router();
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createTaskRoutes(controller, requirePlugin) {
  // GET /api/tasks
  router.get('/', requirePlugin('tasks'), (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/tasks - Create new task
  router.post('/',
    requirePlugin('tasks'),
    csrfProtection,
    commonRules.string('title', 1, 255),
    commonRules.optionalString('content', 10000),
    commonRules.array('mentions', 50),
    commonRules.enum('status', ['not started', 'in progress', 'completed', 'cancelled']).optional(),
    commonRules.enum('priority', ['Low', 'Medium', 'High']).optional(),
    commonRules.date('due_date').optional(),
    validateRequest,
    (req, res) => {
      controller.create(req, res);
    }
  );

  // PUT /api/tasks/:id - Update task
  router.put('/:id',
    requirePlugin('tasks'),
    csrfProtection,
    commonRules.id('id'),
    commonRules.string('title', 1, 255),
    commonRules.optionalString('content', 10000),
    commonRules.array('mentions', 50),
    commonRules.enum('status', ['not started', 'in progress', 'completed', 'cancelled']).optional(),
    commonRules.enum('priority', ['Low', 'Medium', 'High']).optional(),
    commonRules.date('due_date').optional(),
    validateRequest,
    (req, res) => {
      controller.update(req, res);
    }
  );

  // DELETE /api/tasks/:id - Delete task
  router.delete('/:id',
    requirePlugin('tasks'),
    csrfProtection,
    commonRules.id('id'),
    validateRequest,
    (req, res) => {
      controller.delete(req, res);
    }
  );

  return router;
}

module.exports = createTaskRoutes;
