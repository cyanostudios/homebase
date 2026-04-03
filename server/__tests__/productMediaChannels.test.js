const { mapProductToCdonArticle } = require('../../plugins/cdon-products/mapToCdonArticle');
const { mapProductToFyndiqArticle } = require('../../plugins/fyndiq-products/mapToFyndiqArticle');

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

describe('product media channel adapters', () => {
  const baseProduct = {
    id: '123',
    sku: 'SKU-123',
    title: 'Produkt titel',
    description: 'Produkt beskrivning med tillrackligt lang text.',
    mainImage: 'https://cdn.example.com/original-main.jpg',
    quantity: 5,
    status: 'for sale',
    priceAmount: 199,
    currency: 'SEK',
    vatRate: 25,
    brand: 'Brand',
    gtin: '1234567890123',
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
    channelSpecific: {
      cdon: {
        category: '3938',
        shipping_time: [{ market: 'SE', min: 1, max: 3 }],
      },
      fyndiq: {
        categories: ['cat-1'],
        shipping_time: [{ market: 'SE', min: 1, max: 3 }],
      },
      textsStandard: 'se',
      textsExtended: {
        se: {
          name: 'Produkt titel',
          description: 'Produkt beskrivning med tillrackligt lang text.',
        },
      },
    },
  };

  it('maps CDON extras from original variant URLs', () => {
    const payload = mapProductToCdonArticle(
      baseProduct,
      { se: { active: true, priceAmount: 199 } },
      'sv-SE',
    );

    expect(payload).not.toBeNull();
    expect(payload.main_image).toBe('https://cdn.example.com/original-main.jpg');
    expect(payload.images).toEqual(['https://cdn.example.com/original-extra.jpg']);
  });

  it('maps Fyndiq extras from original variant URLs', () => {
    const payload = mapProductToFyndiqArticle(
      baseProduct,
      { se: { active: true, priceAmount: 199 } },
      'sv-SE',
    );

    expect(payload).not.toBeNull();
    expect(payload.main_image).toBe('https://cdn.example.com/original-main.jpg');
    expect(payload.images).toEqual(['https://cdn.example.com/original-extra.jpg']);
  });
});
