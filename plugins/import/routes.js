const express = require('express');
const ImportController = require('./controller');

const router = express.Router();

// Apply authentication middleware to all routes
router.use((req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
});

// POST /api/import/preview - Preview CSV data before import
router.post('/preview', 
  ImportController.uploadMiddleware,
  ImportController.previewImport
);

// POST /api/import/csv - Import CSV data
router.post('/csv',
  ImportController.uploadMiddleware, 
  ImportController.importCsv
);

// POST /api/import/validate - Validate CSV data without importing
router.post('/validate',
  ImportController.uploadMiddleware,
  ImportController.validateImportData
);

// GET /api/import/templates - Get available import templates
router.get('/templates', ImportController.getImportTemplates);

module.exports = router;