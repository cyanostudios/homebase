/**
 * Domain-owned cup parser. Ingest supplies full `bodyText`; this module extracts cup rows.
 * Profiles: Stockholm PDF table, Skåne/SVFF accordion, Småland-style label lists, then single-page fallback.
 *
 * @param {{ html: string, sourceUrl?: string, sourceType?: string }} input
 * @returns {Array<Record<string, unknown>>}
 */

/** @typedef {'skane_accordion' | 'smaland_label_list' | 'stockholm_pdf_table' | null} CupSourceProfile */

/** Default calendar year for Stockholm PDF day/month-only dates (conservative; year rarely appears in cells). */
const STOCKHOLM_PDF_DEFAULT_YEAR = new Date().getFullYear();

/**
 * True when body text looks like the Stockholm district PDF cup table.
 * @param {string} text
 * @param {string|undefined|null} sourceUrl
 * @param {string|undefined|null} sourceType
 */
function looksLikeStockholmPdfTable(text, sourceUrl, sourceType) {
  if (!text || typeof text !== 'string') {
    return false;
  }
  const hasCupens = /\bCupens namn\b/i.test(text);
  if (!hasCupens) {
    return false;
  }
  const hasArrangor = /\bArrangör\b/i.test(text);
  const hasDatum = /\bDatum\b/i.test(text);
  const hasLinkCol = /Länk till hemsida/i.test(text);
  const st = String(sourceType || '')
    .trim()
    .toLowerCase();
  let url = '';
  try {
    if (sourceUrl && typeof sourceUrl === 'string') {
      url = new URL(sourceUrl).hostname.toLowerCase();
    }
  } catch {
    url = String(sourceUrl || '').toLowerCase();
  }
  const stockholmHost = /stockholm|sff\.se|stockholms|stff\b/i.test(url);

  if (st === 'pdf' && (hasArrangor || hasDatum || hasLinkCol)) {
    return true;
  }
  if (stockholmHost && hasArrangor) {
    return true;
  }
  if (hasCupens && hasLinkCol && hasArrangor) {
    return true;
  }
  return false;
}

/**
 * Pick parser profile from HTML (or PDF text) / URL / source type.
 * Stockholm PDF is checked before HTML layouts when markers match.
 * @param {string} html
 * @param {string|undefined|null} sourceUrl
 * @param {string|undefined|null} [sourceType]
 * @returns {CupSourceProfile}
 */
function detectCupSourceProfile(html, sourceUrl, sourceType) {
  if (!html || typeof html !== 'string') {
    return null;
  }

  if (looksLikeStockholmPdfTable(html, sourceUrl, sourceType)) {
    return 'stockholm_pdf_table';
  }

  let host = '';
  try {
    if (sourceUrl && typeof sourceUrl === 'string') {
      host = new URL(sourceUrl).hostname.toLowerCase();
    }
  } catch {
    host = '';
  }

  const hasSkaneAccordion =
    html.includes('<div class="accordion__item">') ||
    (html.includes('accordion__item') && html.includes('accordion__content'));

  if (hasSkaneAccordion) {
    return 'skane_accordion';
  }

  const isSmalandHost = /(^|\.)smalandboll\.se$/i.test(host);
  const hasSmalandStyleMarkers =
    /\bTävlingens namn\s*:/i.test(html) ||
    (/\bÅlder\s*:/i.test(html) && /\bArrangör\s*:/i.test(html));

  if (isSmalandHost || hasSmalandStyleMarkers) {
    return 'smaland_label_list';
  }

  return null;
}

