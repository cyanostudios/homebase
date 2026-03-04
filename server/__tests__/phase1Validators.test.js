const CdonProductsController = require('../../plugins/cdon-products/controller');
const FyndiqProductsController = require('../../plugins/fyndiq-products/controller');

describe('Phase 1 strict validators', () => {
  let cdonController;
  let fyndiqController;

  beforeEach(() => {
    cdonController = new CdonProductsController({});
    fyndiqController = new FyndiqProductsController({});
  });

  describe('CDON validators', () => {
    it('accepts valid update_article_price action', () => {
      const result = cdonController.validateCdonUpdateArticlePriceAction({
        sku: 'SKU-1',
        action: 'update_article_price',
        body: {
          price: [
            {
              market: 'SE',
              value: {
                amount_including_vat: 199.5,
                currency: 'SEK',
              },
            },
          ],
        },
      });

      expect(result).toEqual({ ok: true });
    });

    it('rejects price action with invalid currency', () => {
      const result = cdonController.validateCdonUpdateArticlePriceAction({
        sku: 'SKU-1',
        action: 'update_article_price',
        body: {
          price: [
            {
              market: 'SE',
              value: {
                amount_including_vat: 199.5,
                currency: 'SE',
              },
            },
          ],
        },
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_currency');
    });

    it('rejects quantity action with non-integer quantity', () => {
      const result = cdonController.validateCdonUpdateArticleQuantityAction({
        sku: 'SKU-1',
        action: 'update_article_quantity',
        body: { quantity: 1.25 },
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_quantity');
    });
  });

  describe('Fyndiq validators', () => {
    it('accepts valid update_article_price action', () => {
      const result = fyndiqController.validateFyndiqUpdateArticlePriceAction({
        action: 'update_article_price',
        id: 123,
        body: {
          price: [{ market: 'se', value: { amount: 100, currency: 'SEK' } }],
          original_price: [{ market: 'se', value: { amount: 100, currency: 'SEK' } }],
        },
      });

      expect(result).toEqual({ ok: true });
    });

    it('rejects price action when original_price is missing', () => {
      const result = fyndiqController.validateFyndiqUpdateArticlePriceAction({
        action: 'update_article_price',
        id: 123,
        body: {
          price: [{ market: 'se', value: { amount: 100, currency: 'SEK' } }],
        },
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('missing_original_price_rows');
    });

    it('rejects quantity action with invalid article id', () => {
      const result = fyndiqController.validateFyndiqUpdateArticleQuantityAction({
        action: 'update_article_quantity',
        id: 'abc',
        body: { quantity: 5 },
      });

      expect(result.ok).toBe(false);
      expect(result.reason).toBe('invalid_article_id');
    });
  });
});
