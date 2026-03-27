/**
 * Strip the " · source-label" suffix that older scraped records may have
 * embedded in their name field. New records no longer include this suffix.
 */
export function cleanCupName(name: string | null | undefined): string {
  if (!name) return '';
  return name.replace(/\s*·\s*[^·]+$/, '').trim();
}
