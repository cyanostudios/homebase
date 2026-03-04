// plugins/products/routes.js
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
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

  // GET /api/products - List all products
  router.get('/', gate, (req, res) => controller.getAll(req, res));

  // POST /api/products/import - CSV/XLSX import (MUST be before '/:id' route)
  router.post('/import', gate, uploadLimiter, csrfProtection, runImportUpload, (req, res) =>
    controller.import(req, res),
  );

  // POST /api/products/import/sello - Pull products from Sello API
  router.post('/import/sello', gate, uploadLimiter, csrfProtection, (req, res) =>
    controller.importFromSelloApi(req, res),
  );

  // POST /api/products/map/sello - Build channel map from Sello integrations
  router.post('/map/sello', gate, csrfProtection, (req, res) =>
    controller.buildChannelMapFromSello(req, res),
  );

  // POST /api/products - Create new product
  router.post(
    '/',
    gate,
    csrfProtection,
    [
      commonRules.string('sku', 1, 255),
      commonRules.optionalString('productNumber', 255),
      commonRules.string('title', 1, 255),
      commonRules.optionalString('description', 5000),
      commonRules.enum('status', ['for sale', 'draft', 'archived']),
      commonRules.integer('quantity', 0),
      commonRules.number('priceAmount', 0),
      commonRules.optionalString('currency', 3),
      commonRules.number('vatRate', 0, 100),
      commonRules.optionalString('mainImage', 500),
      commonRules.array('images', 50),
      commonRules.array('categories', 50),
      commonRules.optionalString('brand', 255),
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
      body('weight').optional({ values: 'null' }).isNumeric(),
      body('lengthCm').optional({ values: 'null' }).isNumeric(),
      body('widthCm').optional({ values: 'null' }).isNumeric(),
      body('heightCm').optional({ values: 'null' }).isNumeric(),
      body('depthCm').optional({ values: 'null' }).isNumeric(),
    ],
    validateRequest,
    (req, res) => controller.create(req, res),
  );

  // PATCH /api/products/batch - Batch update (MUST be before '/:id' route)
  router.patch(
    '/batch',
    gate,
    csrfProtection,
    [
      commonRules.array('ids', 500),
      body('updates').optional().isObject().withMessage('updates must be an object'),
      body('updates.priceAmount').optional().isNumeric(),
      body('updates.quantity').optional().isInt({ min: 0 }),
      body('updates.status').optional().isIn(['for sale', 'draft', 'archived']),
      body('updates.vatRate').optional().isNumeric(),
      body('updates.currency').optional().isLength({ min: 3, max: 3 }).isAlpha(),
    ],
    validateRequest,
    (req, res) => controller.batchUpdate(req, res),
  );

  // DELETE /api/products/batch - Bulk delete (MUST be before '/:id' route)
  router.delete(
    '/batch',
    gate,
    csrfProtection,
    [commonRules.array('ids', 500)],
    validateRequest,
    (req, res) => controller.bulkDelete(req, res),
  );

  // GET /api/products/:id/stats?range=7d|30d|3m|all
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
      commonRules.string('sku', 1, 255),
      commonRules.optionalString('productNumber', 255),
      commonRules.string('title', 1, 255),
      commonRules.optionalString('description', 5000),
      commonRules.enum('status', ['for sale', 'draft', 'archived']),
      commonRules.integer('quantity', 0),
      commonRules.number('priceAmount', 0),
      commonRules.optionalString('currency', 3),
      commonRules.number('vatRate', 0, 100),
      commonRules.optionalString('mainImage', 500),
      commonRules.array('images', 50),
      commonRules.array('categories', 50),
      commonRules.optionalString('brand', 255),
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
      body('weight').optional({ values: 'null' }).isNumeric(),
      body('lengthCm').optional({ values: 'null' }).isNumeric(),
      body('widthCm').optional({ values: 'null' }).isNumeric(),
      body('heightCm').optional({ values: 'null' }).isNumeric(),
      body('depthCm').optional({ values: 'null' }).isNumeric(),
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
