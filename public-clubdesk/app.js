/**
 * Public Clubdesk listing client — AppShell design system.
 * Guides: /api/items.php + /guide/:slug
 * Price lists: /api/price_lists.php + /price-list/:slug
 * Site content: /api/site_content.php (home + info cards)
 * Listing URLs: `/`, `/guides/`, `/price-lists/`, `/info/`, `/kategori/:slug/`.
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
const ITEMS_API_URL = window.PUBLIC_APP_API_URL || `${API_BASE}/api/items.php`;
const PRICE_LISTS_API_URL =
  window.PUBLIC_APP_PRICE_LISTS_API_URL || `${API_BASE}/api/price_lists.php`;
const SITE_CONTENT_API_URL =
  window.PUBLIC_APP_SITE_CONTENT_API_URL || `${API_BASE}/api/site_content.php`;
const Urls = window.ClubdeskListingUrls;

if (!Urls) {
  throw new Error('ClubdeskListingUrls saknas — ladda /lib/listingUrls.js före app.js');
}

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
  if (slug) return `/guide/${encodeURIComponent(slug)}`;
  return `/guide/${encodeURIComponent(String(item.id || ''))}`;
}

function priceListHref(item) {
  const slug = String(item.slug || '').trim();
  if (slug) return `/price-list/${encodeURIComponent(slug)}`;
  return `/price-list/${encodeURIComponent(String(item.id || ''))}`;
}

function itemName(item) {
  return String(item.name || item.title || '').trim() || 'Utan namn';
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
  const url = String(
    item.featured_image_url || item.featuredImageUrl || item.image_url || item.imageUrl || '',
  ).trim();
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) {
    return url;
  }
  return '';
}

function itemMeta(item) {
  if (item.meta) return String(item.meta);
  const stepCount = Number(item.stepCount ?? item.step_count ?? 0);
  if (stepCount > 0) {
    return stepCount === 1 ? '1 steg' : `${stepCount} steg`;
  }
  return String(item.description || '');
}

function priceListMeta(item) {
  if (item.meta) return String(item.meta);
  const count = Number(item.itemCount ?? item.item_count ?? 0);
  if (count > 0) {
    return count === 1 ? '1 produkt' : `${count} produkter`;
  }
  return String(item.description || '');
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

function syncBottomBar(tab) {
  const activeKey = tab === 'category' ? 'guides' : tab === 'all' ? 'guides' : tab;
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
 * Home copy comes from CMS site-content in #rows-container (no static hero / quick-nav).
 */

