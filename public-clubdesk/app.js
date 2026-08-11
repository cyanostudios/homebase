/**
 * Public Clubdesk listing client — request-form-inspired shell.
 * Guides: /api/items.php + /guide/:slug
 * Price lists: /api/price_lists.php + /price-list/:slug
 * Site content: /api/site_content.php (home + info cards)
 * Listing URLs: `/`, `/guides/`, `/price-lists/`, `/info/`, `/kategori/:slug/`.
 * Org Swish: `/swish/` (SSR detail, linked from Hem row).
 * Kontakt: `/kontakt/` (SSR detail, linked from Hem row when contacts exist).
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
const INFO_CONTACTS_API_URL =
  window.PUBLIC_APP_INFO_CONTACTS_API_URL || `${API_BASE}/api/info_contacts.php`;
const Urls = window.ClubdeskListingUrls;

if (!Urls) {
  throw new Error('ClubdeskListingUrls saknas — ladda /lib/listingUrls.js före app.js');
}

const ICON_GUIDE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
const ICON_PRICE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10"/><path d="M18 15v6M15 18h6"/></svg>`;
const ICON_INFO = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></svg>`;
const ICON_SWISH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><path d="M14 14h5v5"/><path d="M14 19h.01"/></svg>`;
const ICON_KONTAKT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateText(value, max = 96) {
  const text = plainText(value);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
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

function itemMeta(item) {
  if (item.meta) return String(item.meta);
  const stepCount = Number(item.stepCount ?? item.step_count ?? 0);
  if (stepCount > 0) {
    return stepCount === 1 ? '1 steg' : `${stepCount} steg`;
  }
  return '';
}

function priceListMeta(item) {
  if (item.meta) return String(item.meta);
  const count = Number(item.itemCount ?? item.item_count ?? 0);
  if (count > 0) {
    return count === 1 ? '1 produkt' : `${count} produkter`;
  }
  return '';
}

function itemDescription(item) {
  const desc = truncateText(item.description || '');
  if (desc) return desc;
  const meta = itemMeta(item);
  const cat = itemCategory(item);
  if (meta && cat) return `${cat} · ${meta}`;
  return meta || cat || 'Öppna guiden';
}

function priceListDescription(item) {
  const desc = truncateText(item.description || '');
  if (desc) return desc;
  const meta = priceListMeta(item);
  const currency = String(item.currency || 'SEK').trim();
  if (meta) return `${meta} · ${currency}`;
  return currency ? `Prislista · ${currency}` : 'Öppna prislistan';
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

function renderOptionCard({ href, title, description, kind, spaTab }) {
  const icon =
    kind === 'price-list'
      ? ICON_PRICE
      : kind === 'info'
        ? ICON_INFO
        : kind === 'swish'
          ? ICON_SWISH
          : kind === 'kontakt'
            ? ICON_KONTAKT
            : ICON_GUIDE;
  const kindClass =
    kind === 'price-list'
      ? 'price-list'
      : kind === 'info'
        ? 'info'
        : kind === 'swish'
          ? 'swish'
          : kind === 'kontakt'
            ? 'kontakt'
            : 'guide';
  const spaAttr = spaTab ? ` data-home-spa="${escapeHtml(spaTab)}"` : '';
  return `<a class="option-card" href="${escapeHtml(href)}"${spaAttr}>
    <span class="option-card__icon option-card__icon--${kindClass}">${icon}</span>
    <span class="option-card__text">
      <span class="option-card__title">${escapeHtml(title)}</span>
      ${description ? `<span class="option-card__desc">${escapeHtml(description)}</span>` : ''}
    </span>
    <span class="option-card__chevron" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="m9 18 6-6-6-6"/></svg>
    </span>
  </a>`;
}

function renderGuideOptionCard(item) {
  return renderOptionCard({
    href: itemHref(item),
    title: itemName(item),
    description: itemDescription(item),
    kind: 'guide',
  });
}

function renderPriceListCard(item) {
  return renderOptionCard({
    href: priceListHref(item),
    title: itemName(item),
    description: priceListDescription(item),
    kind: 'price-list',
  });
}

function renderInfoRow() {
  return renderOptionCard({
    href: '/info/',
    title: 'Info',
    description: 'Om appen och föreningen',
    kind: 'info',
    spaTab: 'info',
  });
}

function renderSwishRow() {
  return renderOptionCard({
    href: '/swish/',
    title: 'Swish',
    description: 'Föreningens nummer och QR-kod',
    kind: 'swish',
  });
}

function renderKontaktRow() {
  return renderOptionCard({
    href: '/kontakt/',
    title: 'Kontakt',
    description: 'Personer att höra av dig till',
    kind: 'kontakt',
  });
}

function isFeaturedItem(item) {
  return item?.featured === true || item?.featured === 1 || item?.featured === 'true';
}

function itemImageUrl(item) {
  const url = String(
    item?.featured_image_url || item?.featuredImageUrl || item?.image_url || item?.imageUrl || '',
  ).trim();
  return url;
}

function renderHomeSquareCard(item, kind) {
  const href = kind === 'price-list' ? priceListHref(item) : itemHref(item);
  const name = itemName(item);
  const img = kind === 'guide' ? itemImageUrl(item) : '';
  const initial = (name || '?').charAt(0).toUpperCase();
  const media = img
    ? `<img class="home-square-card__img" src="${escapeHtml(img)}" alt="" loading="lazy" />`
    : `<span class="home-square-card__fallback" aria-hidden="true">${escapeHtml(initial)}</span>`;
  return `<a class="home-square-card" href="${escapeHtml(href)}">
    <span class="home-square-card__media">${media}</span>
    <span class="home-square-card__label">${escapeHtml(name)}</span>
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

function renderConvPanel({ title, subtitle, bodyHtml, panelId }) {
  const head = `<div class="conv-step-head">
    <h2 class="conv-step-head__title">${escapeHtml(title)}</h2>
    ${subtitle ? `<p class="conv-step-head__subtitle">${subtitle}</p>` : ''}
  </div>`;
  return `<div class="conv-panel" ${panelId ? `id="${escapeHtml(panelId)}"` : ''}>
    ${head}
    ${bodyHtml}
  </div>`;
}

/** Shared listing chrome: beige header + white sheet (Hem layout). */
function renderPageChrome({ title, subtitleHtml, bodyHtml, headerId }) {
  return `
    <header class="home-header"${headerId ? ` id="${escapeHtml(headerId)}"` : ''}>
      <h1 class="home-header__title">${escapeHtml(title)}</h1>
      ${subtitleHtml || ''}
    </header>
    <div class="home-sheet">${bodyHtml}</div>`;
}

