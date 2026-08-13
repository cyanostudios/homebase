/**
 * Cupappen listing client — AppShell design system.
 * Local: Homebase Node public plugin. Prod: same-origin PHP /api/cups.php
 */

/** Apex cupappen.se redirects /api/* to www homepage in Cloudflare — use www for API. */
function resolvePublicCupsApiOrigin() {
  if (window.PUBLIC_CUPS_API_BASE) {
    return String(window.PUBLIC_CUPS_API_BASE).replace(/\/$/, '');
  }
  const { hostname, origin } = window.location;
  if (hostname === 'cupappen.se') {
    return 'https://www.cupappen.se';
  }
  return origin;
}

const API_BASE = resolvePublicCupsApiOrigin();
const IS_LOCAL_PUBLIC_CUPS =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
/**
 * Prefer same-origin PHP API (works local + prod, avoids CORS/CORP Failed to fetch).
 * Override with window.PUBLIC_CUPS_API_URL if you need the Node plugin instead.
 */
const CUPS_API_URL =
  window.PUBLIC_CUPS_API_URL ||
  (IS_LOCAL_PUBLIC_CUPS ? `${window.location.origin}/api/cups.php` : `${API_BASE}/api/cups.php`);

const CATEGORY_ALIASES = (typeof CupappenCategoryFilters !== 'undefined' &&
  CupappenCategoryFilters.CATEGORY_ALIASES) || {
  f: 'Flickor',
  flickor: 'Flickor',
  flicka: 'Flickor',
  p: 'Pojkar',
  pojkar: 'Pojkar',
  pojke: 'Pojkar',
  d: 'Dam',
  dam: 'Dam',
  damer: 'Dam',
  h: 'Herr',
  herr: 'Herr',
  herrar: 'Herr',
  m: 'Mix',
  mix: 'Mix',
  mixed: 'Mix',
  fp: 'Flickor/Pojkar',
  pf: 'Flickor/Pojkar',
};

/** QuickNav badges (AppShell) — maps to matchesCategoryGroup keys */
const QUICK_NAV_OPTIONS = [
  { value: 'all', label: 'Alla' },
  { value: 'girls', label: 'Flickor' },
  { value: 'boys', label: 'Pojkar' },
  { value: 'men', label: 'Herrar' },
  { value: 'women', label: 'Dam' },
  { value: 'girls_boys', label: 'Mix' },
];

/** Hero category filter (live labels) */
const HERO_CATEGORY_OPTIONS = [
  { value: 'all', label: 'Alla klasser' },
  { value: 'women', label: 'Damer' },
  { value: 'girls', label: 'Flickor' },
  { value: 'men', label: 'Herrar' },
  { value: 'boys', label: 'Pojkar' },
  { value: 'girls_boys', label: 'Flickor och Pojkar' },
];

const DEFAULT_FALLBACK_IMAGES = [
  '/assets/fallback/01.jpg',
  '/assets/fallback/02.jpg',
  '/assets/fallback/03.jpg',
  '/assets/fallback/04.jpg',
  '/assets/fallback/05.jpg',
  '/assets/fallback/06.jpg',
  '/assets/fallback/07.jpg',
  '/assets/fallback/08.jpg',
  '/assets/fallback/09.jpg',
  '/assets/fallback/10.jpg',
  '/assets/fallback/11.jpg',
  '/assets/fallback/12.jpg',
  '/assets/fallback/13.jpg',
  '/assets/fallback/14.jpg',
  '/assets/fallback/15.jpg',
  '/assets/fallback/16.jpg',
  '/assets/fallback/17.jpg',
  '/assets/fallback/18.jpg',
  '/assets/fallback/19.jpg',
  '/assets/fallback/20.jpg',
  '/assets/fallback/21.jpg',
  '/assets/fallback/22.jpg',
  '/assets/fallback/23.jpg',
  '/assets/fallback/24.jpg',
  '/assets/fallback/25.jpg',
];

/** Active pool: admin-uploaded URLs when present, else static defaults. */
let fallbackImagePool = DEFAULT_FALLBACK_IMAGES.slice();

function getFallbackImagePool() {
  return fallbackImagePool.length > 0 ? fallbackImagePool : DEFAULT_FALLBACK_IMAGES;
}

