// templates/plugin-backend-template/model.js
// TEMPLATE: Copy to plugins/<your-plugin>/ and replace all TODOs.
// Keep this structure identical to Contacts to match Homebase patterns.

const config = require('./plugin.config');

class TemplateModel {
  constructor(pool) {
    this.pool = pool;
  }

  // TODO: Set your table name (snake_case). Prefer explicit string here.
  // Example: 'woocommerce_products' / 'fyndiq_articles'
  static TABLE = 'rename_me_table';

  // TODO: Set your default ORDER BY column (e.g., 'id' or 'product_number')
  static ORDER_BY = 'id';

  async getAll(userId) {
    const sql = `
      SELECT *
      FROM ${TemplateModel.TABLE}
      WHERE user_id = $1
      ORDER BY ${TemplateModel.ORDER_BY}
    `;
    const result = await this.pool.query(sql, [userId]);
    return result.rows.map(this.transformRow);
  }

  async create(userId, data) {
    // TODO: Replace column list + values with your real schema.
    // Keep user_id and timestamps to match platform conventions.
    const sql = `
      INSERT INTO ${TemplateModel.TABLE} (
        user_id,
        /* TODO: your_column_1, your_column_2, ... */
        created_at, updated_at
      ) VALUES (
        $1,
        /* TODO: $2, $3, ... */
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;

    // TODO: Build params array to match your columns above.
    const params = [
      userId,
      // e.g. data.title, data.status, ...
    ];

    const result = await this.pool.query(sql, params);
    return this.transformRow(result.rows[0]);
  }

  async update(userId, itemId, data) {
    // TODO: Replace SET clause with your real columns.
    const sql = `
      UPDATE ${TemplateModel.TABLE}
      SET
        /* TODO: your_column_1 = $1,
                your_column_2 = $2, */
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $X /* TODO: replace X with the next param index */
        AND user_id = $Y /* TODO: replace Y with the next param index */
      RETURNING *
    `;

    // TODO: Build params in same order as SET placeholders, then ids at the end.
    const params = [
      // e.g. data.title, data.status,
      /* $X */ itemId,
      /* $Y */ userId,
    ];

    const result = await this.pool.query(sql, params);
    if (!result.rows.length) throw new Error('Item not found');
    return this.transformRow(result.rows[0]);
  }

  async delete(userId, itemId) {
    const sql = `
      DELETE FROM ${TemplateModel.TABLE}
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await this.pool.query(sql, [itemId, userId]);
    if (!result.rows.length) throw new Error('Item not found');
    return { id: itemId };
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
