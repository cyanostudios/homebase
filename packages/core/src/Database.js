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

    // Get database service for this request (uses req.tenantPool when set, else main pool)
    const database = ServiceManager.get('database', req);
    const pool = database && database.pool;
    if (!pool) {
      throw new Error('Database pool not available. Ensure auth middleware is applied.');
    }

    // Create request-scoped context
    const context = {
      pool,
      tenantId: (req.session && req.session.tenantId) || null,
      tenantSchemaName: (req.session && req.session.tenantSchemaName) || null,
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
        // IMPORTANT: always use request-scoped database so tenant pool/search_path is correct
        const database = ServiceManager.get('database', req);
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
        // IMPORTANT: always use request-scoped database so tenant pool/search_path is correct
        const database = ServiceManager.get('database', req);
        return await database.update(table, id, data, context);
      },

      /**
       * Delete record (convenience method)
       * @param {string} table - Table name
       * @param {number|string} id - Record ID
       * @returns {Promise<boolean>} Success
       */
      deleteRecord: async (table, id) => {
        // IMPORTANT: always use request-scoped database so tenant pool/search_path is correct
        const database = ServiceManager.get('database', req);
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
