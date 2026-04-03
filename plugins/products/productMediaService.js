const path = require('path');

const { Context, Logger } = require('@homebase/core');

const { AppError } = require('../../server/core/errors/AppError');
const {
  B2ObjectStorage,
  objectKeyFromB2FileUrl,
} = require('../../server/core/services/storage/b2ObjectStorage');
const ProductMediaObjectModel = require('./productMediaObjectModel');

const DEFAULT_FETCH_TIMEOUT_MS = 15000;

/** Run async tasks with max `concurrency` in flight; preserves result order by index. */
async function mapPool(length, concurrency, worker) {
  if (length <= 0) return [];
  const results = new Array(length);
  let next = 0;
  async function run() {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= length) return;
      results[idx] = await worker(idx);
    }
  }
  const n = Math.min(Math.max(1, concurrency), length);
  await Promise.all(Array.from({ length: n }, () => run()));
  return results;
}

function uniqueUrls(urls) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(urls) ? urls : []) {
    const url = String(raw || '').trim();
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

function collectProductImageUrls(product) {
  if (!product || typeof product !== 'object') return [];
  const urls = [];
  if (product.mainImage != null && String(product.mainImage).trim()) {
    urls.push(String(product.mainImage).trim());
  }
  if (Array.isArray(product.images)) {
    urls.push(...product.images);
  }
  return uniqueUrls(urls);
}

function isHttpUrl(value) {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function fileNameFromUrl(sourceUrl) {
  try {
    const parsed = new URL(String(sourceUrl || '').trim());
    const base = path.basename(parsed.pathname || '').trim();
    return base || 'image';
  } catch {
    return 'image';
  }
}

class ProductMediaService {
  constructor({ storage, mediaObjectModel } = {}) {
    this.storage = storage || null;
    this.mediaObjectModel = mediaObjectModel || new ProductMediaObjectModel();
    this.fetchTimeoutMs = Math.max(
      1000,
      Number(process.env.PRODUCT_MEDIA_FETCH_TIMEOUT_MS || process.env.MEDIA_FETCH_TIMEOUT_MS) ||
        DEFAULT_FETCH_TIMEOUT_MS,
    );
  }

  getProductImageUrls(product) {
    return collectProductImageUrls(product);
  }

  getStorage() {
    if (!this.storage) {
      this.storage = new B2ObjectStorage();
    }
    return this.storage;
  }

  async uploadPendingManualFiles(req, files) {
    const tenantId = req.session?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
    }
    const userId = Context.getUserId(req);
    const uploads = [];
    const storage = this.getStorage();
    for (const file of Array.isArray(files) ? files : []) {
      const key = storage.buildProductMediaKey({
        tenantId: String(tenantId),
        scope: `manual/${userId != null ? String(userId).trim() || 'user' : 'user'}`,
        originalFilename: file.originalname || 'image',
        mimeType: file.mimetype,
      });
      const uploaded = await storage.uploadImageBuffer({
        buffer: file.buffer,
        originalFilename: file.originalname || 'image',
        declaredMimeType: file.mimetype,
        key,
      });
      await this.mediaObjectModel.create(req, {
        productId: null,
        createdByUserId: userId != null ? String(userId).trim() : null,
        sourceKind: 'manual_upload',
        sourceUrl: null,
        originalFilename: uploaded.originalFilename,
        storageKey: uploaded.key,
        url: uploaded.publicUrl,
      });
      uploads.push({
        url: uploaded.publicUrl,
        originalFilename: uploaded.originalFilename,
      });
    }
    return uploads;
  }

  /**
   * Row is kept if the full public URL matches, or the object key matches any keep URL’s path
   * (same file after `B2_PUBLIC_BASE_URL` / f-host changes — avoids spurious B2 deletes and hide markers).
   */
  rowMediaUrlMatchesKeep(row, keep) {
    const storage = this.getStorage();
    const bucket = String(storage.bucket || '').trim();
    const u = String(row?.url || '').trim();
    if (u && keep.has(u)) return true;
    const sk = String(row?.storage_key || '').trim();
    if (!sk) return false;
    try {
      if (keep.has(storage.getPublicUrl(sk))) return true;
    } catch {
      /* ignore */
    }
    if (!bucket) return false;
    for (const keepUrl of keep) {
      const extracted = objectKeyFromB2FileUrl(keepUrl, bucket);
      if (extracted && extracted === sk) return true;
    }
    return false;
  }

  async reconcileAttachedProductMedia(req, productId, urls) {
    const normalizedUrls = uniqueUrls(urls);
    await this.mediaObjectModel.attachPendingUrlsToProduct(req, productId, normalizedUrls);

    const existing = await this.mediaObjectModel.listByProductId(req, productId);
    const keep = new Set(normalizedUrls);
    const stale = existing.filter((row) => !this.rowMediaUrlMatchesKeep(row, keep));
    if (!stale.length) return;

    await this.deleteManagedRows(stale);
    await this.mediaObjectModel.deleteByIds(
      req,
      stale.map((row) => row.id),
    );
  }

  /**
   * Download Sello image URLs and upload to B2. For a new Homebase product row, pass productId: null
   * and selloId so storage keys use sello/{selloId}; rows are created with product_id null until
   * the caller runs upsert then reconcileAttachedProductMedia (which attaches pending URLs).
   */
  async ensureHostedSelloMedia(req, { productId, selloId, sourceUrls }) {
    const pid = productId != null && Number.isFinite(Number(productId)) ? Number(productId) : null;
    const selloScopeId = pid != null ? String(pid) : String(selloId || '').trim() || 'unknown';

    const normalizedSources = (Array.isArray(sourceUrls) ? sourceUrls : []).map((raw) => {
      const s = String(raw || '').trim();
      return s.startsWith('//') ? `https:${s}` : s;
    });
    const inputUrls = uniqueUrls(normalizedSources).filter((url) => isHttpUrl(url));
    if (!inputUrls.length) {
      Logger.warn('ensureHostedSelloMedia: no HTTP image URLs in source list', {
        selloId: String(selloId || '').trim() || null,
        productId: pid,
        rawSourceCount: Array.isArray(sourceUrls) ? sourceUrls.length : 0,
      });
      return {
        mainImage: null,
        images: [],
        allHostedUrls: [],
        uploadedCount: 0,
        reusedCount: 0,
        failedCount: 0,
      };
    }

    let existingRows = [];
    if (pid != null) {
      existingRows = await this.mediaObjectModel.findByProductAndSourceUrls(req, pid, inputUrls);
    } else {
      existingRows = await this.mediaObjectModel.findPendingBySourceUrls(req, inputUrls);
    }
    const bySourceUrl = new Map(
      existingRows
        .filter((row) => row?.source_url && (String(row.storage_key || '').trim() || row?.url))
        .map((row) => [String(row.source_url).trim(), row]),
    );

    const perIndex = new Array(inputUrls.length);
    let uploadedCount = 0;
    let reusedCount = 0;
    let failedCount = 0;

    const uploadIndices = [];
    for (let i = 0; i < inputUrls.length; i += 1) {
      const sourceUrl = inputUrls[i];
      let existing = bySourceUrl.get(sourceUrl);
      const sk = String(existing?.storage_key || '').trim();
      if (existing && (sk || existing.url)) {
        const publicUrl = sk ? this.getStorage().getPublicUrl(sk) : String(existing.url).trim();
        reusedCount += 1;
        perIndex[i] = publicUrl;
        continue;
      }
      uploadIndices.push(i);
    }

    const uploadConcurrency = Math.max(
      1,
      Math.min(12, Number(process.env.PRODUCT_MEDIA_UPLOAD_CONCURRENCY || 8) || 8),
    );

    if (uploadIndices.length) {
      const uploadResults = await mapPool(uploadIndices.length, uploadConcurrency, async (j) => {
        const i = uploadIndices[j];
        const sourceUrl = inputUrls[i];
        try {
          const uploaded = await this.uploadExternalImage(req, {
            tenantId: req.session?.tenantId,
            scope: `sello/${selloScopeId}`,
            sourceUrl,
          });
          await this.mediaObjectModel.create(req, {
            productId: pid,
            sourceKind: 'sello_import',
            sourceUrl,
            originalFilename: uploaded.originalFilename,
            storageKey: uploaded.key,
            url: uploaded.publicUrl,
          });
          return { i, ok: true, url: uploaded.publicUrl };
        } catch (error) {
          failedCount += 1;
          Logger.warn('Failed to host Sello image', {
            productId: pid,
            selloScopeId,
            sourceUrl,
            error: String(error?.message || error),
          });
          return { i, ok: false };
        }
      });
      for (const r of uploadResults) {
        if (r.ok) {
          uploadedCount += 1;
          perIndex[r.i] = r.url;
        }
      }
    }

    const hostedUrls = [];
    for (let i = 0; i < perIndex.length; i += 1) {
      if (perIndex[i]) hostedUrls.push(perIndex[i]);
    }

    const mainImage = hostedUrls[0] || null;
    /** Extra gallery only; main is stored separately on the product as `mainImage`. */
    const images = hostedUrls.length > 1 ? hostedUrls.slice(1) : [];

    return {
      mainImage,
      images,
      /** Ordered list of every hosted URL (main + extras) — use for reconcile, not for DB `images` JSON. */
      allHostedUrls: hostedUrls,
      uploadedCount,
      reusedCount,
      failedCount,
    };
  }

  async uploadExternalImage(req, { tenantId, scope, sourceUrl }) {
    if (!isHttpUrl(sourceUrl)) {
      throw new AppError('External image URL must be http(s)', 400, 'PRODUCT_MEDIA_INVALID_IMAGE');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    try {
      const response = await fetch(String(sourceUrl).trim(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AppError(
          `Failed to fetch external image: ${response.status}`,
          400,
          'PRODUCT_MEDIA_FETCH_FAILED',
        );
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      const storage = this.getStorage();
      if (contentLength > 0 && contentLength > storage.maxFileBytes) {
        throw new AppError(
          `External image exceeds max size of ${storage.maxFileBytes} bytes`,
          400,
          'PRODUCT_MEDIA_INVALID_IMAGE',
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const key = storage.buildProductMediaKey({
        tenantId: String(tenantId || 'tenant'),
        scope,
        originalFilename: fileNameFromUrl(sourceUrl),
        mimeType: response.headers.get('content-type'),
      });

      return storage.uploadImageBuffer({
        buffer,
        originalFilename: fileNameFromUrl(sourceUrl),
        declaredMimeType: response.headers.get('content-type'),
        key,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      const detail = error?.name === 'AbortError' ? 'timeout' : String(error?.message || error);
      throw new AppError(
        `Failed to fetch external image: ${detail}`,
        400,
        'PRODUCT_MEDIA_FETCH_FAILED',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async deleteManagedRows(rows) {
    const keys = Array.isArray(rows)
      ? rows.map((row) => String(row?.storage_key || '').trim()).filter(Boolean)
      : [];
    if (!keys.length) return;
    await this.getStorage().deleteObjects(keys);
  }

  async deleteProductMedia(req, productId) {
    const rows = await this.mediaObjectModel.listByProductId(req, productId);
    await this.deleteManagedRows(rows);
  }

  async deleteProductsMedia(req, productIds) {
    const rows = await this.mediaObjectModel.listByProductIds(req, productIds);
    await this.deleteManagedRows(rows);
  }
}

module.exports = {
  ProductMediaService,
  collectProductImageUrls,
  uniqueUrls,
};
