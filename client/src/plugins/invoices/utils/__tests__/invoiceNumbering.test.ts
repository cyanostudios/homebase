import {
  formatInvoiceNumberExample,
  invoiceNumberHasStoredPrefix,
  normalizeInvoiceNumbering,
  sanitizeInvoiceNumberPrefix,
  sanitizeInvoiceNumberStart,
} from '../invoiceNumbering';

describe('sanitizeInvoiceNumberPrefix', () => {
  it('uppercases and strips non-alphanumeric', () => {
    expect(sanitizeInvoiceNumberPrefix(' f-akt! ')).toBe('FAKT');
    expect(sanitizeInvoiceNumberPrefix('inv')).toBe('INV');
  });

  it('returns empty for invalid input', () => {
    expect(sanitizeInvoiceNumberPrefix(null)).toBe('');
    expect(sanitizeInvoiceNumberPrefix('---')).toBe('');
  });
});

describe('sanitizeInvoiceNumberStart', () => {
  it('clamps to a positive integer', () => {
    expect(sanitizeInvoiceNumberStart(100)).toBe(100);
    expect(sanitizeInvoiceNumberStart('42')).toBe(42);
    expect(sanitizeInvoiceNumberStart(0)).toBe(1);
    expect(sanitizeInvoiceNumberStart(-5)).toBe(1);
    expect(sanitizeInvoiceNumberStart('')).toBe(1);
  });
});

describe('normalizeInvoiceNumbering', () => {
  it('applies defaults', () => {
    expect(normalizeInvoiceNumbering(null)).toEqual({
      numberPrefix: '',
      numberStart: 1,
      includeYear: true,
    });
  });

  it('normalizes stored settings', () => {
    expect(
      normalizeInvoiceNumbering({
        numberPrefix: 'f',
        numberStart: '250',
        includeYear: false,
      }),
    ).toEqual({ numberPrefix: 'F', numberStart: 250, includeYear: false });
  });
});

describe('formatInvoiceNumberExample', () => {
  it('builds year-seq or prefix-year-seq when year is included', () => {
    expect(
      formatInvoiceNumberExample({ numberPrefix: '', numberStart: 1, includeYear: true }, 2026),
    ).toBe('2026-001');
    expect(
      formatInvoiceNumberExample({ numberPrefix: 'F', numberStart: 100, includeYear: true }, 2026),
    ).toBe('F-2026-100');
  });

  it('omits year when includeYear is false', () => {
    expect(
      formatInvoiceNumberExample({ numberPrefix: '', numberStart: 1, includeYear: false }, 2026),
    ).toBe('001');
    expect(
      formatInvoiceNumberExample({ numberPrefix: 'F', numberStart: 100, includeYear: false }, 2026),
    ).toBe('F-100');
  });
});

describe('invoiceNumberHasStoredPrefix', () => {
  it('detects PREFIX-YYYY-NNN and PREFIX-NNN', () => {
    expect(invoiceNumberHasStoredPrefix('INV-2026-001')).toBe(true);
    expect(invoiceNumberHasStoredPrefix('F-2026-100')).toBe(true);
    expect(invoiceNumberHasStoredPrefix('F-100')).toBe(true);
    expect(invoiceNumberHasStoredPrefix('2026-001')).toBe(false);
    expect(invoiceNumberHasStoredPrefix('12')).toBe(false);
  });
});