/** CRC-32 (IEEE) — must match PHP `crc32()` / `abs(crc32($key))` on cup.php. */
function fallbackImageHash(key) {
  const s = String(key || '');
  let crc = 0xffffffff;
  for (let i = 0; i < s.length; i += 1) {
    crc ^= s.charCodeAt(i);
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function fallbackImageForCup(cup) {
  const pool = getFallbackImagePool();
  const idPart = cup?.id != null && String(cup.id).trim() !== '' ? String(cup.id).trim() : '';
  const namePart = String(cup?.name || '')
    .trim()
    .replace(/\s+/g, ' ');
  const key = idPart || namePart || 'cup';
  const idx = fallbackImageHash(key) % pool.length;
  return pool[idx];
}

async function loadFallbackImagesFromApi() {
  try {
    const res = await fetch(`${window.location.origin}/api/fallback_images.php`, {
      credentials: 'omit',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return;
    const data = await res.json();
    const urls = Array.isArray(data?.urls)
      ? data.urls
          .map((u) => String(u || '').trim())
          .filter((u) => /^https?:\/\//i.test(u) && !/^https?:\/\/[^/]+\/api\//i.test(u))
      : [];
    if (urls.length > 0) {
      fallbackImagePool = urls;
    }
  } catch {
    /* keep static defaults */
  }
}

const state = {
  cups: [],
  activeTab: 'home',
  selectedCategory: 'all',
  selectedDateFilter: 'upcoming',
  selectedDistrict: 'all',
  districtOptions: [],
  searchQuery: '',
  pendingDistrictSlug: null,
};

const statusEl = document.getElementById('status');
const rowsContainerEl = document.getElementById('rows-container');
const quickNavEl = document.getElementById('quick-nav');
const jsonLdEl = document.getElementById('cups-json-ld');
const homeHeroEl = document.getElementById('home-hero');
const districtHeroEl = document.getElementById('district-hero');
const districtHeroTitleEl = document.getElementById('district-hero-title');
const districtHeroLeadEl = document.getElementById('district-hero-lead');
const districtCupCountLineEl = document.getElementById('district-cup-count-line');
const heroBandEl = document.getElementById('hero-band');
const sharedFilterEl = document.getElementById('shared-filter');
const heroCupCountLineEl = document.getElementById('hero-cup-count-line');
const searchInputHeroEl = document.getElementById('search-input-hero');
const dateFilterHeroEl = document.getElementById('hero-date-filter');
const dateTriggerHeroEl = document.getElementById('hero-date-trigger');
const dateLabelHeroEl = document.getElementById('hero-date-label');
const dateMenuHeroEl = document.getElementById('hero-date-menu');
const categoryFilterHeroEl = document.getElementById('hero-category-filter');
const categoryTriggerHeroEl = document.getElementById('hero-category-trigger');
const categoryLabelHeroEl = document.getElementById('hero-category-label');
const categoryMenuHeroEl = document.getElementById('hero-category-menu');
const heroDistrictFilterEl = document.getElementById('hero-district-filter');
const heroDistrictTriggerEl = document.getElementById('hero-district-trigger');
const heroDistrictLabelEl = document.getElementById('hero-district-label');
const heroDistrictMenuEl = document.getElementById('hero-district-menu');

const ACTIVE_TAB_KEY = 'cupappen_active_tab';

const DistrictUrls = globalThis.CupappenDistrictUrls;
if (!DistrictUrls) {
  throw new Error('CupappenDistrictUrls saknas — ladda /lib/districtUrls.js före app.js');
}

/** Genitivform för distriktsförbund i lead-texten. */
const DISTRICT_FEDERATION_GENITIVE = {
  Blekinge: 'Blekinges',
  Bohuslän: 'Bohusläns',
  Dalarna: 'Dalarnas',
  Dalsland: 'Dalslands',
  Gotland: 'Gotlands',
  Gästrikland: 'Gästriklands',
  Göteborg: 'Göteborgs',
  Halland: 'Hallands',
  Hälsingland: 'Hälsinglands',
  'Jämtland-Härjedalen': 'Jämtland-Härjedalens',
  Medelpad: 'Medelpads',
  Norrbotten: 'Norrbottens',
  Skåne: 'Skånes',
  Småland: 'Smålands',
  Stockholm: 'Stockholms',
  Södermanland: 'Södermanlands',
  Uppland: 'Upplands',
  Värmland: 'Värmlands',
  Västerbotten: 'Västerbottens',
  Västergötland: 'Västergötlands',
  Västmanland: 'Västmanlands',
  Ångermanland: 'Ångermanlands',
  'Örebro län': 'Örebro läns',
  Örebro: 'Örebro läns',
  Östergötland: 'Östergötlands',
};

function districtSlugFromPath(pathname) {
  return DistrictUrls.districtSlugFromPath(pathname);
}

function districtToSlug(name) {
  return DistrictUrls.districtToSlug(name);
}

function districtPath(name) {
  return DistrictUrls.districtPath(name);
}

function appTabFromPath(pathname) {
  return DistrictUrls.appTabFromPath(pathname);
}

function appPathForTab(tab) {
  return DistrictUrls.appPathForTab(tab);
}

function resolveDistrictFromSlug(slug) {
  return DistrictUrls.resolveDistrictFromSlug(slug, {
    knownNames: Object.keys(DISTRICT_FEDERATION_GENITIVE),
    districtOptions: state.districtOptions,
  });
}

function collectDistricts(cups) {
  return DistrictUrls.collectDistricts(cups);
}

function cupDetailUrl(cup) {
  return DistrictUrls.cupDetailUrl(cup);
}

function slugify(value) {
  return DistrictUrls.slugify(value);
}

/* ================================================================
   BOOT
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  applyUrlParams();
  if (searchInputHeroEl && state.searchQuery) {
    searchInputHeroEl.value = state.searchQuery;
  }
  syncUrlForState({ push: false }); // normalize legacy #hash → /sok/ etc.
  initMenuDrawer();
  initBottomBar();
  initBrandHome();
  initHeroSearch();
  initPathRouting();
  void loadFallbackImagesFromApi().finally(() => {
    loadCups();
  });
});

function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('q');
  if (q) {
    state.searchQuery = q;
  }
  const date = params.get('date');
  if (date && ['upcoming', 'past', 'all'].includes(date)) {
    state.selectedDateFilter = date === 'past' ? 'all' : date;
  }

  const appTab = appTabFromPath(window.location.pathname);
  if (appTab) {
    state.activeTab = appTab;
    if (appTab === 'search' && q) {
      /* keep query */
    } else if (appTab === 'search' && !q && state.searchQuery) {
      /* keep in-memory query until synced */
    }
    return;
  }

  const districtSlug = districtSlugFromPath(window.location.pathname);
  if (districtSlug) {
    state.pendingDistrictSlug = districtSlug;
    state.activeTab = 'district';
    state.selectedDateFilter = 'all';
    return;
  }

  /* Legacy hash tabs → path URLs (normalized in syncUrlForState). */
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (['home', 'upcoming', 'all', 'search', 'info', 'districts'].includes(hash)) {
    state.activeTab = hash;
    if (hash === 'search' && q) state.searchQuery = q;
    return;
  }

  if (q) {
    state.activeTab = 'search';
    return;
  }

  try {
    const stored = sessionStorage.getItem(ACTIVE_TAB_KEY);
    if (stored && ['home', 'upcoming', 'all', 'search', 'info', 'districts'].includes(stored)) {
      state.activeTab = stored;
    }
  } catch {
    /* ignore */
  }
}

function applyListingRouteFromLocation() {
  const appTab = appTabFromPath(window.location.pathname);
  if (appTab) {
    state.selectedDistrict = 'all';
    state.activeTab = appTab;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (appTab === 'search') {
      state.searchQuery = q || '';
      if (searchInputHeroEl) searchInputHeroEl.value = state.searchQuery;
    }
    return true;
  }

  const slug = districtSlugFromPath(window.location.pathname);
  if (slug) {
    const name = resolveDistrictFromSlug(slug);
    if (name) {
      state.selectedDistrict = name;
      state.districtOptions = DistrictUrls.ensureDistrictOption(state.districtOptions, name);
      state.selectedCategory = 'all';
      state.searchQuery = '';
      state.selectedDateFilter = 'all';
      state.activeTab = 'district';
      if (searchInputHeroEl) searchInputHeroEl.value = '';
      return true;
    }
  }

  state.selectedDistrict = 'all';
  const hash = (window.location.hash || '').replace(/^#/, '');
  if (['home', 'upcoming', 'all', 'search', 'info', 'districts'].includes(hash)) {
    state.activeTab = hash;
  } else {
    state.activeTab = 'home';
  }
  return false;
}

function initPathRouting() {
  window.addEventListener('popstate', () => {
    applyListingRouteFromLocation();
    syncUrlForState({ push: false });
    renderApp();
  });
}

const SITE_ORIGIN = 'https://www.cupappen.se';

const ROUTE_SEO = {
  home: {
    title: 'Cupappen - Hitta fotbollscuper',
    description:
      'Cupappen samlar Sveriges fotbollscuper på ett ställe. Sök, jämför och anmäl ert lag till rätt cup.',
  },
  search: {
    title: 'Sök fotbollscuper · Cupappen',
    description:
      'Sök och filtrera fotbollscuper i hela Sverige efter namn, plats, datum, kategori och distrikt.',
  },
  upcoming: {
    title: 'Kommande fotbollscuper · Cupappen',
    description:
      'Se kommande fotbollscuper i Sverige — filtrera på kategori och hitta rätt turnering för laget.',
  },
  all: {
    title: 'Alla fotbollscuper · Cupappen',
    description: 'Bläddra bland kommande och passerade fotbollscuper i Sverige.',
  },
  info: {
    title: 'Om Cupappen & FAQ · Cupappen',
    description:
      'Vanliga frågor om Cupappen och information för arrangörer som vill lista sin cup.',
  },
  districts: {
    title: 'Utforska cuper per distrikt · Cupappen',
    description: 'Sanktionerade cuper från Svenska fotbollsförbundets distrikt.',
  },
};

function setMetaByName(name, content) {
  const el = document.querySelector(`meta[name="${name}"]`);
  if (el) el.setAttribute('content', content);
}

function setMetaByProperty(property, content) {
  const el = document.querySelector(`meta[property="${property}"]`);
  if (el) el.setAttribute('content', content);
}

function setLinkHref(rel, href, { hreflang } = {}) {
  const sel = hreflang
    ? `link[rel="${rel}"][hreflang="${hreflang}"]`
    : `link[rel="${rel}"]:not([hreflang])`;
  const el = document.querySelector(sel);
  if (el) el.setAttribute('href', href);
}

/** Keep title/canonical/OG aligned with path URLs (JS-rendered crawlers). */
function syncDocumentSeo() {
  let path = '/';
  let title = ROUTE_SEO.home.title;
  let description = ROUTE_SEO.home.description;

  if (
    state.activeTab === 'district' &&
    state.selectedDistrict &&
    state.selectedDistrict !== 'all'
  ) {
    path = districtPath(state.selectedDistrict);
    title = `${state.selectedDistrict} · Cupappen`;
    description = `Fotbollscuper i ${state.selectedDistrict}. ${districtFederationLead(state.selectedDistrict)}`;
  } else if (ROUTE_SEO[state.activeTab]) {
    path = appPathForTab(state.activeTab);
    title = ROUTE_SEO[state.activeTab].title;
    description = ROUTE_SEO[state.activeTab].description;
  }

  const absolute = `${SITE_ORIGIN}${path}`;
  document.title = title;
  setMetaByName('description', description);
  setMetaByProperty('og:title', title);
  setMetaByProperty('og:description', description);
  setMetaByProperty('og:url', absolute);
  setMetaByName('twitter:title', title);
  setMetaByName('twitter:description', description);
  setLinkHref('canonical', absolute);
  setLinkHref('alternate', absolute, { hreflang: 'sv-SE' });
  setLinkHref('alternate', absolute, { hreflang: 'x-default' });
}

function syncUrlForState({ push = false } = {}) {
  if (!window.history?.replaceState) return;
  const url = new URL(window.location.href);

  if (
    state.activeTab === 'district' &&
    state.selectedDistrict &&
    state.selectedDistrict !== 'all'
  ) {
    url.pathname = districtPath(state.selectedDistrict);
    url.hash = '';
    url.search = '';
  } else {
    url.pathname = appPathForTab(state.activeTab);
    url.hash = '';
    const params = new URLSearchParams();
    if (state.activeTab === 'search') {
      const q = String(state.searchQuery || '').trim();
      if (q) params.set('q', q);
      if (state.selectedDateFilter === 'all') {
        params.set('date', 'all');
      }
    }
    url.search = params.toString() ? `?${params.toString()}` : '';
  }

  const method = push ? 'pushState' : 'replaceState';
  window.history[method]({ tab: state.activeTab, district: state.selectedDistrict }, '', url);
  syncDocumentSeo();
  maybeTrackDistrictPageview();
}

/** Dedupe key for district pageview beacons (one per slug per SPA session stretch). */
let lastDistrictPageviewSlug = '';

function postCupappenPageview(payload) {
  const body = JSON.stringify({
    ...payload,
    referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
  });
  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/pageview.php', new Blob([body], { type: 'application/json' }));
      return;
    }
  } catch {
    /* fall through */
  }
  fetch('/api/pageview.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

function maybeTrackDistrictPageview() {
  if (state.activeTab !== 'district') {
    lastDistrictPageviewSlug = '';
    return;
  }
  const name = String(state.selectedDistrict || '').trim();
  if (!name || name === 'all') return;
  const slug = DistrictUrls.districtToSlug(name);
  if (!slug || !/^[a-z0-9-]{1,64}$/.test(slug)) return;
  if (slug === lastDistrictPageviewSlug) return;
  lastDistrictPageviewSlug = slug;
  postCupappenPageview({ page_kind: 'district', district_slug: slug });
}

async function loadCups() {
  setStatus('Laddar cuper…');
  try {
    const response = await fetch(CUPS_API_URL);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error(
        'Cup-API svarade inte med JSON (kolla Cloudflare redirect för /api/* och CUPS_DB_URL på Railway)',
      );
    }
    const payload = await response.json();
    if (!response.ok) {
      const msg =
        typeof payload?.error === 'string' ? payload.error : `Server returned ${response.status}`;
      throw new Error(msg);
    }
    state.cups = Array.isArray(payload.cups)
      ? payload.cups.filter((cup) => cup?.visible !== false && cup?.visible !== 'false')
      : [];

    const now = new Date();
    const hasUpcoming = state.cups.some((cup) => isUpcoming(cup, now));
    if (!hasUpcoming && state.cups.length > 0 && state.selectedDateFilter === 'upcoming') {
      state.selectedDateFilter = 'all';
    }

    state.districtOptions = collectDistricts(state.cups);
    updateHeroCupCount(state.cups.length);
    if (state.pendingDistrictSlug) {
      const name = resolveDistrictFromSlug(state.pendingDistrictSlug);
      state.pendingDistrictSlug = null;
      if (name) {
        state.selectedDistrict = name;
        state.districtOptions = DistrictUrls.ensureDistrictOption(state.districtOptions, name);
        state.selectedCategory = 'all';
        state.searchQuery = '';
        state.selectedDateFilter = 'all';
        state.activeTab = 'district';
        if (searchInputHeroEl) searchInputHeroEl.value = '';
        syncUrlForState({ push: false });
      } else {
        state.activeTab = 'home';
        state.selectedDistrict = 'all';
        syncUrlForState({ push: false });
      }
    }
    renderHeroFilters();
    renderApp();
  } catch (error) {
    console.error('Failed to load cups:', error);
    const hint =
      error?.message === 'Failed to fetch cups'
        ? 'Databasfel på servern — kontrollera CUPS_DB_URL.'
        : String(error?.message || error);
    setStatus(hint);
    if (rowsContainerEl) {
      rowsContainerEl.innerHTML = `<div class="empty-state">${escapeHtml(hint)}</div>`;
    }
  }
}

/* ================================================================
   RENDER ORCHESTRATION
================================================================ */
function renderApp() {
  syncBottomBar();
  syncHeroVisibility();

  if (state.activeTab === 'info') {
    if (quickNavEl) quickNavEl.innerHTML = '';
    setStatus('');
    renderInfoPanel();
    return;
  }

  if (state.activeTab === 'districts') {
    if (quickNavEl) quickNavEl.innerHTML = '';
    setStatus('');
    renderDistrictsIndexPage();
    return;
  }

  if (state.activeTab === 'search') {
    if (quickNavEl) quickNavEl.innerHTML = '';
    setStatus('');
    renderSearchPanel();
    return;
  }

  if (state.activeTab === 'district') {
    maybeTrackDistrictPageview();
    renderQuickNav();
    setStatus('');
    renderSearchPanel();
    return;
  }

  renderQuickNav();
  const filtered = getFilteredCups();
  setStatus(
    filtered.length === 0
      ? state.cups.length === 0
        ? 'Inga cuper ännu.'
        : 'Inga cuper matchade filtret.'
      : `${filtered.length} cup${filtered.length === 1 ? '' : 'er'}`,
  );

  if (state.activeTab === 'home') {
    renderCategorizedRows(filtered, {
      includeFeatured: true,
      includeDistricts: false,
      includeDistrictsPicker: true,
      emptyMessage: 'Inga kommande cuper just nu.',
    });
  } else if (state.activeTab === 'upcoming') {
    renderCategorizedRows(filtered, {
      includeFeatured: false,
      emptyMessage: 'Inga kommande cuper just nu.',
    });
  } else {
    renderCategorizedRows(filtered, {
      includeFeatured: false,
      includePast: true,
      emptyMessage: 'Inga cuper att visa.',
    });
  }

  renderJsonLd(filtered);
  maybeScrollToDistrictsPicker();
}

function syncHeroVisibility() {
  const isDistrictPage = state.activeTab === 'district' && state.selectedDistrict !== 'all';
  const isDistrictsIndex = state.activeTab === 'districts';
  const showFilter = ['home', 'search'].includes(state.activeTab);
  const showQuickNav = ['home', 'upcoming', 'all', 'district'].includes(state.activeTab);
  const showHeroBand = showFilter || showQuickNav || isDistrictsIndex;

  if (heroBandEl) heroBandEl.hidden = !showHeroBand;
  if (homeHeroEl) homeHeroEl.hidden = state.activeTab !== 'home';
  if (districtHeroEl) {
    districtHeroEl.hidden = !isDistrictPage;
    if (isDistrictPage) {
      if (districtHeroTitleEl) {
        const name = String(state.selectedDistrict || '').trim();
        districtHeroTitleEl.innerHTML = `Cuper i <em class="display-accent">${escapeHtml(name)}</em>`;
      }
      if (districtHeroLeadEl) {
        districtHeroLeadEl.textContent = districtFederationLead(state.selectedDistrict);
      }
      updateDistrictCupCount(state.selectedDistrict);
    }
  }
  const districtsIndexHeroEl = document.getElementById('districts-index-hero');
  if (districtsIndexHeroEl) {
    districtsIndexHeroEl.hidden = !isDistrictsIndex;
  }
  if (sharedFilterEl) {
    sharedFilterEl.hidden = !showFilter;
  }
  if (quickNavEl) quickNavEl.hidden = !showQuickNav;
  if (showFilter) renderHeroFilters();
  syncDocumentSeo();
}

function updateHeroCupCount(total) {
  if (!heroCupCountLineEl) return;
  const n = Math.max(0, Number(total) || 0);
  const formatted = n.toLocaleString('sv-SE');
  heroCupCountLineEl.textContent =
    n === 1
      ? 'Ny säsong 2026 · 1 cup publicerad'
      : `Ny säsong 2026 · ${formatted} cuper publicerade`;
}

function countCupsForDistrict(districtName) {
  const name = String(districtName || '').trim();
  if (!name || name === 'all') return 0;
  return state.cups.filter((cup) => {
    const d = normalizeText(cup.ingest_source_name).trim() || 'Övrigt';
    return d === name;
  }).length;
}

function updateDistrictCupCount(districtName) {
  if (!districtCupCountLineEl) return;
  const n = countCupsForDistrict(districtName);
  const formatted = n.toLocaleString('sv-SE');
  districtCupCountLineEl.textContent =
    n === 1 ? '1 cup publicerad' : `${formatted} cuper publicerade`;
}

function getFilteredCups() {
  const now = new Date();
  let dateFilter = state.selectedDateFilter;
  if (state.activeTab === 'home' || state.activeTab === 'upcoming') {
    dateFilter = 'upcoming';
  } else if (state.activeTab === 'district' || state.activeTab === 'all') {
    dateFilter = 'all';
  }

  const query = state.searchQuery.trim().toLowerCase();
  const selectedCategory = state.selectedCategory || 'all';
  const selectedDistrict = state.selectedDistrict || 'all';

  return state.cups
    .filter((cup) => {
      const nameText = normalizeText(cup.name);
      const organizerText = normalizeText(cup.organizer);
      const locationText = normalizeText(cup.location);
      const categoriesText = normalizeText(cup.categories);
      const descriptionText = normalizeText(cup.description);
      const matchFormatText = normalizeText(cup.match_format);
      const districtText = normalizeText(cup.ingest_source_name);
      const registrationText = normalizeText(cup.registration_url);
      const sourceUrlText = normalizeText(cup.source_url);

      const matchesText =
        !query ||
        [
          nameText,
          organizerText,
          locationText,
          categoriesText,
          descriptionText,
          matchFormatText,
          districtText,
          registrationText,
          sourceUrlText,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);

      const matchesCategory =
        selectedCategory === 'all' || matchesCategoryGroup(categoriesText, selectedCategory);
      const matchesDistrict =
        selectedDistrict === 'all' ||
        (normalizeText(cup.ingest_source_name).trim() || 'Övrigt').toLowerCase() ===
          selectedDistrict.toLowerCase();
      const matchesDate = cupMatchesDateFilter(cup, dateFilter, now);
      return matchesText && matchesCategory && matchesDistrict && matchesDate;
    })
    .sort((a, b) => compareByDate(a, b));
}

/* ================================================================
   QUICK NAV
================================================================ */
function renderQuickNav() {
  if (!quickNavEl) return;
  quickNavEl.innerHTML = QUICK_NAV_OPTIONS.map((opt) => {
    const isActive = state.selectedCategory === opt.value;
    return `<button type="button" class="quick-nav__badge shadow-card${isActive ? ' is-active' : ''}" data-category="${escapeHtml(opt.value)}" aria-pressed="${isActive}">${escapeHtml(opt.label)}</button>`;
  }).join('');

  quickNavEl.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedCategory = btn.getAttribute('data-category') || 'all';
      renderApp();
    });
  });
}

