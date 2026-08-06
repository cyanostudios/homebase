/**
 * Public app listing client (template) — AppShell design system.
 * Local: Homebase Node public plugin when available.
 * Prod: same-origin PHP /api/items.php
 * Listing URLs: `/`, `/alla/`, `/info/`, `/kategori/:slug/`.
 * Detail: `/item/:slug`.
 */

function resolvePublicAppApiOrigin() {
  if (window.PUBLIC_APP_API_BASE) {
    return String(window.PUBLIC_APP_API_BASE).replace(/\/$/, '');
  }
  const { hostname, origin } = window.location;
  if (hostname === 'example.se') {
    return 'https://www.example.se';
  }
  return origin;
}

const API_BASE = resolvePublicAppApiOrigin();
const IS_LOCAL =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const ITEMS_API_URL =
  window.PUBLIC_APP_API_URL ||
  (IS_LOCAL
    ? `${window.PUBLIC_APP_API_BASE || 'http://localhost:3002'}/api/public/appname`
    : `${API_BASE}/api/items.php`);

const Urls = window.PublicAppListingUrls;

if (!Urls) {
  throw new Error('PublicAppListingUrls saknas — ladda /lib/listingUrls.js före app.js');
}

const heroBandEl = document.getElementById('hero-band');
const homeHeroEl = document.getElementById('home-hero');
const sharedFilterEl = document.getElementById('shared-filter');
const quickNavEl = document.getElementById('quick-nav');
const heroCountLineEl = document.getElementById('hero-count-line');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function itemHref(item) {
  const slug = String(item.slug || '').trim();
  if (slug) return `/item/${encodeURIComponent(slug)}`;
  return `/item/${encodeURIComponent(String(item.id || ''))}`;
}

function itemCategory(item) {
  const raw = item.category ?? item.categories ?? item.tag ?? '';
  if (Array.isArray(raw)) {
    return String(raw[0] || 'Övrigt').trim() || 'Övrigt';
  }
  const s = String(raw || '').trim();
  if (!s) return 'Övrigt';
  return s.split(',')[0].trim() || 'Övrigt';
}

function itemImageUrl(item) {
  const url = String(item.featured_image_url || item.image_url || '').trim();
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  return '';
}

function setStatus(text) {
  const el = document.getElementById('status');
  if (el) el.textContent = text;
}

function getActiveTab() {
  return window.__PUBLIC_APP_TAB__ || 'home';
}

function setActiveTab(tab) {
  window.__PUBLIC_APP_TAB__ = tab;
}

function updateHeroCount(total) {
  if (!heroCountLineEl) return;
  const n = Math.max(0, Number(total) || 0);
  const formatted = n.toLocaleString('sv-SE');
  heroCountLineEl.textContent = n === 1 ? '1 objekt' : `${formatted} objekt`;
}

function syncBottomBar(tab) {
  const activeKey = tab === 'category' ? 'all' : tab;
  document.querySelectorAll('.bottom-bar__tab').forEach((t) => {
    t.classList.toggle('is-active', t.getAttribute('data-tab') === activeKey);
  });
}

function syncUrl(tab, filter, { replace = false } = {}) {
  const path = Urls.pathForListing(tab, filter);
  const url = new URL(window.location.href);
  url.pathname = path;
  url.hash = '';
  url.search = '';
  const state = { tab, filter: filter || 'Alla' };
  if (replace) {
    window.history.replaceState(state, '', url);
  } else {
    window.history.pushState(state, '', url);
  }
}

/**
 * Hero band: home copy on home; optional shared-filter when apps mount UI;
 * quick-nav on listing tabs. Hidden on info.
 */
function syncHeroVisibility() {
  const tab = getActiveTab();
  const showHomeHero = tab === 'home';
  const showQuickNav = tab === 'home' || tab === 'all' || tab === 'category';
  const showHeroBand = showHomeHero || showQuickNav;
  const hasFilterUi = Boolean(sharedFilterEl) && sharedFilterEl.childElementCount > 0;
  const showSharedFilter = hasFilterUi && showQuickNav;

  if (heroBandEl) heroBandEl.hidden = !showHeroBand;
  if (homeHeroEl) homeHeroEl.hidden = !showHomeHero;
  if (sharedFilterEl) sharedFilterEl.hidden = !showSharedFilter;
  if (quickNavEl) quickNavEl.hidden = !showQuickNav;
}

function renderItemCard(item) {
  const name = escapeHtml(item.name || 'Utan namn');
  const href = escapeHtml(itemHref(item));
  const tag = escapeHtml(itemCategory(item));
  const meta = escapeHtml(item.meta || item.description || '');
  const img = itemImageUrl(item);
  const imgHtml = img ? `<img src="${escapeHtml(img)}" alt="" loading="lazy" />` : '';

  return `<a class="item-card shadow-card scroll-snap-start" href="${href}">
    <div class="item-card__media">
      ${imgHtml}
      <div class="item-card__gradient" aria-hidden="true"></div>
      <span class="item-card__tag glass">${tag}</span>
      <div class="item-card__body">
        <h3 class="item-card__title">${name}</h3>
        ${meta ? `<p class="item-card__meta">${meta.length > 48 ? `${meta.slice(0, 47)}…` : meta}</p>` : ''}
      </div>
    </div>
  </a>`;
}

