// server/core/services/database/adapters/MockAdapter.js
// Mock Database Adapter for testing

const DatabaseService = require('../DatabaseService');
const { AppError } = require('../../../errors/AppError');

class MockAdapter extends DatabaseService {
  constructor(config = {}) {
    super();
    this._isTestOverride = true; // So ServiceManager.get('database', req) returns this when overridden
    this.pool = {}; // Required by Database.get(req) - mock for tests
    this.data = {}; // In-memory storage: { tableName: { id: record } }
    this.queryLog = []; // Log all queries for testing
    this.autoIncrement = {}; // Auto-increment counters per table
  }

  /**
   * Execute a parameterized query
   * Simple mock implementation - supports basic SELECT, INSERT, UPDATE, DELETE
   */
  async query(sql, params = [], context = {}) {
    this.queryLog.push({ sql, params, context });

    const lowerSql = sql.toLowerCase().trim();
    const tableMatch =
      sql.match(/from\s+(\w+)/i) ||
      sql.match(/into\s+(\w+)/i) ||
      sql.match(/update\s+(\w+)/i) ||
      sql.match(/delete\s+from\s+(\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;

    // SELECT queries
    if (lowerSql.startsWith('select')) {
      if (!table || !this.data[table]) {
        return [];
      }

      const records = Object.values(this.data[table]);

      // Simple WHERE clause matching (basic implementation)
      if (lowerSql.includes('where')) {
        // Match by id if $1 is provided
        if (params.length > 0 && lowerSql.includes('id = $1')) {
          const id = params[0];
          const record = this.data[table][id];
          return record ? [record] : [];
        }
      }

      return records;
    }

    // INSERT queries
    if (lowerSql.startsWith('insert')) {
      if (!table) {
        throw new AppError('Table name not found in INSERT query', 500, 'INVALID_QUERY');
      }

      if (!this.data[table]) {
        this.data[table] = {};
        this.autoIncrement[table] = 0;
      }

      // Extract column names and values from SQL
      const columnsMatch = sql.match(/\(([^)]+)\)/);
      const valuesMatch = sql.match(/values\s*\(([^)]+)\)/i);

      if (!columnsMatch || !valuesMatch) {
        throw new AppError('Invalid INSERT query format', 500, 'INVALID_QUERY');
      }

      const columns = columnsMatch[1].split(',').map((c) => c.trim());
      const values = params.slice(0, columns.length);

      const record = {};
      columns.forEach((col, i) => {
        record[col] = values[i];
      });

      // Auto-generate ID if not provided
      if (!record.id) {
        this.autoIncrement[table]++;
        record.id = this.autoIncrement[table].toString();
      }

      // Add timestamps
      if (!record.created_at) {
        record.created_at = new Date().toISOString();
      }
      if (!record.updated_at) {
        record.updated_at = new Date().toISOString();
      }

      this.data[table][record.id] = record;
      return [record];
    }

    // UPDATE queries
    if (lowerSql.startsWith('update')) {
      if (!table || !this.data[table]) {
        return [];
      }

      const idMatch = sql.match(/where\s+id\s*=\s*\$\d+/i);
      if (!idMatch) {
        throw new AppError('UPDATE query must include WHERE id = $N', 500, 'INVALID_QUERY');
      }

      const idIndex = parseInt(idMatch[0].match(/\$(\d+)/)[1]) - 1;
      const id = params[idIndex];

      const record = this.data[table][id];
      if (!record) {
        return [];
      }

      // Update fields (simplified - assumes SET column = $N format)
      const setMatch = sql.match(/set\s+([^where]+)/i);
      if (setMatch) {
        const setClause = setMatch[1];
        const updates = setClause.split(',').map((s) => s.trim());

        updates.forEach((update, i) => {
          const [column] = update.split('=').map((s) => s.trim());
          const paramIndex = parseInt(update.match(/\$(\d+)/)?.[1]) - 1;
          if (paramIndex >= 0 && params[paramIndex] !== undefined) {
            record[column] = params[paramIndex];
          }
        });
      }

      record.updated_at = new Date().toISOString();
      return [record];
    }

    // DELETE queries
    if (lowerSql.startsWith('delete')) {
      if (!table || !this.data[table]) {
        return [];
      }

      const idMatch = sql.match(/where\s+id\s*=\s*\$\d+/i);
      if (idMatch) {
        const idIndex = parseInt(idMatch[0].match(/\$(\d+)/)[1]) - 1;
        const id = params[idIndex];
        if (this.data[table][id]) {
          delete this.data[table][id];
          return [{ id }];
        }
      }

      return [];
    }

    // Default: return empty array
    return [];
  }

  /**
   * Execute a transaction
   */
  async transaction(callback, context = {}) {
    // Mock transaction - just execute callback
    // In a real implementation, this would handle rollback on error
    try {
      return await callback(this);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Insert a record
   */
  async insert(table, data, context = {}) {
    if (!this.data[table]) {
      this.data[table] = {};
      this.autoIncrement[table] = 0;
    }

    // Auto-generate ID if not provided
    if (!data.id) {
      this.autoIncrement[table]++;
      data.id = this.autoIncrement[table].toString();
    }

    // Add timestamps
    if (!data.created_at) {
      data.created_at = new Date().toISOString();
    }
    if (!data.updated_at) {
      data.updated_at = new Date().toISOString();
    }

    this.data[table][data.id] = { ...data };
    return { ...data };
  }

  /**
   * Update a record
   */
  async update(table, id, data, context = {}) {
    if (!this.data[table] || !this.data[table][id]) {
      throw new AppError(`${table.slice(0, -1)} not found or unauthorized`, 404, 'NOT_FOUND');
    }

    const record = this.data[table][id];
    Object.assign(record, data, { updated_at: new Date().toISOString() });
    return { ...record };
  }

  /**
   * Delete a record
   */
  async delete(table, id, context = {}) {
    if (!this.data[table] || !this.data[table][id]) {
      throw new AppError(`${table.slice(0, -1)} not found or unauthorized`, 404, 'NOT_FOUND');
    }

    delete this.data[table][id];
    return { id };
  }

  /**
   * Clear all data (useful for test cleanup)
   */
  clear() {
    this.data = {};
    this.autoIncrement = {};
    this.queryLog = [];
  }

  /**
   * Get query log (useful for testing)
   */
  getQueryLog() {
    return this.queryLog;
  }

  /**
   * Clear query log
   */
  clearQueryLog() {
    this.queryLog = [];
  }
}

module.exports = MockAdapter;
