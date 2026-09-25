// plugins/sportadmin/parser/ImageParser.js
const { sanitizeUrl } = require('../sanitize/sanitize');

/**
 * Extract public image URLs from HTML (CDN / relative resolved against page).
 * @param {string} html
 * @param {(href: string) => string|null} resolveUrl
 */
function parseImageUrls(html, resolveUrl) {
  const urls = [];
  const seen = new Set();
  const re = /(?:src|data-src)=['"]([^'"]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^'"]*)?)['"]/gi;
  let m;
  while ((m = re.exec(html))) {
    const resolved = sanitizeUrl(resolveUrl ? resolveUrl(m[1]) : m[1]);
    if (!resolved || seen.has(resolved)) {
      continue;
    }
    seen.add(resolved);
    urls.push(resolved);
  }
  return urls;
}

module.exports = { parseImageUrls };
