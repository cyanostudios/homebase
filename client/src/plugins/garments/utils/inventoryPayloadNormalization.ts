import type { InventoryItemPayload, InventoryVariantPayload } from '../types/garments';

function parseOptionalPrice(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return null;
  }
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return Number.isNaN(num) ? null : num;
}

/** Shared normalization for inventory create/update and CSV import. */
export function normalizeInventoryItemPayload(raw: InventoryItemPayload): InventoryItemPayload {
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
    variants,
  };
}

export function normalizeInventoryVariantPayload(
  variant: InventoryVariantPayload,
  sortOrder: number,
): InventoryVariantPayload {
  return {
    sku: (variant.sku ?? '').trim(),
    audience: (variant.audience ?? '').trim(),
    color: (variant.color ?? '').trim(),
    size: (variant.size ?? '').trim(),
    quantity: variant.quantity != null ? Number(variant.quantity) : 0,
    sortOrder: variant.sortOrder ?? sortOrder,
  };
}
