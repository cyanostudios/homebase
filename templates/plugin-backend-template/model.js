// templates/plugin-backend-template/model.js
// TEMPLATE: Copy to plugins/<your-plugin>/ and replace all TODOs.
// Uses @homebase/core SDK for service abstraction and tenant isolation.

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class TemplateModel {
  constructor() {
    // No pool needed - SDK provides database interface
  }

  // TODO: Set your table name (snake_case). Prefer explicit string here.
  // Example: 'my_items' / 'custom_data'
  static TABLE = 'rename_me_table';

  // TODO: Set your default ORDER BY column (e.g., 'id' or 'product_number')
  static ORDER_BY = 'id';

  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic - no user_id needed
      const sql = `
        SELECT *
        FROM ${TemplateModel.TABLE}
        ORDER BY ${TemplateModel.ORDER_BY}
      `;

      const result = await db.query(sql, []);
      return result.rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch items', error);
      throw new AppError('Failed to fetch items', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);

      // TODO: Replace with your real schema columns.
      // Use db.insert for automatic tenant isolation
      const result = await db.insert(TemplateModel.TABLE, {
        // TODO: Add your columns here
        // title: data.title || '',
        // status: data.status || 'draft',
        // quantity: data.quantity || 0,
      });

      Logger.info('Item created', { itemId: result.id });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create item', error, {
        data: {
          /* TODO: Add relevant fields for logging */
        },
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, itemId, data) {
    try {
      const db = Database.get(req);

      // TODO: Replace SET clause with your real columns.
      // Tenant isolation automatic - no user_id needed
      const sql = `
        UPDATE ${TemplateModel.TABLE}
        SET
          /* TODO: your_column_1 = $1,
                  your_column_2 = $2, */
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $X /* TODO: replace X with the next param index */
        RETURNING *
      `;

      // TODO: Build params in same order as SET placeholders, then id at the end.
      const params = [
        // e.g. data.title, data.status,
        /* $X */ itemId,
      ];

      const result = await db.query(sql, params);

      if (!result.rows.length) {
        throw new AppError('Item not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Item updated', { itemId });

      return this.transformRow(result.rows[0]);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      Logger.error('Failed to update item', error, { itemId });
      throw new AppError('Failed to update item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, itemId) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic
      const sql = `
        DELETE FROM ${TemplateModel.TABLE}
        WHERE id = $1
        RETURNING id
      `;

      const result = await db.query(sql, [itemId]);

      if (!result.rows.length) {
        throw new AppError('Item not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Item deleted', { itemId });

      return { id: itemId };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      Logger.error('Failed to delete item', error, { itemId });
      throw new AppError('Failed to delete item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Map DB row -> API shape (camelCase). Keep this function and edit mappings only.
  transformRow(row) {
    // TODO: Replace with explicit mappings to your API contract.
    // For a quick start, you can pass-through and add normalized fields later.
    return {
      id: String(row.id),
      // example mappings (remove if not applicable):
      // productNumber: row.product_number ?? null,
      // title: row.title ?? '',
      // status: row.status ?? 'draft',
      // quantity: Number(row.quantity ?? 0),
      // createdAt/updatedAt should be returned as-is (string or Date; frontend normalizes if needed)
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      // Provide the raw row for debugging while templating (remove in real plugin)
      _raw: row,
    };
  }
}

module.exports = TemplateModel;
