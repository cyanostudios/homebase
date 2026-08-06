/**
 * Order category display names: catalog order first, then orphan names (sv),
 * then optional uncategorized key last when present in `names`.
 */
export function sortCategoryNames(
  names: string[],
  catalogOrder: string[],
  uncategorizedKey?: string,
): string[] {
  const unique = Array.from(new Set(names.map((n) => String(n ?? '').trim()).filter(Boolean)));

  const catalogKeys = catalogOrder.map((n) => String(n ?? '').trim()).filter(Boolean);
  const catalogLowerToCanonical = new Map<string, string>();
  for (const name of catalogKeys) {
    const key = name.toLowerCase();
    if (!catalogLowerToCanonical.has(key)) {
      catalogLowerToCanonical.set(key, name);
    }
  }

  const remaining = new Map(unique.map((n) => [n.toLowerCase(), n]));
  const ordered: string[] = [];

  for (const catalogName of catalogKeys) {
    const key = catalogName.toLowerCase();
    const match = remaining.get(key);
    if (match !== undefined) {
      ordered.push(match);
      remaining.delete(key);
    }
  }

  const orphans = Array.from(remaining.values())
    .filter((n) => !uncategorizedKey || n !== uncategorizedKey)
    .sort((a, b) => a.localeCompare(b, 'sv'));
  ordered.push(...orphans);

  if (uncategorizedKey && unique.includes(uncategorizedKey)) {
    ordered.push(uncategorizedKey);
  }

  return ordered;
}
