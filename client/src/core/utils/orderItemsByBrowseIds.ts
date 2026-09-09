/**
 * Reorder `items` to match the visible list order (filter + sort).
 * IDs missing from `items` are skipped. When `browseOrderIds` is empty, returns `items` unchanged.
 */
export function orderItemsByBrowseIds<T extends { id: string }>(
  items: T[],
  browseOrderIds: string[] | null | undefined,
): T[] {
  if (!browseOrderIds || browseOrderIds.length === 0) {
    return items;
  }
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const ordered: T[] = [];
  for (const id of browseOrderIds) {
    const hit = byId.get(String(id));
    if (hit) {
      ordered.push(hit);
      byId.delete(String(id));
    }
  }
  return ordered;
}
