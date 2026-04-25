const API_BASE = window.PUBLIC_CUPS_API_BASE || window.location.origin;
const IS_LOCAL_PUBLIC_CUPS =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const CUPS_API_URL =
  window.PUBLIC_CUPS_API_URL ||
  (IS_LOCAL_PUBLIC_CUPS
    ? `${window.PUBLIC_CUPS_API_BASE || 'http://localhost:3002'}/api/public/cups`
    : `${API_BASE}/api/cups.php`);

const CATEGORY_ALIASES = {
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
};

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all', label: 'Alla klasser' },
  { value: 'women', label: 'Damer' },
  { value: 'girls', label: 'Flickor' },
  { value: 'men', label: 'Herrar' },
  { value: 'boys', label: 'Pojkar' },
  { value: 'girls_boys', label: 'Flickor och Pojkar' },
];

const state = {
  cups: [],
  activeCategory: 'all',
  selectedDateFilter: 'upcoming',
  selectedDistrict: 'all',
  districtOptions: [],
  selectedCategory: 'all',
};

/* ---- DOM refs ---- */
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const emptyEl = document.getElementById('empty');
const featuredSectionEl = document.getElementById('featured-section');
const featuredGridEl = document.getElementById('featured-grid');
const cupsGridEl = document.getElementById('cups-grid');
const searchShellEl = document.getElementById('listing-filter-shell');
const filterToggleBtnEl = document.getElementById('filter-toggle-btn');
const searchInputEl = document.getElementById('search-input');
const searchInputHeroEl = document.getElementById('search-input-hero');
const dateFilterEl = document.getElementById('date-filter');
const dateTriggerEl = document.getElementById('date-trigger');
const dateLabelEl = document.getElementById('date-label');
const dateMenuEl = document.getElementById('date-menu');
const categoryFilterEl = document.getElementById('category-filter');
const categoryTriggerEl = document.getElementById('category-trigger');
const categoryLabelEl = document.getElementById('category-label');
const categoryMenuEl = document.getElementById('category-menu');
const districtFilterEl = document.getElementById('district-filter');
const districtTriggerEl = document.getElementById('district-trigger');
const districtLabelEl = document.getElementById('district-label');
const districtMenuEl = document.getElementById('district-menu');
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
const clearFiltersBtnHeroEl = document.getElementById('clear-filters-btn-hero');
const breadcrumbsEl = document.getElementById('filter-breadcrumbs');
const footerYearEl = document.getElementById('footer-year');
const jsonLdEl = document.getElementById('cups-json-ld');
const searchBtnEl = document.getElementById('search-btn');
const clearFiltersBtnEl = document.getElementById('clear-filters-btn');
const featuredCupsGridEl = document.getElementById('featured-cups-grid');
const heroCupCountLineEl = document.getElementById('hero-cup-count-line');
const mobileFilterMedia = window.matchMedia('(max-width: 720px)');
let mobileFiltersCollapsed = true;