function renderItemCard(item) {
  const name = escapeHtml(itemName(item));
  const href = escapeHtml(itemHref(item));
  const tag = escapeHtml(itemCategory(item));
  const meta = escapeHtml(itemMeta(item));
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

function renderPriceListCard(item) {
  const name = escapeHtml(itemName(item));
  const href = escapeHtml(priceListHref(item));
  const meta = escapeHtml(priceListMeta(item));
  const currency = escapeHtml(String(item.currency || 'SEK'));

  return `<a class="price-list-card shadow-card" href="${href}">
    <span class="price-list-card__tag">${currency}</span>
    <h3 class="price-list-card__title">${name}</h3>
    ${meta ? `<p class="price-list-card__meta">${meta.length > 48 ? `${meta.slice(0, 47)}…` : meta}</p>` : ''}
  </a>`;
}

function collectCategories(items) {
  return ['Alla', ...orderedCategoryNames(items, window.__PUBLIC_APP_CATEGORY_ORDER__ || [])];
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

function navigateListing(tab, filter, { replace = false } = {}) {
  setActiveTab(tab);
  window.__PUBLIC_APP_FILTER__ = filter || 'Alla';
  syncBottomBar(tab);
  syncUrl(tab, filter, { replace });
  applyFilter();
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
    navigateListing(next.tab, next.filter);
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

function renderHomeHub() {
  const container = document.getElementById('rows-container');
  if (!container) return;
  const guides = Array.isArray(window.__PUBLIC_APP_ITEMS__) ? window.__PUBLIC_APP_ITEMS__ : [];
  const priceLists = Array.isArray(window.__PUBLIC_APP_PRICE_LISTS__)
    ? window.__PUBLIC_APP_PRICE_LISTS__
    : [];
  const site = window.__PUBLIC_APP_SITE_CONTENT__ || {};
  const homeHtml = String(site.home?.contentHtml || '').trim();
  const homeTitle = String(site.home?.title || '').trim();
  const guideCount = guides.length;
  const priceCount = priceLists.length;
  const guideMeta =
    guideCount === 0 ? 'Inga guider ännu' : guideCount === 1 ? '1 guide' : `${guideCount} guider`;
  const priceMeta =
    priceCount === 0
      ? 'Inga prislistor ännu'
      : priceCount === 1
        ? '1 prislista'
        : `${priceCount} prislistor`;

  const introParts = [];
  if (homeTitle) {
    introParts.push(`<h2 class="site-content-title">${escapeHtml(homeTitle)}</h2>`);
  }
  if (homeHtml) {
    introParts.push(`<div class="site-content-html site-content-html--home">${homeHtml}</div>`);
  }
  const intro =
    introParts.length > 0
      ? `<div class="site-content-intro" id="home-intro">${introParts.join('')}</div>`
      : '';

  container.innerHTML = `${intro}<div class="hub-grid" id="hub-grid" aria-label="Startsida">
    <a class="hub-tile shadow-card" href="/guides/" data-hub="guides">
      <span class="hub-tile__label">Guides</span>
      <span class="hub-tile__meta">${escapeHtml(guideMeta)}</span>
    </a>
    <a class="hub-tile shadow-card" href="/price-lists/" data-hub="price-lists">
      <span class="hub-tile__label">Price list</span>
      <span class="hub-tile__meta">${escapeHtml(priceMeta)}</span>
    </a>
  </div>`;

  container.querySelectorAll('[data-hub]').forEach((el) => {
    bindSpaLink(el, () => {
      const key = el.getAttribute('data-hub') || 'guides';
      if (key === 'price-lists') return { tab: 'price-lists', filter: 'Alla' };
      return { tab: 'guides', filter: 'Alla' };
    });
  });
}

function renderGuideRows(items) {
  const container = document.getElementById('rows-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Inga guider just nu</div>`;
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
    }));
  });
}

function renderPriceListListing() {
  const container = document.getElementById('rows-container');
  if (!container) return;
  const items = Array.isArray(window.__PUBLIC_APP_PRICE_LISTS__)
    ? window.__PUBLIC_APP_PRICE_LISTS__
    : [];
  if (items.length === 0) {
    container.innerHTML = `<div class="empty-state">Inga prislistor just nu</div>`;
    return;
  }
  container.innerHTML = `<section class="item-grid-section">
    <div class="item-grid-section__header">
      <h2 class="item-grid-section__title">Price list</h2>
    </div>
    <div class="item-grid">
      ${items.map(renderPriceListCard).join('')}
    </div>
  </section>`;
}

function renderInfoListing() {
  const container = document.getElementById('rows-container');
  if (!container) return;
  const year = String(new Date().getFullYear());
  const site = window.__PUBLIC_APP_SITE_CONTENT__ || {};
  const infoHtml = String(site.info?.contentHtml || '').trim();
  const infoTitle = String(site.info?.title || '').trim();
  let body;
  if (infoHtml || infoTitle) {
    const titleBlock = infoTitle
      ? `<h2 class="site-content-title">${escapeHtml(infoTitle)}</h2>`
      : '';
    const htmlBlock = infoHtml
      ? `<div class="site-content-html site-content-html--info">${infoHtml}</div>`
      : '';
    body = `${titleBlock}${htmlBlock}`;
  } else {
    body = `<p class="info-panel__eyebrow">Om appen</p>
      <h2 class="info-panel__title">Clubdesk</h2>
      <p class="info-panel__lead">
        Här hittar du guider och prislistor för personalen. Börja på startsidan eller öppna Guides och Price list.
      </p>`;
  }
  container.innerHTML = `
    <div class="info-panel" id="info">
      ${body}
      <p class="info-panel__contact">
        © <span id="footer-year">${escapeHtml(year)}</span> Clubdesk
      </p>
    </div>`;
}

