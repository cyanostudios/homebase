jest.mock('@homebase/core', () => ({
  Context: { getUserId: jest.fn(() => null) },
  Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const {
  ProductMediaService,
  collectProductImageUrls,
} = require('../../plugins/products/productMediaService');
const {
  objectKeyFromB2FileUrl,
  B2ObjectStorage,
} = require('../../server/core/services/storage/b2ObjectStorage');
const { AppError } = require('../../server/core/errors/AppError');

const b2KeyOpts = {
  driver: 'b2',
  bucket: 'homebase-media-01',
  endpoint: 'https://s3.eu-central-003.backblazeb2.com',
  region: 'eu-central-003',
  accessKeyId: 'test-key-id',
  secretAccessKey: 'test-secret',
  publicBaseUrl: 'https://media.syncer.se',
};

function makeAsset(url, overrides = {}) {
  return {
    assetId: overrides.assetId ?? null,
    position: overrides.position ?? 0,
    originalFilename: overrides.originalFilename ?? 'image.jpg',
    sourceUrl: overrides.sourceUrl ?? null,
    hash: overrides.hash ?? null,
    mimeType: overrides.mimeType ?? 'image/jpeg',
    size: overrides.size ?? 100,
    width: overrides.width ?? 400,
    height: overrides.height ?? 400,
    variants: {
      original: {
        key: overrides.originalKey ?? null,
        url,
        mimeType: overrides.mimeType ?? 'image/jpeg',
        size: overrides.size ?? 100,
        width: overrides.width ?? 400,
        height: overrides.height ?? 400,
      },
      preview: {
        key: overrides.previewKey ?? null,
        url: overrides.previewUrl ?? url,
        mimeType: 'image/webp',
        size: 50,
        width: 200,
        height: 200,
      },
      thumbnail: {
        key: overrides.thumbnailKey ?? null,
        url: overrides.thumbnailUrl ?? url,
        mimeType: 'image/webp',
        size: 25,
        width: 80,
        height: 80,
      },
    },
  };
}

describe('collectProductImageUrls', () => {
  it('keeps current product contract as public URL strings', () => {
    expect(
      collectProductImageUrls({
        mainImage: 'https://cdn.example.com/main.jpg',
        images: [
          'https://cdn.example.com/main.jpg',
          'https://cdn.example.com/extra.jpg',
          '  ',
          null,
        ],
      }),
    ).toEqual(['https://cdn.example.com/main.jpg', 'https://cdn.example.com/extra.jpg']);
  });
});

describe('objectKeyFromB2FileUrl', () => {
  it('extracts key after /file/{bucket}/', () => {
    expect(
      objectKeyFromB2FileUrl(
        'https://f004.backblazeb2.com/file/homebase-media-01/tenants/1/products/x.jpg',
        'homebase-media-01',
      ),
    ).toBe('tenants/1/products/x.jpg');
  });

  it('extracts key from custom domain root-path URL', () => {
    expect(
      objectKeyFromB2FileUrl(
        'https://media.syncer.se/1/products/58324746/original/0_x_h.jpg',
        'homebase-media-01',
      ),
    ).toBe('1/products/58324746/original/0_x_h.jpg');
  });
});

describe('ProductMediaService', () => {
  it('reconcile does not delete when keep URL differs by f-host but key matches', async () => {
    const mediaObjectModel = {
      attachPendingIdsToProduct: jest.fn().mockResolvedValue([]),
      updateById: jest.fn().mockResolvedValue(null),
      listByProductId: jest.fn().mockResolvedValue([
        {
          id: 'keep-id',
          url: 'https://f004.backblazeb2.com/file/my-bucket/tenants/1/a.jpg',
          storage_key: 'tenants/1/a.jpg',
          position: 0,
          variants: {
            original: {
              key: 'tenants/1/a.jpg',
              url: 'https://f004.backblazeb2.com/file/my-bucket/tenants/1/a.jpg',
            },
          },
        },
      ]),
      deleteByIds: jest.fn().mockResolvedValue([]),
    };
    const storage = {
      bucket: 'my-bucket',
      getPublicUrl: (key) => `https://f003.backblazeb2.com/file/my-bucket/${key}`,
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProductMediaService({ storage, mediaObjectModel });

    await service.reconcileAttachedProductMedia({}, '123', [
      makeAsset('https://f003.backblazeb2.com/file/my-bucket/tenants/1/a.jpg'),
    ]);

    expect(storage.deleteObjects).not.toHaveBeenCalled();
    expect(mediaObjectModel.deleteByIds).not.toHaveBeenCalled();
  });

  it('reconcile does not delete when keep URL is custom domain but object key matches row', async () => {
    const rowKey = '1/products/58324746/original/0_a_h.jpg';
    const mediaObjectModel = {
      attachPendingIdsToProduct: jest.fn().mockResolvedValue([]),
      updateById: jest.fn().mockResolvedValue(null),
      listByProductId: jest.fn().mockResolvedValue([
        {
          id: 'keep-id',
          url: `https://media.syncer.se/${rowKey}`,
          storage_key: rowKey,
          position: 0,
          variants: {
            original: {
              key: rowKey,
              url: `https://media.syncer.se/${rowKey}`,
            },
          },
        },
      ]),
      deleteByIds: jest.fn().mockResolvedValue([]),
    };
    const storage = {
      bucket: 'homebase-media-01',
      getPublicUrl: (key) => `https://f003.backblazeb2.com/file/homebase-media-01/${key}`,
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProductMediaService({ storage, mediaObjectModel });

    await service.reconcileAttachedProductMedia({}, '123', [
      makeAsset(`https://f003.backblazeb2.com/file/homebase-media-01/${rowKey}`),
    ]);

    expect(storage.deleteObjects).not.toHaveBeenCalled();
    expect(mediaObjectModel.deleteByIds).not.toHaveBeenCalled();
  });

  it('attaches pending uploads and deletes stale managed media', async () => {
    const mediaObjectModel = {
      attachPendingIdsToProduct: jest.fn().mockResolvedValue([]),
      updateById: jest.fn().mockResolvedValue(null),
      listByProductId: jest.fn().mockResolvedValue([
        {
          id: 'keep-id',
          url: 'https://cdn.example.com/keep.jpg',
          storage_key: 'keep-key',
          position: 0,
          variants: { original: { key: 'keep-key', url: 'https://cdn.example.com/keep.jpg' } },
        },
        {
          id: 'drop-id',
          url: 'https://cdn.example.com/drop.jpg',
          storage_key: 'drop-key',
          position: 1,
          variants: { original: { key: 'drop-key', url: 'https://cdn.example.com/drop.jpg' } },
        },
      ]),
      deleteByIds: jest.fn().mockResolvedValue([]),
    };
    const storage = {
      bucket: 'bucket',
      getPublicUrl: jest.fn((k) => `https://cdn.example.com/file/bucket/${k}`),
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ProductMediaService({ storage, mediaObjectModel });

    await service.reconcileAttachedProductMedia({}, '123', [
      makeAsset('https://cdn.example.com/keep.jpg', {
        assetId: 'keep-id',
        originalKey: 'keep-key',
      }),
    ]);

    expect(mediaObjectModel.attachPendingIdsToProduct).toHaveBeenCalledWith({}, '123', ['keep-id']);
    expect(storage.deleteObjects).toHaveBeenCalledWith([{ key: 'drop-key', versionId: null }]);
    expect(mediaObjectModel.deleteByIds).toHaveBeenCalledWith({}, ['drop-id']);
  });

  it('reuses hosted Sello media by content hash and uploads new variants', async () => {
    const mediaObjectModel = {
      listByProductId: jest.fn().mockResolvedValue([
        {
          id: 'existing-id',
          source_url: 'https://images.sello.test/existing.jpg',
          url: 'https://cdn.example.com/existing.jpg',
          storage_key: 'existing-key',
          content_hash: 'same-hash',
          position: 0,
          original_filename: 'existing.jpg',
          variants: {
            original: {
              key: 'existing-key',
              url: 'https://cdn.example.com/existing.jpg',
              mimeType: 'image/jpeg',
              size: 100,
              width: 800,
              height: 800,
            },
            preview: {
              key: 'existing-preview',
              url: 'https://cdn.example.com/existing-preview.webp',
              mimeType: 'image/webp',
              size: 50,
              width: 400,
              height: 400,
            },
            thumbnail: {
              key: 'existing-thumb',
              url: 'https://cdn.example.com/existing-thumb.webp',
              mimeType: 'image/webp',
              size: 20,
              width: 120,
              height: 120,
            },
          },
        },
      ]),
      create: jest.fn().mockImplementation(async (_req, row) => ({
        id: 'new-id',
        product_id: row.productId,
        source_kind: row.sourceKind,
        source_url: row.sourceUrl,
        original_filename: row.originalFilename,
        storage_key: row.storageKey,
        url: row.url,
        position: row.position,
        content_hash: row.contentHash,
        mime_type: row.mimeType,
        size_bytes: row.sizeBytes,
        width: row.width,
        height: row.height,
        variants: row.variants,
      })),
      updateById: jest.fn().mockResolvedValue(null),
      attachPendingIdsToProduct: jest.fn().mockResolvedValue([]),
      findPendingBySourceUrls: jest.fn().mockResolvedValue([
        {
          id: 'existing-id',
          source_url: 'https://images.sello.test/existing.jpg',
          url: 'https://cdn.example.com/existing.jpg',
          storage_key: 'existing-key',
          content_hash: 'same-hash',
          variants: {
            original: { key: 'existing-key', url: 'https://cdn.example.com/existing.jpg' },
          },
        },
      ]),
      deleteByIds: jest.fn().mockResolvedValue([]),
    };

    const imageProcessingService = {
      buildImageAssetVariants: jest.fn().mockImplementation(async ({ originalFilename }) =>
        originalFilename === 'existing.jpg'
          ? {
              originalFilename: 'existing.jpg',
              hash: 'same-hash',
              mimeType: 'image/jpeg',
              size: 100,
              width: 800,
              height: 800,
              variants: {
                original: {
                  buffer: Buffer.from('existing'),
                  mimeType: 'image/jpeg',
                  extension: 'jpg',
                  size: 100,
                  width: 800,
                  height: 800,
                },
                preview: {
                  buffer: Buffer.from('preview'),
                  mimeType: 'image/webp',
                  extension: 'webp',
                  size: 50,
                  width: 400,
                  height: 400,
                },
                thumbnail: {
                  buffer: Buffer.from('thumb'),
                  mimeType: 'image/webp',
                  extension: 'webp',
                  size: 20,
                  width: 120,
                  height: 120,
                },
              },
            }
          : {
              originalFilename: 'new.jpg',
              hash: 'new-hash',
              mimeType: 'image/jpeg',
              size: 110,
              width: 900,
              height: 900,
              variants: {
                original: {
                  buffer: Buffer.from('new'),
                  mimeType: 'image/jpeg',
                  extension: 'jpg',
                  size: 110,
                  width: 900,
                  height: 900,
                },
                preview: {
                  buffer: Buffer.from('new-preview'),
                  mimeType: 'image/webp',
                  extension: 'webp',
                  size: 55,
                  width: 450,
                  height: 450,
                },
                thumbnail: {
                  buffer: Buffer.from('new-thumb'),
                  mimeType: 'image/webp',
                  extension: 'webp',
                  size: 22,
                  width: 140,
                  height: 140,
                },
              },
            },
      ),
    };
    const mediaAssetService = {
      createHostedAssetFromProcessed: jest.fn().mockResolvedValue(
        makeAsset('https://cdn.example.com/new.jpg', {
          assetId: 'new-id',
          position: 1,
          sourceUrl: 'https://images.sello.test/new.jpg',
          hash: 'new-hash',
          originalFilename: 'new.jpg',
          originalKey: 'new-key',
          previewKey: 'new-preview',
          previewUrl: 'https://cdn.example.com/new-preview.webp',
          thumbnailKey: 'new-thumb',
          thumbnailUrl: 'https://cdn.example.com/new-thumb.webp',
        }),
      ),
    };

    const service = new ProductMediaService({
      storage: {
        deleteObjects: jest.fn().mockResolvedValue(undefined),
        getPublicUrl: jest.fn((key) =>
          key === 'existing-key'
            ? 'https://cdn.example.com/existing.jpg'
            : `https://cdn.example.com/${key}`,
        ),
      },
      mediaObjectModel,
      imageProcessingService,
      mediaAssetService,
    });
    service.fetchExternalBuffer = jest
      .fn()
      .mockResolvedValueOnce({
        buffer: Buffer.from('existing'),
        originalFilename: 'existing.jpg',
        mimeType: 'image/jpeg',
      })
      .mockResolvedValueOnce({
        buffer: Buffer.from('new'),
        originalFilename: 'new.jpg',
        mimeType: 'image/jpeg',
      });

    const result = await service.ensureHostedSelloMedia(
      { session: { tenantId: 7 } },
      {
        productId: '55',
        selloId: '55',
        sourceUrls: ['https://images.sello.test/existing.jpg', 'https://images.sello.test/new.jpg'],
      },
    );

    expect(service.fetchExternalBuffer).toHaveBeenCalledTimes(2);
    expect(mediaAssetService.createHostedAssetFromProcessed).toHaveBeenCalledTimes(1);
    expect(mediaObjectModel.create).toHaveBeenCalledWith(
      { session: { tenantId: 7 } },
      {
        productId: 55,
        sourceKind: 'sello_import',
        sourceUrl: 'https://images.sello.test/new.jpg',
        originalFilename: 'new.jpg',
        storageKey: 'new-key',
        url: 'https://cdn.example.com/new.jpg',
        position: 1,
        contentHash: 'new-hash',
        mimeType: 'image/jpeg',
        sizeBytes: 100,
        width: 400,
        height: 400,
        variants: expect.any(Object),
      },
    );
    expect(result.mainImage).toBe('https://cdn.example.com/existing.jpg');
    expect(result.images).toHaveLength(2);
    expect(result.images[0].variants.original.url).toBe('https://cdn.example.com/existing.jpg');
    expect(result.images[1].variants.original.url).toBe('https://cdn.example.com/new.jpg');
    expect(result.allHostedUrls).toEqual([
      'https://cdn.example.com/existing.jpg',
      'https://cdn.example.com/new.jpg',
    ]);
    expect(result.reusedCount).toBe(1);
    expect(result.uploadedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });

  it('blocks single product delete when managed media delete fails', async () => {
    const mediaObjectModel = {
      listByProductId: jest.fn().mockResolvedValue([
        {
          id: 'asset-1',
          position: 0,
          variants: {
            original: { key: 'original-key', url: 'https://cdn.example.com/original.jpg' },
          },
        },
      ]),
    };
    const storage = {
      deleteObjects: jest
        .fn()
        .mockRejectedValue(
          new AppError(
            'Failed to delete product media from B2',
            500,
            'PRODUCT_MEDIA_DELETE_FAILED',
          ),
        ),
    };
    const service = new ProductMediaService({ storage, mediaObjectModel });

    await expect(service.deleteProductMediaStrict({}, '123')).rejects.toMatchObject({
      code: 'PRODUCT_MEDIA_DELETE_FAILED',
      details: expect.objectContaining({
        productId: '123',
        reason: 'delete_product',
      }),
    });
  });

  it('returns partial delete result for bulk media delete', async () => {
    const mediaObjectModel = {
      listByProductId: jest.fn().mockImplementation(async (_req, productId) => [
        {
          id: `asset-${productId}`,
          position: 0,
          variants: {
            original: {
              key: `key-${productId}`,
              url: `https://cdn.example.com/${productId}.jpg`,
            },
          },
        },
      ]),
    };
    const storage = {
      deleteObjects: jest.fn().mockImplementation(async (targets) => {
        if (targets.some((target) => target.key === 'key-1')) {
          throw new AppError(
            'Failed to delete product media from B2',
            500,
            'PRODUCT_MEDIA_DELETE_FAILED',
          );
        }
      }),
    };
    const service = new ProductMediaService({ storage, mediaObjectModel });

    await expect(service.deleteProductMediaStrict({}, '1')).rejects.toMatchObject({
      code: 'PRODUCT_MEDIA_DELETE_FAILED',
    });

    const result = await service.deleteProductsMediaStrictPartial({}, ['1', '2']);

    expect(result).toEqual({
      okIds: ['2'],
      failed: [
        expect.objectContaining({
          productId: '1',
          code: 'PRODUCT_MEDIA_DELETE_FAILED',
          message: 'Failed to delete product media from B2',
        }),
      ],
    });
  });

  it('uploads manual files directly into final product path when productId is known', async () => {
    const mediaObjectModel = {
      create: jest.fn().mockImplementation(async (_req, row) => ({
        id: 'asset-final',
        product_id: row.productId,
        source_kind: row.sourceKind,
        source_url: row.sourceUrl,
        original_filename: row.originalFilename,
        storage_key: row.storageKey,
        url: row.url,
        position: row.position,
        content_hash: row.contentHash,
        mime_type: row.mimeType,
        size_bytes: row.sizeBytes,
        width: row.width,
        height: row.height,
        variants: row.variants,
      })),
    };
    const imageProcessingService = {
      buildImageAssetVariants: jest.fn().mockResolvedValue({
        originalFilename: 'manual.jpg',
        hash: 'manual-hash',
        mimeType: 'image/jpeg',
        size: 123,
        width: 1200,
        height: 800,
        variants: {
          original: {
            buffer: Buffer.from('original'),
            mimeType: 'image/jpeg',
            extension: 'jpg',
            size: 123,
            width: 1200,
            height: 800,
          },
          preview: {
            buffer: Buffer.from('preview'),
            mimeType: 'image/webp',
            extension: 'webp',
            size: 45,
            width: 600,
            height: 400,
          },
          thumbnail: {
            buffer: Buffer.from('thumb'),
            mimeType: 'image/webp',
            extension: 'webp',
            size: 12,
            width: 120,
            height: 80,
          },
        },
      }),
    };
    const mediaAssetService = {
      createHostedAssetFromProcessed: jest
        .fn()
        .mockImplementation(async ({ tenantId, productId, pendingScope, assetId }) =>
          makeAsset(
            `https://media.syncer.se/${tenantId}/products/${productId}/original/0_${assetId}_manual-hash.jpg`,
            {
              assetId,
              position: 0,
              originalFilename: 'manual.jpg',
              hash: 'manual-hash',
              originalKey: `${tenantId}/products/${productId}/original/0_${assetId}_manual-hash.jpg`,
              previewKey: `${tenantId}/products/${productId}/preview/0_${assetId}_manual-hash.webp`,
              previewUrl: `https://media.syncer.se/${tenantId}/products/${productId}/preview/0_${assetId}_manual-hash.webp`,
              thumbnailKey: `${tenantId}/products/${productId}/thumbnail/0_${assetId}_manual-hash.webp`,
              thumbnailUrl: `https://media.syncer.se/${tenantId}/products/${productId}/thumbnail/0_${assetId}_manual-hash.webp`,
              mimeType: 'image/jpeg',
              size: 123,
              width: 1200,
              height: 800,
              sourceUrl: null,
              pendingScope,
            },
          ),
        ),
    };
    const service = new ProductMediaService({
      mediaObjectModel,
      imageProcessingService,
      mediaAssetService,
    });

    const result = await service.uploadPendingManualFiles(
      { session: { tenantId: 9 } },
      [{ buffer: Buffer.from('manual'), originalname: 'manual.jpg', mimetype: 'image/jpeg' }],
      { productId: 321 },
    );

    expect(imageProcessingService.buildImageAssetVariants).toHaveBeenCalledTimes(1);
    expect(mediaAssetService.createHostedAssetFromProcessed).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: '9',
        productId: '321',
        pendingScope: null,
        position: 0,
      }),
    );
    expect(mediaObjectModel.create).toHaveBeenCalledWith(
      { session: { tenantId: 9 } },
      expect.objectContaining({
        productId: 321,
        sourceKind: 'manual_upload',
        position: 0,
      }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].variants.original.url).toContain('/9/products/321/original/');
    expect(result[0].variants.preview.url).toContain('/9/products/321/preview/');
  });

  it('promotes pending manual B2 keys into the product folder after attach', async () => {
    const keyHelper = new B2ObjectStorage(b2KeyOpts);
    const assetId = 'f566aae7-c9d1-4388-a3c3-85ff832689ba';
    const hash = '0281acc8cfe209a1e2849597aab4a1e8f74ae46b78243bd791250a5cc175db4e';
    const tenantId = 2;
    const productId = 99;
    const pendingBase = `2/products/manual-user-1`;
    const origKey = `${pendingBase}/original/0_${assetId}_${hash}.jpg`;
    const prevKey = `${pendingBase}/preview/0_${assetId}_${hash}.webp`;
    const thumbKey = `${pendingBase}/thumbnail/0_${assetId}_${hash}.webp`;

    const row = {
      id: assetId,
      product_id: productId,
      position: 0,
      content_hash: hash,
      source_kind: 'manual_upload',
      storage_key: origKey,
      url: `https://media.syncer.se/${origKey}`,
      variants: {
        original: {
          key: origKey,
          url: `https://media.syncer.se/${origKey}`,
          mimeType: 'image/jpeg',
        },
        preview: {
          key: prevKey,
          url: `https://media.syncer.se/${prevKey}`,
          mimeType: 'image/webp',
        },
        thumbnail: {
          key: thumbKey,
          url: `https://media.syncer.se/${thumbKey}`,
          mimeType: 'image/webp',
        },
      },
    };

    const expectedOriginalKey = keyHelper.buildAssetVariantKey({
      tenantId,
      productId: String(productId),
      assetId,
      position: 0,
      variant: 'original',
      hash,
      extension: 'jpg',
    });
    const expectedPreviewKey = keyHelper.buildAssetVariantKey({
      tenantId,
      productId: String(productId),
      assetId,
      position: 0,
      variant: 'preview',
      hash,
      extension: 'webp',
    });
    const expectedThumbKey = keyHelper.buildAssetVariantKey({
      tenantId,
      productId: String(productId),
      assetId,
      position: 0,
      variant: 'thumbnail',
      hash,
      extension: 'webp',
    });

    const storage = {
      bucket: keyHelper.bucket,
      getPublicUrl: (k) => keyHelper.getPublicUrl(k),
      buildAssetVariantKey: (opts) => keyHelper.buildAssetVariantKey(opts),
      copyObjectWithinBucket: jest.fn(async ({ destinationKey }) => ({
        key: destinationKey,
        publicUrl: keyHelper.getPublicUrl(destinationKey),
        versionId: null,
      })),
      deleteObjects: jest.fn().mockResolvedValue(undefined),
    };
    const mediaObjectModel = {
      updateById: jest.fn().mockResolvedValue({ ...row }),
    };
    const service = new ProductMediaService({ storage, mediaObjectModel });

    const did = await service.promoteProductMediaRowIfNeeded(
      { session: { tenantId } },
      row,
      productId,
    );

    expect(did).toBe(true);
    expect(storage.copyObjectWithinBucket).toHaveBeenCalledTimes(3);
    expect(storage.copyObjectWithinBucket).toHaveBeenCalledWith({
      sourceKey: origKey,
      destinationKey: expectedOriginalKey,
    });
    expect(storage.copyObjectWithinBucket).toHaveBeenCalledWith({
      sourceKey: prevKey,
      destinationKey: expectedPreviewKey,
    });
    expect(storage.copyObjectWithinBucket).toHaveBeenCalledWith({
      sourceKey: thumbKey,
      destinationKey: expectedThumbKey,
    });
    expect(mediaObjectModel.updateById).toHaveBeenCalled();
    expect(storage.deleteObjects).toHaveBeenCalled();
  });
});