/* ================================================================
   BOOT
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  loadCups();
  initMobileMenu();
  initHeroSearch();
  initFAQ();
  initScrollReveal();
  if (footerYearEl) footerYearEl.textContent = String(new Date().getFullYear());
});

syncMobileFiltersUI();
if (filterToggleBtnEl) {
  filterToggleBtnEl.addEventListener('click', () => {
    mobileFiltersCollapsed = !mobileFiltersCollapsed;
    syncMobileFiltersUI();
  });
}
if (mobileFilterMedia) {
  mobileFilterMedia.addEventListener('change', () => {
    mobileFiltersCollapsed = mobileFilterMedia.matches;
    syncMobileFiltersUI();
  });
}
if (searchInputEl) {
  searchInputEl.addEventListener('input', () => {
    if (searchInputHeroEl) searchInputHeroEl.value = searchInputEl.value;
    renderFiltered();
  });
}
if (searchInputHeroEl) {
  searchInputHeroEl.addEventListener('input', () => {
    if (searchInputEl) searchInputEl.value = searchInputHeroEl.value;
    renderFiltered();
  });
}
if (dateTriggerEl) dateTriggerEl.addEventListener('click', () => toggleMenu('date'));
if (dateTriggerHeroEl) dateTriggerHeroEl.addEventListener('click', () => toggleMenu('dateHero'));
if (categoryTriggerEl) categoryTriggerEl.addEventListener('click', () => toggleMenu('category'));
if (categoryTriggerHeroEl)
  categoryTriggerHeroEl.addEventListener('click', () => toggleMenu('categoryHero'));
if (districtTriggerEl) districtTriggerEl.addEventListener('click', () => toggleMenu('district'));
if (heroDistrictTriggerEl)
  heroDistrictTriggerEl.addEventListener('click', () => toggleMenu('heroDistrict'));
document.addEventListener('click', (event) => {
  if (
    !dateFilterEl?.contains(event.target) &&
    !categoryFilterEl?.contains(event.target) &&
    !districtFilterEl?.contains(event.target) &&
    !dateFilterHeroEl?.contains(event.target) &&
    !categoryFilterHeroEl?.contains(event.target) &&
    !heroDistrictFilterEl?.contains(event.target)
  ) {
    closeAllMenus();
  }
});
if (searchBtnEl) {
  searchBtnEl.addEventListener('click', () => {
    renderFiltered();
    if (mobileFilterMedia.matches) {
      mobileFiltersCollapsed = true;
      syncMobileFiltersUI();
    }
  });
}
if (clearFiltersBtnEl) clearFiltersBtnEl.addEventListener('click', clearFilters);
if (clearFiltersBtnHeroEl) clearFiltersBtnHeroEl.addEventListener('click', clearFilters);

/* ================================================================
   MOBILE MENU
================================================================ */
function initMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const drawer = document.getElementById('mobile-drawer');
  if (!menuBtn || !drawer) return;

  menuBtn.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('is-open');
    menuBtn.setAttribute('aria-expanded', String(isOpen));
  });

  drawer.addEventListener('click', (e) => {
    if (e.target === drawer || e.target.tagName === 'A') {
      drawer.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
      drawer.classList.remove('is-open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ================================================================
   HERO SEARCH — scrolls to cup listing and optionally pre-fills search
================================================================ */
function initHeroSearch() {
  const heroBtn = document.getElementById('hero-search-btn');
  const cupListingSection = document.getElementById('cup-listing');

  function scrollToListing() {
    if (cupListingSection) {
      cupListingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (heroBtn) {
    heroBtn.addEventListener('click', () => {
      if (searchInputEl && searchInputHeroEl) {
        searchInputEl.value = searchInputHeroEl.value;
      }
      renderFiltered();
      scrollToListing();
    });
  }
}

/* ================================================================
   FAQ ACCORDION
================================================================ */
function initFAQ() {
  document.querySelectorAll('.faq-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const answerId = btn.getAttribute('aria-controls');
      const answer = answerId ? document.getElementById(answerId) : btn.nextElementSibling;
      if (!answer) return;
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      answer.dataset.open = String(!isOpen);
    });
  });
}

/* ================================================================
   SCROLL REVEAL (IntersectionObserver)
================================================================ */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  if (!('IntersectionObserver' in window)) {
    elements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -40px 0px' },
  );

  elements.forEach((el) => observer.observe(el));
}

/* ================================================================
   MOBILE FILTER SYNC
================================================================ */
function syncMobileFiltersUI() {
  if (!searchShellEl || !filterToggleBtnEl) return;
  if (mobileFilterMedia.matches) {
    filterToggleBtnEl.hidden = false;
    searchShellEl.classList.toggle('is-collapsed', mobileFiltersCollapsed);
    filterToggleBtnEl.textContent = mobileFiltersCollapsed ? 'Visa filter' : 'Dölj filter';
    filterToggleBtnEl.setAttribute('aria-expanded', mobileFiltersCollapsed ? 'false' : 'true');
    return;
  }
  filterToggleBtnEl.hidden = true;
  searchShellEl.classList.remove('is-collapsed');
  filterToggleBtnEl.setAttribute('aria-expanded', 'true');
}

/* ================================================================
   DATA FETCH
================================================================ */
/** Antal synliga cuper i API-svaret (alla, inte bara kommande / filtrerade i listan). */
function updateTotalCupCountsUI(total) {
  const n = Math.max(0, Number(total) || 0);
  const formatted = n.toLocaleString('sv-SE');
  if (heroCupCountLineEl) {
    heroCupCountLineEl.textContent =
      n === 1
        ? 'Ny säsong 2026 · 1 cup publicerad'
        : `Ny säsong 2026 · ${formatted} cuper publicerade`;
  }
}

async function loadCups() {
  showState('loading');
  try {
    const response = await fetch(CUPS_API_URL);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);

    const payload = await response.json();
    state.cups = Array.isArray(payload.cups)
      ? payload.cups.filter((cup) => cup?.visible !== false && cup?.visible !== 'false')
      : [];
    updateTotalCupCountsUI(state.cups.length);
    renderDateFilter(state.cups);
    renderCategoryFilter();
    renderDistrictFilter(state.cups);
    renderFiltered();
    renderFeaturedCupsSection();
  } catch (error) {
    console.error('Failed to load cups:', error);
    showState('error');
  }
}

/* Pil på “Till cupsidan” — samma i populära och listkort */
const CUP_CARD_CTA_ARROW_SVG =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

/* ================================================================
   FEATURED CUPS SECTION (top of page, card-style grid)
================================================================ */
function renderFeaturedCupsSection() {
  if (!featuredCupsGridEl) return;

  const cups = state.cups
    .filter((cup) => cup.featured === true || cup.featured === 'true')
    .sort((a, b) => compareByDate(a, b));

  const shown = cups.slice(0, 6);

  if (shown.length === 0) {
    featuredCupsGridEl.innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:var(--text-faint);padding:3rem 0;">Inga utvalda cuper just nu.</p>';
    return;
  }

  featuredCupsGridEl.innerHTML = shown.map((cup, i) => renderFeaturedCard(cup, i)).join('');
}

function renderFeaturedCard(cup, index) {
  const name = escapeHtml(normalizeText(cup.name) || 'Okänd cup');
  const location = normalizeText(cup.location);
  const dateRange = formatDateRange(cup.start_date, cup.end_date);
  const categories = normalizeText(cup.categories) || '';
  const categoriesTruncated = categories.length > 60 ? categories.slice(0, 57) + '…' : categories;
  const registerUrl = cup.registration_url
    ? escapeHtml(withCupappenUtm(cup.registration_url))
    : null;

  const presence = getCategoryPresence(categories);
  const primaryBadge =
    presence.hasBoys && presence.hasGirls
      ? 'Pojkar & Flickor'
      : presence.hasBoys
        ? 'Pojkar'
        : presence.hasGirls
          ? 'Flickor'
          : presence.hasWomen || presence.hasMen
            ? 'Senior'
            : categories.split(',')[0].trim();

  const heroImages = [
    'https://images.pexels.com/photos/47730/the-ball-stadion-football-the-pitch-47730.jpeg?w=640',
    'https://images.pexels.com/photos/274422/pexels-photo-274422.jpeg?w=640',
    'https://images.pexels.com/photos/1171084/pexels-photo-1171084.jpeg?w=640',
    'https://images.pexels.com/photos/186239/pexels-photo-186239.jpeg?w=640',
    'https://images.pexels.com/photos/1308713/pexels-photo-1308713.jpeg?w=640',
    'https://images.pexels.com/photos/3886384/pexels-photo-3886384.jpeg?w=640',
  ];
  const customSrc = safeImageSrc(cup.featured_image_url);
  const img = customSrc || heroImages[index % heroImages.length];

  return `
    <article class="cup-card" data-testid="featured-cup-card-${index}">
      <div class="cup-card__media">
        <img src="${img}" alt="${name}" loading="lazy" />
        ${primaryBadge ? `<div class="cup-card__accent"><span class="dot" aria-hidden="true"></span>${escapeHtml(primaryBadge)}</div>` : ''}
        <div class="cup-card__index">#${String(index + 1).padStart(2, '0')}</div>
      </div>
      <div class="cup-card__body">
        <div class="cup-card__meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>
          ${escapeHtml(location || 'Plats saknas')}
        </div>
        <h3 class="cup-card__title">${name}</h3>
        <div class="cup-card__date">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${escapeHtml(dateRange)}
        </div>
        ${categoriesTruncated ? `<div class="cup-card__badges"><span class="badge-brand">${escapeHtml(categoriesTruncated)}</span></div>` : ''}
        <div class="cup-card__footer">
          <div class="cup-card__users">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${cup.team_count ? `${cup.team_count} lag` : 'Anmälan öppen'}
          </div>
          ${
            registerUrl
              ? `<a class="cup-card__cta" href="${registerUrl}" target="_blank" rel="noopener noreferrer">Till cupsidan ${CUP_CARD_CTA_ARROW_SVG}</a>`
              : `<span class="cup-card__cta" style="cursor:default;">Info saknas</span>`
          }
        </div>
      </div>
    </article>
  `;
}

/* ================================================================
   FILTER RENDERING
================================================================ */
function renderDateFilter(cups) {
  if (!dateMenuEl && !dateMenuHeroEl) return;
  const previousValue = state.selectedDateFilter || 'upcoming';
  const months = new Set();
  cups.forEach((cup) => {
    const key = monthKeyFromCup(cup);
    if (key) months.add(key);
  });

  const ordered = Array.from(months).sort((a, b) => a.localeCompare(b, 'sv'));
  const options = [
    { value: 'upcoming', label: 'Kommande' },
    { value: 'all', label: 'Alla' },
    ...ordered.map((key) => ({ value: `month:${key}`, label: monthLabelFromKey(key) })),
  ];
  const hasPrevious = options.some((opt) => opt.value === previousValue);
  state.selectedDateFilter = hasPrevious ? previousValue : 'upcoming';
  const onDate = (value) => {
    state.selectedDateFilter = value;
    if (dateLabelEl) dateLabelEl.textContent = getDateLabel(value);
    if (dateLabelHeroEl) dateLabelHeroEl.textContent = getDateLabel(value);
    closeAllMenus();
    renderFiltered();
  };
  if (dateMenuEl) {
    renderCustomOptions(dateMenuEl, options, state.selectedDateFilter, onDate);
  }
  if (dateMenuHeroEl) {
    renderCustomOptions(dateMenuHeroEl, options, state.selectedDateFilter, onDate);
  }
  if (dateLabelEl) dateLabelEl.textContent = getDateLabel(state.selectedDateFilter);
  if (dateLabelHeroEl) dateLabelHeroEl.textContent = getDateLabel(state.selectedDateFilter);
}

function renderCategoryFilter() {
  if (!categoryMenuEl && !categoryMenuHeroEl) return;
  const options = CATEGORY_FILTER_OPTIONS;
  if (!options.some((opt) => opt.value === state.selectedCategory)) {
    state.selectedCategory = 'all';
  }
  const onCategory = (value) => {
    state.selectedCategory = value;
    if (categoryLabelEl) categoryLabelEl.textContent = getCategoryLabel(value);
    if (categoryLabelHeroEl) categoryLabelHeroEl.textContent = getCategoryLabel(value);
    closeAllMenus();
    renderFiltered();
  };
  if (categoryMenuEl) {
    renderCustomOptions(categoryMenuEl, options, state.selectedCategory, onCategory);
  }
  if (categoryMenuHeroEl) {
    renderCustomOptions(categoryMenuHeroEl, options, state.selectedCategory, onCategory);
  }
  if (categoryLabelEl) categoryLabelEl.textContent = getCategoryLabel(state.selectedCategory);
  if (categoryLabelHeroEl)
    categoryLabelHeroEl.textContent = getCategoryLabel(state.selectedCategory);
}

function renderDistrictFilter(cups) {
  if (!districtMenuEl && !heroDistrictMenuEl) return;
  const districts = new Set();
  cups.forEach((cup) => {
    const district = normalizeText(cup.ingest_source_name).trim();
    if (district) districts.add(district);
  });

  const ordered = Array.from(districts).sort((a, b) => a.localeCompare(b, 'sv'));
  state.districtOptions = ordered;
  if (state.selectedDistrict !== 'all' && !ordered.includes(state.selectedDistrict)) {
    state.selectedDistrict = 'all';
  }

  const options = [
    { value: 'all', label: 'Alla distrikt' },
    ...ordered.map((district) => ({ value: district, label: district })),
  ];
  const onDistrictChange = (value) => {
    state.selectedDistrict = value;
    if (districtLabelEl) districtLabelEl.textContent = getDistrictLabel(value);
    if (heroDistrictLabelEl) heroDistrictLabelEl.textContent = getDistrictLabel(value);
    closeAllMenus();
    renderFiltered();
  };
  if (districtMenuEl) {
    renderCustomOptions(districtMenuEl, options, state.selectedDistrict, onDistrictChange);
  }
  if (heroDistrictMenuEl) {
    renderCustomOptions(heroDistrictMenuEl, options, state.selectedDistrict, onDistrictChange);
  }
  if (districtLabelEl) districtLabelEl.textContent = getDistrictLabel(state.selectedDistrict);
  if (heroDistrictLabelEl)
    heroDistrictLabelEl.textContent = getDistrictLabel(state.selectedDistrict);
}

/* ================================================================
   MAIN FILTER + RENDER
================================================================ */
function renderFiltered() {
  const query = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';
  const dateFilterValue = state.selectedDateFilter || 'upcoming';
  const selectedCategory = state.selectedCategory || 'all';
  const selectedDistrict = state.selectedDistrict || 'all';
  const now = new Date();

  const featured = state.cups
    .filter((cup) => cup.featured === true || cup.featured === 'true')
    .sort((a, b) => compareByDate(a, b));

  const regular = state.cups
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
        districtText.toLowerCase().trim() === selectedDistrict.toLowerCase();
      const matchesDate = cupMatchesDateFilter(cup, dateFilterValue, now);
      return matchesText && matchesCategory && matchesDistrict && matchesDate;
    })
    .sort((a, b) => compareByDate(a, b));

  if (breadcrumbsEl) {
    const categoryLabel = getCategoryLabel(selectedCategory);
    const districtLabel = getDistrictLabel(selectedDistrict);
    const line = `${categoryLabel} - ${districtLabel} - ${regular.length}`;
    const textEl = breadcrumbsEl.querySelector('.filter-breadcrumbs__text');
    if (textEl) textEl.textContent = line;
  }
  renderCups(featured, regular);
  renderJsonLd([...featured, ...regular]);
}