function plainSubtitle(text) {
  return `<p class="home-header__text">${escapeHtml(text)}</p>`;
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

  const title = homeTitle || 'Hem';
  const subtitleHtml = homeHtml
    ? `<div class="home-header__text site-content-html site-content-html--home">${homeHtml}</div>`
    : plainSubtitle('Guider och prislistor för personalen.');

  const featuredCards = [
    ...guides.filter(isFeaturedItem).map((item) => renderHomeSquareCard(item, 'guide')),
    ...priceLists.filter(isFeaturedItem).map((item) => renderHomeSquareCard(item, 'price-list')),
  ];

  const infoContacts = Array.isArray(window.__PUBLIC_APP_INFO_CONTACTS__)
    ? window.__PUBLIC_APP_INFO_CONTACTS__
    : [];

  const rowCards = [
    ...guides.map(renderGuideOptionCard),
    ...priceLists.map(renderPriceListCard),
    renderSwishRow(),
    ...(infoContacts.length > 0 ? [renderKontaktRow()] : []),
    renderInfoRow(),
  ];

  const sections = [];
  if (featuredCards.length > 0) {
    sections.push(`<section class="home-section home-section--cards" aria-label="Utvalt">
      <div class="home-square-grid">${featuredCards.join('')}</div>
    </section>`);
  }
  sections.push(
    rowCards.length > 0
      ? `<section class="home-section home-section--rows" aria-label="Innehåll">
          <div class="option-list" id="home-option-list">${rowCards.join('')}</div>
        </section>`
      : `<section class="home-section"><div class="empty-state empty-state--inset">Inget innehåll ännu</div></section>`,
  );

  const bodyHtml = sections.join('');

  container.innerHTML = renderPageChrome({
    title,
    subtitleHtml,
    bodyHtml,
    headerId: 'home-intro',
  });

  container.querySelectorAll('[data-home-spa]').forEach((el) => {
    bindSpaLink(el, () => {
      const tab = el.getAttribute('data-home-spa') || 'home';
      return { tab, filter: 'Alla' };
    });
  });
}

