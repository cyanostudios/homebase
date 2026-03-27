// plugins/cups/scraper.js
// Scrapes Swedish football cup listings from HTML pages or uploaded files.
// Strategy: fetch HTML with axios, parse with cheerio, then apply heuristics to
// extract cup/tournament rows. Puppeteer is intentionally NOT used to keep the
// server lightweight and avoid browser-binary deps in production.

const axios = require('axios');
const cheerio = require('cheerio');
const { Logger } = require('@homebase/core');

// ─── Normalise helpers ────────────────────────────────────────────────────────

function trimOrNull(value) {
  if (!value) return null;
  const s = String(value).replace(/\s+/g, ' ').trim();
  return s.length ? s : null;
}

function extractYear(text) {
  const m = String(text).match(/\b(20\d{2})\b/);
  return m ? m[1] : null;
}

function parseDate(text) {
  if (!text) return null;
  // Matches "2025-08-15", "15/8 2025", "15 aug 2025", "August 15, 2025" etc.
  const iso = String(text).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const swe = String(text).match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.\s]+(\d{4})/);
  if (swe) {
    const y = swe[3];
    const m = swe[2].padStart(2, '0');
    const d = swe[1].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return null;
}

// Detect date ranges like "15-17 aug 2025" or "15/8–17/8 2025"
function parseDateRange(text) {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  const isoRange = clean.match(
    /(\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{4}-\d{2}-\d{2})/,
  );
  if (isoRange) {
    return { start: isoRange[1], end: isoRange[2] };
  }
  const start = parseDate(clean);
  const year = extractYear(clean);
  const endM = clean.match(/[-–]\s*(\d{1,2})[\/\-\.](\d{1,2})(?:\s+(\d{4}))?/);
  if (endM && year) {
    const ey = endM[3] || year;
    const end = `${ey}-${endM[2].padStart(2, '0')}-${endM[1].padStart(2, '0')}`;
    return { start, end };
  }
  return { start, end: null };
}

function sourceLabelFromUrl(sourceUrl) {
  try {
    if (!sourceUrl) return 'källa';
    if (sourceUrl.startsWith('file://')) {
      return sourceUrl.replace(/^file:\/\//, '').split('/').pop() || 'fil';
    }
    return new URL(sourceUrl).hostname.replace(/^www\./, '') || 'källa';
  } catch {
    return 'källa';
  }
}

const MONTH_MAP = {
  jan: '01',
  januari: '01',
  feb: '02',
  februari: '02',
  mar: '03',
  mars: '03',
  apr: '04',
  april: '04',
  maj: '05',
  jun: '06',
  juni: '06',
  jul: '07',
  juli: '07',
  aug: '08',
  augusti: '08',
  sep: '09',
  sept: '09',
  september: '09',
  okt: '10',
  oktober: '10',
  nov: '11',
  november: '11',
  dec: '12',
  december: '12',
};

function normaliseUrl(value, sourceUrl) {
  const text = String(value || '').trim();
  if (!text) return null;
  const m = text.match(/https?:\/\/\S+/i);
  if (m) return m[0];
  if (/^\/\S+/.test(text) && sourceUrl && /^https?:\/\//i.test(sourceUrl)) {
    try {
      return new URL(text, sourceUrl).href;
    } catch {
      return null;
    }
  }
  return null;
}

function pickFirstNonEmpty(values) {
  for (const value of values) {
    const trimmed = trimOrNull(value);
    if (trimmed) return trimmed;
  }
  return null;
}

function extractLabeledValue(raw, labels) {
  if (!raw || !Array.isArray(labels) || labels.length === 0) return null;
  const lines = String(raw)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const labelRe = new RegExp(`(?:${labels.join('|')})\\s*[:\\-–]\\s*(.+)$`, 'i');
  for (const line of lines) {
    const match = line.match(labelRe);
    if (match?.[1]) {
      return trimOrNull(match[1]);
    }
  }
  return null;
}

/**
 * Sites like skaneboll.se concatenate "Arrangör: … Cup/tävling: … Datum: …" on one line
 * when Cheerio flattens inline markup. Split before known labels so extractLabeledValue
 * sees one field per line and names/dates do not merge into bogus duplicates.
 */
function splitInlineLabels(text) {
  const s = String(text || '');
  if (!s) return s;
  return s.replace(
    /(?<=\S)(?=(?:Arrangör|Cup\/tävling|Tävlingens namn|Datum|Kategorier|Spelort|Ort|Region|Klass(?:er)?|Ålder|Spelform|Antal lag|Categories|Anmäl(?:ning)?|Anmälan)\s*:)/gi,
    '\n',
  );
}

/** When labels are glued without spaces (e.g. "BaracupenDatum: …"), keep only the title part. */
function stripGluedLabelTail(name) {
  const s = String(name || '').trim();
  if (!s) return s;
  const first = s
    .replace(/\s+/g, ' ')
    .split(/\s*(?=Datum\s*:|Kategorier\s*:|Cup\/tävling\s*:)/i)[0]
    .trim();
  return first.length >= 2 && first.length < s.length ? first : s;
}

function cleanGluedCupName(name) {
  const s = stripGluedLabelTail(name);
  return trimOrNull(s);
}

/** Strip leading calendar lines like "12/9 - Cup" / "14-16/8 Name" so merge matches main text titles. */
function stripLeadingDateTitlePrefix(name) {
  let s = String(name || '').trim();
  if (!s) return s;
  let m = s.match(/^(\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\s*20\d{2})\s+(.+)$/i);
  if (m?.[2] && m[2].trim().length > 2) return m[2].trim();
  m = s.match(/^(\d{1,2}-\d{1,2}\/\d{1,2})\s+(.+)$/i);
  if (m?.[2] && m[2].trim().length > 2) return m[2].trim();
  m = s.match(/^(\d{1,2}(?:-\d{1,2})?\/\d{1,2}(?:\s*-\s*\d{1,2}\/\d{1,2})*)\s*[-–]\s*(.+)$/i);
  if (m?.[2] && m[2].trim().length > 2) return m[2].trim();
  m = s.match(/^(\d{1,2}(?:-\d{1,2})?\/\d{1,2}(?:\s*-\s*\d{1,2}\/\d{1,2})*)\s+(.+)$/i);
  if (m?.[2] && m[2].trim().length > 2 && !/^(jan|feb|mars|april|maj|juni|juli|aug|sep|okt|nov|dec)\b/i.test(m[2]))
    return m[2].trim();
  m = s.match(/^(\d{1,2}(?:-\d{1,2})?\/\d{1,2}(?:\s*&\s*\d{1,2}\/\d{1,2})+)\s*[-–]\s*(.+)$/i);
  if (m?.[2] && m[2].trim().length > 2) return m[2].trim();
  m = s.match(/^(\d{1,2}\/\d{1,2}\s*-\s*\d{1,2}\/\d{1,2}\s*)\s*(.+)$/i);
  if (m?.[2] && m[2].trim().length > 2 && !/^\d{4}\s*$/.test(m[2].trim())) return m[2].trim();
  return s;
}

/** Stable key when the same cup appears with glued vs split labels (dedupe / merge). */
function canonicalCupNameKey(name) {
  let s = stripGluedLabelTail(String(name || '').trim().toLowerCase().replace(/\s+·\s+.+$/, ''));
  s = stripLeadingDateTitlePrefix(s).toLowerCase();
  s = s.replace(/\s+(20\d{2})$/i, '').trim();
  return s;
}

/** Sidebar / submenu titles on district sites (not a cup row). */
function isNavCupHeading(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^cuper$/i.test(t)) return true;
  if (/^cupsanktioner$/i.test(t)) return true;
  if (/^cupinformation$/i.test(t)) return true;
  if (/^cupsida$/i.test(t)) return true;
  if (/^(futsalcuper|fotbollscuper|gåfotbollscuper)(\b|[\s\/\d])/i.test(t)) return true;
  if (/^sök\s+tillstånd\s+för\s+tävling$/i.test(t)) return true;
  if (/^tävlingar\s+med\s+tillstånd/i.test(t)) return true;
  if (/^till\s+cupen$/i.test(t)) return true;
  if (/^länk till cupen/i.test(t)) return true;
  if (/^\s*function\s/i.test(t)) return true;
  return false;
}

