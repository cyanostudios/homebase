jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  Context: { getUserId: jest.fn(() => null) },
  Database: { get: jest.fn() },
}));

const WooCommerceController = require('../../plugins/woocommerce-products/controller');

function makeAsset(originalUrl, previewUrl) {
  return {
    assetId: 'asset-1',
    position: 0,
    originalFilename: 'image.jpg',
    sourceUrl: null,
    hash: 'hash-1',
    mimeType: 'image/jpeg',
    size: 100,
    width: 800,
    height: 800,
    variants: {
      original: {
        key: 'original-key',
        url: originalUrl,
        mimeType: 'image/jpeg',
        size: 100,
        width: 800,
        height: 800,
      },
      preview: {
        key: 'preview-key',
        url: previewUrl,
        mimeType: 'image/webp',
        size: 50,
        width: 400,
        height: 400,
      },
      thumbnail: {
        key: 'thumb-key',
        url: previewUrl,
        mimeType: 'image/webp',
        size: 20,
        width: 120,
        height: 120,
      },
    },
  };
}

describe('product media Woo adapter', () => {
  it('maps Woo images from original asset URLs', () => {
    const controller = new WooCommerceController({});
    const payload = controller.mapProductToWoo(
      {
        sku: 'SKU-1',
        title: 'Testprodukt',
        description: 'Beskrivning',
        status: 'for sale',
        priceAmount: 149,
        quantity: 3,
        mainImage: 'https://cdn.example.com/original-main.jpg',
        images: [
          makeAsset(
            'https://cdn.example.com/original-main.jpg',
            'https://cdn.example.com/preview-main.webp',
          ),
          makeAsset(
            'https://cdn.example.com/original-extra.jpg',
            'https://cdn.example.com/preview-extra.webp',
          ),
        ],
      },
      [],
      {},
    );

    expect(payload.images).toEqual([
      { src: 'https://cdn.example.com/original-main.jpg' },
      { src: 'https://cdn.example.com/original-extra.jpg' },
    ]);
  });
});
