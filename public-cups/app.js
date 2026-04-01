const API_BASE = window.PUBLIC_CUPS_API_BASE || window.location.origin;

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

const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const emptyEl = document.getElementById('empty');
const featuredSectionEl = document.getElementById('featured-section');
const featuredGridEl = document.getElementById('featured-grid');
const cupsGridEl = document.getElementById('cups-grid');
const searchShellEl = document.querySelector('.search-shell');
const filterToggleBtnEl = document.getElementById('filter-toggle-btn');
const searchInputEl = document.getElementById('search-input');
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
const breadcrumbsEl = document.getElementById('filter-breadcrumbs');
const footerYearEl = document.getElementById('footer-year');
const jsonLdEl = document.getElementById('cups-json-ld');
const searchBtnEl = document.getElementById('search-btn');
const clearFiltersBtnEl = document.getElementById('clear-filters-btn');
const mobileFilterMedia = window.matchMedia('(max-width: 720px)');
let mobileFiltersCollapsed = true;

document.addEventListener('DOMContentLoaded', loadCups);
if (footerYearEl) footerYearEl.textContent = String(new Date().getFullYear());
syncMobileFiltersUI();
if (filterToggleBtnEl) {
  filterToggleBtnEl.addEventListener('click', () => {
    mobileFiltersCollapsed = !mobileFiltersCollapsed;
    syncMobileFiltersUI();
  });
}
if (mobileFilterMedia) {
  mobileFilterMedia.addEventListener('change', () => {
    if (!mobileFilterMedia.matches) {
      mobileFiltersCollapsed = false;
    } else {
      mobileFiltersCollapsed = true;
    }
    syncMobileFiltersUI();
  });
}
searchInputEl.addEventListener('input', renderFiltered);
if (dateTriggerEl) {
  dateTriggerEl.addEventListener('click', () => toggleMenu('date'));
}
if (categoryTriggerEl) {
  categoryTriggerEl.addEventListener('click', () => toggleMenu('category'));
}
if (districtTriggerEl) {
  districtTriggerEl.addEventListener('click', () => toggleMenu('district'));
}
document.addEventListener('click', (event) => {
  if (
    !dateFilterEl?.contains(event.target) &&
    !categoryFilterEl?.contains(event.target) &&
    !districtFilterEl?.contains(event.target)
  ) {
    closeAllMenus();
  }
});
if (searchBtnEl) searchBtnEl.addEventListener('click', renderFiltered);
if (clearFiltersBtnEl) clearFiltersBtnEl.addEventListener('click', clearFilters);

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

async function loadCups() {
  showState('loading');
  try {
    const response = await fetch(`${API_BASE}/api/cups.php`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);

    const payload = await response.json();
    state.cups = Array.isArray(payload.cups)
      ? payload.cups.filter((cup) => cup?.visible !== false && cup?.visible !== 'false')
      : [];
    renderDateFilter(state.cups);
    renderCategoryFilter(state.cups);
    renderDistrictFilter(state.cups);
    renderFiltered();
  } catch (error) {
    console.error('Failed to load cups:', error);
    showState('error');
  }
}

function renderDateFilter(cups) {
  if (!dateMenuEl || !dateLabelEl) return;
  const previousValue = state.selectedDateFilter || 'upcoming';
  const months = new Set();
  cups.forEach((cup) => {
    const key = monthKeyFromCup(cup);
    if (key) {
      months.add(key);
    }
  });

  const ordered = Array.from(months).sort((a, b) => a.localeCompare(b, 'sv'));
  const options = [
    { value: 'upcoming', label: 'Kommande' },
    { value: 'all', label: 'Alla' },
    ...ordered.map((key) => ({ value: `month:${key}`, label: monthLabelFromKey(key) })),
  ];
  const hasPrevious = options.some((opt) => opt.value === previousValue);
  state.selectedDateFilter = hasPrevious ? previousValue : 'upcoming';
  renderCustomOptions(dateMenuEl, options, state.selectedDateFilter, (value) => {
    state.selectedDateFilter = value;
    if (dateLabelEl) dateLabelEl.textContent = getDateLabel(value);
    closeAllMenus();
    renderFiltered();
  });
  dateLabelEl.textContent = getDateLabel(state.selectedDateFilter);
}

function renderCategoryFilter(cups) {
  if (!categoryMenuEl || !categoryLabelEl) return;
  const options = CATEGORY_FILTER_OPTIONS;
  if (!options.some((opt) => opt.value === state.selectedCategory)) {
    state.selectedCategory = 'all';
  }
  renderCustomOptions(categoryMenuEl, options, state.selectedCategory, (value) => {
    state.selectedCategory = value;
    if (categoryLabelEl) categoryLabelEl.textContent = getCategoryLabel(value);
    closeAllMenus();
    renderFiltered();
  });
  categoryLabelEl.textContent = getCategoryLabel(state.selectedCategory);
}

function renderFiltered() {
  const query = searchInputEl.value.trim().toLowerCase();
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
    breadcrumbsEl.textContent = `${categoryLabel} - ${districtLabel} - ${regular.length}`;
  }
  renderCups(featured, regular);
  renderJsonLd([...featured, ...regular]);
}

