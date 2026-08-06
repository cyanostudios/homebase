const { AppError } = require('../../server/core/errors/AppError');

class PublicInstructionsModel {
  transformListRow(row) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      slug: row.slug ?? '',
      description: row.description ?? null,
      featuredImageUrl: row.featured_image_url ?? null,
      category: row.category ?? null,
      stepCount:
        row.step_count !== null && row.step_count !== undefined ? Number(row.step_count) : 0,
      updatedAt: row.updated_at ?? null,
    };
  }

  transformPublicStep(row) {
    return {
      number: Number(row.sequence_order),
      title: row.title ?? '',
      description: row.description ?? null,
      image: row.image_url ?? null,
    };
  }

  transformDetail(row, steps = []) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      slug: row.slug ?? '',
      description: row.description ?? null,
      featuredImageUrl: row.featured_image_url ?? null,
      category: row.category ?? null,
      updatedAt: row.updated_at ?? null,
      steps: steps.map((s) => this.transformPublicStep(s)),
    };
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   */
  async listCategoryOrder(pool, ownerUserId) {
    const result = await pool.query(
      `
        SELECT name
        FROM instruction_categories
        WHERE user_id = $1
        ORDER BY sort_order ASC NULLS LAST, lower(name) ASC, id ASC
      `,
      [ownerUserId],
    );
    return result.rows.map((row) => String(row.name ?? '').trim()).filter(Boolean);
  }

  /**
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   */
  async listPublished(pool, ownerUserId) {
    const result = await pool.query(
      `
        SELECT
          i.id,
          i.title,
          i.slug,
          i.description,
          i.featured_image_url,
          i.category,
          i.sort_order,
          i.updated_at,
          COALESCE(s.cnt, 0)::int AS step_count
        FROM instructions i
        LEFT JOIN (
          SELECT instruction_id, COUNT(*)::int AS cnt
          FROM instruction_steps
          GROUP BY instruction_id
        ) s ON s.instruction_id = i.id
        LEFT JOIN instruction_categories c
          ON c.user_id = i.user_id
          AND lower(btrim(c.name)) = lower(btrim(i.category))
        WHERE i.user_id = $1
          AND i.publication_status = 'published'
        ORDER BY
          CASE
            WHEN i.category IS NULL OR btrim(i.category) = '' THEN 2
            WHEN c.id IS NULL THEN 1
            ELSE 0
          END ASC,
          COALESCE(c.sort_order, 2147483647) ASC,
          i.sort_order ASC NULLS LAST,
          lower(i.title) ASC,
          i.id ASC
      `,
      [ownerUserId],
    );
    return result.rows.map((row) => this.transformListRow(row));
  }

  /**
   * Resolve by numeric id or slug among published instructions for owner.
   * @param {import('pg').Pool} pool
   * @param {number} ownerUserId
   * @param {string} slugOrId
   */
  async getPublishedBySlugOrId(pool, ownerUserId, slugOrId) {
    const raw = String(slugOrId ?? '').trim();
    if (!raw) {
      throw new AppError('Invalid slug or id', 400, AppError.CODES.VALIDATION_ERROR);
    }

    const asId = parseInt(raw, 10);
    const isNumericId = String(asId) === raw && asId > 0;

    let parentResult;
    if (isNumericId) {
      parentResult = await pool.query(
        `
          SELECT *
          FROM instructions
          WHERE id = $2
            AND user_id = $1
            AND publication_status = 'published'
          LIMIT 1
        `,
        [ownerUserId, asId],
      );
    } else {
      parentResult = await pool.query(
        `
          SELECT *
          FROM instructions
          WHERE lower(slug) = lower($2)
            AND user_id = $1
            AND publication_status = 'published'
          LIMIT 1
        `,
        [ownerUserId, raw],
      );
    }

    if (!parentResult.rows.length) {
      return null;
    }

    const parent = parentResult.rows[0];
    const stepsResult = await pool.query(
      `
        SELECT title, description, sequence_order, image_url
        FROM instruction_steps
        WHERE instruction_id = $1
        ORDER BY sequence_order ASC, id ASC
      `,
      [parent.id],
    );

    return this.transformDetail(parent, stepsResult.rows);
  }
}

module.exports = PublicInstructionsModel;
