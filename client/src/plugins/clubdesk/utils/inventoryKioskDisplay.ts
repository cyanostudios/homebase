import type { ClubdeskInventoryItem } from '../types/inventory';

/** "{packageSize} {packageUnit}" with one space; single part if only one set. */
export function formatInventoryPackageSize(
  packageSize?: string | null,
  packageUnit?: string | null,
): string {
  const size = (packageSize ?? '').trim();
  const unit = (packageUnit ?? '').trim();
  if (size && unit) {
    return `${size} ${unit}`;
  }
  return size || unit;
}

export type InventoryPickerMetaSource = Pick<
  ClubdeskInventoryItem,
  'brand' | 'category' | 'packageSize' | 'packageUnit'
>;

/** Brand · product category · package (omit empty segments). */
export function formatInventoryPickerSecondaryMeta(item: InventoryPickerMetaSource): string {
  return [item.brand, item.category, formatInventoryPackageSize(item.packageSize, item.packageUnit)]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

export type InventoryPickerSearchSource = Pick<
  ClubdeskInventoryItem,
  'articleName' | 'brand' | 'category' | 'packageSize' | 'packageUnit'
>;

export function inventoryPickerSearchHaystack(item: InventoryPickerSearchSource): string {
  const formattedPackage = formatInventoryPackageSize(item.packageSize, item.packageUnit);
  return [
    item.articleName,
    item.brand,
    item.category,
    item.packageSize,
    item.packageUnit,
    formattedPackage,
  ]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function inventoryMatchesPickerSearch(
  item: InventoryPickerSearchSource,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) {
    return true;
  }
  return inventoryPickerSearchHaystack(item).includes(q);
}

export function formatNutritionValue(
  value: number | null | undefined,
  unit: 'kcal' | 'g',
): string | null {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }
  const num = Number(value);
  const formatted = Number.isInteger(num) ? String(num) : num.toFixed(1).replace(/\.0$/, '');
  return unit === 'kcal' ? `${formatted} kcal` : `${formatted} g`;
}
