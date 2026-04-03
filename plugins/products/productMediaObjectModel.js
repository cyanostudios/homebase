const { Context, Database } = require('@homebase/core');

class ProductMediaObjectModel {
  normalizeRowInput(req, row = {}) {
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
    const position =
      row.position != null && Number.isFinite(Number(row.position))
        ? Math.trunc(Number(row.position))
        : 0;
    const contentHash =
      row.contentHash != null && String(row.contentHash).trim()
        ? String(row.contentHash).trim()
        : null;
    const mimeType =
      row.mimeType != null && String(row.mimeType).trim() ? String(row.mimeType).trim() : null;
    const sizeBytes =
      row.sizeBytes != null && Number.isFinite(Number(row.sizeBytes))
        ? Number(row.sizeBytes)
        : null;
    const width =
      row.width != null && Number.isFinite(Number(row.width)) ? Number(row.width) : null;
    const height =
      row.height != null && Number.isFinite(Number(row.height)) ? Number(row.height) : null;
    const variants =
      row.variants && typeof row.variants === 'object' && !Array.isArray(row.variants)
        ? row.variants
        : {};

    return {
      productId,
      createdByUserId,
      sourceKind,
      sourceUrl,
      originalFilename,
      storageKey,
      url,
      position,
      contentHash,
      mimeType,
      sizeBytes,
      width,
      height,
      variants,
    };
  }

  async create(req, row) {
    const db = Database.get(req);
    const input = this.normalizeRowInput(req, row);
    const rows = await db.query(
      `
      INSERT INTO product_media_objects (
        product_id,
        created_by_user_id,
        source_kind,
        source_url,
        original_filename,
        storage_key,
        url,
        position,
        content_hash,
        mime_type,
        size_bytes,
        width,
        height,
        variants
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      RETURNING *
      `,
      [
        input.productId,
        input.createdByUserId,
        input.sourceKind,
        input.sourceUrl,
        input.originalFilename,
        input.storageKey,
        input.url,
        input.position,
        input.contentHash,
        input.mimeType,
        input.sizeBytes,
        input.width,
        input.height,
        JSON.stringify(input.variants || {}),
      ],
    );
    return rows[0] || null;
  }

  async updateById(req, id, row) {
    const db = Database.get(req);
    const cleanId = String(id || '').trim();
    if (!cleanId) return null;
    const input = this.normalizeRowInput(req, row);
    const rows = await db.query(
      `
      UPDATE product_media_objects
      SET product_id = $2,
          source_kind = $3,
          source_url = $4,
          original_filename = $5,
          storage_key = $6,
          url = $7,
          position = $8,
          content_hash = $9,
          mime_type = $10,
          size_bytes = $11,
          width = $12,
          height = $13,
          variants = $14::jsonb
      WHERE id = $1::uuid
      RETURNING *
      `,
      [
        cleanId,
        input.productId,
        input.sourceKind,
        input.sourceUrl,
        input.originalFilename,
        input.storageKey,
        input.url,
        input.position,
        input.contentHash,
        input.mimeType,
        input.sizeBytes,
        input.width,
        input.height,
        JSON.stringify(input.variants || {}),
      ],
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
      ORDER BY position ASC, created_at ASC, id ASC
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
      ORDER BY product_id ASC, position ASC, created_at ASC, id ASC
      `,
      [ids],
    );
  }

  async findByIds(req, ids) {
    const db = Database.get(req);
    const list = Array.isArray(ids)
      ? ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!list.length) return [];
    return db.query(
      `
      SELECT *
      FROM product_media_objects
      WHERE id = ANY($1::uuid[])
      ORDER BY created_at ASC, id ASC
      `,
      [list],
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
      ORDER BY position ASC, created_at ASC, id ASC
      `,
      [pid, urls],
    );
  }

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
      ORDER BY position ASC, created_at ASC, id ASC
      `,
      [urls],
    );
  }

  async findByProductAndHashes(req, productId, hashes) {
    const db = Database.get(req);
    const pid = Number(productId);
    const list = Array.isArray(hashes)
      ? hashes.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!Number.isFinite(pid) || !list.length) return [];
    return db.query(
      `
      SELECT *
      FROM product_media_objects
      WHERE product_id = $1
        AND content_hash = ANY($2::text[])
      ORDER BY position ASC, created_at ASC, id ASC
      `,
      [pid, list],
    );
  }

  async findPendingByHashes(req, hashes) {
    const db = Database.get(req);
    const list = Array.isArray(hashes)
      ? hashes.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!list.length) return [];
    return db.query(
      `
      SELECT *
      FROM product_media_objects
      WHERE product_id IS NULL
        AND content_hash = ANY($1::text[])
      ORDER BY position ASC, created_at ASC, id ASC
      `,
      [list],
    );
  }

  async attachPendingIdsToProduct(req, productId, ids) {
    const db = Database.get(req);
    const pid = Number(productId);
    const rawUserId = Context.getUserId(req);
    const userId = rawUserId != null ? String(rawUserId).trim() : null;
    const list = Array.isArray(ids)
      ? ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (!Number.isFinite(pid) || !list.length) return [];
    if (userId) {
      return db.query(
        `
        UPDATE product_media_objects
        SET product_id = $1
        WHERE product_id IS NULL
          AND id = ANY($2::uuid[])
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
        AND id = ANY($2::uuid[])
        AND created_by_user_id IS NULL
      RETURNING *
      `,
      [pid, list],
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
