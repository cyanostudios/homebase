import type { InventoryItem, InventoryItemPayload } from '../types/garments';

/** Build a full inventory update payload that only changes tags. */
export function buildInventoryTagsSavePayload(
  item: InventoryItem,
  nextTags: string[],
): InventoryItemPayload {
  return {
    articleName: item.articleName,
    brand: item.brand ?? '',
    description: item.description,
    material: item.material ?? '',
    purchasePrice: item.purchasePrice,
    recommendedPrice: item.recommendedPrice,
    salePrice: item.salePrice,
    currency: item.currency || 'SEK',
    comment: item.comment,
    tags: nextTags,
    variants: (item.variants || []).map((variant, index) => ({
      id: variant.id,
      sku: variant.sku ?? '',
      audience: variant.audience ?? '',
      color: variant.color ?? '',
      size: variant.size ?? '',
      quantity: variant.quantity ?? 0,
      sortOrder: variant.sortOrder ?? index,
    })),
  };
}

/** Normalize inventory / catalog tags (trim, drop empties, case-insensitive dedupe). */
export function normalizeInventoryTags(raw: unknown, max = 50): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (typeof item !== 'string') {
      continue;
    }
    const tag = item.trim().slice(0, 100);
    if (!tag) {
      continue;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(tag);
    if (out.length >= max) {
      break;
    }
  }
  return out;
}

export function inventoryTagsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((tag, i) => tag === b[i]);
}

/**
 * Add a tag to an existing list (case-insensitive). Returns the same array
 * reference if the tag is already present.
 */
export function mergeInventoryTag(
  existingTags: string[] | null | undefined,
  tag: string,
): string[] {
  const trimmed = tag.trim();
  if (!trimmed) {
    return Array.isArray(existingTags) ? existingTags : [];
  }
  const current = Array.isArray(existingTags) ? existingTags : [];
  const exists = current.some((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    return current;
  }
  return [...current, trimmed];
}

/** Remove a tag from an existing list. Returns the same array reference if unchanged. */
export function omitInventoryTag(existingTags: string[] | null | undefined, tag: string): string[] {
  const current = Array.isArray(existingTags) ? existingTags : [];
  const next = current.filter((item) => item !== tag);
  return next.length === current.length ? current : next;
}
