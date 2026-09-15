/**
 * Build a single-key ct_sizes / ct_audiences patch for PATCH …/ct-sizes.
 * Empty values must be sent as "" — the server merges partially and only
 * clears a key when it is present with an empty string (omitted keys keep
 * the previous value). Only the changed key should be sent.
 */
export function ctFieldPatch(itemId: string, raw: string): Record<string, string> {
  return { [itemId]: raw.trim() };
}

/** True when the current size is set and not in the allowed list for the audience. */
export function isCtSizeIncompatible(currentSize: string, allowedSizes: string[]): boolean {
  const size = currentSize.trim();
  return Boolean(size) && !allowedSizes.includes(size);
}
