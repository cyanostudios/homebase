// templates/plugin-backend-template/routes.js
const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const config = require('./plugin.config');

function createTemplateRoutes(controller, requirePlugin, csrfProtection, validateRequest) {
  const gate = requirePlugin(config.name); // auth/enablement guard for this plugin

  // GET /api/<name>
  router.get('/', gate, (req, res, next) => controller.getAll(req, res, next));

  // POST /api/<name>
  // TODO: Add validation rules for your schema
  router.post(
    '/',
    gate,
    csrfProtection,
    [
      // TODO: Add your validation rules here
      // body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
      // body('status').optional().isIn(['draft', 'active', 'archived']),
      validateRequest,
    ],
    (req, res, next) => controller.create(req, res, next),
  );

  // PUT /api/<name>/:id
  // TODO: Add validation rules for your schema
  router.put(
    '/:id',
    gate,
    csrfProtection,
    [
      param('id').isInt().withMessage('Invalid ID'),
      // TODO: Add your validation rules here
      // body('title').optional().trim().isLength({ max: 255 }),
      // body('status').optional().isIn(['draft', 'active', 'archived']),
      validateRequest,
    ],
    (req, res, next) => controller.update(req, res, next),
  );

  // DELETE /api/<name>/:id
  router.delete(
    '/:id',
    gate,
    csrfProtection,
    [param('id').isInt().withMessage('Invalid ID'), validateRequest],
    (req, res, next) => controller.delete(req, res, next),
  );

  return router;
}

module.exports = createTemplateRoutes;
