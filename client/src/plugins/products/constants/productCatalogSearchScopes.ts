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

/** Input placeholder hints per scope (Swedish). */
export const PRODUCT_CATALOG_SEARCH_PLACEHOLDERS: Record<ProductCatalogSearchScope, string> = {
  all: 'Sök artikelnr, SKU, titel, EAN…',
  productId: 'Artikelnummer (id), prefix…',
  groupId: 'Grupp-id…',
  sku: 'SKU / referens…',
  title: 'Titel (alla språk)…',
  privateName: 'Eget namn…',
  lagerplats: 'Lagerplats…',
  ean: 'EAN, prefix…',
  gtin: 'GTIN, prefix…',
};
