const {
  normalizeDefaultTexts,
  EMPTY_DEFAULT_TEXTS,
  MAX_MAIL_TEXT,
} = require('../DefaultTextsService');

describe('normalizeDefaultTexts', () => {
  test('returns empty shape for null/invalid input', () => {
    expect(normalizeDefaultTexts(null)).toEqual(EMPTY_DEFAULT_TEXTS);
    expect(normalizeDefaultTexts('x')).toEqual(EMPTY_DEFAULT_TEXTS);
    expect(normalizeDefaultTexts([])).toEqual(EMPTY_DEFAULT_TEXTS);
  });

  test('trims known fields and drops unknown keys', () => {
    expect(
      normalizeDefaultTexts({
        invoiceMail: '  Hello invoice  ',
        estimateMail: '  Hello estimate  ',
        unknown: true,
      }),
    ).toEqual({
      invoiceMail: 'Hello invoice',
      estimateMail: 'Hello estimate',
    });
  });

  test('allows empty strings', () => {
    expect(
      normalizeDefaultTexts({
        invoiceMail: '',
        estimateMail: '   ',
      }),
    ).toEqual({
      invoiceMail: '',
      estimateMail: '',
    });
  });

  test('truncates mail texts to max length', () => {
    const long = 'a'.repeat(MAX_MAIL_TEXT + 50);
    const normalized = normalizeDefaultTexts({ invoiceMail: long, estimateMail: long });
    expect(normalized.invoiceMail).toHaveLength(MAX_MAIL_TEXT);
    expect(normalized.estimateMail).toHaveLength(MAX_MAIL_TEXT);
  });
});