function orderedCategoryNames(items, catalog) {
  const present = new Set();
  items.forEach((it) => present.add(itemCategory(it)));
  const ordered = [];
  const used = new Set();
  (Array.isArray(catalog) ? catalog : []).forEach((name) => {
    const needle = String(name || '')
      .trim()
      .toLowerCase();
    if (!needle) return;
    for (const label of present) {
      if (label.toLowerCase() === needle && !used.has(label.toLowerCase())) {
        ordered.push(label);
        used.add(label.toLowerCase());
        break;
      }
    }
  });
  const orphans = Array.from(present)
    .filter((label) => label !== 'Övrigt' && !used.has(label.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'sv'));
  ordered.push(...orphans);
  if (present.has('Övrigt')) ordered.push('Övrigt');
  return ordered;
}

function collectCategories(items) {
  return ['Alla', ...orderedCategoryNames(items, window.__PUBLIC_APP_CATEGORY_ORDER__ || [])];
}

function navigateListing(tab, filter, { replace = false, scroll = false } = {}) {
  setActiveTab(tab);
  window.__PUBLIC_APP_FILTER__ = filter || 'Alla';
  syncBottomBar(tab);
  syncUrl(tab, filter, { replace });
  applyFilter();
  if (scroll) {
    document.getElementById('quick-nav')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function isModifiedClick(e) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function bindSpaLink(el, resolve) {
  if (!el) return;
  el.addEventListener('click', (e) => {
    if (isModifiedClick(e)) return;
    e.preventDefault();
    const next = resolve();
    navigateListing(next.tab, next.filter, { scroll: Boolean(next.scroll) });
  });
}

function renderQuickNav(items, activeLabel) {
  const nav = document.getElementById('quick-nav');
  if (!nav) return;
  const labels = collectCategories(items);
  const active = activeLabel || 'Alla';
  nav.innerHTML = labels
    .map((label) => {
      const isActive = label === active;
      const href = label === 'Alla' ? '/alla/' : Urls.categoryPath(label);
      return `<a class="quick-nav__badge shadow-card${isActive ? ' is-active' : ''}" href="${escapeHtml(href)}" data-filter="${escapeHtml(label)}" aria-current="${isActive ? 'page' : 'false'}">${escapeHtml(label)}</a>`;
    })
    .join('');

  nav.querySelectorAll('[data-filter]').forEach((btn) => {
    bindSpaLink(btn, () => {
      const filter = btn.getAttribute('data-filter') || 'Alla';
      if (filter === 'Alla') {
        return { tab: 'all', filter: 'Alla', scroll: true };
      }
      return { tab: 'category', filter, scroll: true };
    });
  });
}

function groupByCategory(items) {
  const map = new Map();
  orderedCategoryNames(items, window.__PUBLIC_APP_CATEGORY_ORDER__ || []).forEach((cat) => {
    map.set(cat, []);
  });
  items.forEach((it) => {
    const cat = itemCategory(it);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(it);
  });
  for (const [cat, groupItems] of [...map.entries()]) {
    if (!groupItems.length) map.delete(cat);
  }
  return map;
}

function renderRows(items) {
  const container = document.getElementById('rows-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Inga objekt att visa.</div>`;
    return;
  }

  const sections = [];
  const filter = window.__PUBLIC_APP_FILTER__ || 'Alla';

  if (filter !== 'Alla') {
    const title = escapeHtml(filter);
    sections.push(`<section class="item-grid-section">
      <div class="item-grid-section__header">
        <h2 class="item-grid-section__title">${title}</h2>
      </div>
      <div class="item-grid">
        ${items.map(renderItemCard).join('')}
      </div>
    </section>`);
  } else {
    groupByCategory(items).forEach((groupItems, cat) => {
      const title = escapeHtml(cat);
      const moreHref = escapeHtml(Urls.categoryPath(cat));
      sections.push(`<section class="item-row">
        <div class="item-row__header">
          <h2 class="item-row__title">${title}</h2>
          <a class="item-row__more" href="${moreHref}" data-filter-more="${title}">Visa alla</a>
        </div>
        <div class="item-row__scroller no-scrollbar scroll-snap-x">
          ${groupItems.map(renderItemCard).join('')}
        </div>
      </section>`);
    });
  }

  container.innerHTML = sections.join('');

  container.querySelectorAll('[data-filter-more]').forEach((btn) => {
    bindSpaLink(btn, () => ({
      tab: 'category',
      filter: btn.getAttribute('data-filter-more') || 'Alla',
      scroll: true,
    }));
  });
}

function renderInfoPanel() {
  const container = document.getElementById('rows-container');
  if (!container) return;
  const year = String(new Date().getFullYear());
  container.innerHTML = `
    <div class="info-panel" id="info">
      <p class="info-panel__eyebrow">Om appen</p>
      <h2 class="info-panel__title">Replace this title</h2>
      <p class="info-panel__lead">
        Placeholder info copy for the public-app template. Swap eyebrow, title, lead and CTA when you copy the scaffold.
      </p>
      <a class="info-panel__cta" href="mailto:hello@example.se">Kontakta oss</a>
      <p class="info-panel__contact">
        © <span id="footer-year">${escapeHtml(year)}</span> Public App
      </p>
    </div>`;
}

function applyFilter() {
  const tab = getActiveTab();
  syncHeroVisibility();

  if (tab === 'info') {
    if (quickNavEl) quickNavEl.innerHTML = '';
    setStatus('');
    renderInfoPanel();
    return;
  }

  const filter = window.__PUBLIC_APP_FILTER__ || 'Alla';
  const items = Array.isArray(window.__PUBLIC_APP_ITEMS__) ? window.__PUBLIC_APP_ITEMS__ : [];

  let filtered =
    filter === 'Alla'
      ? items
      : items.filter((it) => itemCategory(it).toLowerCase() === filter.toLowerCase());

  renderQuickNav(items, filter);
  if (filtered.length === 0) {
    setStatus('');
    const container = document.getElementById('rows-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">${
        items.length === 0 ? 'Inga objekt ännu.' : 'Inga träffar.'
      }</div>`;
    }
    return;
  }
  setStatus(`${filtered.length} objekt`);
  renderRows(filtered);
}

function applyRouteFromLocation({ replaceUrl = false } = {}) {
  const parsed = Urls.parseListingPath(window.location.pathname);
  const items = Array.isArray(window.__PUBLIC_APP_ITEMS__) ? window.__PUBLIC_APP_ITEMS__ : [];

  if (parsed.tab === 'category' && parsed.categorySlug) {
    const names = collectCategories(items).filter((c) => c !== 'Alla');
    const resolved =
      Urls.resolveCategoryFromSlug(parsed.categorySlug, names) ||
      parsed.categorySlug.replace(/-/g, ' ');
    setActiveTab('category');
    window.__PUBLIC_APP_FILTER__ = resolved;
  } else {
    setActiveTab(parsed.tab);
    window.__PUBLIC_APP_FILTER__ = parsed.filter || 'Alla';
  }
  syncBottomBar(getActiveTab());
  if (replaceUrl) {
    syncUrl(getActiveTab(), window.__PUBLIC_APP_FILTER__, { replace: true });
  }
}

async function loadItems() {
  try {
    const res = await fetch(ITEMS_API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.cups)
        ? data.cups
        : [];
    window.__PUBLIC_APP_ITEMS__ = items;
    window.__PUBLIC_APP_CATEGORY_ORDER__ = Array.isArray(data.categoryOrder)
      ? data.categoryOrder
      : [];
    applyRouteFromLocation({ replaceUrl: true });
    updateHeroCount(items.length);
    applyFilter();
  } catch (err) {
    console.error(err);
    setStatus('Kunde inte ladda data.');
    updateHeroCount(0);
    syncHeroVisibility();
    const container = document.getElementById('rows-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">Kunde inte ladda data. Kontrollera API / APP_DB_URL.</div>`;
    }
  }
}

function initBottomBar() {
  document.querySelectorAll('.bottom-bar__tab').forEach((tab) => {
    const key = tab.getAttribute('data-tab') || '';
    bindSpaLink(tab, () => {
      if (key === 'info') return { tab: 'info', filter: 'Alla' };
      if (key === 'all') return { tab: 'all', filter: 'Alla' };
      return { tab: 'home', filter: 'Alla' };
    });
  });
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
  drawer.querySelectorAll('a').forEach((a) => {
    bindSpaLink(a, () => {
      const href = a.getAttribute('href') || '/';
      const parsed = Urls.parseListingPath(href);
      close();
      if (parsed.tab === 'category') {
        return { tab: 'category', filter: parsed.categorySlug || 'Alla' };
      }
      return { tab: parsed.tab, filter: parsed.filter || 'Alla' };
    });
  });
}

function initPopState() {
  window.addEventListener('popstate', () => {
    applyRouteFromLocation();
    applyFilter();
  });
}

/**
 * Audio-pod is opt-in. Uncomment markup in index.html and call this, or pass ?audio=1 for a demo.
 */
function initAudioPodDemo() {
  const pod = document.getElementById('audio-pod');
  if (!pod) return;
  const params = new URLSearchParams(window.location.search);
  if (params.get('audio') !== '1') return;
  pod.hidden = false;
  const title = document.getElementById('audio-title');
  if (title) title.textContent = 'Exempel · Ljudguide';
}

applyRouteFromLocation({ replaceUrl: true });
syncBottomBar(getActiveTab());
initBottomBar();
initMenuDrawer();
initPopState();
initAudioPodDemo();
syncHeroVisibility();
loadItems();
