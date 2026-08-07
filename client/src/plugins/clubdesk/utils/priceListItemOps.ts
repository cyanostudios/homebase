/** Shared pure item-list mutations used by form (local) and detail view (persist). */

export type PriceListItemLike = {
  title: string;
  description: string | null;
  price: number;
  category: string | null;
  sequenceOrder: number;
};

function categoryKey(category: string | null | undefined): string {
  const trimmed = (category || '').trim();
  return trimmed ? trimmed.toLowerCase() : '';
}

function renumberWithinCategories<T extends PriceListItemLike>(items: T[]): T[] {
  const counters = new Map<string, number>();
  return items.map((item) => {
    const key = categoryKey(item.category);
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    return { ...item, sequenceOrder: next };
  });
}

export { renumberWithinCategories };

/**
 * Move an item by one position within its category group (by global index).
 * Returns null when the move is out of bounds within that category.
 */
export function reorderItems<T extends PriceListItemLike>(
  items: T[],
  fromIndex: number,
  direction: -1 | 1,
): T[] | null {
  const source = items[fromIndex];
  if (!source) {
    return null;
  }
  const key = categoryKey(source.category);
  const sameCategoryIndexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => categoryKey(item.category) === key)
    .map(({ index }) => index);
  const positionInCategory = sameCategoryIndexes.indexOf(fromIndex);
  if (positionInCategory < 0) {
    return null;
  }
  const targetPosition = positionInCategory + direction;
  if (targetPosition < 0 || targetPosition >= sameCategoryIndexes.length) {
    return null;
  }
  const toIndex = sameCategoryIndexes[targetPosition];
  const next = [...items];
  const tmp = next[fromIndex];
  next[fromIndex] = next[toIndex];
  next[toIndex] = tmp;
  return renumberWithinCategories(next);
}

/**
 * Insert a copy of the item at index immediately after it.
 * Returns null when the source index is missing.
 */
export function copyItemAt<T extends PriceListItemLike>(items: T[], index: number): T[] | null {
  const source = items[index];
  if (!source) {
    return null;
  }
  const next: T[] = [...items];
  next.splice(index + 1, 0, {
    title: source.title,
    description: source.description,
    price: source.price,
    category: source.category,
    sequenceOrder: source.sequenceOrder,
  } as T);
  return renumberWithinCategories(next);
}

/** Group items by category name, preserving first-seen category order. */
export function groupItemsByCategory<T extends PriceListItemLike>(
  items: T[],
  catalogOrder: string[] = [],
): Array<{ category: string | null; items: T[] }> {
  const orderKeys: string[] = [];
  const groups = new Map<string, { category: string | null; items: T[] }>();

  for (const item of items) {
    const key = categoryKey(item.category);
    if (!groups.has(key)) {
      orderKeys.push(key);
      groups.set(key, {
        category: item.category?.trim() ? item.category.trim() : null,
        items: [],
      });
    }
    groups.get(key)!.items.push(item);
  }

  for (const group of groups.values()) {
    group.items.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }

  const catalogKeys = catalogOrder.map((name) => categoryKey(name)).filter(Boolean);
  const sortedKeys = [
    ...catalogKeys.filter((key) => groups.has(key)),
    ...orderKeys.filter((key) => !catalogKeys.includes(key)),
  ];

  return sortedKeys.map((key) => groups.get(key)!);
}
