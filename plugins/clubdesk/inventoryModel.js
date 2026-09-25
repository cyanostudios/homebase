// plugins/clubdesk/inventoryModel.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const PUBLICATION_STATUSES = ['draft', 'published'];
const DEFAULT_CURRENCY = 'SEK';
const MAX_IMPORT_ITEMS = 200;

function parseJsonb(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Trim, drop empties, case-insensitive dedupe; cap length. */
function normalizeInventoryTags(raw, max = 50) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const tag = item.trim().slice(0, 100);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= max) break;
  }
  return out;
}

function slugifyBase(raw) {
  const base = String(raw ?? '')
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 240);
  return base || 'item';
}

class InventoryModel {
  constructor() {
    this.table = 'clubdesk_inventory_items';
    this.variantsTable = 'clubdesk_inventory_variants';
  }

  normalizePurchasePrice(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    if (Number.isNaN(num) || num < 0) return null;
    return Math.round(num * 100) / 100;
  }

  normalizeCurrency(value) {
    const code = String(value ?? DEFAULT_CURRENCY)
      .trim()
      .toUpperCase();
    if (!code || code.length > 10) return DEFAULT_CURRENCY;
    return code;
  }

  normalizeVariantInput(data, sortOrderFallback = 0) {
    return {
      sku: String(data.sku ?? '').trim(),
      audience: String(data.audience ?? '').trim(),
      color: String(data.color ?? '').trim(),
      size: String(data.size ?? '').trim(),
      quantity: Math.max(0, parseInt(String(data.quantity ?? 0), 10) || 0),
      sortOrder:
        data.sortOrder != null || data.sort_order != null
          ? parseInt(String(data.sortOrder ?? data.sort_order), 10) || 0
          : sortOrderFallback,
    };
  }

  normalizePublicationStatus(raw, fallback = 'draft') {
    if (raw === undefined || raw === null || raw === '') return fallback;
    const status = String(raw);
    if (!PUBLICATION_STATUSES.includes(status)) {
      throw new AppError(
        `publicationStatus must be one of: ${PUBLICATION_STATUSES.join(', ')}`,
        400,
        AppError.CODES.VALIDATION_ERROR,
        [
          {
            field: 'publicationStatus',
            message: `publicationStatus must be one of: ${PUBLICATION_STATUSES.join(', ')}`,
          },
        ],
      );
    }
    return status;
  }

  normalizeFeatured(raw) {
    return raw === true || raw === 'true' || raw === 1 || raw === '1';
  }

