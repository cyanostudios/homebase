const {
  buildBatchPatchWithHostedMedia,
  patchTouchesManagedMedia,
} = require('../../plugins/products/batchSyncJobRunner');

describe('batch product media helpers', () => {
  it('detects when a batch patch touches managed media', () => {
    expect(patchTouchesManagedMedia({ title: 'Only title' })).toBe(false);
    expect(patchTouchesManagedMedia({ mainImage: 'https://example.com/a.jpg' })).toBe(true);
    expect(patchTouchesManagedMedia({ images: [] })).toBe(true);
  });

  it('routes media fields through ensureProductMedia before batch save', async () => {
    const productController = {
      model: {
        getById: jest.fn().mockResolvedValue({
          id: '55',
          mainImage: 'https://old.example.com/main.jpg',
          images: [
            {
              assetId: 'asset-old',
              position: 0,
              originalFilename: 'old.jpg',
              sourceUrl: null,
              hash: 'old-hash',
              mimeType: 'image/jpeg',
              size: 100,
              width: 100,
              height: 100,
              variants: {
                original: { key: 'old-key', url: 'https://old.example.com/main.jpg' },
                preview: { key: 'old-preview', url: 'https://old.example.com/main.webp' },
                thumbnail: { key: 'old-thumb', url: 'https://old.example.com/main-thumb.webp' },
              },
            },
          ],
        }),
      },
      productMediaService: {
        ensureProductMedia: jest.fn().mockResolvedValue({
          mainImage: 'https://cdn.example.com/main.jpg',
          images: [
            {
              assetId: 'asset-new',
              position: 0,
              originalFilename: 'new.jpg',
              sourceUrl: 'https://source.example.com/new.jpg',
              hash: 'new-hash',
              mimeType: 'image/jpeg',
              size: 200,
              width: 200,
              height: 200,
              variants: {
                original: { key: 'new-key', url: 'https://cdn.example.com/main.jpg' },
                preview: { key: 'new-preview', url: 'https://cdn.example.com/main.webp' },
                thumbnail: { key: 'new-thumb', url: 'https://cdn.example.com/main-thumb.webp' },
              },
            },
          ],
        }),
      },
    };

    const patch = await buildBatchPatchWithHostedMedia(
      productController,
      { session: { tenantId: 1 } },
      '55',
      { title: 'Ny titel', mainImage: 'https://source.example.com/new.jpg' },
      null,
    );

    expect(productController.productMediaService.ensureProductMedia).toHaveBeenCalledWith(
      { session: { tenantId: 1 } },
      {
        productId: '55',
        mainImage: 'https://source.example.com/new.jpg',
        images: [
          expect.objectContaining({
            assetId: 'asset-old',
          }),
        ],
      },
    );
    expect(patch).toEqual({
      title: 'Ny titel',
      mainImage: 'https://cdn.example.com/main.jpg',
      images: [
        expect.objectContaining({
          assetId: 'asset-new',
        }),
      ],
    });
  });
});
