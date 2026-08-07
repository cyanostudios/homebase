/**
 * Format a price list amount with Intl.NumberFormat using the list currency.
 * Falls back to `"amount CURRENCY"` when the currency code is invalid.
 */
export function formatPriceListPrice(amount: number, currency: string, locale?: string): string {
  const code = (currency || 'SEK').trim() || 'SEK';
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: code,
    }).format(value);
  } catch {
    return `${value} ${code}`;
  }
}
