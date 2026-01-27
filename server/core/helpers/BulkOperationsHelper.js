// server/core/helpers/BulkOperationsHelper.js
// Generic bulk operations helper for all plugins
// Uses @homebase/core SDK for database access with automatic tenant isolation

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../errors/AppError');

/**
 * Bulk Operations Helper
 * Provides generic bulk delete functionality for all plugins
 */
class BulkOperationsHelper {
  /**
   * Bulk delete items from a table
   * @param {Object} req - Express request object (for tenant context)
   * @param {string} tableName - Database table name
   * @param {Array<string|number>} ids - Array of item IDs to delete
   * @param {Object} options - Optional configuration
   * @param {number} options.maxItems - Maximum number of items per request (default: 500)
   * @param {Function} options.validateIds - Custom validation function for IDs
   * @returns {Promise<{deletedCount: number, deletedIds: string[]}>}
   */
  static async bulkDelete(req, tableName, ids, options = {}) {
    try {
      const { maxItems = 500, validateIds } = options;

      // Validate and normalize IDs
      if (!Array.isArray(ids)) {
        throw new AppError('ids must be an array', 400, AppError.CODES.VALIDATION_ERROR);
      }

      // Normalize, deduplicate, and filter empty values
      const normalizedIds = Array.from(
        new Set(ids.map((x) => String(x).trim()).filter(Boolean))
      );

      if (!normalizedIds.length) {
        Logger.info('Bulk delete called with empty IDs array', { tableName });
        return { deletedCount: 0, deletedIds: [] };
      }

      // Check max items limit
      if (normalizedIds.length > maxItems) {
        throw new AppError(
          `Too many ids (max ${maxItems} per request)`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      // Custom validation if provided
      if (validateIds && typeof validateIds === 'function') {
        const isValid = validateIds(normalizedIds);
        if (!isValid) {
          throw new AppError('ID validation failed', 400, AppError.CODES.VALIDATION_ERROR);
        }
      }

      // Get database instance (automatic tenant isolation)
      const db = Database.get(req);

      // Convert string IDs to integers for comparison (PostgreSQL SERIAL/INTEGER columns)
      // This handles both integer and text ID columns correctly
      const integerIds = normalizedIds.map((id) => {
        const parsed = parseInt(id, 10);
        if (isNaN(parsed)) {
          throw new AppError(`Invalid ID format: ${id}`, 400, AppError.CODES.VALIDATION_ERROR);
        }
        return parsed;
      });

      // Execute bulk delete with PostgreSQL array syntax
      // Use integer array for INTEGER/SERIAL columns, which is more efficient
      const sql = `
        DELETE FROM ${tableName}
        WHERE id = ANY($1::int[])
        RETURNING id
      `;

      const rows = await db.query(sql, [integerIds]);

      Logger.info('Bulk delete completed', {
        tableName,
        requested: normalizedIds.length,
        deleted: rows.length,
      });

      return {
        deletedCount: rows.length,
        deletedIds: rows.map((r) => String(r.id)),
      };
    } catch (error) {
      Logger.error('Bulk delete failed', error, {
        tableName,
        requestedCount: Array.isArray(ids) ? ids.length : 0,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to bulk delete from ${tableName}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }
}

module.exports = BulkOperationsHelper;
