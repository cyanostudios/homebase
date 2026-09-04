const {
  resolveInvoiceNumbering,
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
});