/** Final pass: drop fragments mistaken for cups (link stubs, field-only titles). */
function shouldKeepScrapedCup(cup) {
  const n = String(cup?.name || '').trim();
  if (!n) return false;
  if (/^(ålder|datum|antal lag|spelform|arrangör|kategorier|tävlingens namn)\s*:/i.test(n)) return false;
  if (/^(cupsanktioner|cuper|cupinformation|cupsida)$/i.test(n)) return false;
  if (/^(futsalcuper|fotbollscuper|gåfotbollscuper)(\b|[\s\/\d])/i.test(n)) return false;
  if (/^länk till cupen/i.test(n)) return false;
  if (/^mer information$/i.test(n)) return false;
  return true;
}

function extractNameCandidate(raw) {
  const lines = String(raw || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  for (const line of lines) {
    if (line.length < 4 || line.length > 140) continue;
    if (/^https?:\/\//i.test(line)) continue;
    if (/(datum|arrangör|organizer|plats|location|ort|ålder|klass)\s*:/i.test(line)) continue;
    if (/(cup|turnering|tävling|futsal|p\d{1,2}\b|f\d{1,2}\b)/i.test(line)) {
      return trimOrNull(line.replace(/[|;].*$/, '').trim());
    }
  }
  return null;
}

function parseDateWithMonthName(text) {
  const clean = String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  const m = clean.match(/(\d{1,2})\s+([a-zåäö]+)\s*(20\d{2})?/i);
  if (!m) return null;
  const day = String(m[1]).padStart(2, '0');
  const month = MONTH_MAP[m[2].toLowerCase()];
  if (!month) return null;
  const year = m[3] || String(new Date().getFullYear());
  return `${year}-${month}-${day}`;
}

function parseDateRangeLoose(text) {
  const direct = parseDateRange(text);
  if (direct.start) return direct;
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { start: null, end: null };

  const startMonth = parseDateWithMonthName(clean);
  const rangeWithMonth = clean.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([a-zåäö]+)\s*(20\d{2})?/i);
  if (rangeWithMonth) {
    const month = MONTH_MAP[rangeWithMonth[3].toLowerCase()];
    const year = rangeWithMonth[4] || String(new Date().getFullYear());
    if (month) {
      return {
        start: `${year}-${month}-${String(rangeWithMonth[1]).padStart(2, '0')}`,
        end: `${year}-${month}-${String(rangeWithMonth[2]).padStart(2, '0')}`,
      };
    }
  }

  return { start: startMonth, end: null };
}

function normaliseAgeGroups(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
}

function inferGenderFromText(raw) {
  const text = String(raw || '').toLowerCase();
  const labels = [];
  if (/(flickor|f\d{1,2}\b|f-\d{1,2}\b|girls?|dam|da\b|d\b|kvinnor|g\d{1,2}\b|g-\d{1,2}\b)/i.test(text))
    labels.push('F');
  if (/(pojkar|p\d{1,2}\b|p-\d{1,2}\b|boys?|herr|ha\b|h\b|män|b\d{1,2}\b|b-\d{1,2}\b)/i.test(text))
    labels.push('P');
  if (labels.length === 0 && /(mix|mixed|coed)/i.test(text)) labels.push('Mix');
  return labels.length ? labels.join('/') : null;
}

function inferCategoryFromText(raw) {
  const text = String(raw || '').toLowerCase();
  if (/(futsal|inomhusfotboll)/i.test(text)) return 'futsal';
  if (/(beach|beachsoccer|beach soccer)/i.test(text)) return 'beach soccer';
  if (/(gåfotboll|walking football)/i.test(text)) return 'walking football';
  return null;
}

function inferAgeGroupsFromText(raw) {
  const text = String(raw || '');
  const matches = new Set();
  const re = /\b(?:[PF]\s*-?\s*\d{1,2}|[PF]\s*-?\s*20\d{2}|U\s*-?\s*\d{1,2})\b/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    matches.add(m[0].replace(/\s+/g, '').replace('-', ''));
  }
  return matches.size > 0 ? Array.from(matches).join(', ') : null;
}