/* ================================================================
   CUP CARD
================================================================ */
function primaryCategoryBadge(cup) {
  const categories = normalizeText(cup.categories) || '';
  const presence = getCategoryPresence(categories);
  if (presence.hasBoys && presence.hasGirls) return 'Pojkar & Flickor';
  if (presence.hasBoys) return 'Pojkar';
  if (presence.hasGirls) return 'Flickor';
  if (presence.hasWomen) return 'Dam';
  if (presence.hasMen) return 'Herr';
  const first = categories.split(',')[0].trim();
  return first || 'Cup';
}

function cupImageSrc(cup) {
  const custom = resolveCupImageUrlForAttr(cup);
  if (custom) return custom;
  return fallbackImageForCup(cup);
}

function renderCupCard(cup) {
  const name = escapeHtml(normalizeText(cup.name) || 'Okänd cup');
  const dateRange = formatDateRange(cup.start_date, cup.end_date);
  const district = normalizeText(cup.ingest_source_name).trim() || normalizeText(cup.location);
  const metaParts = [dateRange, district].filter(Boolean);
  const meta = escapeHtml(metaParts.join(' · '));
  const tag = escapeHtml(primaryCategoryBadge(cup));
  const detailUrl = escapeHtml(cupDetailUrl(cup));
  const img = escapeHtml(cupImageSrc(cup));

  return `<a class="item-card shadow-card scroll-snap-start" href="${detailUrl}" data-testid="cup-listing-card" aria-label="Öppna ${name}">
    <div class="item-card__media">
      <img src="${img}" alt="" loading="lazy" />
      <div class="item-card__gradient" aria-hidden="true"></div>
      <span class="item-card__tag glass">${tag}</span>
      <div class="item-card__body">
        <h3 class="item-card__title">${name}</h3>
        ${meta ? `<p class="item-card__meta">${meta}</p>` : ''}
      </div>
    </div>
  </a>`;
}

