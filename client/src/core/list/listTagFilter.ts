/** Empty selection matches all. Non-empty is OR across catalog tags (exact string). */
export function itemMatchesSelectedTags(
  item: { tags?: readonly string[] | null },
  selectedTags: readonly string[],
): boolean {
  if (selectedTags.length === 0) {
    return true;
  }
  const tags = Array.isArray(item.tags) ? item.tags : [];
  return selectedTags.some((tag) => tags.includes(tag));
}

export function countItemsWithTag(
  items: ReadonlyArray<{ tags?: readonly string[] | null }>,
  tag: string,
): number {
  return items.filter((item) => itemMatchesSelectedTags(item, [tag])).length;
}

export function toggleTagFilter(current: readonly string[], tag: string): string[] {
  if (current.includes(tag)) {
    return current.filter((entry) => entry !== tag);
  }
  return [...current, tag];
}
