jest.mock('@homebase/core', () => ({
  Context: { getUserId: jest.fn(() => null) },
  Logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const {
  ProductMediaService,
  collectProductImageUrls,
} = require('../../plugins/products/productMediaService');
const { objectKeyFromB2FileUrl } = require('../../server/core/services/storage/b2ObjectStorage');
const { AppError } = require('../../server/core/errors/AppError');

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
});