/* ================================================================
   ROW RENDERERS
================================================================ */
/**
 * Hem / Kommande / Alla / Sök — tidsrader + distrikt.
 * Utvalda endast på Hem (includeFeatured).
 * includeDistricts: false på distriktssida (bara tidskategorier).
 */
function renderCategorizedRows(cups, options = {}) {
  const includeFeatured = options.includeFeatured === true;
  const includePast = options.includePast === true;
  const includeDistricts = options.includeDistricts !== false;
  const includeDistrictsPicker = options.includeDistrictsPicker === true;
  const emptyMessage = options.emptyMessage || 'Inga cuper att visa.';
  const emptyUpcomingMessage = String(options.emptyUpcomingMessage || '').trim();

  if (!rowsContainerEl) return;

  const now = new Date();
  const featuredCups =
    includeFeatured === true
      ? state.cups
          .filter((c) => (c.featured === true || c.featured === 'true') && isUpcoming(c, now))
          .slice(0, 3)
      : [];

  if (cups.length === 0 && featuredCups.length === 0) {
    rowsContainerEl.innerHTML =
      `<div class="empty-state">${escapeHtml(emptyMessage)}</div>` +
      (includeDistrictsPicker ? districtsPickerSectionHtml() : '');
    bindDistrictsPicker();
    return;
  }

  const order = includePast
    ? ['Den här månaden', 'Kommande', 'Passerade']
    : ['Den här månaden', 'Kommande'];
  const groups = new Map(order.map((k) => [k, []]));
  cups.forEach((cup) => {
    const key = timeBucket(cup, now);
    if (!groups.has(key)) return;
    groups.get(key).push(cup);
  });

  const sections = [];

  if (featuredCups.length > 0) {
    sections.push(rowSectionHtml('Utvalda cuper', featuredCups, '', null, { featured: true }));
  }

  const upcomingLabels = order.filter((label) => label !== 'Passerade');
  const hasUpcomingRows = upcomingLabels.some((label) => (groups.get(label) || []).length > 0);
  if (!hasUpcomingRows && emptyUpcomingMessage) {
    sections.push(`<div class="empty-state">${escapeHtml(emptyUpcomingMessage)}</div>`);
  }

  order.forEach((label) => {
    const items = groups.get(label) || [];
    if (items.length === 0) return;
    const moreTab = label === 'Passerade' ? 'all' : 'upcoming';
    sections.push(rowSectionHtml(label, items, includeDistricts ? moreTab : ''));
  });

  if (includeDistricts) {
    const byDistrict = new Map();
    cups.forEach((cup) => {
      const d = normalizeText(cup.ingest_source_name).trim() || 'Övrigt';
      if (!byDistrict.has(d)) byDistrict.set(d, []);
      byDistrict.get(d).push(cup);
    });

    Array.from(byDistrict.keys())
      .sort((a, b) => {
        if (a === 'Övrigt') return 1;
        if (b === 'Övrigt') return -1;
        return a.localeCompare(b, 'sv');
      })
      .forEach((district) => {
        const items = byDistrict.get(district) || [];
        if (items.length === 0) return;
        sections.push(rowSectionHtml(district, items, 'search', district));
      });
  }

  if (includeDistrictsPicker) {
    sections.push(districtsPickerSectionHtml());
  }

  rowsContainerEl.innerHTML = sections.join('');
  bindRowMoreButtons();
  bindDistrictsPicker();
}

