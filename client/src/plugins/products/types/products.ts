// Product MVP types (no legacy dependencies)

export type ValidationError = {
  field: string;
  message: string;
};

export interface Product {
  id: string;

  // MVP fields (camelCase for frontend)
  sku: string | null;
  mpn: string | null;
  title: string; // required
  description: string | null;
  status: 'for sale' | 'draft' | 'archived';
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

/** Product plugin settings (stored in user_settings, category: products) */
export interface ProductSettings {
  /** @deprecated Use defaultDeliveryCdon / defaultDeliveryFyndiq. Kept for migration. */
  defaultDelivery?: Record<ProductSettingsMarketKey, MarketDelivery>;
  /** Default shipping times per CDON market (SE, DK, NO, FI). Used when product has no manual CDON shipping_time. */
  defaultDeliveryCdon?: Record<ProductSettingsCdonMarketKey, MarketDelivery>;
  /** Default shipping times per Fyndiq market (se, dk, fi, no). Used when product has no manual Fyndiq shipping_time. */
  defaultDeliveryFyndiq?: Record<ProductSettingsFyndiqMarketKey, MarketDelivery>;
  /** Language for CDON/Fyndiq category dropdowns. Persistent; default sv-SE when missing. */
  categoryLanguage?: CategoryLanguage;
}
