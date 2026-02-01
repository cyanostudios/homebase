// client/src/plugins/woocommerce-products/types/woocommerce.ts

// Per-user Woo settings stored in DB
export interface WooSettings {
  id?: string;
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
  productNumber?: string | null;
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
}
