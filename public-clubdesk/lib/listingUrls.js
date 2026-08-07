/**
 * Pure URL helpers for public-clubdesk listing paths.
 * UMD: Jest (CommonJS) + browser global `ClubdeskListingUrls`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.ClubdeskListingUrls = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function slugifyCategory(value) {
    const decoded = String(value || '')
      .toLowerCase()
      .trim()
      .replaceAll('å', 'a')
      .replaceAll('ä', 'a')
      .replaceAll('ö', 'o')
      .replaceAll('é', 'e')
      .replaceAll('è', 'e')
      .replaceAll('ü', 'u');
    return decoded.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'ovrigt';
  }

  function categoryPath(name) {
    return `/kategori/${slugifyCategory(name)}/`;
  }

  function pathForListing(tab, filter) {
    if (tab === 'info') return '/info/';
    if (tab === 'price-lists') return '/price-lists/';
    if (tab === 'category' || (filter && filter !== 'Alla')) {
      return categoryPath(filter || 'Övrigt');
    }
    if (tab === 'guides' || tab === 'all') return '/guides/';
    return '/';
  }

  function parseListingPath(pathname) {
    const raw = String(pathname || '/');
    const path = raw.replace(/\/+$/, '') || '/';
    if (path === '/' || path === '/index.html') {
      return { tab: 'home', filter: 'Alla', categorySlug: null };
    }
    if (path === '/guides' || path === '/alla') {
      return { tab: 'guides', filter: 'Alla', categorySlug: null };
    }
    if (path === '/price-lists') {
      return { tab: 'price-lists', filter: 'Alla', categorySlug: null };
    }
    if (path === '/info') {
      return { tab: 'info', filter: 'Alla', categorySlug: null };
    }
    const cat = path.match(/^\/kategori\/([^/]+)$/);
    if (cat) {
      return {
        tab: 'category',
        filter: null,
        categorySlug: decodeURIComponent(cat[1]),
      };
    }
    return { tab: 'home', filter: 'Alla', categorySlug: null };
  }

  function resolveCategoryFromSlug(slug, categoryNames) {
    const want = String(slug || '')
      .toLowerCase()
      .trim();
    if (!want) return null;
    const list = Array.isArray(categoryNames) ? categoryNames : [];
    const found = list.find((name) => slugifyCategory(name) === want);
    return found || null;
  }

  return {
    slugifyCategory,
    categoryPath,
    pathForListing,
    parseListingPath,
    resolveCategoryFromSlug,
  };
});
