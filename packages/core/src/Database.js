// packages/core/src/Database.js
// Database interface for plugins - wraps ServiceManager database

const ServiceManager = require('../../../server/core/ServiceManager');

/**
 * Database interface for plugins
 * Provides database access with automatic tenant isolation
 */
class Database {
  /**
   * Get database instance for current request
   * @param {Object} req - Express request object (contains tenant pool)
   * @returns {Object} Database adapter instance
   */
  static get(req) {
    if (!req) {
      throw new Error('Database.get() requires request object for tenant context');
    }

    // Get tenant pool from request (set by middleware in server/index.ts)
    const pool = req.tenantPool;
    if (!pool) {
      throw new Error('Tenant pool not found in request. Ensure auth middleware is applied.');
    }

    // Get database service and initialize with tenant context
    const database = ServiceManager.get('database');

    // Create request-scoped context
    const context = {
      pool,
      userId: req.session?.user?.id,
    };

    // Return database adapter with context
    return {
      /**
       * Execute SQL query with automatic tenant isolation
       * @param {string} sql - SQL query
       * @param {Array} params - Query parameters
       * @returns {Promise<Object>} Query result
       */
      query: async (sql, params = []) => {
        return await database.query(sql, params, context);
      },

      /**
       * Execute transaction
       * @param {Function} callback - Transaction callback
       * @returns {Promise<any>} Transaction result
       */
      transaction: async (callback) => {
        return await database.transaction(callback, context);
      },

      /**
       * Insert record (convenience method)
       * @param {string} table - Table name
       * @param {Object} data - Data to insert
       * @returns {Promise<Object>} Inserted record
       */
      insert: async (table, data) => {
        const database = ServiceManager.get('database');
        return await database.insert(table, data, context);
      },

      /**
       * Update record (convenience method)
       * @param {string} table - Table name
       * @param {number|string} id - Record ID
       * @param {Object} data - Data to update
       * @returns {Promise<Object>} Updated record
       */
      update: async (table, id, data) => {
        const database = ServiceManager.get('database');
        return await database.update(table, id, data, context);
      },

      /**
       * Delete record (convenience method)
       * @param {string} table - Table name
       * @param {number|string} id - Record ID
       * @returns {Promise<boolean>} Success
       */
      deleteRecord: async (table, id) => {
        const database = ServiceManager.get('database');
        return await database.delete(table, id, context);
      },

      /**
       * Get raw pool (use with caution)
       * @returns {Object} PostgreSQL pool
       */
      getPool: () => pool,
    };
  }

  /**
   * Get database service directly (for non-request contexts like migrations)
   * @returns {Object} Database service
   */
  static getService() {
    return ServiceManager.get('database');
  }
}

module.exports = Database;
