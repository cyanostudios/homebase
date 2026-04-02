// server/core/utils/htmlToLineBreakHtml.js
// Converts HTML/plain text into a minimal HTML subset that preserves line breaks via <br>.
// Used for channel payloads where the marketplace storefront expects <br> for paragraph breaks.

const { decodeHtmlEntities } = require('./htmlToPlainText');

/**
 * Keep only line-break HTML (<br>) and strip other tags.
 * - Converts common block elements to line breaks
 * - Normalizes CRLF to LF
 * - Collapses excessive whitespace/newlines
 * - Returns a string that may contain "<br>" and plain text only
 *
 * @param {string} input
 * @returns {string}
 */
function htmlToLineBreakHtml(input) {
  if (typeof input !== 'string' || !input) return input;

  let s = input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Normalize common HTML block boundaries to newlines first.
  s = s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<p\b[^>]*>/gi, '\n')
    .replace(/<div\b[^>]*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n');

  // Strip all remaining tags.
  s = s.replace(/<[^>]+>/g, '');

  // Decode entities (&amp; etc) so payload text matches what the merchant expects.
  s = decodeHtmlEntities(s);

  // Normalize whitespace/newlines:
  // - remove trailing spaces per line
  // - collapse many blank lines
  s = s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();

  // Convert newlines to <br> markup expected by storefront renderers.
  // Double newline => paragraph break (<br><br>), single newline => line break (<br>).
  s = s
    .replace(/\n\n\n/g, '\n\n') // cap to max 2
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');

  return s;
}

module.exports = { htmlToLineBreakHtml };