function renderDistrictFilter(cups) {
  if (!districtMenuEl || !districtLabelEl) return;
  const districts = new Set();
  cups.forEach((cup) => {
    const district = normalizeText(cup.ingest_source_name).trim();
    if (district) {
      districts.add(district);
    }
  });

  const ordered = Array.from(districts).sort((a, b) => a.localeCompare(b, 'sv'));
  state.districtOptions = ordered;
  if (state.selectedDistrict !== 'all' && !ordered.includes(state.selectedDistrict)) {
    state.selectedDistrict = 'all';
  }

  renderCustomOptions(
    districtMenuEl,
    [
      { value: 'all', label: 'Alla distrikt' },
      ...ordered.map((district) => ({ value: district, label: district })),
    ],
    state.selectedDistrict,
    (value) => {
      state.selectedDistrict = value;
      if (districtLabelEl) districtLabelEl.textContent = getDistrictLabel(value);
      closeAllMenus();
      renderFiltered();
    },
  );
  districtLabelEl.textContent = getDistrictLabel(state.selectedDistrict);
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

function renderCupCard(cup) {
  const organizerText = normalizeText(cup.organizer);
  const organizer = organizerText ? `Arrangör: ${escapeHtml(organizerText)}` : 'Arrangör saknas';
  const descriptionRaw = decodeHtmlEntities((cup.description || '').slice(0, 220));
  const description = escapeHtml(descriptionRaw || 'Ingen beskrivning tillgänglig.');
  const meta = [
    metaPill('pin', normalizeText(cup.location), !!cup.location),
    metaPill(
      'calendar',
      formatDateRange(cup.start_date, cup.end_date),
      !!(cup.start_date || cup.end_date),
    ),
    metaPill('ball', normalizeText(cup.match_format), !!cup.match_format),
    metaPill(
      'group',
      `${cup.team_count} lag`,
      cup.team_count !== null && cup.team_count !== undefined,
    ),
    metaPill(
      'shield',
      cup.sanctioned === false || cup.sanctioned === 'false' ? 'Ej sanktionerad' : 'Sanktionerad',
      true,
      'meta-pill-plain',
    ),
  ]
    .filter(Boolean)
    .join('');

  const register = cup.registration_url
    ? `<a class="register-link" href="${escapeHtml(withCupappenUtm(cup.registration_url))}" target="_blank" rel="noopener noreferrer">${iconSvg('file')}Till cupsidan</a>`
    : '';

  const accentClass = accentById(cup.id);

  return `
    <article class="cup-card ${accentClass}">
      <div class="cup-main">
        <div>
          <h2 class="cup-title">${escapeHtml(normalizeText(cup.name) || 'Okänd cup')}</h2>
          <p class="cup-subtitle">${organizer}</p>
        </div>
        <p class="cup-description">${description}</p>
        <div class="meta-pills">${meta}</div>
      </div>
      <aside class="cup-action">
        <div class="action-details">
          <div class="action-row">
            <p class="deadline-label">Cupdatum</p>
            <p class="deadline-value">${escapeHtml(formatDate(cup.start_date || cup.end_date || '—'))}</p>
          </div>
          <div class="action-row">
            <p class="deadline-label">Plats</p>
            <p class="action-value">${escapeHtml(normalizeText(cup.location) || '—')}</p>
          </div>
          <div class="action-row">
            <p class="deadline-label">Klasser</p>
            <p class="action-categories">${escapeHtml(normalizeText(cup.categories) || '—')}</p>
          </div>
        </div>
        ${register}
      </aside>
    </article>
  `;
}

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
      item: {
        '@type': 'Event',
        name: normalizeText(cup.name) || 'Cup',
        startDate: cup.start_date || undefined,
        endDate: cup.end_date || undefined,
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
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
        url: toAbsolutePublicUrl(cup.registration_url) || undefined,
        description: normalizeText(cup.description || cup.categories) || undefined,
        isAccessibleForFree: true,
      },
    })),
  };
  jsonLdEl.textContent = JSON.stringify(itemList);
}

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
  searchInputEl.value = '';
  state.selectedDateFilter = 'upcoming';
  state.selectedCategory = 'all';
  state.selectedDistrict = 'all';
  if (dateLabelEl) dateLabelEl.textContent = getDateLabel('upcoming');
  if (categoryLabelEl) categoryLabelEl.textContent = getCategoryLabel('all');
  if (districtLabelEl) districtLabelEl.textContent = getDistrictLabel('all');
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
  btn.addEventListener('click', () => {
    onSelect(value);
  });
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
    category: { trigger: categoryTriggerEl, menu: categoryMenuEl },
    district: { trigger: districtTriggerEl, menu: districtMenuEl },
  };
  const current = map[kind];
  if (!current?.trigger || !current?.menu) return;
  const willOpen = current.trigger.getAttribute('aria-expanded') !== 'true';
  closeAllMenus();
  current.trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  current.menu.hidden = !willOpen;
}

function closeAllMenus() {
  [dateTriggerEl, categoryTriggerEl, districtTriggerEl].forEach((trigger) =>
    trigger?.setAttribute('aria-expanded', 'false'),
  );
  [dateMenuEl, categoryMenuEl, districtMenuEl].forEach((menu) => {
    if (menu) menu.hidden = true;
  });
}

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

function withCupappenUtm(urlValue) {
  const raw = String(urlValue || '').trim();
  if (!raw) return raw;
  try {
    const url = new URL(raw);
    if (!url.searchParams.has('utm_source')) {
      url.searchParams.set('utm_source', 'cupappen');
    }
    return url.toString();
  } catch {
    const join = raw.includes('?') ? '&' : '?';
    return `${raw}${join}utm_source=cupappen`;
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

function accentById(id) {
  const n = Number.parseInt(String(id || '0'), 10);
  if (Number.isNaN(n)) return '';
  const mod = Math.abs(n % 3);
  if (mod === 0) return 'accent-green';
  if (mod === 1) return 'accent-blue';
  return 'accent-amber';
}
