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

export type ProductImageVariant = {
  key: string | null;
  url: string | null;
  versionId?: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
};

export type ProductImageAsset = {
  assetId: string | null;
  position: number;
  originalFilename: string | null;
  sourceUrl: string | null;
  hash: string | null;
  mimeType: string | null;
  size: number | null;
  width: number | null;
  height: number | null;
  variants: {
    original: ProductImageVariant;
    preview: ProductImageVariant;
    thumbnail: ProductImageVariant;
  };
  legacy?: boolean;
};

export function isProductImageAsset(value: unknown): value is ProductImageAsset {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const variants = (value as { variants?: unknown }).variants;
  return !!variants && typeof variants === 'object' && !Array.isArray(variants);
}

export function getProductImageOriginalUrl(
  asset: ProductImageAsset | null | undefined,
): string | null {
  return asset?.variants?.original?.url ?? null;
}

export function getProductImagePreviewUrl(
  asset: ProductImageAsset | null | undefined,
): string | null {
  return asset?.variants?.preview?.url ?? asset?.variants?.original?.url ?? null;
}

export function getProductImageThumbnailUrl(
  asset: ProductImageAsset | null | undefined,
): string | null {
  return asset?.variants?.thumbnail?.url ?? null;
}

/**
 * Match `products.main_image` to an asset when the stored URL may be original, preview, or thumbnail
 * (depending on how the row was written).
 */
export function findProductImageAssetByMainImageUrl(
  assets: ProductImageAsset[],
  mainImage: string | null | undefined,
): ProductImageAsset | null {
  const m = String(mainImage || '').trim();
  if (!m) {
    return null;
  }
  for (const asset of assets) {
    const o = getProductImageOriginalUrl(asset);
    const p = getProductImagePreviewUrl(asset);
    const t = getProductImageThumbnailUrl(asset);
    if (m === o || m === p || m === t) {
      return asset;
    }
  }
  return null;
}

export function getProductImageOriginalFilename(
  asset: ProductImageAsset | null | undefined,
): string | null {
  return asset?.originalFilename ?? null;
}

export function normalizeProductImageAsset(raw: unknown, position = 0): ProductImageAsset | null {
  if (typeof raw === 'string') {
    const clean = raw.trim();
    if (!clean) {
      return null;
    }
    const variant: ProductImageVariant = {
      key: null,
      url: clean,
      versionId: null,
      mimeType: null,
      size: null,
      width: null,
      height: null,
    };
    return {
      assetId: null,
      position,
      originalFilename: null,
      sourceUrl: null,
      hash: null,
      mimeType: null,
      size: null,
      width: null,
      height: null,
      variants: {
        original: variant,
        preview: { ...variant },
        thumbnail: { ...variant },
      },
      legacy: true,
    };
  }
  if (!isProductImageAsset(raw)) {
    return null;
  }
  const original = raw.variants?.original ?? null;
  if (!original?.url) {
    return null;
  }
  const preview = raw.variants?.preview ?? original;
  const thumbnail = raw.variants?.thumbnail ?? preview ?? original;
  return {
    assetId: raw.assetId ?? null,
    position: Number.isFinite(Number(raw.position)) ? Number(raw.position) : position,
    originalFilename: raw.originalFilename ?? null,
    sourceUrl: raw.sourceUrl ?? null,
    hash: raw.hash ?? null,
    mimeType: raw.mimeType ?? original.mimeType ?? null,
    size: Number.isFinite(Number(raw.size)) ? Number(raw.size) : (original.size ?? null),
    width: Number.isFinite(Number(raw.width)) ? Number(raw.width) : (original.width ?? null),
    height: Number.isFinite(Number(raw.height)) ? Number(raw.height) : (original.height ?? null),
    variants: {
      original: {
        key: original.key ?? null,
        url: original.url ?? null,
        versionId: (() => {
          const v = (original as { versionId?: unknown }).versionId;
          return v !== undefined && v !== null ? String(v) || null : null;
        })(),
        mimeType: original.mimeType ?? null,
        size: Number.isFinite(Number(original.size)) ? Number(original.size) : null,
        width: Number.isFinite(Number(original.width)) ? Number(original.width) : null,
        height: Number.isFinite(Number(original.height)) ? Number(original.height) : null,
      },
      preview: {
        key: preview.key ?? null,
        url: preview.url ?? original.url ?? null,
        versionId: (() => {
          const v = (preview as { versionId?: unknown }).versionId;
          return v !== undefined && v !== null ? String(v) || null : null;
        })(),
        mimeType: preview.mimeType ?? original.mimeType ?? null,
        size: Number.isFinite(Number(preview.size)) ? Number(preview.size) : null,
        width: Number.isFinite(Number(preview.width)) ? Number(preview.width) : null,
        height: Number.isFinite(Number(preview.height)) ? Number(preview.height) : null,
      },
      thumbnail: {
        key: thumbnail.key ?? null,
        url: thumbnail.url ?? preview.url ?? original.url ?? null,
        versionId: (() => {
          const v = (thumbnail as { versionId?: unknown }).versionId;
          return v !== undefined && v !== null ? String(v) || null : null;
        })(),
        mimeType: thumbnail.mimeType ?? preview.mimeType ?? original.mimeType ?? null,
        size: Number.isFinite(Number(thumbnail.size)) ? Number(thumbnail.size) : null,
        width: Number.isFinite(Number(thumbnail.width)) ? Number(thumbnail.width) : null,
        height: Number.isFinite(Number(thumbnail.height)) ? Number(thumbnail.height) : null,
      },
    },
    legacy: raw.legacy === true,
  };
}

export function normalizeProductImages(raw: unknown): ProductImageAsset[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: ProductImageAsset[] = [];
  const seen = new Set<string>();
  raw.forEach((item, index) => {
    const asset = normalizeProductImageAsset(item, index);
    const originalUrl = getProductImageOriginalUrl(asset);
    if (!asset || !originalUrl) {
      return;
    }
    const key = originalUrl.trim().toLowerCase();
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    out.push({ ...asset, position: out.length });
  });
  return out;
}

export interface Product {
  id: string;
  isDraft?: boolean;

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
  images: ProductImageAsset[]; // full media assets
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
