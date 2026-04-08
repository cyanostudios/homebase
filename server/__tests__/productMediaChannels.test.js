jest.mock('@homebase/core', () => ({
  Logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  mapProductToCdonArticle,
  validateCdonArticlePayload,
} = require('../../plugins/cdon-products/mapToCdonArticle');
const {
  mapProductToFyndiqArticle,
  validateFyndiqArticlePayload,
} = require('../../plugins/fyndiq-products/mapToFyndiqArticle');

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

  it('reports PRODUCT_MEDIA_MISSING_FOR_CHANNEL when CDON payload lacks main image', () => {
    const result = validateCdonArticlePayload({
      sku: '123',
      status: 'for sale',
      quantity: 1,
      main_image: '',
      markets: ['SE'],
      title: [{ language: 'sv-SE', value: 'Produkt titel' }],
      description: [{ language: 'sv-SE', value: 'Beskrivning som ar tillrackligt lang.' }],
      price: [{ market: 'SE', value: { amount_including_vat: 100, currency: 'SEK' } }],
      shipping_time: [{ market: 'SE', min: 1, max: 3 }],
      category: '3938',
    });

    expect(result).toEqual({
      ok: false,
      reason: 'missing_main_image',
      code: 'PRODUCT_MEDIA_MISSING_FOR_CHANNEL',
    });
  });

  it('reports PRODUCT_MEDIA_MISSING_FOR_CHANNEL when Fyndiq payload lacks main image', () => {
    const result = validateFyndiqArticlePayload({
      sku: '123',
      status: 'for sale',
      quantity: 1,
      main_image: '',
      markets: ['SE'],
      title: [{ language: 'sv-SE', value: 'Produkt titel' }],
      description: [{ language: 'sv-SE', value: 'Beskrivning som ar tillrackligt lang.' }],
      price: [{ market: 'SE', value: { amount: 100, currency: 'SEK' } }],
      categories: ['cat-1'],
      shipping_time: [{ market: 'SE', min: 1, max: 3 }],
    });

    expect(result).toEqual({
      ok: false,
      reason: 'missing_main_image',
      code: 'PRODUCT_MEDIA_MISSING_FOR_CHANNEL',
    });
  });
});
