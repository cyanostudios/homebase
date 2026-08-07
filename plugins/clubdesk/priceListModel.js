// plugins/clubdesk/priceListModel.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

const PUBLICATION_STATUSES = ['draft', 'published'];
const DEFAULT_CURRENCY = 'SEK';

class PriceListModel {
  constructor() {
    this.table = 'clubdesk_price_lists';
    this.itemsTable = 'clubdesk_price_list_items';
    this.categoriesTable = 'clubdesk_price_list_item_categories';
  }

  categoryKey(category) {
    const normalized = this.normalizeCategoryValue(category);
    return normalized === null ? '' : normalized.toLowerCase();
  }

  normalizeItems(items) {
    if (items === undefined || items === null) {
      return null;
    }
    if (!Array.isArray(items)) {
      throw new AppError('items must be an array', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const normalized = [];
    const sequenceByCategory = new Map();

    for (let i = 0; i < items.length; i += 1) {
      const raw = items[i] || {};
      const title = String(raw.title ?? '').trim();
      if (!title) {
        throw new AppError(`items[${i}].title is required`, 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (title.length > 255) {
        throw new AppError(
          `items[${i}].title must not exceed 255 characters`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const category = this.normalizeCategoryValue(
        raw.category === undefined ? null : raw.category,
      );
      if (category && category.length > 100) {
        throw new AppError(
          `items[${i}].category must not exceed 100 characters`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      // Assign order by payload order within each category (avoids duplicate-order conflicts
      // when the client sends stale or global sequence numbers).
      const catKey = this.categoryKey(category);
      const sequenceOrder = (sequenceByCategory.get(catKey) ?? 0) + 1;
      sequenceByCategory.set(catKey, sequenceOrder);

      const description =
        raw.description === undefined || raw.description === null || raw.description === ''
          ? null
          : String(raw.description);

      let price = Number(raw.price);
      if (!Number.isFinite(price)) {
        price = 0;
      }
      if (price < 0 || price > 9999999999.99) {
        throw new AppError(
          `items[${i}].price must be between 0 and 9999999999.99`,
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'price', message: `items[${i}].price must be between 0 and 9999999999.99` }],
        );
      }

      normalized.push({
        title,
        description,
        price,
        category,
        sequenceOrder,
      });
    }

    return normalized;
  }

  normalizeCategoryValue(category) {
    if (category === undefined || category === null) {
      return null;
    }
    const trimmed = String(category).trim();
    return trimmed === '' ? null : trimmed;
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

  /**
   * Reject when another price list for the same user already uses this title
   * (case-insensitive). Pass excludeId on update so the current row is ignored.
   */
  async assertTitleUnique(dbOrTx, userId, title, excludeId = null) {
    const params = [userId, title];
    let sql = `
      SELECT id
      FROM ${this.table}
      WHERE user_id = $1 AND lower(title) = lower($2)
    `;
    if (excludeId != null) {
      sql += ' AND id <> $3';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const rows = await dbOrTx.query(sql, params);
    if (rows.length > 0) {
      throw new AppError(
        'A price list with this title already exists',
        409,
        AppError.CODES.CONFLICT,
        [{ field: 'title', message: 'A price list with this title already exists' }],
      );
    }
  }

  assertPublishedHasItems(publicationStatus, itemCount) {
    if (publicationStatus === 'published' && Number(itemCount) < 1) {
      const message = 'Add at least one item before publishing.';
      throw new AppError(message, 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'items', message },
      ]);
    }
  }

  normalizeParentFields(data, { partial = false } = {}) {
    const out = {};

    if (!partial || data.title !== undefined) {
      const title = String(data.title ?? '').trim();
      if (!title) {
        throw new AppError('title is required', 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (title.length > 255) {
        throw new AppError(
          'title must not exceed 255 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      out.title = title;
    }

    if (!partial || data.slug !== undefined) {
      const slug = String(data.slug ?? '').trim();
      if (!slug) {
        throw new AppError('slug is required', 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (slug.length > 255) {
        throw new AppError(
          'slug must not exceed 255 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      out.slug = slug;
    }

    if (!partial || data.description !== undefined) {
      out.description =
        data.description === undefined || data.description === null || data.description === ''
          ? null
          : String(data.description);
    }

    if (!partial || data.featuredImageUrl !== undefined || data.featured_image_url !== undefined) {
      const raw =
        data.featuredImageUrl !== undefined ? data.featuredImageUrl : data.featured_image_url;
      out.featuredImageUrl = raw === undefined || raw === null || raw === '' ? null : String(raw);
    }

    if (!partial || data.publicationStatus !== undefined || data.publication_status !== undefined) {
      const raw =
        data.publicationStatus !== undefined ? data.publicationStatus : data.publication_status;
      const status = raw === undefined || raw === null || raw === '' ? 'draft' : String(raw);
      if (!PUBLICATION_STATUSES.includes(status)) {
        throw new AppError(
          `publicationStatus must be one of: ${PUBLICATION_STATUSES.join(', ')}`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      out.publicationStatus = status;
    }

    if (!partial || data.currency !== undefined) {
      const currencyRaw =
        data.currency === undefined || data.currency === null || data.currency === ''
          ? DEFAULT_CURRENCY
          : String(data.currency).trim();
      if (!currencyRaw) {
        throw new AppError('currency is required', 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (currencyRaw.length > 10) {
        throw new AppError(
          'currency must not exceed 10 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      out.currency = currencyRaw;
    }

    return out;
  }

  transformItemRow(row) {
    return {
      id: String(row.id),
      priceListId: String(row.price_list_id),
      title: row.title ?? '',
      description: row.description ?? null,
      price: Number(row.price),
      category: row.category ?? null,
      sequenceOrder: Number(row.sequence_order),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformListRow(row) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      slug: row.slug ?? '',
      description: row.description ?? null,
      featuredImageUrl: row.featured_image_url ?? null,
      publicationStatus: row.publication_status ?? 'draft',
      currency: row.currency ?? DEFAULT_CURRENCY,
      sortOrder:
        row.sort_order !== null && row.sort_order !== undefined ? Number(row.sort_order) : 1,
      itemCount:
        row.item_count !== null && row.item_count !== undefined ? Number(row.item_count) : 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformCategoryRow(row) {
    return {
      id: String(row.id),
      name: row.name ?? '',
      sortOrder:
        row.sort_order !== null && row.sort_order !== undefined ? Number(row.sort_order) : 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  transformDetailRow(row, items = []) {
    return {
      ...this.transformListRow({ ...row, item_count: items.length }),
      items: items.map((item) => this.transformItemRow(item)),
    };
  }

  /**
   * Raw pool when given Database.get() (child tables have no user_id).
   * Transaction `tx.query` is already raw.
   */
  async queryChild(dbOrTx, sql, params) {
    if (typeof dbOrTx.getPool === 'function') {
      const result = await dbOrTx.getPool().query(sql, params);
      return result.rows;
    }
    return dbOrTx.query(sql, params);
  }

  async assertPriceListOwned(db, userId, priceListId) {
    const id = parseInt(String(priceListId), 10);
    if (Number.isNaN(id)) {
      throw new AppError('Price list not found', 404, AppError.CODES.NOT_FOUND);
    }
    const rows = await db.query(`SELECT id FROM ${this.table} WHERE id = $1 AND user_id = $2`, [
      id,
      userId,
    ]);
    if (!rows.length) {
      throw new AppError('Price list not found', 404, AppError.CODES.NOT_FOUND);
    }
    return id;
  }

  async nextCategorySortOrder(dbOrTx, priceListId) {
    const rows = await this.queryChild(
      dbOrTx,
      `
        SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next
        FROM ${this.categoriesTable}
        WHERE price_list_id = $1
      `,
      [priceListId],
    );
    return Number(rows[0]?.next ?? 1);
  }

  async assertCategoryNameUnique(dbOrTx, priceListId, name, excludeId = null) {
    const normalized = this.normalizeCategoryValue(name);
    if (!normalized) {
      throw new AppError('Category name is required', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'name', message: 'Category name is required' },
      ]);
    }
    const params = [priceListId, normalized];
    let sql = `
      SELECT id
      FROM ${this.categoriesTable}
      WHERE price_list_id = $1 AND lower(btrim(name)) = lower($2)
    `;
    if (excludeId != null) {
      sql += ' AND id <> $3';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const rows = await this.queryChild(dbOrTx, sql, params);
    if (rows.length) {
      throw new AppError('Category name already exists', 409, AppError.CODES.CONFLICT, [
        { field: 'name', message: 'Category name already exists' },
      ]);
    }
  }

  async listCategories(req, priceListId) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const id = await this.assertPriceListOwned(db, userId, priceListId);
      const rows = await this.queryChild(
        db,
        `
          SELECT id, name, sort_order, created_at, updated_at
          FROM ${this.categoriesTable}
          WHERE price_list_id = $1
          ORDER BY sort_order ASC NULLS LAST, lower(name) ASC, id ASC
        `,
        [id],
      );
      return rows.map((row) => this.transformCategoryRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to list price list categories', error);
      throw new AppError(
        'Failed to list price list categories',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async createCategory(req, priceListId, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = await this.assertPriceListOwned(db, userId, priceListId);

      const name = this.normalizeCategoryValue(data?.name);
      if (!name) {
        throw new AppError('Category name is required', 400, AppError.CODES.VALIDATION_ERROR, [
          { field: 'name', message: 'Category name is required' },
        ]);
      }
      if (name.length > 100) {
        throw new AppError(
          'Category name must not exceed 100 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'name', message: 'Category name must not exceed 100 characters' }],
        );
      }

      await this.assertCategoryNameUnique(db, id, name);
      const sortOrder = await this.nextCategorySortOrder(db, id);
      const rows = await this.queryChild(
        db,
        `
          INSERT INTO ${this.categoriesTable} (price_list_id, name, sort_order)
          VALUES ($1, $2, $3)
          RETURNING id, name, sort_order, created_at, updated_at
        `,
        [id, name, sortOrder],
      );
      Logger.info('Price list category created', { priceListId: id, categoryId: rows[0]?.id });
      return this.transformCategoryRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create price list category', error);
      throw error;
    }
  }

  async deleteCategory(req, priceListId, categoryId, options = {}) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const listId = await this.assertPriceListOwned(db, userId, priceListId);
      const id = parseInt(String(categoryId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Category not found', 404, AppError.CODES.NOT_FOUND);
      }

      const catRows = await this.queryChild(
        db,
        `
          SELECT id, name
          FROM ${this.categoriesTable}
          WHERE id = $1 AND price_list_id = $2
        `,
        [id, listId],
      );
      if (!catRows.length) {
        throw new AppError('Category not found', 404, AppError.CODES.NOT_FOUND);
      }
      const categoryName = String(catRows[0].name || '').trim();

      const itemCountRows = await this.queryChild(
        db,
        `
          SELECT COUNT(*)::int AS cnt
          FROM ${this.itemsTable}
          WHERE price_list_id = $1
            AND category IS NOT NULL
            AND btrim(category) <> ''
            AND lower(btrim(category)) = lower($2::text)
        `,
        [listId, categoryName],
      );
      const itemCount = Number(itemCountRows[0]?.cnt ?? 0);

      const hasMoveOption = Object.prototype.hasOwnProperty.call(options || {}, 'moveToCategory');
      if (itemCount > 0 && !hasMoveOption) {
        throw new AppError(
          'Category has items; choose another category to move them to',
          409,
          AppError.CODES.CONFLICT,
          [
            {
              field: 'moveToCategory',
              message: 'Category has items; choose another category to move them to',
              itemCount,
              categoryName,
              needsReassignment: true,
            },
          ],
        );
      }

      let moveTo = null;
      if (hasMoveOption) {
        moveTo = this.normalizeCategoryValue(options.moveToCategory);
        if (moveTo && moveTo.length > 100) {
          throw new AppError(
            'moveToCategory must not exceed 100 characters',
            400,
            AppError.CODES.VALIDATION_ERROR,
            [{ field: 'moveToCategory', message: 'moveToCategory must not exceed 100 characters' }],
          );
        }
        if (moveTo && this.categoryKey(moveTo) === this.categoryKey(categoryName)) {
          throw new AppError(
            'moveToCategory must be a different category',
            400,
            AppError.CODES.VALIDATION_ERROR,
            [{ field: 'moveToCategory', message: 'moveToCategory must be a different category' }],
          );
        }
      }

      await db.transaction(async (tx) => {
        if (itemCount > 0) {
          await this.queryChild(
            tx,
            `
              UPDATE ${this.itemsTable}
              SET category = $3,
                  updated_at = NOW()
              WHERE price_list_id = $1
                AND category IS NOT NULL
                AND btrim(category) <> ''
                AND lower(btrim(category)) = lower($2::text)
            `,
            [listId, categoryName, moveTo],
          );
        }

        const deleted = await this.queryChild(
          tx,
          `
            DELETE FROM ${this.categoriesTable}
            WHERE id = $1 AND price_list_id = $2
            RETURNING id
          `,
          [id, listId],
        );
        if (!deleted.length) {
          throw new AppError('Category not found', 404, AppError.CODES.NOT_FOUND);
        }
      });

      Logger.info('Price list category deleted', {
        priceListId: listId,
        categoryId: id,
        movedItems: itemCount,
        moveToCategory: moveTo,
      });
      return {
        id: String(id),
        movedItemCount: itemCount,
        moveToCategory: moveTo,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete price list category', error, { priceListId, categoryId });
      throw new AppError(
        'Failed to delete price list category',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async reorderCategories(req, priceListId, orderedIds) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const listId = await this.assertPriceListOwned(db, userId, priceListId);
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        throw new AppError(
          'orderedIds must be a non-empty array',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const ids = orderedIds
        .map((id) => parseInt(String(id), 10))
        .filter((id) => !Number.isNaN(id));
      if (ids.length !== orderedIds.length) {
        throw new AppError(
          'orderedIds must contain valid ids',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      if (new Set(ids).size !== ids.length) {
        throw new AppError('orderedIds must be unique', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const existing = await this.queryChild(
        db,
        `
          SELECT id
          FROM ${this.categoriesTable}
          WHERE price_list_id = $1
          ORDER BY sort_order ASC NULLS LAST, id ASC
        `,
        [listId],
      );
      const existingIds = existing.map((row) => Number(row.id));
      if (existingIds.length !== ids.length) {
        throw new AppError(
          'orderedIds must include every category',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'orderedIds', message: 'orderedIds must include every category' }],
        );
      }
      const existingSet = new Set(existingIds);
      for (const id of ids) {
        if (!existingSet.has(id)) {
          throw new AppError(
            'orderedIds contains an unknown category',
            400,
            AppError.CODES.VALIDATION_ERROR,
            [{ field: 'orderedIds', message: 'orderedIds contains an unknown category' }],
          );
        }
      }

      await db.transaction(async (tx) => {
        for (let i = 0; i < ids.length; i += 1) {
          await tx.query(
            `
              UPDATE ${this.categoriesTable}
              SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2 AND price_list_id = $3
            `,
            [-(i + 1), ids[i], listId],
          );
        }
        for (let i = 0; i < ids.length; i += 1) {
          await tx.query(
            `
              UPDATE ${this.categoriesTable}
              SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2 AND price_list_id = $3
            `,
            [i + 1, ids[i], listId],
          );
        }
      });

      return this.listCategories(req, listId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to reorder price list categories', error);
      throw new AppError(
        'Failed to reorder price list categories',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async getItemsForPriceList(dbOrTx, priceListId) {
    return this.queryChild(
      dbOrTx,
      `
        SELECT i.*
        FROM ${this.itemsTable} i
        LEFT JOIN ${this.categoriesTable} c
          ON c.price_list_id = i.price_list_id
          AND lower(btrim(c.name)) = lower(btrim(COALESCE(i.category, '')))
        WHERE i.price_list_id = $1
        ORDER BY
          CASE WHEN i.category IS NULL OR btrim(i.category) = '' THEN 1 ELSE 0 END ASC,
          COALESCE(c.sort_order, 2147483647) ASC,
          lower(COALESCE(NULLIF(btrim(i.category), ''), '')) ASC,
          i.sequence_order ASC,
          i.id ASC
      `,
      [priceListId],
    );
  }

  async insertItems(tx, priceListId, items) {
    for (const item of items) {
      await tx.query(
        `
          INSERT INTO ${this.itemsTable} (
            price_list_id,
            title,
            description,
            price,
            category,
            sequence_order
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [priceListId, item.title, item.description, item.price, item.category, item.sequenceOrder],
      );
    }
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
            i.id,
            i.title,
            i.slug,
            i.description,
            i.featured_image_url,
            i.publication_status,
            i.currency,
            i.sort_order,
            i.created_at,
            i.updated_at,
            COALESCE(s.cnt, 0)::int AS item_count
          FROM ${this.table} i
          LEFT JOIN (
            SELECT price_list_id, COUNT(*)::int AS cnt
            FROM ${this.itemsTable}
            GROUP BY price_list_id
          ) s ON s.price_list_id = i.id
          WHERE i.user_id = $1
          ORDER BY
            i.sort_order ASC NULLS LAST,
            lower(i.title) ASC,
            i.id ASC
        `,
        [userId],
      );
      return rows.map((row) => this.transformListRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch price lists', error);
      throw new AppError('Failed to fetch price lists', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, priceListId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(priceListId), 10);
      if (Number.isNaN(id)) {
        return null;
      }

      const rows = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
      if (!rows.length) {
        return null;
      }

      const items = await this.getItemsForPriceList(db, id);
      return this.transformDetailRow(rows[0], items);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to get price list by id', error, { priceListId });
      throw new AppError('Failed to get price list', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const fields = this.normalizeParentFields(data);
      const items = this.normalizeItems(data.items) ?? [];
      this.assertPublishedHasItems(fields.publicationStatus ?? 'draft', items.length);
      await this.assertTitleUnique(db, userId, fields.title);
      const sortOrder = await this.nextSortOrder(db, userId);

      const created = await db.transaction(async (tx) => {
        const parentRows = await tx.query(
          `
            INSERT INTO ${this.table} (
              user_id,
              title,
              slug,
              description,
              featured_image_url,
              publication_status,
              currency,
              sort_order
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
          `,
          [
            userId,
            fields.title,
            fields.slug,
            fields.description ?? null,
            fields.featuredImageUrl ?? null,
            fields.publicationStatus ?? 'draft',
            fields.currency ?? DEFAULT_CURRENCY,
            sortOrder,
          ],
        );
        const parent = parentRows[0];
        await this.insertItems(tx, parent.id, items);
        const itemRows = await this.getItemsForPriceList(tx, parent.id);
        return { parent, itemRows };
      });

      Logger.info('Price list created', { priceListId: created.parent.id });
      return this.transformDetailRow(created.parent, created.itemRows);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create price list', error);
      throw error;
    }
  }

  async update(req, priceListId, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = parseInt(String(priceListId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Price list not found', 404, AppError.CODES.NOT_FOUND);
      }

      const existing = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
      if (!existing.length) {
        throw new AppError('Price list not found', 404, AppError.CODES.NOT_FOUND);
      }

      const fields = this.normalizeParentFields(
        {
          title: data.title !== undefined ? data.title : existing[0].title,
          slug: data.slug !== undefined ? data.slug : existing[0].slug,
          description: data.description !== undefined ? data.description : existing[0].description,
          featuredImageUrl:
            data.featuredImageUrl !== undefined || data.featured_image_url !== undefined
              ? data.featuredImageUrl !== undefined
                ? data.featuredImageUrl
                : data.featured_image_url
              : existing[0].featured_image_url,
          publicationStatus:
            data.publicationStatus !== undefined || data.publication_status !== undefined
              ? data.publicationStatus !== undefined
                ? data.publicationStatus
                : data.publication_status
              : existing[0].publication_status,
          currency: data.currency !== undefined ? data.currency : existing[0].currency,
        },
        { partial: false },
      );

      const replaceItems = Object.prototype.hasOwnProperty.call(data, 'items');
      const items = replaceItems ? (this.normalizeItems(data.items) ?? []) : null;

      let itemCount;
      if (replaceItems) {
        itemCount = items.length;
      } else {
        const existingItems = await this.getItemsForPriceList(db, id);
        itemCount = existingItems.length;
      }
      this.assertPublishedHasItems(fields.publicationStatus ?? 'draft', itemCount);
      await this.assertTitleUnique(db, userId, fields.title, id);

      const updated = await db.transaction(async (tx) => {
        const parentRows = await tx.query(
          `
            UPDATE ${this.table}
            SET
              title = $1,
              slug = $2,
              description = $3,
              featured_image_url = $4,
              publication_status = $5,
              currency = $6,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $7 AND user_id = $8
            RETURNING *
          `,
          [
            fields.title,
            fields.slug,
            fields.description ?? null,
            fields.featuredImageUrl ?? null,
            fields.publicationStatus ?? 'draft',
            fields.currency ?? DEFAULT_CURRENCY,
            id,
            userId,
          ],
        );
        if (!parentRows.length) {
          throw new AppError('Price list not found', 404, AppError.CODES.NOT_FOUND);
        }

        if (replaceItems) {
          await tx.query(`DELETE FROM ${this.itemsTable} WHERE price_list_id = $1`, [id]);
          await this.insertItems(tx, id, items);
        }

        const itemRows = await this.getItemsForPriceList(tx, id);
        return { parent: parentRows[0], itemRows };
      });

      Logger.info('Price list updated', { priceListId: id });
      return this.transformDetailRow(updated.parent, updated.itemRows);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update price list', error, { priceListId });
      throw error;
    }
  }

  async reorder(req, orderedIds) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        throw new AppError(
          'orderedIds must be a non-empty array',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const ids = orderedIds
        .map((id) => parseInt(String(id), 10))
        .filter((id) => !Number.isNaN(id));
      if (ids.length !== orderedIds.length) {
        throw new AppError(
          'orderedIds must contain valid ids',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      if (new Set(ids).size !== ids.length) {
        throw new AppError('orderedIds must be unique', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const existing = await db.query(
        `
          SELECT id
          FROM ${this.table}
          WHERE user_id = $1
          ORDER BY sort_order ASC NULLS LAST, id ASC
        `,
        [userId],
      );
      const existingIds = existing.map((row) => Number(row.id));
      if (existingIds.length !== ids.length) {
        throw new AppError(
          'orderedIds must include every price list',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [{ field: 'orderedIds', message: 'orderedIds must include every price list' }],
        );
      }
      const existingSet = new Set(existingIds);
      for (const id of ids) {
        if (!existingSet.has(id)) {
          throw new AppError(
            'orderedIds contains an unknown price list',
            400,
            AppError.CODES.VALIDATION_ERROR,
            [{ field: 'orderedIds', message: 'orderedIds contains an unknown price list' }],
          );
        }
      }

      await db.transaction(async (tx) => {
        for (let i = 0; i < ids.length; i += 1) {
          await tx.query(
            `
              UPDATE ${this.table}
              SET sort_order = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2 AND user_id = $3
            `,
            [i + 1, ids[i], userId],
          );
        }
      });

      return this.getAll(req);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to reorder price lists', error);
      throw new AppError('Failed to reorder price lists', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async reorderItemsInCategory(req, priceListId, category, orderedIds) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const listId = await this.assertPriceListOwned(db, userId, priceListId);
      if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
        throw new AppError(
          'orderedIds must be a non-empty array',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const normalizedCategory = this.normalizeCategoryValue(category);
      const ids = orderedIds
        .map((id) => parseInt(String(id), 10))
        .filter((id) => !Number.isNaN(id));
      if (ids.length !== orderedIds.length) {
        throw new AppError(
          'orderedIds must contain valid ids',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      if (new Set(ids).size !== ids.length) {
        throw new AppError('orderedIds must be unique', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const existing = await this.queryChild(
        db,
        `
          SELECT id
          FROM ${this.itemsTable}
          WHERE price_list_id = $1
            AND (
              ($2::text IS NULL AND (category IS NULL OR btrim(category) = ''))
              OR lower(btrim(category)) = lower($2::text)
            )
          ORDER BY sequence_order ASC NULLS LAST, id ASC
        `,
        [listId, normalizedCategory],
      );
      const existingIds = existing.map((row) => Number(row.id));
      if (existingIds.length !== ids.length) {
        throw new AppError(
          'orderedIds must include every item in the category',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [
            {
              field: 'orderedIds',
              message: 'orderedIds must include every item in the category',
            },
          ],
        );
      }
      const existingSet = new Set(existingIds);
      for (const id of ids) {
        if (!existingSet.has(id)) {
          throw new AppError(
            'orderedIds contains an item outside the category',
            400,
            AppError.CODES.VALIDATION_ERROR,
            [
              {
                field: 'orderedIds',
                message: 'orderedIds contains an item outside the category',
              },
            ],
          );
        }
      }

      await db.transaction(async (tx) => {
        // Two-phase update avoids unique (price_list_id, category, sequence_order) collisions
        // while swapping (e.g. 1↔2).
        for (let i = 0; i < ids.length; i += 1) {
          await tx.query(
            `
              UPDATE ${this.itemsTable}
              SET sequence_order = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2 AND price_list_id = $3
            `,
            [-(i + 1), ids[i], listId],
          );
        }
        for (let i = 0; i < ids.length; i += 1) {
          await tx.query(
            `
              UPDATE ${this.itemsTable}
              SET sequence_order = $1, updated_at = CURRENT_TIMESTAMP
              WHERE id = $2 AND price_list_id = $3
            `,
            [i + 1, ids[i], listId],
          );
        }
      });

      return this.getById(req, listId);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to reorder price list items', error);
      throw new AppError('Failed to reorder price list items', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, priceListId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(priceListId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Price list not found', 404, AppError.CODES.NOT_FOUND);
      }

      const existing = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
      const backup = existing.length
        ? this.transformListRow({ ...existing[0], item_count: 0 })
        : null;

      const rows = await db.query(
        `
          DELETE FROM ${this.table}
          WHERE id = $1
          RETURNING id
        `,
        [id],
      );
      if (!rows.length) {
        throw new AppError('Price list not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Price list deleted', { priceListId: id });
      return { id: String(id), backup };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete price list', error, { priceListId });
      throw new AppError('Failed to delete price list', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const db = Database.get(req);
      let backups = [];
      if (Array.isArray(idsTextArray) && idsTextArray.length > 0) {
        const ids = idsTextArray.map((id) => parseInt(id, 10)).filter((id) => !Number.isNaN(id));
        if (ids.length > 0) {
          const existing = await db.query(`SELECT * FROM ${this.table} WHERE id = ANY($1::int[])`, [
            ids,
          ]);
          backups = existing.map((row) => this.transformListRow({ ...row, item_count: 0 }));
        }
      }

      const result = await BulkOperationsHelper.bulkDelete(req, this.table, idsTextArray);
      return { ...result, backups };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to bulk delete price lists', error);
      throw new AppError('Failed to bulk delete price lists', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = PriceListModel;
module.exports.PUBLICATION_STATUSES = PUBLICATION_STATUSES;
module.exports.DEFAULT_CURRENCY = DEFAULT_CURRENCY;
