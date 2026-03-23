// server/core/utils/htmlToPlainText.js
// Converts HTML to plain text for CDON/Fyndiq API export. Both APIs recommend plain text without HTML tags.

/**
 * Decode HTML entities (e.g. &amp;#x27; -> ', &amp; -> &). Handles double-encoded entities.
 */
function decodeHtmlEntities(str) {
  if (typeof str !== 'string' || !str) return str;
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

/**
 * Convert HTML to plain text. Strips tags, converts block elements to newlines.
 * CDON and Fyndiq APIs recommend plain text without HTML for title and description.
 * @param {string} str - Input that may contain HTML
 * @returns {string} Plain text
 */
function htmlToPlainText(str) {
  if (typeof str !== 'string' || !str) return str;
  let s = str
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return decodeHtmlEntities(s);
}

module.exports = { htmlToPlainText, decodeHtmlEntities };
