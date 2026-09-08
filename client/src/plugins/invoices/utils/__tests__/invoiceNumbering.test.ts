import {
  buildInvoiceNumberingSettingsPayload,
  findInvoiceNumberingSeriesCollisions,
  formatInvoiceNumberExample,
  invoiceNumberHasStoredPrefix,
  normalizeInvoiceNumbering,
  normalizeInvoiceNumberingByType,
  resolveInvoiceNumberingForType,
  sanitizeInvoiceNumberPrefix,
  sanitizeInvoiceNumberStart,
  sanitizeInvoiceNumberingType,
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

describe('normalizeInvoiceNumberingByType', () => {
  it('hydrates flat settings onto invoice type only', () => {
    const byType = normalizeInvoiceNumberingByType({
      numberPrefix: 'F',
      numberStart: 10,
      includeYear: false,
    });
    expect(byType.invoice).toEqual({ numberPrefix: 'F', numberStart: 10, includeYear: false });
    expect(byType.credit_note).toEqual({ numberPrefix: '', numberStart: 1, includeYear: true });
  });

  it('reads numberingByType and fills missing types', () => {
    const byType = normalizeInvoiceNumberingByType({
      numberingByType: {
        receipt: { numberPrefix: 'kv', numberStart: 2, includeYear: false },
      },
    });
    expect(byType.receipt).toEqual({ numberPrefix: 'KV', numberStart: 2, includeYear: false });
    expect(byType.invoice.numberStart).toBe(1);
  });

  it('resolves type with allowlist fallback', () => {
    const settings = {
      numberingByType: {
        invoice: { numberPrefix: 'F', numberStart: 1, includeYear: true },
      },
    };
    expect(sanitizeInvoiceNumberingType('cash_invoice')).toBe('cash_invoice');
    expect(sanitizeInvoiceNumberingType('nope')).toBe('invoice');
    expect(resolveInvoiceNumberingForType(settings, 'invoice').numberPrefix).toBe('F');
  });

  it('builds settings payload with flat mirror', () => {
    const payload = buildInvoiceNumberingSettingsPayload({
      invoice: { numberPrefix: 'F', numberStart: 3, includeYear: false },
      credit_note: { numberPrefix: 'K', numberStart: 1, includeYear: true },
      cash_invoice: { numberPrefix: '', numberStart: 1, includeYear: true },
      receipt: { numberPrefix: '', numberStart: 1, includeYear: true },
    });
    expect(payload.numberPrefix).toBe('F');
    expect(payload.includeYear).toBe(false);
    expect(payload.numberingByType.credit_note.numberPrefix).toBe('K');
  });

  it('detects series collisions across types', () => {
    const byType = normalizeInvoiceNumberingByType({
      numberingByType: {
        invoice: { numberPrefix: 'F', includeYear: true, numberStart: 1 },
        credit_note: { numberPrefix: 'F', includeYear: true, numberStart: 1 },
        cash_invoice: { numberPrefix: 'KF', includeYear: true, numberStart: 1 },
      },
    });
    expect(findInvoiceNumberingSeriesCollisions(byType, 'invoice')).toEqual(['credit_note']);
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
