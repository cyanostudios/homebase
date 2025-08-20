// plugins/products/model.js
// Clean MVP writer: stop persisting legacy contact-like columns.
// Still orders by COALESCE(product_number, contact_number) for legacy rows.

class ProductModel {
  constructor(pool) {
    this.pool = pool;
  }

  async getAll(userId) {
    const result = await this.pool.query(
      `SELECT * FROM products
       WHERE user_id = $1
       ORDER BY product_number NULLS LAST, id`,
      [userId]
    );
    return result.rows.map(this.transformRow);
  }
  

  async create(userId, productData) {
    const d = this.normalizeInput(productData);

    const result = await this.pool.query(
      `
      INSERT INTO products (
        user_id,
        product_number, sku, title, description, status, quantity,
        price_amount, currency, vat_rate, main_image, images, categories, brand, gtin
      ) VALUES (
        $1,
        $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING *
      `,
      [
        userId,
        d.productNumber, d.sku, d.title, d.description, d.status, d.quantity,
        d.priceAmount, d.currency, d.vatRate, d.mainImage,
        JSON.stringify(d.images || []), JSON.stringify(d.categories || []),
        d.brand, d.gtin
      ]
    );

    return this.transformRow(result.rows[0]);
  }

  async update(userId, productId, productData) {
    const d = this.normalizeInput(productData);

    const result = await this.pool.query(
      `
      UPDATE products SET
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
      WHERE id = $15 AND user_id = $16
      RETURNING *
      `,
      [
        d.productNumber, d.sku, d.title, d.description, d.status, d.quantity,
        d.priceAmount, d.currency, d.vatRate, d.mainImage,
        JSON.stringify(d.images || []), JSON.stringify(d.categories || []),
        d.brand, d.gtin,
        productId, userId
      ]
    );

    if (!result.rows.length) throw new Error('Product not found');
    return this.transformRow(result.rows[0]);
  }

  async delete(userId, productId) {
    const result = await this.pool.query(
      'DELETE FROM products WHERE id = $1 AND user_id = $2 RETURNING id',
      [productId, userId]
    );
    if (!result.rows.length) throw new Error('Product not found');
    return { id: productId };
  }

  // Accept legacy inputs as fallbacks but only persist MVP columns

normalizeInput(data = {}) {
  // Normalize empties -> null
  const clean = (v) => (typeof v === 'string' && v.trim() === '' ? null : v);

  const productNumberRaw = data.productNumber ?? data.contactNumber ?? null;
  const productNumber = clean(productNumberRaw);

  const title = data.title ?? data.companyName ?? '';

  const skuRaw = data.sku ?? null;
  const sku = clean(skuRaw);

  return {
    productNumber,
    sku,
    title,
    description: clean(data.description) ?? null,
    status: data.status ?? 'for sale',
    quantity: Number.isFinite(data.quantity) ? Number(data.quantity) : 0,
    priceAmount: Number.isFinite(data.priceAmount) ? Number(data.priceAmount) : 0,
    currency: (data.currency ?? 'SEK').toUpperCase(),
    vatRate: Number.isFinite(data.vatRate) ? Number(data.vatRate) : 25,
    mainImage: clean(data.mainImage),
    images: Array.isArray(data.images) ? data.images : [],
    categories: Array.isArray(data.categories) ? data.categories : [],
    brand: clean(data.brand),
    gtin: clean(data.gtin),
  };
}


  transformRow(row) {
    const parseJson = (v) => {
      if (Array.isArray(v)) return v;
      if (v == null) return [];
      try { return typeof v === 'string' ? JSON.parse(v) : v; }
      catch { return []; }
    };

    return {
      id: String(row.id),
      productNumber: row.product_number ?? null,
      sku: row.sku ?? null,
      title: row.title ?? row.company_name ?? '', // fallback for legacy rows
      description: row.description ?? null,
      status: row.status ?? 'for sale',
      quantity: row.quantity ?? 0,
      priceAmount: row.price_amount != null ? Number(row.price_amount) : 0,
      currency: row.currency ?? 'SEK',
      vatRate: row.vat_rate != null ? Number(row.vat_rate) : 25,
      mainImage: row.main_image ?? null,
      images: parseJson(row.images),
      categories: parseJson(row.categories),
      brand: row.brand ?? null,
      gtin: row.gtin ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

module.exports = ProductModel;
