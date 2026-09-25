/** Snapshot helpers when linking a Clubdesk price-list row to inventory (Epic 2). */

import type { ClubdeskInventoryItem, ClubdeskInventoryVariant } from '../types/inventory';
import type { ClubdeskPriceListItemPayload } from '../types/priceList';

type InventoryCatalogSource = Pick<ClubdeskInventoryItem, 'id' | 'salePrice' | 'recommendedPrice'>;

type PriceListItemCatalogFields = {
  inventoryItemId?: string | null;
  inventoryCatalogPrice?: number | null;
  priceOverride?: number | null;
  price: number;
};

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

/** Catalog price from joined inventory columns (sale → recommended). */
export function catalogPriceFromInventoryFields(
  salePrice: number | null | undefined,
  recommendedPrice: number | null | undefined,
): number | null {
  if (salePrice != null && Number.isFinite(Number(salePrice))) {
    return Number(salePrice);
  }
  if (recommendedPrice != null && Number.isFinite(Number(recommendedPrice))) {
    return Number(recommendedPrice);
  }
  return null;
}

/** List price override wins; else inventory catalog; else stored price. */
export function resolveEffectivePriceListItemPrice(input: {
  priceOverride?: number | null;
  inventoryCatalogPrice?: number | null;
  price: number;
}): number {
  if (input.priceOverride != null && Number.isFinite(Number(input.priceOverride))) {
    return Number(input.priceOverride);
  }
  if (input.inventoryCatalogPrice != null && Number.isFinite(Number(input.inventoryCatalogPrice))) {
    return Number(input.inventoryCatalogPrice);
  }
  const fallback = Number(input.price);
  return Number.isFinite(fallback) ? fallback : 0;
}

function sameNullableNumber(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  return Number(a) === Number(b);
}

/**
 * When a row is linked and the inventory article is in `inventoryById`, refresh
 * `inventoryCatalogPrice` (and `price` when following inventory / no override).
 * Returns the same reference when nothing changed.
 */
export function withLiveInventoryCatalogPrice<T extends PriceListItemCatalogFields>(
  item: T,
  inventoryById: Map<string, InventoryCatalogSource>,
): T {
  if (!item.inventoryItemId) {
    return item;
  }
  const inv = inventoryById.get(String(item.inventoryItemId));
  if (!inv) {
    return item;
  }
  const catalog = catalogPriceFromInventoryFields(inv.salePrice, inv.recommendedPrice);
  const following =
    item.priceOverride == null ||
    item.priceOverride === undefined ||
    !Number.isFinite(Number(item.priceOverride));
  const nextPrice = following
    ? resolveEffectivePriceListItemPrice({
        priceOverride: null,
        inventoryCatalogPrice: catalog,
        price: item.price,
      })
    : Number(item.price) || 0;
  if (sameNullableNumber(item.inventoryCatalogPrice, catalog) && Number(item.price) === nextPrice) {
    return item;
  }
  return {
    ...item,
    inventoryCatalogPrice: catalog,
    ...(following ? { price: nextPrice } : {}),
  };
}

/** Sync all linked rows from the current inventory list; same array ref if unchanged. */
export function syncPriceListItemsWithInventoryCatalog<T extends PriceListItemCatalogFields>(
  items: T[],
  inventoryItems: InventoryCatalogSource[],
): T[] {
  if (!items.length || !inventoryItems.length) {
    return items;
  }
  const inventoryById = new Map(inventoryItems.map((row) => [String(row.id), row] as const));
  let changed = false;
  const next = items.map((item) => {
    const patched = withLiveInventoryCatalogPrice(item, inventoryById);
    if (patched !== item) {
      changed = true;
    }
    return patched;
  });
  return changed ? next : items;
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
  const catalog = snapshotPriceFromInventory(item);

  return {
    inventoryItemId: String(item.id),
    inventoryVariantId: variant?.id != null ? String(variant.id) : null,
    inventoryArticleName: item.articleName,
    inventorySlug: item.slug || null,
    inventoryVariantLabel: variantLabel,
    inventoryCatalogPrice: catalog,
    title,
    priceOverride: null,
    price: catalog,
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
    inventoryCatalogPrice: null,
  };
}