/** Hem/Kommande/Alla: Netflix-style horizontal row with optional "Visa alla". */
function rowSectionHtml(title, cups, moreTab, moreDistrict, options = {}) {
  const moreBtn = moreDistrict
    ? `<a class="item-row__more" href="${escapeHtml(districtPath(moreDistrict))}" data-goto-tab="district" data-district="${escapeHtml(moreDistrict)}">Visa alla</a>`
    : moreTab
      ? `<button type="button" class="item-row__more" data-goto-tab="${escapeHtml(moreTab)}">Visa alla</button>`
      : '';
  const rowClass = options.featured ? 'item-row item-row--featured' : 'item-row';
  return `<section class="${rowClass}">
    <div class="item-row__header">
      <h2 class="item-row__title">${escapeHtml(title)}</h2>
      ${moreBtn}
    </div>
    <div class="item-row__scroller no-scrollbar scroll-snap-x">
      ${cups.map((c) => renderCupCard(c)).join('')}
    </div>
  </section>`;
}

function bindRowMoreButtons() {
  rowsContainerEl?.querySelectorAll('[data-goto-tab]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const district = btn.getAttribute('data-district');
      if (district) {
        e.preventDefault();
        openDistrictPage(district);
        return;
      }
      const tab = btn.getAttribute('data-goto-tab') || 'all';
      setActiveTab(tab);
    });
  });
}

/** Genitivform — se DISTRICT_FEDERATION_GENITIVE ovan. */
function districtFederationLead(district) {
  const name = String(district || '').trim();
  if (!name || name === 'Övrigt') {
    return 'Sanktionerade cuper från distriktsförbunden.';
  }
  const genitive =
    DISTRICT_FEDERATION_GENITIVE[name] || (name.toLowerCase().endsWith('s') ? name : `${name}s`);
  return `Sanktionerade cuper från ${genitive} fotbollsförbund.`;
}

function sortedDistrictNames() {
  const list = Array.isArray(state.districtOptions)
    ? [...state.districtOptions]
    : collectDistricts(state.cups);
  list.sort((a, b) => {
    if (a === 'Övrigt') return 1;
    if (b === 'Övrigt') return -1;
    return a.localeCompare(b, 'sv');
  });
  return list;
}

/** Hem: distriktsrutnät (samma kortlayout som tidigare /distrikt/). */
function districtsPickerSectionHtml() {
  const list = sortedDistrictNames();
  if (list.length === 0) {
    return `<section class="district-picker district-picker--home" id="districts-picker" aria-labelledby="districts-picker-title">
      <div class="district-picker__header">
        <h2 class="district-picker__title" id="districts-picker-title">Distrikt</h2>
        <p class="district-picker__lead">Hitta cuper via distriktsförbunden.</p>
      </div>
      <p class="empty-state">Inga distrikt att visa ännu.</p>
    </section>`;
  }
  return `<section class="district-picker district-picker--home" id="districts-picker" aria-labelledby="districts-picker-title">
    <div class="district-picker__header">
      <h2 class="district-picker__title" id="districts-picker-title">Distrikt</h2>
      <p class="district-picker__lead">Välj distrikt för att se sanktionerade cuper.</p>
    </div>
    <nav class="district-picker__nav" aria-label="Välj distrikt">
      <div class="district-picker__grid">
        ${list.map((name) => districtPickerCardHtml(name)).join('')}
      </div>
    </nav>
  </section>`;
}

function bindDistrictLogoFallbacks(root) {
  (root || document).querySelectorAll('.district-picker__logo-img').forEach((img) => {
    const fail = () => {
      img.hidden = true;
      img.classList.add('is-failed');
    };
    img.addEventListener('error', fail);
    if (img.complete && img.naturalWidth === 0) fail();
  });
}

function bindDistrictsPicker() {
  bindRowMoreButtons();
  bindDistrictLogoFallbacks(rowsContainerEl);
}

function renderDistrictsIndexPage() {
  if (!rowsContainerEl) return;
  const list = sortedDistrictNames();
  if (list.length === 0) {
    rowsContainerEl.innerHTML = '<div class="empty-state">Inga distrikt att visa ännu.</div>';
    return;
  }
  rowsContainerEl.innerHTML = `<nav class="district-picker" aria-label="Välj distrikt">
    <div class="district-picker__grid">
      ${list.map((name) => districtPickerCardHtml(name)).join('')}
    </div>
  </nav>`;
  bindDistrictsPicker();
}

function maybeScrollToDistrictsPicker() {
  if (!state.pendingScrollToDistricts) return;
  state.pendingScrollToDistricts = false;
  const el = document.getElementById('districts-picker');
  const main = document.getElementById('main');
  if (!el || !main) return;
  requestAnimationFrame(() => {
    const top = el.offsetTop - 12;
    main.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  });
}

function goHomeDistrictsSection() {
  state.pendingScrollToDistricts = true;
  if (state.activeTab !== 'home') {
    setActiveTab('home');
  } else {
    syncUrlForState({ push: false });
    renderApp();
  }
}

function districtInitials(name) {
  const parts = String(name || '')
    .trim()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toLocaleUpperCase('sv-SE');
  }
  return String(name || 'D')
    .trim()
    .slice(0, 2)
    .toLocaleUpperCase('sv-SE');
}

function districtLogoUrl(slug) {
  return `/assets/districts/${encodeURIComponent(slug)}.png`;
}

function districtPickerCardHtml(name) {
  const slug = districtToSlug(name);
  const href = districtPath(name);
  const initials = districtInitials(name);
  const logo = districtLogoUrl(slug);
  return `<a class="district-picker__card" href="${escapeHtml(href)}" data-goto-tab="district" data-district="${escapeHtml(name)}">
    <span class="district-picker__logo" aria-hidden="true">
      <img class="district-picker__logo-img" src="${escapeHtml(logo)}" alt="" width="48" height="48" loading="lazy" decoding="async" data-fallback-initials="${escapeHtml(initials)}" />
      <span class="district-picker__initials">${escapeHtml(initials)}</span>
    </span>
    <span class="district-picker__name">${escapeHtml(name)}</span>
    <span class="district-picker__chevron" aria-hidden="true">›</span>
  </a>`;
}

