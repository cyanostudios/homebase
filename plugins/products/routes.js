// plugins/products/routes.js
const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { csrfProtection } = require('../../server/core/middleware/csrf');
const { commonRules, validateRequest } = require('../../server/core/middleware/validation');
const { uploadLimiter } = require('../../server/core/middleware/rateLimit');
const multer = require('multer');

function createProductRoutes(controller, context) {
  // V3: Get requirePlugin from context.middleware instead of parameter
  const requirePlugin =
    context?.middleware?.requirePlugin || ((name) => (req, res, next) => next());
  const gate = requirePlugin('products');

  // In-memory upload for import files
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 1,
    },
  });
  const mediaUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 20 * 1024 * 1024,
      files: 10,
    },
  });
  const runImportUpload = (req, res, next) =>
    upload.single('file')(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large (max 10MB)'
            : err.code === 'LIMIT_FILE_COUNT'
              ? 'Too many files (max 1)'
              : 'Upload rejected';
        return res.status(400).json({ error: msg, code: 'VALIDATION_ERROR' });
      }
      return res.status(400).json({ error: 'Upload failed', code: 'VALIDATION_ERROR' });
    });
  const runMediaUpload = (req, res, next) =>
    mediaUpload.array('files', 10)(req, res, (err) => {
      if (!err) return next();
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'File too large (max 20MB)'
            : err.code === 'LIMIT_FILE_COUNT'
              ? 'Too many files (max 10)'
              : 'Upload rejected';
        return res.status(400).json({ error: msg, code: 'VALIDATION_ERROR' });
      }
      return res.status(400).json({ error: 'Upload failed', code: 'VALIDATION_ERROR' });
    });

  // Sello settings (MUST be before '/' route)
  router.get('/sello-settings', gate, (req, res) => controller.getSelloSettings(req, res));
  router.put(
    '/sello-settings',
    gate,
    csrfProtection,
    [commonRules.optionalString('apiKey', 500)],
    validateRequest,
    (req, res) => controller.putSelloSettings(req, res),
  );

  // Category cache (read-only from DB; MUST be before '/' route)
  router.get('/category-cache', gate, (req, res) => controller.getCategoryCache(req, res));

  // Lookup tables (MUST be before '/' route)
  router.get('/brands', gate, (req, res) => controller.getBrands(req, res));
  router.post(
    '/brands',
    gate,
    csrfProtection,
    [commonRules.string('name', 1, 255)],
    validateRequest,
    (req, res) => controller.createBrand(req, res),
  );
  router.get('/suppliers', gate, (req, res) => controller.getSuppliers(req, res));
  router.post(
    '/suppliers',
    gate,
    csrfProtection,
    [commonRules.string('name', 1, 255)],
    validateRequest,
    (req, res) => controller.createSupplier(req, res),
  );
  router.get('/manufacturers', gate, (req, res) => controller.getManufacturers(req, res));
  router.post(
    '/manufacturers',
    gate,
    csrfProtection,
    [commonRules.string('name', 1, 255)],
    validateRequest,
    (req, res) => controller.createManufacturer(req, res),
  );

  // List CRUD (MUST be before '/:id')
  router.get('/lists', gate, (req, res) => controller.getLists(req, res));
  router.post(
    '/lists',
    gate,
    csrfProtection,
    [commonRules.string('name', 1, 255)],
    validateRequest,
    (req, res) => controller.createList(req, res),
  );
  router.put(
    '/lists/:id',
    gate,
    csrfProtection,
    [commonRules.id('id'), commonRules.string('name', 1, 255)],
    validateRequest,
    (req, res) => controller.renameList(req, res),
  );
  router.delete(
    '/lists/:id',
    gate,
    csrfProtection,
    [commonRules.id('id')],
    validateRequest,
    (req, res) => controller.deleteList(req, res),
  );

  // GET /api/products/count — lightweight count for Dashboard (before '/')
  router.get('/count', gate, (req, res) => controller.getCount(req, res));

  router.get('/filter-definitions', gate, (req, res) => controller.getFilterDefinitions(req, res));

  router.post(
    '/filter-facets',
    gate,
    csrfProtection,
    [
      body('field').isIn(['brand', 'supplier', 'manufacturer']),
      body('q').optional().trim().isLength({ max: 200 }),
      body('limit').optional().isInt({ min: 1, max: 500 }),
    ],
    validateRequest,
    (req, res) => controller.postFilterFacets(req, res),
  );

  router.post(
    '/search',
    gate,
    csrfProtection,
    [
      body('limit').optional().isInt({ min: 1, max: 500 }),
      body('offset').optional().isInt({ min: 0, max: 100000 }),
      body('sort').optional().isIn(['id', 'title', 'quantity', 'priceAmount', 'sku']),
      body('order').optional().isIn(['asc', 'desc']),
      body('q').optional().trim().isLength({ max: 500 }),
      body('searchIn')
        .optional()
        .trim()
        .isIn([
          'all',
          'productId',
          'groupId',
          'sku',
          'title',
          'privateName',
          'lagerplats',
          'ean',
          'gtin',
        ]),
      body('list').optional().trim().isLength({ max: 64 }),
      body('filters').optional().isArray(),
    ],
    validateRequest,
    (req, res) => controller.catalogSearch(req, res),
  );

  router.get('/saved-filters', gate, (req, res) => controller.listSavedFilters(req, res));
  router.post(
    '/saved-filters',
    gate,
    csrfProtection,
    [
      commonRules.string('name', 1, 200),
      body('definition').isObject().withMessage('definition required'),
    ],
    validateRequest,
    (req, res) => controller.createSavedFilter(req, res),
  );
  router.put(
    '/saved-filters/:id',
    gate,
    csrfProtection,
    [
      commonRules.id('id'),
      body('name').optional().isString().trim().isLength({ min: 1, max: 200 }),
      body('definition').optional().isObject(),
    ],
    validateRequest,
    (req, res) => controller.updateSavedFilter(req, res),
  );
  router.delete(
    '/saved-filters/:id',
    gate,
    csrfProtection,
    [commonRules.id('id')],
    validateRequest,
    (req, res) => controller.deleteSavedFilter(req, res),
  );

  // POST /api/products/draft - Reserve a hidden draft row with a real product id
  router.post('/draft', gate, csrfProtection, (req, res) => controller.createDraft(req, res));

  // GET /api/products - Paginated list { items, total }
  router.get(
    '/',
    gate,
    [
      query('limit').optional().isIn(['25', '50', '100', '150', '200', '250']),
      query('offset').optional().isInt({ min: 0, max: 100000 }),
      query('sort').optional().isIn(['id', 'title', 'quantity', 'priceAmount', 'sku']),
      query('order').optional().isIn(['asc', 'desc']),
      query('q').optional().trim().isLength({ max: 500 }),
      query('searchIn')
        .optional()
        .trim()
        .isIn([
          'all',
          'productId',
          'groupId',
          'sku',
          'title',
          'privateName',
          'lagerplats',
          'ean',
          'gtin',
        ]),
      query('list').optional().trim().isLength({ max: 64 }),
    ],
    validateRequest,
    (req, res) => controller.getAll(req, res),
  );

  // POST /api/products/import - CSV/XLSX import (MUST be before '/:id' route)
  router.post('/import', gate, uploadLimiter, csrfProtection, runImportUpload, (req, res) =>
    controller.import(req, res),
  );

  router.post('/media/upload', gate, uploadLimiter, csrfProtection, runMediaUpload, (req, res) =>
    controller.uploadMedia(req, res),
  );

  router.get('/import/jobs/:jobId', gate, (req, res) => controller.getImportJob(req, res));
  router.get('/import/history', gate, (req, res) => controller.listImportHistory(req, res));
  router.get('/import/history/:jobId/file', gate, (req, res) =>
    controller.downloadImportHistoryFile(req, res),
  );
  router.get('/import/column-reference', gate, (req, res) =>
    controller.getImportColumnReference(req, res),
  );

  router.get('/export/column-reference', gate, (req, res) =>
    controller.getExportColumnReference(req, res),
  );
  router.post('/export', gate, uploadLimiter, csrfProtection, (req, res) =>
    controller.exportProducts(req, res),
  );

  // POST /api/products/import/sello - Pull products from Sello API
  router.post('/import/sello', gate, uploadLimiter, csrfProtection, (req, res) =>
    controller.importFromSelloApi(req, res),
  );

  // buildChannelMapFromSello: Gömmen – sker nu automatiskt vid Sello-import.
  // För backfill, kör: node scripts/run-build-channel-map-sello.js (anropar controllern direkt)

  // POST /api/products - Create new product
  router.post(
    '/',
    gate,
    csrfProtection,
    [
      commonRules.optionalString('sku', 255),
      commonRules.string('title', 1, 255),
      commonRules.optionalHtmlString('description', 5000),
      commonRules.enum('status', ['for sale', 'paused']),
      commonRules.integer('quantity', 0),
      commonRules.number('priceAmount', 0),
      commonRules.optionalString('currency', 3),
      commonRules.number('vatRate', 0, 100),
      commonRules.optionalUrl('mainImage', 500),
      commonRules.array('images', 50),
      commonRules.array('categories', 50),
      commonRules.optionalString('brand', 255),
      commonRules.optionalString('privateName', 255),
      commonRules.optionalString('mpn', 255),
      commonRules.optionalString('ean', 14),
      commonRules.optionalString('gtin', 14),
      body('brandId').optional({ values: 'falsy' }).isInt({ min: 1 }),
      body('supplierId').optional({ values: 'falsy' }).isInt({ min: 1 }),
      body('manufacturerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
      body('channelSpecific')
        .optional({ values: 'null' })
        .isObject()
        .withMessage('channelSpecific must be an object'),
      commonRules.optionalString('color', 100),
      commonRules.optionalString('colorText', 255),
      commonRules.optionalString('size', 50),
      commonRules.optionalString('sizeText', 255),
      commonRules.optionalString('pattern', 100),
      commonRules.optionalString('material', 255),
      commonRules.optionalString('patternText', 255),
      body('weight').optional({ values: 'null' }).isNumeric(),
      body('lengthCm').optional({ values: 'null' }).isNumeric(),
      body('widthCm').optional({ values: 'null' }).isNumeric(),
      body('depthCm').optional({ values: 'null' }).isNumeric(),
      commonRules.optionalString('lagerplats', 100),
      body('condition').optional().isIn(['new', 'used', 'refurb']),
      commonRules.optionalString('groupId', 100),
      body('volume').optional({ values: 'null' }).isNumeric(),
      commonRules.optionalString('volumeUnit', 20),
      commonRules.optionalHtmlString('notes', 5000),
    ],
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  // GET batch sync job history + status (before '/batch' PATCH)
  router.get('/batch/sync-jobs', gate, (req, res) => controller.listBatchSyncJobs(req, res));
  router.get('/batch/sync-jobs/:jobId', gate, (req, res) => controller.getBatchSyncJob(req, res));

  // POST /api/products/batch/sync-job — same as PATCH /batch (explicit async job)
  router.post(
    '/batch/sync-job',
    gate,
    csrfProtection,
    [
      commonRules.array('ids', 250),
      body('changes').optional().isObject().withMessage('changes must be an object'),
      body('updates').optional().isObject().withMessage('updates must be an object'),
    ],
    validateRequest,
    (req, res) => controller.startBatchSyncJob(req, res),
  );

  // PATCH /api/products/batch - Async batch sync job (MUST be before '/:id' route)
  router.patch(
    '/batch',
    gate,
    csrfProtection,
    [
      commonRules.array('ids', 250),
      body('updates').optional().isObject().withMessage('updates must be an object'),
      body('changes').optional().isObject().withMessage('changes must be an object'),
      body('updates.priceAmount').optional().isNumeric(),
      body('updates.quantity').optional().isInt({ min: 0 }),
      body('updates.status').optional().isIn(['for sale', 'paused']),
      body('updates.vatRate').optional().isNumeric(),
      body('updates.currency').optional().isLength({ min: 3, max: 3 }).isAlpha(),
    ],
    validateRequest,
    (req, res) => controller.batchUpdate(req, res),
  );

  // POST /api/products/group - Set selected products as variant group (group_id, parent_product_id, group_variation_type)
  router.post(
    '/group',
    gate,
    csrfProtection,
    [
      body('productIds').isArray().withMessage('productIds must be an array'),
      body('productIds')
        .custom((v) => !v || v.length <= 250)
        .withMessage('productIds at most 250'),
      body('groupVariationType')
        .isIn(['color', 'size', 'model'])
        .withMessage('groupVariationType must be color, size or model'),
      body('mainProductId')
        .optional({ values: 'null' })
        .custom((v) => v === null || v === undefined || typeof v === 'string')
        .withMessage('mainProductId must be a string'),
    ],
    validateRequest,
    (req, res) => controller.setProductGroup(req, res),
  );

  // PUT /api/products/batch/list — move products to list (MUST be before '/:id')
  router.put(
    '/batch/list',
    gate,
    csrfProtection,
    [
      commonRules.array('ids', 250),
      body('listId')
        .optional({ values: 'null' })
        .custom((v) => {
          if (v === null || v === undefined || v === '') return true;
          if (typeof v === 'string' && /^\d+$/.test(v.trim())) return true;
          if (typeof v === 'number' && Number.isFinite(v)) return true;
          throw new Error('listId must be null, empty, or a numeric list id');
        }),
    ],
    validateRequest,
    (req, res) => controller.batchSetProductList(req, res),
  );

  // POST /api/products/duplicate/precheck — incomplete variant groups
  router.post(
    '/duplicate/precheck',
    gate,
    csrfProtection,
    [commonRules.array('ids', 250)],
    validateRequest,
    (req, res) => controller.duplicatePrecheck(req, res),
  );

  // POST /api/products/duplicate/jobs — async duplicate
  router.post(
    '/duplicate/jobs',
    gate,
    csrfProtection,
    [
      body('productIds').optional().isArray(),
      body('ids').optional().isArray(),
      body('copyMedia').optional().isBoolean(),
    ],
    validateRequest,
    (req, res) => controller.startDuplicateJob(req, res),
  );

  router.get('/duplicate/jobs/:jobId', gate, (req, res) => controller.getDuplicateJob(req, res));

  // DELETE /api/products/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    [commonRules.array('ids', 250)],
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // GET /api/products/:id/stats?range=7d|30d|3m|all&timelineLimit=10&timelineOffset=0
  router.get('/:id/stats', gate, (req, res) => controller.getStats(req, res));

  // PUT /api/products/:id/list - Set product list (body: listId or null for "Huvudlista")
  router.put(
    '/:id/list',
    gate,
    csrfProtection,
    [commonRules.id('id')],
    validateRequest,
    (req, res) => controller.setProductList(req, res),
  );

  // PUT /api/products/:id - Update product
  router.put(
    '/:id',
    gate,
    csrfProtection,
    [
      commonRules.id('id'),
      commonRules.optionalString('sku', 255),
      commonRules.string('title', 1, 255),
      commonRules.optionalHtmlString('description', 5000),
      commonRules.enum('status', ['for sale', 'paused']),
      commonRules.integer('quantity', 0),
      commonRules.number('priceAmount', 0),
      commonRules.optionalString('currency', 3),
      commonRules.number('vatRate', 0, 100),
      commonRules.optionalUrl('mainImage', 500),
      commonRules.array('images', 50),
      commonRules.array('categories', 50),
      commonRules.optionalString('brand', 255),
      commonRules.optionalString('privateName', 255),
      commonRules.optionalString('mpn', 255),
      commonRules.optionalString('ean', 14),
      commonRules.optionalString('gtin', 14),
      body('brandId').optional({ values: 'falsy' }).isInt({ min: 1 }),
      body('supplierId').optional({ values: 'falsy' }).isInt({ min: 1 }),
      body('manufacturerId').optional({ values: 'falsy' }).isInt({ min: 1 }),
      body('channelSpecific')
        .optional({ values: 'null' })
        .isObject()
        .withMessage('channelSpecific must be an object'),
      commonRules.optionalString('color', 100),
      commonRules.optionalString('colorText', 255),
      commonRules.optionalString('size', 50),
      commonRules.optionalString('sizeText', 255),
      commonRules.optionalString('pattern', 100),
      commonRules.optionalString('material', 255),
      commonRules.optionalString('patternText', 255),
      body('weight').optional({ values: 'null' }).isNumeric(),
      body('lengthCm').optional({ values: 'null' }).isNumeric(),
      body('widthCm').optional({ values: 'null' }).isNumeric(),
      body('heightCm').optional({ values: 'null' }).isNumeric(),
      body('depthCm').optional({ values: 'null' }).isNumeric(),
      commonRules.optionalString('lagerplats', 100),
      body('condition').optional().isIn(['new', 'used', 'refurb']),
      commonRules.optionalString('groupId', 100),
      body('volume').optional({ values: 'null' }).isNumeric(),
      commonRules.optionalString('volumeUnit', 20),
      commonRules.optionalHtmlString('notes', 5000),
    ],
    validateRequest,
    (req, res) => controller.update(req, res),
  );

  // DELETE /api/products/:id - Delete single product
  router.delete('/:id', gate, csrfProtection, [commonRules.id('id')], validateRequest, (req, res) =>
    controller.delete(req, res),
  );

  return router;
}

module.exports = createProductRoutes;
