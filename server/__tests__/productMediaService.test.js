const {
  ProductMediaService,
  collectProductImageUrls,
} = require('../../plugins/products/productMediaService');
const { objectKeyFromB2FileUrl } = require('../../server/core/services/storage/b2ObjectStorage');

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
      attachPendingUrlsToProduct: jest.fn().mockResolvedValue([]),
      listByProductId: jest.fn().mockResolvedValue([
        {
          id: 'keep-id',
          url: 'https://f004.backblazeb2.com/file/my-bucket/tenants/1/a.jpg',
          storage_key: 'tenants/1/a.jpg',
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
      'https://f003.backblazeb2.com/file/my-bucket/tenants/1/a.jpg',
    ]);

    expect(storage.deleteObjects).not.toHaveBeenCalled();
    expect(mediaObjectModel.deleteByIds).not.toHaveBeenCalled();
  });

  it('attaches pending uploads and deletes stale managed media', async () => {
    const mediaObjectModel = {
      attachPendingUrlsToProduct: jest.fn().mockResolvedValue([]),
      listByProductId: jest.fn().mockResolvedValue([
        { id: 'keep-id', url: 'https://cdn.example.com/keep.jpg', storage_key: 'keep-key' },
        { id: 'drop-id', url: 'https://cdn.example.com/drop.jpg', storage_key: 'drop-key' },
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
      'https://cdn.example.com/keep.jpg',
      'https://cdn.example.com/keep.jpg',
    ]);

    expect(mediaObjectModel.attachPendingUrlsToProduct).toHaveBeenCalledWith({}, '123', [
      'https://cdn.example.com/keep.jpg',
    ]);
    expect(storage.deleteObjects).toHaveBeenCalledWith(['drop-key']);
    expect(mediaObjectModel.deleteByIds).toHaveBeenCalledWith({}, ['drop-id']);
  });

  it('reuses hosted Sello media for unchanged source URLs', async () => {
    const mediaObjectModel = {
      findByProductAndSourceUrls: jest.fn().mockResolvedValue([
        {
          id: 'existing-id',
          source_url: 'https://images.sello.test/existing.jpg',
          url: 'https://cdn.example.com/existing.jpg',
          storage_key: 'existing-key',
        },
      ]),
      create: jest.fn().mockResolvedValue(null),
      attachPendingUrlsToProduct: jest.fn().mockResolvedValue([]),
      listByProductId: jest.fn().mockResolvedValue([
        {
          id: 'existing-id',
          source_url: 'https://images.sello.test/existing.jpg',
          url: 'https://cdn.example.com/existing.jpg',
          storage_key: 'existing-key',
        },
      ]),
      deleteByIds: jest.fn().mockResolvedValue([]),
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
    });
    service.uploadExternalImage = jest.fn().mockResolvedValue({
      key: 'new-key',
      publicUrl: 'https://cdn.example.com/new.jpg',
      originalFilename: 'new.jpg',
    });

    const result = await service.ensureHostedSelloMedia(
      { session: { tenantId: 7 } },
      {
        productId: '55',
        selloId: '55',
        sourceUrls: ['https://images.sello.test/existing.jpg', 'https://images.sello.test/new.jpg'],
      },
    );

    expect(service.uploadExternalImage).toHaveBeenCalledTimes(1);
    expect(service.uploadExternalImage).toHaveBeenCalledWith(
      { session: { tenantId: 7 } },
      {
        tenantId: 7,
        scope: 'sello/55',
        sourceUrl: 'https://images.sello.test/new.jpg',
      },
    );
    expect(mediaObjectModel.create).toHaveBeenCalledWith(
      { session: { tenantId: 7 } },
      {
        productId: 55,
        sourceKind: 'sello_import',
        sourceUrl: 'https://images.sello.test/new.jpg',
        originalFilename: 'new.jpg',
        storageKey: 'new-key',
        url: 'https://cdn.example.com/new.jpg',
      },
    );
    expect(result.mainImage).toBe('https://cdn.example.com/existing.jpg');
    expect(result.images).toEqual(['https://cdn.example.com/new.jpg']);
    expect(result.allHostedUrls).toEqual([
      'https://cdn.example.com/existing.jpg',
      'https://cdn.example.com/new.jpg',
    ]);
    expect(result.reusedCount).toBe(1);
    expect(result.uploadedCount).toBe(1);
    expect(result.failedCount).toBe(0);
  });
});
