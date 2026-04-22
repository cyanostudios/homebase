const crypto = require('crypto');
const path = require('path');

const { Context, Logger } = require('@homebase/core');

const { AppError } = require('../../server/core/errors/AppError');
const {
  B2ObjectStorage,
  objectKeyFromB2FileUrl,
  normalizeProductIdForStorageKey,
  sanitizePathSegment,
} = require('../../server/core/services/storage/b2ObjectStorage');
const {
  ImageProcessingService,
} = require('../../server/core/services/storage/imageProcessingService');
const { MediaAssetService } = require('../../server/core/services/storage/mediaAssetService');
const ProductMediaObjectModel = require('./productMediaObjectModel');
const duplicateMediaTaskModel = require('./duplicateMediaTaskModel');
const {
  collectAssetVariantDeleteTargets,
  collectAssetVariantKeys,
  collectProductOriginalImageUrls,
  getAssetOriginalFilename,
  getAssetOriginalUrl,
  normalizeProductImageAsset,
  normalizeProductImages,
  reorderAssetsByMainImage,
  toTrimmedString,
  isHttpUrl,
} = require('./productImageAssets');

const DEFAULT_FETCH_TIMEOUT_MS = 15000;
const PRODUCT_MEDIA_ERROR_CODES = new Set([
  'PRODUCT_MEDIA_FETCH_FAILED',
  'PRODUCT_MEDIA_INVALID_IMAGE',
  'PRODUCT_MEDIA_UPLOAD_FAILED',
  'PRODUCT_MEDIA_PROCESSING_FAILED',
  'PRODUCT_MEDIA_DELETE_FAILED',
  'PRODUCT_MEDIA_MISSING_FOR_CHANNEL',
  'PRODUCT_MEDIA_SCHEMA_INVALID',
  'PRODUCT_MEDIA_STORAGE_NOT_CONFIGURED',
]);

function mergeDetails(existing, extra) {
  return {
    ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
    ...(extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {}),
  };
}

function toProductMediaError(error, { message, statusCode = 500, code, details = null }) {
  if (error instanceof AppError) {
    const finalCode = PRODUCT_MEDIA_ERROR_CODES.has(error.code) ? error.code : code;
    const finalStatus = Number.isFinite(Number(error.statusCode))
      ? Number(error.statusCode)
      : statusCode;
    const finalMessage = String(error.message || '').trim() || message;
    const finalDetails = mergeDetails(error.details, details);
    if (
      finalCode === error.code &&
      finalStatus === error.statusCode &&
      JSON.stringify(finalDetails || null) === JSON.stringify(error.details || null)
    ) {
      return error;
    }
    return new AppError(finalMessage, finalStatus, finalCode, finalDetails);
  }
  return new AppError(message, statusCode, code, mergeDetails(null, details));
}

function hostedProductObjectPrefix(tenantId, productId) {
  const tenantSeg = sanitizePathSegment(tenantId, 'tenant');
  const productSeg = sanitizePathSegment(
    normalizeProductIdForStorageKey(String(productId)),
    'product',
  );
  return `${tenantSeg}/products/${productSeg}/`;
}

function isManagedTenantProductsKey(key, tenantId) {
  const tenantSeg = sanitizePathSegment(tenantId, 'tenant');
  return String(key || '').startsWith(`${tenantSeg}/products/`);
}

function hostedVariantFromObjectKey(key) {
  const s = String(key || '');
  if (s.includes('/original/')) return 'original';
  if (s.includes('/preview/')) return 'preview';
  if (s.includes('/thumbnail/')) return 'thumbnail';
  return null;
}

function extensionFromVariantKey(key) {
  const m = String(key || '').match(/\.([^.]+)$/);
  return m ? String(m[1]).trim() : '';
}

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

function fileNameFromUrl(sourceUrl) {
  try {
    const parsed = new URL(String(sourceUrl || '').trim());
    const base = path.basename(parsed.pathname || '').trim();
    return base || 'image';
  } catch {
    return 'image';
  }
}

