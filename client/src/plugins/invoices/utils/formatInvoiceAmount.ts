/**
 * Display formatting for invoice money amounts in the app UI.
 * Matches document style (sv-SE): space as thousand separator, e.g. 2 500,00.
 */

export function formatInvoiceAmount(amount: number | null | undefined, fractionDigits = 2): string {
  const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return new Intl.NumberFormat('sv-SE', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(n);
}

/** Amount + currency, e.g. "2 500,00 SEK". */
export function formatInvoiceMoney(
  amount: number | null | undefined,
  currency: string,
  fractionDigits = 2,
): string {
  return `${formatInvoiceAmount(amount, fractionDigits)} ${currency}`;
}
