import type { PublicationStatus } from '../types/clubdesk';

/** Selected articles whose publication status still differs from the target. */
export function inventoryIdsForPublicationStatus(
  items: { id: string; publicationStatus?: string }[],
  selectedIds: string[],
  status: PublicationStatus,
): string[] {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  return selectedIds.filter((id) => {
    const item = byId.get(String(id));
    if (!item) {
      return false;
    }
    const current = item.publicationStatus === 'draft' ? 'draft' : 'published';
    return current !== status;
  });
}