function renderCups(featured, regular) {
  if (featured.length === 0 && regular.length === 0) {
    if (featuredSectionEl) featuredSectionEl.hidden = true;
    if (featuredGridEl) featuredGridEl.innerHTML = '';
    cupsGridEl.hidden = true;
    showState('empty');
    return;
  }

  hideStates();

  if (featuredSectionEl && featuredGridEl) {
    if (featured.length > 0) {
      featuredSectionEl.hidden = false;
      featuredGridEl.innerHTML = featured.map((cup) => renderCupCard(cup)).join('');
    } else {
      featuredSectionEl.hidden = true;
      featuredGridEl.innerHTML = '';
    }
  }

  cupsGridEl.hidden = false;
  cupsGridEl.innerHTML = regular.map((cup) => renderCupCard(cup)).join('');
}

/* Ikoner (samma som renderFeaturedCard) */
const CUP_CARD_PIN_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 22s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';
const CUP_CARD_CAL_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

/**
 * Listning & “utvalda” i cupdatabasen: samma kortyta som Populära cuper (ingen bild här; bild endast i toppsektionen).
 */
function renderCupCard(cup) {
  const name = escapeHtml(normalizeText(cup.name) || 'Okänd cup');
  const location = normalizeText(cup.location);
  const dateRange = formatDateRange(cup.start_date, cup.end_date);
  const categories = normalizeText(cup.categories) || '';
  const organizerText = normalizeText(cup.organizer);
  const districtText = normalizeText(cup.ingest_source_name).trim();
  const organizerLine = organizerText
    ? districtText
      ? `${escapeHtml(organizerText)} · ${escapeHtml(districtText)}`
      : escapeHtml(organizerText)
    : districtText
      ? `Arrangör saknas · ${escapeHtml(districtText)}`
      : 'Arrangör saknas';

  const descRaw = (cup.description || '').trim();
  const descriptionHtml = descRaw
    ? escapeHtml(decodeHtmlEntities(descRaw))
    : '<span class="cup-card__desc-empty">Ingen beskrivning tillgänglig.</span>';

  const meta = [
    metaPill('ball', normalizeText(cup.match_format), !!normalizeText(cup.match_format)),
    metaPill(
      'shield',
      cup.sanctioned === false || cup.sanctioned === 'false' ? 'Ej sanktionerad' : 'Sanktionerad',
      true,
      'meta-pill-plain',
    ),
  ]
    .filter(Boolean)
    .join('');

  const categoriesBlock = categories
    ? `<div class="cup-card__badges"><span class="badge-brand cup-card__categories-line">${escapeHtml(
        categories,
      )}</span></div>`
    : '';

  const registerUrl = cup.registration_url
    ? escapeHtml(withCupappenUtm(cup.registration_url))
    : null;
  const register = registerUrl
    ? `<a class="cup-card__cta" href="${registerUrl}" target="_blank" rel="noopener noreferrer">Till cupsidan ${CUP_CARD_CTA_ARROW_SVG}</a>`
    : `<span class="cup-card__cta" style="cursor:default;">Info saknas</span>`;

  const accentClass = accentClassForCup(cup);
  const hiddenFromPublic =
    cup.visible === false || cup.visible === 'false'
      ? '<p class="cup-card__visibility-hint" role="status">Inte synlig i publik listning</p>'
      : '';

  return `
    <article class="cup-card cup-card--listing ${accentClass}" data-testid="cup-listing-card">
      <div class="cup-card__body">
        <div class="cup-card__meta">
          ${CUP_CARD_PIN_SVG}
          ${escapeHtml(location || 'Plats saknas')}
        </div>
        <h3 class="cup-card__title">${name}</h3>
        <p class="cup-card__organizer">${organizerLine}</p>
        <div class="cup-card__date">
          ${CUP_CARD_CAL_SVG}
          ${escapeHtml(dateRange)}
        </div>
        ${categoriesBlock}
        <div class="meta-pills cup-card__meta-pills">${meta}</div>
        <div class="cup-card__listing-desc">${descriptionHtml}</div>
        ${hiddenFromPublic}
        <div class="cup-card__footer">
          <div class="cup-card__users">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            ${
              cup.team_count !== null && cup.team_count !== undefined
                ? `${cup.team_count} lag`
                : 'Anmälan öppen'
            }
          </div>
          ${register}
        </div>
      </div>
    </article>
  `;
}