function parseCupSource({ html, sourceUrl, sourceType }) {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const profile = detectCupSourceProfile(html, sourceUrl, sourceType);

  if (profile === 'stockholm_pdf_table') {
    const rows = parseStockholmPdfTableCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  if (profile === 'skane_accordion') {
    const rows = parseSkaneAccordionCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  if (profile === 'smaland_label_list') {
    const rows = parseSmalandLabelListCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  const accordionTry = parseSkaneAccordionCups(html, sourceUrl, sourceType);
  if (accordionTry.length > 0) {
    return accordionTry;
  }
  const smalandTry = parseSmalandLabelListCups(html, sourceUrl, sourceType);
  if (smalandTry.length > 0) {
    return smalandTry;
  }

  return parseFallbackSinglePage(html, sourceUrl, sourceType);
}

/** Decode a subset of HTML entities (no external deps). */
function decodeHtmlEntities(raw) {
  if (!raw || typeof raw !== 'string') {
    return '';
  }
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ouml: 'ö',
    Ouml: 'Ö',
    auml: 'ä',
    Auml: 'Ä',
    aring: 'å',
    Aring: 'Å',
    eacute: 'é',
    Eacute: 'É',
  };
  return raw
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => (named[name] !== undefined ? named[name] : m));
}

function stripTags(s) {
  return decodeHtmlEntities(String(s || '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split sibling blocks: <div class="accordion__item"> ... (next block or end)
 */
function splitAccordionItemBlocks(html) {
  const marker = '<div class="accordion__item">';
  const blocks = [];
  let pos = 0;
  while (pos < html.length) {
    const start = html.indexOf(marker, pos);
    if (start === -1) {
      break;
    }
    const contentStart = start + marker.length;
    const next = html.indexOf(marker, contentStart);
    const sliceEnd = next === -1 ? html.length : next;
    blocks.push(html.slice(start, sliceEnd));
    pos = sliceEnd;
  }
  return blocks;
}

/**
 * @param {string} datumValue text after "Datum:"
 * @returns {{ start: string|null, end: string|null, dateText: string|null }}
 */
function parseDatumField(datumValue) {
  const trimmed = (datumValue || '').trim();
  if (!trimmed) {
    return { start: null, end: null, dateText: null };
  }
  const range = trimmed.match(/(\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2})/);
  if (range) {
    return { start: range[1], end: range[2], dateText: trimmed };
  }
  const single = trimmed.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (single) {
    return { start: single[1], end: single[1], dateText: trimmed };
  }
  return { start: null, end: null, dateText: trimmed };
}

function padIsoPart(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function toIsoDate(y, month, day) {
  return `${y}-${padIsoPart(month)}-${padIsoPart(day)}`;
}

/** Full + abbreviated Swedish month names (Småland datumrader). */
function resolveSwedishMonth(token) {
  const t = String(token || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const full = {
    januari: 1,
    februari: 2,
    mars: 3,
    april: 4,
    maj: 5,
    juni: 6,
    juli: 7,
    augusti: 8,
    september: 9,
    oktober: 10,
    november: 11,
    december: 12,
  };
  if (full[t] != null) {
    return full[t];
  }
  const abbrev = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    maj: 5,
    jun: 6,
    jul: 7,
    juli: 7,
    aug: 8,
    sep: 9,
    okt: 10,
    nov: 11,
    dec: 12,
  };
  return abbrev[t] ?? null;
}

/**
 * Småland datum: ISO (via parseDatumField) first, then "12 september", "12-14 september 2026", first "+"-segment only.
 * @returns {{ start: string|null, end: string|null, dateText: string|null }}
 */
function parseDatumFieldSmaland(datumValue, defaultYear = STOCKHOLM_PDF_DEFAULT_YEAR) {
  const base = parseDatumField(datumValue);
  if (base.start != null && base.end != null) {
    return base;
  }

  const trimmed = (datumValue || '').trim();
  if (!trimmed) {
    return { start: null, end: null, dateText: null };
  }
  const firstPart = trimmed.split(/\s*\+\s*/)[0].trim();

  let m = firstPart.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)(?:\s+(\d{4}))?$/i);
  if (m) {
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    const mo = resolveSwedishMonth(m[3]);
    const y = m[4] ? parseInt(m[4], 10) : defaultYear;
    if (mo) {
      const lo = Math.min(d1, d2);
      const hi = Math.max(d1, d2);
      return { start: toIsoDate(y, mo, lo), end: toIsoDate(y, mo, hi), dateText: trimmed };
    }
  }

  m = firstPart.match(/^(\d{1,2})\s+([a-zåäö]+)(?:\s+(\d{4}))?$/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const mo = resolveSwedishMonth(m[2]);
    const y = m[3] ? parseInt(m[3], 10) : defaultYear;
    if (mo) {
      return { start: toIsoDate(y, mo, day), end: toIsoDate(y, mo, day), dateText: trimmed };
    }
  }

  return { start: null, end: null, dateText: trimmed };
}

/**
 * Parse lines like: Arrangör: X / Cup/tävling: X / Datum: ... / Plats: ... / Kategorier: ...
 * (Skåne accordion body — unchanged behaviour.)
 */
function parseStructuredParagraph(pHtml) {
  const text = decodeHtmlEntities(pHtml.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '\n'));
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  let organizer = null;
  let cupName = null;
  let location = null;
  let categories = null;
  let dateRaw = null;

  for (const line of lines) {
    const mOrg = line.match(/^Arrangör:\s*(.+)$/i);
    if (mOrg) {
      organizer = mOrg[1].trim();
      continue;
    }
    const mCup = line.match(/^Cup\/tävling:\s*(.+)$/i);
    if (mCup) {
      cupName = mCup[1].trim();
      continue;
    }
    const mPlats = line.match(/^Plats:\s*(.+)$/i);
    if (mPlats) {
      location = mPlats[1].trim();
      continue;
    }
    const mOrt = line.match(/^Ort:\s*(.+)$/i);
    if (mOrt) {
      location = mOrt[1].trim();
      continue;
    }
    const mKat = line.match(/^Kategorier:\s*(.+)$/i);
    if (mKat) {
      categories = mKat[1].trim();
      continue;
    }
    const mDat = line.match(/^Datum:\s*(.+)$/i);
    if (mDat) {
      dateRaw = mDat[1].trim();
    }
  }

  const { start, end, dateText } = parseDatumField(dateRaw || '');
  return {
    organizer,
    cupName,
    location,
    categories,
    start_date: start,
    end_date: end,
    date_text: dateText,
    description: lines.join('\n'),
  };
}

/**
 * Småland / mixed district labels → same fields as Skåne. Ålder, Kategorier, Antal lag, Spelform → `categories` (combined); ISO + Swedish dates.
 */
function parseLabeledCupLines(lines) {
  let organizer = null;
  let cupName = null;
  let location = null;
  let ageBand = null;
  let categoriesExtra = null;
  let antalLag = null;
  let spelform = null;
  let dateRaw = null;

  for (const line of lines) {
    let m;
    if ((m = line.match(/^Tävlingens namn:\s*(.+)$/i))) {
      cupName = m[1].trim();
      continue;
    }
    if ((m = line.match(/^Cup\/tävling:\s*(.+)$/i))) {
      cupName = cupName || m[1].trim();
      continue;
    }
    if ((m = line.match(/^Arrangör:\s*(.+)$/i))) {
      organizer = m[1].trim();
      continue;
    }
    if ((m = line.match(/^Datum:\s*(.+)$/i))) {
      dateRaw = m[1].trim();
      continue;
    }
    if ((m = line.match(/^Plats:\s*(.+)$/i))) {
      location = location || m[1].trim();
      continue;
    }
    if ((m = line.match(/^Ort:\s*(.+)$/i))) {
      location = location || m[1].trim();
      continue;
    }
    if ((m = line.match(/^Spelplats:\s*(.+)$/i))) {
      location = location || m[1].trim();
      continue;
    }
    if ((m = line.match(/^Område:\s*(.+)$/i))) {
      location = location || m[1].trim();
      continue;
    }
    if ((m = line.match(/^Ålder:\s*(.+)$/i))) {
      ageBand = m[1].trim();
      continue;
    }
    if ((m = line.match(/^Kategorier:\s*(.+)$/i))) {
      categoriesExtra = m[1].trim();
      continue;
    }
    if ((m = line.match(/^Antal lag:\s*(.+)$/i))) {
      antalLag = m[1].trim();
      continue;
    }
    if ((m = line.match(/^Spelform:\s*(.+)$/i))) {
      spelform = m[1].trim();
      continue;
    }
  }

  const catParts = [];
  if (ageBand) catParts.push(ageBand);
  if (categoriesExtra) catParts.push(categoriesExtra);
  if (antalLag) catParts.push(`Antal lag: ${antalLag}`);
  if (spelform) catParts.push(`Spelform: ${spelform}`);
  const categories = catParts.length ? catParts.join('; ') : null;

  const { start, end, dateText } = parseDatumFieldSmaland(dateRaw || '');
  return {
    organizer,
    cupName,
    location,
    categories,
    start_date: start,
    end_date: end,
    date_text: dateText,
    description: lines.join('\n'),
  };
}

function htmlFragmentToLabelLines(fragment) {
  const text = decodeHtmlEntities(
    fragment
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|dt|dd|tr|h2|h3|h4)\b>/gi, '\n')
      .replace(/<[^>]+>/g, '\n'),
  );
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Split HTML into one fragment per cup (Småland: repeated labeled sections).
 */
