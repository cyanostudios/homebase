// server/__tests__/sello-id-as-products.test.js
// Tests for "Sello ID as products.id" – import, export mappers, order sync semantics.
// Covers: sku = product.id (no fallback), parent_sku from parentProductId, getById/upsert flow.

const {
  mapProductToCdonArticle,
  getCdonArticleInputIssues,
} = require('../../plugins/cdon-products/mapToCdonArticle');
const {
  mapProductToFyndiqArticle,
  getFyndiqArticleInputIssues,
} = require('../../plugins/fyndiq-products/mapToFyndiqArticle');

// Base product with all required fields for valid CDON/Fyndiq export
function baseProduct(overrides = {}) {
  return {
    id: 49558203,
    title: 'Test Product Title',
    description: 'A description with at least ten characters for validation.',
    mainImage: 'https://example.com/image.jpg',
    quantity: 10,
    priceAmount: 199,
    currency: 'SEK',
    vatRate: 25,
    channelSpecific: {
      cdon: {
        category: '1124',
        title: [{ language: 'sv-SE', value: 'CDON Title' }],
        description: [{ language: 'sv-SE', value: 'CDON description with at least 10 chars' }],
      },
      fyndiq: {
        categories: ['1234567890'],
        shipping_time: [{ market: 'SE', min: 1, max: 3 }],
        delivery_type: [{ market: 'SE', value: 'mailbox' }],
        title: [{ language: 'sv-SE', value: 'Fyndiq Title' }],
        description: [{ language: 'sv-SE', value: 'Fyndiq description with at least 10 chars' }],
      },
    },
    ...overrides,
  };
}

const baseOverrides = {
  se: { active: true, priceAmount: 199, category: '1124' },
};

const fyndiqOverrides = {
  se: { active: true, priceAmount: 199, category: '1' },
};

