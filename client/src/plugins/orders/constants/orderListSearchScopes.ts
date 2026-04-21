/**
 * Order list search scope (GET /api/orders ?q=&searchIn=).
 * Must match backend whitelist in plugins/orders/routes.js.
 */
export const ORDER_LIST_SEARCH_SCOPES = [
  'all',
  'orderNumber',
  'customer',
  'placedDate',
  'total',
  'productTitle',
  'articleNumber',
  'sku',
  'ean',
  'gtin',
] as const;

export type OrderListSearchScope = (typeof ORDER_LIST_SEARCH_SCOPES)[number];

export const DEFAULT_ORDER_LIST_SEARCH_SCOPE: OrderListSearchScope = 'all';

export function isOrderListSearchScope(value: unknown): value is OrderListSearchScope {
  return (
    typeof value === 'string' && (ORDER_LIST_SEARCH_SCOPES as readonly string[]).includes(value)
  );
}

/** UI labels (Swedish). Kanal filtreras via kanalfältet, inte via sök-scope. */
export const ORDER_LIST_SEARCH_SCOPE_LABELS: Record<OrderListSearchScope, string> = {
  all: 'Sök allt',
  orderNumber: 'Ordernr',
  customer: 'Kund',
  placedDate: 'Orderdatum',
  total: 'Belopp',
  productTitle: 'Produkttitel',
  articleNumber: 'Artikelnr',
  sku: 'SKU',
  ean: 'EAN',
  gtin: 'GTIN',
};

export const ORDER_LIST_SEARCH_INPUT_PLACEHOLDER = 'Sök';