function openDistrictPage(district) {
  const name = String(district || '').trim();
  if (!name) return;
  state.selectedDistrict = name;
  state.districtOptions = DistrictUrls.ensureDistrictOption(state.districtOptions, name);
  state.searchQuery = '';
  state.selectedCategory = 'all';
  state.selectedDateFilter = 'all';
  state.activeTab = 'district';
  if (searchInputHeroEl) searchInputHeroEl.value = '';
  try {
    sessionStorage.setItem(ACTIVE_TAB_KEY, 'home');
  } catch {
    /* ignore */
  }
  syncUrlForState({ push: true });
  renderApp();
  document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================================================================
   SEARCH PANEL
================================================================ */
function renderSearchPanel() {
  const results = getFilteredCups();
  const isDistrictPage =
    state.activeTab === 'district' && state.selectedDistrict && state.selectedDistrict !== 'all';

  setStatus('');

  renderCategorizedRows(results, {
    includeFeatured: false,
    includePast: true,
    includeDistricts: !isDistrictPage,
    emptyMessage: isDistrictPage
      ? 'Inga kommande cuper just nu.'
      : 'Inga cuper matchade din sökning.',
    emptyUpcomingMessage: isDistrictPage ? 'Inga kommande cuper just nu.' : '',
  });
  renderJsonLd(results);
}

/* ================================================================
   INFO PANEL
================================================================ */
function renderInfoPanel() {
  if (!rowsContainerEl) return;
  rowsContainerEl.innerHTML = `
    <div class="info-panel" id="info">
      <p class="info-panel__eyebrow fade-up">För arrangörer</p>
      <h2 class="info-panel__title fade-up delay-1">Fyll er cup snabbare</h2>
      <p class="info-panel__lead fade-up delay-2">Nå tusentals tränare och föreningar som aktivt söker cuper. Lägg upp er turnering gratis.</p>
      <a class="info-panel__cta fade-up delay-2" href="mailto:info@cupappen.se">Lägg till cup gratis</a>

      <p class="info-panel__eyebrow fade-up delay-3">Vanliga frågor</p>
      <h2 class="info-panel__title fade-up delay-3">FAQ</h2>
      <div class="faq-list fade-up delay-3" role="list">
        <div class="faq-item" role="listitem">
          <button type="button" class="faq-toggle" aria-expanded="false" aria-controls="faq-0">
            Kostar det något att använda Cupappen?
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="faq-0" class="faq-answer" role="region">
            Nej, Cupappen är helt gratis att använda för lag och tränare som söker cuper. För arrangörer som vill exponera sin cup kan det finnas olika paketerbjudanden — kontakta oss för mer information.
          </div>
        </div>
        <div class="faq-item" role="listitem">
          <button type="button" class="faq-toggle" aria-expanded="false" aria-controls="faq-1">
            Hur lägger jag upp min cup?
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="faq-1" class="faq-answer" role="region">
            Kontakta oss på <a href="mailto:info@cupappen.se">info@cupappen.se</a>. Vi hjälper er att publicera cupen snabbt — oftast inom ett dygn.
          </div>
        </div>
        <div class="faq-item" role="listitem">
          <button type="button" class="faq-toggle" aria-expanded="false" aria-controls="faq-2">
            Kan jag anmäla mitt lag direkt via Cupappen?
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="faq-2" class="faq-answer" role="region">
            Du klickar vidare till arrangörens officiella anmälningssida. Cupappen fungerar som katalog och sökmotor — anmälan sker hos arrangören.
          </div>
        </div>
        <div class="faq-item" role="listitem">
          <button type="button" class="faq-toggle" aria-expanded="false" aria-controls="faq-3">
            Hur vet jag att en cup är seriös?
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="faq-3" class="faq-answer" role="region">
            Vi listar primärt cuper som är sanktionerade av respektive distriktsförbund inom Svensk Fotboll.
          </div>
        </div>
      </div>
      <p class="info-panel__contact fade-up delay-3">
        Hittar du inte svaret? <a href="mailto:info@cupappen.se">Kontakta oss här</a>
        · © <span id="footer-year"></span> Cupappen
      </p>
    </div>`;

  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  rowsContainerEl.querySelectorAll('.faq-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const answerId = btn.getAttribute('aria-controls');
      const answer = answerId ? document.getElementById(answerId) : null;
      if (!answer) return;
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      answer.dataset.open = String(!isOpen);
    });
  });
}

/* ================================================================
   BOTTOM BAR + MENU
================================================================ */
function setActiveTab(tab) {
  state.activeTab = tab;
  if (tab === 'home' || tab === 'upcoming') {
    state.selectedDateFilter = 'upcoming';
  }
  if (tab === 'all') {
    state.selectedDateFilter = 'all';
  }
  if (tab !== 'district') {
    state.selectedDistrict = 'all';
  }
  try {
    sessionStorage.setItem(ACTIVE_TAB_KEY, tab === 'district' ? 'home' : tab);
  } catch {
    /* ignore */
  }
  const scrollToDistricts = state.pendingScrollToDistricts === true;
  syncUrlForState({ push: false });
  renderApp();
  if (!scrollToDistricts) {
    document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function syncBottomBar() {
  document.querySelectorAll('.bottom-bar__tab').forEach((tab) => {
    const key = tab.getAttribute('data-tab') || '';
    let active = key === state.activeTab;
    if (key === 'districts' && state.activeTab === 'district') {
      active = true;
    }
    tab.classList.toggle('is-active', active);
  });
}

function initBottomBar() {
  document.querySelectorAll('.bottom-bar__tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const key = tab.getAttribute('data-tab') || 'home';
      setActiveTab(key);
    });
  });
}

/** Logo always opens Hem (avoids sessionStorage restoring the previous tab on `/`). */
function initBrandHome() {
  document.querySelectorAll('a.brand').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      state.selectedCategory = 'all';
      state.selectedDistrict = 'all';
      state.searchQuery = '';
      if (searchInputHeroEl) searchInputHeroEl.value = '';
      setActiveTab('home');
    });
  });
}

/* ================================================================
   HERO — live intro + filter card
================================================================ */
function initHeroSearch() {
  if (searchInputHeroEl) {
    searchInputHeroEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        applyHeroSearch();
      }
    });
  }

  document.getElementById('hero-search-btn')?.addEventListener('click', applyHeroSearch);
  document.getElementById('clear-filters-btn-hero')?.addEventListener('click', clearHeroFilters);

  if (dateTriggerHeroEl) dateTriggerHeroEl.addEventListener('click', () => toggleHeroMenu('date'));
  if (categoryTriggerHeroEl)
    categoryTriggerHeroEl.addEventListener('click', () => toggleHeroMenu('category'));
  if (heroDistrictTriggerEl)
    heroDistrictTriggerEl.addEventListener('click', () => toggleHeroMenu('district'));

  document.addEventListener('click', (event) => {
    if (
      !dateFilterHeroEl?.contains(event.target) &&
      !categoryFilterHeroEl?.contains(event.target) &&
      !heroDistrictFilterEl?.contains(event.target)
    ) {
      closeHeroMenus();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeHeroMenus();
  });
}

function applyHeroSearch() {
  state.searchQuery = searchInputHeroEl?.value?.trim() || '';
  closeHeroMenus();
  if (state.selectedDistrict && state.selectedDistrict !== 'all') {
    state.activeTab = 'district';
    syncUrlForState({ push: false });
    renderApp();
  } else if (state.activeTab === 'search' || state.activeTab === 'district') {
    state.activeTab = 'search';
    state.selectedDistrict = 'all';
    syncUrlForState({ push: false });
    renderSearchPanel();
    renderJsonLd(getFilteredCups());
  } else {
    setActiveTab('search');
  }
  document.getElementById('main')?.scrollTo({ top: 0, behavior: 'smooth' });
}

function clearHeroFilters() {
  state.searchQuery = '';
  state.selectedDateFilter = 'upcoming';
  state.selectedCategory = 'all';
  state.selectedDistrict = 'all';
  if (searchInputHeroEl) searchInputHeroEl.value = '';
  renderHeroFilters();
  closeHeroMenus();
  if (state.activeTab === 'district') {
    setActiveTab('home');
  } else if (state.activeTab === 'search') {
    syncUrlForState({ push: false });
    renderSearchPanel();
    renderJsonLd(getFilteredCups());
  } else if (state.activeTab === 'home') {
    renderApp();
  } else {
    setActiveTab('home');
  }
}

function toggleHeroMenu(which) {
  const map = {
    date: { trigger: dateTriggerHeroEl, menu: dateMenuHeroEl },
    category: { trigger: categoryTriggerHeroEl, menu: categoryMenuHeroEl },
    district: { trigger: heroDistrictTriggerEl, menu: heroDistrictMenuEl },
  };
  const target = map[which];
  if (!target?.menu || !target?.trigger) return;
  const willOpen = target.menu.hidden;
  closeHeroMenus();
  if (willOpen) {
    target.menu.hidden = false;
    target.trigger.setAttribute('aria-expanded', 'true');
  }
}

function closeHeroMenus() {
  [dateMenuHeroEl, categoryMenuHeroEl, heroDistrictMenuEl].forEach((menu) => {
    if (menu) menu.hidden = true;
  });
  [dateTriggerHeroEl, categoryTriggerHeroEl, heroDistrictTriggerEl].forEach((trigger) => {
    trigger?.setAttribute('aria-expanded', 'false');
  });
}

