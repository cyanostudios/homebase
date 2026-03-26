// templates/plugin-backend-template/routes.js
const express = require('express');
const { body, param } = require('express-validator');
const config = require('./plugin.config');

function createTemplateRoutes(controller, requirePlugin, csrfProtection, validateRequest) {
  const router = express.Router();
  const gate = requirePlugin(config.name); // auth/enablement guard for this plugin

  router.get('/', gate, (req, res, next) => controller.getAll(req, res, next));
  router.get('/settings', gate, (req, res) => {
    res.json({ defaultView: 'list', allowDuplicate: true });
  });

  router.post(
    '/',
    gate,
    csrfProtection,
    [
      body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
      body('description').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
      validateRequest,
    ],
    (req, res, next) => controller.create(req, res, next),
  );

  router.put(
    '/:id',
    gate,
    csrfProtection,
    [
      param('id').isString().notEmpty().withMessage('Invalid ID'),
      body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 255 }),
      body('description').optional({ values: 'falsy' }).isString().isLength({ max: 5000 }),
      validateRequest,
    ],
    (req, res, next) => controller.update(req, res, next),
  );

  router.delete(
    '/:id',
    gate,
    csrfProtection,
    [param('id').isString().notEmpty().withMessage('Invalid ID'), validateRequest],
    (req, res, next) => controller.delete(req, res, next),
  );

  router.put(
    '/settings',
    gate,
    csrfProtection,
    [
      body('defaultView').isIn(['list', 'grid']),
      body('allowDuplicate').isBoolean(),
      validateRequest,
    ],
    (req, res) => res.json(req.body),
  );

  return router;
}

module.exports = createTemplateRoutes;
