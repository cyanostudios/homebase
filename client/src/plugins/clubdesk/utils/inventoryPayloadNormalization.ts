import type { ClubdeskInventoryItemPayload, ClubdeskInventoryVariant } from '../types/inventory';
import { normalizeInventoryTags } from './inventoryTags';

function parseOptionalPrice(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return null;
  }
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

function parseOptionalNutrition(raw: unknown): number | null {
  return parseOptionalPrice(raw);
}

function trimCatalogText(raw: unknown): string {
  return raw == null ? '' : String(raw).trim();
}

function trimNullableText(raw: unknown): string | null {
  if (raw == null || String(raw).trim() === '') {
    return null;
  }
  return String(raw).trim();
}

/** Shared normalization for inventory create/update and CSV import. */
export function normalizeClubdeskInventoryItemPayload(
  raw: ClubdeskInventoryItemPayload,
): ClubdeskInventoryItemPayload {
  const variants = Array.isArray(raw.variants)
    ? raw.variants.map((variant, index) => ({
        id: variant.id,
        sku: (variant.sku ?? '').trim(),
        gtin: String(variant.gtin ?? '').replace(/\s+/g, ''),
        audience: (variant.audience ?? '').trim(),
        color: (variant.color ?? '').trim(),
        size: (variant.size ?? '').trim(),
        quantity: variant.quantity != null ? Number(variant.quantity) : 0,
        sortOrder: variant.sortOrder ?? index,
      }))
    : [];

  const descriptionRaw =
    raw.description != null && String(raw.description).trim() !== ''
      ? String(raw.description).trim()
      : null;
  const commentRaw =
    raw.comment != null && String(raw.comment).trim() !== '' ? String(raw.comment).trim() : null;

  return {
    articleName: String(raw.articleName ?? '').trim(),
    brand: (raw.brand ?? '').trim(),
    description: descriptionRaw,
    material: (raw.material ?? '').trim(),
    purchasePrice: parseOptionalPrice(raw.purchasePrice),
    recommendedPrice: parseOptionalPrice(raw.recommendedPrice),
    salePrice: parseOptionalPrice(raw.salePrice),
    currency: (raw.currency ?? 'SEK').trim() || 'SEK',
    comment: commentRaw,
    tags: normalizeInventoryTags(raw.tags),
    slug: raw.slug?.trim() ? raw.slug.trim() : undefined,
    featuredImageUrl:
      raw.featuredImageUrl != null && String(raw.featuredImageUrl).trim() !== ''
        ? String(raw.featuredImageUrl).trim()
        : null,
    category: trimCatalogText(raw.category),
    packageSize: trimCatalogText(raw.packageSize),
    packageUnit: trimCatalogText(raw.packageUnit),
    gtin: String(raw.gtin ?? '').replace(/\s+/g, ''),
    articleNumber: trimCatalogText(raw.articleNumber),
    ingredients: trimNullableText(raw.ingredients),
    allergens: trimNullableText(raw.allergens),
    energyKcal100g: parseOptionalNutrition(raw.energyKcal100g),
    fatG100g: parseOptionalNutrition(raw.fatG100g),
    saturatedFatG100g: parseOptionalNutrition(raw.saturatedFatG100g),
    carbohydrateG100g: parseOptionalNutrition(raw.carbohydrateG100g),
    sugarG100g: parseOptionalNutrition(raw.sugarG100g),
    proteinG100g: parseOptionalNutrition(raw.proteinG100g),
    saltG100g: parseOptionalNutrition(raw.saltG100g),
    netContent: trimCatalogText(raw.netContent),
    countryOfOrigin: trimCatalogText(raw.countryOfOrigin),
    countryOfManufacture: trimCatalogText(raw.countryOfManufacture),
    supplier: trimCatalogText(raw.supplier),
    publicationStatus: raw.publicationStatus === 'draft' ? 'draft' : 'published',
    featured: false,
    variants,
  };
}

/** @deprecated alias */
export const normalizeInventoryItemPayload = normalizeClubdeskInventoryItemPayload;

export function normalizeClubdeskInventoryVariant(
  variant: ClubdeskInventoryVariant,
  sortOrder: number,
): ClubdeskInventoryVariant {
  return {
    sku: (variant.sku ?? '').trim(),
    gtin: String(variant.gtin ?? '').replace(/\s+/g, ''),
    audience: (variant.audience ?? '').trim(),
    color: (variant.color ?? '').trim(),
    size: (variant.size ?? '').trim(),
    quantity: variant.quantity != null ? Number(variant.quantity) : 0,
    sortOrder: variant.sortOrder ?? sortOrder,
  };
}
