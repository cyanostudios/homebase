/** Escape text for safe embedding in HTML (PDF templates, etc.). */
function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Undo common/over-escaped HTML entities to plain text. */
function decodeHtmlEntities(str) {
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

function escapeHtmlText(value) {
  return escapeHtml(decodeHtmlEntities(String(value ?? '')));
}

module.exports = { escapeHtml, decodeHtmlEntities, escapeHtmlText };
