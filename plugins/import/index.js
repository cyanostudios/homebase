const ImportModel = require('./model');
const ImportController = require('./controller');
const createImportRoutes = require('./routes');

module.exports = (pool, requirePlugin) => {
  // Initialize model with pool
  const importModel = new ImportModel(pool);

  // Plugin initialization
  const initialize = async () => {
    console.log('🔄 Initializing Import plugin...');
    
    try {
      // Ensure database tables exist
      await importModel.ensureImportLogsTable();
      
      console.log('✅ Import plugin initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Import plugin:', error);
      throw error;
    }
  };

  // Initialize plugin
  initialize().catch(console.error);

  return {
    config: {
      name: 'import',
      displayName: 'Import',
      version: '1.0.0',
      description: 'Import data from CSV files',
      routeBase: '/api/import'
    },
    router: createImportRoutes(ImportController, requirePlugin),
    model: importModel
  };
};