function splitSmalandCupBlockHtml(html) {
  /** Label must open right after `<p>`/`<div>` — avoid `[\s\S]*?` spanning into the next cup. */
  const re = /<(?:p|div)\b[^>]*>\s*(?:Tävlingens namn|Cup\/tävling)\s*:/gi;
  const indices = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    indices.push(m.index);
  }

  if (indices.length > 0) {
    const blocks = [];
    for (let i = 0; i < indices.length; i += 1) {
      blocks.push(html.slice(indices[i], i + 1 < indices.length ? indices[i + 1] : html.length));
    }
    return blocks;
  }

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const slice = mainMatch ? mainMatch[1] : articleMatch ? articleMatch[1] : html;

  if (/\b(?:Tävlingens namn|Cup\/tävling)\s*:/i.test(slice)) {
    return [slice];
  }

  if (/\bÅlder\s*:\s*/i.test(slice) && /\bArrangör\s*:\s*/i.test(slice)) {
    return [slice];
  }

  return [];
}

function extractExternalUrl(blockHtml) {
  // multisite-link class — class before href (both quote styles)
  const m1 = blockHtml.match(
    /<a[^>]+class=["'][^"']*multisite-link[^"']*["'][^>]+href=["']([^"']+)["']/i,
  );
  if (m1) return m1[1].trim();
  // multisite-link class — href before class (both quote styles)
  const m2 = blockHtml.match(
    /<a[^>]+href=["']([^"']+)["'][^>]+class=["'][^"']*multisite-link[^"']*["']/i,
  );
  if (m2) return m2[1].trim();
  // any absolute URL in href (both quote styles)
  const m3 = blockHtml.match(/href=["'](https?:\/\/[^"']+)["']/i);
  return m3 ? m3[1].trim() : null;
}

function extractAccordionTitle(blockHtml) {
  const m = blockHtml.match(/<span class="accordion__text">([\s\S]*?)<\/span>/i);
  return m ? stripTags(m[1]) : '';
}

function extractFirstContentParagraph(blockHtml) {
  const idx = blockHtml.indexOf('accordion__content');
  const slice = idx >= 0 ? blockHtml.slice(idx) : blockHtml;
  const pMatch = slice.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  return pMatch ? pMatch[1] : '';
}

/** Normalize external URL so the same link does not produce a different id after trivial HTML differences. */
function normalizeRegistrationUrlForId(url) {
  if (!url || typeof url !== 'string') return '';
  const t = url.trim();
  if (!t) return '';
  try {
    const u = new URL(t);
    u.hash = '';
    let out = u.href;
    if (out.endsWith('/') && u.pathname.length > 1) {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return t;
  }
}

/**
 * Deterministic id from parsed fields only (never DOM accordion ids — those can change between fetches).
 * @param {string} [dateTextFallback] when start/end missing (e.g. unparsed Swedish datum), stabilizes id.
 */
function stableExternalId(name, start, end, registrationUrl, dateTextFallback) {
  const n = String(name || '').trim();
  const ru = normalizeRegistrationUrlForId(registrationUrl);
  const s = start != null && String(start) !== '' ? String(start) : '';
  const e = end != null && String(end) !== '' ? String(end) : '';
  let base;
  if (s && e) {
    base = `${n}|${s}|${e}|${ru}`;
  } else if (dateTextFallback) {
    base = `${n}|${String(dateTextFallback).trim()}|${ru}`;
  } else {
    base = `${n}|${s}|${e}|${ru}`;
  }
  let h = 0;
  for (let i = 0; i < base.length; i += 1) {
    h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  }
  return `cup-${String(h)}`;
}

/**
 * Skåne / SVFF multisite accordion list (unchanged behaviour).
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseSkaneAccordionCups(html, sourceUrl, sourceType) {
  const blocks = splitAccordionItemBlocks(html);
  const out = [];

  for (const block of blocks) {
    const title = extractAccordionTitle(block);
    const pInner = extractFirstContentParagraph(block);
    const parsed = parseStructuredParagraph(pInner);

    const nameRaw = (parsed.cupName || title || '').trim();
    if (!nameRaw) {
      continue;
    }

    const registrationUrl = extractExternalUrl(block);
    out.push({
      name: nameRaw.slice(0, 255),
      organizer: parsed.organizer || null,
      location: parsed.location || null,
      start_date: parsed.start_date || null,
      end_date: parsed.end_date || null,
      categories: parsed.categories || null,
      description: parsed.description || null,
      registration_url: registrationUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: stableExternalId(nameRaw, parsed.start_date, parsed.end_date, registrationUrl),
    });
  }

  return out;
}

/**
 * Småland-style pages: labeled fields in paragraphs or similar (no accordion list).
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseSmalandLabelListCups(html, sourceUrl, sourceType) {
  const blocks = splitSmalandCupBlockHtml(html);
  const out = [];

  for (const block of blocks) {
    const lines = htmlFragmentToLabelLines(block);
    const parsed = parseLabeledCupLines(lines);
    const nameRaw = (parsed.cupName || '').trim();
    if (!nameRaw) {
      continue;
    }
    const registrationUrl = extractExternalUrl(block);
    out.push({
      name: nameRaw.slice(0, 255),
      organizer: parsed.organizer || null,
      location: parsed.location || null,
      start_date: parsed.start_date || null,
      end_date: parsed.end_date || null,
      categories: parsed.categories || null,
      description: parsed.description || null,
      registration_url: registrationUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: stableExternalId(
        nameRaw,
        parsed.start_date,
        parsed.end_date,
        registrationUrl,
        parsed.date_text,
      ),
    });
  }

  return out;
}

function parseSvMonthToken(token) {
  const t = String(token || '')
    .trim()
    .toLowerCase()
    .replace(/\.$/, '');
  const map = {
    jan: 1,
    feb: 2,
    mar: 3,
    apr: 4,
    maj: 5,
    jun: 6,
    jul: 7,
    juli: 7,
    aug: 8,
    sep: 9,
    okt: 10,
    nov: 11,
    dec: 12,
  };
  return map[t] ?? null;
}

function pad2(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

function isoDate(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Stockholm PDF cells: "2 jan", "2-6 jan", "24-25 jan + 14-15 feb" — first segment only for ISO range.
 * @returns {{ start: string|null, end: string|null, dateText: string }}
 */
function parseStockholmPdfDateText(raw, year = STOCKHOLM_PDF_DEFAULT_YEAR) {
  const full = (raw || '').trim();
  if (!full) {
    return { start: null, end: null, dateText: '' };
  }
  const firstPart = full.split(/\s*\+\s*/)[0].trim();

  const rangeWithMonth = firstPart.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)\.?$/i);
  if (rangeWithMonth) {
    const d1 = parseInt(rangeWithMonth[1], 10);
    const d2 = parseInt(rangeWithMonth[2], 10);
    const mo = parseSvMonthToken(rangeWithMonth[3]);
    if (mo) {
      const lo = Math.min(d1, d2);
      const hi = Math.max(d1, d2);
      return {
        start: isoDate(year, mo, lo),
        end: isoDate(year, mo, hi),
        dateText: full,
      };
    }
  }

  const singleWithMonth = firstPart.match(/^(\d{1,2})\s+([a-zåäö]+)\.?$/i);
  if (singleWithMonth) {
    const day = parseInt(singleWithMonth[1], 10);
    const mo = parseSvMonthToken(singleWithMonth[2]);
    if (mo) {
      return {
        start: isoDate(year, mo, day),
        end: isoDate(year, mo, day),
        dateText: full,
      };
    }
  }

  return { start: null, end: null, dateText: full };
}

