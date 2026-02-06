// plugins/products/model.js
// Robust MVP writer + safe reads (no references to non-existing legacy columns)
// Uses @homebase/core SDK for database access with automatic tenant isolation

const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class ProductModel {
  static TABLE = 'products';

  // ---------- Public API ----------

  async getAll(req) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      // VIKTIGT: välj bara kolumner som faktiskt finns i din products-tabell
      const sql = `
        SELECT
          id,
          user_id,
          product_number,
          sku,
          mpn,
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
          channel_specific,
          created_at,
          updated_at
        FROM ${ProductModel.TABLE}
        WHERE user_id = $1
        ORDER BY product_number NULLS LAST, id
      `;
      const result = await db.query(sql, [userId]);
      return result.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch products', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch products', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getBySku(req, sku) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const cleanSku = String(sku || '').trim();
      if (!cleanSku) return null;

      const sql = `
        SELECT
          id,
          user_id,
          product_number,
          sku,
          mpn,
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
          channel_specific,
          created_at,
          updated_at
        FROM ${ProductModel.TABLE}
        WHERE user_id = $1
          AND sku = $2
        LIMIT 1
      `;
      const result = await db.query(sql, [userId, cleanSku]);
      return result[0] ? this.transformRow(result[0]) : null;
    } catch (error) {
      Logger.error('Failed to fetch product by SKU', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch product by SKU', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, productData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const d = this.normalizeInput(productData);

      const sql = `
        INSERT INTO ${ProductModel.TABLE} (
          user_id,
          product_number,
          sku,
          mpn,
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
          $2,  $3,  $4,  $5,  $6,  $7,  $8,
          $9,  $10, $11, $12, $13, $14, $15, $16
        )
        RETURNING
          id,
          user_id,
          product_number,
          sku,
          mpn,
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
        d.mpn,
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

      const result = await db.query(sql, params);
      Logger.info('Product created', { productId: result[0].id });
      return this.transformRow(result[0]);
    } catch (error) {
      Logger.error('Failed to create product', error);
      // Unique violation: pg code 23505 (also when wrapped by PostgreSQLAdapter in AppError.details)
      const pgCode = error?.details?.code ?? error?.code;
      if (pgCode === '23505') {
        throw new AppError('En produkt med detta artikelnummer eller streckkod finns redan', 409, AppError.CODES.CONFLICT);
      }
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create product', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, productId, productData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const d = this.normalizeInput(productData);

      const sql = `
        UPDATE ${ProductModel.TABLE}
        SET
          product_number = $1,
          sku            = $2,
          mpn            = $3,
          title          = $4,
          description    = $5,
          status         = $6,
          quantity       = $7,
          price_amount   = $8,
          currency       = $9,
          vat_rate       = $10,
          main_image     = $11,
          images         = $12,
          categories     = $13,
          brand          = $14,
          gtin           = $15,
          updated_at     = CURRENT_TIMESTAMP
        WHERE user_id = $16
          AND id::text = $17
        RETURNING
          id,
          user_id,
          product_number,
          sku,
          mpn,
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
        d.mpn,
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

      const result = await db.query(sql, params);
      if (!result.length) {
        throw new AppError('Product not found', 404, AppError.CODES.NOT_FOUND);
      }
      Logger.info('Product updated', { productId });
      return this.transformRow(result[0]);
    } catch (error) {
      Logger.error('Failed to update product', error);
      const pgCode = error?.details?.code ?? error?.code;
      if (pgCode === '23505') {
        throw new AppError('En produkt med detta artikelnummer eller streckkod finns redan', 409, AppError.CODES.CONFLICT);
      }
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update product', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, productId) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const sql = `
        DELETE FROM ${ProductModel.TABLE}
        WHERE user_id = $1
          AND id::text = $2
        RETURNING id::text AS id
      `;
      const result = await db.query(sql, [userId, String(productId)]);
      if (!result.length) {
        throw new AppError('Product not found', 404, AppError.CODES.NOT_FOUND);
      }

      // Cleanup dependent channel mappings (avoid orphan rows)
      try {
        await db.query(
          `DELETE FROM channel_product_map WHERE user_id = $1 AND product_id = $2`,
          [userId, String(productId)],
        );
      } catch (_err) {
        // Non-fatal cleanup; keep primary delete semantics
        void _err;
      }

      Logger.info('Product deleted', { productId });
      return { id: result[0].id };
    } catch (error) {
      Logger.error('Failed to delete product', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete product', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Bulk delete – matcha på text så både UUID och int funkar
  async bulkDelete(req, idsTextArray) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

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

      const rows = await db.query(sql, [userId, ids]);

      // Cleanup dependent channel mappings for deleted products
      if (rows.length) {
        try {
          const deletedIds = rows.map((r) => r.id);
          await db.query(
            `DELETE FROM channel_product_map WHERE user_id = $1 AND product_id = ANY($2::text[])`,
            [userId, deletedIds],
          );
        } catch (_err) {
          void _err;
        }
      }

      Logger.info('Products bulk deleted', { count: rows.length });
      return {
        deletedCount: rows.length,
        deletedIds: rows.map((r) => r.id),
      };
    } catch (error) {
      Logger.error('Failed to bulk delete products', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete products', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /** Batch update: apply same updates to multiple products. Allowed keys: priceAmount, quantity, status, vatRate, currency. */
  async batchUpdate(req, idsTextArray, updates = {}) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id || req.session?.user?.uuid;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ids = Array.isArray(idsTextArray)
        ? idsTextArray.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (!ids.length) return { updatedCount: 0, updatedIds: [] };

      const allowed = {
        price_amount: ['priceAmount', (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined)],
        quantity: ['quantity', (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : undefined)],
        status: ['status', (v) => (['for sale', 'draft', 'archived'].includes(String(v)) ? String(v) : undefined)],
        vat_rate: ['vatRate', (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined)],
        currency: ['currency', (v) => (/^[A-Z]{3}$/.test(String(v).trim()) ? String(v).trim().toUpperCase() : undefined)],
      };

      const setParts = [];
      const params = [];
      let idx = 1;
      for (const [col, [key, fn]] of Object.entries(allowed)) {
        if (updates[key] === undefined) continue;
        const val = fn(updates[key]);
        if (val === undefined) continue;
        setParts.push(`${col} = $${idx}`);
        params.push(val);
        idx += 1;
      }
      if (setParts.length === 0) {
        return { updatedCount: 0, updatedIds: [] };
      }
      setParts.push('updated_at = CURRENT_TIMESTAMP');
      params.push(userId, ids);
      const sql = `
        UPDATE ${ProductModel.TABLE}
        SET ${setParts.join(', ')}
        WHERE user_id = $${idx} AND id::text = ANY($${idx + 1}::text[])
        RETURNING id::text AS id
      `;
      const rows = await db.query(sql, params);
      Logger.info('Products batch updated', { count: rows.length });
      return { updatedCount: rows.length, updatedIds: rows.map((r) => r.id) };
    } catch (error) {
      Logger.error('Failed to batch update products', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to batch update products', 500, AppError.CODES.DATABASE_ERROR);
    }
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

    const sku = clean(data.sku ?? null);
    const mpnRaw = clean(data.mpn ?? null);

    return {
      productNumber: clean(productNumberRaw),
      sku,
      // If mpn isn't provided, default to sku (keeps connectors happy).
      mpn: mpnRaw || sku,
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

    const channelSpecific = row.channel_specific;
    const channelSpecificObj =
      channelSpecific != null && typeof channelSpecific === 'object'
        ? channelSpecific
        : typeof channelSpecific === 'string'
          ? (() => {
            try {
              return JSON.parse(channelSpecific);
            } catch {
              return null;
            }
          })()
          : null;

    return {
      id: String(row.id),
      productNumber: row.product_number ?? null,
      sku: row.sku ?? null,
      mpn: row.mpn ?? null,
      title: row.title ?? '',
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
      channelSpecific: channelSpecificObj,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
    };
  }
}

module.exports = ProductModel;
