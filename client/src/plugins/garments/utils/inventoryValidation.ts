import type {
  InventoryItemPayload,
  InventoryVariantPayload,
  ValidationError,
} from '../types/garments';

export type InventoryValidationMessages = {
  articleNameRequired: string;
  purchasePriceInvalid: string;
  recommendedPriceInvalid: string;
  salePriceInvalid: string;
  quantityInvalid: string;
};

/** Client-side inventory validation. Variant identity may repeat (UI warns only). */
export function validateInventoryPayload(
  data: InventoryItemPayload,
  messages: InventoryValidationMessages,
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.articleName.trim()) {
    errors.push({ field: 'articleName', message: messages.articleNameRequired });
  }
  if (data.purchasePrice != null && (Number.isNaN(data.purchasePrice) || data.purchasePrice < 0)) {
    errors.push({ field: 'purchasePrice', message: messages.purchasePriceInvalid });
  }
  if (
    data.recommendedPrice != null &&
    (Number.isNaN(data.recommendedPrice) || data.recommendedPrice < 0)
  ) {
    errors.push({ field: 'recommendedPrice', message: messages.recommendedPriceInvalid });
  }
  if (data.salePrice != null && (Number.isNaN(data.salePrice) || data.salePrice < 0)) {
    errors.push({ field: 'salePrice', message: messages.salePriceInvalid });
  }
  if (!Array.isArray(data.variants)) {
    return errors;
  }

  for (let i = 0; i < data.variants.length; i += 1) {
    const variant = data.variants[i];
    const qty = variant.quantity != null ? Number(variant.quantity) : 0;
    if (Number.isNaN(qty) || qty < 0) {
      errors.push({
        field: `variants.${i}.quantity`,
        message: messages.quantityInvalid,
      });
    }
  }
  return errors;
}

function indicesSharingKey(
  variants: InventoryVariantPayload[],
  keyFor: (variant: InventoryVariantPayload) => string | null,
): Set<number> {
  const indices = new Set<number>();
  const byKey = new Map<string, number[]>();
  for (let i = 0; i < variants.length; i += 1) {
    const key = keyFor(variants[i]);
    if (key == null) continue;
    const list = byKey.get(key) ?? [];
    list.push(i);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) {
    if (list.length < 2) continue;
    for (const index of list) indices.add(index);
  }
  return indices;
}

/**
 * Indices of variants that share a non-empty art.nr with at least one other row
 * (case-insensitive). Non-blocking warning only — save is still allowed.
 */
export function findDuplicateSkuIndices(variants: InventoryVariantPayload[]): Set<number> {
  return indicesSharingKey(variants, (variant) => {
    const skuKey = (variant.sku ?? '').trim().toLowerCase();
    return skuKey || null;
  });
}

/**
 * Indices of variants that share the same audience|color|size (case-insensitive),
 * including empty values. Non-blocking warning only — save is still allowed.
 */
export function findDuplicateAudienceColorSizeIndices(
  variants: InventoryVariantPayload[],
): Set<number> {
  return indicesSharingKey(variants, (variant) => {
    const audience = (variant.audience ?? '').trim().toLowerCase();
    const color = (variant.color ?? '').trim().toLowerCase();
    const size = (variant.size ?? '').trim().toLowerCase();
    return `${audience}|${color}|${size}`;
  });
}

/** Union of non-blocking duplicate markers (art.nr and/or audience+color+size). */
export function findDuplicateVariantIndices(variants: InventoryVariantPayload[]): {
  sku: Set<number>;
  identity: Set<number>;
  any: Set<number>;
} {
  const sku = findDuplicateSkuIndices(variants);
  const identity = findDuplicateAudienceColorSizeIndices(variants);
  const any = new Set<number>([...sku, ...identity]);
  return { sku, identity, any };
}

/**
 * Copy a variant row for the form repeater: new row (no id), empty art.nr and
 * quantity 0. Keeps audience, color, and size.
 */
export function buildDuplicatedVariantPayload(
  source: InventoryVariantPayload,
): InventoryVariantPayload {
  return {
    sku: '',
    audience: source.audience ?? '',
    color: source.color ?? '',
    size: source.size ?? '',
    quantity: 0,
    sortOrder: source.sortOrder,
  };
}

/** Variants for a duplicated inventory item: keep audience/color/size/qty, clear art.nr. */
export function buildDuplicatedItemVariantPayloads(
  variants: InventoryVariantPayload[],
): InventoryVariantPayload[] {
  return (variants || []).map((variant, index) => ({
    sku: '',
    audience: variant.audience ?? '',
    color: variant.color ?? '',
    size: variant.size ?? '',
    quantity: variant.quantity ?? 0,
    sortOrder: variant.sortOrder ?? index,
  }));
}
