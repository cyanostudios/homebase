import type { PublicationStatus } from './clubdesk';

export interface ClubdeskInventoryVariant {
  id?: string;
  itemId?: string;
  sku: string;
  gtin?: string;
  audience: string;
  color: string;
  size: string;
  quantity: number;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClubdeskInventoryItem {
  id: string;
  articleName: string;
  brand: string;
  description: string | null;
  material: string;
  purchasePrice: number | null;
  recommendedPrice: number | null;
  salePrice: number | null;
  currency: string;
  comment: string | null;
  tags: string[];
  slug: string;
  featuredImageUrl: string | null;
  catalogKey?: string;
  category?: string;
  packageSize?: string;
  packageUnit?: string;
  gtin?: string;
  articleNumber?: string;
  ingredients?: string | null;
  allergens?: string | null;
  energyKcal100g?: number | null;
  fatG100g?: number | null;
  saturatedFatG100g?: number | null;
  carbohydrateG100g?: number | null;
  sugarG100g?: number | null;
  proteinG100g?: number | null;
  saltG100g?: number | null;
  netContent?: string;
  countryOfOrigin?: string;
  countryOfManufacture?: string;
  supplier?: string;
  source?: string;
  verifiedAt?: string | null;
  dataStatus?: string;
  publicationStatus: PublicationStatus;
  featured: boolean;
  archivedAt?: string | null;
  variants: ClubdeskInventoryVariant[];
  totalQuantity: number;
  variantCount: number;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClubdeskInventoryItemPayload {
  articleName: string;
  brand?: string;
  description?: string | null;
  material?: string;
  purchasePrice?: number | null;
  recommendedPrice?: number | null;
  salePrice?: number | null;
  currency?: string;
  comment?: string | null;
  tags?: string[];
  slug?: string;
  featuredImageUrl?: string | null;
  category?: string;
  packageSize?: string;
  packageUnit?: string;
  gtin?: string;
  articleNumber?: string;
  ingredients?: string | null;
  allergens?: string | null;
  energyKcal100g?: number | null;
  fatG100g?: number | null;
  saturatedFatG100g?: number | null;
  carbohydrateG100g?: number | null;
  sugarG100g?: number | null;
  proteinG100g?: number | null;
  saltG100g?: number | null;
  netContent?: string;
  countryOfOrigin?: string;
  countryOfManufacture?: string;
  supplier?: string;
  publicationStatus?: PublicationStatus;
  featured?: boolean;
  variants?: ClubdeskInventoryVariant[];
}

export interface ClubdeskInventoryImportResult {
  successCount: number;
  failureCount: number;
  failures: Array<{ index: number; message: string }>;
}

/** Persisted via AppContext getSettings/updateSettings — key `clubdesk` (tags catalog). */
export interface ClubdeskInventorySettings {
  tags?: string[];
  /** When true, linkable inventory products can be added to invoice/estimate lines. */
  invoicable?: boolean;
}
