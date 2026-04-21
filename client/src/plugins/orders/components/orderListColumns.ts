import type { OrderListItem, OrdersListSortField } from '../types/orders';
import { statusDisplayLabel } from '../utils/statusDisplay';

/** Valbara datakolumner (ej spacer, checkbox eller anteckningskolumn). */
export type OrderListDataColumnId =
  | 'channel'
  | 'orderNumber'
  | 'customer'
  | 'placed'
  | 'total'
  | 'status'
  | 'lagerplats'
  | 'orderWeight'
  | 'updatedAt'
  | 'lineCount'
  | 'articleNumber'
  | 'sku'
  | 'ean'
  | 'gtin';

export const ORDER_LIST_DATA_COLUMN_ORDER: OrderListDataColumnId[] = [
  'channel',
  'orderNumber',
  'customer',
  'placed',
  'total',
  'status',
  'lineCount',
  'orderWeight',
  'updatedAt',
  'lagerplats',
  'articleNumber',
  'sku',
  'ean',
  'gtin',
];

const SORTABLE: Partial<Record<OrderListDataColumnId, OrdersListSortField>> = {
  channel: 'channel',
  orderNumber: 'order_number',
  customer: 'customer',
  placed: 'placed',
  total: 'total',
  status: 'status',
};

const ORDER_LIST_COLUMN_LABELS: Record<OrderListDataColumnId, string> = {
  channel: 'Kanal',
  orderNumber: 'Ordernr',
  customer: 'Kund',
  placed: 'Orderdatum',
  total: 'Belopp',
  status: 'Status',
  lagerplats: 'Lagerplats',
  orderWeight: 'Ordervikt',
  updatedAt: 'Uppdaterad',
  lineCount: 'Rader',
  articleNumber: 'Artikelnummer',
  sku: 'SKU',
  ean: 'EAN',
  gtin: 'GTIN',
};

export type OrderListColumnMeta = {
  id: OrderListDataColumnId;
  label: string;
  sortField?: OrdersListSortField;
};

export const ORDER_LIST_COLUMN_META: OrderListColumnMeta[] = ORDER_LIST_DATA_COLUMN_ORDER.map(
  (id) => ({
    id,
    label: ORDER_LIST_COLUMN_LABELS[id],
    sortField: SORTABLE[id],
  }),
);

/** Standard synliga kolumner (samma som tidigare fast tabell). */
export const DEFAULT_VISIBLE_ORDER_LIST_COLUMNS: OrderListDataColumnId[] = [
  'channel',
  'orderNumber',
  'customer',
  'placed',
  'total',
  'status',
];

const VALID_ID = new Set<OrderListDataColumnId>(ORDER_LIST_DATA_COLUMN_ORDER);

export function isOrderListDataColumnId(value: unknown): value is OrderListDataColumnId {
  return typeof value === 'string' && VALID_ID.has(value as OrderListDataColumnId);
}

export function storageKeyOrderListColumns(tenantId: number): string {
  return `homebase:orders:listColumns:${tenantId}`;
}

export function parseStoredOrderListColumns(raw: string | null): OrderListDataColumnId[] | null {
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    const out: OrderListDataColumnId[] = [];
    for (const item of parsed) {
      if (isOrderListDataColumnId(item) && !out.includes(item)) {
        out.push(item);
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function normalizeVisibleOrderColumnSelection(
  ids: OrderListDataColumnId[] | null | undefined,
): OrderListDataColumnId[] {
  if (!ids?.length) {
    return [...DEFAULT_VISIBLE_ORDER_LIST_COLUMNS];
  }
  const ordered: OrderListDataColumnId[] = [];
  for (const id of ORDER_LIST_DATA_COLUMN_ORDER) {
    if (ids.includes(id)) {
      ordered.push(id);
    }
  }
  return ordered.length > 0 ? ordered : [...DEFAULT_VISIBLE_ORDER_LIST_COLUMNS];
}

function formatCommaList(value: string | null | undefined): string {
  const s = value !== null && value !== undefined ? String(value).trim() : '';
  return s !== '' ? s : '—';
}

function formatOrderWeightKg(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '—';
  }
  const n = Number(value);
  return `${n.toLocaleString('sv-SE', { maximumFractionDigits: 4 })} kg`;
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

/**
 * Enkel text för mobilrader eller när en kolumn ska visas som plain text.
 * För `channel` och `orderNumber` — ange färdiga strängar via opts.
 */
export function formatOrderListPlainColumn(
  columnId: OrderListDataColumnId,
  o: OrderListItem,
  opts?: { channelDisplay?: string; orderNumberSummary?: string },
): string {
  switch (columnId) {
    case 'channel':
      return opts?.channelDisplay ?? '—';
    case 'orderNumber':
      return opts?.orderNumberSummary ?? '—';
    case 'customer': {
      const s = o.shippingAddress as {
        full_name?: string;
        fullName?: string;
        name?: string;
        first_name?: string;
        last_name?: string;
      };
      const full = s?.full_name || s?.fullName || s?.name;
      if (full) {
        return String(full);
      }
      if (s?.first_name || s?.last_name) {
        return `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim();
      }
      return '—';
    }
    case 'placed': {
      if (!o.placedAt) {
        return '—';
      }
      const dt = o.placedAt instanceof Date ? o.placedAt : new Date(o.placedAt);
      return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString();
    }
    case 'total': {
      const n = Number(o.totalAmount);
      if (!Number.isFinite(n)) {
        return '—';
      }
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: o.currency || 'SEK',
      }).format(n);
    }
    case 'status':
      return statusDisplayLabel(o.status);
    case 'lagerplats':
      return formatCommaList(o.lagerplatsList);
    case 'orderWeight':
      return formatOrderWeightKg(o.orderWeight);
    case 'updatedAt':
      return formatDateSv(o.updatedAt);
    case 'lineCount':
      return o.lineCount !== null &&
        o.lineCount !== undefined &&
        Number.isFinite(Number(o.lineCount))
        ? String(Math.trunc(Number(o.lineCount)))
        : '—';
    case 'articleNumber':
      return formatCommaList(o.articleNumberList);
    case 'sku':
      return formatCommaList(o.skuList);
    case 'ean':
      return formatCommaList(o.eanList);
    case 'gtin':
      return formatCommaList(o.gtinList);
    default:
      return '—';
  }
}
