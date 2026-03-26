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

// Max characters per DB row for raw_snippet (TEXT); chunk full-page dumps to stay responsive in API/UI.
const MAX_RAW_SNIPPET_CHARS = 120000;

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

  function pushUnique(cup) {
    const key = `${cup.name || ''}|${cup.start_date || ''}|${cup.source_url || ''}`;
    if (!cup.name || seen.has(key)) return;
    seen.add(key);
    merged.push(cup);
  }

  for (const sel of panelSelectors) {
    $(sel).each((_i, panel) => {
      const inner = $(panel).html();
      if (!inner || inner.length < 20) return;
      const $frag = cheerio.load(inner, null, false);
      extractCupsFromTable($frag, sourceUrl).forEach(pushUnique);
      extractCupsFromHeadings($frag, sourceUrl).forEach(pushUnique);
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
    return [];
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
    const name = totalParts > 1 ? `Råtext ${host} (del ${part}/${totalParts})` : `Råtext ${host}`;
    chunks.push({
      name: name.slice(0, 500),
      raw_snippet: slice,
      source_url: sourceUrl,
      scraped_at: scrapedAt,
    });
  }

  return chunks;
}

function mergeCupLists(primary, extra, dedupeOnSnippetPrefix = 400) {
  const seen = new Set();
  for (const c of primary) {
    const snip = (c.raw_snippet || '').slice(0, dedupeOnSnippetPrefix);
    const key = `${c.name || ''}|${snip}`;
    seen.add(key);
  }
  const out = [...primary];
  for (const c of extra) {
    const snip = (c.raw_snippet || '').slice(0, dedupeOnSnippetPrefix);
    const key = `${c.name || ''}|${snip}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
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

  let cups = extractCupsFromTable($, url);
  const fromAccordions = extractCupsFromAccordionPanels($, url);
  if (fromAccordions.length > 0) {
    const seen = new Set(cups.map((c) => `${c.name}|${c.start_date || ''}`));
    fromAccordions.forEach((c) => {
      const k = `${c.name}|${c.start_date || ''}`;
      if (!seen.has(k)) {
        seen.add(k);
        cups.push(c);
      }
    });
  }
  if (cups.length === 0) {
    cups = extractCupsFromHeadings($, url);
  }

  const rawCaptures = extractFullPageRawCaptures($, url);
  cups = mergeCupLists(cups, rawCaptures);

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
  let cups = extractCupsFromTable($, fakeUrl);
  const fromAccordions = extractCupsFromAccordionPanels($, fakeUrl);
  if (fromAccordions.length > 0) {
    const seen = new Set(cups.map((c) => `${c.name}|${c.start_date || ''}`));
    fromAccordions.forEach((c) => {
      const k = `${c.name}|${c.start_date || ''}`;
      if (!seen.has(k)) {
        seen.add(k);
        cups.push(c);
      }
    });
  }
  if (cups.length === 0) {
    cups = extractCupsFromHeadings($, fakeUrl);
  }

  const rawCaptures = extractFullPageRawCaptures($, fakeUrl);
  cups = mergeCupLists(cups, rawCaptures);

  Logger.info('HTML parse finished', { filename, found: cups.length });
  return cups;
}

module.exports = { scrapeUrl, scrapeHtml };
