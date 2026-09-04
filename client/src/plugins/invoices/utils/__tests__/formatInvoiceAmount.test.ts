import { formatInvoiceAmount, formatInvoiceMoney } from '../formatInvoiceAmount';

describe('formatInvoiceAmount', () => {
  test('uses space as thousand separator (sv-SE)', () => {
    expect(formatInvoiceAmount(2500)).toBe('2\u00a0500,00');
    expect(formatInvoiceAmount(2500.5)).toBe('2\u00a0500,50');
    expect(formatInvoiceAmount(64_900)).toBe('64\u00a0900,00');
  });

  test('formats money with currency', () => {
    expect(formatInvoiceMoney(2500, 'SEK')).toBe('2\u00a0500,00 SEK');
  });

  test('treats invalid amounts as 0', () => {
    expect(formatInvoiceAmount(null)).toBe('0,00');
    expect(formatInvoiceAmount(Number.NaN)).toBe('0,00');
  });
});