function renderHeroFilters() {
  renderHeroDateFilter();
  renderHeroCategoryFilter();
  renderHeroDistrictFilter();
  if (searchInputHeroEl && document.activeElement !== searchInputHeroEl) {
    searchInputHeroEl.value = state.searchQuery || '';
  }
}

function renderHeroDateFilter() {
  if (!dateMenuHeroEl) return;
  const months = new Set();
  state.cups.forEach((cup) => {
    const key = monthKeyFromCup(cup);
    if (key) months.add(key);
  });
  const ordered = Array.from(months).sort((a, b) => a.localeCompare(b, 'sv'));
  const options = [
    { value: 'upcoming', label: 'Kommande' },
    { value: 'all', label: 'Alla' },
    ...ordered.map((key) => ({ value: `month:${key}`, label: monthLabelFromKey(key) })),
  ];
  if (!options.some((opt) => opt.value === state.selectedDateFilter)) {
    state.selectedDateFilter = 'upcoming';
  }
  renderCustomOptions(dateMenuHeroEl, options, state.selectedDateFilter, (value) => {
    state.selectedDateFilter = value;
    if (dateLabelHeroEl) dateLabelHeroEl.textContent = getHeroDateLabel(value);
    closeHeroMenus();
    if (state.activeTab === 'search' || state.activeTab === 'district') {
      if (state.activeTab === 'search') syncUrlForState({ push: false });
      renderSearchPanel();
      renderJsonLd(getFilteredCups());
    }
  });
  if (dateLabelHeroEl) dateLabelHeroEl.textContent = getHeroDateLabel(state.selectedDateFilter);
}

function renderHeroCategoryFilter() {
  if (!categoryMenuHeroEl) return;
  if (!HERO_CATEGORY_OPTIONS.some((opt) => opt.value === state.selectedCategory)) {
    state.selectedCategory = 'all';
  }
  renderCustomOptions(
    categoryMenuHeroEl,
    HERO_CATEGORY_OPTIONS,
    state.selectedCategory,
    (value) => {
      state.selectedCategory = value;
      if (categoryLabelHeroEl) categoryLabelHeroEl.textContent = getHeroCategoryLabel(value);
      closeHeroMenus();
      if (state.activeTab === 'search' || state.activeTab === 'district') {
        renderSearchPanel();
        renderJsonLd(getFilteredCups());
      }
    },
  );
  if (categoryLabelHeroEl)
    categoryLabelHeroEl.textContent = getHeroCategoryLabel(state.selectedCategory);
}

function renderHeroDistrictFilter() {
  if (!heroDistrictMenuEl) return;
  state.districtOptions = DistrictUrls.ensureDistrictOption(
    state.districtOptions,
    state.selectedDistrict,
  );
  const options = [
    { value: 'all', label: 'Alla distrikt' },
    ...state.districtOptions.map((d) => ({ value: d, label: d })),
  ];
  renderCustomOptions(heroDistrictMenuEl, options, state.selectedDistrict, (value) => {
    if (heroDistrictLabelEl) heroDistrictLabelEl.textContent = getHeroDistrictLabel(value);
    closeHeroMenus();
    if (value !== 'all') {
      openDistrictPage(value);
      return;
    }
    state.selectedDistrict = 'all';
    if (state.activeTab === 'district') {
      setActiveTab('home');
      return;
    }
    if (state.activeTab === 'search') {
      renderSearchPanel();
      renderJsonLd(getFilteredCups());
    }
  });
  if (heroDistrictLabelEl)
    heroDistrictLabelEl.textContent = getHeroDistrictLabel(state.selectedDistrict);
}

function renderCustomOptions(menuEl, options, selectedValue, onSelect) {
  menuEl.innerHTML = '';
  options.forEach((option) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'custom-option';
    btn.setAttribute('data-value', option.value);
    btn.setAttribute('role', 'option');
    btn.textContent = option.label;
    btn.classList.toggle('is-selected', option.value === selectedValue);
    btn.addEventListener('click', () => onSelect(option.value));
    menuEl.appendChild(btn);
  });
}

function getHeroDateLabel(value) {
  if (value === 'upcoming') return 'Kommande';
  if (value === 'all') return 'Alla';
  if (String(value).startsWith('month:'))
    return monthLabelFromKey(String(value).slice('month:'.length));
  return 'Kommande';
}

function getHeroCategoryLabel(value) {
  return HERO_CATEGORY_OPTIONS.find((opt) => opt.value === value)?.label || 'Alla klasser';
}

function getHeroDistrictLabel(value) {
  if (value === 'all') return 'Alla distrikt';
  return value || 'Alla distrikt';
}

function monthKeyFromCup(cup) {
  if (typeof CupappenDateFilters !== 'undefined') {
    return CupappenDateFilters.monthKeyFromCup(cup);
  }
  const d = parseCupDate(cup.start_date) || parseCupDate(cup.end_date);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function monthLabelFromKey(key) {
  const [y, m] = String(key).split('-').map(Number);
  if (!y || !m) return key;
  const date = new Date(y, m - 1, 1);
  const label = date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function initMenuDrawer() {
  const btn = document.getElementById('menu-btn');
  const drawer = document.getElementById('menu-drawer');
  const closeBtn = document.getElementById('menu-close');
  if (!btn || !drawer) return;

  const open = () => {
    drawer.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
  };
  const close = () => {
    drawer.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };

  btn.addEventListener('click', () => (drawer.hidden ? open() : close()));
  closeBtn?.addEventListener('click', close);
  drawer.addEventListener('click', (e) => {
    if (e.target === drawer) close();
  });
  drawer.querySelectorAll('[data-drawer-tab]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = a.getAttribute('data-drawer-tab') || 'home';
      close();
      setActiveTab(tab);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.hidden) close();
  });
}

function setStatus(text) {
  if (!statusEl) return;
  statusEl.textContent = text || '';
  statusEl.hidden = !text;
}

/* ================================================================
   DATE / CATEGORY HELPERS (preserved from previous Cupappen)
================================================================ */
function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return 'Datum saknas';
  const start = startDate ? formatDate(startDate) : '';
  const end = endDate ? formatDate(endDate) : '';
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end;
}

