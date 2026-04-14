const path = require('path');
const crypto = require('crypto');

const { Logger } = require('@homebase/core');
const {
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectsCommand,
  ListObjectVersionsCommand,
  S3Client,
} = require('@aws-sdk/client-s3');
const FileType = require('file-type');

const { AppError } = require('../../errors/AppError');

const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

/**
 * Storage path segment for product id: strip legacy `sello-` prefix only here (not app identity).
 */
function normalizeProductIdForStorageKey(productId) {
  const raw = String(productId || '').trim();
  if (!raw) return '';
  return raw.replace(/^sello-/i, '');
}

/**
 * Extract S3 object key from:
 * - B2 Friendly URL: https://{host}/file/{bucket}/{key...} → key
 * - Custom domain root path: https://media.example/{key...} → key (pathname without leading slash)
 *
 * Used so reconcile can match rows when the public base URL shape differs (Friendly vs custom domain).
 */
function objectKeyFromB2FileUrl(fileUrl, bucketName) {
  const b = String(bucketName || '').trim();
  if (!fileUrl) return null;
  try {
    const u = new URL(String(fileUrl).trim());
    const p = u.pathname || '';

    if (b && p.startsWith(`/file/${b}/`)) {
      const rest = p.slice(`/file/${b}/`.length).replace(/^\/+/, '');
      return rest || null;
    }

    const friendly = p.match(/^\/file\/[^/]+\/(.+)$/);
    if (friendly) {
      const rest = friendly[1].replace(/^\/+/, '');
      return rest || null;
    }

    if (p.length > 1) {
      return p.replace(/^\/+/, '') || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Public file URL: https://{downloadHost}/file/{bucket}/{key}
 *
 * B2_PUBLIC_BASE_URL:
 * - Copy the **Friendly URL** base from Backblaze UI → your bucket → something like
 *   `https://f004.backblazeb2.com/file/your-bucket` (the `fNNN` host is assigned per bucket/pod).
 * - Do **not** derive `f003` vs `f004` from `B2_REGION` (e.g. `eu-central-003`); that is the S3 API
 *   region code and is a different numbering than the public `fXXX` download hostname.
 * - Must use the same bucket name in the path as `B2_BUCKET` or browsers 404.
 *
 * S3 uploads use `B2_ENDPOINT` + `B2_REGION` + `B2_BUCKET` (see bucket “Endpoint” in B2). The public
 * `fXXX` host is only used to build `getPublicUrl()` after upload.
 *
 * **Anonymous browser access:** For `<img src="https://f….backblazeb2.com/file/…">` to work, the bucket
 * must allow **public read** (B2: bucket type / “Files in Bucket are… Public” / public download caps).
 * A **Private** bucket returns 403 for those URLs — images will look broken in Homebase even after upload.
 *
 * **Custom domain (root path):** Set `B2_PUBLIC_BASE_URL` to `https://media.example` with no `/file/{bucket}`
 * segment. Public URLs become `https://media.example/<object-key>` (Cloudflare/B2 custom domain in front
 * of the same bucket). In that case this function does **not** inject `/file/{bucket}`.
 */
function normalizeB2PublicBaseUrl(rawPublicBaseUrl, bucketName) {
  const bucket = String(bucketName || '').trim();
  const raw = trimTrailingSlash(String(rawPublicBaseUrl || ''));
  if (!raw || !bucket) return raw;

  let u;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }

  const before = u.pathname || '';

  if (!before.startsWith('/file/')) {
    if (before === '/' || before === '') {
      return trimTrailingSlash(u.origin);
    }
    return trimTrailingSlash(u.toString());
  }

  const m = u.pathname.match(/^\/file\/([^/]+)\/?$/);
  if (m) {
    if (m[1] !== bucket) {
      u.pathname = `/file/${bucket}`;
    }
  } else {
    u.pathname = `/file/${bucket}`;
  }

  if (before !== u.pathname) {
    Logger.warn('B2_PUBLIC_BASE_URL path normalized to match B2_BUCKET', {
      before,
      after: u.pathname,
      bucket,
    });
  }

  return trimTrailingSlash(u.toString());
}

function sanitizePathSegment(value, fallback) {
  const clean = String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return clean || fallback;
}

function ensureHttpsUrl(value, envName) {
  const raw = trimTrailingSlash(value);
  if (!raw) {
    throw new AppError(`${envName} is not configured`, 500, 'PRODUCT_MEDIA_STORAGE_NOT_CONFIGURED');
  }
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new AppError(
      `${envName} must be a valid URL`,
      500,
      'PRODUCT_MEDIA_STORAGE_NOT_CONFIGURED',
    );
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new AppError(
      `${envName} must use http or https`,
      500,
      'PRODUCT_MEDIA_STORAGE_NOT_CONFIGURED',
    );
  }
  return raw;
}

function extensionFromMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/avif') return 'avif';
  return 'bin';
}

