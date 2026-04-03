const { Context, Database } = require('@homebase/core');

class ProductMediaObjectModel {
  async create(req, row) {
    const db = Database.get(req);
    const productId =
      row.productId != null && Number.isFinite(Number(row.productId))
        ? Number(row.productId)
        : null;
    const createdByUserId =
      row.createdByUserId != null && String(row.createdByUserId).trim()
        ? String(row.createdByUserId).trim()
        : Context.getUserId(req) != null
          ? String(Context.getUserId(req)).trim()
          : null;
    const sourceKind = String(row.sourceKind || '').trim() || 'manual_upload';
    const sourceUrl =
      row.sourceUrl != null && String(row.sourceUrl).trim() ? String(row.sourceUrl).trim() : null;
    const originalFilename =
      row.originalFilename != null && String(row.originalFilename).trim()
        ? String(row.originalFilename).trim()
        : null;
    const storageKey = String(row.storageKey || '').trim();
    const url = String(row.url || '').trim();

    const rows = await db.query(
      `
      INSERT INTO product_media_objects (
        product_id,
        created_by_user_id,
        source_kind,
        source_url,
        original_filename,
        storage_key,
        url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [productId, createdByUserId, sourceKind, sourceUrl, originalFilename, storageKey, url],
    );
    return rows[0] || null;
  }

  async listByProductId(req, productId) {
    const db = Database.get(req);
    const pid = Number(productId);
    if (!Number.isFinite(pid)) return [];
    return db.query(
      `
      SELECT *
      FROM product_media_objects
      WHERE product_id = $1
      ORDER BY created_at ASC, id ASC
      `,
      [pid],
    );
  }

  async listByProductIds(req, productIds) {
    const db = Database.get(req);
    const ids = Array.isArray(productIds)
      ? productIds.map((value) => Number(value)).filter(Number.isFinite)
      : [];
    if (!ids.length) return [];
    return db.query(
      `
      SELECT *
      FROM product_media_objects
      WHERE product_id = ANY($1::int[])
      ORDER BY product_id ASC, created_at ASC, id ASC
      `,
      [ids],
    );
  }

  async findByProductAndSourceUrls(req, productId, sourceUrls) {
    const db = Database.get(req);
    const pid = Number(productId);
    const urls = Array.isArray(sourceUrls)
      ? sourceUrls.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!Number.isFinite(pid) || !urls.length) return [];
    return db.query(
      `
      SELECT *
      FROM product_media_objects
      WHERE product_id = $1
        AND source_url = ANY($2::text[])
      ORDER BY created_at ASC, id ASC
      `,
      [pid, urls],
    );
  }

  /** Pending rows (product_id IS NULL), e.g. after Sello host-before-upsert — match by Sello source URL. */
  async findPendingBySourceUrls(req, sourceUrls) {
    const db = Database.get(req);
    const urls = Array.isArray(sourceUrls)
      ? sourceUrls.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!urls.length) return [];
    return db.query(
      `
      SELECT *
      FROM product_media_objects
      WHERE product_id IS NULL
        AND source_url = ANY($1::text[])
      ORDER BY created_at ASC, id ASC
      `,
      [urls],
    );
  }

  async attachPendingUrlsToProduct(req, productId, urls) {
    const db = Database.get(req);
    const pid = Number(productId);
    const rawUserId = Context.getUserId(req);
    const userId = rawUserId != null ? String(rawUserId).trim() : null;
    const list = Array.isArray(urls)
      ? urls.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!Number.isFinite(pid) || !list.length) return [];
    if (userId) {
      return db.query(
        `
      UPDATE product_media_objects
      SET product_id = $1
      WHERE product_id IS NULL
        AND url = ANY($2::text[])
        AND (created_by_user_id = $3 OR created_by_user_id IS NULL)
      RETURNING *
      `,
        [pid, list, userId],
      );
    }
    return db.query(
      `
      UPDATE product_media_objects
      SET product_id = $1
      WHERE product_id IS NULL
        AND url = ANY($2::text[])
        AND created_by_user_id IS NULL
      RETURNING *
      `,
      [pid, list],
    );
  }

  async deleteByIds(req, ids) {
    const db = Database.get(req);
    const list = Array.isArray(ids)
      ? ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!list.length) return [];
    return db.query(`DELETE FROM product_media_objects WHERE id = ANY($1::uuid[]) RETURNING *`, [
      list,
    ]);
  }
}

module.exports = ProductMediaObjectModel;
