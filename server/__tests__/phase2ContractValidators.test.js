const {
  validateCdonArticlePayload,
  getCdonArticleInputIssues,
} = require('../../plugins/cdon-products/mapToCdonArticle');
const {
  validateFyndiqArticlePayload,
  getFyndiqArticleInputIssues,
} = require('../../plugins/fyndiq-products/mapToFyndiqArticle');

describe('Phase 2 contract validators', () => {
  const validCdonArticle = {
    sku: 'SKU-1',
    status: 'for sale',
    quantity: 10,
    main_image: 'https://example.com/img.png',
    markets: ['SE', 'FI'],
    title: [{ language: 'sv-SE', value: 'Valid title' }],
    description: [{ language: 'sv-SE', value: 'Valid description with at least 10 chars' }],
    price: [
      { market: 'SE', value: { amount_including_vat: 199, currency: 'SEK' } },
      { market: 'FI', value: { amount_including_vat: 19.9, currency: 'EUR' } },
    ],
    shipping_time: [
      { market: 'SE', min: 1, max: 3 },
      { market: 'FI', min: 2, max: 5 },
    ],
    category: '1124',
  };

  const validFyndiqArticle = {
    sku: 'SKU-1',
    status: 'for sale',
    quantity: 10,
    main_image: 'https://example.com/img.png',
    markets: ['SE', 'FI'],
    categories: ['1', '2'],
    title: [{ language: 'sv-SE', value: 'Valid title' }],
    description: [{ language: 'sv-SE', value: 'Valid description with at least 10 chars' }],
    price: [
      { market: 'SE', value: { amount: 199, currency: 'SEK' } },
      { market: 'FI', value: { amount: 19.9, currency: 'EUR' } },
    ],
    shipping_time: [
      { market: 'SE', min: 1, max: 3 },
      { market: 'FI', min: 2, max: 5 },
    ],
  };

  describe('validateCdonArticlePayload', () => {
    it('accepts valid CDON article', () => {
      expect(validateCdonArticlePayload(validCdonArticle)).toEqual({ ok: true });
    });

    it('rejects missing sku', () => {
      const result = validateCdonArticlePayload({ ...validCdonArticle, sku: '' });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('missing_sku');
    });

    it('rejects invalid status', () => {
      const result = validateCdonArticlePayload({ ...validCdonArticle, status: 'invalid' });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('rejects missing category', () => {
      const result = validateCdonArticlePayload({ ...validCdonArticle, category: '' });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('missing_category');
    });

    it('rejects invalid market (NO allowed)', () => {
      const result = validateCdonArticlePayload({
        ...validCdonArticle,
        markets: ['SE', 'XX'],
      });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_market');
    });

    it('accepts NO market', () => {
      const withNo = { ...validCdonArticle, markets: ['SE', 'NO'] };
      expect(validateCdonArticlePayload(withNo)).toEqual({ ok: true });
    });

    it('rejects amount <= 0', () => {
      const bad = {
        ...validCdonArticle,
        price: validCdonArticle.price.map((p, i) =>
          i === 0 ? { ...p, value: { ...p.value, amount_including_vat: 0 } } : p,
        ),
      };
      const result = validateCdonArticlePayload(bad);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_amount_including_vat');
    });

    it('accepts shipping_time max 10', () => {
      const withMax10 = {
        ...validCdonArticle,
        shipping_time: [
          { market: 'SE', min: 1, max: 10 },
          { market: 'FI', min: 2, max: 10 },
        ],
      };
      expect(validateCdonArticlePayload(withMax10)).toEqual({ ok: true });
    });

    it('rejects shipping_time max > 10', () => {
      const bad = {
        ...validCdonArticle,
        shipping_time: [
          { market: 'SE', min: 1, max: 11 },
          { market: 'FI', min: 2, max: 5 },
        ],
      };
      const result = validateCdonArticlePayload(bad);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_shipping_time_range');
    });
  });

  describe('validateFyndiqArticlePayload', () => {
    it('accepts valid Fyndiq article', () => {
      expect(validateFyndiqArticlePayload(validFyndiqArticle)).toEqual({ ok: true });
    });

    it('rejects missing categories', () => {
      const result = validateFyndiqArticlePayload({ ...validFyndiqArticle, categories: [] });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('missing_categories');
    });

    it('rejects invalid status', () => {
      const result = validateFyndiqArticlePayload({ ...validFyndiqArticle, status: 'invalid' });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_status');
    });

    it('accepts NO market', () => {
      const withNo = { ...validFyndiqArticle, markets: ['SE', 'NO'] };
      expect(validateFyndiqArticlePayload(withNo)).toEqual({ ok: true });
    });

    it('rejects amount <= 0', () => {
      const bad = {
        ...validFyndiqArticle,
        price: validFyndiqArticle.price.map((p, i) =>
          i === 0 ? { ...p, value: { ...p.value, amount: 0 } } : p,
        ),
      };
      const result = validateFyndiqArticlePayload(bad);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_amount');
    });

    it('accepts shipping_time max 20', () => {
      const withMax20 = {
        ...validFyndiqArticle,
        shipping_time: [
          { market: 'SE', min: 1, max: 20 },
          { market: 'FI', min: 2, max: 20 },
        ],
      };
      expect(validateFyndiqArticlePayload(withMax20)).toEqual({ ok: true });
    });

    it('rejects shipping_time max > 20', () => {
      const bad = {
        ...validFyndiqArticle,
        shipping_time: [
          { market: 'SE', min: 1, max: 21 },
          { market: 'FI', min: 2, max: 5 },
        ],
      };
      const result = validateFyndiqArticlePayload(bad);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_shipping_time_range');
    });
  });

  describe('getCdonArticleInputIssues', () => {
    it('returns missing_sku for product without sku or id', () => {
      const product = { title: 'x', mainImage: 'http://x', quantity: 0 };
      const issues = getCdonArticleInputIssues(product, {}, 'sv-SE', ['se']);
      expect(issues).toContain('missing_sku');
    });

    it('returns missing_positive_price when no positive price', () => {
      const product = {
        id: 12345,
        title: 'x',
        mainImage: 'http://x',
        quantity: 1,
        description: 'x'.repeat(10),
      };
      const overrides = { se: { active: true, priceAmount: 0, category: '1' } };
      const issues = getCdonArticleInputIssues(product, overrides, 'sv-SE', ['se']);
      expect(issues).toContain('missing_positive_price');
    });
  });

  describe('getFyndiqArticleInputIssues', () => {
    it('returns missing_categories when no category for active market', () => {
      const product = {
        id: 12345,
        title: 'x',
        mainImage: 'http://x',
        quantity: 1,
        description: 'x'.repeat(10),
      };
      const overrides = { se: { active: true, priceAmount: 99, category: null } };
      const issues = getFyndiqArticleInputIssues(product, overrides, 'sv-SE', ['se']);
      expect(issues.some((i) => i.includes('category'))).toBe(true);
    });
  });
});
