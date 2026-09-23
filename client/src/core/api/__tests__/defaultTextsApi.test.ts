import { EMPTY_DEFAULT_TEXTS, normalizeDefaultTexts } from '../defaultTextsApi';

describe('normalizeDefaultTexts', () => {
  test('returns empty shape for null/invalid input', () => {
    expect(normalizeDefaultTexts(null)).toEqual(EMPTY_DEFAULT_TEXTS);
    expect(normalizeDefaultTexts('x')).toEqual(EMPTY_DEFAULT_TEXTS);
  });

  test('trims known fields', () => {
    expect(
      normalizeDefaultTexts({
        invoiceMail: '  Please find your invoice attached.  ',
        estimateMail: '  Please find your estimate attached.  ',
      }),
    ).toEqual({
      invoiceMail: 'Please find your invoice attached.',
      estimateMail: 'Please find your estimate attached.',
    });
  });

  test('allows empty strings', () => {
    expect(normalizeDefaultTexts({ invoiceMail: '', estimateMail: '  ' })).toEqual({
      invoiceMail: '',
      estimateMail: '',
    });
  });

  test('truncates to 8000 characters', () => {
    const long = 'b'.repeat(8050);
    const normalized = normalizeDefaultTexts({ invoiceMail: long, estimateMail: long });
    expect(normalized.invoiceMail).toHaveLength(8000);
    expect(normalized.estimateMail).toHaveLength(8000);
  });
});
