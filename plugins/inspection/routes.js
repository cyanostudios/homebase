// plugins/inspection/routes.js
const express = require('express');
const { body } = require('express-validator');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');
const controller = require('./controller');
const config = require('./plugin.config');

function createInspectionRoutes(context) {
  const router = express.Router();
  const requirePlugin = context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  router.get('/projects', gate, (req, res) => controller.getAll(req, res));
  router.post(
    '/projects',
    gate,
    [
      commonRules.optionalString('name', 255),
      commonRules.optionalString('description', 10000),
      commonRules.optionalString('adminNotes', 10000),
    ],
    validateRequest,
    (req, res) => controller.create(req, res)
  );
  router.get('/projects/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getById(req, res)
  );
  router.put(
    '/projects/:id',
    gate,
    commonRules.id('id'),
    [
      commonRules.optionalString('name', 255),
      commonRules.optionalString('description', 10000),
      commonRules.optionalString('adminNotes', 10000),
    ],
    validateRequest,
    (req, res) => controller.update(req, res)
  );
  router.delete('/projects/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res)
  );

  router.post(
    '/projects/:id/files',
    gate,
    commonRules.id('id'),
    [body('fileIds').isArray().withMessage('fileIds must be an array')],
    validateRequest,
    (req, res) => controller.addFiles(req, res)
  );
  router.delete(
    '/projects/:id/files/:fileId',
    gate,
    commonRules.id('id'),
    [commonRules.id('fileId')],
    validateRequest,
    (req, res) => controller.removeFile(req, res)
  );

  router.post(
    '/projects/:id/send',
    gate,
    commonRules.id('id'),
    [
      body('recipients').isArray().notEmpty().withMessage('recipients array is required'),
      body('includeDescription').optional().isBoolean(),
      body('includeAdminNotes').optional().isBoolean(),
      body('fileIds').optional().isArray(),
    ],
    validateRequest,
    (req, res) => controller.send(req, res)
  );

  return router;
}

module.exports = createInspectionRoutes;