describe('Sello ID as products.id', () => {
  describe('CDON mapProductToCdonArticle', () => {
    it('uses product.id as sku (not product.sku)', () => {
      const product = baseProduct({ id: 49558203, sku: 'LEGACY-SKU-123' });
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.sku).toBe('49558203');
      expect(article.sku).not.toBe('LEGACY-SKU-123');
    });

    it('returns null when product.id is missing', () => {
      const product = baseProduct();
      delete product.id;
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article).toBeNull();
    });

    it('returns null when product.id is null', () => {
      const product = baseProduct({ id: null });
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article).toBeNull();
    });

    it('converts numeric id to string for sku', () => {
      const product = baseProduct({ id: 12345678 });
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.sku).toBe('12345678');
    });

    it('sets parent_sku from product.parentProductId for variants', () => {
      const product = baseProduct({ id: 49558204, parentProductId: 49558203 });
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.parent_sku).toBe('49558203');
    });

    it('does not set parent_sku when parentProductId is missing', () => {
      const product = baseProduct({ id: 49558203 });
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.parent_sku).toBeUndefined();
    });

    it('does not set parent_sku when parentProductId is null', () => {
      const product = baseProduct({ id: 49558203, parentProductId: null });
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.parent_sku).toBeUndefined();
    });
  });

  describe('CDON getCdonArticleInputIssues', () => {
    it('returns missing_sku when product.id is missing', () => {
      const product = baseProduct();
      delete product.id;
      const issues = getCdonArticleInputIssues(product, baseOverrides, 'sv-SE');
      expect(issues).toContain('missing_sku');
    });

    it('returns missing_sku when product.id is null', () => {
      const product = baseProduct({ id: null });
      const issues = getCdonArticleInputIssues(product, baseOverrides, 'sv-SE');
      expect(issues).toContain('missing_sku');
    });

    it('does not use product.sku as fallback (no fallback)', () => {
      const product = baseProduct({ sku: 'SKU-123' });
      delete product.id;
      const issues = getCdonArticleInputIssues(product, baseOverrides, 'sv-SE');
      expect(issues).toContain('missing_sku');
    });

    it('returns no missing_sku when product.id is present', () => {
      const product = baseProduct({ id: 49558203 });
      const issues = getCdonArticleInputIssues(product, baseOverrides, 'sv-SE');
      expect(issues).not.toContain('missing_sku');
    });
  });

  describe('Fyndiq mapProductToFyndiqArticle', () => {
    it('uses product.id as sku (not product.sku)', () => {
      const product = baseProduct({ id: 49558203, sku: 'LEGACY-SKU-456' });
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.sku).toBe('49558203');
      expect(article.sku).not.toBe('LEGACY-SKU-456');
    });

    it('returns null when product.id is missing', () => {
      const product = baseProduct();
      delete product.id;
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article).toBeNull();
    });

    it('returns null when product.id is null', () => {
      const product = baseProduct({ id: null });
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article).toBeNull();
    });

    it('converts numeric id to string for sku', () => {
      const product = baseProduct({ id: 12345678 });
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.sku).toBe('12345678');
    });

    it('sets parent_sku from product.parentProductId for variants', () => {
      const product = baseProduct({ id: 49558204, parentProductId: 49558203 });
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.parent_sku).toBe('49558203');
    });

    it('does not set parent_sku when parentProductId is missing', () => {
      const product = baseProduct({ id: 49558203 });
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.parent_sku).toBeUndefined();
    });

    it('does not fallback to fyndiq.parent_sku (no fallback)', () => {
      const product = baseProduct({
        id: 49558204,
        parentProductId: null,
        channelSpecific: {
          ...baseProduct().channelSpecific,
          fyndiq: { ...baseProduct().channelSpecific.fyndiq, parent_sku: '99999999' },
        },
      });
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article).not.toBeNull();
      expect(article.parent_sku).toBeUndefined();
    });
  });

  describe('Fyndiq getFyndiqArticleInputIssues', () => {
    it('returns missing_sku when product.id is missing', () => {
      const product = baseProduct();
      delete product.id;
      const issues = getFyndiqArticleInputIssues(product, fyndiqOverrides, 'sv-SE');
      expect(issues).toContain('missing_sku');
    });

    it('returns missing_sku when product.id is null', () => {
      const product = baseProduct({ id: null });
      const issues = getFyndiqArticleInputIssues(product, fyndiqOverrides, 'sv-SE');
      expect(issues).toContain('missing_sku');
    });

    it('does not use product.sku as fallback (no fallback)', () => {
      const product = baseProduct({ sku: 'SKU-456' });
      delete product.id;
      const issues = getFyndiqArticleInputIssues(product, fyndiqOverrides, 'sv-SE');
      expect(issues).toContain('missing_sku');
    });

    it('returns no missing_sku when product.id is present', () => {
      const product = baseProduct({ id: 49558203 });
      const issues = getFyndiqArticleInputIssues(product, fyndiqOverrides, 'sv-SE');
      expect(issues).not.toContain('missing_sku');
    });
  });

  describe('Export SKU semantics (CDON/Fyndiq)', () => {
    it('article_sku from CDON order matches products.id', () => {
      const product = baseProduct({ id: 49558203 });
      const article = mapProductToCdonArticle(product, baseOverrides, 'sv-SE');
      expect(article.sku).toBe('49558203');
      // Order sync would use: WHERE id::text = article_sku
      expect(String(product.id)).toBe(article.sku);
    });

    it('article_sku from Fyndiq order matches products.id', () => {
      const product = baseProduct({ id: 49558203 });
      const article = mapProductToFyndiqArticle(product, fyndiqOverrides, 'sv-SE');
      expect(article.sku).toBe('49558203');
      expect(String(product.id)).toBe(article.sku);
    });
  });

  describe('Parent product id (variant export)', () => {
    it('CDON parent_sku equals parent products.id', () => {
      const parentId = 49558203;
      const variant = baseProduct({ id: 49558204, parentProductId: String(parentId) });
      const article = mapProductToCdonArticle(variant, baseOverrides, 'sv-SE');
      expect(article.parent_sku).toBe('49558203');
    });

    it('Fyndiq parent_sku equals parent products.id', () => {
      const parentId = 49558203;
      const variant = baseProduct({ id: 49558204, parentProductId: String(parentId) });
      const article = mapProductToFyndiqArticle(variant, fyndiqOverrides, 'sv-SE');
      expect(article.parent_sku).toBe('49558203');
    });
  });
});