/* ================================================================
   HELPERS — pills, icons, dates
================================================================ */
function metaPill(icon, text, visible, variantClass = '') {
  if (!visible || !text) return '';
  const cls = variantClass ? `meta-pill ${variantClass}` : 'meta-pill';
  return `<span class="${cls}">${iconSvg(icon)}${escapeHtml(text)}</span>`;
}

function iconSvg(name) {
  const icons = {
    calendar:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>',
    pin: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-5.6 7-12a7 7 0 1 0-14 0c0 6.4 7 12 7 12z"></path><circle cx="12" cy="10" r="2.5"></circle></svg>',
    group:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"></circle><circle cx="17" cy="9" r="2"></circle><path d="M3 19c0-3.3 2.7-6 6-6s6 2.7 6 6"></path><path d="M15 19c0-2.1 1.7-3.9 3.8-3.9 1 0 2 .4 2.7 1.1"></path></svg>',
    ball: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"></circle><path d="M8 7l4-3 4 3 1 4-3 3h-4l-3-3z"></path><path d="M5 11l3 3-1 4m12-7-3 3 1 4M10 14l-2 5m8-5 2 5"></path></svg>',
    tag: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10l-8.5 8.5a2 2 0 0 1-2.8 0L3 13V3h10l7 7z"></path><circle cx="7.5" cy="7.5" r="1"></circle></svg>',
    person:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"></circle><path d="M4 20c1.5-3.5 4-5 8-5s6.5 1.5 8 5"></path></svg>',
    file: '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6"></path></svg>',
    shield:
      '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v6c0 5-3.5 8.7-7 10-3.5-1.3-7-5-7-10V6z"></path><path d="m9 12 2 2 4-4"></path></svg>',
  };
  return icons[name] || '';
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return 'Datum saknas';
  const start = startDate ? formatDate(startDate) : '';
  const end = endDate ? formatDate(endDate) : '';
  if (start && end && start !== end) return `${start} - ${end}`;
  return start || end;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function isUpcoming(cup, now) {
  const compare = cup.end_date || cup.start_date;
  if (!compare) return true;
  const date = new Date(compare);
  if (Number.isNaN(date.getTime())) return true;
  return date >= now;
}

function cupMatchesDateFilter(cup, dateFilterValue, now) {
  if (dateFilterValue === 'all') return true;
  if (dateFilterValue === 'upcoming') return isUpcoming(cup, now);
  if (!String(dateFilterValue).startsWith('month:')) return true;

  const monthKey = String(dateFilterValue).slice('month:'.length);
  const startDate = parseCupDate(cup.start_date);
  const endDate = parseCupDate(cup.end_date) || startDate;
  if (!startDate && !endDate) return false;

  const first = startDate || endDate;
  const last = endDate || startDate;
  if (!first || !last) return false;

  const monthStart = new Date(`${monthKey}-01T00:00:00`);
  if (Number.isNaN(monthStart.getTime())) return true;
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return first <= monthEnd && last >= monthStart;
}

function parseCupDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthKeyFromCup(cup) {
  const date = parseCupDate(cup.start_date) || parseCupDate(cup.end_date);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function monthLabelFromKey(key) {
  const date = new Date(`${key}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
}

function compareByDate(a, b) {
  const aDate = new Date(a.start_date || a.end_date || '9999-12-31');
  const bDate = new Date(b.start_date || b.end_date || '9999-12-31');
  const aTs = Number.isNaN(aDate.getTime()) ? Number.MAX_SAFE_INTEGER : aDate.getTime();
  const bTs = Number.isNaN(bDate.getTime()) ? Number.MAX_SAFE_INTEGER : bDate.getTime();
  if (aTs !== bTs) return aTs - bTs;
  return String(a.name || '').localeCompare(String(b.name || ''), 'sv');
}

function jsonLdEventItem(cup) {
  const regAbs = toAbsolutePublicUrl(cup.registration_url);
  const regWithUtm = regAbs ? withCupappenUtm(regAbs) : '';
  const imageAbs = toAbsolutePublicUrl(cup.featured_image_url);
  const image = imageAbs || undefined;
  return {
    '@type': 'Event',
    '@id': `https://cupappen.se/#event-${String(cup.id || '')}`,
    name: normalizeText(cup.name) || 'Cup',
    eventStatus: 'https://schema.org/EventScheduled',
    startDate: cup.start_date || undefined,
    endDate: cup.end_date || undefined,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    image: image || undefined,
    location: cup.location
      ? {
          '@type': 'Place',
          name: normalizeText(cup.location),
        }
      : undefined,
    organizer: cup.organizer
      ? {
          '@type': 'Organization',
          name: normalizeText(cup.organizer),
        }
      : undefined,
    url: regWithUtm || undefined,
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

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: unique.map((cup, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: jsonLdEventItem(cup),
    })),
  };
  if (jsonLdEl) jsonLdEl.textContent = JSON.stringify(itemList);
}

/* ================================================================
   STATE HELPERS
================================================================ */
function showState(type) {
  hideStates();
  loadingEl.hidden = type !== 'loading';
  errorEl.hidden = type !== 'error';
  emptyEl.hidden = type !== 'empty';
  cupsGridEl.hidden = true;
}

function hideStates() {
  loadingEl.hidden = true;
  errorEl.hidden = true;
  emptyEl.hidden = true;
}

function clearFilters() {
  if (searchInputEl) searchInputEl.value = '';
  if (searchInputHeroEl) searchInputHeroEl.value = '';
  state.selectedDateFilter = 'upcoming';
  state.selectedCategory = 'all';
  state.selectedDistrict = 'all';
  if (dateLabelEl) dateLabelEl.textContent = getDateLabel('upcoming');
  if (dateLabelHeroEl) dateLabelHeroEl.textContent = getDateLabel('upcoming');
  if (categoryLabelEl) categoryLabelEl.textContent = getCategoryLabel('all');
  if (categoryLabelHeroEl) categoryLabelHeroEl.textContent = getCategoryLabel('all');
  if (districtLabelEl) districtLabelEl.textContent = getDistrictLabel('all');
  if (heroDistrictLabelEl) heroDistrictLabelEl.textContent = getDistrictLabel('all');
  closeAllMenus();
  refreshCustomOptionSelections();
  renderFiltered();
}

function createCustomOptionButton(value, label, isSelected, onSelect) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'custom-option';
  btn.setAttribute('data-value', value);
  btn.textContent = label;
  btn.classList.toggle('is-selected', isSelected);
  btn.addEventListener('click', () => onSelect(value));
  return btn;
}

