/**
 * Pure URL helpers for Cupappen public listing / district paths.
 * UMD: Jest (CommonJS) + browser global `CupappenDistrictUrls`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.CupappenDistrictUrls = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const RESERVED_PATH_SEGMENTS = new Set([
    'api',
    'assets',
    'cup',
    'lib',
    'favicon.ico',
    'favicon.svg',
    'index.html',
    'llms.txt',
    'robots.txt',
    'sitemap.xml',
    'styles.css',
    'app.js',
    'cupappen-cup-detail.css',
    'cup.php',
    // AppShell listing tabs (must not resolve as federation districts)
    'sok',
    'kommande',
    'alla',
    'info',
  ]);

  /** Tab → canonical listing path (trailing slash). Home is `/`. */
  const APP_TAB_PATHS = {
    search: '/sok/',
    upcoming: '/kommande/',
    all: '/alla/',
    info: '/info/',
  };

  const APP_PATH_SEGMENT_TO_TAB = {
    sok: 'search',
    kommande: 'upcoming',
    alla: 'all',
    info: 'info',
  };

  function decodeHtmlEntities(value) {
    return String(value || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  function normalizeText(value) {
    return decodeHtmlEntities(String(value || ''));
  }

  function slugify(value) {
    const decoded = normalizeText(value).toLowerCase().trim();
    const transliterated = decoded
      .replaceAll('å', 'a')
      .replaceAll('ä', 'a')
      .replaceAll('ö', 'o')
      .replaceAll('é', 'e')
      .replaceAll('è', 'e')
      .replaceAll('ü', 'u');
    return transliterated.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cup';
  }

  function districtToSlug(name) {
    return slugify(String(name || '').trim());
  }

  function districtPath(name) {
    return `/${districtToSlug(name)}/`;
  }

  function districtSlugFromPath(pathname) {
    const parts = String(pathname || '/')
      .split('/')
      .filter(Boolean);
    if (parts.length !== 1) return null;
    const seg = parts[0].toLowerCase();
    if (RESERVED_PATH_SEGMENTS.has(seg)) return null;
    if (seg.includes('.')) return null;
    return seg;
  }

  /**
   * Listing app tab from a single-segment path (`/sok/` → `search`).
   * @returns {'search'|'upcoming'|'all'|'info'|null}
   */
  function appTabFromPath(pathname) {
    const parts = String(pathname || '/')
      .split('/')
      .filter(Boolean);
    if (parts.length !== 1) return null;
    const seg = parts[0].toLowerCase();
    return APP_PATH_SEGMENT_TO_TAB[seg] || null;
  }

  /** Canonical path for a listing tab (`search` → `/sok/`, `home` → `/`). */
  function appPathForTab(tab) {
    const key = String(tab || 'home');
    if (key === 'home' || key === 'district') return '/';
    return APP_TAB_PATHS[key] || '/';
  }

  function isAppTabPath(pathname) {
    return appTabFromPath(pathname) != null;
  }

  /**
   * @param {string} slug
   * @param {{ knownNames?: string[], districtOptions?: string[] }} [opts]
   */
  function resolveDistrictFromSlug(slug, opts = {}) {
    const s = String(slug || '')
      .toLowerCase()
      .replace(/\/+$/, '');
    if (!s) return null;
    const known = Array.isArray(opts.knownNames) ? opts.knownNames : [];
    for (const name of known) {
      if (districtToSlug(name) === s) return name;
    }
    const options = Array.isArray(opts.districtOptions) ? opts.districtOptions : [];
    for (const name of options) {
      if (districtToSlug(name) === s) return name;
    }
    if (s === 'ovrigt') return 'Övrigt';
    return null;
  }

  function cupYearFromCup(cup) {
    const rawDate = cup?.start_date || cup?.end_date || '';
    const year = new Date(rawDate).getFullYear();
    if (Number.isFinite(year) && year >= 2000 && year <= 2100) return year;
    return null;
  }

  function cupDetailUrl(cup) {
    const districtName = normalizeText(cup?.ingest_source_name).trim() || 'Övrigt';
    const districtSlug = districtToSlug(districtName);
    const slug = slugify(cup?.name || 'cup');
    const year = cupYearFromCup(cup);
    const pretty = year ? `${slug}-${year}` : slug;
    return `/${districtSlug}/${pretty}`;
  }

  function collectDistricts(cups) {
    const districts = new Set();
    let hasOvrigt = false;
    (Array.isArray(cups) ? cups : []).forEach((cup) => {
      const d = normalizeText(cup.ingest_source_name).trim();
      if (d) districts.add(d);
      else hasOvrigt = true;
    });
    const list = Array.from(districts).sort((a, b) => a.localeCompare(b, 'sv'));
    if (hasOvrigt) list.push('Övrigt');
    return list;
  }

  /** Keep a path-selected district in the dropdown options without wiping it. */
  function ensureDistrictOption(districtOptions, selectedDistrict) {
    const opts = Array.isArray(districtOptions) ? [...districtOptions] : [];
    if (!selectedDistrict || selectedDistrict === 'all') return opts;
    if (opts.includes(selectedDistrict)) return opts;
    opts.push(selectedDistrict);
    opts.sort((a, b) => {
      if (a === 'Övrigt') return 1;
      if (b === 'Övrigt') return -1;
      return a.localeCompare(b, 'sv');
    });
    return opts;
  }

  return {
    RESERVED_PATH_SEGMENTS,
    APP_TAB_PATHS,
    APP_PATH_SEGMENT_TO_TAB,
    normalizeText,
    slugify,
    districtToSlug,
    districtPath,
    districtSlugFromPath,
    appTabFromPath,
    appPathForTab,
    isAppTabPath,
    resolveDistrictFromSlug,
    cupDetailUrl,
    collectDistricts,
    ensureDistrictOption,
  };
});
