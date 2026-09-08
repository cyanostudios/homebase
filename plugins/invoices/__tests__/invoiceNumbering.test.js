const {
  resolveInvoiceNumbering,
  normalizeInvoiceNumberingByType,
  resolveInvoiceNumberingForType,
  sanitizeInvoiceNumberingType,
  buildInvoiceNumberingSettingsPayload,
  buildInvoiceNumber,
  buildInvoiceNumberMatchRegex,
  parseSequenceFromInvoiceNumber,
} = require('../invoiceNumbering');

describe('invoiceNumbering (server)', () => {
  it('resolves defaults and sanitizes settings', () => {
    expect(resolveInvoiceNumbering(null)).toEqual({
      numberPrefix: '',
      numberStart: 1,
      includeYear: true,
    });
    expect(
      resolveInvoiceNumbering({ numberPrefix: 'inv!', numberStart: '50', includeYear: false }),
    ).toEqual({
      numberPrefix: 'INV',
      numberStart: 50,
      includeYear: false,
    });
  });

  it('builds numbers and match regex with year', () => {
    expect(buildInvoiceNumber('', 2026, 1, true)).toBe('2026-001');
    expect(buildInvoiceNumber('F', 2026, 100, true)).toBe('F-2026-100');
    expect(buildInvoiceNumberMatchRegex('', 2026, true)).toBe('^2026-[0-9]+$');
    expect(buildInvoiceNumberMatchRegex('F', 2026, true)).toBe('^F-2026-[0-9]+$');
  });

  it('builds numbers and match regex without year', () => {
    expect(buildInvoiceNumber('', 2026, 1, false)).toBe('001');
    expect(buildInvoiceNumber('F', 2026, 100, false)).toBe('F-100');
    expect(buildInvoiceNumberMatchRegex('', 2026, false)).toBe('^[0-9]+$');
    expect(buildInvoiceNumberMatchRegex('F', 2026, false)).toBe('^F-[0-9]+$');
  });

  it('parses sequence from matching numbers only', () => {
    expect(parseSequenceFromInvoiceNumber('2026-042', '', 2026, true)).toBe(42);
    expect(parseSequenceFromInvoiceNumber('F-2026-100', 'F', 2026, true)).toBe(100);
    expect(parseSequenceFromInvoiceNumber('F-100', 'F', 2026, false)).toBe(100);
    expect(parseSequenceFromInvoiceNumber('042', '', 2026, false)).toBe(42);
    expect(parseSequenceFromInvoiceNumber('INV-2026-001', '', 2026, true)).toBeNull();
    expect(parseSequenceFromInvoiceNumber('2026-001', 'F', 2026, true)).toBeNull();
  });

  it('hydrates flat settings onto invoice type only', () => {
    const byType = normalizeInvoiceNumberingByType({
      numberPrefix: 'F',
      numberStart: 10,
      includeYear: false,
    });
    expect(byType.invoice).toEqual({ numberPrefix: 'F', numberStart: 10, includeYear: false });
    expect(byType.credit_note).toEqual({ numberPrefix: '', numberStart: 1, includeYear: true });
    expect(byType.cash_invoice).toEqual({ numberPrefix: '', numberStart: 1, includeYear: true });
    expect(byType.receipt).toEqual({ numberPrefix: '', numberStart: 1, includeYear: true });
  });

  it('reads numberingByType and fills missing types', () => {
    const byType = normalizeInvoiceNumberingByType({
      numberingByType: {
        credit_note: { numberPrefix: 'k', numberStart: 5, includeYear: true },
      },
    });
    expect(byType.credit_note).toEqual({ numberPrefix: 'K', numberStart: 5, includeYear: true });
    expect(byType.invoice).toEqual({ numberPrefix: '', numberStart: 1, includeYear: true });
  });

  it('resolves series for type with allowlist fallback', () => {
    const settings = {
      numberingByType: {
        invoice: { numberPrefix: 'F', numberStart: 1, includeYear: true },
        receipt: { numberPrefix: 'KV', numberStart: 20, includeYear: false },
      },
    };
    expect(resolveInvoiceNumberingForType(settings, 'receipt')).toEqual({
      numberPrefix: 'KV',
      numberStart: 20,
      includeYear: false,
    });
    expect(sanitizeInvoiceNumberingType('nope')).toBe('invoice');
    expect(resolveInvoiceNumberingForType(settings, 'nope')).toEqual({
      numberPrefix: 'F',
      numberStart: 1,
      includeYear: true,
    });
  });

  it('builds settings payload with flat mirror of invoice series', () => {
    const payload = buildInvoiceNumberingSettingsPayload({
      invoice: { numberPrefix: 'F', numberStart: 3, includeYear: false },
      credit_note: { numberPrefix: 'K', numberStart: 1, includeYear: true },
    });
    expect(payload.numberPrefix).toBe('F');
    expect(payload.numberStart).toBe(3);
    expect(payload.includeYear).toBe(false);
    expect(payload.numberingByType.credit_note.numberPrefix).toBe('K');
    expect(payload.numberingByType.cash_invoice.numberStart).toBe(1);
  });
});