function formatDate(value) {
  const parsed = parseCupDate(value);
  if (!parsed) return value;
  return parsed.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isUpcoming(cup, now) {
  if (typeof CupappenDateFilters !== 'undefined') {
    return CupappenDateFilters.isUpcoming(cup, now);
  }
  const compare = cup.end_date || cup.start_date;
  if (!compare) return false;
  const date = parseCupDate(compare);
  if (!date) return false;
  return date >= now;
}

function cupMatchesDateFilter(cup, dateFilterValue, now) {
  if (typeof CupappenDateFilters !== 'undefined') {
    return CupappenDateFilters.cupMatchesDateFilter(cup, dateFilterValue, now);
  }
  if (dateFilterValue === 'all') return true;
  if (dateFilterValue === 'upcoming') return isUpcoming(cup, now);
  return true;
}

function parseCupDate(value) {
  if (typeof CupappenDateFilters !== 'undefined') {
    return CupappenDateFilters.parseCupDate(value);
  }
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function timeBucket(cup, now) {
  if (typeof CupappenDateFilters !== 'undefined') {
    return CupappenDateFilters.timeBucket(cup, now);
  }
  if (!isUpcoming(cup, now)) return 'Passerade';
  const d = parseCupDate(cup.start_date) || parseCupDate(cup.end_date);
  if (!d) return 'Kommande';
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const cupMonth = d.getFullYear() * 12 + d.getMonth();
  if (cupMonth === thisMonth) return 'Den här månaden';
  return 'Kommande';
}

function compareByDate(a, b) {
  const aDate = new Date(a.start_date || a.end_date || '9999-12-31');
  const bDate = new Date(b.start_date || b.end_date || '9999-12-31');
  const aTs = Number.isNaN(aDate.getTime()) ? Number.MAX_SAFE_INTEGER : aDate.getTime();
  const bTs = Number.isNaN(bDate.getTime()) ? Number.MAX_SAFE_INTEGER : bDate.getTime();
  if (aTs !== bTs) return aTs - bTs;
  return String(a.name || '').localeCompare(String(b.name || ''), 'sv');
}

/* ================================================================
   JSON-LD
================================================================ */
function publicSiteOrigin() {
  return typeof window !== 'undefined' ? window.location.origin : 'https://www.cupappen.se';
}

function cupDetailAbsoluteUrl(cup) {
  try {
    return new URL(cupDetailUrl(cup), `${publicSiteOrigin()}/`).href;
  } catch {
    return `${publicSiteOrigin()}${cupDetailUrl(cup)}`;
  }
}

function jsonLdEventItem(cup) {
  const regAbs = toAbsolutePublicUrl(cup.registration_url);
  const regWithUtm = regAbs ? withCupappenUtm(regAbs) : '';
  const imageAbs = resolveCupImageUrlAbsolute(cup);
  const detailUrl = cupDetailAbsoluteUrl(cup);
  const idPart = String(cup.id || '').trim();
  return {
    '@type': 'SportsEvent',
    '@id': `${detailUrl}#cup`,
    ...(idPart ? { identifier: idPart } : {}),
    url: detailUrl,
    name: normalizeText(cup.name) || 'Cup',
    inLanguage: 'sv-SE',
    sport: 'Fotboll',
    eventStatus: 'https://schema.org/EventScheduled',
    startDate: cup.start_date || undefined,
    endDate: cup.end_date || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: imageAbs || undefined,
    location: cup.location ? { '@type': 'Place', name: normalizeText(cup.location) } : undefined,
    organizer: cup.organizer
      ? { '@type': 'Organization', name: normalizeText(cup.organizer) }
      : undefined,
    description: normalizeText(cup.description || cup.categories) || undefined,
    isAccessibleForFree: true,
    offers: regWithUtm
      ? {
          '@type': 'Offer',
          url: regWithUtm,
          availability: 'https://schema.org/InStock',
          price: '0',
          priceCurrency: 'SEK',
        }
      : undefined,
  };
}

function renderJsonLd(cups) {
  const seen = new Set();
  const unique = (cups || []).filter((cup) => {
    const id = String(cup?.id || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const origin = publicSiteOrigin();
  const itemList = {
    '@type': 'ItemList',
    '@id': `${origin}/#cup-catalog-itemlist`,
    name: 'Aktuellt i cupkatalogen – Cupappen',
    description:
      'Varje SportEvent pekar på en SSR-detaljsida (/{distrikt}/{slug}-{år}) med fakta och omdömen.',
    url: `${origin}/`,
    numberOfItems: unique.length,
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    itemListElement: unique.map((cup, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: jsonLdEventItem(cup),
    })),
  };

  if (jsonLdEl) {
    jsonLdEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [itemList],
    });
  }
}

/* ================================================================
   STRING / URL UTILS
================================================================ */
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(value);
  return div.innerHTML;
}

function decodeHtmlEntities(value) {
  if (value === null || value === undefined) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = String(value);
  return textarea.value;
}

function normalizeText(value) {
  return decodeHtmlEntities(String(value || ''));
}

function safeImageUrlForAttr(url) {
  const u = normalizeText(url).trim();
  if (!u) return '';
  if (!(u.startsWith('https://') || u.startsWith('http://') || u.startsWith('/'))) return '';
  if (u.startsWith('/api/')) return '';
  return escapeHtml(u);
}

function normalizeCategoryToken(token) {
  if (typeof CupappenCategoryFilters !== 'undefined') {
    return CupappenCategoryFilters.normalizeCategoryToken(token);
  }
  const raw = normalizeText(token).trim();
  if (!raw) return '';
  if (raw.includes('/')) {
    return raw
      .split('/')
      .map((part) => normalizeCategoryToken(part))
      .filter(Boolean)
      .join('/');
  }
  const compact = raw.replace(/\s+/g, ' ').trim();
  const prefixWithAge = compact.match(/^([A-Za-zÅÄÖåäö]+)\s*(\d[\d./\-]*)$/);
  if (prefixWithAge) {
    const mapped = mapCategoryWord(prefixWithAge[1]);
    return `${mapped} ${prefixWithAge[2]}`;
  }
  return mapCategoryWord(compact);
}

function mapCategoryWord(word) {
  if (typeof CupappenCategoryFilters !== 'undefined') {
    return CupappenCategoryFilters.mapCategoryWord(word);
  }
  const key = normalizeText(word).trim().toLowerCase();
  return CATEGORY_ALIASES[key] || word;
}

function categoryTokensFromText(categoriesText) {
  if (typeof CupappenCategoryFilters !== 'undefined') {
    return CupappenCategoryFilters.categoryTokensFromText(categoriesText);
  }
  return String(categoriesText || '')
    .split(/[,;]/)
    .map((v) => normalizeCategoryToken(v))
    .filter(Boolean)
    .flatMap((v) =>
      v
        .split('/')
        .map((part) => part.trim())
        .filter(Boolean),
    );
}

function getCategoryPresence(categoriesText) {
  if (typeof CupappenCategoryFilters !== 'undefined') {
    return CupappenCategoryFilters.getCategoryPresence(categoriesText);
  }
  const tokens = categoryTokensFromText(categoriesText).map((v) => v.toLowerCase());
  const hasMixed = tokens.some(
    (t) => t === 'mix' || t.startsWith('mix ') || t === 'fp' || t === 'pf' || /^(fp|pf)\d/.test(t),
  );
  return {
    hasWomen: tokens.some((t) => t.startsWith('dam')),
    hasGirls: tokens.some((t) => t.startsWith('flickor')) || hasMixed,
    hasMen: tokens.some((t) => t.startsWith('herr')),
    hasBoys: tokens.some((t) => t.startsWith('pojkar')) || hasMixed,
    hasMixed,
  };
}

function matchesCategoryGroup(categoriesText, groupValue) {
  if (typeof CupappenCategoryFilters !== 'undefined') {
    return CupappenCategoryFilters.matchesCategoryGroup(categoriesText, groupValue);
  }
  const presence = getCategoryPresence(categoriesText);
  if (groupValue === 'women') return presence.hasWomen;
  if (groupValue === 'girls') return presence.hasGirls;
  if (groupValue === 'men') return presence.hasMen;
  if (groupValue === 'boys') return presence.hasBoys;
  if (groupValue === 'girls_boys') return presence.hasGirls && presence.hasBoys;
  return true;
}

function withCupappenUtm(urlValue) {
  if (typeof CupappenUtm !== 'undefined' && typeof CupappenUtm.withCupappenUtm === 'function') {
    return CupappenUtm.withCupappenUtm(urlValue);
  }
  // Fallback if lib/utm.js did not load (decode &amp; then append — do not use URLSearchParams).
  let raw = String(urlValue || '')
    .trim()
    .replace(/&amp;/gi, '&');
  if (!raw) return raw;
  let hash = '';
  const hashPos = raw.indexOf('#');
  if (hashPos !== -1) {
    hash = raw.slice(hashPos);
    raw = raw.slice(0, hashPos);
  }
  if (/[?&]utm_source=/i.test(raw)) {
    return (
      raw.replace(/([?&])utm_source=[^&]*/i, '$1utm_source=cupappen').replace('?&', '?') + hash
    );
  }
  return `${raw}${raw.includes('?') ? '&' : '?'}utm_source=cupappen${hash}`;
}

function toAbsolutePublicUrl(urlValue) {
  const raw = String(urlValue || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw, window.location.origin).toString();
  } catch {
    return raw;
  }
}

function resolveCupImageUrlForAttr(cup) {
  return safeImageUrlForAttr(cup?.featured_image_url);
}

function resolveCupImageUrlAbsolute(cup) {
  return toAbsolutePublicUrl(cup?.featured_image_url);
}
