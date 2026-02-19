// server/core/Bootstrap.js
// Application bootstrapper - minimal, clean entry point
// Handles initialization, middleware setup, route mounting, and graceful shutdown

const ServiceManager = require('./ServiceManager');

/**
 * Bootstrap - Application initialization and lifecycle management
 *
 * Responsibilities:
 * 1. Initialize ServiceManager (load all providers)
 * 2. Graceful shutdown of all services
 *
 * Note: This is Phase 1 of the Bootstrap pattern.
 * Full middleware/route extraction will be done in Phase 2.
 */
class Bootstrap {
  /**
   * Initialize core services
   * Called before app setup in server/index.ts
   */
  static initializeServices() {
    console.log('🚀 Initializing Core Services...');

    // Initialize ServiceManager (loads all providers)
    ServiceManager.initialize();

    console.log('✅ ServiceManager initialized');
    console.log(
      '   - TenantService: ' +
        (process.env.TENANT_PROVIDER || (process.env.NEON_API_KEY ? 'neon' : 'local')),
    );
    console.log('   - ConnectionPoolService: ' + (process.env.POOL_PROVIDER || 'postgres'));
  }

  /**
   * Graceful shutdown - close all services and connections
   * @returns {Promise<void>}
   */
  static async shutdown() {
    console.log('🛑 Initiating graceful shutdown...');

    try {
      // Shutdown ServiceManager (closes all pools, etc.)
      await ServiceManager.shutdown();

      console.log('✅ Graceful shutdown complete');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      throw error;
    }
  }
}

module.exports = Bootstrap;
