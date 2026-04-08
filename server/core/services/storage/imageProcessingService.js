const crypto = require('crypto');

const sharp = require('sharp');
const { Logger } = require('@homebase/core');

const { AppError } = require('../../errors/AppError');

const DEFAULT_PREVIEW_MAX_WIDTH = 500;
const DEFAULT_PREVIEW_MAX_HEIGHT = 500;
const DEFAULT_THUMBNAIL_MAX_WIDTH = 320;
const DEFAULT_THUMBNAIL_MAX_HEIGHT = 320;

function readPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : fallback;
}

function extFromMimeType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized === 'image/jpeg') return 'jpg';
  if (normalized === 'image/png') return 'png';
  if (normalized === 'image/webp') return 'webp';
  if (normalized === 'image/gif') return 'gif';
  if (normalized === 'image/avif') return 'avif';
  return 'bin';
}

class ImageProcessingService {
  constructor(options = {}) {
    this.previewMaxWidth = readPositiveInt(
      options.previewMaxWidth || process.env.MEDIA_PREVIEW_MAX_WIDTH,
      DEFAULT_PREVIEW_MAX_WIDTH,
    );
    this.previewMaxHeight = readPositiveInt(
      options.previewMaxHeight || process.env.MEDIA_PREVIEW_MAX_HEIGHT,
      DEFAULT_PREVIEW_MAX_HEIGHT,
    );
    this.thumbnailMaxWidth = readPositiveInt(
      options.thumbnailMaxWidth || process.env.MEDIA_THUMBNAIL_MAX_WIDTH,
      DEFAULT_THUMBNAIL_MAX_WIDTH,
    );
    this.thumbnailMaxHeight = readPositiveInt(
      options.thumbnailMaxHeight || process.env.MEDIA_THUMBNAIL_MAX_HEIGHT,
      DEFAULT_THUMBNAIL_MAX_HEIGHT,
    );
  }

  async buildImageAssetVariants({ buffer, originalFilename, mimeType }) {
    if (!Buffer.isBuffer(buffer) || !buffer.length) {
      throw new AppError('Image buffer is empty', 400, 'PRODUCT_MEDIA_INVALID_IMAGE');
    }

    try {
      const baseImage = sharp(buffer, { animated: true, pages: 1 });
      const metadata = await baseImage.metadata();
      const width = Number.isFinite(Number(metadata.width)) ? Number(metadata.width) : null;
      const height = Number.isFinite(Number(metadata.height)) ? Number(metadata.height) : null;
      const normalizedMimeType = String(mimeType || metadata.format || '').toLowerCase();
      const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');

      const previewBuffer = await sharp(buffer, { animated: true, pages: 1 })
        .rotate()
        .resize({
          width: this.previewMaxWidth,
          height: this.previewMaxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
      const previewMeta = await sharp(previewBuffer).metadata();
      Logger.info('Product media preview generated', {
        originalFilename: String(originalFilename || '').trim() || null,
        width: Number.isFinite(Number(previewMeta.width)) ? Number(previewMeta.width) : null,
        height: Number.isFinite(Number(previewMeta.height)) ? Number(previewMeta.height) : null,
      });

      const thumbnailBuffer = await sharp(buffer, { animated: true, pages: 1 })
        .rotate()
        .resize({
          width: this.thumbnailMaxWidth,
          height: this.thumbnailMaxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toBuffer();
      const thumbnailMeta = await sharp(thumbnailBuffer).metadata();
      Logger.info('Product media thumbnail generated', {
        originalFilename: String(originalFilename || '').trim() || null,
        width: Number.isFinite(Number(thumbnailMeta.width)) ? Number(thumbnailMeta.width) : null,
        height: Number.isFinite(Number(thumbnailMeta.height)) ? Number(thumbnailMeta.height) : null,
      });

      return {
        originalFilename:
          String(originalFilename || '').trim() || `image.${extFromMimeType(normalizedMimeType)}`,
        hash: contentHash,
        mimeType: normalizedMimeType,
        size: buffer.length,
        width,
        height,
        variants: {
          original: {
            buffer,
            mimeType: normalizedMimeType,
            extension: extFromMimeType(normalizedMimeType),
            size: buffer.length,
            width,
            height,
          },
          preview: {
            buffer: previewBuffer,
            mimeType: 'image/webp',
            extension: 'webp',
            size: previewBuffer.length,
            width: Number.isFinite(Number(previewMeta.width)) ? Number(previewMeta.width) : null,
            height: Number.isFinite(Number(previewMeta.height)) ? Number(previewMeta.height) : null,
          },
          thumbnail: {
            buffer: thumbnailBuffer,
            mimeType: 'image/webp',
            extension: 'webp',
            size: thumbnailBuffer.length,
            width: Number.isFinite(Number(thumbnailMeta.width))
              ? Number(thumbnailMeta.width)
              : null,
            height: Number.isFinite(Number(thumbnailMeta.height))
              ? Number(thumbnailMeta.height)
              : null,
          },
        },
      };
    } catch (error) {
      Logger.error('Product media processing failed', error, {
        originalFilename: String(originalFilename || '').trim() || null,
        code: 'PRODUCT_MEDIA_PROCESSING_FAILED',
      });
      throw new AppError(
        `Failed to process image: ${String(error?.message || error)}`,
        400,
        'PRODUCT_MEDIA_PROCESSING_FAILED',
      );
    }
  }
}

module.exports = {
  ImageProcessingService,
  extFromMimeType,
};
