/**
 * FX rates from Riksbanken cache (GET /api/fx/latest).
 * Rates are "SEK per 1 unit of foreign currency" – e.g. convert SEK to EUR: amountInSEK / rates.EUR.
 */

export type FxLatest = {
  DKK: number | null;
  EUR: number | null;
  NOK: number | null;
  observedAt: string | null;
};

export async function getFxLatest(): Promise<FxLatest> {
  const res = await fetch('/api/fx/latest', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch FX rates');
  return res.json();
}
