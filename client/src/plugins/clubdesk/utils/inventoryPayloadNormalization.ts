import type { ClubdeskInventoryItemPayload, ClubdeskInventoryVariant } from '../types/inventory';
import { normalizeInventoryTags } from './inventoryTags';

function parseOptionalPrice(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return null;
  }
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

/** Shared normalization for inventory create/update and CSV import. */
export function normalizeClubdeskInventoryItemPayload(
  raw: ClubdeskInventoryItemPayload,
): ClubdeskInventoryItemPayload {
  const variants = Array.isArray(raw.variants)
    ? raw.variants.map((variant, index) => ({
        id: variant.id,
        sku: (variant.sku ?? '').trim(),
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
    publicationStatus: raw.publicationStatus === 'published' ? 'published' : 'draft',
    featured: raw.featured === true,
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
    audience: (variant.audience ?? '').trim(),
    color: (variant.color ?? '').trim(),
    size: (variant.size ?? '').trim(),
    quantity: variant.quantity != null ? Number(variant.quantity) : 0,
    sortOrder: variant.sortOrder ?? sortOrder,
  };
}
