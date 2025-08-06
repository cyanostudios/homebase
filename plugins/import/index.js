module.exports = (pool, requirePlugin) => {
    const ImportModel = require('./model');
    const config = require('./plugin.config');
    const routes = require('./routes');
  
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
        name: config.name,
        displayName: config.displayName,
        version: config.version,
        description: config.description,
        routeBase: '/api/import'
      },
      router: routes,
      model: importModel
    };
  };