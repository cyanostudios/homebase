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
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const sql = `
        SELECT
          p.id,
          p.user_id,
          p.sku,
          p.mpn,
          p.title,
          p.description,
          p.status,
          p.quantity,
          p.price_amount,
          p.currency,
          p.vat_rate,
          p.main_image,
          p.images,
          p.categories,
          p.merchant_sku,
          p.brand,
          p.brand_id,
          p.ean,
          p.gtin,
          p.supplier_id,
          p.manufacturer_id,
          p.channel_specific,
          p.purchase_price,
          p.sale_price,
          p.lagerplats,
          p.condition,
          p.group_id,
          p.volume,
          p.volume_unit,
          p.notes,
          p.private_name,
          p.color,
          p.color_text,
          p.size,
          p.size_text,
          p.pattern,
          p.material,
          p.pattern_text,
          p.weight,
          p.length_cm,
          p.width_cm,
          p.height_cm,
          p.depth_cm,
          p.source_created_at,
          p.quantity_sold,
          p.last_sold_at,
          p.created_at,
          p.updated_at,
          b.name AS brand_name,
          s.name AS supplier_name,
          m.name AS manufacturer_name,
          pli.list_id AS list_id,
          l.name AS list_name
        FROM ${ProductModel.TABLE} p
        LEFT JOIN brands b ON b.id = p.brand_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN manufacturers m ON m.id = p.manufacturer_id
        LEFT JOIN product_list_items pli ON pli.product_id = p.id AND pli.user_id = p.user_id
        LEFT JOIN lists l ON l.id = pli.list_id
        WHERE p.user_id = $1
        ORDER BY p.id
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

  async getById(req, productId) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      const id = parseInt(String(productId), 10);
      if (!Number.isFinite(id)) return null;
      const sql = `
        SELECT
          p.id,
          p.user_id,
          p.sku,
          p.mpn,
          p.title,
          p.description,
          p.status,
          p.quantity,
          p.price_amount,
          p.currency,
          p.vat_rate,
          p.main_image,
          p.images,
          p.categories,
          p.merchant_sku,
          p.brand,
          p.brand_id,
          p.ean,
          p.gtin,
          p.supplier_id,
          p.manufacturer_id,
          p.channel_specific,
          p.purchase_price,
          p.sale_price,
          p.lagerplats,
          p.condition,
          p.group_id,
          p.volume,
          p.volume_unit,
          p.notes,
          p.private_name,
          p.color,
          p.color_text,
          p.size,
          p.size_text,
          p.pattern,
          p.material,
          p.pattern_text,
          p.weight,
          p.length_cm,
          p.width_cm,
          p.height_cm,
          p.depth_cm,
          p.created_at,
          p.updated_at,
          b.name AS brand_name,
          s.name AS supplier_name,
          m.name AS manufacturer_name,
          pli.list_id AS list_id,
          l.name AS list_name
        FROM ${ProductModel.TABLE} p
        LEFT JOIN brands b ON b.id = p.brand_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN manufacturers m ON m.id = p.manufacturer_id
        LEFT JOIN product_list_items pli ON pli.product_id = p.id AND pli.user_id = p.user_id
        LEFT JOIN lists l ON l.id = pli.list_id
        WHERE p.user_id = $1 AND p.id = $2
        LIMIT 1
      `;
      const result = await db.query(sql, [userId, id]);
      return result[0] ? this.transformRow(result[0]) : null;
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch product by id', error);
      throw new AppError('Failed to fetch product', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getBySku(req, sku) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const cleanSku = String(sku || '').trim();
      if (!cleanSku) return null;

      const sql = `
        SELECT
          p.id,
          p.user_id,
          p.sku,
          p.mpn,
          p.title,
          p.description,
          p.status,
          p.quantity,
          p.price_amount,
          p.currency,
          p.vat_rate,
          p.main_image,
          p.images,
          p.categories,
          p.merchant_sku,
          p.brand,
          p.brand_id,
          p.ean,
          p.gtin,
          p.supplier_id,
          p.manufacturer_id,
          p.channel_specific,
          p.purchase_price,
          p.sale_price,
          p.lagerplats,
          p.condition,
          p.group_id,
          p.volume,
          p.volume_unit,
          p.notes,
          p.private_name,
          p.color,
          p.color_text,
          p.size,
          p.size_text,
          p.pattern,
          p.material,
          p.pattern_text,
          p.weight,
          p.length_cm,
          p.width_cm,
          p.height_cm,
          p.depth_cm,
          p.source_created_at,
          p.quantity_sold,
          p.last_sold_at,
          p.created_at,
          p.updated_at,
          b.name AS brand_name,
          s.name AS supplier_name,
          m.name AS manufacturer_name,
          pli.list_id AS list_id,
          l.name AS list_name
        FROM ${ProductModel.TABLE} p
        LEFT JOIN brands b ON b.id = p.brand_id
        LEFT JOIN suppliers s ON s.id = p.supplier_id
        LEFT JOIN manufacturers m ON m.id = p.manufacturer_id
        LEFT JOIN product_list_items pli ON pli.product_id = p.id AND pli.user_id = p.user_id
        LEFT JOIN lists l ON l.id = pli.list_id
        WHERE p.user_id = $1
          AND p.sku = $2
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
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const d = this.normalizeInput(productData);

      const sql = `
        INSERT INTO ${ProductModel.TABLE} (
          user_id,
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
          merchant_sku,
          brand_id,
          ean,
          gtin,
          supplier_id,
          manufacturer_id,
          channel_specific,
          purchase_price,
          sale_price,
          lagerplats,
          condition,
          group_id,
          volume,
          volume_unit,
          notes,
          private_name,
          color,
          color_text,
          size,
          size_text,
          pattern,
          material,
          pattern_text,
          weight,
          length_cm,
          width_cm,
          height_cm,
          depth_cm,
          source_created_at,
          quantity_sold,
          last_sold_at
        )
        VALUES (
          $1,
          $2,  $3,  $4,  $5,  $6,  $7,  $8,
          $9,  $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23,
          $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42,
          $43, $44, $45
        )
        RETURNING
          id,
          user_id,
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
          merchant_sku,
          brand_id,
          ean,
          gtin,
          supplier_id,
          manufacturer_id,
          channel_specific,
          purchase_price,
          sale_price,
          lagerplats,
          private_name,
          color,
          color_text,
          size,
          size_text,
          pattern,
          material,
          pattern_text,
          weight,
          length_cm,
          width_cm,
          height_cm,
          depth_cm,
          source_created_at,
          quantity_sold,
          last_sold_at,
          created_at,
          updated_at
      `;

      const params = [
        userId,
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
        d.merchantSku ?? null,
        d.brandId != null ? d.brandId : null,
        d.ean,
        d.gtin,
        d.supplierId != null ? d.supplierId : null,
        d.manufacturerId != null ? d.manufacturerId : null,
        d.channelSpecific != null ? JSON.stringify(d.channelSpecific) : null,
        d.purchasePrice != null ? d.purchasePrice : null,
        d.salePrice != null ? d.salePrice : null,
        d.lagerplats ?? null,
        d.condition ?? 'new',
        d.groupId ?? null,
        d.volume != null ? d.volume : null,
        d.volumeUnit ?? null,
        d.notes ?? null,
        d.privateName ?? null,
        d.color ?? null,
        d.colorText ?? null,
        d.size ?? null,
        d.sizeText ?? null,
        d.pattern ?? null,
        d.material ?? null,
        d.patternText ?? null,
        d.weight != null ? d.weight : null,
        d.lengthCm != null ? d.lengthCm : null,
        d.widthCm != null ? d.widthCm : null,
        d.heightCm != null ? d.heightCm : null,
        d.depthCm != null ? d.depthCm : null,
        d.sourceCreatedAt ?? null,
        d.quantitySold ?? null,
        d.lastSoldAt ?? null,
      ];

      const result = await db.query(sql, params);
      Logger.info('Product created', { productId: result[0].id });
      return this.transformRow(result[0]);
    } catch (error) {
      Logger.error('Failed to create product', error);
      // Unique violation: pg code 23505 (also when wrapped by PostgreSQLAdapter in AppError.details)
      const pgCode = error?.details?.code ?? error?.code;
      if (pgCode === '23505') {
        throw new AppError(
          'En produkt med detta artikelnummer eller streckkod finns redan',
          409,
          AppError.CODES.CONFLICT,
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to create product', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, productId, productData) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const d = this.normalizeInput(productData);

      const sql = `
        UPDATE ${ProductModel.TABLE}
        SET
          sku            = $1,
          mpn            = $2,
          merchant_sku   = $3,
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
          brand_id       = $15,
          ean            = $16,
          gtin           = $17,
          supplier_id    = $18,
          manufacturer_id = $19,
          channel_specific = $20,
          purchase_price = $21,
          sale_price     = $22,
          lagerplats     = $23,
          condition      = $24,
          group_id       = $25,
          volume         = $26,
          volume_unit    = $27,
          notes          = $28,
          private_name   = $29,
          color          = $30,
          color_text     = $31,
          size           = $32,
          size_text      = $33,
          pattern        = $34,
          material       = $35,
          pattern_text   = $36,
          weight         = $37,
          length_cm      = $38,
          width_cm       = $39,
          height_cm      = $40,
          depth_cm       = $41,
          source_created_at = $42,
          quantity_sold     = $43,
          last_sold_at      = $44,
          updated_at     = CURRENT_TIMESTAMP
        WHERE user_id = $45
          AND id::text = $46
        RETURNING
          id,
          user_id,
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
          merchant_sku,
          brand_id,
          ean,
          gtin,
          supplier_id,
          manufacturer_id,
          channel_specific,
          purchase_price,
          sale_price,
          lagerplats,
          private_name,
          color,
          color_text,
          size,
          size_text,
          pattern,
          material,
          pattern_text,
          weight,
          length_cm,
          width_cm,
          height_cm,
          depth_cm,
          source_created_at,
          quantity_sold,
          last_sold_at,
          created_at,
          updated_at
      `;

      const params = [
        d.sku,
        d.mpn,
        d.merchantSku ?? null,
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
        d.brandId != null ? d.brandId : null,
        d.ean,
        d.gtin,
        d.supplierId != null ? d.supplierId : null,
        d.manufacturerId != null ? d.manufacturerId : null,
        d.channelSpecific != null ? JSON.stringify(d.channelSpecific) : null,
        d.purchasePrice != null ? d.purchasePrice : null,
        d.salePrice != null ? d.salePrice : null,
        d.lagerplats ?? null,
        d.condition ?? 'new',
        d.groupId ?? null,
        d.volume != null ? d.volume : null,
        d.volumeUnit ?? null,
        d.notes ?? null,
        d.privateName ?? null,
        d.color ?? null,
        d.colorText ?? null,
        d.size ?? null,
        d.sizeText ?? null,
        d.pattern ?? null,
        d.material ?? null,
        d.patternText ?? null,
        d.weight != null ? d.weight : null,
        d.lengthCm != null ? d.lengthCm : null,
        d.widthCm != null ? d.widthCm : null,
        d.heightCm != null ? d.heightCm : null,
        d.depthCm != null ? d.depthCm : null,
        d.sourceCreatedAt ?? null,
        d.quantitySold ?? null,
        d.lastSoldAt ?? null,
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
        throw new AppError(
          'En produkt med detta artikelnummer eller streckkod finns redan',
          409,
          AppError.CODES.CONFLICT,
        );
      }
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to update product', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getProductStats(req, productId, range = '30d') {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const pid = String(productId).trim();
      if (!pid) return { soldCount: 0, bestChannel: null, activeTargetsCount: 0, timeline: [] };

      // Verify product belongs to user
      const prodCheck = await db.query(
        `SELECT id FROM ${ProductModel.TABLE} WHERE user_id = $1 AND id::text = $2 LIMIT 1`,
        [userId, pid],
      );
      if (!prodCheck.length) {
        throw new AppError('Product not found', 404, AppError.CODES.NOT_FOUND);
      }

      // Date filter for range
      let dateFilter = '';
      if (range === '7d') {
        dateFilter = "AND o.placed_at >= CURRENT_DATE - INTERVAL '7 days'";
      } else if (range === '30d') {
        dateFilter = "AND o.placed_at >= CURRENT_DATE - INTERVAL '30 days'";
      } else if (range === '3m') {
        dateFilter = "AND o.placed_at >= CURRENT_DATE - INTERVAL '3 months'";
      }
      // 'all' = no date filter

      const productIdCondition = isNumId
        ? 'oi.product_id = $2::int'
        : '(oi.product_id::text = $2 OR oi.sku IN (SELECT sku FROM products WHERE user_id = $1 AND id::text = $2 LIMIT 1))';

      const soldSql = `
        SELECT COALESCE(SUM(oi.quantity), 0)::int AS sold_count
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.user_id = $1
        WHERE (oi.product_id::text = $2 OR (oi.product_id IS NULL AND oi.sku IN (SELECT sku FROM products WHERE user_id = $1 AND id::text = $2 LIMIT 1)))
        ${dateFilter}
      `;
      const soldRes = await db.query(soldSql, [userId, pid]);
      const soldCount = Number(soldRes[0]?.sold_count) || 0;

      const bestChannelSql = `
        SELECT o.channel, SUM(oi.quantity)::int AS qty
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.user_id = $1
        WHERE (oi.product_id::text = $2 OR (oi.product_id IS NULL AND oi.sku IN (SELECT sku FROM products WHERE user_id = $1 AND id::text = $2 LIMIT 1)))
        ${dateFilter}
        GROUP BY o.channel
        ORDER BY qty DESC
        LIMIT 1
      `;
      const bestRes = await db.query(bestChannelSql, [userId, pid]);
      const bestChannel = bestRes[0]?.channel || null;

      const targetsRes = await db.query(
        `SELECT COUNT(*)::int AS c FROM channel_product_map WHERE user_id = $1 AND product_id = $2 AND (enabled = TRUE OR external_id IS NOT NULL)`,
        [userId, pid],
      );
      const activeTargetsCount = Number(targetsRes[0]?.c) || 0;

      const timelineSql = `
        SELECT o.channel, o.channel_order_id, oi.quantity, o.placed_at
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id AND o.user_id = $1
        WHERE (oi.product_id::text = $2 OR (oi.product_id IS NULL AND oi.sku IN (SELECT sku FROM products WHERE user_id = $1 AND id::text = $2 LIMIT 1)))
        ${dateFilter}
        ORDER BY o.placed_at DESC NULLS LAST
        LIMIT 50
      `;
      const timelineRows = await db.query(timelineSql, [userId, pid]);
      const timeline = (timelineRows || []).map((r) => ({
        type: 'sale',
        channel: r.channel,
        orderId: r.channel_order_id,
        quantity: Number(r.quantity) || 0,
        placedAt: r.placed_at,
      }));

      return {
        soldCount,
        bestChannel,
        activeTargetsCount,
        timeline,
      };
    } catch (error) {
      Logger.error('Failed to get product stats', error);
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to get product stats', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, productId) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;

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
        await db.query(`DELETE FROM channel_product_map WHERE user_id = $1 AND product_id = $2`, [
          userId,
          String(productId),
        ]);
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
      const userId = req.session?.user?.id;

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
      const userId = req.session?.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);
      }

      const ids = Array.isArray(idsTextArray)
        ? idsTextArray.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (!ids.length) return { updatedCount: 0, updatedIds: [] };

      const allowed = {
        price_amount: ['priceAmount', (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined)],
        quantity: [
          'quantity',
          (v) => (Number.isFinite(Number(v)) ? Math.max(0, Math.trunc(Number(v))) : undefined),
        ],
        status: [
          'status',
          (v) => (['for sale', 'draft', 'archived'].includes(String(v)) ? String(v) : undefined),
        ],
        vat_rate: ['vatRate', (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined)],
        currency: [
          'currency',
          (v) => (/^[A-Z]{3}$/.test(String(v).trim()) ? String(v).trim().toUpperCase() : undefined),
        ],
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

  async upsertFromSelloProduct(
    req,
    {
      sku,
      privateName,
      merchantSku,
      title,
      description,
      quantity,
      priceAmount,
      vatRate,
      mainImage,
      images,
      categories,
      channelSpecific,
      ean,
      gtin,
      brand,
      brandId,
      manufacturerId,
      purchasePrice,
      color,
      colorText,
      size,
      sizeText,
      material,
      pattern,
      patternText,
      lagerplats,
      condition,
      groupId,
      volume,
      volumeUnit,
      weight,
      notes,
      sourceCreatedAt,
      quantitySold,
      lastSoldAt,
    },
  ) {
    try {
      const db = Database.get(req);
      const userId = req.session?.user?.id;
      if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

      const cleanSku = String(sku || '').trim();
      if (!cleanSku)
        throw new AppError('Sello product id missing', 400, AppError.CODES.VALIDATION_ERROR);
      const cleanTitle = String(title || '').trim();
      if (!cleanTitle)
        throw new AppError('Sello product title missing', 400, AppError.CODES.VALIDATION_ERROR);

      const existing = await this.getBySku(req, cleanSku);
      const existingChannelSpecific =
        existing?.channelSpecific &&
        typeof existing.channelSpecific === 'object' &&
        !Array.isArray(existing.channelSpecific)
          ? existing.channelSpecific
          : null;
      let nextChannelSpecific = existingChannelSpecific;
      if (channelSpecific !== undefined) {
        if (channelSpecific === null) {
          nextChannelSpecific = null;
        } else if (typeof channelSpecific === 'object' && !Array.isArray(channelSpecific)) {
          const merged = { ...(existingChannelSpecific || {}) };
          for (const [k, v] of Object.entries(channelSpecific)) {
            if (v && typeof v === 'object' && !Array.isArray(v)) {
              const prev = merged[k];
              merged[k] =
                prev && typeof prev === 'object' && !Array.isArray(prev)
                  ? { ...prev, ...v }
                  : { ...v };
            } else {
              merged[k] = v;
            }
          }
          nextChannelSpecific = Object.keys(merged).length ? merged : null;
        }
      }

      const payload = {
        sku: cleanSku,
        privateName: privateName != null ? String(privateName).trim() : null,
        merchantSku: merchantSku != null ? String(merchantSku).trim() : null,
        title: cleanTitle,
        description: description != null ? String(description) : '',
        status: 'for sale',
        quantity: Number.isFinite(Number(quantity))
          ? Math.max(0, Math.trunc(Number(quantity)))
          : existing
            ? Number(existing.quantity) || 0
            : 0,
        priceAmount: Number.isFinite(Number(priceAmount))
          ? Number(priceAmount)
          : existing
            ? Number(existing.priceAmount) || 0
            : 0,
        currency: existing?.currency ? String(existing.currency) : 'SEK',
        vatRate: Number.isFinite(Number(vatRate))
          ? Number(vatRate)
          : existing
            ? Number(existing.vatRate) || 25
            : 25,
        mainImage: mainImage != null ? String(mainImage) : null,
        images: Array.isArray(images) ? images : [],
        categories: Array.isArray(categories)
          ? categories.map((x) => String(x || '').trim()).filter(Boolean)
          : existing?.categories || [],
        mpn: merchantSku != null && String(merchantSku).trim() ? String(merchantSku).trim() : null,
        channelSpecific: nextChannelSpecific,
        ean: ean != null ? String(ean).trim() || null : undefined,
        gtin: gtin != null ? String(gtin).trim() || null : undefined,
        brand: brand != null ? String(brand).trim() || null : undefined,
        brandId: brandId != null ? String(brandId).trim() || null : undefined,
        manufacturerId:
          manufacturerId != null && Number.isFinite(Number(manufacturerId))
            ? Number(manufacturerId)
            : undefined,
        purchasePrice:
          purchasePrice != null && Number.isFinite(Number(purchasePrice))
            ? Number(purchasePrice)
            : undefined,
        color: color != null ? String(color).trim() || null : undefined,
        colorText:
          colorText === undefined
            ? undefined
            : colorText != null
              ? String(colorText).trim() || null
              : null,
        size: size != null ? String(size).trim() || null : undefined,
        sizeText: sizeText != null ? String(sizeText).trim() || null : undefined,
        material: material != null ? String(material).trim() || null : undefined,
        pattern: pattern != null ? String(pattern).trim() || null : undefined,
        patternText: patternText != null ? String(patternText).trim() || null : undefined,
        lagerplats: lagerplats != null ? String(lagerplats).trim() || null : undefined,
        condition:
          condition === 'new' || condition === 'used'
            ? condition
            : condition != null
              ? String(condition).trim().toLowerCase() === 'used'
                ? 'used'
                : 'new'
              : undefined,
        groupId: groupId != null ? String(groupId).trim() || null : undefined,
        volume: volume != null && Number.isFinite(Number(volume)) ? Number(volume) : undefined,
        volumeUnit: volumeUnit != null ? String(volumeUnit).trim() || null : undefined,
        weight: weight != null && Number.isFinite(Number(weight)) ? Number(weight) : undefined,
        notes: notes != null ? String(notes).trim() || null : undefined,
        privateName: privateName != null ? String(privateName).trim() || null : undefined,
      };

      const payloadClean = { ...payload };
      [
        'brand',
        'brandId',
        'manufacturerId',
        'ean',
        'gtin',
        'purchasePrice',
        'color',
        'colorText',
        'size',
        'sizeText',
        'material',
        'pattern',
        'patternText',
        'lagerplats',
        'condition',
        'groupId',
        'volume',
        'volumeUnit',
        'weight',
        'notes',
        'privateName',
        'sourceCreatedAt',
        'quantitySold',
        'lastSoldAt',
      ].forEach((k) => {
        if (payloadClean[k] === undefined) delete payloadClean[k];
      });

      if (!existing) {
        const created = await this.create(req, payloadClean);
        return { created: true, product: created };
      }

      const updated = await this.update(req, existing.id, {
        ...existing,
        ...payloadClean,
      });
      return { created: false, product: updated };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to upsert Sello product', error);
      throw new AppError('Failed to upsert Sello product', 500, AppError.CODES.DATABASE_ERROR);
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

    const currency = String(data.currency ?? 'SEK')
      .toUpperCase()
      .trim();
    const safeCurrency = /^[A-Z]{3}$/.test(currency) ? currency : 'SEK';

    const sku = clean(data.sku ?? null);
    const merchantSkuVal = clean(data.merchantSku ?? data.merchant_sku ?? null);
    const mpnRaw = clean(data.mpn ?? null);
    const eanRaw = clean(data.ean ?? null);
    const gtinRaw = clean(data.gtin ?? null);

    const channelSpecific =
      data.channelSpecific === undefined || data.channelSpecific === null
        ? null
        : typeof data.channelSpecific === 'object' && !Array.isArray(data.channelSpecific)
          ? data.channelSpecific
          : null;

    return {
      sku,
      mpn: mpnRaw || merchantSkuVal,
      title: String(titleRaw ?? '').trim(),
      description: clean(data.description) ?? null,
      status: String(data.status ?? 'for sale'),
      quantity: toInt(data.quantity, 0),
      priceAmount: toFloat(data.priceAmount, 0),
      purchasePrice: data.purchasePrice != null ? toFloat(data.purchasePrice, null) : null,
      salePrice: data.salePrice != null ? toFloat(data.salePrice, null) : null,
      currency: safeCurrency,
      vatRate: toFloat(data.vatRate, 25),
      mainImage: clean(data.mainImage),
      images: Array.isArray(data.images) ? data.images.filter(Boolean) : [],
      categories: Array.isArray(data.categories) ? data.categories.filter(Boolean) : [],
      brand: clean(data.brand),
      merchantSku: merchantSkuVal,
      brandId:
        data.brandId != null
          ? Number.isFinite(Number(data.brandId))
            ? Number(data.brandId)
            : null
          : null,
      ean: eanRaw,
      gtin: gtinRaw,
      supplierId:
        data.supplierId != null
          ? Number.isFinite(Number(data.supplierId))
            ? Number(data.supplierId)
            : null
          : null,
      manufacturerId:
        data.manufacturerId != null
          ? Number.isFinite(Number(data.manufacturerId))
            ? Number(data.manufacturerId)
            : null
          : null,
      lagerplats: clean(data.lagerplats) || null,
      condition: clean(data.condition) || 'new',
      groupId: clean(data.groupId ?? data.group_id ?? null),
      volume: data.volume != null ? toFloat(data.volume, null) : null,
      volumeUnit: clean(data.volumeUnit ?? data.volume_unit ?? null),
      notes: clean(data.notes) || null,
      privateName: clean(data.privateName ?? data.private_name ?? null),
      channelSpecific,
      color: clean(data.color),
      colorText: clean(data.colorText),
      size: clean(data.size),
      sizeText: clean(data.sizeText),
      pattern: clean(data.pattern),
      material: clean(data.material),
      patternText: clean(data.patternText ?? data.pattern_text),
      weight: data.weight != null ? toFloat(data.weight, null) : null,
      lengthCm: data.lengthCm != null ? toFloat(data.lengthCm, null) : null,
      widthCm: data.widthCm != null ? toFloat(data.widthCm, null) : null,
      heightCm: data.heightCm != null ? toFloat(data.heightCm, null) : null,
      depthCm: data.depthCm != null ? toFloat(data.depthCm, null) : null,
      sourceCreatedAt:
        data.sourceCreatedAt != null ? String(data.sourceCreatedAt).trim() || null : null,
      quantitySold:
        data.quantitySold != null && Number.isFinite(Number(data.quantitySold))
          ? Number(data.quantitySold)
          : null,
      lastSoldAt: data.lastSoldAt != null ? String(data.lastSoldAt).trim() || null : null,
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
      sku: row.sku ?? null,
      merchantSku: row.merchant_sku ?? null,
      mpn: row.mpn ?? null,
      privateName: row.private_name ?? null,
      title: row.title ?? '',
      description: row.description ?? null,
      status: row.status ?? 'for sale',
      quantity: toNumberOr(row.quantity, 0),
      priceAmount: toNumberOr(row.price_amount, 0),
      purchasePrice: row.purchase_price != null ? toNumberOr(row.purchase_price, null) : null,
      salePrice: row.sale_price != null ? toNumberOr(row.sale_price, null) : null,
      currency: row.currency ?? 'SEK',
      vatRate: toNumberOr(row.vat_rate, 25),
      mainImage: row.main_image ?? null,
      images: parseJsonArray(row.images),
      categories: parseJsonArray(row.categories),
      brand: row.brand_name ?? row.brand ?? null,
      brandId: row.brand_id != null ? String(row.brand_id) : null,
      ean: row.ean ?? null,
      gtin: row.gtin ?? null,
      supplierId: row.supplier_id != null ? String(row.supplier_id) : null,
      supplierName: row.supplier_name ?? null,
      manufacturerId: row.manufacturer_id != null ? String(row.manufacturer_id) : null,
      manufacturerName: row.manufacturer_name ?? null,
      lagerplats: row.lagerplats ?? null,
      condition: row.condition ?? 'new',
      groupId: row.group_id ?? null,
      volume: row.volume != null ? toNumberOr(row.volume, null) : null,
      volumeUnit: row.volume_unit ?? null,
      notes: row.notes ?? null,
      channelSpecific: channelSpecificObj,
      color: row.color ?? null,
      colorText: row.color_text ?? null,
      size: row.size ?? null,
      sizeText: row.size_text ?? null,
      pattern: row.pattern ?? null,
      material: row.material ?? null,
      patternText: row.pattern_text ?? null,
      weight: row.weight != null ? toNumberOr(row.weight, null) : null,
      lengthCm: row.length_cm != null ? toNumberOr(row.length_cm, null) : null,
      widthCm: row.width_cm != null ? toNumberOr(row.width_cm, null) : null,
      heightCm: row.height_cm != null ? toNumberOr(row.height_cm, null) : null,
      depthCm: row.depth_cm != null ? toNumberOr(row.depth_cm, null) : null,
      sourceCreatedAt: row.source_created_at ?? null,
      quantitySold: row.quantity_sold != null ? Number(row.quantity_sold) : null,
      lastSoldAt: row.last_sold_at ?? null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      listId: row.list_id != null ? String(row.list_id) : null,
      listName: row.list_name ?? null,
    };
  }

  async setProductList(req, productId, listId) {
    const db = Database.get(req);
    const userId = req.session?.user?.id;
    if (!userId) throw new AppError('User not authenticated', 401, AppError.CODES.UNAUTHORIZED);

    const product = await this.getById(req, productId);
    if (!product) throw new AppError('Product not found', 404, AppError.CODES.NOT_FOUND);

    await db.query(`DELETE FROM product_list_items WHERE user_id = $1 AND product_id = $2`, [
      userId,
      productId,
    ]);
    if (listId != null && String(listId).trim() !== '') {
      await db.insert('product_list_items', {
        list_id: parseInt(String(listId), 10),
        product_id: parseInt(productId, 10),
      });
    }
    return this.getById(req, productId);
  }
}

module.exports = ProductModel;
