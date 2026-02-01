// plugins/products/model.js
// Robust MVP writer + safe reads (no references to non-existing legacy columns)

class ProductModel {
  constructor(pool) {
    this.pool = pool;
  }

  static TABLE = 'products';

  // ---------- Public API ----------

  async getAll(userId) {
    // VIKTIGT: välj bara kolumner som faktiskt finns i din products-tabell
    const sql = `
      SELECT
        id,
        user_id,
        product_number,
        sku,
        title,
        description,
        status,
        quantity,
        price_amount,
        currency,
        vat_rate,
        main_image,
        images,
        categories,
        brand,
        gtin,
        created_at,
        updated_at
      FROM ${ProductModel.TABLE}
      WHERE user_id = $1
      ORDER BY product_number NULLS LAST, id
    `;
    const result = await this.pool.query(sql, [userId]);
    return result.rows.map((row) => this.transformRow(row));
  }

  async create(userId, productData) {
    const d = this.normalizeInput(productData);

    const sql = `
      INSERT INTO ${ProductModel.TABLE} (
        user_id,
        product_number,
        sku,
        title,
        description,
        status,
        quantity,
        price_amount,
        currency,
        vat_rate,
        main_image,
        images,
        categories,
        brand,
        gtin
      )
      VALUES (
        $1,
        $2,  $3,  $4,  $5,  $6,  $7,
        $8,  $9,  $10, $11, $12, $13, $14, $15
      )
      RETURNING
        id,
        user_id,
        product_number,
        sku,
        title,
        description,
        status,
        quantity,
        price_amount,
        currency,
        vat_rate,
        main_image,
        images,
        categories,
        brand,
        gtin,
        created_at,
        updated_at
    `;

    const params = [
      userId,
      d.productNumber,
      d.sku,
      d.title,
      d.description,
      d.status,
      d.quantity,
      d.priceAmount,
      d.currency,
      d.vatRate,
      d.mainImage,
      JSON.stringify(d.images || []),
      JSON.stringify(d.categories || []),
      d.brand,
      d.gtin,
    ];

    const result = await this.pool.query(sql, params);
    return this.transformRow(result.rows[0]);
  }

  async update(userId, productId, productData) {
    const d = this.normalizeInput(productData);

    const sql = `
      UPDATE ${ProductModel.TABLE}
      SET
        product_number = $1,
        sku            = $2,
        title          = $3,
        description    = $4,
        status         = $5,
        quantity       = $6,
        price_amount   = $7,
        currency       = $8,
        vat_rate       = $9,
        main_image     = $10,
        images         = $11,
        categories     = $12,
        brand          = $13,
        gtin           = $14,
        updated_at     = CURRENT_TIMESTAMP
      WHERE user_id = $15
        AND id::text = $16
      RETURNING
        id,
        user_id,
        product_number,
        sku,
        title,
        description,
        status,
        quantity,
        price_amount,
        currency,
        vat_rate,
        main_image,
        images,
        categories,
        brand,
        gtin,
        created_at,
        updated_at
    `;

    const params = [
      d.productNumber,
      d.sku,
      d.title,
      d.description,
      d.status,
      d.quantity,
      d.priceAmount,
      d.currency,
      d.vatRate,
      d.mainImage,
      JSON.stringify(d.images || []),
      JSON.stringify(d.categories || []),
      d.brand,
      d.gtin,
      userId,
      String(productId),
    ];

    const result = await this.pool.query(sql, params);
    if (!result.rows.length) throw new Error('Product not found');
    return this.transformRow(result.rows[0]);
  }

  async delete(userId, productId) {
    const sql = `
      DELETE FROM ${ProductModel.TABLE}
      WHERE user_id = $1
        AND id::text = $2
      RETURNING id::text AS id
    `;
    const result = await this.pool.query(sql, [userId, String(productId)]);
    if (!result.rows.length) throw new Error('Product not found');
    return { id: result.rows[0].id };
  }

  // Bulk delete – matcha på text så både UUID och int funkar
  async bulkDelete(userId, idsTextArray) {
    const ids = Array.isArray(idsTextArray)
      ? idsTextArray.map((x) => String(x).trim()).filter(Boolean)
      : [];

    if (!ids.length) {
      return { deletedCount: 0, deletedIds: [] };
    }

    const sql = `
      DELETE FROM ${ProductModel.TABLE}
      WHERE user_id = $1
        AND id::text = ANY($2::text[])
      RETURNING id::text AS id
    `;

    const { rows } = await this.pool.query(sql, [userId, ids]);

    return {
      deletedCount: rows.length,
      deletedIds: rows.map((r) => r.id),
    };
  }

  // ---------- Input / Output helpers ----------

  normalizeInput(data = {}) {
    const clean = (v) => {
      if (v === undefined || v === null) return null;
      if (typeof v === 'string') {
        const t = v.trim();
        return t === '' ? null : t;
      }
      return v;
    };

    const productNumberRaw = data.productNumber ?? data.contactNumber ?? null;
    const titleRaw = data.title ?? data.companyName ?? '';

    const toInt = (v, fallback = 0) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return fallback;
      return Math.max(0, Math.trunc(n));
    };

    const toFloat = (v, fallback = 0) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    const currency = String(data.currency ?? 'SEK').toUpperCase().trim();
    const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'SEK';

    return {
      productNumber: clean(productNumberRaw),
      sku: clean(data.sku ?? null),
      title: String(titleRaw ?? '').trim(),
      description: clean(data.description) ?? null,
      status: String(data.status ?? 'for sale'),
      quantity: toInt(data.quantity, 0),
      priceAmount: toFloat(data.priceAmount, 0),
      currency: safeCurrency,
      vatRate: toFloat(data.vatRate, 25),
      mainImage: clean(data.mainImage),
      images: Array.isArray(data.images) ? data.images.filter(Boolean) : [],
      categories: Array.isArray(data.categories) ? data.categories.filter(Boolean) : [],
      brand: clean(data.brand),
      gtin: clean(data.gtin),
    };
  }

  transformRow(row) {
    const parseJsonArray = (v) => {
      if (Array.isArray(v)) return v;
      if (v == null) return [];
      if (typeof v !== 'string') return [];
      try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    };

    const toNumberOr = (v, fallback) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : fallback;
    };

    return {
      id: String(row.id),
      productNumber: row.product_number ?? null,
      sku: row.sku ?? null,
      title: row.title ?? '', // här finns ingen company_name i din DB, så vi faller bara till ''
      description: row.description ?? null,
      status: row.status ?? 'for sale',
      quantity: toNumberOr(row.quantity, 0),
      priceAmount: toNumberOr(row.price_amount, 0),
      currency: row.currency ?? 'SEK',
      vatRate: toNumberOr(row.vat_rate, 25),
      mainImage: row.main_image ?? null,
      images: parseJsonArray(row.images),
      categories: parseJsonArray(row.categories),
      brand: row.brand ?? null,
      gtin: row.gtin ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  }
}

module.exports = ProductModel;