function extractRegistrationUrlFromRaw(raw, sourceUrl) {
  const lines = String(raw || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (!/(anmäl|anmälan|register|registration|sign up|länk till cup|cupsida|hemsida)/i.test(line)) continue;
    const url = normaliseUrl(line, sourceUrl);
    if (url) return url;
  }
  for (const line of lines) {
    const url = normaliseUrl(line, sourceUrl);
    if (url) return url;
  }
  return null;
}

function buildCupFromLabeledBlock(block, sourceUrl) {
  const raw = normaliseRawBlock(block);
  if (!raw) return null;

  const name = extractLabeledValue(raw, [
    'cup\\/tävling',
    'tävlingens namn',
    'tävling',
    'cupnamn',
    'cup',
  ]);
  if (!name) return null;

  const organizer = extractLabeledValue(raw, [
    'arrangör',
    'arrangerande förening',
    'förening',
    'organizer',
    'anordnare',
  ]);
  const location = extractLabeledValue(raw, ['spelort', 'ort', 'plats', 'arena', 'venue', 'location']);
  const region = extractLabeledValue(raw, ['region', 'distrikt', 'district']);
  const age = pickFirstNonEmpty([
    extractLabeledValue(raw, ['ålder', 'åldersklass', 'åldersklasser', 'klass', 'klasser']),
    extractLabeledValue(raw, ['kategorier', 'kategori', 'categories']),
    inferAgeGroupsFromText(raw),
  ]);
  const dateValue = extractLabeledValue(raw, ['datum', 'speldatum', 'period', 'when']) || raw;
  const { start, end } = parseDateRangeLoose(dateValue);
  const gender = inferGenderFromText(raw);
  const ageWithGender =
    age && gender && !new RegExp(`\\b${gender}\\b`, 'i').test(age) ? `${age} (${gender})` : age;

  return {
    name: trimOrNull(name),
    organizer: trimOrNull(organizer),
    location: trimOrNull(location),
    region: trimOrNull(region),
    age_groups: ageWithGender ? normaliseAgeGroups(ageWithGender) : null,
    start_date: start || null,
    end_date: end || null,
    registration_url: extractRegistrationUrlFromRaw(raw, sourceUrl),
    source_url: sourceUrl,
    raw_snippet: raw,
    scraped_at: new Date().toISOString(),
  };
}

function countStructuredFields(cup) {
  let count = 0;
  if (trimOrNull(cup?.name)) count += 1;
  if (trimOrNull(cup?.start_date)) count += 1;
  if (trimOrNull(cup?.end_date)) count += 1;
  if (trimOrNull(cup?.location)) count += 1;
  if (trimOrNull(cup?.region)) count += 1;
  if (trimOrNull(cup?.organizer)) count += 1;
  if (trimOrNull(cup?.age_groups)) count += 1;
  if (trimOrNull(cup?.registration_url)) count += 1;
  return count;
}