function renderCustomOptions(menuEl, options, selectedValue, onSelect) {
  menuEl.innerHTML = '';
  options.forEach((option) => {
    menuEl.appendChild(
      createCustomOptionButton(
        option.value,
        option.label,
        option.value === selectedValue,
        onSelect,
      ),
    );
  });
}

function refreshCustomOptionSelections() {
  if (dateMenuEl) {
    dateMenuEl.querySelectorAll('.custom-option').forEach((el) => {
      el.classList.toggle(
        'is-selected',
        el.getAttribute('data-value') === state.selectedDateFilter,
      );
    });
  }
  if (categoryMenuEl) {
    categoryMenuEl.querySelectorAll('.custom-option').forEach((el) => {
      el.classList.toggle('is-selected', el.getAttribute('data-value') === state.selectedCategory);
    });
  }
  if (districtMenuEl) {
    districtMenuEl.querySelectorAll('.custom-option').forEach((el) => {
      el.classList.toggle('is-selected', el.getAttribute('data-value') === state.selectedDistrict);
    });
  }
  if (heroDistrictMenuEl) {
    heroDistrictMenuEl.querySelectorAll('.custom-option').forEach((el) => {
      el.classList.toggle('is-selected', el.getAttribute('data-value') === state.selectedDistrict);
    });
  }
  if (dateMenuHeroEl) {
    dateMenuHeroEl.querySelectorAll('.custom-option').forEach((el) => {
      el.classList.toggle(
        'is-selected',
        el.getAttribute('data-value') === state.selectedDateFilter,
      );
    });
  }
  if (categoryMenuHeroEl) {
    categoryMenuHeroEl.querySelectorAll('.custom-option').forEach((el) => {
      el.classList.toggle('is-selected', el.getAttribute('data-value') === state.selectedCategory);
    });
  }
}