function buildAssetFromRow(row) {
  const variantsRaw =
    row?.variants && typeof row.variants === 'object' && !Array.isArray(row.variants)
      ? row.variants
      : {};
  const original = {
    key: toTrimmedString(variantsRaw?.original?.key) || toTrimmedString(row?.storage_key),
    url: toTrimmedString(variantsRaw?.original?.url) || toTrimmedString(row?.url),
    mimeType: toTrimmedString(variantsRaw?.original?.mimeType) || toTrimmedString(row?.mime_type),
    size:
      variantsRaw?.original?.size != null && Number.isFinite(Number(variantsRaw.original.size))
        ? Number(variantsRaw.original.size)
        : row?.size_bytes != null && Number.isFinite(Number(row.size_bytes))
          ? Number(row.size_bytes)
          : null,
    width:
      variantsRaw?.original?.width != null && Number.isFinite(Number(variantsRaw.original.width))
        ? Number(variantsRaw.original.width)
        : row?.width != null && Number.isFinite(Number(row.width))
          ? Number(row.width)
          : null,
    height:
      variantsRaw?.original?.height != null && Number.isFinite(Number(variantsRaw.original.height))
        ? Number(variantsRaw.original.height)
        : row?.height != null && Number.isFinite(Number(row.height))
          ? Number(row.height)
          : null,
  };
  const asset = normalizeProductImageAsset(
    {
      assetId: String(row?.id || ''),
      position:
        row?.position != null && Number.isFinite(Number(row.position)) ? Number(row.position) : 0,
      originalFilename: row?.original_filename ?? null,
      sourceUrl: row?.source_url ?? null,
      hash: row?.content_hash ?? null,
      mimeType: row?.mime_type ?? null,
      size: row?.size_bytes ?? null,
      width: row?.width ?? null,
      height: row?.height ?? null,
      variants: {
        original,
        preview: variantsRaw?.preview || null,
        thumbnail: variantsRaw?.thumbnail || null,
      },
    },
    row?.position ?? 0,
  );
  return asset;
}

class ProductMediaService {
  constructor({ storage, mediaObjectModel, imageProcessingService, mediaAssetService } = {}) {
    this.storage = storage || null;
    this.mediaObjectModel = mediaObjectModel || new ProductMediaObjectModel();
    this.imageProcessingService = imageProcessingService || new ImageProcessingService();
    this.mediaAssetService =
      mediaAssetService ||
      new MediaAssetService({
        storage: this.getStorage(),
        imageProcessingService: this.imageProcessingService,
      });
    this.fetchTimeoutMs = Math.max(
      1000,
      Number(process.env.PRODUCT_MEDIA_FETCH_TIMEOUT_MS || process.env.MEDIA_FETCH_TIMEOUT_MS) ||
        DEFAULT_FETCH_TIMEOUT_MS,
    );
  }

  getStorage() {
    if (!this.storage) {
      this.storage = new B2ObjectStorage();
    }
    return this.storage;
  }

  getProductAssets(product) {
    return normalizeProductImages(product?.images);
  }

  getProductImageUrls(product) {
    return collectProductOriginalImageUrls(product);
  }

  rowToAsset(row) {
    return buildAssetFromRow(row);
  }

  rowsToAssets(rows) {
    return (Array.isArray(rows) ? rows : [])
      .map((row) => this.rowToAsset(row))
      .filter(Boolean)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  buildRowPayloadFromAsset(asset, { productId, sourceKind }) {
    const original = asset?.variants?.original || {};
    return {
      productId,
      sourceKind,
      sourceUrl: asset?.sourceUrl ?? null,
      originalFilename: getAssetOriginalFilename(asset),
      storageKey: original.key,
      url: original.url,
      position: asset?.position ?? 0,
      contentHash: asset?.hash ?? null,
      mimeType: asset?.mimeType ?? original.mimeType ?? null,
      sizeBytes: asset?.size ?? original.size ?? null,
      width: asset?.width ?? original.width ?? null,
      height: asset?.height ?? original.height ?? null,
      variants: asset?.variants || {},
    };
  }

  buildDeleteTargets(rows) {
    const deleteTargets = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const asset = this.rowToAsset(row);
      deleteTargets.push(...collectAssetVariantDeleteTargets(asset));
    }
    return deleteTargets;
  }