function renderGuideRows(items) {
  const container = document.getElementById('rows-container');
  if (!container) return;

  const filter = window.__PUBLIC_APP_FILTER__ || 'Alla';
  const pageTitle = filter !== 'Alla' ? filter : 'Guides';
  const pageSubtitle =
    filter !== 'Alla'
      ? plainSubtitle('Guider i den här kategorin')
      : plainSubtitle('Alla publicerade guider');

  if (items.length === 0) {
    container.innerHTML = renderPageChrome({
      title: pageTitle,
      subtitleHtml: pageSubtitle,
      bodyHtml: `<div class="empty-state empty-state--inset">Inga guider just nu</div>`,
    });
    return;
  }

  let bodyHtml;
  if (filter !== 'Alla') {
    bodyHtml = `<section class="home-section home-section--rows">
      <div class="option-list item-grid">
        ${items.map(renderGuideOptionCard).join('')}
      </div>
    </section>`;
  } else {
    const sections = [];
    groupByCategory(items).forEach((groupItems, cat) => {
      const title = escapeHtml(cat);
      sections.push(`<section class="home-section home-section--rows">
        <div class="home-section__head">
          <h2 class="home-section__title">${title}</h2>
        </div>
        <div class="option-list item-grid">
          ${groupItems.map(renderGuideOptionCard).join('')}
        </div>
      </section>`);
    });
    bodyHtml = sections.join('');
  }

  container.innerHTML = renderPageChrome({
    title: pageTitle,
    subtitleHtml: pageSubtitle,
    bodyHtml,
  });
}

function renderPriceListListing() {
  const container = document.getElementById('rows-container');
  if (!container) return;
  const items = Array.isArray(window.__PUBLIC_APP_PRICE_LISTS__)
    ? window.__PUBLIC_APP_PRICE_LISTS__
    : [];
  const bodyHtml =
    items.length === 0
      ? `<div class="empty-state empty-state--inset">Inga prislistor just nu</div>`
      : `<section class="home-section home-section--rows">
          <div class="option-list item-grid">${items.map(renderPriceListCard).join('')}</div>
        </section>`;
  container.innerHTML = renderPageChrome({
    title: 'Price list',
    subtitleHtml: plainSubtitle('Välj en prislista för att se produkter och betala.'),
    bodyHtml,
  });
}

function renderInfoListing() {
  const container = document.getElementById('rows-container');
  if (!container) return;
  const year = String(new Date().getFullYear());
  const site = window.__PUBLIC_APP_SITE_CONTENT__ || {};
  const infoHtml = String(site.info?.contentHtml || '').trim();
  const infoTitle = String(site.info?.title || '').trim();

  const title = infoTitle || 'Info';
  let subtitleHtml;
  let bodyInner;
  if (infoHtml) {
    subtitleHtml = '';
    bodyInner = `<div class="site-content-html site-content-html--info" id="info">${infoHtml}</div>
      <p class="info-panel__contact">© <span id="footer-year">${escapeHtml(year)}</span> Clubdesk</p>`;
  } else if (infoTitle) {
    subtitleHtml = plainSubtitle('Information om föreningen och appen.');
    bodyInner = `<p class="info-panel__contact">© <span id="footer-year">${escapeHtml(year)}</span> Clubdesk</p>`;
  } else {
    subtitleHtml = plainSubtitle(
      'Här hittar du guider och prislistor för personalen. Börja på startsidan eller öppna Guides och Price list.',
    );
    bodyInner = `<p class="info-panel__contact">© <span id="footer-year">${escapeHtml(year)}</span> Clubdesk</p>`;
  }

  container.innerHTML = renderPageChrome({
    title,
    subtitleHtml,
    bodyHtml: `<section class="home-section" id="info">${bodyInner}</section>`,
  });
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
      const filter = window.__PUBLIC_APP_FILTER__ || 'Alla';
      const emptyTitle = filter !== 'Alla' ? filter : 'Guides';
      container.innerHTML = renderPageChrome({
        title: emptyTitle,
        subtitleHtml: plainSubtitle(
          items.length === 0 ? 'Inga guider just nu' : 'Inget i den här kategorin',
        ),
        bodyHtml: `<div class="empty-state empty-state--inset">${
          items.length === 0 ? 'Inga guider just nu' : 'Inget i den här kategorin'
        }</div>`,
      });
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
    const [guidesRes, priceRes, siteRes, contactsRes] = await Promise.all([
      fetch(ITEMS_API_URL),
      fetch(PRICE_LISTS_API_URL),
      fetch(SITE_CONTENT_API_URL),
      fetch(INFO_CONTACTS_API_URL),
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

    let infoContacts = [];
    if (contactsRes.ok) {
      try {
        const parsed = await contactsRes.json();
        infoContacts = Array.isArray(parsed?.items) ? parsed.items : [];
      } catch {
        infoContacts = [];
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
    window.__PUBLIC_APP_INFO_CONTACTS__ = infoContacts;
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
