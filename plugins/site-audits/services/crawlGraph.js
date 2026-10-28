// plugins/site-audits/services/crawlGraph.js
// Sitemap vs crawl coverage + max depth from BFS depth on page records.
const SAMPLE_CAP = 10;

function normalizeUrl(raw) {
  try {
    const parsed = new URL(raw);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * @param {{
 *   pages: Array<{ url?: string, finalUrl?: string, depth?: number }>,
 *   sitemapUrls: string[],
 *   homepageUrl?: string
 * }} input
 */
function buildCrawlGraph({ pages, sitemapUrls, homepageUrl }) {
  const pageList = Array.isArray(pages) ? pages : [];
  const crawled = new Set();
  let maxDepth = 0;

  for (const page of pageList) {
    const primary = normalizeUrl(page?.finalUrl || page?.url);
    const secondary = normalizeUrl(page?.url);
    if (primary) crawled.add(primary);
    if (secondary) crawled.add(secondary);
    if (typeof page?.depth === 'number' && Number.isFinite(page.depth)) {
      maxDepth = Math.max(maxDepth, page.depth);
    }
  }

  const sitemapSet = new Set();
  for (const raw of Array.isArray(sitemapUrls) ? sitemapUrls : []) {
    const normalized = normalizeUrl(raw);
    if (normalized) sitemapSet.add(normalized);
  }

  const sitemapOnly = [];
  for (const url of sitemapSet) {
    if (!crawled.has(url)) {
      if (sitemapOnly.length < SAMPLE_CAP) sitemapOnly.push(url);
    }
  }

  const crawledNotInSitemap = [];
  if (sitemapSet.size > 0) {
    for (const url of crawled) {
      if (!sitemapSet.has(url)) {
        if (crawledNotInSitemap.length < SAMPLE_CAP) crawledNotInSitemap.push(url);
      }
    }
  }

  let sitemapOnlyCount = 0;
  for (const url of sitemapSet) {
    if (!crawled.has(url)) sitemapOnlyCount += 1;
  }

  let crawledNotInSitemapCount = 0;
  if (sitemapSet.size > 0) {
    for (const url of crawled) {
      if (!sitemapSet.has(url)) crawledNotInSitemapCount += 1;
    }
  }

  return {
    pageCount: pageList.length,
    homepageUrl: homepageUrl ? normalizeUrl(homepageUrl) : null,
    sitemapUrlCount: sitemapSet.size,
    sitemapOnlyCount,
    crawledNotInSitemapCount,
    maxDepth,
    sitemapOnlySample: sitemapOnly,
    crawledNotInSitemapSample: crawledNotInSitemap,
  };
}

module.exports = { buildCrawlGraph, SAMPLE_CAP };
