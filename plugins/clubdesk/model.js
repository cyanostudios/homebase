// plugins/clubdesk/model.js
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');

const PUBLICATION_STATUSES = ['draft', 'published'];

class ClubdeskModel {
  constructor() {
    this.table = 'clubdesk_guides';
    this.stepsTable = 'clubdesk_guide_steps';
    this.categoriesTable = 'clubdesk_guide_categories';
  }

  normalizeSteps(steps) {
    if (steps === undefined || steps === null) {
      return null;
    }
    if (!Array.isArray(steps)) {
      throw new AppError('steps must be an array', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const normalized = [];
    const seenOrders = new Set();

    for (let i = 0; i < steps.length; i += 1) {
      const raw = steps[i] || {};
      const title = String(raw.title ?? '').trim();
      if (!title) {
        throw new AppError(`steps[${i}].title is required`, 400, AppError.CODES.VALIDATION_ERROR);
      }
      if (title.length > 255) {
        throw new AppError(
          `steps[${i}].title must not exceed 255 characters`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      let sequenceOrder = Number(raw.sequenceOrder ?? raw.sequence_order);
      if (!Number.isFinite(sequenceOrder)) {
        sequenceOrder = i + 1;
      }
      sequenceOrder = Math.trunc(sequenceOrder);
      if (seenOrders.has(sequenceOrder)) {
        throw new AppError(
          `Duplicate sequenceOrder ${sequenceOrder} in steps`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      seenOrders.add(sequenceOrder);

      const description =
        raw.description === undefined || raw.description === null || raw.description === ''
          ? null
          : String(raw.description);
      const imageUrl =
        raw.imageUrl === undefined || raw.imageUrl === null || raw.imageUrl === ''
          ? raw.image_url === undefined || raw.image_url === null || raw.image_url === ''
            ? null
            : String(raw.image_url)
          : String(raw.imageUrl);

      normalized.push({
        title,
        description,
        sequenceOrder,
        imageUrl,
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

  categoryKey(category) {
    const normalized = this.normalizeCategoryValue(category);
    return normalized ? normalized.toLowerCase() : '';
  }

  async nextSortOrder(dbOrTx, userId, category) {
    const normalized = this.normalizeCategoryValue(category);
    const rows = await dbOrTx.query(
      `
        SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next
        FROM ${this.table}
        WHERE user_id = $1
          AND (
            ($2::text IS NULL AND (category IS NULL OR btrim(category) = ''))
            OR lower(btrim(category)) = lower($2::text)
          )
      `,
      [userId, normalized],
    );
    return Number(rows[0]?.next ?? 1);
  }

  /**
   * Reject when another clubdesk for the same user already uses this title
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
      throw new AppError('A guide with this title already exists', 409, AppError.CODES.CONFLICT, [
        { field: 'title', message: 'A guide with this title already exists' },
      ]);
    }
  }

  /**
   * Frontend route `/clubdesk/price-list` must not collide with a guide slug.
   */
  assertSlugNotReserved(slug) {
    if (
      String(slug ?? '')
        .trim()
        .toLowerCase() === 'price-list'
    ) {
      const message = 'slug "price-list" is reserved';
      throw new AppError(message, 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'slug', message },
      ]);
    }
  }

  assertPublishedHasSteps(publicationStatus, stepCount) {
    if (publicationStatus === 'published' && Number(stepCount) < 1) {
      const message = 'Add at least one step before publishing.';
      throw new AppError(message, 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'steps', message },
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
      this.assertSlugNotReserved(out.slug);
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

    if (!partial || data.category !== undefined) {
      const category = this.normalizeCategoryValue(
        data.category === undefined ? null : data.category,
      );
      if (category && category.length > 100) {
        throw new AppError(
          'category must not exceed 100 characters',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      out.category = category;
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

    return out;
  }

  transformStepRow(row) {
    return {
      id: String(row.id),
      clubdeskId: String(row.guide_id),
      title: row.title ?? '',
      description: row.description ?? null,
      sequenceOrder: Number(row.sequence_order),
      imageUrl: row.image_url ?? null,
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
      category: row.category ?? null,
      publicationStatus: row.publication_status ?? 'draft',
      sortOrder:
        row.sort_order !== null && row.sort_order !== undefined ? Number(row.sort_order) : 1,
      stepCount:
        row.step_count !== null && row.step_count !== undefined ? Number(row.step_count) : 0,
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

  async nextCategorySortOrder(dbOrTx, userId) {
    const rows = await dbOrTx.query(
      `
        SELECT COALESCE(MAX(sort_order), 0)::int + 1 AS next
        FROM ${this.categoriesTable}
        WHERE user_id = $1
      `,
      [userId],
    );
    return Number(rows[0]?.next ?? 1);
  }

  async assertCategoryNameUnique(dbOrTx, userId, name, excludeId = null) {
    const normalized = this.normalizeCategoryValue(name);
    if (!normalized) {
      throw new AppError('Category name is required', 400, AppError.CODES.VALIDATION_ERROR, [
        { field: 'name', message: 'Category name is required' },
      ]);
    }
    const params = [userId, normalized];
    let sql = `
      SELECT id
      FROM ${this.categoriesTable}
      WHERE user_id = $1 AND lower(btrim(name)) = lower($2)
    `;
    if (excludeId != null) {
      sql += ' AND id <> $3';
      params.push(excludeId);
    }
    sql += ' LIMIT 1';
    const rows = await dbOrTx.query(sql, params);
    if (rows.length) {
      throw new AppError('Category name already exists', 409, AppError.CODES.CONFLICT, [
        { field: 'name', message: 'Category name already exists' },
      ]);
    }
  }

  async listCategories(req) {
    try {
      const db = Database.get(req);
      const rows = await db.query(
        `
          SELECT id, name, sort_order, created_at, updated_at
          FROM ${this.categoriesTable}
          ORDER BY sort_order ASC NULLS LAST, lower(name) ASC, id ASC
        `,
        [],
      );
      return rows.map((row) => this.transformCategoryRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to list clubdesk categories', error);
      throw new AppError('Failed to list clubdesk categories', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createCategory(req, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

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

      await this.assertCategoryNameUnique(db, userId, name);
      const sortOrder = await this.nextCategorySortOrder(db, userId);
      const rows = await db.query(
        `
          INSERT INTO ${this.categoriesTable} (user_id, name, sort_order)
          VALUES ($1, $2, $3)
          RETURNING id, name, sort_order, created_at, updated_at
        `,
        [userId, name, sortOrder],
      );
      Logger.info('Clubdesk category created', { categoryId: rows[0]?.id });
      return this.transformCategoryRow(rows[0]);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create clubdesk category', error);
      throw error;
    }
  }

  async deleteCategory(req, categoryId, options = {}) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }
      const id = parseInt(String(categoryId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Category not found', 404, AppError.CODES.NOT_FOUND);
      }

      const catRows = await db.query(
        `
          SELECT id, name
          FROM ${this.categoriesTable}
          WHERE id = $1 AND user_id = $2
        `,
        [id, userId],
      );
      if (!catRows.length) {
        throw new AppError('Category not found', 404, AppError.CODES.NOT_FOUND);
      }
      const categoryName = String(catRows[0].name || '').trim();

      const guideCountRows = await db.query(
        `
          SELECT COUNT(*)::int AS cnt
          FROM ${this.table}
          WHERE user_id = $1
            AND category IS NOT NULL
            AND btrim(category) <> ''
            AND lower(btrim(category)) = lower($2::text)
        `,
        [userId, categoryName],
      );
      const guideCount = Number(guideCountRows[0]?.cnt ?? 0);

      const hasMoveOption = Object.prototype.hasOwnProperty.call(options || {}, 'moveToCategory');
      if (guideCount > 0 && !hasMoveOption) {
        throw new AppError(
          'Category has guides; choose another category to move them to',
          409,
          AppError.CODES.CONFLICT,
          [
            {
              field: 'moveToCategory',
              message: 'Category has guides; choose another category to move them to',
              itemCount: guideCount,
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
        if (guideCount > 0) {
          await tx.query(
            `
              UPDATE ${this.table}
              SET category = $3,
                  updated_at = NOW()
              WHERE user_id = $1
                AND category IS NOT NULL
                AND btrim(category) <> ''
                AND lower(btrim(category)) = lower($2::text)
            `,
            [userId, categoryName, moveTo],
          );
        }

        const deleted = await tx.query(
          `
            DELETE FROM ${this.categoriesTable}
            WHERE id = $1 AND user_id = $2
            RETURNING id
          `,
          [id, userId],
        );
        if (!deleted.length) {
          throw new AppError('Category not found', 404, AppError.CODES.NOT_FOUND);
        }
      });

      Logger.info('Clubdesk category deleted', {
        categoryId: id,
        movedGuides: guideCount,
        moveToCategory: moveTo,
      });
      return {
        id: String(id),
        movedItemCount: guideCount,
        moveToCategory: moveTo,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete clubdesk category', error, { categoryId });
      throw new AppError('Failed to delete clubdesk category', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async reorderCategories(req, orderedIds) {
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
          FROM ${this.categoriesTable}
          WHERE user_id = $1
          ORDER BY sort_order ASC NULLS LAST, id ASC
        `,
        [userId],
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
              WHERE id = $2 AND user_id = $3
            `,
            [i + 1, ids[i], userId],
          );
        }
      });

      return this.listCategories(req);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to reorder clubdesk categories', error);
      throw new AppError(
        'Failed to reorder clubdesk categories',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  transformDetailRow(row, steps = []) {
    return {
      ...this.transformListRow({ ...row, step_count: steps.length }),
      steps: steps.map((s) => this.transformStepRow(s)),
    };
  }

  /**
   * Fetch steps for a parent. Uses raw pool when given Database.get() (steps have no
   * user_id — auto tenant filter would fail). Transaction `tx.query` is already raw.
   */
  async getStepsForClubdesk(dbOrTx, clubdeskId) {
    const sql = `
      SELECT *
      FROM ${this.stepsTable}
      WHERE guide_id = $1
      ORDER BY sequence_order ASC, id ASC
    `;
    const params = [clubdeskId];

    if (typeof dbOrTx.getPool === 'function') {
      const result = await dbOrTx.getPool().query(sql, params);
      return result.rows;
    }

    return dbOrTx.query(sql, params);
  }

  async insertSteps(tx, clubdeskId, steps) {
    for (const step of steps) {
      await tx.query(
        `
          INSERT INTO ${this.stepsTable} (
            guide_id,
            title,
            description,
            sequence_order,
            image_url
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [clubdeskId, step.title, step.description, step.sequenceOrder, step.imageUrl],
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
            i.category,
            i.publication_status,
            i.sort_order,
            i.created_at,
            i.updated_at,
            COALESCE(s.cnt, 0)::int AS step_count
          FROM ${this.table} i
          LEFT JOIN (
            SELECT guide_id, COUNT(*)::int AS cnt
            FROM ${this.stepsTable}
            GROUP BY guide_id
          ) s ON s.guide_id = i.id
          LEFT JOIN ${this.categoriesTable} c
            ON c.user_id = i.user_id
            AND lower(btrim(c.name)) = lower(btrim(i.category))
          WHERE i.user_id = $1
          ORDER BY
            CASE
              WHEN i.category IS NULL OR btrim(i.category) = '' THEN 2
              WHEN c.id IS NULL THEN 1
              ELSE 0
            END ASC,
            COALESCE(c.sort_order, 2147483647) ASC,
            lower(COALESCE(NULLIF(btrim(i.category), ''), '')) ASC,
            i.sort_order ASC NULLS LAST,
            lower(i.title) ASC,
            i.id ASC
        `,
        [userId],
      );
      return rows.map((row) => this.transformListRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to fetch clubdesk', error);
      throw new AppError('Failed to fetch clubdesk', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, clubdeskId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(clubdeskId), 10);
      if (Number.isNaN(id)) {
        return null;
      }

      const rows = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
      if (!rows.length) {
        return null;
      }

      const steps = await this.getStepsForClubdesk(db, id);
      return this.transformDetailRow(rows[0], steps);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to get clubdesk by id', error, { clubdeskId });
      throw new AppError('Failed to get clubdesk', 500, AppError.CODES.DATABASE_ERROR);
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
      const steps = this.normalizeSteps(data.steps) ?? [];
      this.assertPublishedHasSteps(fields.publicationStatus ?? 'draft', steps.length);
      await this.assertTitleUnique(db, userId, fields.title);
      const sortOrder = await this.nextSortOrder(db, userId, fields.category ?? null);

      const created = await db.transaction(async (tx) => {
        const parentRows = await tx.query(
          `
            INSERT INTO ${this.table} (
              user_id,
              title,
              slug,
              description,
              featured_image_url,
              category,
              publication_status,
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
            fields.category ?? null,
            fields.publicationStatus ?? 'draft',
            sortOrder,
          ],
        );
        const parent = parentRows[0];
        await this.insertSteps(tx, parent.id, steps);
        const stepRows = await this.getStepsForClubdesk(tx, parent.id);
        return { parent, stepRows };
      });

      Logger.info('Clubdesk created', { clubdeskId: created.parent.id });
      return this.transformDetailRow(created.parent, created.stepRows);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create clubdesk', error);
      throw error;
    }
  }

  async update(req, clubdeskId, data) {
    try {
      const db = Database.get(req);
      const userId = db.getUserId();
      if (!userId) {
        throw new AppError('User context required', 401, AppError.CODES.UNAUTHORIZED);
      }

      const id = parseInt(String(clubdeskId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Clubdesk not found', 404, AppError.CODES.NOT_FOUND);
      }

      const existing = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
      if (!existing.length) {
        throw new AppError('Clubdesk not found', 404, AppError.CODES.NOT_FOUND);
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
          category: data.category !== undefined ? data.category : existing[0].category,
          publicationStatus:
            data.publicationStatus !== undefined || data.publication_status !== undefined
              ? data.publicationStatus !== undefined
                ? data.publicationStatus
                : data.publication_status
              : existing[0].publication_status,
        },
        { partial: false },
      );

      const replaceSteps = Object.prototype.hasOwnProperty.call(data, 'steps');
      const steps = replaceSteps ? (this.normalizeSteps(data.steps) ?? []) : null;

      let stepCount;
      if (replaceSteps) {
        stepCount = steps.length;
      } else {
        const existingSteps = await this.getStepsForClubdesk(db, id);
        stepCount = existingSteps.length;
      }
      this.assertPublishedHasSteps(fields.publicationStatus ?? 'draft', stepCount);
      await this.assertTitleUnique(db, userId, fields.title, id);

      const previousCategory = this.normalizeCategoryValue(existing[0].category);
      const nextCategory = this.normalizeCategoryValue(fields.category ?? null);
      const categoryChanged = (previousCategory || '') !== (nextCategory || '');
      let nextSortOrder = Number(existing[0].sort_order) || 1;
      if (categoryChanged) {
        nextSortOrder = await this.nextSortOrder(db, userId, nextCategory);
      }

      const updated = await db.transaction(async (tx) => {
        const parentRows = await tx.query(
          `
            UPDATE ${this.table}
            SET
              title = $1,
              slug = $2,
              description = $3,
              featured_image_url = $4,
              category = $5,
              publication_status = $6,
              sort_order = $7,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND user_id = $9
            RETURNING *
          `,
          [
            fields.title,
            fields.slug,
            fields.description ?? null,
            fields.featuredImageUrl ?? null,
            fields.category ?? null,
            fields.publicationStatus ?? 'draft',
            nextSortOrder,
            id,
            userId,
          ],
        );
        if (!parentRows.length) {
          throw new AppError('Clubdesk not found', 404, AppError.CODES.NOT_FOUND);
        }

        if (replaceSteps) {
          await tx.query(`DELETE FROM ${this.stepsTable} WHERE guide_id = $1`, [id]);
          await this.insertSteps(tx, id, steps);
        }

        const stepRows = await this.getStepsForClubdesk(tx, id);
        return { parent: parentRows[0], stepRows };
      });

      Logger.info('Clubdesk updated', { clubdeskId: id });
      return this.transformDetailRow(updated.parent, updated.stepRows);
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to update clubdesk', error, { clubdeskId });
      throw error;
    }
  }

  async reorderInCategory(req, category, orderedIds) {
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

      const existing = await db.query(
        `
          SELECT id
          FROM ${this.table}
          WHERE user_id = $1
            AND (
              ($2::text IS NULL AND (category IS NULL OR btrim(category) = ''))
              OR lower(btrim(category)) = lower($2::text)
            )
          ORDER BY sort_order ASC NULLS LAST, id ASC
        `,
        [userId, normalizedCategory],
      );
      const existingIds = existing.map((row) => Number(row.id));
      if (existingIds.length !== ids.length) {
        throw new AppError(
          'orderedIds must include every clubdesk in the category',
          400,
          AppError.CODES.VALIDATION_ERROR,
          [
            {
              field: 'orderedIds',
              message: 'orderedIds must include every clubdesk in the category',
            },
          ],
        );
      }
      const existingSet = new Set(existingIds);
      for (const id of ids) {
        if (!existingSet.has(id)) {
          throw new AppError(
            'orderedIds contains an clubdesk outside the category',
            400,
            AppError.CODES.VALIDATION_ERROR,
            [
              {
                field: 'orderedIds',
                message: 'orderedIds contains an clubdesk outside the category',
              },
            ],
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
      Logger.error('Failed to reorder clubdesk', error);
      throw new AppError('Failed to reorder clubdesk', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, clubdeskId) {
    try {
      const db = Database.get(req);
      const id = parseInt(String(clubdeskId), 10);
      if (Number.isNaN(id)) {
        throw new AppError('Clubdesk not found', 404, AppError.CODES.NOT_FOUND);
      }

      const existing = await db.query(`SELECT * FROM ${this.table} WHERE id = $1`, [id]);
      const backup = existing.length
        ? this.transformListRow({ ...existing[0], step_count: 0 })
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
        throw new AppError('Clubdesk not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Clubdesk deleted', { clubdeskId: id });
      return { id: String(id), backup };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete clubdesk', error, { clubdeskId });
      throw new AppError('Failed to delete clubdesk', 500, AppError.CODES.DATABASE_ERROR);
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
          backups = existing.map((row) => this.transformListRow({ ...row, step_count: 0 }));
        }
      }

      const result = await BulkOperationsHelper.bulkDelete(req, this.table, idsTextArray);
      return { ...result, backups };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to bulk delete clubdesk', error);
      throw new AppError('Failed to bulk delete clubdesk', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = ClubdeskModel;
module.exports.PUBLICATION_STATUSES = PUBLICATION_STATUSES;
