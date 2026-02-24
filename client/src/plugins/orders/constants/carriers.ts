/**
 * Approved carriers for order fulfillment (carrier_name in API).
 * Use the exact strings required by each channel's API.
 *
 * CDON: https://support.cdon.com/hc/en-us/articles/38112304131092
 * Fyndiq: https://support.fyndiq.se/hc/en-se/articles/34973332132372
 *
 * If a carrier is missing or spelled differently, add the exact string from the support article.
 */

/** Exact strings for CDON fulfillment API carrier_name field. */
export const CDON_CARRIERS: string[] = [
  'Airmee',
  'Asendia',
  'Austrian Post',
  'Bpost',
  'BRT',
  'Budbee',
  'Chronopost',
  'CityMail',
  'Colissimo',
  'Correos',
  'Dachser',
  'DAO',
  'DB Schenker',
  'DHL',
  'DPD',
  'DPD France',
  'Early Bird',
  'FERCAM',
  'GLS',
  'Helthjem',
  'Instabox',
  'Matkahuolto',
  'NACEX',
  'Poste Italiane',
  'Posten Bring',
  'Posti',
  'PostNL',
  'PostNord',
  'SDA',
  'SEUR',
  'Spring GDS',
];

/** Exact strings for Fyndiq fulfillment API carrier_name field. */
export const FYNDIQ_CARRIERS: string[] = [
  '4PX',
  'Airmee',
  'Asendia',
  'Austrian Post',
  'Bpost',
  'BRT',
  'Budbee',
  'Chronopost',
  'CityMail',
  'CNE',
  'Colissimo',
  'Correos',
  'Dachser',
  'DAO',
  'DB Schenker',
  'DHL',
  'DPD',
  'DPD France',
  'Early Bird',
  'eQuick',
  'FERCAM',
  'GLS',
  'Helthjem',
  'Instabox',
  'Matkahuolto',
  'NACEX',
  'Poste Italiane',
  'Posten Bring',
  'Posti',
  'PostNL',
  'PostNord',
  'SDA',
  'SEUR',
  'Spring GDS',
  'Sunyou',
  'Yanwen',
];

/**
 * Vanliga fraktbolag i Sverige för WooCommerce (förslag i UI; WooCommerce kräver inga exakta API-strängar).
 */
export const WOOCOMMERCE_CARRIERS_SE: string[] = [
  'PostNord',
  'Bring',
  'DHL',
  'Schenker',
  'DB Schenker',
  'Budbee',
  'Instabox',
  'Matkahuolto',
  'GLS',
  'UPS',
  'FedEx',
  'CityMail',
  'Early Bird',
  'Airmee',
  'Helthjem',
  'DPD',
];

export type OrderChannel = 'woocommerce' | 'cdon' | 'fyndiq';

/** Returns the approved carrier list for the given channel. WooCommerce gets Swedish common carriers (suggestions). */
export function getCarriersForChannel(channel: OrderChannel | string): string[] {
  const c = String(channel || '').toLowerCase();
  if (c === 'cdon') return CDON_CARRIERS;
  if (c === 'fyndiq') return FYNDIQ_CARRIERS;
  if (c === 'woocommerce') return WOOCOMMERCE_CARRIERS_SE;
  return [];
}

const CDON_SET = new Set(CDON_CARRIERS);
const FYNDIQ_SET = new Set(FYNDIQ_CARRIERS);

/** Carriers that exist in both CDON and Fyndiq (same API string). */
const COMMON_CARRIERS = CDON_CARRIERS.filter((c) => FYNDIQ_SET.has(c)).sort((a, b) => a.localeCompare(b));

/** Carriers only in Fyndiq; in batch we show them as "Name (Fyndiq)". */
const FYNDIQ_ONLY_CARRIERS = FYNDIQ_CARRIERS.filter((c) => !CDON_SET.has(c)).sort((a, b) => a.localeCompare(b));

/**
 * Single merged list for batch update: common carriers once, Fyndiq-only with "(Fyndiq)" suffix.
 * WooCommerce uses the same list (no separate API requirements).
 * Each item: { value } is the API string to send; label is for display.
 */
export const BATCH_CARRIERS: Array<{ value: string; label: string }> = [
  ...COMMON_CARRIERS.map((value) => ({ value, label: value })),
  ...FYNDIQ_ONLY_CARRIERS.map((value) => ({ value, label: `${value} (Fyndiq)` })),
];
