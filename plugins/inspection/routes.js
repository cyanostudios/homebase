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
  router.post(
    '/projects/batch-delete',
    gate,
    [body('ids').isArray().withMessage('ids must be an array')],
    validateRequest,
    (req, res) => controller.bulkDeleteInspectionProjects(req, res)
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
  router.put(
    '/projects/:id/files',
    gate,
    commonRules.id('id'),
    [body('fileIds').isArray().withMessage('fileIds must be an array')],
    validateRequest,
    (req, res) => controller.setFiles(req, res)
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
    '/projects/:id/file-lists',
    gate,
    commonRules.id('id'),
    [body('listId').notEmpty().withMessage('listId is required')],
    validateRequest,
    (req, res) => controller.addFileList(req, res)
  );
  router.delete(
    '/projects/:id/file-lists/:fileListId',
    gate,
    commonRules.id('id'),
    [commonRules.id('fileListId')],
    validateRequest,
    (req, res) => controller.removeFileList(req, res)
  );

  router.post(
    '/projects/:id/send',
    gate,
    commonRules.id('id'),
    [
      body('recipients').optional().isArray(),
      body('includeDescription').optional().isBoolean(),
      body('includeAdminNotes').optional().isBoolean(),
      body('fileIds').optional().isArray(),
      body('listIds').optional().isArray(),
      body('contactListIds').optional().isArray(),
      commonRules.optionalString('name', 255),
      commonRules.optionalString('description', 10000),
      commonRules.optionalString('adminNotes', 10000),
    ],
    validateRequest,
    (req, res) => controller.send(req, res)
  );
  router.get(
    '/projects/:id/send-history',
    gate,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.getSendHistory(req, res)
  );

  return router;
}

module.exports = createInspectionRoutes;