function enrichCupFromRaw(cup) {
  if (!cup || !cup.raw_snippet) return cup;
  const raw = splitInlineLabels(normaliseRawBlock(cup.raw_snippet));
  if (!raw) return cup;

  const nameFromLabel = extractLabeledValue(raw, [
    'cup\\/tävling',
    'tävlingens namn',
    'cupnamn',
    'tävling',
    'cup',
  ]);
  const dateLabel = extractLabeledValue(raw, ['datum', 'speldatum', 'period', 'when']);
  const locationLabel = extractLabeledValue(raw, ['spelort', 'ort', 'plats', 'arena', 'venue', 'location']);
  const organizerLabel = extractLabeledValue(raw, [
    'arrangör',
    'arrangerande förening',
    'förening',
    'organizer',
    'anordnare',
  ]);
  const ageLabel = extractLabeledValue(raw, ['ålder', 'åldersklass', 'åldersklasser', 'klass', 'klasser', 'age groups?']);
  const regionLabel = extractLabeledValue(raw, ['region', 'distrikt', 'district']);
  const registrationLabel = extractLabeledValue(raw, ['anmälan', 'anmälningslänk', 'register', 'registration']);
  const inferredAge = inferAgeGroupsFromText(raw);
  const inferredGender = inferGenderFromText(raw);
  const inferredCategory = inferCategoryFromText(raw);

  const derivedDateSource = dateLabel || raw;
  const { start, end } = parseDateRangeLoose(derivedDateSource);
  const mergedAge = pickFirstNonEmpty([cup.age_groups, ageLabel, inferredAge]);
  const ageWithGender =
    mergedAge && inferredGender && !new RegExp(`\\b${inferredGender}\\b`, 'i').test(mergedAge)
      ? `${mergedAge} (${inferredGender})`
      : mergedAge;
  const registrationFromRaw = extractRegistrationUrlFromRaw(raw, cup.source_url);

  return {
    ...cup,
    name: pickFirstNonEmpty([
      nameFromLabel,
      cleanGluedCupName(cup.name),
      extractNameCandidate(raw),
      cup.name,
    ]),
    start_date: cup.start_date || start || cup.start_date,
    end_date: cup.end_date || end || cup.end_date,
    location: pickFirstNonEmpty([cup.location, locationLabel]),
    region: pickFirstNonEmpty([cup.region, regionLabel]),
    organizer: pickFirstNonEmpty([cup.organizer, organizerLabel]),
    age_groups: ageWithGender ? normaliseAgeGroups(ageWithGender) : cup.age_groups,
    sport_type: cup.sport_type || inferredCategory || 'football',
    registration_url:
      cup.registration_url ||
      normaliseUrl(registrationLabel, cup.source_url) ||
      registrationFromRaw ||
      cup.registration_url,
  };
}

function dedupeByBestQuality(cups) {
  const byKey = new Map();
  const makeKey = (cup) => {
    const source = String(cup?.source_url || '')
      .trim()
      .toLowerCase();
    const name = canonicalCupNameKey(cup?.name);
    const start = String(cup?.start_date || '').trim().toLowerCase();
    return `${source}|${name}|${start}`;
  };

  for (const cup of cups || []) {
    if (!cup) continue;
    const key = makeKey(cup);
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, cup);
      continue;
    }
    const prevScore = countStructuredFields(prev);
    const nextScore = countStructuredFields(cup);
    if (nextScore > prevScore) {
      byKey.set(key, { ...cup, raw_snippet: cup.raw_snippet || prev.raw_snippet || null });
    } else if (prevScore === nextScore && !prev.raw_snippet && cup.raw_snippet) {
      byKey.set(key, { ...prev, raw_snippet: cup.raw_snippet });
    }
  }
  return Array.from(byKey.values());
}

/**
 * When the same tournament appears twice (full main block vs heading stub with "12/9 - …" in the title),
 * keep the row with more fields / organizer. If distinct start_dates exist for the same name, keep all.
 */