function normalizeUploadInfo(originalFilename, mimeType, detectedExt) {
  const parsed = path.parse(String(originalFilename || '').trim());
  const safeName = sanitizePathSegment(parsed.name, 'image');
  const ext = detectedExt || extensionFromMimeType(mimeType);
  return {
    originalFilename: parsed.base || `${safeName}.${ext}`,
    safeBaseName: safeName,
    extension: ext,
  };
}

class B2ObjectStorage {
  constructor(options = {}) {
    const driver = String(options.driver || process.env.STORAGE_DRIVER || 'b2')
      .trim()
      .toLowerCase();
    if (driver !== 'b2') {
      throw new AppError(
        'STORAGE_DRIVER must be set to b2 for hosted product media',
        500,
        'PRODUCT_MEDIA_STORAGE_NOT_CONFIGURED',
      );
    }

    this.bucket = String(options.bucket || process.env.B2_BUCKET || '').trim();
    const rawPublic = options.publicBaseUrl || process.env.B2_PUBLIC_BASE_URL;
    this.publicBaseUrl = normalizeB2PublicBaseUrl(
      ensureHttpsUrl(rawPublic, 'B2_PUBLIC_BASE_URL'),
      this.bucket,
    );
    this.maxFileBytes = Math.max(
      1,
      Number(options.maxFileBytes || process.env.MEDIA_MAX_FILE_BYTES) || DEFAULT_MAX_FILE_BYTES,
    );

    const endpoint = ensureHttpsUrl(options.endpoint || process.env.B2_ENDPOINT, 'B2_ENDPOINT');
    const region = String(options.region || process.env.B2_REGION || '').trim();
    const accessKeyId = String(options.accessKeyId || process.env.B2_KEY_ID || '').trim();
    const secretAccessKey = String(
      options.secretAccessKey || process.env.B2_APPLICATION_KEY || '',
    ).trim();

    if (!this.bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new AppError(
        'Backblaze B2 storage credentials are not fully configured',
        500,
        'PRODUCT_MEDIA_STORAGE_NOT_CONFIGURED',
      );
    }

    // Path-style requests: https://s3.<region>.backblazeb2.com/<bucket>/<key>
    // B2’s S3-compatible API expects this; virtual-hosted-style (default in AWS SDK v3) is unreliable.
    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    });
  }

  async validateImageBuffer({ buffer, originalFilename, declaredMimeType }) {
    const size = Buffer.isBuffer(buffer) ? buffer.length : 0;
    if (!size) {
      Logger.warn('Product media validation failed: empty image buffer', {
        originalFilename: String(originalFilename || '').trim() || null,
        code: 'PRODUCT_MEDIA_INVALID_IMAGE',
      });
      throw new AppError('Uploaded image is empty', 400, 'PRODUCT_MEDIA_INVALID_IMAGE');
    }
    if (size > this.maxFileBytes) {
      Logger.warn('Product media validation failed: file too large', {
        originalFilename: String(originalFilename || '').trim() || null,
        size,
        maxFileBytes: this.maxFileBytes,
        code: 'PRODUCT_MEDIA_INVALID_IMAGE',
      });
      throw new AppError(
        `Uploaded image exceeds max size of ${this.maxFileBytes} bytes`,
        400,
        'PRODUCT_MEDIA_INVALID_IMAGE',
      );
    }

    const detected = await FileType.fromBuffer(buffer);
    const mimeType = String(detected?.mime || declaredMimeType || '').toLowerCase();
    if (!ALLOWED_IMAGE_MIME.has(mimeType)) {
      Logger.warn('Product media validation failed: unsupported mime type', {
        originalFilename: String(originalFilename || '').trim() || null,
        mimeType: mimeType || null,
        code: 'PRODUCT_MEDIA_INVALID_IMAGE',
      });
      throw new AppError(
        `Unsupported image type: ${mimeType || 'unknown'}`,
        400,
        'PRODUCT_MEDIA_INVALID_IMAGE',
      );
    }

    const {
      originalFilename: normalizedFilename,
      safeBaseName,
      extension,
    } = normalizeUploadInfo(originalFilename, mimeType, detected?.ext || null);

    return {
      buffer,
      size,
      mimeType,
      originalFilename: normalizedFilename,
      safeBaseName,
      extension,
    };
  }

  buildProductMediaKey({ tenantId, scope, originalFilename, mimeType }) {
    const safeTenantId = sanitizePathSegment(tenantId, 'tenant');
    const safeScope = sanitizePathSegment(scope, 'media');
    const info = normalizeUploadInfo(originalFilename, mimeType);
    const randomHex = crypto.randomBytes(16).toString('hex');
    return `${safeTenantId}/products/${safeScope}/${info.safeBaseName}-${randomHex}.${info.extension}`;
  }

  buildAssetVariantKey({
    tenantId,
    productId,
    pendingScope,
    assetId,
    position,
    variant,
    hash,
    extension,
  }) {
    const safeTenantId = sanitizePathSegment(tenantId, 'tenant');
    const safeVariant = sanitizePathSegment(variant, 'original');
    const safeAssetId = sanitizePathSegment(assetId, 'asset');
    const safeHash = sanitizePathSegment(hash, 'hash');
    const ext = sanitizePathSegment(extension, 'bin');
    const pos = Number.isFinite(Number(position)) ? Math.max(0, Math.trunc(Number(position))) : 0;
    if (productId != null && String(productId).trim() !== '') {
      const pathProductId = normalizeProductIdForStorageKey(productId);
      const safeProductId = sanitizePathSegment(pathProductId, 'product');
      return `${safeTenantId}/products/${safeProductId}/${safeVariant}/${pos}_${safeAssetId}_${safeHash}.${ext}`;
    }
    const rawPending = String(pendingScope || 'pending')
      .trim()
      .replace(/\//g, '-');
    const pathPending = normalizeProductIdForStorageKey(rawPending);
    const safePending = sanitizePathSegment(pathPending || rawPending || 'pending', 'pending');
    return `${safeTenantId}/products/${safePending}/${safeVariant}/${pos}_${safeAssetId}_${safeHash}.${ext}`;
  }

  getPublicUrl(key) {
    return `${this.publicBaseUrl}/${String(key || '').replace(/^\/+/, '')}`;
  }

  async uploadBuffer({
    buffer,
    originalFilename,
    declaredMimeType,
    contentType,
    key,
    cacheControl,
  }) {
    const validated = await this.validateImageBuffer({
      buffer,
      originalFilename: originalFilename || 'image',
      declaredMimeType: declaredMimeType || contentType,
    });
    const finalKey =
      String(key || '').trim() ||
      this.buildProductMediaKey({
        tenantId: 'tenant',
        scope: 'media',
        originalFilename: validated.originalFilename,
        mimeType: validated.mimeType,
      });

    try {
      const response = await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: finalKey,
          Body: validated.buffer,
          ContentType: contentType || validated.mimeType,
          CacheControl: cacheControl || 'public, max-age=31536000, immutable',
        }),
      );
      return {
        key: finalKey,
        publicUrl: this.getPublicUrl(finalKey),
        mimeType: validated.mimeType,
        size: validated.size,
        originalFilename: validated.originalFilename,
        versionId: String(response?.VersionId || '').trim() || null,
      };
    } catch (error) {
      Logger.error('B2 upload failed', error, { bucket: this.bucket, key: finalKey });
      throw new AppError(
        'Failed to upload product media to B2',
        500,
        'PRODUCT_MEDIA_UPLOAD_FAILED',
      );
    }
  }

  /**
   * Server-side copy within the same bucket (B2 S3-compatible API).
   * Preserves metadata/content-type from the source object.
   */
  async copyObjectWithinBucket({ sourceKey, destinationKey }) {
    const src = String(sourceKey || '').trim();
    const dst = String(destinationKey || '').trim();
    if (!src || !dst) {
      throw new AppError(
        'copyObjectWithinBucket requires sourceKey and destinationKey',
        500,
        'PRODUCT_MEDIA_UPLOAD_FAILED',
      );
    }
    if (src === dst) {
      return {
        key: dst,
        publicUrl: this.getPublicUrl(dst),
        versionId: null,
      };
    }
    try {
      const response = await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: dst,
          CopySource: `${this.bucket}/${encodeURIComponent(src)}`,
          MetadataDirective: 'COPY',
        }),
      );
      return {
        key: dst,
        publicUrl: this.getPublicUrl(dst),
        versionId: String(response?.VersionId || '').trim() || null,
      };
    } catch (error) {
      Logger.error('B2 copy failed', error, {
        bucket: this.bucket,
        sourceKey: src,
        destinationKey: dst,
      });
      throw new AppError('Failed to copy product media in B2', 500, 'PRODUCT_MEDIA_UPLOAD_FAILED');
    }
  }

  async uploadImageBuffer({ buffer, originalFilename, declaredMimeType, key }) {
    return this.uploadBuffer({ buffer, originalFilename, declaredMimeType, key });
  }

  async listObjectVersionsForKey(key) {
    const cleanKey = String(key || '').trim();
    if (!cleanKey) return [];
    const out = [];
    let KeyMarker;
    let VersionIdMarker;
    while (true) {
      const response = await this.client.send(
        new ListObjectVersionsCommand({
          Bucket: this.bucket,
          Prefix: cleanKey,
          KeyMarker,
          VersionIdMarker,
        }),
      );
      for (const row of response?.Versions || []) {
        if (String(row?.Key || '') === cleanKey) {
          out.push({ Key: cleanKey, VersionId: String(row.VersionId || '').trim() || undefined });
        }
      }
      for (const row of response?.DeleteMarkers || []) {
        if (String(row?.Key || '') === cleanKey) {
          out.push({ Key: cleanKey, VersionId: String(row.VersionId || '').trim() || undefined });
        }
      }
      if (!response?.IsTruncated) break;
      KeyMarker = response.NextKeyMarker;
      VersionIdMarker = response.NextVersionIdMarker;
    }
    return out;
  }

  async deleteObjects(keys) {
    const raw = Array.isArray(keys) ? keys : [];
    const purgeEntries = [];
    const seen = new Set();

    for (const entry of raw) {
      const key =
        typeof entry === 'string'
          ? String(entry).trim()
          : entry && typeof entry === 'object'
            ? String(entry.key || '').trim()
            : '';
      const versionId =
        entry && typeof entry === 'object' ? String(entry.versionId || '').trim() || null : null;
      if (!key) continue;

      if (versionId) {
        const sig = `${key}@@${versionId}`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        purgeEntries.push({ Key: key, VersionId: versionId });
        continue;
      }

      const versions = await this.listObjectVersionsForKey(key);
      if (versions.length) {
        for (const row of versions) {
          const sig = `${row.Key}@@${row.VersionId || ''}`;
          if (seen.has(sig)) continue;
          seen.add(sig);
          purgeEntries.push(row);
        }
      } else {
        const sig = `${key}@@`;
        if (seen.has(sig)) continue;
        seen.add(sig);
        purgeEntries.push({ Key: key });
      }
    }

    if (!purgeEntries.length) return;

    try {
      Logger.info('B2 delete start', {
        bucket: this.bucket,
        objectCount: purgeEntries.length,
      });
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: purgeEntries,
            Quiet: false,
          },
        }),
      );
      Logger.info('B2 delete success', {
        bucket: this.bucket,
        objectCount: purgeEntries.length,
      });
    } catch (error) {
      Logger.error('B2 delete failed', error, { bucket: this.bucket, count: purgeEntries.length });
      throw new AppError(
        'Failed to delete product media from B2',
        500,
        'PRODUCT_MEDIA_DELETE_FAILED',
      );
    }
  }
}

module.exports = {
  B2ObjectStorage,
  ALLOWED_IMAGE_MIME,
  sanitizePathSegment,
  objectKeyFromB2FileUrl,
  normalizeB2PublicBaseUrl,
  normalizeProductIdForStorageKey,
  normalizeUploadInfo,
};