function getDateLabel(value) {
  if (value === 'upcoming') return 'Kommande';
  if (value === 'all') return 'Alla';
  if (String(value).startsWith('month:'))
    return monthLabelFromKey(String(value).slice('month:'.length));
  return 'Kommande';
}

function getCategoryLabel(value) {
  const option = CATEGORY_FILTER_OPTIONS.find((opt) => opt.value === value);
  return option?.label || 'Alla klasser';
}

function getDistrictLabel(value) {
  if (value === 'all') return 'Alla distrikt';
  return value || 'Alla distrikt';
}

function toggleMenu(kind) {
  const map = {
    date: { trigger: dateTriggerEl, menu: dateMenuEl },
    dateHero: { trigger: dateTriggerHeroEl, menu: dateMenuHeroEl },
    category: { trigger: categoryTriggerEl, menu: categoryMenuEl },
    categoryHero: { trigger: categoryTriggerHeroEl, menu: categoryMenuHeroEl },
    district: { trigger: districtTriggerEl, menu: districtMenuEl },
    heroDistrict: { trigger: heroDistrictTriggerEl, menu: heroDistrictMenuEl },
  };
  const current = map[kind];
  if (!current?.trigger || !current?.menu) return;
  const willOpen = current.trigger.getAttribute('aria-expanded') !== 'true';
  closeAllMenus();
  current.trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  current.menu.hidden = !willOpen;
}

