const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class TemplateModel {
  constructor() {
    this.table = 'your_items';
  }

  async getAll(req) {
    try {
      const db = Database.get(req);
      const sql = `
        SELECT *
        FROM ${this.table}
        ORDER BY updated_at DESC
      `;
      const rows = await db.query(sql, []);
      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch your-items', error);
      throw new AppError('Failed to fetch items', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const record = await db.insert(this.table, {
        title: data.title,
        description: data.description ?? null,
      });
      Logger.info('Your item created', { itemId: record.id });
      return this.transformRow(record);
    } catch (error) {
      Logger.error('Failed to create your-item', error);
      throw new AppError('Failed to create item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, itemId, data) {
    try {
      const db = Database.get(req);
      const sql = `
        UPDATE ${this.table}
        SET
          title = $1,
          description = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const rows = await db.query(sql, [data.title, data.description ?? null, itemId]);
      if (!rows.length) {
        throw new AppError('Item not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Your item updated', { itemId });
      return this.transformRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to update your-item', error, { itemId });
      throw new AppError('Failed to update item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, itemId) {
    try {
      const db = Database.get(req);
      const sql = `
        DELETE FROM ${this.table}
        WHERE id = $1
        RETURNING id
      `;
      const rows = await db.query(sql, [itemId]);
      if (!rows.length) {
        throw new AppError('Item not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Your item deleted', { itemId });
      return { id: itemId };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to delete your-item', error, { itemId });
      throw new AppError('Failed to delete item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      description: row.description ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = TemplateModel;
