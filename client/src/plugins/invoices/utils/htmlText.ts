/** Undo common/over-escaped HTML entities to plain text. */
export function decodeHtmlEntities(str: string): string {
  let s = String(str || '');
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#0*39;/g, "'")
      .replace(/&#x0*27;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }
  return s;
}

/** Plain text for UI display when notes may contain over-escaped entities. */
export function displayPlainText(str: string | null | undefined): string {
  return decodeHtmlEntities(String(str ?? ''));
}
