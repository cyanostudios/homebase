/** Case-insensitive title uniqueness among clubdesk, optionally excluding one id. */

export function hasDuplicateClubdeskTitle(
  clubdesk: Array<{ id: string; title: string }>,
  title: string,
  excludeId?: string | null,
): boolean {
  const titleKey = title.trim().toLowerCase();
  if (!titleKey) {
    return false;
  }
  return clubdesk.some(
    (row) =>
      String(row.id) !== String(excludeId ?? '') &&
      (row.title || '').trim().toLowerCase() === titleKey,
  );
}
