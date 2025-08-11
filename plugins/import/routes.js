const express = require('express');
const ImportController = require('./controller');

function createImportRoutes(controller, requirePlugin) {
  const router = express.Router();

  // POST /api/import/preview - Preview CSV data before import
  router.post('/preview', 
    requirePlugin('import'),
    ImportController.uploadMiddleware,
    ImportController.previewImport
  );

  // POST /api/import/csv - Import CSV data
  router.post('/csv',
    requirePlugin('import'),
    ImportController.uploadMiddleware, 
    ImportController.importCsv
  );

  // POST /api/import/validate - Validate CSV data without importing
  router.post('/validate',
    requirePlugin('import'),
    ImportController.uploadMiddleware,
    ImportController.validateImportData
  );

  // GET /api/import/templates - Get available import templates
  router.get('/templates', requirePlugin('import'), ImportController.getImportTemplates);

  return router;
}

module.exports = createImportRoutes;