/**
 * Slug utilities for URL-friendly item identifiers.
 *
 * URL shape:
 *   No collision  →  /notes/min-anteckning
 *   Collision     →  /notes/min-anteckning-a3f9c1   (last 6 chars of id)
 *
 * The suffix is always derived from item.id so the same item always gets the
 * same URL regardless of list order.
 */

/** Convert an arbitrary string to a URL-safe slug. */
export function slugify(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics (å→a, ä→a, ö→o, etc.)
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric runs with -
    .replace(/^-+|-+$/g, '') // trim leading/trailing -
    .slice(0, 80); // cap length
}

/**
 * Build the URL slug for a single item.
 *
 * @param item       The item whose slug to build.
 * @param allItems   All items in the same list (used for collision detection).
 * @param nameField  The field name that holds the human-readable label.
 *                   Pass a function for composed names (e.g. matches).
 */
export function buildSlug(
  item: Record<string, any>,
  allItems: Record<string, any>[],
  nameField: string | ((i: Record<string, any>) => string),
): string {
  const getName =
    typeof nameField === 'function'
      ? nameField
      : (i: Record<string, any>) => String(i[nameField] ?? '');
  const base = slugify(getName(item));
  if (!base) {
    // Fallback to id-only slug when name is empty/missing
    return `item-${String(item.id).slice(-8)}`;
  }

  const sameSlug = allItems.filter(
    (other) => other.id !== item.id && slugify(getName(other)) === base,
  );

  if (sameSlug.length === 0) {
    return base;
  }

  // Collision: append last 6 chars of this item's id
  return `${base}-${String(item.id).slice(-6)}`;
}

/**
 * Resolve a URL segment back to an item.
 *
 * Handles both the plain-slug form and the collision-suffix form.
 * Falls back to matching on the id suffix in case the list changed since
 * the URL was generated (e.g. a name-duplicate was deleted).
 */
export function resolveSlug(
  urlSegment: string,
  items: Record<string, any>[],
  nameField: string | ((i: Record<string, any>) => string),
): Record<string, any> | null {
  if (!urlSegment || items.length === 0) {
    return null;
  }

  // 1. Try exact match against each item's own current slug
  const exact = items.find((i) => buildSlug(i, items, nameField) === urlSegment);
  if (exact) {
    return exact;
  }

  // 2. Fallback: the url segment ends with a 6-char id suffix (after the last -)
  //    This handles the case where the list changed and the slug no longer matches.
  const dashIdx = urlSegment.lastIndexOf('-');
  if (dashIdx !== -1) {
    const suffix = urlSegment.slice(dashIdx + 1);
    if (suffix.length === 6) {
      const bySuffix = items.find((i) => String(i.id).endsWith(suffix));
      if (bySuffix) {
        return bySuffix;
      }
    }
  }

  return null;
}
