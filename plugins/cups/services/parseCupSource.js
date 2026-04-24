/**
 * Domain-owned cup parser. Ingest supplies full `bodyText`; this module extracts cup rows.
 * Profiles: Stockholm PDF table, SvFF-style PDF (Cupnamn + Arrangör, e.g. Göteborg), labeled PDF/plaintext,
 * Skåne/SVFF accordion, Småland lists, Bohuslän list, SvFF table (Cupnamn), Södermanland accordion h3,
 * Östergötland year/month lists, Ångermanland labeled blocks, Uppland/Jämtland paragraph lists, then fallback.
 *
 * @param {{ html: string, sourceUrl?: string, sourceType?: string }} input
 * @returns {Array<Record<string, unknown>>}
 */

/** @typedef {'skane_accordion' | 'smaland_label_list' | 'stockholm_pdf_table' | 'labeled_plaintext_pdf' | 'bohuslan_html_list' | 'svff_table' | 'svff_paragraph_list' | 'sodermanland_accordion' | 'svff_yearmonth_list' | 'angermanland_labeled' | null} CupSourceProfile */

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
 * District PDFs (e.g. Göteborgs FF) often use **Cupnamn** + **Arrangör** like SvFF HTML tables,
 * not Stockholm's "Cupens namn". Same row shape as {@link parseStockholmPdfTableCups}.
 * @param {string} text
 * @param {string|undefined|null} _sourceUrl
 * @param {string|undefined|null} sourceType
 */
