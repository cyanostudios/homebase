import type { ProductListSortField } from '../api/productsApi';
import type { Product } from '../types/products';

/** Valbara datakolumner (inte spacer, checkbox eller Actions). */
export type ProductListDataColumnId =
  | 'id'
  | 'title'
  | 'sku'
  | 'quantity'
  | 'priceAmount'
  | 'status'
  | 'mpn'
  | 'ean'
  | 'gtin'
  | 'brand'
  | 'listName'
  | 'supplierName'
  | 'manufacturerName'
  | 'lagerplats'
  | 'purchasePrice'
  | 'vatRate'
  | 'weight'
  | 'quantitySold'
  | 'updatedAt';

export const PRODUCT_LIST_DATA_COLUMN_ORDER: ProductListDataColumnId[] = [
  'id',
  'title',
  'sku',
  'quantity',
  'priceAmount',
  'status',
  'mpn',
  'brand',
  'ean',
  'gtin',
  'listName',
  'supplierName',
  'manufacturerName',
  'lagerplats',
  'purchasePrice',
  'vatRate',
  'weight',
  'quantitySold',
  'updatedAt',
];

const SORTABLE: Partial<Record<ProductListDataColumnId, ProductListSortField>> = {
  id: 'id',
  title: 'title',
  sku: 'sku',
  quantity: 'quantity',
  priceAmount: 'priceAmount',
};

const PRODUCT_LIST_COLUMN_LABELS: Record<ProductListDataColumnId, string> = {
  id: '#',
  title: 'Titel',
  sku: 'SKU',
  quantity: 'Antal',
  priceAmount: 'Pris',
  status: 'Status',
  mpn: 'MPN',
  ean: 'EAN',
  gtin: 'GTIN',
  brand: 'Varumärke',
  listName: 'Lista',
  supplierName: 'Leverantör',
  manufacturerName: 'Tillverkare',
  lagerplats: 'Lagerplats',
  purchasePrice: 'Inköpspris',
  vatRate: 'Moms %',
  weight: 'Vikt (kg)',
  quantitySold: 'Sålda (totalt)',
  updatedAt: 'Uppdaterad',
};

export type ProductListColumnMeta = {
  id: ProductListDataColumnId;
  label: string;
  sortField?: ProductListSortField;
};

export const PRODUCT_LIST_COLUMN_META: ProductListColumnMeta[] = PRODUCT_LIST_DATA_COLUMN_ORDER.map(
  (id) => ({
    id,
    label: PRODUCT_LIST_COLUMN_LABELS[id],
    sortField: SORTABLE[id],
  }),
);

/** Standard synliga kolumner (samma som tidigare fast tabell). */
export const DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS: ProductListDataColumnId[] = [
  'id',
  'title',
  'sku',
  'quantity',
  'priceAmount',
];

const VALID_ID = new Set<ProductListDataColumnId>(PRODUCT_LIST_DATA_COLUMN_ORDER);

export function isProductListDataColumnId(value: unknown): value is ProductListDataColumnId {
  return typeof value === 'string' && VALID_ID.has(value as ProductListDataColumnId);
}

export function storageKeyProductListColumns(tenantId: number): string {
  return `homebase:products:catalogColumns:${tenantId}`;
}

export function parseStoredProductListColumns(
  raw: string | null,
): ProductListDataColumnId[] | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const out: ProductListDataColumnId[] = [];
    for (const item of parsed) {
      if (isProductListDataColumnId(item) && !out.includes(item)) {
        out.push(item);
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function normalizeVisibleColumnSelection(
  ids: ProductListDataColumnId[] | null | undefined,
): ProductListDataColumnId[] {
  if (!ids?.length) {
    return [...DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS];
  }
  const ordered: ProductListDataColumnId[] = [];
  for (const id of PRODUCT_LIST_DATA_COLUMN_ORDER) {
    if (ids.includes(id)) {
      ordered.push(id);
    }
  }
  return ordered.length > 0 ? ordered : [...DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS];
}

function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
): string {
  const n = Number(amount);
  const cur = currency || 'SEK';
  if (!Number.isFinite(n)) {
    return '—';
  }
  return `${n.toFixed(2)} ${cur}`;
}

function formatDateSv(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) {
    return '—';
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    return '—';
  }
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });
}

/** Enkel text för mobilrader och plain desktop-celler (ej titel/kvantitet/pris-specialfall). */
export function formatProductListPlainColumn(
  columnId: ProductListDataColumnId,
  product: Product,
): string {
  switch (columnId) {
    case 'id':
      return String(product.id ?? '');
    case 'title':
      return String(product.title ?? '').trim() || '—';
    case 'sku':
      return String(product.sku ?? '').trim() || '—';
    case 'quantity':
      return String(Number.isFinite(Number(product.quantity)) ? product.quantity : 0);
    case 'priceAmount':
      return formatMoney(product.priceAmount, product.currency);
    case 'status':
      return product.status === 'paused' ? 'Pausad' : 'Till salu';
    case 'mpn':
      return String(product.mpn ?? '').trim() || '—';
    case 'ean':
      return String(product.ean ?? '').trim() || '—';
    case 'gtin':
      return String(product.gtin ?? '').trim() || '—';
    case 'brand':
      return String(product.brand ?? '').trim() || '—';
    case 'listName':
      return String(product.listName ?? '').trim() || '—';
    case 'supplierName':
      return String(product.supplierName ?? '').trim() || '—';
    case 'manufacturerName':
      return String(product.manufacturerName ?? '').trim() || '—';
    case 'lagerplats':
      return String(product.lagerplats ?? '').trim() || '—';
    case 'purchasePrice':
      return typeof product.purchasePrice === 'number' && Number.isFinite(product.purchasePrice)
        ? formatMoney(product.purchasePrice, product.currency)
        : '—';
    case 'vatRate': {
      const v = Number(product.vatRate);
      return Number.isFinite(v) ? String(v) : '—';
    }
    case 'weight':
      return typeof product.weight === 'number' && Number.isFinite(product.weight)
        ? String(product.weight)
        : '—';
    case 'quantitySold':
      return typeof product.quantitySold === 'number' && Number.isFinite(product.quantitySold)
        ? String(product.quantitySold)
        : '—';
    case 'updatedAt':
      return formatDateSv(product.updatedAt);
    default:
      return '—';
  }
}
