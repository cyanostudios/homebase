/**
 * Decode HTML entities for display (e.g. &amp;#x27; -> ', &amp; -> &).
 * Handles double-encoded entities. Use when displaying product titles/descriptions
 * that may contain entities from Sello or other imports.
 */
export function decodeHtmlEntities(str: string | null | undefined): string {
  if (str == null || typeof str !== 'string') return '';
  let s = str;
  for (let i = 0; i < 3; i++) {
    const prev = s;
    s = s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/gi, "'")
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
    if (s === prev) break;
  }
  return s;
}