function looksLikeSvffStylePdfCupTable(text, _sourceUrl, sourceType) {
  void _sourceUrl;
  const st = String(sourceType || '')
    .trim()
    .toLowerCase();
  if (!text || typeof text !== 'string') {
    return false;
  }
  if (/^\[Non-text response/i.test(text.trim())) {
    return false;
  }
  if (/\bCupens namn\b/i.test(text)) {
    return false;
  }
  if (!/\bCupnamn\b/i.test(text) || !/\bArrangör\b/i.test(text)) {
    return false;
  }
  /** Let {@link parseSvffTableCups} handle real HTML tables with Cupnamn. */
  if (/<table[\s>]/i.test(text)) {
    return false;
  }
  if (st !== 'pdf' && st !== 'other') {
    return false;
  }
  return true;
}

/**
 * PDF text with Småland/Skåne-style labels (not the Stockholm tabell layout).
 * @param {string} text
 * @param {string|undefined|null} sourceType
 */
function looksLikeLabeledPlaintextPdf(text, sourceType) {
  const st = String(sourceType || '')
    .trim()
    .toLowerCase();
  if (st !== 'pdf' || !text || typeof text !== 'string') {
    return false;
  }
  if (/^\[Non-text response/i.test(text.trim())) {
    return false;
  }
  const hasArr = /\bArrangör\s*:/i.test(text);
  const hasCupLabel = /\b(?:Tävlingens namn|Cup\/tävling)\s*:/i.test(text);
  return hasArr && hasCupLabel;
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
  const decodedHtml = decodeHtmlEntities(html);

  if (looksLikeStockholmPdfTable(html, sourceUrl, sourceType)) {
    return 'stockholm_pdf_table';
  }

  if (looksLikeSvffStylePdfCupTable(html, sourceUrl, sourceType)) {
    return 'stockholm_pdf_table';
  }

  if (looksLikeLabeledPlaintextPdf(html, sourceType)) {
    return 'labeled_plaintext_pdf';
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

  /** Östergötland: year accordions + month headings + list items (before generic skane_accordion). */
  if (/Lista över cuper med tillstånd/i.test(html)) {
    return 'svff_yearmonth_list';
  }
  /** Östergötland: /tavling/sanktionerade-cuper/ (rubrik "Sanktionerade cuper", år i accordion). */
  if (
    /(^|\.)ostergotland\.svenskfotboll\.se$/i.test(host) &&
    /Sanktionerade cuper/i.test(decodedHtml) &&
    hasSkaneAccordion
  ) {
    return 'svff_yearmonth_list';
  }

  /** Ångermanland-style labeled paragraphs (SvFF HTML uses entities, e.g. T&auml;vling/ Cup:). */
  if (/Tävling\s*\/\s*Cup\s*:/i.test(decodedHtml)) {
    return 'angermanland_labeled';
  }

  /** Södermanland: accordion + h3 titles with YYYYMMDD sanction-style ids. */
  if (hasSkaneAccordion && /<h3\b[^>]*>[\s\S]{0,500}?\d{8}\s*-\s*\d+/i.test(html)) {
    return 'sodermanland_accordion';
  }

  const isSmalandHost =
    /(^|\.)smalandboll\.se$/i.test(host) || /(^|\.)smalandsfotbollen\.se$/i.test(host);
  const isBohuslanDalslandHost = /(^|\.)bohuslan-dalsland\.svenskfotboll\.se$/i.test(host);
  const hasSmalandStyleMarkers =
    /\bTävlingens namn\s*:/i.test(decodedHtml) ||
    (/\bÅlder\s*:/i.test(decodedHtml) && /\bArrangör\s*:/i.test(decodedHtml));

  /** Småland/Skåne accordion must be classified before generic paragraph-list checks. */
  if (hasSkaneAccordion && hasSmalandStyleMarkers) {
    return 'skane_accordion';
  }
  if (hasSkaneAccordion) {
    return 'skane_accordion';
  }

  /** Västerbotten / Västmanland: Excel-style table with Cupnamn column. */
  if (/<table[\s>]/.test(html) && /\bCupnamn\b/i.test(html)) {
    return 'svff_table';
  }

  /** Uppland: Arr. förening blocks (SvFF HTML uses entities e.g. Arr. f&ouml;rening). */
  if (/Arr\.\s*förening\s*:/i.test(decodedHtml)) {
    return 'svff_paragraph_list';
  }
  /** Jämtland m.fl.: rubrik kan vara &lt;h2&gt;&lt;strong&gt;Cuper 2026&lt;/strong&gt;&lt;/h2&gt;. */
  if (/<h2\b[^>]*>[\s\S]*?Cuper\s+\d{4}/i.test(decodedHtml)) {
    return 'svff_paragraph_list';
  }

  if (isBohuslanDalslandHost && /\bFotbollscuper\b/i.test(html)) {
    return 'bohuslan_html_list';
  }

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

  if (profile === 'labeled_plaintext_pdf') {
    const rows = parseLabeledPlaintextPdfCups(html, sourceUrl, sourceType);
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

  if (profile === 'bohuslan_html_list') {
    const rows = parseBohuslanHtmlListCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  if (profile === 'svff_table') {
    const rows = parseSvffTableCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  if (profile === 'sodermanland_accordion') {
    const rows = parseSodermanlandAccordionCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  if (profile === 'svff_yearmonth_list') {
    const rows = parseSvffYearMonthListCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  if (profile === 'angermanland_labeled') {
    const rows = parseAngermanlandLabeledCups(html, sourceUrl, sourceType);
    if (rows.length > 0) {
      return rows;
    }
    return parseFallbackSinglePage(html, sourceUrl, sourceType);
  }

  if (profile === 'svff_paragraph_list') {
    const rows = parseSvffParagraphListCups(html, sourceUrl, sourceType);
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
  // Accept compact month-token forms like "13juni" and "14-16augusti"
  m = firstPart.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s*([a-zåäö]+)(?:\s+(\d{4}))?$/i);
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
  // Accept compact single-day month-token form: "29augusti"
  m = firstPart.match(/^(\d{1,2})\s*([a-zåäö]+)(?:\s+(\d{4}))?$/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const mo = resolveSwedishMonth(m[2]);
    const y = m[3] ? parseInt(m[3], 10) : defaultYear;
    if (mo) {
      return { start: toIsoDate(y, mo, day), end: toIsoDate(y, mo, day), dateText: trimmed };
    }
  }
  // Accept slash numeric month forms used in Småland accordion titles/body: "14-16/8", "27/6", optional year.
  m = firstPart.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s*\/\s*(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (m) {
    const d1 = parseInt(m[1], 10);
    const d2 = parseInt(m[2], 10);
    const mo = parseInt(m[3], 10);
    const y = m[4] ? parseInt(m[4], 10) : defaultYear;
    if (mo >= 1 && mo <= 12) {
      const lo = Math.min(d1, d2);
      const hi = Math.max(d1, d2);
      return { start: toIsoDate(y, mo, lo), end: toIsoDate(y, mo, hi), dateText: trimmed };
    }
  }
  m = firstPart.match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s+(\d{4}))?$/i);
  if (m) {
    const day = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10);
    const y = m[3] ? parseInt(m[3], 10) : defaultYear;
    if (mo >= 1 && mo <= 12) {
      return { start: toIsoDate(y, mo, day), end: toIsoDate(y, mo, day), dateText: trimmed };
    }
  }

  return { start: null, end: null, dateText: trimmed };
}

/**
 * Ångermanland: "18-19 / 25-26 april 2026" (two weekend spans in one month).
 * @returns {{ start: string|null, end: string|null }}
 */
function parseAngermanlandSlashWeekendRanges(dateRaw, defaultYear = STOCKHOLM_PDF_DEFAULT_YEAR) {
  const cleaned = String(dateRaw || '')
    .replace(/\.$/, '')
    .trim();
  const m = cleaned.match(
    /^(\d{1,2})-(\d{1,2})\s*\/\s*(\d{1,2})-(\d{1,2})\s+([a-zåäö]+)(?:\s+(\d{4}))?$/i,
  );
  if (!m) {
    return { start: null, end: null };
  }
  const mo = resolveSwedishMonth(m[5]);
  const y = m[6] ? parseInt(m[6], 10) : defaultYear;
  if (!mo) {
    return { start: null, end: null };
  }
  const days = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10), parseInt(m[4], 10)];
  if (days.some((d) => d < 1 || d > 31)) {
    return { start: null, end: null };
  }
  const lo = Math.min(...days);
  const hi = Math.max(...days);
  return { start: toIsoDate(y, mo, lo), end: toIsoDate(y, mo, hi) };
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
  let ageBandSkane = null;
  let antalLagSkane = null;
  let spelformSkane = null;

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
    const mCupTn = line.match(/^Tävlingens namn:\s*(.+)$/i);
    if (mCupTn) {
      cupName = cupName || mCupTn[1].trim();
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
    const mAlder = line.match(/^Ålder:\s*(.+)$/i);
    if (mAlder) {
      ageBandSkane = mAlder[1].trim();
      continue;
    }
    const mKat = line.match(/^Kategorier:\s*(.+)$/i);
    if (mKat) {
      categories = mKat[1].trim();
      continue;
    }
    const mAnt = line.match(/^Antal lag:\s*(.+)$/i);
    if (mAnt) {
      antalLagSkane = mAnt[1].trim();
      continue;
    }
    const mSp = line.match(/^Spelform:\s*(.+)$/i);
    if (mSp) {
      spelformSkane = mSp[1].trim();
      continue;
    }
    const mDat = line.match(/^Datum:\s*(.+)$/i);
    if (mDat) {
      dateRaw = mDat[1].trim();
    }
  }

  const catPartsSkane = [];
  if (ageBandSkane) catPartsSkane.push(ageBandSkane);
  if (categories) catPartsSkane.push(categories);
  const categoriesOut = catPartsSkane.length > 0 ? catPartsSkane.join('; ') : null;

  const team_count = antalLagSkane != null ? parseTeamCountFromAntalLag(antalLagSkane) : null;
  const match_format =
    spelformSkane != null ? translateSpelformToEnglish(spelformSkane) || spelformSkane : null;

  const { start, end, dateText } = parseDatumField(dateRaw || '');
  return {
    organizer,
    cupName,
    location,
    categories: categoriesOut,
    team_count,
    match_format,
    start_date: start,
    end_date: end,
    date_text: dateText,
    description: lines.join('\n'),
  };
}

/** First integer in "Antal lag" cell; ignores "ca", spaces. */
function parseTeamCountFromAntalLag(text) {
  const t = String(text || '').trim();
  if (!t) {
    return null;
  }
  const m = t.match(/(\d{1,4})/);
  if (!m) {
    return null;
  }
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Swedish district "Spelform" → English for UI (e.g. "5 mot 5" → "5 vs 5").
 * @param {string} raw
 * @returns {string}
 */
function translateSpelformToEnglish(raw) {
  let s = String(raw || '').trim();
  if (!s) {
    return '';
  }
  s = s.replace(/(\d{1,2})\s*mot\s*(\d{1,2})/gi, (_, a, b) => `${a} vs ${b}`);
  if (/inomhus|in-door/i.test(s)) {
    s = s.replace(/\binomhus\b/gi, 'indoor');
  }
  if (/utomhus|utom\.\s*hus/i.test(s)) {
    s = s.replace(/\butomhus\b/gi, 'outdoor');
  }
  s = s.replace(/\bhalv plan\b/gi, 'half pitch');
  s = s.replace(/\bhel plan\b/gi, 'full pitch');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Småland / mixed district labels → same fields as Skåne. Ålder + Kategorier → `categories` (Antal lag & Spelform → own columns via team_count / match_format).
 */
/**
 * @param {string[]} lines
 * @param {number} [defaultYear] override for implicit-year date strings
 */
function parseLabeledCupLines(lines, defaultYear = STOCKHOLM_PDF_DEFAULT_YEAR) {
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
  const categories = catParts.length ? catParts.join('; ') : null;

  const team_count = antalLag != null ? parseTeamCountFromAntalLag(antalLag) : null;
  const match_format = spelform ? translateSpelformToEnglish(spelform) || spelform : null;

  const { start, end, dateText } = parseDatumFieldSmaland(dateRaw || '', defaultYear);
  return {
    organizer,
    cupName,
    location,
    categories,
    team_count,
    match_format,
    start_date: start,
    end_date: end,
    date_text: dateText,
    description: lines.join('\n'),
  };
}

/**
 * Extract the most prominent year (20xx) from a page's headings/title so implicit-year
 * date strings ("12 september") are anchored to the correct season, not the wall clock.
 * Returns null if nothing found — caller falls back to STOCKHOLM_PDF_DEFAULT_YEAR.
 * @param {string} html
 * @returns {number|null}
 */
function extractPageDefaultYear(html) {
  const currentYear = new Date().getFullYear();
  const candidates = [];
  // Look in h1/h2/h3/h4 headings and <title>
  const headingRe = /<(?:h[1-4]|title)\b[^>]*>([\s\S]*?)<\/(?:h[1-4]|title)>/gi;
  let m;
  while ((m = headingRe.exec(html)) !== null) {
    const text = stripTags(m[1]);
    const years = [...text.matchAll(/\b(20\d{2})\b/g)].map((x) => parseInt(x[1], 10));
    for (const y of years) {
      if (y >= currentYear - 1 && y <= currentYear + 2) {
        candidates.push(y);
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  // Prefer the most frequently mentioned year; among ties, prefer the largest (upcoming season).
  const freq = new Map();
  for (const y of candidates) {
    freq.set(y, (freq.get(y) || 0) + 1);
  }
  let best = null;
  let bestFreq = 0;
  for (const [y, f] of freq) {
    if (f > bestFreq || (f === bestFreq && best !== null && y > best)) {
      best = y;
      bestFreq = f;
    }
  }
  return best;
}

/** Remove SVFF accordion list title so it does not pollute Småland label lines / description. */
function stripAccordionTextSpan(fragment) {
  return String(fragment || '').replace(
    /<span\b[^>]*class=["'][^"']*accordion__text[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
    '',
  );
}

function htmlFragmentToLabelLines(fragment) {
  const text = decodeHtmlEntities(
    fragment
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|dt|dd|tr|h2|h3|h4)\b>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/ {2,}/g, ' '),
  );
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * PDF extract: split on line-start cup title labels (multi-cup); else one block if markers exist.
 * @param {string} text
 * @returns {string[]}
 */
function splitLabeledPlaintextCupBlocks(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n');
  const lineList = raw.split('\n');
  const blockStarts = [];
  for (let i = 0; i < lineList.length; i += 1) {
    const t = lineList[i].trim();
    if (/^(?:Tävlingens namn|Cup\/tävling)\s*:/i.test(t)) {
      blockStarts.push(i);
    }
  }

  if (blockStarts.length > 0) {
    const blocks = [];
    for (let j = 0; j < blockStarts.length; j += 1) {
      const from = blockStarts[j];
      const to = j + 1 < blockStarts.length ? blockStarts[j + 1] - 1 : lineList.length - 1;
      blocks.push(
        lineList
          .slice(from, to + 1)
          .join('\n')
          .trim(),
      );
    }
    return blocks.filter((b) => b.length > 0);
  }

  if (/\b(?:Tävlingens namn|Cup\/tävling)\s*:/i.test(raw) && /\bArrangör\s*:/i.test(raw)) {
    return [raw.trim()];
  }
  return [];
}

/**
 * Break single-line PDF runs like "Cup/tävling: X Arrangör: Y" into label lines.
 * @param {string} block
 * @returns {string[]}
 */
function plaintextToLabelLines(block) {
  const labelPrefix =
    '(?:Tävlingens namn|Cup\\/tävling|Arrangör|Datum|Plats|Ort|Kategorier|Ålder|Antal lag|Spelform|Spelplats|Område)';
  const splitRe = new RegExp(`\\s+(?=${labelPrefix}\\s*:)`, 'gi');
  const raw = String(block || '').replace(/\r\n/g, '\n');
  const lines = raw
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out = [];
  for (const line of lines) {
    const parts = line
      .split(splitRe)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      out.push(...parts);
    } else {
      out.push(line);
    }
  }
  return out.map((l) => decodeHtmlEntities(l));
}

/**
 * Same row shape as Småland HTML import; for PDF bodyText with labeled fields.
 * @param {string} text
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseLabeledPlaintextPdfCups(text, sourceUrl, sourceType) {
  const blocks = splitLabeledPlaintextCupBlocks(text);
  const out = [];

  for (const block of blocks) {
    const lines = plaintextToLabelLines(block);
    const parsed = parseLabeledCupLines(lines);
    const nameRaw = (parsed.cupName || '').trim();
    if (!nameRaw) {
      continue;
    }
    const registrationUrl = extractUrlFromCellOrLine(block);
    out.push({
      name: nameRaw.slice(0, 255),
      organizer: parsed.organizer || null,
      location: parsed.location || null,
      start_date: parsed.start_date || null,
      end_date: parsed.end_date || null,
      categories: parsed.categories || null,
      team_count: parsed.team_count ?? null,
      match_format: parsed.match_format ?? null,
      description: parsed.description || null,
      registration_url: registrationUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'pdf',
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

  const hasAccordionItem =
    html.includes('<div class="accordion__item">') ||
    (html.includes('accordion__item') && html.includes('accordion__content'));
  if (hasAccordionItem) {
    const items = splitAccordionItemBlocks(html);
    const labeled = items.filter(
      (b) =>
        /\b(?:Tävlingens namn|Cup\/tävling)\s*:/i.test(b) ||
        (/\bÅlder\s*:/i.test(b) && /\bArrangör\s*:/i.test(b)),
    );
    if (labeled.length > 0) {
      return labeled;
    }
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

/**
 * Småland multisite puts each label in its own <p>; Skåne often uses one <p> with <br>.
 * @param {string} blockHtml one accordion__item block
 */
function extractAccordionContentAllParagraphsInnerHtml(blockHtml) {
  const idx = blockHtml.indexOf('accordion__content');
  const slice = idx >= 0 ? blockHtml.slice(idx) : blockHtml;
  const parts = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(slice)) !== null) {
    parts.push(m[1]);
  }
  if (parts.length === 0) {
    return extractFirstContentParagraph(blockHtml);
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return parts.join('<br/>');
}

function accordionLinesLookLikeSmalandLabeledList(lines) {
  return lines.some((l) => {
    const t = l.trim();
    return (
      /^Tävlingens namn\s*:/i.test(t) ||
      /^Ålder\s*:/i.test(t) ||
      /^Antal lag\s*:/i.test(t) ||
      /^Spelform\s*:/i.test(t)
    );
  });
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
 *
 * Identity strategy (in priority order):
 *  1. Raw datum text (`dateTextFallback`) when available — most stable across parser changes
 *     and implicit-year date strings, because it is the literal source value.
 *  2. Parsed ISO start + end (when no dateText is available, e.g. Stockholm PDF path
 *     that calls stableStockholmPdfExternalId separately).
 *  3. Empty start/end strings (degenerate case, produces name||| + url hash).
 *
 * Why prefer dateText over parsed dates: the same on-page string like "12 september" is stable
 * across calendar-year rollovers, parser regex changes, and HTML refetches, whereas the parsed
 * ISO output can flip between "2025-09-12" and "2026-09-12" (or between a value and null) when
 * the year is implicit in the page text or the parser is updated. A flip in the parsed dates
 * produces a different hash → primary-match miss → duplicate INSERT every import run.
 *
 * @param {string|null|undefined} dateTextFallback raw datum string (e.g. "12–14 september 2026")
 */
function stableExternalId(name, start, end, registrationUrl, dateTextFallback) {
  const n = String(name || '').trim();
  const ru = normalizeRegistrationUrlForId(registrationUrl);
  let base;
  // Prefer raw datum text: it is directly from the source page and does not change
  // when date parsing succeeds/fails or the implicit year rolls over.
  const dt = dateTextFallback != null ? String(dateTextFallback).trim() : '';
  if (dt) {
    base = `${n}|${dt}|${ru}`;
  } else {
    const s = start != null && String(start) !== '' ? String(start) : '';
    const e = end != null && String(end) !== '' ? String(end) : '';
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

  const pageYear = extractPageDefaultYear(html) ?? STOCKHOLM_PDF_DEFAULT_YEAR;

  for (const block of blocks) {
    const title = extractAccordionTitle(block);
    const inner = extractAccordionContentAllParagraphsInnerHtml(block);
    const lines = htmlFragmentToLabelLines(inner);
    const parsed = accordionLinesLookLikeSmalandLabeledList(lines)
      ? parseLabeledCupLines(lines, pageYear)
      : parseStructuredParagraph(inner);

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
      team_count: parsed.team_count ?? null,
      match_format: parsed.match_format ?? null,
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

/**
 * Småland-style pages: labeled fields in paragraphs or similar (no accordion list).
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseSmalandLabelListCups(html, sourceUrl, sourceType) {
  const blocks = splitSmalandCupBlockHtml(html);
  const out = [];

  // Extract year from the page heading so implicit-year date strings are anchored
  // to the correct season rather than the current wall-clock year.
  const pageYear = extractPageDefaultYear(html) ?? STOCKHOLM_PDF_DEFAULT_YEAR;

  for (const block of blocks) {
    const lines = htmlFragmentToLabelLines(stripAccordionTextSpan(block));
    const parsed = parseLabeledCupLines(lines, pageYear);
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
      team_count: parsed.team_count ?? null,
      match_format: parsed.match_format ?? null,
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
    mars: 3,
    apr: 4,
    maj: 5,
    jun: 6,
    jul: 7,
    juli: 7,
    aug: 8,
    sep: 9,
    sept: 9,
    okt: 10,
    nov: 11,
    dec: 12,
  };
  return map[t] ?? null;
}

/**
 * Parse "5-6/4", "2/8", optional trailing year.
 * @returns {{ start: string|null, end: string|null, dateText: string|null }}
 */
function parseSwedishSlashDateRange(raw, defaultYear = STOCKHOLM_PDF_DEFAULT_YEAR) {
  const s = String(raw || '').trim();
  if (!s) {
    return { start: null, end: null, dateText: null };
  }
  /** "28/29/3" (två dagar i samma månad, förekommer i listor). */
  const mDoubleDay = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{1,2})(?:\s*\/\s*(\d{2,4}))?$/);
  if (mDoubleDay) {
    const da = parseInt(mDoubleDay[1], 10);
    const db = parseInt(mDoubleDay[2], 10);
    const mo = parseInt(mDoubleDay[3], 10);
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31 && db >= 1 && db <= 31 && db !== da) {
      let y = defaultYear;
      if (mDoubleDay[4]) {
        const yRaw = parseInt(mDoubleDay[4], 10);
        y = mDoubleDay[4].length === 2 ? 2000 + yRaw : yRaw;
      }
      const lo = Math.min(da, db);
      const hi = Math.max(da, db);
      if (hi - lo <= 3) {
        return { start: isoDate(y, mo, lo), end: isoDate(y, mo, hi), dateText: s };
      }
    }
  }
  /** "14/5 - 17/5", "31/1-8/2" (samma eller annan månad). */
  const crossM = s.match(/^(\d{1,2})\/(\d{1,2})\s*-\s*(\d{1,2})\/(\d{1,2})(?:\s*\/\s*(\d{2,4}))?$/);
  if (crossM) {
    const da1 = parseInt(crossM[1], 10);
    const mo1 = parseInt(crossM[2], 10);
    const da2 = parseInt(crossM[3], 10);
    const mo2 = parseInt(crossM[4], 10);
    let y = defaultYear;
    if (crossM[5]) {
      const yRaw = parseInt(crossM[5], 10);
      y = crossM[5].length === 2 ? 2000 + yRaw : yRaw;
    }
    if (
      mo1 >= 1 &&
      mo1 <= 12 &&
      mo2 >= 1 &&
      mo2 <= 12 &&
      da1 >= 1 &&
      da1 <= 31 &&
      da2 >= 1 &&
      da2 <= 31
    ) {
      const yEnd = mo2 < mo1 ? y + 1 : y;
      return { start: isoDate(y, mo1, da1), end: isoDate(yEnd, mo2, da2), dateText: s };
    }
  }
  let m = s.match(/^(\d{1,2})(?:\s*[-–]\s*(\d{1,2}))?\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?$/);
  if (!m) {
    /** "3-6/4", "10-22/10" utan mellanslag runt bindestreck. */
    m = s.match(/^(\d{1,2})-(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?$/);
  }
  if (!m) {
    return { start: null, end: null, dateText: s };
  }
  const d1 = parseInt(m[1], 10);
  const d2 = m[2] ? parseInt(m[2], 10) : d1;
  const mo = parseInt(m[3], 10);
  let y = defaultYear;
  if (m[4]) {
    const yRaw = parseInt(m[4], 10);
    y = m[4].length === 2 ? 2000 + yRaw : yRaw;
  }
  const lo = Math.min(d1, d2);
  const hi = Math.max(d1, d2);
  return { start: isoDate(y, mo, lo), end: isoDate(y, mo, hi), dateText: s };
}

/**
 * Bohuslän-Dalsland page lists cups as plain list items, no accordion/labels.
 * Example: "Påskcupen 2026, Uddevalla 5-6/4"
 */
function parseBohuslanHtmlListCups(html, sourceUrl, sourceType) {
  const text = decodeHtmlEntities(
    String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(li|p|div|h1|h2|h3|h4|ul|ol|section|article|main)\b>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/ {2,}/g, ' '),
  );

  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const out = [];
  let inFootballSection = false;

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*•]\s*/, '').trim();
    if (!line) continue;

    if (/^Fotbollscuper\b/i.test(line)) {
      inFootballSection = true;
      continue;
    }
    if (/^Futsalscuper\b/i.test(line)) {
      inFootballSection = false;
      continue;
    }
    if (!inFootballSection) {
      continue;
    }

    const dm = line.match(/(\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s*\/\s*\d{1,2}(?:\s*\/\s*\d{2,4})?)/);
    if (!dm) {
      continue;
    }

    const dateRaw = dm[1].trim();
    const before = line
      .slice(0, dm.index)
      .trim()
      .replace(/[,\-–]\s*$/, '')
      .trim();
    const after = line.slice((dm.index || 0) + dm[0].length).trim();

    let nameRaw = before;
    let location = null;
    if (before.includes(',')) {
      const parts = before.split(',');
      const loc = String(parts.pop() || '').trim();
      if (loc) {
        location = loc;
      }
      nameRaw = parts.join(',').trim();
    }
    const afterLoc = after.replace(/^[-,]\s*/, '').trim();
    if (!location && afterLoc && !/^\d/.test(afterLoc)) {
      location = afterLoc;
    }

    if (!nameRaw) {
      continue;
    }

    const parsedDate = parseSwedishSlashDateRange(dateRaw);
    out.push({
      name: nameRaw.slice(0, 255),
      organizer: null,
      location: location || null,
      start_date: parsedDate.start,
      end_date: parsedDate.end,
      categories: 'Football',
      team_count: null,
      match_format: null,
      description: line,
      registration_url: null,
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: stableExternalId(
        nameRaw,
        parsedDate.start,
        parsedDate.end,
        null,
        parsedDate.dateText,
      ),
    });
  }

  return out;
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

  const rangeWithMonth = firstPart.match(
    /^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)\.?(?:\s+\d{4})?$/i,
  );
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

  const singleWithMonth = firstPart.match(/^(\d{1,2})\s+([a-zåäö]+)\.?(?:\s+\d{4})?$/i);
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
    /** Göteborg / SvFF-style PDF: Cupnamn Arrangör … */
    if (/\bCupnamn\b/i.test(l) && /\bArrangör\b/i.test(l)) {
      return i;
    }
    if (/\bCupnamn\b/i.test(l) && /\bDatum\b/i.test(l)) {
      return i;
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (/\bCupens namn\b/i.test(lines[i])) {
      return i;
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    if (/\bCupnamn\b/i.test(lines[i])) {
      return i;
    }
  }
  return -1;
}

function mapStockholmHeaderIndices(headerCells) {
  const idx = { name: -1, organizer: -1, datum: -1, categories: -1, link: -1 };
  headerCells.forEach((cell, i) => {
    const c = String(cell || '').trim();
    if (/\bcupens namn\b/i.test(c) || /\bcupnamn\b/i.test(c)) {
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
 * When pdf text collapses table columns into one line (single spaces), e.g.
 * "Lucia Cupen Arameisk Syrianska IF 12-13 dec F/P2013-2019"
 * @returns {{ name: string, organizer: string|null, dateRaw: string|null, categories: string|null }|null}
 */
function tryParseCollapsedSwedishCupTableRow(line) {
  let t = String(line || '').trim();
  if (t.length < 16) {
    return null;
  }
  // PDF extraction often keeps "Hemsida" as a trailing pseudo-column token.
  t = t.replace(/\s+hemsida\s*$/i, '').trim();

  const monthPat = '(?:jan|feb|mar|mars|apr|maj|jun|jul|juli|aug|sep|sept|okt|nov|dec)';
  const dateRangeRe = new RegExp(
    `(\\d{1,2}\\s*[-–]\\s*\\d{1,2}\\s+${monthPat}\\.?(?:\\s+\\d{4})?(?=\\s|$))`,
    'i',
  );
  const dateSingleRe = new RegExp(`(\\d{1,2}\\s+${monthPat}\\.?(?:\\s+\\d{4})?(?=\\s|$))`, 'i');

  if (!dateRangeRe.test(t) && !dateSingleRe.test(t)) {
    return null;
  }

  let categories = null;
  const catM = t.match(/\s+([FP]\/[FP][\d./A-Za-z\-]+)\s*$/i);
  if (catM) {
    categories = catM[1].trim();
    t = t.slice(0, catM.index).trim();
  }

  let dateRaw = null;
  let rm = t.match(dateRangeRe);
  if (rm) {
    dateRaw = rm[1].trim();
    t = t.slice(0, rm.index).trim();
  } else {
    rm = t.match(dateSingleRe);
    if (rm) {
      dateRaw = rm[1].trim();
      t = t.slice(0, rm.index).trim();
    }
  }

  if (!dateRaw || !t) {
    return null;
  }

  const tokens = t.split(/\s+/).filter(Boolean);
  const suffixSet = new Set([
    'if',
    'ff',
    'bk',
    'ik',
    'sk',
    'fc',
    'fk',
    'ifk',
    'gif',
    'bois',
    'afc',
    'hk',
  ]);
  const lastIdx = tokens.length - 1;
  const lastNorm = tokens[lastIdx] ? tokens[lastIdx].replace(/\.$/, '').toLowerCase() : '';
  if (lastIdx >= 2 && suffixSet.has(lastNorm)) {
    let best = null;
    for (let j = 1; j <= lastIdx - 1; j += 1) {
      const nameW = j;
      const orgW = lastIdx - j + 1;
      if (orgW < 2) {
        continue;
      }
      if (lastIdx >= 3 && nameW < 2) {
        continue;
      }
      const name = tokens.slice(0, j).join(' ');
      const organizer = tokens.slice(j, lastIdx + 1).join(' ');
      const score = orgW * 1000 + nameW;
      if (!best || score > best.score) {
        best = { name, organizer, score };
      }
    }
    if (best && best.name.length >= 2 && best.organizer.length >= 3) {
      return { name: best.name, organizer: best.organizer, dateRaw, categories };
    }
  }

  return {
    name: t
      .replace(/\s+hemsida\s*$/i, '')
      .trim()
      .slice(0, 255),
    organizer: null,
    dateRaw,
    categories,
  };
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
    if ((/\bCupens namn\b/i.test(line) || /\bCupnamn\b/i.test(line)) && line.length < 200) {
      continue;
    }
    const cells = splitPdfTableLine(line);
    if (cells.length === 0) {
      continue;
    }

    let nameRaw = col.name >= 0 && cells[col.name] != null ? String(cells[col.name]).trim() : '';
    if (!nameRaw || /^datum$/i.test(nameRaw)) {
      continue;
    }

    let organizer =
      col.organizer >= 0 && cells[col.organizer] != null ? String(cells[col.organizer]).trim() : '';
    let datumRaw =
      col.datum >= 0 && cells[col.datum] != null ? String(cells[col.datum]).trim() : '';
    let categories =
      col.categories >= 0 && cells[col.categories] != null
        ? String(cells[col.categories]).trim()
        : '';

    const hasCollapsedDateInName =
      /\d{1,2}\s*[-–]\s*\d{1,2}\s+(?:jan|feb|mar|mars|apr|maj|jun|jul|juli|aug|sep|sept|okt|nov|dec)/i.test(
        nameRaw,
      ) ||
      /\d{1,2}\s+(?:jan|feb|mar|mars|apr|maj|jun|jul|juli|aug|sep|sept|okt|nov|dec)\b/i.test(
        nameRaw,
      );

    const shouldTryCollapsed =
      nameRaw.length > 18 && !organizer && !datumRaw && hasCollapsedDateInName;

    if (shouldTryCollapsed) {
      const collapsed = tryParseCollapsedSwedishCupTableRow(nameRaw);
      if (collapsed && collapsed.name) {
        nameRaw = collapsed.name;
        if (collapsed.organizer) {
          organizer = collapsed.organizer;
        }
        if (collapsed.dateRaw) {
          datumRaw = collapsed.dateRaw;
        }
        if (collapsed.categories) {
          categories = collapsed.categories;
        }
      }
    }

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
      team_count: null,
      match_format: null,
      description,
      registration_url: registrationUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'pdf',
      external_id: externalId,
    });
  }

  return out;
}

/**
 * Parse date cells in SvFF district HTML tables (slash dates, Swedish month names).
 * @returns {{ start: string|null, end: string|null, dateText: string }}
 */
function parseSvffTableDateCell(raw, defaultYear = STOCKHOLM_PDF_DEFAULT_YEAR) {
  const full = (raw || '').trim();
  if (!full) {
    return { start: null, end: null, dateText: '' };
  }
  const slash = parseSwedishSlashDateRange(full, defaultYear);
  if (slash.start && slash.end) {
    return { start: slash.start, end: slash.end, dateText: full };
  }
  const sm = parseDatumFieldSmaland(full, defaultYear);
  if (sm.start && sm.end) {
    return sm;
  }
  const st = parseStockholmPdfDateText(full, defaultYear);
  if (st.start && st.end) {
    return { start: st.start, end: st.end, dateText: st.dateText || full };
  }
  return { start: null, end: null, dateText: full };
}

/**
 * Map header row texts to column indices for SvFF cup tables (Västerbotten, Västmanland).
 * @param {string[]} headerTexts
 */
function mapSvffHtmlTableColumns(headerTexts) {
  const m = { name: null, date: null, age: null, org: null, yearCol: null };
  headerTexts.forEach((raw, j) => {
    const t = String(raw || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!t) {
      return;
    }
    if (/cupnamn|cupens namn/i.test(t)) {
      m.name = j;
    } else if (/^datum$/i.test(t)) {
      m.date = j;
    } else if (/åldersgrupp|pojk|flick|P\/F|Pojk\/Flick/i.test(t)) {
      m.age = j;
    } else if (/arrangör|^förening$/i.test(t)) {
      m.org = j;
    } else if (/^20\d{2}$/.test(t)) {
      m.yearCol = j;
    }
  });
  return m;
}

/**
 * Västerbotten / Västmanland: pasted Excel table in .rich-text or inside accordion.
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseSvffTableCups(html, sourceUrl, sourceType) {
  const tableRe = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
  let bestTable = '';
  let tm;
  while ((tm = tableRe.exec(html)) !== null) {
    if (/\bCupnamn\b/i.test(tm[0])) {
      bestTable = tm[0];
      break;
    }
  }
  if (!bestTable) {
    return [];
  }

  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows = [];
  let trm;
  while ((trm = trRe.exec(bestTable)) !== null) {
    const trInner = trm[1];
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    const cells = [];
    let cm;
    while ((cm = cellRe.exec(trInner)) !== null) {
      cells.push({ html: cm[1], text: stripTags(cm[1]) });
    }
    if (cells.length) {
      rows.push(cells);
    }
  }

  let headerIdx = -1;
  let colMap = { name: null, date: null, age: null, org: null, yearCol: null };
  for (let i = 0; i < rows.length; i += 1) {
    const texts = rows[i].map((c) => c.text);
    const joined = texts.join(' | ');
    if (/\bCupnamn\b/i.test(joined)) {
      headerIdx = i;
      colMap = mapSvffHtmlTableColumns(texts);
      break;
    }
  }
  if (headerIdx < 0 || colMap.name == null) {
    return [];
  }

  const defaultYear = STOCKHOLM_PDF_DEFAULT_YEAR;
  const out = [];

  for (let i = headerIdx + 1; i < rows.length; i += 1) {
    const cells = rows[i];
    const texts = cells.map((c) => c.text);
    if (texts.every((x) => !String(x || '').trim())) {
      continue;
    }
    if (/\bCupnamn\b/i.test(texts.join(' '))) {
      continue;
    }

    let dateCol = colMap.date;
    const nameCol = colMap.name;
    const ageCol = colMap.age;
    const orgCol = colMap.org;
    if (dateCol == null && colMap.yearCol != null && nameCol === 1 && texts.length >= 3) {
      dateCol = 0;
    }

    const nameHtml = cells[nameCol]?.html || '';
    const nameText = stripTags(nameHtml).replace(/\s+/g, ' ').trim();
    if (!nameText || /^cupnamn$/i.test(nameText)) {
      continue;
    }

    const dateRaw = dateCol != null && cells[dateCol] ? texts[dateCol] : '';
    const ageText = ageCol != null && cells[ageCol] ? texts[ageCol] : '';
    const orgText = orgCol != null && cells[orgCol] ? texts[orgCol] : '';

    const regUrl = extractExternalUrl(nameHtml) || extractUrlFromCellOrLine(nameHtml);
    const dateParsed = parseSvffTableDateCell(dateRaw, defaultYear);
    const categories = ageText ? ageText : null;
    const desc = [dateRaw, nameText, ageText, orgText].filter(Boolean).join(' · ');

    out.push({
      name: nameText.slice(0, 255),
      organizer: orgText || null,
      location: null,
      start_date: dateParsed.start,
      end_date: dateParsed.end,
      categories,
      team_count: null,
      match_format: null,
      description: desc || null,
      registration_url: regUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: stableExternalId(
        nameText,
        dateParsed.start,
        dateParsed.end,
        regUrl,
        dateParsed.dateText || dateRaw,
      ),
    });
  }

  return out;
}

/**
 * @param {string} h3Plain
 * @returns {{ name: string, organizer: string, start: string|null, end: string|null, dateText: string }|null}
 */
function parseSodermanlandH3Title(h3Plain) {
  const h3Text = String(h3Plain || '')
    .replace(/\s+/g, ' ')
    .trim();
  let m = h3Text.match(/^(.+?),\s*(\d{4})(\d{2})(\d{2})-(\d{2,8})\s*\(([^)]+)\)\s*$/);
  if (m) {
    const name = m[1].trim();
    const y = parseInt(m[2], 10);
    const mo = parseInt(m[3], 10);
    const d = parseInt(m[4], 10);
    const rest = m[5];
    const organizer = m[6].trim();
    const start = isoDate(y, mo, d);
    let end = start;
    let dateText = `${m[2]}${m[3]}${m[4]}-${rest}`;
    if (rest.length === 4) {
      const mo2 = parseInt(rest.slice(0, 2), 10);
      const d2 = parseInt(rest.slice(2, 4), 10);
      if (mo2 >= 1 && mo2 <= 12 && d2 >= 1 && d2 <= 31) {
        end = isoDate(y, mo2, d2);
      }
    } else if (/^\d{1,2}$/.test(rest)) {
      const d2 = parseInt(rest, 10);
      if (d2 >= 1 && d2 <= 31 && d2 > d && d2 - d <= 7) {
        end = isoDate(y, mo, d2);
      }
    }
    return { name, organizer, start, end, dateText };
  }
  /** Missing leading zero before day: "2026034-15" → 4 mars, often end day 15 same month. */
  m = h3Text.match(/^(.+?),\s*(\d{4})(\d{2})(\d)-(\d{1,8})\s*\(([^)]+)\)\s*$/);
  if (m) {
    const name = m[1].trim();
    const y = parseInt(m[2], 10);
    const mo = parseInt(m[3], 10);
    const d = parseInt(m[4], 10);
    const rest = m[5];
    const organizer = m[6].trim();
    const start = isoDate(y, mo, d);
    let end = start;
    if (/^\d{1,2}$/.test(rest)) {
      const d2 = parseInt(rest, 10);
      if (d2 >= 1 && d2 <= 31) {
        end = isoDate(y, mo, d2);
      }
    } else if (rest.length === 4) {
      const mo2 = parseInt(rest.slice(0, 2), 10);
      const d2 = parseInt(rest.slice(2, 4), 10);
      if (mo2 >= 1 && mo2 <= 12 && d2 >= 1 && d2 <= 31) {
        end = isoDate(y, mo2, d2);
      }
    }
    const dateText = `${m[2]}${m[3]}${m[4]}-${rest}`;
    return { name, organizer, start, end, dateText };
  }
  m = h3Text.match(/^(.+?),\s*(\d{8})\s*\(([^)]+)\)\s*$/);
  if (m) {
    const name = m[1].trim();
    const compact = m[2];
    const organizer = m[3].trim();
    const y = parseInt(compact.slice(0, 4), 10);
    const mo = parseInt(compact.slice(4, 6), 10);
    const d = parseInt(compact.slice(6, 8), 10);
    const start = isoDate(y, mo, d);
    return { name, organizer, start, end: start, dateText: compact };
  }
  /** No arranger in parens: "…, 20260328-29" → 28–29 same month. */
  m = h3Text.match(/^(.+?),\s*(\d{4})(\d{2})(\d{2})-(\d{1,2})\s*$/);
  if (m) {
    const name = m[1].trim();
    const y = parseInt(m[2], 10);
    const mo = parseInt(m[3], 10);
    const d1 = parseInt(m[4], 10);
    const d2 = parseInt(m[5], 10);
    if (d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31) {
      const start = isoDate(y, mo, d1);
      const end = isoDate(y, mo, Math.max(d1, d2));
      return {
        name,
        organizer: null,
        start,
        end,
        dateText: `${m[2]}${m[3]}${m[4]}-${m[5]}`,
      };
    }
  }
  return null;
}

/**
 * Södermanland: accordion sections with h3 cup titles (sanction id) and ul/li categories.
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseSodermanlandAccordionCups(html, sourceUrl, sourceType) {
  const blocks = splitAccordionItemBlocks(html);
  const out = [];

  for (const block of blocks) {
    const accTitle = stripTags(extractAccordionTitle(block) || '').trim();
    if (/cupsanktion/i.test(accTitle) || /cupsanktion/i.test(block)) {
      continue;
    }

    const h3Re = /<h3\b[^>]*>([\s\S]*?)<\/h3>/gi;
    let h3Match;
    while ((h3Match = h3Re.exec(block)) !== null) {
      const h3Inner = h3Match[1];
      const h3Start = h3Match.index;
      const afterH3 = h3Start + h3Match[0].length;
      const nextH3Rel = block.slice(afterH3).search(/<h3\b/i);
      const segmentEnd = nextH3Rel === -1 ? block.length : afterH3 + nextH3Rel;
      const segment = block.slice(h3Start, segmentEnd);

      const parsedH3 = parseSodermanlandH3Title(stripTags(h3Inner));
      if (!parsedH3?.name) {
        continue;
      }

      const ulm = segment.match(/<ul\b[^>]*>([\s\S]*?)<\/ul>/i);
      const catItems = [];
      if (ulm) {
        const lim = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
        let lm;
        while ((lm = lim.exec(ulm[1])) !== null) {
          const lt = stripTags(lm[1]).trim();
          if (lt) {
            catItems.push(lt);
          }
        }
      }
      const categories = catItems.length ? catItems.join('; ') : null;
      const desc =
        categories ||
        stripTags(extractAccordionContentAllParagraphsInnerHtml(segment)).slice(0, 800) ||
        null;

      out.push({
        name: parsedH3.name.slice(0, 255),
        organizer: parsedH3.organizer || null,
        location: null,
        start_date: parsedH3.start,
        end_date: parsedH3.end,
        categories,
        team_count: null,
        match_format: null,
        description: desc,
        registration_url: null,
        source_url: sourceUrl || null,
        source_type: sourceType || 'html',
        external_id: stableExternalId(
          parsedH3.name,
          parsedH3.start,
          parsedH3.end,
          null,
          parsedH3.dateText,
        ),
      });
    }
  }

  return out;
}

/** True if the whole segment is only date tokens (comma-joined ranges, "och", month names). */
function looksLikeOstergotlandDateOnly(s) {
  const t = String(s || '').trim();
  if (!/^\d/.test(t)) {
    return false;
  }
  const monthRe =
    /\bjan(?:uari)?|feb(?:ruari)?|mars|apr(?:il)?|maj|jun(?:i)?|jul(?:i)?|aug(?:usti)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?\.?/gi;
  const normalized = t
    .replace(monthRe, ' ')
    .replace(/\boch\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return /^[\d\s,\/\-]+$/.test(normalized);
}

/**
 * "14/5 - 17/5 Norrköping City Cup" (no comma before name when an &lt;a&gt; follows the date).
 * @returns {{ date: string, rest: string } | null}
 */
function trySplitLeadingDateFromOstergotlandPart(s) {
  const t = String(s || '').trim();
  const m = t.match(
    /^([\d\s,\/\-]+(?:\s+och\s+[\d\s,\/\-]+)+|[\d\s,\/\-]+)\s+([A-Za-zÅÄÖåäö].*)$/i,
  );
  if (!m) {
    return null;
  }
  const date = m[1].trim();
  const rest = m[2].trim();
  if (!/[\d/]/.test(date) || !looksLikeOstergotlandDateOnly(date)) {
    return null;
  }
  return { date, rest };
}

/** Flera datum i samma rad, t.ex. "17 - 18/1, 24/1". */
function parseOstergotlandDateRaw(dateRaw, defaultYear) {
  const full = String(dateRaw || '').trim();
  if (!full) {
    return { start: null, end: null };
  }
  const segments = full
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  let start = null;
  let end = null;
  for (const seg of segments) {
    const ochParts = seg
      .split(/\s+och\s+/i)
      .map((x) => x.trim())
      .filter(Boolean);
    const subSegs = ochParts.length > 1 ? ochParts : [seg];
    for (const sub of subSegs) {
      const d = parseSwedishSlashDateRange(sub, defaultYear);
      if (d.start && d.end) {
        if (!start || d.start < start) {
          start = d.start;
        }
        if (!end || d.end > end) {
          end = d.end;
        }
        continue;
      }
      const sm = parseDatumFieldSmaland(sub, defaultYear);
      if (sm.start && sm.end) {
        if (!start || sm.start < start) {
          start = sm.start;
        }
        if (!end || sm.end > end) {
          end = sm.end;
        }
        continue;
      }
      const st = parseStockholmPdfDateText(sub, defaultYear);
      if (st.start && st.end) {
        if (!start || st.start < start) {
          start = st.start;
        }
        if (!end || st.end > end) {
          end = st.end;
        }
      }
    }
  }
  if (!start) {
    const st = parseStockholmPdfDateText(full, defaultYear);
    start = st.start;
    end = st.end;
  }
  return { start, end };
}

/**
 * @param {string} liHtml
 * @param {string} _monthHint
 * @param {number} defaultYear
 */
function parseOstergotlandListItem(liHtml, _monthHint, defaultYear) {
  let t = String(liHtml || '').replace(/<br\s*\/?>/gi, ', ');
  let match_format = null;
  const plain = stripTags(t).replace(/\s+/g, ' ').trim();
  let rest = plain.replace(/^[-*•]\s*/, '').trim();
  rest = rest.replace(/(\S)\.\s+(?=[A-Za-zÅÄÖåäö])/g, '$1, ');

  if (/\bFutsal\s*$/i.test(rest)) {
    match_format = 'Futsal';
    rest = rest
      .replace(/\bFutsal\s*$/i, '')
      .trim()
      .replace(/,\s*$/, '');
  } else if (/\bFotboll\s*$/i.test(rest)) {
    match_format = 'Fotboll';
    rest = rest
      .replace(/\bFotboll\s*$/i, '')
      .trim()
      .replace(/,\s*$/, '');
  }

  const parts = rest
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  let i = 0;
  const dateParts = [];
  while (i < parts.length && looksLikeOstergotlandDateOnly(parts[i])) {
    dateParts.push(parts[i]);
    i += 1;
  }
  let remainder;
  if (dateParts.length === 0 && parts.length > 0) {
    const sp = trySplitLeadingDateFromOstergotlandPart(parts[0]);
    if (!sp) {
      return null;
    }
    dateParts.push(sp.date);
    remainder = [sp.rest, ...parts.slice(1)];
  } else {
    remainder = parts.slice(i);
  }
  if (dateParts.length === 0 || remainder.length === 0) {
    return null;
  }

  const dateRaw = dateParts.join(', ');
  let name = '';
  let organizer = '';
  let categories = null;

  if (remainder.length >= 3) {
    name = remainder[0];
    categories = remainder[1];
    organizer = remainder.slice(2).join(', ');
  } else if (remainder.length === 2) {
    name = remainder[0];
    organizer = remainder[1];
  } else {
    name = remainder[0];
  }

  const regUrl = extractExternalUrl(liHtml) || extractUrlFromCellOrLine(liHtml);
  const { start, end } = parseOstergotlandDateRaw(dateRaw, defaultYear);

  return {
    name: name.slice(0, 255),
    organizer: organizer || null,
    location: null,
    start_date: start,
    end_date: end,
    categories: categories || null,
    team_count: null,
    match_format,
    description: plain.slice(0, 2000),
    registration_url: regUrl,
  };
}

/**
 * Östergötland: accordion per year, month strong + ul/li lines.
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseSvffYearMonthListCups(html, sourceUrl, sourceType) {
  const blocks = splitAccordionItemBlocks(html);
  const out = [];

  for (const block of blocks) {
    const title = stripTags(extractAccordionTitle(block) || '').trim();
    if (/cupsanktion/i.test(title)) {
      continue;
    }
    if (!/^20\d{2}$/.test(title)) {
      continue;
    }
    const defaultYear = parseInt(title, 10);
    const monthUlRe = /<p[^>]*>\s*<strong>([^<]+)<\/strong>\s*<\/p>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi;
    let mm;
    while ((mm = monthUlRe.exec(block)) !== null) {
      const monthToken = mm[1].replace(/\.$/, '').trim();
      const ulInner = mm[2];
      const liRe = /<li\b[^>]*>([\s\S]*?)<\/li>/gi;
      let liM;
      while ((liM = liRe.exec(ulInner)) !== null) {
        const row = parseOstergotlandListItem(liM[1], monthToken, defaultYear);
        if (row && row.name) {
          if (row.match_format === 'Futsal') {
            continue;
          }
          if (
            row.match_format !== 'Fotboll' &&
            /,\s*Futsal\s*\.?\s*$/i.test(String(row.description || '').trim())
          ) {
            continue;
          }
          out.push({
            name: row.name,
            organizer: row.organizer,
            location: row.location,
            start_date: row.start_date,
            end_date: row.end_date,
            categories: row.categories,
            team_count: row.team_count,
            match_format: row.match_format,
            description: row.description,
            registration_url: row.registration_url,
            source_url: sourceUrl || null,
            source_type: sourceType || 'html',
            external_id: stableExternalId(
              row.name,
              row.start_date,
              row.end_date,
              row.registration_url,
              row.description,
            ),
          });
        }
      }
    }
  }

  return out;
}

/**
 * Ångermanland-style: repeated <p> blocks with "Tävling/ Cup:" labels.
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function stripHtmlScriptsAndStyles(html) {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

function parseAngermanlandLabeledCups(html, sourceUrl, sourceType) {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const slice = stripHtmlScriptsAndStyles(decodeHtmlEntities(mainMatch ? mainMatch[1] : html));
  const re = /Tävling\s*\/\s*Cup\s*:/gi;
  const starts = [];
  let m;
  while ((m = re.exec(slice)) !== null) {
    starts.push(m.index);
  }
  if (starts.length === 0) {
    return [];
  }

  const out = [];
  for (let s = 0; s < starts.length; s += 1) {
    const from = starts[s];
    const to = s + 1 < starts.length ? starts[s + 1] : slice.length;
    const block = slice.slice(from, to);

    const nameM = block.match(
      /Tävling\s*\/\s*Cup\s*:\s*([\s\S]*?)(?=Tävling\s*\/\s*Cup\s*spelas\s*:|$)/i,
    );
    let name = nameM ? stripTags(nameM[1]).replace(/\s+/g, ' ').trim() : '';
    name = name.replace(/\.\s*$/, '');
    if (!name) {
      continue;
    }

    const spelasM = block.match(
      /Tävling\s*\/\s*Cup\s*spelas\s*:\s*([\s\S]*?)(?=Spelplats|Tävlingskategori|Tävlingen)/i,
    );
    const dateRaw = spelasM ? stripTags(spelasM[1]).replace(/\s+/g, ' ').trim() : '';

    const platsM = block.match(/Spelplats\s*[;:]\s*([\s\S]*?)(?=Tävlingskategori|Tävlingen)/i);
    const location = platsM ? stripTags(platsM[1]).replace(/\s+/g, ' ').trim() : null;

    const tavKatM = block.match(/Tävlingskategori\s*:\s*([\s\S]*?)(?=Tävlingen)/i);
    const tavKat = tavKatM ? stripTags(tavKatM[1]).replace(/\s+/g, ' ').trim() : '';

    /** Stop at next cup label (same &lt;p&gt;) or closing &lt;/p&gt; — last cup's block runs to end of &lt;main&gt; otherwise ads/footer leak into categories. */
    const foljM = block.match(
      /Tävlingen\s*\/\s*Cupen\s+gäller\s+följande\s+kategori\s*:\s*([\s\S]*?)(?=Tävling\s*\/\s*Cup\s*:|<\/p>|$)/i,
    );
    let categories = foljM ? stripTags(foljM[1]).replace(/\s+/g, ' ').trim() : null;
    if (categories) {
      categories = categories
        .replace(/\bCuper\s+Tillståndsansökan\b.*$/i, '')
        .replace(/\bTillståndsansökan\b.*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    if (categories === '') {
      categories = null;
    }

    let match_format = null;
    if (/futsal/i.test(tavKat)) {
      match_format = 'Futsal';
    } else if (/fotboll/i.test(tavKat)) {
      match_format = 'Fotboll';
    }

    const sm = parseDatumFieldSmaland(dateRaw, STOCKHOLM_PDF_DEFAULT_YEAR);
    const df = parseDatumField(dateRaw);
    const aw = parseAngermanlandSlashWeekendRanges(dateRaw, STOCKHOLM_PDF_DEFAULT_YEAR);
    const start = sm.start || df.start || aw.start;
    const end = sm.end || df.end || aw.end;

    const desc = [dateRaw, location, tavKat, categories].filter(Boolean).join('\n');

    out.push({
      name: name.slice(0, 255),
      organizer: null,
      location: location || null,
      start_date: start,
      end_date: end,
      categories: categories || null,
      team_count: null,
      match_format,
      description: desc || null,
      registration_url: extractExternalUrl(block) || extractUrlFromCellOrLine(block),
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: stableExternalId(name, start, end, null, dateRaw || desc),
    });
  }

  return out;
}

/**
 * Uppland (Arr. förening + strong date line) and Jämtland (Cuper YYYY + prose paragraphs).
 * @param {string} html
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseSvffParagraphListCups(html, sourceUrl, sourceType) {
  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  const rawSlice = mainMatch ? mainMatch[1] : html;
  const slice = decodeHtmlEntities(rawSlice);

  if (/Arr\.\s*förening\s*:/i.test(slice)) {
    return parseUpplandParagraphCups(slice, sourceUrl, sourceType);
  }

  return parseJamtlandParagraphCups(slice, sourceUrl, sourceType);
}

/**
 * @param {string} htmlFragment
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseUpplandParagraphCups(htmlFragment, sourceUrl, sourceType) {
  const out = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRe.exec(htmlFragment)) !== null) {
    const inner = pm[1];
    if (!/Arr\.\s*förening\s*:/i.test(inner)) {
      continue;
    }
    const sm = inner.match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i);
    if (!sm) {
      continue;
    }
    const head = stripTags(sm[1]).replace(/\s+/g, ' ').trim();
    const dm = head.match(
      /^(\d{1,2}\/\d{1,2}(?:\s*-\s*\d{1,2}\/\d{1,2})?|\d{1,2}\/\d{1,2}-\d{1,2}\/\d{1,2})\s+(.+)$/,
    );
    if (!dm) {
      continue;
    }
    const dateRaw = dm[1].trim();
    const cupName = dm[2].trim();
    const orgM = inner.match(/Arr\.\s*förening\s*:\s*([^<\n]+)/i);
    const organizer = orgM ? stripTags(orgM[1]).replace(/\s+/g, ' ').trim() : '';

    const regUrl = extractExternalUrl(inner) || extractUrlFromCellOrLine(inner);
    const dateRawClean = dateRaw.trim();
    let start = null;
    let end = null;
    const dmRange = dateRawClean.match(
      /^(\d{1,2}\/\d{1,2})\s*[-–]\s*(\d{1,2}\/\d{1,2})(?:\s+(\d{4}))?$/,
    );
    if (dmRange) {
      const y = dmRange[3] ? parseInt(dmRange[3], 10) : STOCKHOLM_PDF_DEFAULT_YEAR;
      const a = parseSwedishSlashDateRange(dmRange[1], y);
      const b = parseSwedishSlashDateRange(dmRange[2], y);
      if (a.start && b.end) {
        start = a.start;
        end = b.end;
      }
    } else {
      const pr = parseSwedishSlashDateRange(dateRawClean, STOCKHOLM_PDF_DEFAULT_YEAR);
      start = pr.start;
      end = pr.end;
    }
    if (!start) {
      const smd = parseDatumFieldSmaland(dateRawClean, STOCKHOLM_PDF_DEFAULT_YEAR);
      start = smd.start;
      end = smd.end;
    }

    out.push({
      name: cupName.slice(0, 255),
      organizer: organizer || null,
      location: null,
      start_date: start,
      end_date: end,
      categories: null,
      team_count: null,
      match_format: null,
      description: stripTags(inner).slice(0, 1500),
      registration_url: regUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: stableExternalId(cupName, start, end, regUrl, dateRaw),
    });
  }
  return out;
}

/**
 * @param {string} htmlFragment
 * @param {string|null|undefined} sourceUrl
 * @param {string|null|undefined} sourceType
 */
function parseJamtlandParagraphCups(htmlFragment, sourceUrl, sourceType) {
  let defaultYear = STOCKHOLM_PDF_DEFAULT_YEAR;
  let startIdx = 0;
  const h2HeadingRe = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  let h2m;
  while ((h2m = h2HeadingRe.exec(htmlFragment)) !== null) {
    const innerPlain = stripTags(h2m[1]).replace(/\s+/g, ' ').trim();
    const ym = innerPlain.match(/^Cuper\s+(\d{4})\b/i);
    if (ym) {
      defaultYear = parseInt(ym[1], 10);
      startIdx = h2m.index + h2m[0].length;
      break;
    }
  }
  const rest = htmlFragment.slice(startIdx);
  const nextH2 = rest.search(/<h2\b/i);
  const section = nextH2 >= 0 ? rest.slice(0, nextH2) : rest;

  const out = [];
  const pRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let pm;
  while ((pm = pRe.exec(section)) !== null) {
    const inner = pm[1];
    const text = stripTags(inner).replace(/\s+/g, ' ').trim();
    if (text.length < 12 || /^vi fyller/i.test(text) || /^här listas/i.test(text)) {
      continue;
    }
    const regUrl = extractExternalUrl(inner) || extractUrlFromCellOrLine(inner);
    let name = text;
    let dateRaw = '';
    /** Full + short Swedish months (SvFF uses "april", "augusti", etc. — not just "apr"). */
    const svMonth =
      '(?:jan(?:uari)?|feb(?:ruari)?|mars|apr(?:il)?|maj|jun(?:i)?|jul(?:i)?|aug(?:usti)?|sep(?:tember)?|okt(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
    const dateTail = text.match(
      new RegExp(
        `\\s*[-–]\\s*((?:\\d{1,2}\\s*${svMonth}\\b[^.]*(?:\\.\\s*)?)+|(?:\\d{1,2}\\s*[-–]\\s*\\d{1,2}\\s*${svMonth}\\b[^.]*)|(?:\\d{1,2}\\s*${svMonth}\\b\\s*[-–]\\s*\\d{1,2}\\s*${svMonth}\\b[^.]*))`,
        'i',
      ),
    );
    if (dateTail) {
      dateRaw = dateTail[1].trim().replace(/\.\s*$/, '');
      name = text.slice(0, dateTail.index).trim();
    }
    const sm = parseDatumFieldSmaland(dateRaw, defaultYear);
    let start = sm.start;
    let end = sm.end;
    if (!start && dateRaw) {
      if (/\boch\b/i.test(dateRaw)) {
        const parts = dateRaw
          .split(/\s+och\s+/i)
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length === 2) {
          const a = parseDatumFieldSmaland(parts[0], defaultYear);
          const b = parseDatumFieldSmaland(parts[1], defaultYear);
          if (a.start && b.start) {
            start = a.start;
            end = b.end || b.start;
          }
        }
      }
      if (!start) {
        const cross = dateRaw.match(
          /^(\d{1,2})\s+([a-zåäö]+)\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)\s*\.?$/i,
        );
        if (cross) {
          const mo1 = resolveSwedishMonth(cross[2]);
          const mo2 = resolveSwedishMonth(cross[4]);
          const d1 = parseInt(cross[1], 10);
          const d2 = parseInt(cross[3], 10);
          const y = defaultYear;
          if (mo1 && mo2 && d1 >= 1 && d1 <= 31 && d2 >= 1 && d2 <= 31) {
            start = toIsoDate(y, mo1, d1);
            end = toIsoDate(y, mo2, d2);
          }
        }
      }
    }

    out.push({
      name: name.slice(0, 255) || text.slice(0, 255),
      organizer: null,
      location: null,
      start_date: start,
      end_date: end,
      categories: null,
      team_count: null,
      match_format: null,
      description: text.slice(0, 2000),
      registration_url: regUrl,
      source_url: sourceUrl || null,
      source_type: sourceType || 'html',
      external_id: stableExternalId(name || text, start, end, regUrl, dateRaw || text),
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
      team_count: null,
      match_format: null,
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
  parseLabeledPlaintextPdfCups,
  parseBohuslanHtmlListCups,
  parseSvffTableCups,
  parseSodermanlandAccordionCups,
  parseSvffYearMonthListCups,
  parseAngermanlandLabeledCups,
  parseSvffParagraphListCups,
};
