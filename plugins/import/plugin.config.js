module.exports = {
    name: 'import',
    displayName: 'Import',
    version: '1.0.0',
    description: 'Import data from CSV files and other Homebase installations',
    routes: [
      {
        method: 'POST',
        path: '/import/csv',
        handler: 'importCsv'
      },
      {
        method: 'POST', 
        path: '/import/validate',
        handler: 'validateImportData'
      },
      {
        method: 'GET',
        path: '/import/templates',
        handler: 'getImportTemplates'
      },
      {
        method: 'POST',
        path: '/import/preview',
        handler: 'previewImport'
      }
    ],
    dependencies: ['contacts'] // Will use contacts plugin for validation
  };