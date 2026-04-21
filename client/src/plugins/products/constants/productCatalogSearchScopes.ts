/**
 * Catalog list search scope (GET /api/products ?q=&searchIn=).
 * Must match backend whitelist in plugins/products/routes.js.
 */
export const PRODUCT_CATALOG_SEARCH_SCOPES = [
  'all',
  'productId',
  'groupId',
  'sku',
  'title',
  'privateName',
  'lagerplats',
  'ean',
  'gtin',
] as const;

export type ProductCatalogSearchScope = (typeof PRODUCT_CATALOG_SEARCH_SCOPES)[number];

export const DEFAULT_PRODUCT_CATALOG_SEARCH_SCOPE: ProductCatalogSearchScope = 'all';

export function isProductCatalogSearchScope(value: unknown): value is ProductCatalogSearchScope {
  return (
    typeof value === 'string' &&
    (PRODUCT_CATALOG_SEARCH_SCOPES as readonly string[]).includes(value)
  );
}

/** UI labels (Swedish). */
export const PRODUCT_CATALOG_SEARCH_SCOPE_LABELS: Record<ProductCatalogSearchScope, string> = {
  all: 'Sök allt',
  productId: 'Art.nr',
  groupId: 'Grupp-id',
  sku: 'Referens (SKU)',
  title: 'Titel',
  privateName: 'Eget namn',
  lagerplats: 'Lagerplats',
  ean: 'EAN',
  gtin: 'GTIN',
};

/** Enkel placeholder i sökfältet (ingen ikon). */
export const CATALOG_SEARCH_INPUT_PLACEHOLDER = 'Sök';
