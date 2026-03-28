// Product MVP types (no legacy dependencies)

export type ValidationError = {
  field: string;
  message: string;
  /** T.ex. serverns CONFLICT vid optimistic locking. */
  code?: string;
};

export type ProductSyncChannel = 'woocommerce' | 'cdon' | 'fyndiq';

/** Synlighet: till salu (kanaler) eller pausad (CDON/Fyndiq paused, Woo private). */
export type ProductStatus = 'for sale' | 'paused';

export function normalizeProductStatus(raw: string | null | undefined): ProductStatus {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'paused') {
    return 'paused';
  }
  return 'for sale';
}

export type ProductSaveChangeSet = {
  local: {
    noChanges: boolean;
    hasChanges: boolean;
    productChanged: boolean;
    listChanged: boolean;
    targetsChanged: boolean;
    overridesChanged: boolean;
  };
  sync: {
    strictChannels: ProductSyncChannel[];
    fullChannels: ProductSyncChannel[];
    articleOnlyChannels: ProductSyncChannel[];
  };
};

export interface Product {
  id: string;

  // MVP fields (camelCase for frontend)
  sku: string | null;
  mpn: string | null;
  title: string; // required
  description: string | null;
  status: ProductStatus;
  quantity: number;
  priceAmount: number; // maps to price_amount
  currency: string; // ISO-4217, e.g. "SEK"
  vatRate: number; // e.g. 25
  mainImage: string | null; // URL
  images: string[]; // array of URLs
  categories: string[]; // array of strings
  brand: string | null;
  brandId?: string | null;
  ean?: string | null;
  gtin: string | null;
  knNumber?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  manufacturerId?: string | null;
  manufacturerName?: string | null;
  lagerplats?: string | null;

  /** Detaljer: färg, storlek, mönster, vikt, mått, skick, volym, anteckningar */
  color?: string | null;
  colorText?: string | null;
  size?: string | null;
  sizeText?: string | null;
  pattern?: string | null;
  material?: string | null;
  patternText?: string | null;
  model?: string | null;
  weight?: number | null;
  condition?: 'new' | 'used' | null;
  groupId?: string | null;
  volume?: number | null;
  volumeUnit?: string | null;
  notes?: string | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  depthCm?: number | null;

  /** Channel-specific attributes (cdon, fyndiq, woocommerce keys). Populated when migration 031 applied. */
  channelSpecific?: Record<string, unknown> | null;

  /** List (folder): one product can be in one list. null = Huvudlista. */
  listId?: string | null;
  listName?: string | null;

  /** From source (e.g. Sello): created date, total quantity sold, last sold date. */
  sourceCreatedAt?: string | null;
  quantitySold?: number | null;
  lastSoldAt?: string | null;

  createdAt: Date | null;
  updatedAt: Date | null;
}

export type ProductSettingsMarketKey = 'se' | 'dk' | 'fi' | 'no';

export type ProductSettingsCdonMarketKey = 'SE' | 'DK' | 'NO' | 'FI';
export type ProductSettingsFyndiqMarketKey = 'se' | 'dk' | 'fi' | 'no';

export type MarketDelivery = { shippingMin?: number; shippingMax?: number };

/** Language for CDON/Fyndiq category lists. Default sv-SE when missing. */
export type CategoryLanguage = 'sv-SE' | 'da-DK' | 'fi-FI' | 'nb-NO';

import {
  DEFAULT_LIST_PAGE_SIZE,
  LIST_PAGE_SIZE_OPTIONS,
  type ListPageSize,
  normalizeListPageSize,
} from '@/core/settings/listPageSizes';

/** Allowed page sizes for the product catalog list (server limit). */
export type CatalogPageSize = ListPageSize;

export const CATALOG_PAGE_SIZE_OPTIONS = LIST_PAGE_SIZE_OPTIONS;

export const DEFAULT_CATALOG_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export function normalizeCatalogPageSize(value: unknown): CatalogPageSize {
  return normalizeListPageSize(value);
}

/** Product plugin settings (stored in user_settings, category: products) */
export interface ProductSettings {
  /** Rows per page in the product catalog (default 100). */
  catalogPageSize?: CatalogPageSize;
  /** @deprecated Use defaultDeliveryCdon / defaultDeliveryFyndiq. Kept for migration. */
  defaultDelivery?: Record<ProductSettingsMarketKey, MarketDelivery>;
  /** Default shipping times per CDON market (SE, DK, NO, FI). Used when product has no manual CDON shipping_time. */
  defaultDeliveryCdon?: Record<ProductSettingsCdonMarketKey, MarketDelivery>;
  /** Default shipping times per Fyndiq market (se, dk, fi, no). Used when product has no manual Fyndiq shipping_time. */
  defaultDeliveryFyndiq?: Record<ProductSettingsFyndiqMarketKey, MarketDelivery>;
  /** Language for CDON/Fyndiq category dropdowns. Persistent; default sv-SE when missing. */
  categoryLanguage?: CategoryLanguage;
}
