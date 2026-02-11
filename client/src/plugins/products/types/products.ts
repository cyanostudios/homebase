// Product MVP types (no legacy dependencies)

export type ValidationError = {
  field: string;
  message: string;
};

export interface Product {
  id: string;

  // MVP fields (camelCase for frontend)
  productNumber: string | null; // maps to product_number
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
  supplierId?: string | null;
  supplierName?: string | null;
  manufacturerId?: string | null;
  manufacturerName?: string | null;
  lagerplats?: string | null;

  /** Detaljer: färg, storlek, mönster, vikt, mått */
  color?: string | null;
  colorText?: string | null;
  size?: string | null;
  sizeText?: string | null;
  pattern?: string | null;
  weight?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  depthCm?: number | null;

  /** Channel-specific attributes (cdon, fyndiq, woocommerce keys). Populated when migration 031 applied. */
  channelSpecific?: Record<string, unknown> | null;

  /** List (folder): one product can be in one list. null = Huvudlista. */
  listId?: string | null;
  listName?: string | null;

  createdAt: Date | null;
  updatedAt: Date | null;
}

export type ProductSettingsMarketKey = 'se' | 'dk' | 'fi' | 'no';

/** Product plugin settings (stored in user_settings, category: products) */
export interface ProductSettings {
  /** Default delivery per market (se, dk, fi, no) when product has no manual override */
  defaultDelivery?: Record<ProductSettingsMarketKey, {
    shippingMin?: number;
    shippingMax?: number;
  }>;
  // Future: more settings can be added here
}
