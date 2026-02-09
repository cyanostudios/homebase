// server/core/services/connection-pool/ConnectionPoolService.js
// Abstract interface for database connection pool management
// Implementations: Postgres, PgBouncer, Supabase

/**
 * ConnectionPoolService - Abstract interface for managing database connection pools
 * 
 * This service handles the lifecycle of database connection pools for tenants.
 * Different providers implement different pooling strategies:
 * 
 * - PostgresPoolProvider: Direct pg.Pool management with cleanup
 * - PgBouncerProvider: External connection pooler
 * - SupabasePoolProvider: Supabase Pooler integration
 */
class ConnectionPoolService {
  /**
   * Get or create a connection pool for tenant
   * @param {string} connectionString - Database connection string
   * @returns {Pool} - pg.Pool instance
   */
  getTenantPool(connectionString) {
    throw new Error('ConnectionPoolService.getTenantPool() must be implemented by provider');
  }

  /**
   * Close a specific tenant pool
   * @param {string} connectionString - Connection string to close
   * @returns {Promise<void>}
   */
  async closeTenantPool(connectionString) {
    throw new Error('ConnectionPoolService.closeTenantPool() must be implemented by provider');
  }

  /**
   * Close all tenant pools (for graceful shutdown)
   * @returns {Promise<void>}
   */
  async closeAllPools() {
    throw new Error('ConnectionPoolService.closeAllPools() must be implemented by provider');
  }

  /**
   * Get statistics for all pools
   * @returns {Object} - Pool statistics
   */
  getPoolStats() {
    throw new Error('ConnectionPoolService.getPoolStats() must be implemented by provider');
  }

  /**
   * Run cleanup of inactive pools
   * @returns {Promise<number>} - Number of pools closed
   */
  async cleanupInactivePools() {
    throw new Error('ConnectionPoolService.cleanupInactivePools() must be implemented by provider');
  }

  /**
   * Get pool for specific connection string (if exists)
   * @param {string} connectionString
   * @returns {Pool|null}
   */
  getExistingPool(connectionString) {
    throw new Error('ConnectionPoolService.getExistingPool() must be implemented by provider');
  }

  /**
   * Check if pool exists for connection string
   * @param {string} connectionString
   * @returns {boolean}
   */
  hasPool(connectionString) {
    throw new Error('ConnectionPoolService.hasPool() must be implemented by provider');
  }
}

module.exports = ConnectionPoolService;
