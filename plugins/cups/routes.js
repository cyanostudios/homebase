// plugins/cups/routes.js
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const config = require('./plugin.config');
const { commonRules, validateRequest, body } = require('../../server/core/middleware/validation');

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function createCupsRoutes(controller, context) {
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin(config.name);

  // File upload for HTML scraping
  const uploadRoot = path.join(process.cwd(), 'server', 'uploads', 'cups-scrape');
  ensureDirSync(uploadRoot);

  const upload = multer({
    dest: uploadRoot,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter(_req, file, cb) {
      const allowed = ['text/html', 'text/plain', 'text/csv', 'application/pdf'];
      const lower = (file.originalname || '').toLowerCase();
      if (
        allowed.includes(file.mimetype) ||
        lower.endsWith('.html') ||
        lower.endsWith('.htm') ||
        lower.endsWith('.txt') ||
        lower.endsWith('.csv') ||
        lower.endsWith('.pdf')
      ) {
        cb(null, true);
      } else {
        cb(new Error('Only HTML/text/CSV/PDF files are allowed for scraping'));
      }
    },
  });

  // ─── SOURCES (before /:id so paths are never captured as ids) ───────────────
  router.get('/settings/sources', gate, (req, res) => controller.getSources(req, res));

  router.post(
    '/settings/sources',
    gate,
    commonRules.optionalString('label', 255),
    commonRules.optionalString('type', 20),
    commonRules.optionalUrl('url', 1000),
    validateRequest,
    (req, res) => controller.createSource(req, res),
  );

  router.put(
    '/settings/sources/:id',
    gate,
    commonRules.id('id'),
    commonRules.optionalString('label', 255),
    validateRequest,
    (req, res) => controller.updateSource(req, res),
  );

  router.delete('/settings/sources/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.deleteSource(req, res),
  );

  router.post(
    '/settings/sources/:id/scrape',
    gate,
    commonRules.id('id'),
    validateRequest,
    (req, res) => controller.scrapeSource(req, res),
  );

  router.post(
    '/settings/sources/:id/upload-file',
    gate,
    commonRules.id('id'),
    validateRequest,
    upload.single('file'),
    (req, res) => controller.uploadSourceFile(req, res),
  );

  router.post(
    '/settings/sources/:id/scrape-file',
    gate,
    commonRules.id('id'),
    validateRequest,
    upload.single('file'),
    (req, res) => controller.scrapeFile(req, res),
  );

  // ─── CUPS CRUD ────────────────────────────────────────────────────────────────
  router.get('/', gate, (req, res) => controller.getAll(req, res));

  router.delete(
    '/batch',
    gate,
    ...commonRules.requiredArray('ids', 500),
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  router.post(
    '/',
    gate,
    commonRules.string('name', 1, 500),
    commonRules.optionalString('organizer', 255),
    commonRules.optionalString('region', 255),
    commonRules.optionalString('location', 255),
    commonRules.optionalString('sport_type', 100),
    commonRules.optionalString('start_date', 30),
    commonRules.optionalString('end_date', 30),
    commonRules.optionalString('age_groups', 500),
    commonRules.optionalUrl('registration_url', 1000),
    commonRules.optionalUrl('source_url', 1000),
    commonRules.optionalString('raw_snippet', 200000),
    body('visible').optional().isBoolean().toBoolean(),
    body('sanctioned').optional().isBoolean().toBoolean(),
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  router.get('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.getById(req, res),
  );

  router.put(
    '/:id',
    gate,
    commonRules.id('id'),
    commonRules.optionalString('name', 500),
    commonRules.optionalString('organizer', 255),
    commonRules.optionalString('region', 255),
    commonRules.optionalString('location', 255),
    commonRules.optionalString('sport_type', 100),
    commonRules.optionalString('start_date', 30),
    commonRules.optionalString('end_date', 30),
    commonRules.optionalString('age_groups', 500),
    commonRules.optionalUrl('registration_url', 1000),
    commonRules.optionalUrl('source_url', 1000),
    commonRules.optionalString('raw_snippet', 200000),
    body('visible').optional().isBoolean().toBoolean(),
    body('sanctioned').optional().isBoolean().toBoolean(),
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  router.delete('/:id', gate, commonRules.id('id'), validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  return router;
}

module.exports = createCupsRoutes;