function applyFilter() {
  const tab = getActiveTab();

  if (tab === 'info') {
    setStatus('');
    renderInfoListing();
    return;
  }

  if (tab === 'home') {
    setStatus('');
    renderHomeHub();
    return;
  }

  if (tab === 'price-lists') {
    setStatus('');
    renderPriceListListing();
    return;
  }

  const filter = window.__PUBLIC_APP_FILTER__ || 'Alla';
  const items = Array.isArray(window.__PUBLIC_APP_ITEMS__) ? window.__PUBLIC_APP_ITEMS__ : [];

  const filtered =
    filter === 'Alla'
      ? items
      : items.filter((it) => itemCategory(it).toLowerCase() === filter.toLowerCase());

  if (filtered.length === 0) {
    setStatus('');
    const container = document.getElementById('rows-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">${
        items.length === 0 ? 'Inga guider just nu' : 'Inget i den här kategorin'
      }</div>`;
    }
    return;
  }
  setStatus('');
  renderGuideRows(filtered);
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
    const [guidesRes, priceRes, siteRes] = await Promise.all([
      fetch(ITEMS_API_URL),
      fetch(PRICE_LISTS_API_URL),
      fetch(SITE_CONTENT_API_URL),
    ]);
    if (!guidesRes.ok) throw new Error(`Guides HTTP ${guidesRes.status}`);
    if (!priceRes.ok) throw new Error(`Price lists HTTP ${priceRes.status}`);

    const guidesData = await guidesRes.json();
    const priceData = await priceRes.json();
    let siteData = { home: { contentHtml: '', title: '' }, info: { contentHtml: '', title: '' } };
    if (siteRes.ok) {
      try {
        const parsed = await siteRes.json();
        siteData = {
          home: {
            contentHtml: String(parsed?.home?.contentHtml || ''),
            title: String(parsed?.home?.title || ''),
          },
          info: {
            contentHtml: String(parsed?.info?.contentHtml || ''),
            title: String(parsed?.info?.title || ''),
          },
        };
      } catch {
        // keep empty site content
      }
    }

    const items = Array.isArray(guidesData.items)
      ? guidesData.items
      : Array.isArray(guidesData.guides)
        ? guidesData.guides
        : [];
    const priceLists = Array.isArray(priceData.priceLists) ? priceData.priceLists : [];

    window.__PUBLIC_APP_ITEMS__ = items;
    window.__PUBLIC_APP_PRICE_LISTS__ = priceLists;
    window.__PUBLIC_APP_SITE_CONTENT__ = siteData;
    window.__PUBLIC_APP_CATEGORY_ORDER__ = Array.isArray(guidesData.categoryOrder)
      ? guidesData.categoryOrder
      : [];
    applyRouteFromLocation({ replaceUrl: true });
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
  document.querySelectorAll('.bottom-bar__tab').forEach((tab) => {
    const key = tab.getAttribute('data-tab') || '';
    bindSpaLink(tab, () => {
      if (key === 'info') return { tab: 'info', filter: 'Alla' };
      if (key === 'guides' || key === 'all') return { tab: 'guides', filter: 'Alla' };
      if (key === 'price-lists') return { tab: 'price-lists', filter: 'Alla' };
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

applyRouteFromLocation({ replaceUrl: true });
syncBottomBar(getActiveTab());
initBottomBar();
initMenuDrawer();
initPopState();
loadItems();
