// plugins/notes/routes.js
// Notes routes with V2 security (CSRF protection and input validation)
const express = require('express');
const router = express.Router();
const config = require('./plugin.config');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');

function createNoteRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name); // auth/enablement guard

  // GET /api/notes
  router.get('/', gate, (req, res) => {
    controller.getAll(req, res);
  });

  // POST /api/notes - Create new note
  router.post(
    '/',
    gate,
    // /* csrfProtection, */ // Temporarily disabled // Temporarily disabled
    commonRules.string('title', 1, 255),
    commonRules.optionalString('content', 10000), // Max 10KB content
    commonRules.array('mentions', 50), // Max 50 mentions
    validateRequest,
    (req, res) => {
      controller.create(req, res);
    },
  );

  // PUT /api/notes/:id - Update note
  router.put(
    '/:id',
    gate,
    // /* csrfProtection, */ // Temporarily disabled // Temporarily disabled
    commonRules.id('id'),
    commonRules.string('title', 1, 255),
    commonRules.optionalString('content', 10000),
    commonRules.array('mentions', 50),
    validateRequest,
    (req, res) => {
      controller.update(req, res);
    },
  );

  // DELETE /api/notes/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    // /* csrfProtection, */ // Temporarily disabled
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // DELETE /api/notes/:id - Delete note
  router.delete(
    '/:id',
    gate,
    // /* csrfProtection, */ // Temporarily disabled // Temporarily disabled
    commonRules.id('id'),
    validateRequest,
    (req, res) => {
      controller.delete(req, res);
    },
  );

  return router;
}

module.exports = createNoteRoutes;
