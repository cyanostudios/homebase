const crypto = require('crypto');
const path = require('path');

const { Context, Logger } = require('@homebase/core');

const { AppError } = require('../../server/core/errors/AppError');
const {
  B2ObjectStorage,
  objectKeyFromB2FileUrl,
} = require('../../server/core/services/storage/b2ObjectStorage');
const {
  ImageProcessingService,
} = require('../../server/core/services/storage/imageProcessingService');
const { MediaAssetService } = require('../../server/core/services/storage/mediaAssetService');
const ProductMediaObjectModel = require('./productMediaObjectModel');
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

  async fetchExternalBuffer(sourceUrl) {
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
      return {
        buffer: Buffer.from(arrayBuffer),
        originalFilename: fileNameFromUrl(sourceUrl),
        mimeType: response.headers.get('content-type'),
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
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

  async createAssetFromProcessed(
    req,
    { productId, pendingScope, sourceKind, sourceUrl, position, processed },
  ) {
    const tenantId = req.session?.tenantId;
    if (!tenantId) throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
    const assetId = crypto.randomUUID();
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

  async uploadPendingManualFiles(req, files) {
    const tenantId = req.session?.tenantId;
    if (!tenantId) {
      throw new AppError('Tenant not resolved', 401, AppError.CODES.UNAUTHORIZED);
    }
    const userId = Context.getUserId(req);
    const uploads = [];
    for (let i = 0; i < (Array.isArray(files) ? files.length : 0); i += 1) {
      const file = files[i];
      const processed = await this.imageProcessingService.buildImageAssetVariants({
        buffer: file.buffer,
        originalFilename: file.originalname || 'image',
        mimeType: file.mimetype,
      });
      const asset = await this.createAssetFromProcessed(req, {
        productId: null,
        pendingScope: `manual/${userId != null ? String(userId).trim() || 'user' : 'user'}`,
        sourceKind: 'manual_upload',
        sourceUrl: null,
        position: i,
        processed,
      });
      uploads.push(asset);
    }
    return uploads;
  }

  async attachPendingAssetsToProduct(req, productId, assets) {
    const assetIds = normalizeProductImages(assets)
      .map((asset) => toTrimmedString(asset.assetId))
      .filter(Boolean);
    if (!assetIds.length) return [];
    return this.mediaObjectModel.attachPendingIdsToProduct(req, productId, assetIds);
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
      await this.deleteManagedRows(stale);
      await this.mediaObjectModel.deleteByIds(
        req,
        stale.map((row) => row.id),
      );
    }
    await this.syncAssetPositions(req, productId, normalizedAssets);
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
            pendingScope: `sello/${String(selloId || '').trim() || 'unknown'}`,
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
      await this.deleteManagedRows(rows);
      await this.mediaObjectModel.deleteByIds(req, duplicatePendingIds);
    }

    const ordered = output.map((asset, position) => ({ ...asset, position }));
    const finalMain = ordered.length ? getAssetOriginalUrl(ordered[0]) : null;
    return { mainImage: finalMain, images: ordered };
  }

  async deleteManagedRows(rows) {
    const deleteTargets = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const asset = this.rowToAsset(row);
      deleteTargets.push(...collectAssetVariantDeleteTargets(asset));
    }
    if (!deleteTargets.length) return;
    await this.getStorage().deleteObjects(deleteTargets);
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
  collectProductImageUrls: collectProductOriginalImageUrls,
};
