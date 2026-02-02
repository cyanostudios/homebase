// server/core/services/database/DatabaseService.js
// Base Database Service interface

class DatabaseService {
  /**
   * Execute a parameterized query
   * @param {string} sql - SQL query with parameter placeholders ($1, $2, etc.)
   * @param {Array} params - Query parameters
   * @param {Object} context - Request context (for tenant isolation)
   * @returns {Promise<Array>} Query results
   */
  async query(sql, params = [], context = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback (receives client)
   * @param {Object} context - Request context
   * @returns {Promise<any>} Transaction result
   */
  async transaction(callback, context = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Insert a record
   * @param {string} table - Table name
   * @param {Object} data - Record data
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Inserted record
   */
  async insert(table, data, context = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Update a record
   * @param {string} table - Table name
   * @param {string|number} id - Record ID
   * @param {Object} data - Update data
   * @param {Object} context - Request context
   * @returns {Promise<Object>} Updated record
   */
  async update(table, id, data, context = {}) {
    throw new Error('Method not implemented');
  }

  /**
   * Delete a record
   * @param {string} table - Table name
   * @param {string|number} id - Record ID
   * @param {Object} context - Request context
   * @returns {Promise<void>}
   */
  async delete(table, id, context = {}) {
    throw new Error('Method not implemented');
  }
}

module.exports = DatabaseService;
