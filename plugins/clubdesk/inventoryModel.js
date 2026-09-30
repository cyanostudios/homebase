// plugins/clubdesk/inventoryModel.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

const GTIN_DIGITS = /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/;
const PUBLICATION_STATUSES = ['draft', 'published'];
const DEFAULT_CURRENCY = 'SEK';
const MAX_IMPORT_ITEMS = 200;

/** Empty, or 8/12/13/14 digits after spaces are removed. */
function normalizeGtin(value) {
  const raw = String(value ?? '').replace(/\s+/g, '');
  if (!raw) return '';
  if (!GTIN_DIGITS.test(raw)) {
    throw new AppError(
      'GTIN must be 8, 12, 13, or 14 digits',
      400,
      AppError.CODES.VALIDATION_ERROR,
    );
  }
  return raw;
}

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
      gtin: normalizeGtin(data.gtin),
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

  normalizePublicationStatus(raw, fallback = 'published') {
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

  normalizeCatalogText(value, { allowNull = false } = {}) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return allowNull ? null : '';
    return String(value).trim();
  }

  normalizeNutritionNumeric(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const num = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
    return Number.isNaN(num) ? null : num;
  }

  normalizeVerifiedAtDate(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    const raw = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      throw new AppError('verifiedAt must be YYYY-MM-DD', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'verifiedAt', message: 'verifiedAt must be YYYY-MM-DD' },
      ]);
    }
    return raw;
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
      out.publicationStatus = this.normalizePublicationStatus(
        raw,
        partial ? undefined : 'published',
      );
      if (out.publicationStatus === undefined && existing) {
        out.publicationStatus = existing.publicationStatus;
      }
      if (!partial && out.publicationStatus === undefined) {
        out.publicationStatus = 'published';
      }
    }

    if (!partial || data.featured !== undefined) {
      out.featured = false;
    }

    if (!partial || data.catalogKey !== undefined || data.catalog_key !== undefined) {
      const raw = data.catalogKey !== undefined ? data.catalogKey : data.catalog_key;
      if (raw !== undefined) {
        const next = String(raw ?? '').trim();
        const existingKey = String(existing?.catalogKey ?? existing?.catalog_key ?? '').trim();
        if (partial && existingKey && next && next !== existingKey) {
          throw new AppError(
            'catalogKey cannot be changed once set',
            409,
            AppError.CODES.CONFLICT,
            [{ field: 'catalogKey', message: 'catalogKey cannot be changed once set' }],
          );
        }
        out.catalogKey = next;
      } else if (!partial) {
        out.catalogKey = '';
      }
    }

    const catalogTextFields = [
      ['category', 'category'],
      ['packageSize', 'package_size'],
      ['packageUnit', 'package_unit'],
      ['articleNumber', 'article_number'],
      ['netContent', 'net_content'],
      ['countryOfOrigin', 'country_of_origin'],
      ['countryOfManufacture', 'country_of_manufacture'],
      ['supplier', 'supplier'],
      ['dataStatus', 'data_status'],
    ];
    for (const [camel, snake] of catalogTextFields) {
      if (!partial || data[camel] !== undefined || data[snake] !== undefined) {
        const raw = data[camel] !== undefined ? data[camel] : data[snake];
        if (raw !== undefined) {
          out[camel] = this.normalizeCatalogText(raw);
        } else if (!partial) {
          out[camel] = '';
        }
      }
    }

    if (!partial || data.source !== undefined || data.catalog_source !== undefined) {
      const raw = data.source !== undefined ? data.source : data.catalog_source;
      if (raw !== undefined) {
        out.source = this.normalizeCatalogText(raw);
      } else if (!partial) {
        out.source = '';
      }
    }

    if (!partial || data.ingredients !== undefined) {
      out.ingredients = this.normalizeCatalogText(data.ingredients, { allowNull: true });
    }
    if (!partial || data.allergens !== undefined) {
      out.allergens = this.normalizeCatalogText(data.allergens, { allowNull: true });
    }

    if (!partial || data.gtin !== undefined) {
      out.gtin = normalizeGtin(data.gtin ?? '');
    }

    const nutritionMap = [
      ['energyKcal100g', 'energy_kcal_100g'],
      ['fatG100g', 'fat_g_100g'],
      ['saturatedFatG100g', 'saturated_fat_g_100g'],
      ['carbohydrateG100g', 'carbohydrate_g_100g'],
      ['sugarG100g', 'sugar_g_100g'],
      ['proteinG100g', 'protein_g_100g'],
      ['saltG100g', 'salt_g_100g'],
    ];
    for (const [camel, snake] of nutritionMap) {
      if (!partial || data[camel] !== undefined || data[snake] !== undefined) {
        const raw = data[camel] !== undefined ? data[camel] : data[snake];
        if (raw !== undefined) {
          out[camel] = this.normalizeNutritionNumeric(raw);
        } else if (!partial) {
          out[camel] = null;
        }
      }
    }

    if (!partial || data.verifiedAt !== undefined || data.verified_at !== undefined) {
      const raw = data.verifiedAt !== undefined ? data.verifiedAt : data.verified_at;
      if (raw !== undefined) {
        out.verifiedAt = this.normalizeVerifiedAtDate(raw);
      } else if (!partial) {
        out.verifiedAt = null;
      }
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
      gtin: row.gtin ?? '',
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
    const parseNutrition = (raw) => {
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
      catalogKey: row.catalog_key ?? '',
      category: row.category ?? '',
      packageSize: row.package_size ?? '',
      packageUnit: row.package_unit ?? '',
      gtin: row.gtin ?? '',
      articleNumber: row.article_number ?? '',
      ingredients: row.ingredients ?? null,
      allergens: row.allergens ?? null,
      energyKcal100g: parseNutrition(row.energy_kcal_100g),
      fatG100g: parseNutrition(row.fat_g_100g),
      saturatedFatG100g: parseNutrition(row.saturated_fat_g_100g),
      carbohydrateG100g: parseNutrition(row.carbohydrate_g_100g),
      sugarG100g: parseNutrition(row.sugar_g_100g),
      proteinG100g: parseNutrition(row.protein_g_100g),
      saltG100g: parseNutrition(row.salt_g_100g),
      netContent: row.net_content ?? '',
      countryOfOrigin: row.country_of_origin ?? '',
      countryOfManufacture: row.country_of_manufacture ?? '',
      supplier: row.supplier ?? '',
      source: row.catalog_source ?? '',
      verifiedAt: row.verified_at ?? null,
      dataStatus: row.data_status ?? '',
      publicationStatus: row.publication_status ?? 'published',
      featured: row.featured === true || row.featured === 't' || row.featured === 'true',
      archivedAt: row.archived_at ?? null,
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
            gtin = $2,
            audience = $3,
            color = $4,
            size = $5,
            quantity = $6,
            sort_order = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8 AND item_id = $9
          RETURNING id
          `,
          [
            variant.sku,
            variant.gtin,
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
              (item_id, sku, gtin, audience, color, size, quantity, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              itemId,
              variant.sku,
              variant.gtin,
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
            (item_id, sku, gtin, audience, color, size, quantity, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            itemId,
            variant.sku,
            variant.gtin,
            variant.audience,
            variant.color,
            variant.size,
            variant.quantity,
            i,
          ],
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
              sort_order,
              catalog_key,
              category,
              package_size,
              package_unit,
              gtin,
              article_number,
              ingredients,
              allergens,
              energy_kcal_100g,
              fat_g_100g,
              saturated_fat_g_100g,
              carbohydrate_g_100g,
              sugar_g_100g,
              protein_g_100g,
              salt_g_100g,
              net_content,
              country_of_origin,
              country_of_manufacture,
              supplier,
              catalog_source,
              verified_at,
              data_status
            )
            VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb,
              $12, $13, $14, $15, $16,
              $17, $18, $19, $20, $21, $22, $23, $24,
              $25, $26, $27, $28, $29, $30, $31,
              $32, $33, $34, $35, $36, $37, $38
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
            fields.publicationStatus ?? 'published',
            fields.featured === true,
            sortOrder,
            fields.catalogKey ?? '',
            fields.category ?? '',
            fields.packageSize ?? '',
            fields.packageUnit ?? '',
            fields.gtin ?? '',
            fields.articleNumber ?? '',
            fields.ingredients ?? null,
            fields.allergens ?? null,
            fields.energyKcal100g ?? null,
            fields.fatG100g ?? null,
            fields.saturatedFatG100g ?? null,
            fields.carbohydrateG100g ?? null,
            fields.sugarG100g ?? null,
            fields.proteinG100g ?? null,
            fields.saltG100g ?? null,
            fields.netContent ?? '',
            fields.countryOfOrigin ?? '',
            fields.countryOfManufacture ?? '',
            fields.supplier ?? '',
            fields.source ?? '',
            fields.verifiedAt ?? null,
            fields.dataStatus ?? '',
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
      const nextCatalogKey =
        fields.catalogKey !== undefined ? fields.catalogKey : existing.catalogKey;
      const nextCategory = fields.category !== undefined ? fields.category : existing.category;
      const nextPackageSize =
        fields.packageSize !== undefined ? fields.packageSize : existing.packageSize;
      const nextPackageUnit =
        fields.packageUnit !== undefined ? fields.packageUnit : existing.packageUnit;
      const nextGtin = fields.gtin !== undefined ? fields.gtin : existing.gtin;
      const nextArticleNumber =
        fields.articleNumber !== undefined ? fields.articleNumber : existing.articleNumber;
      const nextIngredients =
        fields.ingredients !== undefined ? fields.ingredients : existing.ingredients;
      const nextAllergens = fields.allergens !== undefined ? fields.allergens : existing.allergens;
      const nextEnergyKcal100g =
        fields.energyKcal100g !== undefined ? fields.energyKcal100g : existing.energyKcal100g;
      const nextFatG100g = fields.fatG100g !== undefined ? fields.fatG100g : existing.fatG100g;
      const nextSaturatedFatG100g =
        fields.saturatedFatG100g !== undefined
          ? fields.saturatedFatG100g
          : existing.saturatedFatG100g;
      const nextCarbohydrateG100g =
        fields.carbohydrateG100g !== undefined
          ? fields.carbohydrateG100g
          : existing.carbohydrateG100g;
      const nextSugarG100g =
        fields.sugarG100g !== undefined ? fields.sugarG100g : existing.sugarG100g;
      const nextProteinG100g =
        fields.proteinG100g !== undefined ? fields.proteinG100g : existing.proteinG100g;
      const nextSaltG100g = fields.saltG100g !== undefined ? fields.saltG100g : existing.saltG100g;
      const nextNetContent =
        fields.netContent !== undefined ? fields.netContent : existing.netContent;
      const nextCountryOfOrigin =
        fields.countryOfOrigin !== undefined ? fields.countryOfOrigin : existing.countryOfOrigin;
      const nextCountryOfManufacture =
        fields.countryOfManufacture !== undefined
          ? fields.countryOfManufacture
          : existing.countryOfManufacture;
      const nextSupplier = fields.supplier !== undefined ? fields.supplier : existing.supplier;
      const nextSource = fields.source !== undefined ? fields.source : existing.source;
      const nextVerifiedAt =
        fields.verifiedAt !== undefined ? fields.verifiedAt : existing.verifiedAt;
      const nextDataStatus =
        fields.dataStatus !== undefined ? fields.dataStatus : existing.dataStatus;

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
            catalog_key = $15,
            category = $16,
            package_size = $17,
            package_unit = $18,
            gtin = $19,
            article_number = $20,
            ingredients = $21,
            allergens = $22,
            energy_kcal_100g = $23,
            fat_g_100g = $24,
            saturated_fat_g_100g = $25,
            carbohydrate_g_100g = $26,
            sugar_g_100g = $27,
            protein_g_100g = $28,
            salt_g_100g = $29,
            net_content = $30,
            country_of_origin = $31,
            country_of_manufacture = $32,
            supplier = $33,
            catalog_source = $34,
            verified_at = $35,
            data_status = $36,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $37 AND user_id = $38
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
          nextCatalogKey ?? '',
          nextCategory ?? '',
          nextPackageSize ?? '',
          nextPackageUnit ?? '',
          nextGtin ?? '',
          nextArticleNumber ?? '',
          nextIngredients ?? null,
          nextAllergens ?? null,
          nextEnergyKcal100g ?? null,
          nextFatG100g ?? null,
          nextSaturatedFatG100g ?? null,
          nextCarbohydrateG100g ?? null,
          nextSugarG100g ?? null,
          nextProteinG100g ?? null,
          nextSaltG100g ?? null,
          nextNetContent ?? '',
          nextCountryOfOrigin ?? '',
          nextCountryOfManufacture ?? '',
          nextSupplier ?? '',
          nextSource ?? '',
          nextVerifiedAt ?? null,
          nextDataStatus ?? '',
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

  async isInventoryItemLinkedToPriceList(db, itemId, userId) {
    const rows = await db.query(
      `
        SELECT 1
        FROM clubdesk_price_list_items pli
        INNER JOIN clubdesk_price_lists pl ON pl.id = pli.price_list_id
        WHERE pli.inventory_item_id = $1
          AND pl.user_id = $2
        LIMIT 1
      `,
      [itemId, userId],
    );
    return rows.length > 0;
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
      const existing = await this.getById(req, id);
      if (!existing) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (!existing.archivedAt) {
        throw new AppError(
          'Cannot delete an inventory item that is not archived',
          409,
          AppError.CODES.CONFLICT,
        );
      }
      if (await this.isInventoryItemLinkedToPriceList(db, id, userId)) {
        throw new AppError(
          'Cannot delete inventory item while it is linked to a price list',
          409,
          AppError.CODES.CONFLICT,
        );
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

  async archive(req, itemId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(itemId), 10);
      const existing = await this.getById(req, id);
      if (!existing) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (existing.archivedAt) {
        return existing;
      }
      await db.query(
        `
          UPDATE ${this.table}
          SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [id],
      );
      return this.getById(req, id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to archive clubdesk inventory item', error, { itemId });
      throw new AppError('Failed to archive inventory item', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async restore(req, itemId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(itemId), 10);
      const existing = await this.getById(req, id);
      if (!existing) {
        throw new AppError('Inventory item not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (!existing.archivedAt) {
        return existing;
      }
      await db.query(
        `
          UPDATE ${this.table}
          SET archived_at = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [id],
      );
      return this.getById(req, id);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error?.code === '23505') {
        throw new AppError(
          'An active inventory item already uses this name, brand, or slug',
          409,
          AppError.CODES.CONFLICT,
        );
      }
      Logger.error('Failed to restore clubdesk inventory item', error, { itemId });
      throw new AppError('Failed to restore inventory item', 500, AppError.CODES.DATABASE_ERROR);
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
            (item_id, sku, gtin, audience, color, size, quantity, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING *
        `,
        [
          id,
          variant.sku,
          variant.gtin,
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
      const nextGtin = data.gtin !== undefined ? normalizeGtin(data.gtin) : (existing.gtin ?? '');
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
            gtin = $2,
            audience = $3,
            color = $4,
            size = $5,
            quantity = $6,
            sort_order = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $8 AND item_id = $9
          RETURNING *
        `,
        [nextSku, nextGtin, nextAudience, nextColor, nextSize, nextQuantity, nextSort, vid, lid],
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
module.exports.normalizeGtin = normalizeGtin;
module.exports.normalizeInventoryTags = normalizeInventoryTags;
module.exports.slugifyBase = slugifyBase;
module.exports.MAX_IMPORT_ITEMS = MAX_IMPORT_ITEMS;
