import {
  computeDueDateFromPaymentTerms,
  formatInvoiceDueDate,
  parsePaymentTermsDays,
} from '../invoiceDueDate';
import { compareInvoicesByField } from '../invoiceListSort';
import { resolveInvoiceColumnCount } from '../invoiceColumnCount';

describe('parsePaymentTermsDays', () => {
  it('parses contact-style day counts', () => {
    expect(parsePaymentTermsDays('30')).toBe(30);
    expect(parsePaymentTermsDays(15)).toBe(15);
    expect(parsePaymentTermsDays('0')).toBe(0);
  });

  it('parses free-text payment terms', () => {
    expect(parsePaymentTermsDays('30 dagar netto')).toBe(30);
    expect(parsePaymentTermsDays('Net 60')).toBe(60);
  });

  it('returns null for empty or unparseable values', () => {
    expect(parsePaymentTermsDays('')).toBeNull();
    expect(parsePaymentTermsDays(null)).toBeNull();
    expect(parsePaymentTermsDays('netto')).toBeNull();
  });
});

describe('computeDueDateFromPaymentTerms', () => {
  it('adds payment-term days to issue date', () => {
    const due = computeDueDateFromPaymentTerms(new Date(2026, 7, 25, 12, 0, 0), '30');
    expect(due?.getFullYear()).toBe(2026);
    expect(due?.getMonth()).toBe(8); // September
    expect(due?.getDate()).toBe(24);
  });

  it('supports immediate (0 days)', () => {
    const issue = new Date(2026, 7, 25, 12, 0, 0);
    const due = computeDueDateFromPaymentTerms(issue, '0');
    expect(due?.toDateString()).toBe(issue.toDateString());
  });
});

describe('formatInvoiceDueDate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 25, 12, 0, 0));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns null for missing dates', () => {
    expect(formatInvoiceDueDate(null)).toBeNull();
    expect(formatInvoiceDueDate(undefined)).toBeNull();
  });

  it('marks overdue dates', () => {
    const result = formatInvoiceDueDate(new Date(2026, 7, 20));
    expect(result?.text).toMatch(/overdue/);
    expect(result?.className).toContain('destructive');
  });

  it('marks due today', () => {
    const result = formatInvoiceDueDate(new Date(2026, 7, 25));
    expect(result?.text).toBe('Due today');
  });

  it('marks due tomorrow', () => {
    const result = formatInvoiceDueDate(new Date(2026, 7, 26));
    expect(result?.text).toBe('Due tomorrow');
  });
});

describe('compareInvoicesByField', () => {
  it('sorts by total descending', () => {
    const a = { total: 100 } as any;
    const b = { total: 200 } as any;
    expect(compareInvoicesByField(a, b, 'total', 'desc')).toBeGreaterThan(0);
  });
});

describe('resolveInvoiceColumnCount', () => {
  it('reads columnCount and migrates legacy viewMode', () => {
    expect(resolveInvoiceColumnCount({ columnCount: 2 })).toBe(2);
    expect(resolveInvoiceColumnCount({ viewMode: 'grid' })).toBe(3);
    expect(resolveInvoiceColumnCount({})).toBe(1);
  });
});
