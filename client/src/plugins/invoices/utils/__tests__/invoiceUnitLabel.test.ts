import {
  formatUnitLabelSv,
  isSingularUnitQuantity,
  translateInvoiceUnit,
} from '../invoiceUnitLabel';

describe('invoiceUnitLabel', () => {
  test('isSingularUnitQuantity only for ±1', () => {
    expect(isSingularUnitQuantity(1)).toBe(true);
    expect(isSingularUnitQuantity(-1)).toBe(true);
    expect(isSingularUnitQuantity(0)).toBe(false);
    expect(isSingularUnitQuantity(2)).toBe(false);
    expect(isSingularUnitQuantity(1.5)).toBe(false);
  });

  test('formatUnitLabelSv switches Swedish plural', () => {
    expect(formatUnitLabelSv('month', 1)).toBe('Månad');
    expect(formatUnitLabelSv('month', 2)).toBe('Månader');
    expect(formatUnitLabelSv('day', 1)).toBe('Dag');
    expect(formatUnitLabelSv('day', 3)).toBe('Dagar');
    expect(formatUnitLabelSv('piece', 2)).toBe('Stycken');
    expect(formatUnitLabelSv('custom', 2)).toBe('custom');
  });

  test('translateInvoiceUnit uses i18n count', () => {
    const t = ((key: string, opts?: { count?: number; defaultValue?: string }) => {
      if (key === 'invoices.units.month' && opts?.count === 1) return 'Month';
      if (key === 'invoices.units.month' && opts?.count === 2) return 'Months';
      return opts?.defaultValue || key;
    }) as any;
    expect(translateInvoiceUnit(t, 'month', 1)).toBe('Month');
    expect(translateInvoiceUnit(t, 'month', 2)).toBe('Months');
  });
});
