import type { ClubdeskInventoryItem } from '../types/inventory';

export type InventoryListFilter = 'draft' | 'published';

export type InventoryListFilterSelection = InventoryListFilter[];

const STATUS_FILTERS = ['draft', 'published'] as const satisfies readonly InventoryListFilter[];

export function inventoryMatchesListFilters(
  item: ClubdeskInventoryItem,
  filters: InventoryListFilterSelection,
): boolean {
  if (filters.length === 0) {
    return true;
  }
  const status = item.publicationStatus === 'published' ? 'published' : 'draft';
  return filters.every((filter) => {
    if (filter === 'draft') {
      return status === 'draft';
    }
    if (filter === 'published') {
      return status === 'published';
    }
    return true;
  });
}

export function toggleInventoryListFilter(
  current: InventoryListFilterSelection,
  filter: InventoryListFilter,
): InventoryListFilterSelection {
  if (current.includes(filter)) {
    return current.filter((f) => f !== filter);
  }
  return [...current.filter((f) => !STATUS_FILTERS.includes(f as InventoryListFilter)), filter];
}

export function inventoryItemMatchesSearch(
  item: ClubdeskInventoryItem,
  searchTerm: string,
): boolean {
  const needle = searchTerm.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const hay = [
    item.articleName,
    item.brand,
    item.description,
    item.material,
    item.slug,
    ...(item.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return hay.includes(needle);
}

export function inventoryItemMatchesTagFilter(
  item: ClubdeskInventoryItem,
  tag: string | null,
): boolean {
  const want = (tag ?? '').trim();
  if (!want) {
    return true;
  }
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return tags.some((t) => t.trim().toLowerCase() === want.toLowerCase());
}

export function countInventoryItemsWithTag(items: ClubdeskInventoryItem[], tag: string): number {
  return items.filter((item) => inventoryItemMatchesTagFilter(item, tag)).length;
}
