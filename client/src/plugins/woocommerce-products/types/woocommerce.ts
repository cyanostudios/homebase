// client/src/plugins/woocommerce-products/types/woocommerce.ts

// Tenant-scoped Woo settings stored in DB
export type WooTextMarket = 'se' | 'dk' | 'fi' | 'no';

/** Aligns API `market` (DB) with Woo text market; invalid → se */
export function normalizeWooTextMarket(v: string | null | undefined): WooTextMarket {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (s === 'dk' || s === 'fi' || s === 'no' || s === 'se') return s;
  return 'se';
}

export interface WooSettings {
  id?: string;
  // Instance metadata (multi-store). Present when editing a specific store.
  instanceKey?: string;
  label?: string;
  /** Which Texter market (SE/DK/FI/NO) feeds Woo name/description/SEO for this store */
  textMarket?: WooTextMarket;
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
  useQueryAuth?: boolean;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

// Minimal MVP Product shape used for export mapping
export interface MvpProduct {
  id?: string;
  sku?: string | null;
  title?: string;
  status?: string;
  quantity?: number | null;
  priceAmount?: number | string | null;
  currency?: string | null;
  vatRate?: number | null;
  description?: string | null;
  mainImage?: string | null;
  images?: string[] | null;
  categories?: string[] | null;
  brand?: string | null;
  gtin?: string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}

// /test response
export interface WooTestResult {
  ok: boolean;
  status: number;
  statusText: string;
  endpoint: string;
  body: any; // Woo REST discovery/response payload
}

// /products/export response (Woo batch API)
export interface WooBatchResponse {
  create?: any[];
  update?: any[];
  delete?: any[];
}

export interface WooExportResult {
  ok: boolean;
  endpoint: string;
  result: WooBatchResponse;
  counts: {
    requested: number;
    success: number;
    error: number;
  };
  items: Array<{
    productId: string;
    sku: string | null;
    status: 'success' | 'error' | 'noop';
    externalId?: string;
    error?: string;
  }>;
}

export interface ValidationError {
  field: string;
  message: string;
}