  /**
   * @param {object} data
   * @param {{ partial?: boolean, existing?: object }} options
   */
  normalizeItemFields(data, { partial = false, existing = null } = {}) {
    const out = {};

    if (!partial || data.articleName !== undefined || data.article_name !== undefined) {
      const articleName = String(data.articleName ?? data.article_name ?? '').trim();
      if (!articleName) {
        throw new AppError('articleName is required', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'articleName', message: 'articleName is required' },
        ]);
      }
      if (articleName.length > 255) {
        throw new AppError(
          'articleName must not exceed 255 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'articleName', message: 'articleName must not exceed 255 characters' }],
        );
      }
      out.articleName = articleName;
    }

    if (!partial || data.brand !== undefined) {
      out.brand = String(data.brand ?? '').trim();
      if (out.brand.length > 255) {
        throw new AppError(
          'brand must not exceed 255 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'brand', message: 'brand must not exceed 255 characters' }],
        );
      }
    }

    if (!partial || data.description !== undefined) {
      out.description =
        data.description === undefined || data.description === null || data.description === ''
          ? null
          : String(data.description);
    }

    if (!partial || data.material !== undefined) {
      out.material = String(data.material ?? '').trim();
    }

    if (!partial || data.purchasePrice !== undefined || data.purchase_price !== undefined) {
      out.purchasePrice = this.normalizePurchasePrice(data.purchasePrice ?? data.purchase_price);
    }

    if (!partial || data.recommendedPrice !== undefined || data.recommended_price !== undefined) {
      out.recommendedPrice = this.normalizePurchasePrice(
        data.recommendedPrice ?? data.recommended_price,
      );
    }

    if (!partial || data.salePrice !== undefined || data.sale_price !== undefined) {
      out.salePrice = this.normalizePurchasePrice(data.salePrice ?? data.sale_price);
    }

    if (!partial || data.currency !== undefined) {
      out.currency = this.normalizeCurrency(data.currency);
    }

    if (!partial || data.comment !== undefined) {
      out.comment =
        data.comment === undefined || data.comment === null || data.comment === ''
          ? null
          : String(data.comment).trim() || null;
    }

    if (!partial || data.tags !== undefined) {
      out.tags = normalizeInventoryTags(data.tags);
    }

    if (!partial || data.slug !== undefined) {
      let slug = String(data.slug ?? '').trim();
      if (!slug && !partial) {
        const nameForSlug =
          out.articleName ||
          String(data.articleName ?? data.article_name ?? existing?.articleName ?? '').trim();
        slug = slugifyBase(nameForSlug);
      }
      if (!slug) {
        throw new AppError('slug is required', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'slug', message: 'slug is required' },
        ]);
      }
      if (slug.length > 255) {
        throw new AppError(
          'slug must not exceed 255 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'slug', message: 'slug must not exceed 255 characters' }],
        );
      }
      out.slug = slug;
    }

    if (!partial || data.featuredImageUrl !== undefined || data.featured_image_url !== undefined) {
      const raw =
        data.featuredImageUrl !== undefined ? data.featuredImageUrl : data.featured_image_url;
      out.featuredImageUrl =
        raw === undefined || raw === null || String(raw).trim() === '' ? null : String(raw).trim();
    }

    if (!partial || data.publicationStatus !== undefined || data.publication_status !== undefined) {
      const raw =
        data.publicationStatus !== undefined ? data.publicationStatus : data.publication_status;
      out.publicationStatus = this.normalizePublicationStatus(raw, partial ? undefined : 'draft');
      if (out.publicationStatus === undefined && existing) {
        out.publicationStatus = existing.publicationStatus;
      }
      if (!partial && out.publicationStatus === undefined) {
        out.publicationStatus = 'draft';
      }
    }

    if (!partial || data.featured !== undefined) {
      out.featured = this.normalizeFeatured(data.featured);
    }

    return out;
  }

  async queryChild(dbOrTx, sql, params) {
    if (typeof dbOrTx.getPool === 'function') {
      const result = await dbOrTx.getPool().query(sql, params);
      return result.rows;
    }
    return dbOrTx.query(sql, params);
  }

  async nextSortOrder(dbOrTx, userId) {
    const rows = await dbOrTx.query(
      `
        SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next
        FROM ${this.table}
        WHERE user_id = $1
      `,
      [userId],
    );
    return Number(rows[0]?.next ?? 1);
  }

  async assertSlugUnique(dbOrTx, userId, slug, excludeId = null) {
    const params = [userId, slug];
    let sql = `
      SELECT id FROM ${this.table}
      WHERE user_id = $1 AND lower(slug) = lower($2)
    `;
    if (excludeId != null) {
      sql += ' AND id <> $3';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const rows = await dbOrTx.query(sql, params);
    if (rows.length > 0) {
      throw new AppError(
        'An inventory item with this slug already exists',
        409,
        AppError.CODES.CONFLICT,
        [{ field: 'slug', message: 'An inventory item with this slug already exists' }],
      );
    }
  }

  async ensureUniqueSlug(dbOrTx, userId, desiredSlug, excludeId = null) {
    let slug = slugifyBase(desiredSlug);
    let attempt = 0;
    while (attempt < 50) {
      const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`.slice(0, 255);
      const params = [userId, candidate];
      let sql = `
        SELECT id FROM ${this.table}
        WHERE user_id = $1 AND lower(slug) = lower($2)
      `;
      if (excludeId != null) {
        sql += ' AND id <> $3';
        params.push(excludeId);
      }
      sql += ' LIMIT 1';
      const rows = await dbOrTx.query(sql, params);
      if (!rows.length) return candidate;
      attempt += 1;
    }
    throw new AppError('Could not allocate a unique slug', 409, AppError.CODES.CONFLICT, [
      { field: 'slug', message: 'Could not allocate a unique slug' },
    ]);
  }

  transformVariantRow(row) {
    return {
      id: String(row.id),
      itemId: String(row.item_id),
      sku: row.sku ?? '',
      audience: row.audience ?? '',
      color: row.color ?? '',
      size: row.size ?? '',
      quantity: row.quantity != null ? Number(row.quantity) : 0,
      sortOrder: row.sort_order != null ? Number(row.sort_order) : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  attachVariants(item, variants) {
    const list = Array.isArray(variants) ? variants : [];
    const totalQuantity = list.reduce((sum, v) => sum + (Number(v.quantity) || 0), 0);
    return {
      ...item,
      variants: list,
      totalQuantity,
      variantCount: list.length,
    };
  }

  transformInventoryRow(row) {
    const parseMoney = (raw) => {
      if (raw === undefined || raw === null || raw === '') return null;
      const num = typeof raw === 'number' ? raw : parseFloat(String(raw));
      return Number.isNaN(num) ? null : num;
    };
    return {
      id: String(row.id),
      articleName: row.article_name ?? '',
      brand: row.brand ?? '',
      description: row.description ?? null,
      material: row.material ?? '',
      purchasePrice: parseMoney(row.purchase_price),
      recommendedPrice: parseMoney(row.recommended_price),
      salePrice: parseMoney(row.sale_price),
      currency: row.currency ?? DEFAULT_CURRENCY,
      comment: row.comment ?? null,
      tags: normalizeInventoryTags(parseJsonb(row.tags, [])),
      slug: row.slug ?? '',
      featuredImageUrl: row.featured_image_url ?? null,
      publicationStatus: row.publication_status ?? 'draft',
      featured: row.featured === true || row.featured === 't' || row.featured === 'true',
      sortOrder: row.sort_order != null ? Number(row.sort_order) : 1,
      variants: [],
      totalQuantity: 0,
      variantCount:
        row.variant_count !== null && row.variant_count !== undefined
          ? Number(row.variant_count)
          : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getVariantsForItem(dbOrTx, itemId) {
    const rows = await this.queryChild(
      dbOrTx,
      `
        SELECT * FROM ${this.variantsTable}
        WHERE item_id = $1
        ORDER BY sort_order ASC, id ASC
      `,
      [itemId],
    );
    return rows.map((row) => this.transformVariantRow(row));
  }

  async syncVariants(dbOrTx, itemId, variantsInput) {
    const normalized = (Array.isArray(variantsInput) ? variantsInput : []).map((row, index) => {
      const base = this.normalizeVariantInput(row, index);
      const rowId =
        row.id != null && String(row.id).trim() !== '' ? parseInt(String(row.id), 10) : null;
      return {
        id: Number.isNaN(rowId) ? null : rowId,
        ...base,
      };
    });

    const existing = await this.getVariantsForItem(dbOrTx, itemId);
    const keepIds = new Set(normalized.filter((v) => v.id != null).map((v) => String(v.id)));
    for (const old of existing) {
      if (!keepIds.has(String(old.id))) {
        await this.queryChild(
          dbOrTx,
          `DELETE FROM ${this.variantsTable} WHERE id = $1 AND item_id = $2`,
          [parseInt(old.id, 10), itemId],
        );
      }
    }

    for (let i = 0; i < normalized.length; i += 1) {
      const variant = normalized[i];
      if (variant.id != null) {
        const rows = await this.queryChild(
          dbOrTx,
          `
          UPDATE ${this.variantsTable} SET
            sku = $1,
            audience = $2,
            color = $3,
            size = $4,
            quantity = $5,
            sort_order = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7 AND item_id = $8
          RETURNING id
          `,
          [
            variant.sku,
            variant.audience,
            variant.color,
            variant.size,
            variant.quantity,
            i,
            variant.id,
            itemId,
          ],
        );
        if (!rows.length) {
          await this.queryChild(
            dbOrTx,
            `
            INSERT INTO ${this.variantsTable}
              (item_id, sku, audience, color, size, quantity, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            `,
            [
              itemId,
              variant.sku,
              variant.audience,
              variant.color,
              variant.size,
              variant.quantity,
              i,
            ],
          );
        }
      } else {
        await this.queryChild(
          dbOrTx,
          `
          INSERT INTO ${this.variantsTable}
            (item_id, sku, audience, color, size, quantity, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [itemId, variant.sku, variant.audience, variant.color, variant.size, variant.quantity, i],
        );
      }
    }

    await dbOrTx.query(`UPDATE ${this.table} SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
      itemId,
    ]);
  }

  async getAll(req) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const rows = await db.query(
        `
          SELECT
            i.*,
            COALESCE(v.cnt, 0)::int AS variant_count
          FROM ${this.table} i
          LEFT JOIN (
            SELECT item_id, COUNT(*)::int AS cnt
            FROM ${this.variantsTable}
            GROUP BY item_id
          ) v ON v.item_id = i.id
          WHERE i.user_id = $1
          ORDER BY
            i.sort_order ASC NULLS LAST,
            lower(i.article_name) ASC,
            lower(i.brand) ASC,
            i.id ASC
        `,
        [userId],
      );
      const items = rows.map((row) => this.transformInventoryRow(row));
      if (!items.length) return items;

      const ids = items.map((item) => parseInt(item.id, 10));
      const variantRows = await this.queryChild(
        db,
        `
          SELECT * FROM ${this.variantsTable}
          WHERE item_id = ANY($1::int[])
          ORDER BY sort_order ASC, id ASC
        `,
        [ids],
      );
      const byItem = new Map();
      for (const row of variantRows) {
        const key = String(row.item_id);
        if (!byItem.has(key)) byItem.set(key, []);
        byItem.get(key).push(this.transformVariantRow(row));
      }
      return items.map((item) => this.attachVariants(item, byItem.get(item.id) || []));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch clubdesk inventory', error);
      throw new AppError('Failed to fetch inventory', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, itemId) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const id = parseInt(String(itemId), 10);
      if (Number.isNaN(id)) return null;
      const rows = await db.query(`SELECT * FROM ${this.table} WHERE id = $1 AND user_id = $2`, [
        id,
        userId,
      ]);
      if (!rows.length) return null;
      const item = this.transformInventoryRow(rows[0]);
      const variants = await this.getVariantsForItem(db, id);
      return this.attachVariants(item, variants);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to get clubdesk inventory item', error, { itemId });
      throw new AppError('Failed to get inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const fields = this.normalizeItemFields(data, { partial: false });
      fields.slug = await this.ensureUniqueSlug(db, userId, fields.slug);
      const sortOrder = await this.nextSortOrder(db, userId);
      const variants = Array.isArray(data.variants) ? data.variants : [];

      const created = await db.transaction(async (tx) => {
        const parentRows = await tx.query(
          `
            INSERT INTO ${this.table} (
              user_id,
              article_name,
              brand,
              description,
              material,
              purchase_price,
              recommended_price,
              sale_price,
              currency,
              comment,
              tags,
              slug,
              featured_image_url,
              publication_status,
              featured,
              sort_order
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
              $12, $13, $14, $15, $16
            )
            RETURNING *
          `,
          [
            userId,
            fields.articleName,
            fields.brand ?? '',
            fields.description ?? null,
            fields.material ?? '',
            fields.purchasePrice ?? null,
            fields.recommendedPrice ?? null,
            fields.salePrice ?? null,
            fields.currency ?? DEFAULT_CURRENCY,
            fields.comment ?? null,
            JSON.stringify(fields.tags ?? []),
            fields.slug,
            fields.featuredImageUrl ?? null,
            fields.publicationStatus ?? 'draft',
            fields.featured === true,
            sortOrder,
          ],
        );
        const parent = parentRows[0];
        if (variants.length) {
          await this.syncVariants(tx, parent.id, variants);
        }
        return parent;
      });

      Logger.info('Clubdesk inventory item created', { itemId: created.id });
      return this.getById(req, created.id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') throw error;
      Logger.error('Failed to create clubdesk inventory item', error);
      throw new AppError('Failed to create inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, itemId, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = parseInt(String(itemId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }

      const existing = await this.getById(req, id);
      if (!existing) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }

      const fields = this.normalizeItemFields(data, { partial: true, existing });
      const nextArticleName = fields.articleName ?? existing.articleName;
      const nextBrand = fields.brand !== undefined ? fields.brand : existing.brand;
      const nextDescription =
        fields.description !== undefined ? fields.description : existing.description;
      const nextMaterial = fields.material !== undefined ? fields.material : existing.material;
      const nextPurchasePrice =
        fields.purchasePrice !== undefined ? fields.purchasePrice : existing.purchasePrice;
      const nextRecommendedPrice =
        fields.recommendedPrice !== undefined ? fields.recommendedPrice : existing.recommendedPrice;
      const nextSalePrice = fields.salePrice !== undefined ? fields.salePrice : existing.salePrice;
      const nextCurrency = fields.currency !== undefined ? fields.currency : existing.currency;
      const nextComment = fields.comment !== undefined ? fields.comment : existing.comment;
      const nextTags = fields.tags !== undefined ? fields.tags : existing.tags;
      let nextSlug = fields.slug !== undefined ? fields.slug : existing.slug;
      if (fields.slug !== undefined) {
        nextSlug = await this.ensureUniqueSlug(db, userId, nextSlug, id);
      }
      const nextFeaturedImageUrl =
        fields.featuredImageUrl !== undefined ? fields.featuredImageUrl : existing.featuredImageUrl;
      const nextPublicationStatus =
        fields.publicationStatus !== undefined
          ? fields.publicationStatus
          : existing.publicationStatus;
      const nextFeatured =
        fields.featured !== undefined ? fields.featured : existing.featured === true;

      await db.query(
        `
          UPDATE ${this.table} SET
            article_name = $1,
            brand = $2,
            description = $3,
            material = $4,
            purchase_price = $5,
            recommended_price = $6,
            sale_price = $7,
            currency = $8,
            comment = $9,
            tags = $10::jsonb,
            slug = $11,
            featured_image_url = $12,
            publication_status = $13,
            featured = $14,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $15 AND user_id = $16
        `,
        [
          nextArticleName,
          nextBrand,
          nextDescription,
          nextMaterial,
          nextPurchasePrice,
          nextRecommendedPrice,
          nextSalePrice,
          nextCurrency,
          nextComment,
          JSON.stringify(nextTags ?? []),
          nextSlug,
          nextFeaturedImageUrl,
          nextPublicationStatus,
          nextFeatured === true,
          id,
          userId,
        ],
      );

      if (Array.isArray(data.variants)) {
        await this.syncVariants(db, id, data.variants);
      }

      return this.getById(req, id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') throw error;
      Logger.error('Failed to update clubdesk inventory item', error, { itemId });
      throw new AppError('Failed to update inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, itemId) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const id = parseInt(String(itemId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const rows = await db.query(
        `DELETE FROM ${this.table} WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId],
      );
      if (!rows.length) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete clubdesk inventory item', error, { itemId });
      throw new AppError('Failed to delete inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createVariant(req, itemId, data) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(itemId), 10);
      const item = await this.getById(req, id);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const maxOrder = await this.queryChild(
        db,
        `SELECT COALESCE(MAX(sort_order), -1) AS m FROM ${this.variantsTable} WHERE item_id = $1`,
        [id],
      );
      const variant = this.normalizeVariantInput(data, (maxOrder[0]?.m ?? -1) + 1);
      const rows = await this.queryChild(
        db,
        `
          INSERT INTO ${this.variantsTable}
            (item_id, sku, audience, color, size, quantity, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [
          id,
          variant.sku,
          variant.audience,
          variant.color,
          variant.size,
          variant.quantity,
          variant.sortOrder,
        ],
      );
      await db.query(`UPDATE ${this.table} SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [id]);
      return this.transformVariantRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') throw error;
      Logger.error('Failed to create clubdesk inventory variant', error, { itemId });
      throw new AppError('Failed to create variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateVariant(req, itemId, variantId, data) {
    try {
      const db = Database.get(req);
      const lid = parseInt(String(itemId), 10);
      const vid = parseInt(String(variantId), 10);
      const item = await this.getById(req, lid);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const existingRows = await this.queryChild(
        db,
        `SELECT * FROM ${this.variantsTable} WHERE id = $1 AND item_id = $2`,
        [vid, lid],
      );
      if (!existingRows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      const existing = existingRows[0];
      const nextSku = data.sku !== undefined ? String(data.sku ?? '').trim() : (existing.sku ?? '');
      const nextAudience =
        data.audience !== undefined
          ? String(data.audience ?? '').trim()
          : (existing.audience ?? '');
      const nextColor =
        data.color !== undefined ? String(data.color ?? '').trim() : (existing.color ?? '');
      const nextSize =
        data.size !== undefined ? String(data.size ?? '').trim() : (existing.size ?? '');
      const nextQuantity =
        data.quantity !== undefined
          ? Math.max(0, parseInt(String(data.quantity), 10) || 0)
          : existing.quantity;
      const nextSort =
        data.sortOrder !== undefined || data.sort_order !== undefined
          ? parseInt(String(data.sortOrder ?? data.sort_order), 10) || 0
          : existing.sort_order;

      const rows = await this.queryChild(
        db,
        `
          UPDATE ${this.variantsTable} SET
            sku = $1,
            audience = $2,
            color = $3,
            size = $4,
            quantity = $5,
            sort_order = $6,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $7 AND item_id = $8
          RETURNING *
        `,
        [nextSku, nextAudience, nextColor, nextSize, nextQuantity, nextSort, vid, lid],
      );
      await db.query(`UPDATE ${this.table} SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        lid,
      ]);
      return this.transformVariantRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') throw error;
      Logger.error('Failed to update clubdesk inventory variant', error, { itemId, variantId });
      throw new AppError('Failed to update variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async updateVariantQuantity(req, itemId, variantId, quantity) {
    try {
      const db = Database.get(req);
      const lid = parseInt(String(itemId), 10);
      const vid = parseInt(String(variantId), 10);
      const nextQuantity = Math.max(0, parseInt(String(quantity), 10) || 0);
      const item = await this.getById(req, lid);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const rows = await this.queryChild(
        db,
        `
          UPDATE ${this.variantsTable} SET
            quantity = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2 AND item_id = $3
          RETURNING *
        `,
        [nextQuantity, vid, lid],
      );
      if (!rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      await db.query(`UPDATE ${this.table} SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        lid,
      ]);
      return this.transformVariantRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update clubdesk inventory variant quantity', error, {
        itemId,
        variantId,
      });
      throw new AppError('Failed to update variant quantity', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteVariant(req, itemId, variantId) {
    try {
      const db = Database.get(req);
      const lid = parseInt(String(itemId), 10);
      const vid = parseInt(String(variantId), 10);
      const item = await this.getById(req, lid);
      if (!item) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      const rows = await this.queryChild(
        db,
        `DELETE FROM ${this.variantsTable} WHERE id = $1 AND item_id = $2 RETURNING id`,
        [vid, lid],
      );
      if (!rows.length) {
        throw new AppError('Variant not found', 404, AppError.CODES.NOT_FOUND);
      }
      await db.query(`UPDATE ${this.table} SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [
        lid,
      ]);
      return true;
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete clubdesk inventory variant', error, { itemId, variantId });
      throw new AppError('Failed to delete variant', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  /**
   * Batch create from tabular import payloads.
   * @returns {{ successCount: number, failureCount: number, failures: Array<{ index: number, message: string }> }}
   */
  async importItems(req, itemsInput) {
    if (!Array.isArray(itemsInput)) {
      throw new AppError('items must be an array', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'items', message: 'items must be an array' },
      ]);
    }
    if (itemsInput.length > MAX_IMPORT_ITEMS) {
      throw new AppError(
        `items must not exceed ${MAX_IMPORT_ITEMS} entries`,
        400,
        AppError.CODES.VALIDATION_ERROR,
        [{ field: 'items', message: `items must not exceed ${MAX_IMPORT_ITEMS} entries` }],
      );
    }

    let successCount = 0;
    const failures = [];

    for (let i = 0; i < itemsInput.length; i += 1) {
      try {
        await this.create(req, itemsInput[i] || {});
        successCount += 1;
      } catch (error) {
        const message =
          error instanceof AppError
            ? error.message
            : error?.code === '23505'
              ? 'Unique constraint violated'
              : 'Failed to import item';
        failures.push({ index: i, message });
      }
    }

    return {
      successCount,
      failureCount: failures.length,
      failures,
    };
  }
}

module.exports = InventoryModel;
module.exports.normalizeInventoryTags = normalizeInventoryTags;
module.exports.slugifyBase = slugifyBase;
module.exports.MAX_IMPORT_ITEMS = MAX_IMPORT_ITEMS;