function splitPdfTableLine(line) {
  const s = String(line || '').trim();
  if (!s) {
    return [];
  }
  if (/\t/.test(s)) {
    return s
      .split(/\t/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  return s
    .split(/\s{2,}/)
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

function findStockholmTableHeaderLineIndex(lines) {
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (/\bCupens namn\b/i.test(l) && /\bArrangör\b/i.test(l)) {
      return i;
    }
    if (/\bCupens namn\b/i.test(l) && /\bDatum\b/i.test(l)) {
      return i;
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (/\bCupens namn\b/i.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

function mapStockholmHeaderIndices(headerCells) {
  const idx = { name: -1, organizer: -1, datum: -1, categories: -1, link: -1 };
  headerCells.forEach((cell, i) => {
    const c = String(cell || '').trim();
    if (/\bcupens namn\b/i.test(c)) {
      idx.name = i;
    } else if (/\barrangör\b/i.test(c)) {
      idx.organizer = i;
    } else if (/\bdatum\b/i.test(c)) {
      idx.datum = i;
    } else if (/\bkategorier\b/i.test(c)) {
      idx.categories = i;
    } else if (/länk|hemsida/i.test(c)) {
      idx.link = i;
    }
  });
  return idx;
}

function extractUrlFromCellOrLine(text) {
  const m = String(text || '').match(/(https?:\/\/[^\s<>"']+)/i);
  return m ? m[1].trim() : null;
}

/**
 * Deterministic id for PDF rows: name | datum text | organizer | registration url.
 */
function stableStockholmPdfExternalId(name, dateText, organizer, registrationUrl) {
  const n = String(name || '').trim();
  const d = String(dateText || '').trim();
  const o = String(organizer || '').trim();
  const ru = normalizeRegistrationUrlForId(registrationUrl);
  const base = `${n}|${d}|${o}|${ru}`;
  let h = 0;
  for (let i = 0; i < base.length; i += 1) {
    h = (Math.imul(31, h) + base.charCodeAt(i)) | 0;
  }
  return `cup-${String(h)}`;
}

/**
 * Stockholm district PDF: tabular rows (extracted text), columns Cupens namn, Arrangör, Datum, Kategorier, Länk till hemsida.
 * @param {string} text
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseStockholmPdfTableCups(text, sourceUrl, sourceType) {
  const raw = String(text || '').replace(/\r\n/g, '\n');
  if (/^\[Non-text response/i.test(raw.trim())) {
    return [];
  }

  const lines = raw
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const hi = findStockholmTableHeaderLineIndex(lines);
  if (hi < 0) {
    return [];
  }

  const headerCells = splitPdfTableLine(lines[hi]);
  const col = mapStockholmHeaderIndices(headerCells);
  if (col.name < 0) {
    return [];
  }

  const out = [];

  for (let r = hi + 1; r < lines.length; r += 1) {
    const line = lines[r];
    if (/\bCupens namn\b/i.test(line) && line.length < 200) {
      continue;
    }
    const cells = splitPdfTableLine(line);
    if (cells.length === 0) {
      continue;
    }

    const nameRaw = col.name >= 0 && cells[col.name] != null ? String(cells[col.name]).trim() : '';
    if (!nameRaw || /^datum$/i.test(nameRaw)) {
      continue;
    }

    const organizer =
      col.organizer >= 0 && cells[col.organizer] != null ? String(cells[col.organizer]).trim() : '';
    const datumRaw =
      col.datum >= 0 && cells[col.datum] != null ? String(cells[col.datum]).trim() : '';
    const categories =
      col.categories >= 0 && cells[col.categories] != null
        ? String(cells[col.categories]).trim()
        : '';

    let registrationUrl = null;
    if (col.link >= 0 && cells[col.link] != null) {
      registrationUrl = extractUrlFromCellOrLine(cells[col.link]);
    }
    if (!registrationUrl) {
      registrationUrl = extractUrlFromCellOrLine(line);
    }

    const parsed = parseStockholmPdfDateText(datumRaw);
    const descLines = [];
    if (datumRaw) {
      descLines.push(`Datum: ${datumRaw}`);
    }
    if (categories) {
      descLines.push(`Kategorier: ${categories}`);
    }
    if (!parsed.start && datumRaw) {
      descLines.push('(Datum kunde inte tolkas till ISO; se Datum-raden.)');
    }
    let description = descLines.length ? descLines.join('\n') : null;
    if (!description && line) {
      description = line.slice(0, 4000);
    }

    const externalId = stableStockholmPdfExternalId(
      nameRaw,
      datumRaw || parsed.dateText,
      organizer,
      registrationUrl,
    );

    out.push({
      name: nameRaw.slice(0, 255),
      organizer: organizer || null,
      location: null,
      start_date: parsed.start,
      end_date: parsed.end,
      categories: categories || null,
      description,
      registration_url: registrationUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'pdf',
      external_id: externalId,
    });
  }

  return out;
}

/** Single-page fallback when no profile yields rows. */
function parseFallbackSinglePage(html, sourceUrl, sourceType) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const metaDescMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i,
  );

  const clean = (v) =>
    String(v || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const title = clean(h1Match?.[1] || titleMatch?.[1] || '');
  const description = clean(metaDescMatch?.[1] || '');

  if (!title) {
    return [];
  }

  return [
    {
      name: title.slice(0, 255),
      organizer: null,
      location: null,
      start_date: null,
      end_date: null,
      categories: null,
      description: description || null,
      registration_url: null,
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: null,
    },
  ];
}

module.exports = {
  parseCupSource,
  detectCupSourceProfile,
  parseSkaneAccordionCups,
  parseSmalandLabelListCups,
  parseStockholmPdfTableCups,
};