function mergeDuplicateCanonicalNamesWhenCompatible(cups) {
  const groups = new Map();
  for (const c of cups || []) {
    const k = `${String(c?.source_url || '').toLowerCase()}|${canonicalCupNameKey(c?.name)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const out = [];
  for (const [, list] of groups) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const dates = new Set(list.map((c) => c.start_date || '').filter(Boolean));
    if (dates.size > 1) {
      out.push(...list);
      continue;
    }
    const sorted = [...list].sort((a, b) => countStructuredFields(b) - countStructuredFields(a));
    const withOrg = sorted.find((x) => x.organizer);
    out.push(withOrg || sorted[0]);
  }
  return out;
}

// Max characters per DB row for raw_snippet (TEXT); chunk full-page dumps to stay responsive in API/UI.
const MAX_RAW_SNIPPET_CHARS = 120000;

function stripNoiseNodes($) {
  $('script, style, noscript, iframe').remove();
}

function buildScopedParser($) {
  const preferredSelectors = [
    'main',
    '[role="main"]',
    '#main',
    '#main-content',
    '.main',
    '.main-content',
    '.main-container',
    '.content-main',
    '.page-main',
  ];

  for (const selector of preferredSelectors) {
    const nodes = $(selector).toArray();
    if (!nodes.length) continue;

    const relevant = nodes.filter((node) =>
      $(node).find('table, h2, h3, h4, details, [role="tabpanel"], select option').length > 0,
    );
    const chosen = relevant.length ? relevant : nodes;
    const html = chosen.map((node) => $.html(node)).join('\n');
    if (!html.trim()) continue;
    return cheerio.load(html);
  }

  return $;
}

// ─── Heuristic table-row extractor ──────────────────────────────────────────

function extractCupsFromTable($, sourceUrl) {
  const cups = [];
  $('table').each((_i, table) => {
    const headers = [];
    $(table)
      .find('th')
      .each((_j, th) => headers.push($(th).text().trim().toLowerCase()));

    $(table)
      .find('tr')
      .each((_k, tr) => {
        const cells = [];
        $(tr)
          .find('td')
          .each((_l, td) => cells.push($(td).text().trim()));
        if (cells.length < 2) return;

        const cup = { source_url: sourceUrl, scraped_at: new Date().toISOString() };

        // Heuristic column guessing
        cells.forEach((cell, idx) => {
          const header = headers[idx] || '';
          if (/namn|name|cup|turnering|tävling/i.test(header) || idx === 0) {
            if (!cup.name) cup.name = trimOrNull(cell);
          }
          if (/datum|date|när|tid/i.test(header)) {
            const { start, end } = parseDateRange(cell);
            if (start) cup.start_date = start;
            if (end) cup.end_date = end;
          }
          if (/ort|plats|stad|location|venue/i.test(header)) {
            cup.location = trimOrNull(cell);
          }
          if (/region|distrikt|district/i.test(header)) {
            cup.region = trimOrNull(cell);
          }
          if (/arrangör|organiz|förening|club/i.test(header)) {
            cup.organizer = trimOrNull(cell);
          }
          if (/ålder|klass|age|group/i.test(header)) {
            cup.age_groups = trimOrNull(cell);
          }
        });

        // Try to find a link for registration
        $(tr)
          .find('a[href]')
          .each((_l, a) => {
            const href = $(a).attr('href');
            if (href && /anmäl|register|sign/i.test($(a).text())) {
              cup.registration_url = href.startsWith('http') ? href : new URL(href, sourceUrl).href;
            }
          });

        const rowText = cells.join(' | ').replace(/\s+/g, ' ').trim();
        if (!cup.name && rowText) {
          cup.name = trimOrNull(rowText.slice(0, 200)) || 'Tabellrad';
          if (rowText.length > cup.name.length) {
            cup.raw_snippet = rowText;
          }
        }

        if (cup.name) cups.push(cup);
      });
  });
  return cups;
}

// Fallback: grab any prominent headings + nearby text as minimal cup stubs
function extractCupsFromHeadings($, sourceUrl) {
  const cups = [];
  const headingRe =
    /cup|turnering|tävling|liga|serie|årsklass|klass|distrikt|p\d{1,2}\b|f\d{1,2}\b/i;

  $('h2, h3, h4').each((_i, el) => {
    const $h = $(el);
    const text = $h.text().trim();
    if (!headingRe.test(text)) return;
    if (isNavCupHeading(text)) return;

    // All sibling content until the next h2–h4 (captures accordion + tables below a section title)
    const $between = $h.nextUntil('h2, h3, h4');
    const blockHtml = $between
      .toArray()
      .map((node) => $.html(node))
      .join('');
    const $block = cheerio.load(blockHtml || '', null, false);

    const fromTables = extractCupsFromTable($block, sourceUrl);
    if (fromTables.length > 0) {
      fromTables.forEach((c) => {
        if (!c.name && text) c.name = trimOrNull(text);
        cups.push(c);
      });
      return;
    }

    const siblingText = ($between.text() || $h.next().text() || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    const { start, end } = parseDateRange(siblingText.replace(/\n/g, ' '));
    cups.push({
      name: trimOrNull(text),
      start_date: start,
      end_date: end,
      location: null,
      region: null,
      organizer: null,
      age_groups: null,
      registration_url: null,
      source_url: sourceUrl,
      raw_snippet: siblingText.length ? siblingText : null,
      scraped_at: new Date().toISOString(),
    });
  });
  return cups;
}

/**
 * Many district sites put tables inside collapsed accordions. The HTML is usually still
 * in the response; we parse each known panel container separately so we do not rely on
 * document order alone. (Client-only lazy-loaded panels cannot be captured without a browser.)
 */
function extractCupsFromAccordionPanels($, sourceUrl) {
  const panelSelectors = [
    '.accordion__item',
    '.accordion__item-content',
    'details',
    '.accordion-body',
    '.accordion-collapse',
    '[role="tabpanel"]',
    '.panel-collapse',
    '.panel-body',
    // Bootstrap collapse targets (content often still in DOM when collapsed)
    'div.collapse',
    '.cmp-accordion__item-content',
    '.svensk-fotboll-accordion__content',
  ];

  const merged = [];
  const seen = new Set();
  const ignoreNameRe = /^(sök tillstånd|ansök|visa mer|läs mer|tillbaka)$/i;
  const cupNameCueRe = /(cup|turnering|tävling|futsal|beachsoccer|gåfotboll|p\d{1,2}\b|f\d{1,2}\b)/i;

  function pushUnique(cup) {
    const key = `${cup.name || ''}|${cup.start_date || ''}|${cup.source_url || ''}`;
    if (!cup.name || seen.has(key)) return;
    seen.add(key);
    merged.push(cup);
  }

  function extractCupsFromPanelText($frag, panelTitle) {
    const local = [];
    const textCandidates = [];
    const prettifyName = (value) => {
      const text = splitInlineLabels(normaliseRawBlock(value)).replace(/\s+/g, ' ').trim();
      if (!text) return '';
      const namedMatch = text.match(
        /(?:cup\/tävling|tävlingens namn|tävling|cup)\s*:\s*([^|]+?)(?=(?:\s+(?:datum|kategorier|arrangör)\s*:)|$)/i,
      );
      const base = namedMatch?.[1] ? namedMatch[1].trim() : text;
      return stripGluedLabelTail(
        base
          .replace(/\s*(datum|kategorier|arrangör)\s*:.*$/i, '')
          .replace(/\s{2,}/g, ' ')
          .trim(),
      );
    };
    $frag('a[href], li, p, h4, h5, h6, .accordion__item-title, .accordion__title').each((_i, el) => {
      const text = normaliseRawBlock($frag(el).text());
      if (!text || text.length < 3 || text.length > 240) return;
      textCandidates.push({ text, href: $frag(el).attr('href') || null });
    });

    for (const candidate of textCandidates) {
      const text = candidate.text.replace(/\s+/g, ' ').trim();
      const prettyName = prettifyName(text);
      if (!text || ignoreNameRe.test(text)) continue;
      if (!prettyName || ignoreNameRe.test(prettyName)) continue;
      if (isNavCupHeading(text) || isNavCupHeading(prettyName)) continue;
      if (/^(till cupen|länk till cupen)$/i.test(prettyName)) continue;
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(prettyName)) continue;
      if (!cupNameCueRe.test(text) && !parseDateRange(text).start) continue;
      const resolvedHref =
        candidate.href && !candidate.href.startsWith('#')
          ? candidate.href.startsWith('http')
            ? candidate.href
            : new URL(candidate.href, sourceUrl).href
          : null;
      local.push({
        name: trimOrNull(prettyName),
        registration_url: resolvedHref,
        source_url: sourceUrl,
        raw_snippet: panelTitle ? `${panelTitle}\n${text}` : text,
        scraped_at: new Date().toISOString(),
      });
    }
    return local;
  }

  function extractCupsFromLabeledBlocks($frag, panelTitle) {
    const panelText = normaliseRawBlock($frag.root().text());
    if (!panelText) return [];
    const blocks = panelText
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    const local = [];
    for (const block of blocks) {
      if (
        !/(?:cup\/tävling|tävlingens\s+namn|tävling|cupnamn|cup)\s*[:\-–]/i.test(block) &&
        !/arrangör\s*[:\-–]/i.test(block)
      ) {
        continue;
      }
      const withTitle = panelTitle ? `${panelTitle}\n${block}` : block;
      const cup = buildCupFromLabeledBlock(withTitle, sourceUrl);
      if (cup?.name) local.push(cup);
    }
    return local;
  }

  for (const sel of panelSelectors) {
    $(sel).each((_i, panel) => {
      const inner = $(panel).html();
      if (!inner || inner.length < 20) return;
      const $frag = cheerio.load(inner, null, false);
      const panelTitle = normaliseRawBlock($(panel).find('h2, h3, h4, button, summary').first().text());
      extractCupsFromTable($frag, sourceUrl).forEach(pushUnique);
      extractCupsFromHeadings($frag, sourceUrl).forEach(pushUnique);
      extractCupsFromPanelText($frag, panelTitle).forEach(pushUnique);
      extractCupsFromLabeledBlocks($frag, panelTitle).forEach(pushUnique);
    });
  }

  // Some SPAs ship row HTML inside <template> until expanded in the browser
  $('template').each((_i, tmpl) => {
    const inner = $(tmpl).html();
    if (!inner || inner.length < 20) return;
    const $frag = cheerio.load(inner, null, false);
    extractCupsFromTable($frag, sourceUrl).forEach(pushUnique);
  });

  return merged;
}

/**
 * Full-page plain text (after stripping scripts). One row per chunk — no field mapping;
 * use this to capture everything the server returned in HTML, including accordions.
 */
function extractFullPageRawCaptures($, sourceUrl) {
  const $c = cheerio.load($.html(), null, false);
  $c('script, style, noscript, iframe').remove();

  let raw = '';
  if ($c('main').length) {
    raw = $c('main').text();
  } else {
    raw = $c('body').text();
  }

  raw = raw
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v\r]+\n/g, '\n')
    .replace(/\n[ \t\f\v\r]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (raw.length < 40) {
    const title = normaliseRawBlock($c('title').first().text() || '');
    const h1 = normaliseRawBlock($c('h1').first().text() || '');
    const optionTexts = $c('option')
      .toArray()
      .map((o) => $c(o).text().trim())
      .filter((t) => t && !/välj|select|alla|all|choose/i.test(t))
      .slice(0, 120);
    const synthetic = normaliseRawBlock([title, h1, ...optionTexts].filter(Boolean).join('\n'));
    if (synthetic.length < 10) {
      return [
        {
          name: 'Okänd cup',
          raw_snippet: `Ingen tydlig cup-text kunde extraheras från server-renderad HTML för ${sourceUrl || 'källan'}.`,
          source_url: sourceUrl,
          scraped_at: new Date().toISOString(),
        },
      ];
    }
    raw = synthetic;
  }

  let host = 'källa';
  try {
    if (sourceUrl && !sourceUrl.startsWith('file://')) {
      host = new URL(sourceUrl).hostname.replace(/^www\./, '') || host;
    } else if (sourceUrl && sourceUrl.startsWith('file://')) {
      host =
        sourceUrl
          .replace(/^file:\/\//, '')
          .split('/')
          .pop() || 'fil';
    }
  } catch {
    /* keep default */
  }

  const scrapedAt = new Date().toISOString();
  const totalParts = Math.ceil(raw.length / MAX_RAW_SNIPPET_CHARS) || 1;
  const chunks = [];

  for (let i = 0, part = 1; i < raw.length; i += MAX_RAW_SNIPPET_CHARS, part += 1) {
    const slice = raw.slice(i, i + MAX_RAW_SNIPPET_CHARS);
    const name = totalParts > 1 ? `Råtext (del ${part}/${totalParts})` : 'Råtext';
    chunks.push({
      name: name.slice(0, 500),
      raw_snippet: slice,
      source_url: sourceUrl,
      scraped_at: scrapedAt,
    });
  }

  return chunks;
}

function normaliseRawBlock(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\f\v\r]+\n/g, '\n')
    .replace(/\n[ \t\f\v\r]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function deriveSegmentTitle(segment, sourceUrl, index) {
  const firstLine =
    segment
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 2) || '';
  const lineNoUrl = firstLine.replace(/https?:\/\/\S+/gi, '').trim();
  const dateHint = parseDateRange(segment.replace(/\n/g, ' ')).start;
  return (lineNoUrl || dateHint || `Cup ${index}`).slice(0, 500);
}

function scoreSegmentLikelihood(segment) {
  let score = 0;
  const text = segment.toLowerCase();
  if (parseDateRange(segment).start) score += 2;
  if (/(cup|turnering|tävling|match|spelprogram|klass|p\d{1,2}\b|f\d{1,2}\b)/i.test(text)) score += 2;
  if (/(anmäl|anmal|register|sign up|intresseanmälan|spelform)/i.test(text)) score += 1;
  if (/(arena|plan|plats|location|ort|stad)/i.test(text)) score += 1;
  if (/(arrangör|organizer|förening|club)/i.test(text)) score += 1;
  return score;
}

function hasCupCue(segment) {
  const text = String(segment || '').toLowerCase();
  return /(cup|turnering|tävling|p\d{1,2}\b|f\d{1,2}\b|pojkar|flickor|herr|dam|junior)/i.test(text);
}

function pushUniqueSegment(segments, seen, segment, sourceUrl, index) {
  const raw = normaliseRawBlock(segment);
  if (raw.length < 10) return;
  const firstLine =
    raw
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) || '';
  if (isNavCupHeading(firstLine) || isNavCupHeading(deriveSegmentTitle(raw, sourceUrl, index))) return;
  const key = raw.slice(0, 800);
  if (seen.has(key)) return;
  const score = scoreSegmentLikelihood(raw);
  // Keep only segments that look like cup content.
  if (score < 2 && raw.length < 220 && !hasCupCue(raw)) return;
  seen.add(key);
  segments.push({
    name: deriveSegmentTitle(raw, sourceUrl, index),
    source_url: sourceUrl,
    raw_snippet: raw,
    scraped_at: new Date().toISOString(),
  });
}

function segmentRawCupBlocks($, sourceUrl) {
  const segments = [];
  const seen = new Set();
  let index = 1;

  $('table').each((_i, table) => {
    $(table)
      .find('tr')
      .each((_j, tr) => {
        const rowText = $(tr)
          .find('th,td')
          .toArray()
          .map((cell) => $(cell).text().trim())
          .filter(Boolean)
          .join(' | ');
        pushUniqueSegment(segments, seen, rowText, sourceUrl, index);
        index += 1;
      });
  });

  $('h2, h3, h4, h5').each((_i, heading) => {
    const title = $(heading).text().trim();
    if (!title) return;
    if (isNavCupHeading(title)) return;
    const block = $(heading)
      .nextUntil('h2, h3, h4, h5')
      .text();
    const combined = `${title}\n${block}`;
    pushUniqueSegment(segments, seen, combined, sourceUrl, index);
    index += 1;
  });

  $('li').each((_i, li) => {
    const liText = $(li).text();
    const firstLine =
      liText
        .split('\n')
        .map((l) => l.trim())
        .find((l) => l.length > 0) || liText.trim();
    if (isNavCupHeading(firstLine)) return;
    pushUniqueSegment(segments, seen, liText, sourceUrl, index);
    index += 1;
  });

  $('select').each((_i, select) => {
    const contextLabel =
      $(select).attr('aria-label') ||
      $(select).attr('name') ||
      $(select).closest('label').text().trim() ||
      '';
    $(select)
      .find('option')
      .each((_j, option) => {
        const optionText = $(option).text().trim();
        if (!optionText) return;
        if (/välj|select|alla|all|choose/i.test(optionText)) return;
        const combined = contextLabel ? `${contextLabel}: ${optionText}` : optionText;
        pushUniqueSegment(segments, seen, combined, sourceUrl, index);
        index += 1;
      });
  });

  if (segments.length > 0) {
    return segments;
  }

  const text = normaliseRawBlock($('main').length ? $('main').text() : $('body').text());
  if (!text) return [];
  const roughBlocks = text.split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  for (const block of roughBlocks) {
    pushUniqueSegment(segments, seen, block, sourceUrl, index);
    index += 1;
  }
  return segments;
}

/** District pages (e.g. Småland) often list full labeled blocks in main, split by blank lines. */
function labeledCupBlockLooksLikeCup(block) {
  return (
    /(?:cup\/tävling|tävlingens\s+namn|tävling|cupnamn|cup)\s*[:\-–]/i.test(block) ||
    /arrangör\s*[:\-–]/i.test(block)
  );
}

function extractCupsFromMainDoubleNewlineBlocks($, sourceUrl) {
  const text = normaliseRawBlock(
    $('main').length ? $('main').text() : $.root().text(),
  );
  if (!text || text.length < 40) return [];
  const blocks = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  const cups = [];
  for (const block of blocks) {
    if (!labeledCupBlockLooksLikeCup(block)) continue;
    const cup = buildCupFromLabeledBlock(block, sourceUrl);
    if (cup?.name) cups.push(cup);
  }
  return cups;
}

function mergeCupLists(primary, extra, dedupeOnSnippetPrefix = 400) {
  const seen = new Set();
  const makeKey = (c) => {
    const source = String(c?.source_url || '')
      .trim()
      .toLowerCase();
    const name = canonicalCupNameKey(c?.name);
    const snip = String(c?.raw_snippet || '')
      .trim()
      .toLowerCase()
      .slice(0, dedupeOnSnippetPrefix);
    return `${source}|${name}|${snip}`;
  };
  const makeNameKey = (c) => {
    const source = String(c?.source_url || '')
      .trim()
      .toLowerCase();
    const name = canonicalCupNameKey(c?.name);
    return `${source}|${name}`;
  };

  const out = [];
  const push = (c) => {
    if (!c) return;
    const key = makeKey(c);
    const nameKey = makeNameKey(c);
    if (seen.has(key) || seen.has(nameKey)) {
      return;
    }
    seen.add(key);
    seen.add(nameKey);
    out.push(c);
  };

  for (const c of primary) push(c);
  for (const c of extra) push(c);
  return out;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch an HTML URL and extract cups.
 * @param {string} url
 * @returns {Promise<Array>}
 */
async function scrapeUrl(url) {
  Logger.info('Scraping cup source URL', { url });
  const response = await axios.get(url, {
    timeout: 20000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HomebaseScraper/1.0; +https://github.com/homebase)',
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
    maxRedirects: 5,
  });

  const html = response.data;
  const $ = cheerio.load(html);
  stripNoiseNodes($);
  const $scoped = buildScopedParser($);

  const fromMainBlocks = extractCupsFromMainDoubleNewlineBlocks($scoped, url);
  let cups = extractCupsFromTable($scoped, url);
  cups = mergeCupLists(fromMainBlocks, cups, 800);
  const fromAccordions = extractCupsFromAccordionPanels($scoped, url);
  cups = mergeCupLists(cups, fromAccordions, 800);
  const segmentedRaw = segmentRawCupBlocks($scoped, url);
  if (cups.length === 0) {
    cups = extractCupsFromHeadings($scoped, url);
  }
  cups = mergeCupLists(cups, segmentedRaw, 800);
  cups = cups.map((c) => enrichCupFromRaw(c));
  cups = dedupeByBestQuality(cups);
  cups = cups.filter(shouldKeepScrapedCup);
  if (cups.length === 0) {
    cups = extractFullPageRawCaptures($scoped, url);
  }

  Logger.info('Scrape finished', { url, found: cups.length });
  return cups;
}

/**
 * Parse already-loaded HTML from an uploaded file.
 * @param {string} html  Full HTML string
 * @param {string} filename  Original filename (used to set source_url label)
 * @returns {Array}
 */
function scrapeHtml(html, filename) {
  Logger.info('Parsing cup HTML file', { filename });
  const fakeUrl = `file://${filename}`;
  const $ = cheerio.load(html);
  stripNoiseNodes($);
  const $scoped = buildScopedParser($);
  const fromMainBlocks = extractCupsFromMainDoubleNewlineBlocks($scoped, fakeUrl);
  let cups = extractCupsFromTable($scoped, fakeUrl);
  cups = mergeCupLists(fromMainBlocks, cups, 800);
  const fromAccordions = extractCupsFromAccordionPanels($scoped, fakeUrl);
  cups = mergeCupLists(cups, fromAccordions, 800);
  const segmentedRaw = segmentRawCupBlocks($scoped, fakeUrl);
  if (cups.length === 0) {
    cups = extractCupsFromHeadings($scoped, fakeUrl);
  }
  cups = mergeCupLists(cups, segmentedRaw, 800);
  cups = cups.map((c) => enrichCupFromRaw(c));
  cups = dedupeByBestQuality(cups);
  cups = mergeDuplicateCanonicalNamesWhenCompatible(cups);
  cups = cups.filter(shouldKeepScrapedCup);
  if (cups.length === 0) {
    cups = extractFullPageRawCaptures($scoped, fakeUrl);
  }

  Logger.info('HTML parse finished', { filename, found: cups.length });
  return cups;
}

module.exports = { scrapeUrl, scrapeHtml };
