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

/** Per-marknads-titel (textsExtended.name). */
export const DYNAMIC_TITLE_MARKET_KEYS = ['se', 'dk', 'fi', 'no'] as const;
export type DynamicTitleMarketKey = (typeof DYNAMIC_TITLE_MARKET_KEYS)[number];

/** Etiketter för marknads-titelkolumner (t:se …) i kolumnväljaren. */
export const DYNAMIC_TITLE_MARKET_LABEL: Record<DynamicTitleMarketKey, string> = {
  se: 'Sverige',
  dk: 'Danmark',
  fi: 'Finland',
  no: 'Norge',
};

const VALID_ID = new Set<ProductListDataColumnId>(PRODUCT_LIST_DATA_COLUMN_ORDER);

export function isProductListDataColumnId(value: unknown): value is ProductListDataColumnId {
  return typeof value === 'string' && VALID_ID.has(value as ProductListDataColumnId);
}

const RX_TITLE_MARKET = /^t:(se|dk|fi|no)$/;
const RX_INST_PRICE = /^p:(\d+)$/;

/** Tillåtna dynamiska kolumn-id i katalog-API. */
export function isValidListDynamicSpec(value: string): boolean {
  return RX_TITLE_MARKET.test(value) || RX_INST_PRICE.test(value);
}

/** Sann om strängen är en statisk kolumn eller en giltig dynamisk spec. */
export function isValidListColumnSpec(value: string): boolean {
  return isProductListDataColumnId(value) || isValidListDynamicSpec(value);
}

/**
 * För att skicka i `dynamicColumns` (bara dynamiska, inga statiska kolumn-id).
 */
export function listDynamicRequestSpecs(visible: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const s of visible) {
    if (isValidListDynamicSpec(s) && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

export function storageKeyProductListColumns(tenantId: number): string {
  return `homebase:products:catalogColumns:${tenantId}`;
}

export function parseStoredProductListColumns(raw: string | null): string[] | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== 'string' || item === '') {
        continue;
      }
      if (isValidListColumnSpec(item) && !seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Sortera om: valda statiska (fast ordning) + dynamiska (behåll ordningen i `ids` för dynamiska steg).
 */
export function normalizeVisibleColumnSelection(ids: string[] | null | undefined): string[] {
  if (!ids?.length) {
    return [...DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS];
  }
  const staticPicked: ProductListDataColumnId[] = [];
  for (const id of PRODUCT_LIST_DATA_COLUMN_ORDER) {
    if (ids.includes(id) && isProductListDataColumnId(id)) {
      staticPicked.push(id);
    }
  }
  const dyn: string[] = [];
  const seenD = new Set<string>();
  for (const x of ids) {
    if (isValidListDynamicSpec(x) && !seenD.has(x)) {
      seenD.add(x);
      dyn.push(x);
    }
  }
  const out = [...staticPicked, ...dyn];
  return out.length > 0 ? out : [...DEFAULT_VISIBLE_PRODUCT_LIST_COLUMNS];
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

export function labelForListColumnSpec(
  spec: string,
  opts: {
    instanceLabelById: Map<string, string>;
  },
): string {
  if (isProductListDataColumnId(spec)) {
    return PRODUCT_LIST_COLUMN_LABELS[spec];
  }
  if (RX_TITLE_MARKET.test(spec)) {
    const m = spec.slice(2) as DynamicTitleMarketKey;
    return `Titel (${DYNAMIC_TITLE_MARKET_LABEL[m] ?? m.toUpperCase()})`;
  }
  const p = RX_INST_PRICE.exec(spec);
  if (p) {
    const id = p[1];
    const name = opts.instanceLabelById.get(id) || `Instans #${id}`;
    return `Pris · ${name}`;
  }
  return spec;
}

export function formatDynamicListColumnValue(
  spec: string,
  product: Product,
  currencyFallback: string | null | undefined,
): string {
  const dcv = product.dynamicColumnValues;
  if (!dcv || typeof dcv !== 'object') {
    return '—';
  }
  const raw = dcv[spec];
  if (raw === null || raw === undefined || raw === '') {
    return '—';
  }
  if (
    spec.startsWith('p:') &&
    (typeof raw === 'number' || (typeof raw === 'string' && raw !== ''))
  ) {
    return formatMoney(typeof raw === 'number' ? raw : Number(raw), currencyFallback);
  }
  return String(raw);
}