function closeAllMenus() {
  [
    dateTriggerEl,
    dateTriggerHeroEl,
    categoryTriggerEl,
    categoryTriggerHeroEl,
    districtTriggerEl,
    heroDistrictTriggerEl,
  ].forEach((trigger) => trigger?.setAttribute('aria-expanded', 'false'));
  [
    dateMenuEl,
    dateMenuHeroEl,
    categoryMenuEl,
    categoryMenuHeroEl,
    districtMenuEl,
    heroDistrictMenuEl,
  ].forEach((menu) => {
    if (menu) menu.hidden = true;
  });
}

/* ================================================================
   STRING UTILS
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

/** Tillåt endast http(s) eller rot-relativa URL:er; säker för dubbelcitat-attribut. */
function safeImageSrc(url) {
  const u = normalizeText(url).trim();
  if (!u) return '';
  if (!(u.startsWith('https://') || u.startsWith('http://') || u.startsWith('/'))) return '';
  return u.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function normalizeCategoryToken(token) {
  const raw = normalizeText(token).trim();
  if (!raw) return '';

  if (raw.includes('/')) {
    const slashParts = raw
      .split('/')
      .map((part) => normalizeCategoryToken(part))
      .filter(Boolean);
    return slashParts.join('/');
  }

  const compact = raw.replace(/\s+/g, ' ').trim();
  const prefixWithAge = compact.match(/^([A-Za-zÅÄÖåäö]+)\s*(\d+)$/);
  if (prefixWithAge) {
    const mapped = mapCategoryWord(prefixWithAge[1]);
    return `${mapped} ${prefixWithAge[2]}`;
  }
  return mapCategoryWord(compact);
}

function mapCategoryWord(word) {
  const key = normalizeText(word).trim().toLowerCase();
  return CATEGORY_ALIASES[key] || word;
}

function categoryTokensFromText(categoriesText) {
  return String(categoriesText || '')
    .split(',')
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
  const tokens = categoryTokensFromText(categoriesText).map((v) => v.toLowerCase());
  return {
    hasWomen: tokens.some((t) => t.startsWith('dam')),
    hasGirls: tokens.some((t) => t.startsWith('flickor')),
    hasMen: tokens.some((t) => t.startsWith('herr')),
    hasBoys: tokens.some((t) => t.startsWith('pojkar')),
  };
}

function matchesCategoryGroup(categoriesText, groupValue) {
  const presence = getCategoryPresence(categoriesText);
  if (groupValue === 'women') return presence.hasWomen;
  if (groupValue === 'girls') return presence.hasGirls;
  if (groupValue === 'men') return presence.hasMen;
  if (groupValue === 'boys') return presence.hasBoys;
  if (groupValue === 'girls_boys') return presence.hasGirls || presence.hasBoys;
  return true;
}

/** Outbound links from Cupappen always attribute traffic with utm_source=cupappen. */
function withCupappenUtm(urlValue) {
  const raw = String(urlValue || '').trim();
  if (!raw) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    url.searchParams.set('utm_source', 'cupappen');
    return url.toString();
  } catch {
    let out = String(raw);
    if (/[?&]utm_source=/i.test(out)) {
      out = out.replace(/([?&])utm_source=[^&]*/i, '$1utm_source=cupappen');
      return out.replace('?&', '?');
    }
    return `${out}${out.includes('?') ? '&' : '?'}utm_source=cupappen`;
  }
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

function accentClassForCup(cup) {
  const hasRegistrationUrl = !!String(cup?.registration_url || '').trim();
  const hasLocation = !!String(cup?.location || '').trim();
  if (hasRegistrationUrl && hasLocation) return 'accent-green';
  if (hasRegistrationUrl || hasLocation) return 'accent-blue';
  return 'accent-amber';
}
