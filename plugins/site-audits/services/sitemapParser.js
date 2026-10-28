// plugins/site-audits/services/sitemapParser.js
// Lightweight <loc> extraction for sitemap.xml / sitemap index files. Regex-based rather than
// a full XML parser since we only ever need the <loc> URL list, and sitemap files can be large.

/**
 * @param {string} xml
 * @returns {string[]} unique, trimmed <loc> values in document order
 */
function extractLocs(xml) {
  if (!xml || typeof xml !== 'string') {
    return [];
  }
  const matches = xml.match(/<loc>([\s\S]*?)<\/loc>/gi) || [];
  const seen = new Set();
  const locs = [];
  for (const match of matches) {
    const value = match.replace(/<\/?loc>/gi, '').trim();
    if (value && !seen.has(value)) {
      seen.add(value);
      locs.push(value);
    }
  }
  return locs;
}

/**
 * @param {string} xml
 * @returns {boolean} true if this looks like a <sitemapindex> (one level of <sitemap> children
 *   pointing at further sitemap files) rather than a plain <urlset> of pages.
 */
function isSitemapIndex(xml) {
  return /<sitemapindex[\s>]/i.test(String(xml || ''));
}

module.exports = { extractLocs, isSitemapIndex };
