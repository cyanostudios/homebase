/** Snapshot helpers when linking a Clubdesk price-list row to inventory (Epic 2). */

import type { ClubdeskInventoryItem, ClubdeskInventoryVariant } from '../types/inventory';
import type { ClubdeskPriceListItemPayload } from '../types/priceList';

export function formatInventoryVariantLabel(
  variant: Pick<ClubdeskInventoryVariant, 'audience' | 'color' | 'size'> | null | undefined,
): string | null {
  if (!variant) {
    return null;
  }
  const parts = [variant.audience, variant.color, variant.size]
    .map((p) => (p == null ? '' : String(p).trim()))
    .filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

export function snapshotPriceFromInventory(item: ClubdeskInventoryItem): number {
  if (item.salePrice != null && Number.isFinite(Number(item.salePrice))) {
    return Number(item.salePrice);
  }
  if (item.recommendedPrice != null && Number.isFinite(Number(item.recommendedPrice))) {
    return Number(item.recommendedPrice);
  }
  return 0;
}

export function buildInventoryLinkPatch(
  item: ClubdeskInventoryItem,
  variant: ClubdeskInventoryVariant | null,
  current: Pick<ClubdeskPriceListItemPayload, 'description'>,
): Partial<ClubdeskPriceListItemPayload> {
  const variantLabel = formatInventoryVariantLabel(variant);
  const title =
    variantLabel && variantLabel.length > 0
      ? `${item.articleName} · ${variantLabel}`
      : item.articleName;
  const descriptionEmpty = !(current.description ?? '').replace(/<[^>]*>/g, '').trim();
  const invDesc = (item.description ?? '').trim();

  return {
    inventoryItemId: String(item.id),
    inventoryVariantId: variant?.id != null ? String(variant.id) : null,
    inventoryArticleName: item.articleName,
    inventorySlug: item.slug || null,
    inventoryVariantLabel: variantLabel,
    title,
    price: snapshotPriceFromInventory(item),
    ...(descriptionEmpty && invDesc ? { description: invDesc } : {}),
  };
}

export function clearInventoryLinkPatch(): Partial<ClubdeskPriceListItemPayload> {
  return {
    inventoryItemId: null,
    inventoryVariantId: null,
    inventoryArticleName: null,
    inventorySlug: null,
    inventoryVariantLabel: null,
  };
}
