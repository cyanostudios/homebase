/**
 * Normalize and validate Cupappen fallback cover image URLs.
 * Shared by CupsModel site-config and unit tests.
 */

const FALLBACK_IMAGES_CONFIG_KEY = 'fallback_images';
const MAX_FALLBACK_IMAGES = 100;

/**
 * @param {unknown} value — raw array, or `{ urls: unknown[] }` / DB JSONB value
 * @returns {string[]}
 */
function normalizeFallbackImageUrls(value) {
  const rawList = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray(value.urls)
      ? value.urls
      : [];
  const out = [];
  const seen = new Set();
  for (const item of rawList) {
    const url = String(item || '').trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    if (/^https?:\/\/[^/]+\/api\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_FALLBACK_IMAGES) break;
  }
  return out;
}

module.exports = {
  FALLBACK_IMAGES_CONFIG_KEY,
  MAX_FALLBACK_IMAGES,
  normalizeFallbackImageUrls,
};
