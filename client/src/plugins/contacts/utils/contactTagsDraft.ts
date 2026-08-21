/** Resolve tags shown in contact detail (draft overrides saved). */
export function resolveContactDisplayTags(
  savedTags: string[] | null | undefined,
  tagsDraft: string[] | null,
): string[] {
  if (tagsDraft !== null) {
    return tagsDraft;
  }
  return Array.isArray(savedTags) ? savedTags : [];
}

/** Whether draft tags differ from saved contact tags. */
export function hasContactTagsDraftChanges(
  savedTags: string[] | null | undefined,
  tagsDraft: string[] | null,
): boolean {
  const saved = Array.isArray(savedTags) ? savedTags : [];
  const draft = tagsDraft ?? saved;
  if (draft.length !== saved.length) {
    return true;
  }
  return draft.some((tag, index) => saved[index] !== tag);
}

/** Payload shape for applying tag edits on an existing contact. */
export function buildContactTagsSavePayload<T extends { tags?: string[] }>(
  contact: T,
  nextTags: string[],
): T & { tags: string[] } {
  return { ...contact, tags: nextTags };
}

/**
 * Add a tag to an existing list (case-insensitive). Returns the same array
 * reference if the tag is already present.
 */
export function mergeContactTag(existingTags: string[] | null | undefined, tag: string): string[] {
  const trimmed = tag.trim();
  if (!trimmed) {
    return Array.isArray(existingTags) ? existingTags : [];
  }
  const current = Array.isArray(existingTags) ? existingTags : [];
  const exists = current.some((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (exists) {
    return current;
  }
  return [...current, trimmed];
}

/** Remove a tag from an existing list. Returns the same array reference if unchanged. */
export function omitContactTag(existingTags: string[] | null | undefined, tag: string): string[] {
  const current = Array.isArray(existingTags) ? existingTags : [];
  const next = current.filter((item) => item !== tag);
  return next.length === current.length ? current : next;
}