  async fetchExternalBuffer(sourceUrl) {
    if (!isHttpUrl(sourceUrl)) {
      Logger.warn('Product media fetch rejected: invalid source URL', {
        sourceUrl: String(sourceUrl || '').trim() || null,
        code: 'PRODUCT_MEDIA_INVALID_IMAGE',
      });
      throw new AppError('External image URL must be http(s)', 400, 'PRODUCT_MEDIA_INVALID_IMAGE');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.fetchTimeoutMs);
    Logger.info('Product media fetch start', {
      sourceUrl: String(sourceUrl || '').trim(),
      timeoutMs: this.fetchTimeoutMs,
    });
    try {
      const response = await fetch(String(sourceUrl).trim(), {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
        Logger.warn('Product media fetch failed', {
          sourceUrl: String(sourceUrl || '').trim(),
          status: response.status,
          code: 'PRODUCT_MEDIA_FETCH_FAILED',
        });
        throw new AppError(
          `Failed to fetch external image: ${response.status}`,
          400,
          'PRODUCT_MEDIA_FETCH_FAILED',
        );
      }
      const contentLength = Number(response.headers.get('content-length') || 0);
      const storage = this.getStorage();
      if (contentLength > 0 && contentLength > storage.maxFileBytes) {
        Logger.warn('Product media fetch rejected: file too large', {
          sourceUrl: String(sourceUrl || '').trim(),
          contentLength,
          maxFileBytes: storage.maxFileBytes,
          code: 'PRODUCT_MEDIA_INVALID_IMAGE',
        });
        throw new AppError(
          `External image exceeds max size of ${storage.maxFileBytes} bytes`,
          400,
          'PRODUCT_MEDIA_INVALID_IMAGE',
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      Logger.info('Product media fetch success', {
        sourceUrl: String(sourceUrl || '').trim(),
        bytes: Number(arrayBuffer.byteLength || 0),
        mimeType: response.headers.get('content-type') || null,
      });
      return {
        buffer: Buffer.from(arrayBuffer),
        originalFilename: fileNameFromUrl(sourceUrl),
        mimeType: response.headers.get('content-type'),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      const detail = error?.name === 'AbortError' ? 'timeout' : String(error?.message || error);
      Logger.warn('Product media fetch failed', {
        sourceUrl: String(sourceUrl || '').trim(),
        detail,
        code: 'PRODUCT_MEDIA_FETCH_FAILED',
      });
      throw new AppError(
        `Failed to fetch external image: ${detail}`,
        400,
        'PRODUCT_MEDIA_FETCH_FAILED',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async createAssetFromProcessed(
    req,
    { productId, pendingScope, sourceKind, sourceUrl, position, processed },
  ) {
    const tenantId = req.session?.tenantId;
    if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
    const assetId = crypto.randomUUID();
    Logger.info('Product media upload start', {
      tenantId: String(tenantId),
      productId: productId != null ? String(productId) : null,
      pendingScope: pendingScope != null ? String(pendingScope) : null,
      sourceKind: String(sourceKind || '').trim() || null,
      sourceUrl: sourceUrl != null ? String(sourceUrl).trim() || null : null,
      position,
      assetId,
    });
    const asset = await this.mediaAssetService.createHostedAssetFromProcessed({
      tenantId: String(tenantId),
      productId: productId != null ? String(productId) : null,
      pendingScope,
      assetId,
      position,
      sourceUrl,
      processed,
    });
    const row = await this.mediaObjectModel.create(
      req,
      this.buildRowPayloadFromAsset(asset, { productId, sourceKind }),
    );
    Logger.info('Product media upload success', {
      tenantId: String(tenantId),
      productId: productId != null ? String(productId) : null,
      pendingScope: pendingScope != null ? String(pendingScope) : null,
      sourceKind: String(sourceKind || '').trim() || null,
      sourceUrl: sourceUrl != null ? String(sourceUrl).trim() || null : null,
      position,
      assetId,
      hash: asset?.hash || null,
      variantCount: Object.keys(asset?.variants || {}).length,
    });
    return this.rowToAsset(row) || asset;
  }

  async ensureAssetFromExternalUrl(
    req,
    { productId, pendingScope, sourceKind, sourceUrl, position, existingRows },
  ) {
    const fetched = await this.fetchExternalBuffer(sourceUrl);
    const processed = await this.imageProcessingService.buildImageAssetVariants({
      buffer: fetched.buffer,
      originalFilename: fetched.originalFilename,
      mimeType: fetched.mimeType,
    });
    const existingByHash = new Map(
      (Array.isArray(existingRows) ? existingRows : [])
        .filter((row) => row?.content_hash && String(row.content_hash).trim())
        .map((row) => [String(row.content_hash).trim(), row]),
    );
    const match = existingByHash.get(processed.hash) || null;
    if (match) {
      Logger.info('Product media upload skipped: reused existing asset', {
        productId: productId != null ? String(productId) : null,
        pendingScope: pendingScope != null ? String(pendingScope) : null,
        sourceKind: String(sourceKind || '').trim() || null,
        sourceUrl: sourceUrl != null ? String(sourceUrl).trim() || null : null,
        position,
        assetId: String(match.id || '').trim() || null,
        hash: processed.hash,
      });
      if (String(match.source_url || '').trim() !== String(sourceUrl || '').trim()) {
        await this.mediaObjectModel.updateById(req, match.id, {
          ...this.buildRowPayloadFromAsset(this.rowToAsset(match), {
            productId: match.product_id != null ? Number(match.product_id) : null,
            sourceKind: match.source_kind || sourceKind,
          }),
          sourceUrl,
          position,
        });
      }
      const asset = this.rowToAsset(match);
      asset.position = position;
      return { asset, reused: true };
    }
    const asset = await this.createAssetFromProcessed(req, {
      productId,
      pendingScope,
      sourceKind,
      sourceUrl,
      position,
      processed,
    });
    return { asset, reused: false };
  }

  async uploadPendingManualFiles(req, files, options = {}) {
    const tenantId = req.session?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
    }
    const userId = Context.getUserId(req);
    const productId =
      options?.productId != null && Number.isFinite(Number(options.productId))
        ? Number(options.productId)
        : null;
    const pendingScope =
      productId != null
        ? null
        : `manual/${userId != null ? String(userId).trim() || 'user' : 'user'}`;
    const uploads = [];
    for (let i = 0; i < (Array.isArray(files) ? files.length : 0); i += 1) {
      const file = files[i];
      const processed = await this.imageProcessingService.buildImageAssetVariants({
        buffer: file.buffer,
        originalFilename: file.originalname || 'image',
        mimeType: file.mimetype,
      });
      const asset = await this.createAssetFromProcessed(req, {
        productId,
        pendingScope,
        sourceKind: 'manual_upload',
        sourceUrl: null,
        position: i,
        processed,
      });
      uploads.push(asset);
    }
    Logger.info('Product media update success', {
      productId: productId != null ? String(productId) : null,
      sourceKind: 'manual_upload',
      uploadCount: uploads.length,
      userId: userId != null ? String(userId) : null,
    });
    return uploads;
  }

  async attachPendingAssetsToProduct(req, productId, assets) {
    const assetIds = normalizeProductImages(assets)
      .map((asset) => toTrimmedString(asset.assetId))
      .filter(Boolean);
    if (!assetIds.length) return [];
    return this.mediaObjectModel.attachPendingIdsToProduct(req, productId, assetIds);
  }

  buildCanonicalHostedImagesFromRows(rows) {
    const list = (Array.isArray(rows) ? rows : [])
      .map((row) => this.rowToAsset(row))
      .filter(Boolean)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const mainImage = list.length ? getAssetOriginalUrl(list[0]) : null;
    return { mainImage, images: list };
  }

  /**
   * When media was uploaded before a Homebase product id existed, objects live under a pending
   * prefix (e.g. manual-user-<id>). After attach, copy them under tenant/products/<productId>/…
   * and update DB + delete old objects. Returns true if this row was promoted.
   */
  async promoteProductMediaRowIfNeeded(req, row, productId) {
    const tenantId = req.session?.tenantId;
    const pid = Number(productId);
    if (!tenantId || !Number.isFinite(pid)) return false;
    const rowProductId =
      row?.product_id != null && Number.isFinite(Number(row.product_id))
        ? Number(row.product_id)
        : null;
    if (rowProductId !== pid) return false;

    const storage = this.getStorage();
    const asset = this.rowToAsset(row);
    const keys = collectAssetVariantKeys(asset);
    if (!keys.length) return false;

    const expectedPrefix = hostedProductObjectPrefix(tenantId, pid);
    if (keys.every((k) => String(k).startsWith(expectedPrefix))) return false;
    if (!keys.every((k) => isManagedTenantProductsKey(k, tenantId))) return false;

    const hash = toTrimmedString(row.content_hash);
    if (!hash) return false;

    const safeAssetId = String(row.id || '').trim();
    if (!safeAssetId) return false;

    const position =
      row.position != null && Number.isFinite(Number(row.position))
        ? Math.trunc(Number(row.position))
        : 0;

    const variantNames = ['original', 'preview', 'thumbnail'];
    const oldKeysToCopy = new Set();
    for (const vn of variantNames) {
      const oldKey = toTrimmedString(asset?.variants?.[vn]?.key);
      if (!oldKey) return false;
      if (!oldKey.startsWith(expectedPrefix)) oldKeysToCopy.add(oldKey);
    }
    if (!oldKeysToCopy.size) return false;

    const oldDeleteTargets = collectAssetVariantDeleteTargets(asset);
    const copiedOldKeys = new Set();
    const newKeysCreated = [];

    try {
      const keyMap = new Map();
      for (const oldKey of oldKeysToCopy) {
        const variant = hostedVariantFromObjectKey(oldKey);
        if (!variant) {
          throw new AppError(
            'Invalid hosted media object key layout',
            500,
            'PRODUCT_MEDIA_SCHEMA_INVALID',
          );
        }
        const ext = extensionFromVariantKey(oldKey) || 'bin';
        const newKey = storage.buildAssetVariantKey({
          tenantId: String(tenantId),
          productId: String(pid),
          pendingScope: null,
          assetId: safeAssetId,
          position,
          variant,
          hash,
          extension: ext,
        });
        if (newKey === oldKey) continue;
        const uploaded = await storage.copyObjectWithinBucket({
          sourceKey: oldKey,
          destinationKey: newKey,
        });
        copiedOldKeys.add(oldKey);
        newKeysCreated.push(newKey);
        keyMap.set(oldKey, uploaded);
      }

      const nextVariants = { ...asset.variants };
      for (const vn of variantNames) {
        const prev = nextVariants[vn];
        const prevKey = toTrimmedString(prev?.key);
        if (!prevKey) continue;
        const mapped = keyMap.get(prevKey);
        if (!mapped) continue;
        nextVariants[vn] = {
          ...prev,
          key: mapped.key,
          url: mapped.publicUrl,
          versionId: mapped.versionId,
        };
      }

      const merged = normalizeProductImageAsset(
        {
          ...asset,
          variants: nextVariants,
        },
        position,
      );
      if (!merged) {
        throw new AppError(
          'Failed to normalize promoted media asset',
          500,
          'PRODUCT_MEDIA_SCHEMA_INVALID',
        );
      }

      await this.mediaObjectModel.updateById(req, row.id, {
        ...this.buildRowPayloadFromAsset(merged, {
          productId: pid,
          sourceKind: row.source_kind,
        }),
      });

      const deleteTargets = oldDeleteTargets.filter((t) =>
        copiedOldKeys.has(String(t.key || '').trim()),
      );
      if (deleteTargets.length) {
        await storage.deleteObjects(deleteTargets);
      }
      return true;
    } catch (error) {
      if (newKeysCreated.length) {
        try {
          await storage.deleteObjects(newKeysCreated.map((key) => ({ key })));
        } catch {
          /* best-effort rollback */
        }
      }
      throw error;
    }
  }

  /**
   * Copy managed media from source product to destination: new B2 keys + new product_media_objects rows.
   */
  async duplicateManagedMediaBetweenProducts(req, sourceProductId, destProductId) {
    const tenantId = req.session?.tenantId;
    if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
    const srcPid = Number(sourceProductId);
    const dstPid = Number(destProductId);
    if (!Number.isFinite(srcPid) || !Number.isFinite(dstPid)) {
      throw new AppError('Invalid product id', 400, AppError.CODES.VALIDATION_ERROR);
    }
    const storage = this.getStorage();
    const rows = await this.mediaObjectModel.listByProductId(req, srcPid);
    for (const row of rows) {
      const asset = this.rowToAsset(row);
      const hash = toTrimmedString(row.content_hash);
      if (!hash) {
        Logger.warn('duplicateManagedMediaBetweenProducts: skip row without content_hash', {
          rowId: row?.id ?? null,
        });
        continue;
      }
      const position =
        row.position != null && Number.isFinite(Number(row.position))
          ? Math.trunc(Number(row.position))
          : 0;
      const newAssetId = crypto.randomUUID();
      const variantNames = ['original', 'preview', 'thumbnail'];
      const keyMap = new Map();
      for (const vn of variantNames) {
        const prevKey = toTrimmedString(asset?.variants?.[vn]?.key);
        if (!prevKey) continue;
        const ext = extensionFromVariantKey(prevKey) || 'bin';
        const newKey = storage.buildAssetVariantKey({
          tenantId: String(tenantId),
          productId: String(dstPid),
          pendingScope: null,
          assetId: newAssetId,
          position,
          variant: vn,
          hash,
          extension: ext,
        });
        const uploaded = await storage.copyObjectWithinBucket({
          sourceKey: prevKey,
          destinationKey: newKey,
        });
        keyMap.set(prevKey, uploaded);
      }
      const nextVariants = { ...asset.variants };
      for (const vn of variantNames) {
        const prev = nextVariants[vn];
        const prevKey = toTrimmedString(prev?.key);
        if (!prevKey) continue;
        const mapped = keyMap.get(prevKey);
        if (!mapped) continue;
        nextVariants[vn] = {
          ...prev,
          key: mapped.key,
          url: mapped.publicUrl,
          versionId: mapped.versionId,
        };
      }
      const merged = normalizeProductImageAsset(
        {
          ...asset,
          assetId: newAssetId,
          variants: nextVariants,
        },
        position,
      );
      if (!merged) continue;
      await this.mediaObjectModel.createWithExplicitId(
        req,
        newAssetId,
        this.buildRowPayloadFromAsset(merged, {
          productId: dstPid,
          sourceKind: row.source_kind,
        }),
      );
    }
    const rowsLive = await this.mediaObjectModel.listByProductId(req, dstPid);
    return this.buildCanonicalHostedImagesFromRows(rowsLive);
  }

  async syncAssetPositions(req, productId, assets) {
    const ordered = normalizeProductImages(assets);
    const rows = await this.mediaObjectModel.listByProductId(req, productId);
    const byId = new Map(rows.map((row) => [String(row.id), row]));
    for (let i = 0; i < ordered.length; i += 1) {
      const assetId = toTrimmedString(ordered[i]?.assetId);
      const row = assetId ? byId.get(assetId) : null;
      if (!row) continue;
      const current = Number.isFinite(Number(row.position)) ? Number(row.position) : 0;
      if (current === i) continue;
      await this.mediaObjectModel.updateById(req, row.id, {
        ...this.buildRowPayloadFromAsset(this.rowToAsset(row), {
          productId: row.product_id != null ? Number(row.product_id) : null,
          sourceKind: row.source_kind,
        }),
        position: i,
      });
    }
  }

  rowMatchesAsset(row, keepAssetIds, keepKeys, keepUrls) {
    const rowId = String(row?.id || '').trim();
    if (rowId && keepAssetIds.has(rowId)) return true;
    const asset = this.rowToAsset(row);
    const originalUrl = getAssetOriginalUrl(asset);
    if (originalUrl && keepUrls.has(originalUrl)) return true;
    const keys = collectAssetVariantKeys(asset);
    if (keys.some((key) => keepKeys.has(key))) return true;
    const bucket = String(this.getStorage().bucket || '').trim();
    if (!bucket) return false;
    for (const keepUrl of keepUrls) {
      const extracted = objectKeyFromB2FileUrl(keepUrl, bucket);
      if (extracted && keys.includes(extracted)) return true;
    }
    return false;
  }

  async reconcileAttachedProductMedia(req, productId, images) {
    const normalizedAssets = normalizeProductImages(images);
    await this.attachPendingAssetsToProduct(req, productId, normalizedAssets);

    const rows = await this.mediaObjectModel.listByProductId(req, productId);
    const keepAssetIds = new Set(
      normalizedAssets.map((asset) => toTrimmedString(asset.assetId)).filter(Boolean),
    );
    const keepUrls = new Set(
      normalizedAssets.map((asset) => getAssetOriginalUrl(asset)).filter(Boolean),
    );
    const keepKeys = new Set();
    for (const asset of normalizedAssets) {
      for (const key of collectAssetVariantKeys(asset)) {
        keepKeys.add(key);
      }
    }
    const stale = rows.filter(
      (row) => !this.rowMatchesAsset(row, keepAssetIds, keepKeys, keepUrls),
    );
    if (stale.length) {
      await this.deleteManagedRows(req, stale, {
        productId: String(productId || '').trim() || null,
        reason: 'reconcile_stale_assets',
      });
      await this.mediaObjectModel.deleteByIds(
        req,
        stale.map((row) => row.id),
      );
    }
    await this.syncAssetPositions(req, productId, normalizedAssets);

    let rowsLive = await this.mediaObjectModel.listByProductId(req, productId);
    let promotedAny = false;
    for (const row of rowsLive) {
      const did = await this.promoteProductMediaRowIfNeeded(req, row, productId);
      if (did) promotedAny = true;
    }
    if (promotedAny) {
      rowsLive = await this.mediaObjectModel.listByProductId(req, productId);
    }

    const canonical = this.buildCanonicalHostedImagesFromRows(rowsLive);
    Logger.info('Product media update success', {
      productId: String(productId || '').trim() || null,
      assetCount: normalizedAssets.length,
      deletedAssetCount: stale.length,
      promotedAny,
    });
    return {
      changed: promotedAny,
      mainImage: canonical.mainImage,
      images: canonical.images,
    };
  }

  async ensureHostedSelloMedia(req, { productId, selloId, sourceUrls }) {
    const pid = productId != null && Number.isFinite(Number(productId)) ? Number(productId) : null;
    const normalizedSources = Array.isArray(sourceUrls)
      ? sourceUrls
          .map((raw) => String(raw || '').trim())
          .map((value) => (value.startsWith('//') ? `https:${value}` : value))
          .filter((value, index, list) => value && list.indexOf(value) === index)
      : [];
    if (!normalizedSources.length) {
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

    const existingRows =
      pid != null
        ? await this.mediaObjectModel.listByProductId(req, pid)
        : await this.mediaObjectModel.findPendingBySourceUrls(req, normalizedSources);

    let uploadedCount = 0;
    let reusedCount = 0;
    let failedCount = 0;

    const results = await mapPool(
      normalizedSources.length,
      Math.min(8, normalizedSources.length),
      async (i) => {
        const sourceUrl = normalizedSources[i];
        if (!isHttpUrl(sourceUrl)) return null;
        try {
          const { asset, reused } = await this.ensureAssetFromExternalUrl(req, {
            productId: pid,
            pendingScope: String(selloId || '').trim() || 'unknown',
            sourceKind: 'sello_import',
            sourceUrl,
            position: i,
            existingRows,
          });
          if (reused) reusedCount += 1;
          else uploadedCount += 1;
          return asset;
        } catch (error) {
          failedCount += 1;
          Logger.warn('Failed to host Sello image', {
            productId: pid,
            selloId: String(selloId || '').trim() || null,
            sourceUrl,
            code:
              error instanceof AppError && PRODUCT_MEDIA_ERROR_CODES.has(error.code)
                ? error.code
                : 'PRODUCT_MEDIA_UPLOAD_FAILED',
            error: String(error?.message || error),
          });
          return null;
        }
      },
    );

    const assets = results.filter(Boolean).map((asset, position) => ({ ...asset, position }));
    const ordered = reorderAssetsByMainImage(assets, getAssetOriginalUrl(assets[0]));
    const mainImage = ordered.length ? getAssetOriginalUrl(ordered[0]) : null;

    return {
      mainImage,
      images: ordered,
      allHostedUrls: ordered.map((asset) => getAssetOriginalUrl(asset)).filter(Boolean),
      uploadedCount,
      reusedCount,
      failedCount,
    };
  }

  async ensureProductMedia(req, { productId, mainImage, images }) {
    const pid = productId != null && Number.isFinite(Number(productId)) ? Number(productId) : null;
    const existingRows = pid != null ? await this.mediaObjectModel.listByProductId(req, pid) : [];
    const existingByHash = new Map(
      existingRows
        .filter((row) => row?.content_hash && String(row.content_hash).trim())
        .map((row) => [String(row.content_hash).trim(), row]),
    );
    const normalizedIncoming = normalizeProductImages(images);
    const mainUrl = toTrimmedString(mainImage);
    const incomingAssetIds = normalizedIncoming
      .map((asset) => toTrimmedString(asset.assetId))
      .filter(Boolean);
    const incomingRows = incomingAssetIds.length
      ? await this.mediaObjectModel.findByIds(req, incomingAssetIds)
      : [];
    const incomingRowsById = new Map(incomingRows.map((row) => [String(row.id), row]));

    const desired = [];
    if (mainUrl) {
      const mainAsset =
        normalizedIncoming.find((asset) => getAssetOriginalUrl(asset) === mainUrl) ||
        normalizeProductImageAsset(mainUrl, 0);
      if (mainAsset) desired.push(mainAsset);
    }
    for (const asset of normalizedIncoming) {
      const url = getAssetOriginalUrl(asset);
      if (!url) continue;
      if (mainUrl && url === mainUrl) continue;
      desired.push(asset);
    }

    const output = [];
    const seenHashes = new Set();
    const duplicatePendingIds = [];
    for (let i = 0; i < desired.length; i += 1) {
      const asset = desired[i];
      const requestedAssetId = toTrimmedString(asset?.assetId);
      const incomingRow = requestedAssetId ? incomingRowsById.get(requestedAssetId) : null;
      const incomingRowProductId =
        incomingRow?.product_id != null && Number.isFinite(Number(incomingRow.product_id))
          ? Number(incomingRow.product_id)
          : null;
      const canReuseIncomingRow =
        !!incomingRow && (incomingRowProductId == null || incomingRowProductId === pid);
      const resolvedAsset = canReuseIncomingRow ? this.rowToAsset(incomingRow) : asset;
      const resolvedHash = toTrimmedString(resolvedAsset?.hash);
      if (resolvedHash && seenHashes.has(resolvedHash)) {
        if (incomingRow && incomingRow.product_id == null)
          duplicatePendingIds.push(String(incomingRow.id));
        continue;
      }
      if (resolvedHash && existingByHash.has(resolvedHash)) {
        const row = existingByHash.get(resolvedHash);
        const existingAsset = this.rowToAsset(row);
        if (existingAsset) {
          output.push({ ...existingAsset, position: i });
          seenHashes.add(resolvedHash);
          if (
            incomingRow &&
            String(incomingRow.id) !== String(row.id) &&
            incomingRow.product_id == null
          ) {
            duplicatePendingIds.push(String(incomingRow.id));
          }
          continue;
        }
      }
      const assetId = canReuseIncomingRow ? requestedAssetId : null;
      if (assetId) {
        output.push({ ...resolvedAsset, position: i });
        if (resolvedHash) seenHashes.add(resolvedHash);
        continue;
      }
      const originalUrl = getAssetOriginalUrl(resolvedAsset);
      const sourceUrl = toTrimmedString(resolvedAsset?.sourceUrl) || originalUrl;
      if (sourceUrl && isHttpUrl(sourceUrl)) {
        const { asset: hostedAsset } = await this.ensureAssetFromExternalUrl(req, {
          productId: pid,
          pendingScope: 'manual-external',
          sourceKind: 'external_url',
          sourceUrl,
          position: i,
          existingRows,
        });
        output.push({ ...hostedAsset, position: i });
        if (hostedAsset?.hash) seenHashes.add(String(hostedAsset.hash));
        continue;
      }
    }

    if (duplicatePendingIds.length) {
      const rows = await this.mediaObjectModel.findByIds(req, duplicatePendingIds);
      await this.deleteManagedRows(req, rows, { reason: 'dedupe_pending_rows' });
      await this.mediaObjectModel.deleteByIds(req, duplicatePendingIds);
    }

    const ordered = output.map((asset, position) => ({ ...asset, position }));
    const finalMain = ordered.length ? getAssetOriginalUrl(ordered[0]) : null;
    Logger.info('Product media update success', {
      productId: pid != null ? String(pid) : null,
      assetCount: ordered.length,
      dedupeDropCount: duplicatePendingIds.length,
    });
    return { mainImage: finalMain, images: ordered };
  }

  async deleteManagedRows(req, rows, context = {}) {
    const seenPid = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      const pid = row?.product_id;
      if (pid == null || !Number.isFinite(Number(pid))) {
        continue;
      }
      const n = Number(pid);
      if (seenPid.has(n)) {
        continue;
      }
      seenPid.add(n);
      await duplicateMediaTaskModel.assertSourceNotLockedForActiveDuplicateMediaTask(req, n);
    }
    const deleteTargets = this.buildDeleteTargets(rows);
    const assetCount = Array.isArray(rows) ? rows.length : 0;
    const details = {
      productId: context?.productId ?? null,
      reason: context?.reason ?? null,
      assetCount,
      objectCount: deleteTargets.length,
    };
    if (!deleteTargets.length) {
      Logger.info('Product media delete success', details);
      return { deletedAssetCount: assetCount, deletedObjectCount: 0 };
    }
    Logger.info('Product media delete start', details);
    try {
      await this.getStorage().deleteObjects(deleteTargets);
      Logger.info('Product media delete success', details);
      return { deletedAssetCount: assetCount, deletedObjectCount: deleteTargets.length };
    } catch (error) {
      Logger.error('Product media delete failed', error, details);
      throw toProductMediaError(error, {
        message: 'Failed to delete product media from B2',
        statusCode: 500,
        code: 'PRODUCT_MEDIA_DELETE_FAILED',
        details,
      });
    }
  }

  async deleteProductMediaStrict(req, productId) {
    const productIdText = String(productId || '').trim();
    const rows = await this.mediaObjectModel.listByProductId(req, productId);
    return this.deleteManagedRows(req, rows, {
      productId: productIdText || null,
      reason: 'delete_product',
    });
  }

  async deleteProductsMediaStrictPartial(req, productIds) {
    const ids = Array.from(
      new Set(
        (Array.isArray(productIds) ? productIds : [])
          .map((id) => String(id || '').trim())
          .filter(Boolean),
      ),
    );
    const okIds = [];
    const failed = [];
    for (const productId of ids) {
      try {
        await this.deleteProductMediaStrict(req, productId);
        okIds.push(productId);
      } catch (error) {
        const normalized = toProductMediaError(error, {
          message: 'Failed to delete product media from B2',
          statusCode: 500,
          code: 'PRODUCT_MEDIA_DELETE_FAILED',
          details: { productId },
        });
        failed.push({
          productId,
          code: normalized.code,
          message: normalized.message,
          details: normalized.details || null,
        });
      }
    }
    return { okIds, failed };
  }

  async deleteProductMedia(req, productId) {
    return this.deleteProductMediaStrict(req, productId);
  }

  async deleteProductsMedia(req, productIds) {
    const rows = await this.mediaObjectModel.listByProductIds(req, productIds);
    return this.deleteManagedRows(req, rows, {
      reason: 'delete_products_batch',
      productId: null,
    });
  }
}

module.exports = {
  ProductMediaService,
  collectProductImageUrls: collectProductOriginalImageUrls,
};
