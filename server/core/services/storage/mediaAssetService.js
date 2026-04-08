const { Logger } = require('@homebase/core');
const { AppError } = require('../../errors/AppError');
const { B2ObjectStorage } = require('./b2ObjectStorage');
const { ImageProcessingService } = require('./imageProcessingService');

class MediaAssetService {
  constructor({ storage, imageProcessingService } = {}) {
    this.storage = storage || new B2ObjectStorage();
    this.imageProcessingService = imageProcessingService || new ImageProcessingService();
  }

  async createHostedAssetFromProcessed({
    tenantId,
    productId,
    assetId,
    position,
    sourceUrl = null,
    processed,
    pendingScope = null,
  }) {
    const safeAssetId = String(assetId || '').trim();
    if (!safeAssetId) {
      throw new AppError(
        'assetId is required for media asset creation',
        500,
        'PRODUCT_MEDIA_SCHEMA_INVALID',
      );
    }
    if (!processed || typeof processed !== 'object' || !processed.variants?.original?.buffer) {
      throw new AppError(
        'Processed image variants missing for asset creation',
        500,
        'PRODUCT_MEDIA_SCHEMA_INVALID',
      );
    }

    Logger.info('Product media asset upload start', {
      tenantId: tenantId != null ? String(tenantId) : null,
      productId: productId != null ? String(productId) : null,
      pendingScope: pendingScope != null ? String(pendingScope) : null,
      assetId: safeAssetId,
      position,
      hash: processed.hash || null,
    });
    const uploads = {};
    for (const variantName of ['original', 'preview', 'thumbnail']) {
      const variant = processed.variants[variantName];
      const key = this.storage.buildAssetVariantKey({
        tenantId,
        productId,
        pendingScope,
        assetId: safeAssetId,
        position,
        variant: variantName,
        hash: processed.hash,
        extension: variant.extension,
      });
      const uploaded = await this.storage.uploadBuffer({
        key,
        buffer: variant.buffer,
        contentType: variant.mimeType,
      });
      uploads[variantName] = {
        key: uploaded.key,
        url: uploaded.publicUrl,
        versionId: uploaded.versionId || null,
        mimeType: variant.mimeType,
        size: variant.size,
        width: variant.width,
        height: variant.height,
      };
    }

    Logger.info('Product media asset upload success', {
      tenantId: tenantId != null ? String(tenantId) : null,
      productId: productId != null ? String(productId) : null,
      pendingScope: pendingScope != null ? String(pendingScope) : null,
      assetId: safeAssetId,
      position,
      hash: processed.hash || null,
      variantCount: Object.keys(uploads).length,
    });

    return {
      assetId: safeAssetId,
      position,
      originalFilename: processed.originalFilename,
      sourceUrl: sourceUrl != null ? String(sourceUrl).trim() || null : null,
      hash: processed.hash,
      mimeType: processed.mimeType,
      size: processed.size,
      width: processed.width,
      height: processed.height,
      variants: uploads,
    };
  }

  async createHostedAsset({
    tenantId,
    productId,
    assetId,
    position,
    sourceUrl = null,
    originalFilename,
    buffer,
    declaredMimeType,
    pendingScope = null,
  }) {
    const processed = await this.imageProcessingService.buildImageAssetVariants({
      buffer,
      originalFilename,
      mimeType: declaredMimeType,
    });
    return this.createHostedAssetFromProcessed({
      tenantId,
      productId,
      assetId,
      position,
      sourceUrl,
      processed,
      pendingScope,
    });
  }
}

module.exports = {
  MediaAssetService,
};
