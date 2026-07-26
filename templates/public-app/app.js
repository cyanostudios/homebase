/**
 * Public app listing client (template) — AppShell design system.
 * Local: Homebase Node public plugin when available.
 * Prod: same-origin PHP /api/items.php
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

function collectCategories(items) {
  const set = new Set();
  items.forEach((it) => set.add(itemCategory(it)));
  return ['Alla', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'sv'))];
}

function renderQuickNav(items, activeLabel) {
  const nav = document.getElementById('quick-nav');
  if (!nav) return;
  const labels = collectCategories(items);
  const active = activeLabel || 'Alla';
  nav.innerHTML = labels
    .map((label) => {
      const isActive = label === active;
      return `<button type="button" class="quick-nav__badge shadow-card${isActive ? ' is-active' : ''}" data-filter="${escapeHtml(label)}" aria-pressed="${isActive}">${escapeHtml(label)}</button>`;
    })
    .join('');

  nav.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter') || 'Alla';
      window.__PUBLIC_APP_FILTER__ = filter;
      applyFilter();
    });
  });
}

function groupByCategory(items) {
  const map = new Map();
  items.forEach((it) => {
    const cat = itemCategory(it);
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(it);
  });
  return map;
}

function renderRows(items) {
  const container = document.getElementById('rows-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Inga objekt att visa.</div>`;
    return;
  }

  const groups = groupByCategory(items);
  const sections = [];

  // Featured-style first row: all matching items when filter is Alla / flat list
  if (window.__PUBLIC_APP_FILTER__ && window.__PUBLIC_APP_FILTER__ !== 'Alla') {
    const title = escapeHtml(window.__PUBLIC_APP_FILTER__);
    sections.push(`<section class="item-row">
      <div class="item-row__header">
        <h2 class="item-row__title">${title}</h2>
        <a class="item-row__more" href="#all">Visa alla</a>
      </div>
      <div class="item-row__scroller no-scrollbar scroll-snap-x">
        ${items.map(renderItemCard).join('')}
      </div>
    </section>`);
  } else {
    groups.forEach((groupItems, cat) => {
      const title = escapeHtml(cat);
      sections.push(`<section class="item-row">
        <div class="item-row__header">
          <h2 class="item-row__title">${title}</h2>
          <button type="button" class="item-row__more" data-filter-more="${title}">Visa alla</button>
        </div>
        <div class="item-row__scroller no-scrollbar scroll-snap-x">
          ${groupItems.map(renderItemCard).join('')}
        </div>
      </section>`);
    });
  }

  container.innerHTML = sections.join('');

  container.querySelectorAll('[data-filter-more]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const filter = btn.getAttribute('data-filter-more') || 'Alla';
      window.__PUBLIC_APP_FILTER__ = filter;
      applyFilter();
      document
        .getElementById('quick-nav')
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

function applyFilter() {
  const filter = window.__PUBLIC_APP_FILTER__ || 'Alla';
  const items = Array.isArray(window.__PUBLIC_APP_ITEMS__) ? window.__PUBLIC_APP_ITEMS__ : [];
  const filtered =
    filter === 'Alla'
      ? items
      : items.filter((it) => itemCategory(it).toLowerCase() === filter.toLowerCase());

  renderQuickNav(items, filter);
  setStatus(
    filtered.length === 0
      ? items.length === 0
        ? 'Inga objekt ännu.'
        : 'Inga träffar.'
      : `${filtered.length} objekt`,
  );
  renderRows(filtered);
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
    window.__PUBLIC_APP_FILTER__ = 'Alla';
    applyFilter();
  } catch (err) {
    console.error(err);
    setStatus('Kunde inte ladda data.');
    const container = document.getElementById('rows-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">Kunde inte ladda data. Kontrollera API / APP_DB_URL.</div>`;
    }
  }
}

function initBottomBar() {
  const tabs = document.querySelectorAll('.bottom-bar__tab');
  const hash = (window.location.hash || '').replace(/^#/, '') || 'home';
  const path = window.location.pathname;

  tabs.forEach((tab) => {
    const key = tab.getAttribute('data-tab') || '';
    let active = false;
    if (path === '/' || path === '/index.html') {
      active = hash === 'home' ? key === 'home' : key === hash;
      if (!window.location.hash && key === 'home') active = true;
    }
    tab.classList.toggle('is-active', active);

    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      if (key === 'all') {
        window.__PUBLIC_APP_FILTER__ = 'Alla';
        applyFilter();
      }
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
  drawer.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
}

/**
 * Optional demo: show audio pod when ?audio=1 (apps wire real player later).
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

initBottomBar();
initMenuDrawer();
initAudioPodDemo();
loadItems();
