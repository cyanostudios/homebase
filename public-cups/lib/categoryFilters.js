/**
 * Cupappen category token normalize + filter presence.
 * UMD: Jest (CommonJS) + browser global `CupappenCategoryFilters`.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.CupappenCategoryFilters = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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
    // Compact SvFF-style mixed youth codes (also F/P via slash split)
    fp: 'Flickor/Pojkar',
    pf: 'Flickor/Pojkar',
  };

  function decodeHtmlEntities(value) {
    return String(value || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  function normalizeText(value) {
    return decodeHtmlEntities(String(value || ''));
  }

  function mapCategoryWord(word) {
    const key = normalizeText(word).trim().toLowerCase();
    return CATEGORY_ALIASES[key] || word;
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
    // FP2013 / P2013-2019 / F12 — letter prefix + age/year (optional range)
    const prefixWithAge = compact.match(/^([A-Za-zÅÄÖåäö]+)\s*(\d[\d./\-]*)$/);
    if (prefixWithAge) {
      const mapped = mapCategoryWord(prefixWithAge[1]);
      return `${mapped} ${prefixWithAge[2]}`;
    }
    return mapCategoryWord(compact);
  }

  function categoryTokensFromText(categoriesText) {
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

  /** Explicit mix label or leftover compact FP/PF if alias missed. */
  function isMixedYouthToken(tokenLower) {
    const t = String(tokenLower || '')
      .trim()
      .toLowerCase();
    if (!t) return false;
    if (t === 'mix' || t === 'mixed' || t.startsWith('mix ')) return true;
    if (t === 'fp' || t === 'pf') return true;
    if (/^(fp|pf)\d/.test(t)) return true;
    if (/^(fp|pf)\s/.test(t)) return true;
    return false;
  }

  function getCategoryPresence(categoriesText) {
    const tokens = categoryTokensFromText(categoriesText).map((v) => v.toLowerCase());
    const hasMixed = tokens.some((t) => isMixedYouthToken(t));
    return {
      hasWomen: tokens.some((t) => t.startsWith('dam')),
      hasGirls: tokens.some((t) => t.startsWith('flickor')) || hasMixed,
      hasMen: tokens.some((t) => t.startsWith('herr')),
      hasBoys: tokens.some((t) => t.startsWith('pojkar')) || hasMixed,
      hasMixed,
    };
  }

  function matchesCategoryGroup(categoriesText, groupValue) {
    const presence = getCategoryPresence(categoriesText);
    if (groupValue === 'women') return presence.hasWomen;
    if (groupValue === 'girls') return presence.hasGirls;
    if (groupValue === 'men') return presence.hasMen;
    if (groupValue === 'boys') return presence.hasBoys;
    // Mix / "Flickor och Pojkar": both sides present (FP/PF sets both; or F+P classes)
    if (groupValue === 'girls_boys') return presence.hasGirls && presence.hasBoys;
    return true;
  }

  return {
    CATEGORY_ALIASES,
    mapCategoryWord,
    normalizeCategoryToken,
    categoryTokensFromText,
    getCategoryPresence,
    matchesCategoryGroup,
    isMixedYouthToken,
  };
});
