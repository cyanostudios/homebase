import type { PublicationStatus } from './clubdesk';

export interface ClubdeskInventoryVariant {
  id?: string;
  itemId?: string;
  sku: string;
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
  publicationStatus: PublicationStatus;
  featured: boolean;
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
  publicationStatus?: PublicationStatus;
  featured?: boolean;
  variants?: ClubdeskInventoryVariant[];
}

export interface ClubdeskInventoryImportResult {
  successCount: number;
  failureCount: number;
  failures: Array<{ index: number; message: string }>;
}

/** Persisted via AppContext getSettings/updateSettings — key `clubdesk-inventory`. */
export interface ClubdeskInventorySettings {
  tags?: string[];
}
