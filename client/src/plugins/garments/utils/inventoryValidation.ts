import type {
  InventoryItemPayload,
  InventoryVariantPayload,
  ValidationError,
} from '../types/garments';

export type InventoryValidationMessages = {
  articleNameRequired: string;
  purchasePriceInvalid: string;
  quantityInvalid: string;
  variantDuplicate: string;
  variantSkuDuplicate: string;
};

/** Client-side inventory item + variant uniqueness rules (color|size and non-empty SKU). */
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
  if (!Array.isArray(data.variants)) {
    return errors;
  }

  const seenColorSize = new Set<string>();
  const seenSku = new Set<string>();
  for (let i = 0; i < data.variants.length; i += 1) {
    const variant = data.variants[i];
    const qty = variant.quantity != null ? Number(variant.quantity) : 0;
    if (Number.isNaN(qty) || qty < 0) {
      errors.push({
        field: `variants.${i}.quantity`,
        message: messages.quantityInvalid,
      });
    }
    const colorSizeKey = `${(variant.color ?? '').trim().toLowerCase()}|${(variant.size ?? '').trim().toLowerCase()}`;
    if (seenColorSize.has(colorSizeKey)) {
      errors.push({
        field: 'variants',
        message: messages.variantDuplicate,
      });
      break;
    }
    seenColorSize.add(colorSizeKey);

    const skuKey = (variant.sku ?? '').trim().toLowerCase();
    if (skuKey) {
      if (seenSku.has(skuKey)) {
        errors.push({
          field: `variants.${i}.sku`,
          message: messages.variantSkuDuplicate,
        });
        errors.push({
          field: 'variants',
          message: messages.variantSkuDuplicate,
        });
        break;
      }
      seenSku.add(skuKey);
    }
  }
  return errors;
}

/**
 * Copy a variant row for the form repeater: new row (no id), empty art.nr,
 * cleared size so color|size uniqueness is not immediately violated.
 */
export function buildDuplicatedVariantPayload(
  source: InventoryVariantPayload,
): InventoryVariantPayload {
  return {
    sku: '',
    color: source.color ?? '',
    size: '',
    quantity: source.quantity ?? 0,
    sortOrder: source.sortOrder,
  };
}

/** Variants for a duplicated inventory item: keep color/size/qty, clear art.nr. */
export function buildDuplicatedItemVariantPayloads(
  variants: InventoryVariantPayload[],
): InventoryVariantPayload[] {
  return (variants || []).map((variant, index) => ({
    sku: '',
    color: variant.color ?? '',
    size: variant.size ?? '',
    quantity: variant.quantity ?? 0,
    sortOrder: variant.sortOrder ?? index,
  }));
}
