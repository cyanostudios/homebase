// server/core/helpers/BulkOperationsHelper.js
// Generic bulk delete using tenant-aware Database from @homebase/core

const { Database } = require('@homebase/core');
const { AppError } = require('../errors/AppError');

/**
 * Bulk delete records from a table. Uses Database.get(req) for tenant isolation.
 * @param {Object} req - Express request
 * @param {string} table - Table name (e.g. 'contacts', 'notes')
 * @param {string[]} idsTextArray - Array of id strings (or numbers as string)
 * @returns {Promise<{ deletedCount: number, deletedIds: string[] }>}
 */
async function bulkDelete(req, table, idsTextArray) {
  if (!idsTextArray || !Array.isArray(idsTextArray)) {
    throw new AppError('ids must be an array', 400, AppError.CODES.BAD_REQUEST);
  }

  const ids = Array.from(new Set(idsTextArray.map((x) => String(x).trim()).filter(Boolean)));
  if (ids.length === 0) {
    return { deletedCount: 0, deletedIds: [] };
  }

  const db = Database.get(req);
  const deletedIds = [];

  for (const id of ids) {
    try {
      await db.deleteRecord(table, id);
      deletedIds.push(id);
    } catch (err) {
      // Skip not found; rethrow other errors
      if (err.statusCode === 404) {
        continue;
      }
      throw err;
    }
  }

  return {
    deletedCount: deletedIds.length,
    deletedIds,
  };
}

module.exports = {
  bulkDelete,
};
