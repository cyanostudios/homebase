// plugins/sportadmin/parser/TeamParser.js
const {
  stripTags,
  metaContent,
  decodeBasicEntities,
  absoluteUrl,
  extractBestInnerHtml,
  extractBalancedDivInner,
} = require('./htmlUtils');
const {
  sanitizeUrl,
  sanitizeText,
  sanitizeMultilineText,
  sanitizeHtml,
} = require('../sanitize/sanitize');
const { discoverTeamModules } = require('./GroupParser');

function inferAgeGroup(name) {
  const m = String(name || '').match(/\(?(F?P?\d{4}|20\d{2}|F?\d{1,2})\)?/i);
  return m ? m[1] : null;
}

/** Convert a chunk of HTML into readable plain text with paragraph breaks. */
function htmlToPlainText(html) {
  if (!html) {
    return '';
  }
  const cleaned = String(html)
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')
    // Drop mailto/icon-only chrome; keep visible person names.
    .replace(/<a\b[^>]*href=['"]mailto:[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi, ' ');
  const withBreaks = cleaned
    // Team/group headings on sektion pages.
    .replace(/<b\b[^>]*class=(['"]?)[^'">\s]*\brub\b[^'">\s]*\1[^>]*>/gi, '\n\n')
    .replace(/<\/\s*b\s*>/gi, '\n')
    .replace(
      /<div\b[^>]*class=(['"]?)[^'">\s]*\b(?:infoBox|information|seperator)\b[^'">\s]*\1[^>]*>/gi,
      '\n',
    )
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n')
    .replace(/<\/\s*tr\s*>/gi, '\n')
    .replace(/<\/\s*h[1-6]\s*>/gi, '\n')
    .replace(/<\/\s*(?:td|th)\s*>/gi, '\t')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n');
  return sanitizeMultilineText(decodeBasicEntities(withBreaks));
}

function extractHeading(html) {
  const rub = html.match(
    /<span[^>]*class=(['"]?)[^'">\s]*\brub\b[^'">\s]*\1[^>]*>([\s\S]*?)<\/span>/i,
  );
  if (rub) {
    // News teaser headings link to NID — not a team page title.
    if (/NID=\d+/i.test(rub[2])) {
      return null;
    }
    return sanitizeText(stripTags(rub[2])) || null;
  }
  const section = html.match(/<section[^>]*id=['"]([^'"]+)['"][^>]*>/i);
  if (section && !/NID=\d+/i.test(section[0])) {
    return sanitizeText(decodeBasicEntities(section[1])) || null;
  }
  return null;
}

function isNewsSectionPart(part) {
  return (
    /<section\b/i.test(part) &&
    /NID=\d+/i.test(part) &&
    (/class=['"]?rub\b/i.test(part) || /class=rub\b/i.test(part))
  );
}

/**
 * Prefer CDN / article image inside a news teaser chunk; skip team logos.
 * @param {string} part
 * @param {string} pageUrl
 * @returns {string|null}
 */
function extractNewsTeaserImage(part, pageUrl) {
  const openBox = part.match(/openBox\(\s*['"](https?:\/\/[^'"]+)['"]/i);
  if (openBox?.[1]) {
    const safe = sanitizeUrl(openBox[1]);
    if (safe) {
      return safe;
    }
  }
  const openBoxRel = part.match(/openBox\(\s*['"](\/[^'"]+)['"]/i);
  if (openBoxRel?.[1]) {
    const resolved = sanitizeUrl(absoluteUrl(pageUrl, openBoxRel[1]));
    if (resolved) {
      return resolved;
    }
  }
  const imgDiv = part.match(/class=['"]?imgDiv\b[\s\S]{0,2500}?<img[^>]+src=(['"]?)([^'"\s>]+)\1/i);
  if (imgDiv?.[2] && !/getLogga\.asp/i.test(imgDiv[2])) {
    const resolved = sanitizeUrl(absoluteUrl(pageUrl, imgDiv[2]));
    if (resolved) {
      return resolved;
    }
  }
  const anyImg = part.match(
    /<img[^>]+src=(['"]?)(https?:\/\/[^'"\s>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^'"\s>]*)?)\1/i,
  );
  if (anyImg?.[2]) {
    return sanitizeUrl(anyImg[2]) || null;
  }
  return null;
}

/**
 * Hero / editorial image for the page description (first non-news imgDiv in content).
 * Walks .inner blocks in document order so a longer news collage does not hide the
 * welcome image that sits in an earlier, shorter .inner.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {string|null}
 */
function extractDescriptionImage(html, pageUrl) {
  if (!html) {
    return null;
  }

  const tryInChunk = (chunk) => {
    if (!chunk || chunk.length < 40) {
      return null;
    }
    const parts = String(chunk).split(/(?=<section\b)/i);
    const editorial = parts.filter((part) => !isNewsSectionPart(part)).join('');
    if (!editorial || editorial.length < 40) {
      return null;
    }
    return extractNewsTeaserImage(editorial, pageUrl);
  };

  const innerRe = /<div\b[^>]*class=['"]?inner\b[^>]*>/gi;
  let m;
  while ((m = innerRe.exec(html))) {
    const inner = extractBalancedDivInner(html, m.index);
    const found = tryInChunk(inner);
    if (found) {
      return found;
    }
  }

  const bestInner = extractBestInnerHtml(html);
  const fromBest = tryInChunk(bestInner);
  if (fromBest) {
    return fromBest;
  }

  const parts = String(html).split(/(?=<section\b)/i);
  let editorial = '';
  for (const part of parts) {
    if (isNewsSectionPart(part)) {
      continue;
    }
    editorial += part;
  }
  return tryInChunk(editorial.length > 80 ? editorial : String(html));
}

/**
 * Full article body from a SID-page news teaser chunk (after heading/date/image).
 * @param {string} part
 * @returns {string|null}
 */
function extractNewsTeaserBody(part) {
  let chunk = String(part)
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')
    .replace(/<section\b[\s\S]*?<\/section>/i, ' ')
    .replace(/<div\b[^>]*class=['"]?imgDiv\b[\s\S]*?<\/div>\s*<\/div>/i, ' ')
    .replace(/<div[^>]*>\s*<span[^>]*color\s*:\s*#888888[^>]*>[\s\S]*?<\/span>\s*<\/div>/i, ' ');
  // Stop before SportAdmin footer / next chrome that can bleed into the split chunk.
  chunk = chunk.split(
    /<div[^>]*(?:style\s*=\s*['"]?clear:both|class=['"]?hr\b|class=['"]?inner\b)/i,
  )[0];
  const text = htmlToPlainText(chunk);
  return text || null;
}

/**
 * News teasers embedded on SID pages (NID links in rub — no news CSS class).
 * @returns {Array<{ title: string, when: string|null, nid: string|null, source_url: string|null, image_url: string|null, body: string|null }>}
 */
function extractNewsTeasers(html, pageUrl) {
  if (!html) {
    return [];
  }
  const parts = String(html).split(/(?=<section\b)/i);
  /** @type {Array<{ title: string, when: string|null, nid: string|null, source_url: string|null, image_url: string|null, body: string|null }>} */
  const items = [];
  const seen = new Set();
  for (const part of parts) {
    if (!isNewsSectionPart(part)) {
      continue;
    }
    const nidMatch = part.match(/NID=(\d+)/i);
    const nid = nidMatch ? nidMatch[1] : null;
    if (nid && seen.has(nid)) {
      continue;
    }
    const titleMatch = part.match(
      /<span[^>]*class=(['"]?)[^'">\s]*\brub\b[^'">\s]*\1[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i,
    );
    const title = titleMatch ? sanitizeText(stripTags(titleMatch[2])) : null;
    if (!title) {
      continue;
    }
    const hrefMatch = part.match(/href=(['"]?)([^'"\s>]*NID=\d+[^'"\s>]*)\1/i);
    const source_url = hrefMatch ? sanitizeUrl(absoluteUrl(pageUrl, hrefMatch[2])) || null : null;
    const whenMatch =
      part.match(/<span[^>]*style=[^>]*color\s*:\s*#888888[^>]*>([\s\S]*?)<\/span>/i) ||
      part.match(/(\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2})/);
    const when = whenMatch ? sanitizeText(stripTags(whenMatch[1])) || null : null;
    const image_url = extractNewsTeaserImage(part, pageUrl);
    const body = extractNewsTeaserBody(part);
    if (nid) {
      seen.add(nid);
    }
    items.push({ title, when, nid, source_url, image_url, body });
    if (items.length >= 20) {
      break;
    }
  }
  return items;
}

/**
 * Drop SportAdmin news teaser blocks from SID page HTML.
 * News use <section><span class=rub><a href=...NID=...></a></span></section> + body
 * until the next <section — they are not marked with a news class.
 */
function stripNewsBlocks(html) {
  if (!html) {
    return '';
  }
  const parts = String(html).split(/(?=<section\b)/i);
  if (parts.length <= 1) {
    // No sections — still drop anchors that are clearly news list footers.
    return String(html).replace(
      /<a[^>]+href=['"][^'"]*NID=\d+[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi,
      ' ',
    );
  }
  const kept = [];
  for (const part of parts) {
    if (isNewsSectionPart(part)) {
      continue;
    }
    kept.push(part);
  }
  let out = kept.join('');
  // Trailing “Fler nyheter >>” etc.
  out = out.replace(/<a[^>]+href=['"][^'"]*\/nyheter\/[^'"]*['"][^>]*>[\s\S]*?<\/a>/gi, ' ');
  return out;
}

/**
 * Main editorial body on SID / club pages (not chrome, not sidebar match lists, not news teasers).
 */
function extractBodyHtml(html) {
  let body = '';
  const editor = html.match(
    /elementor-widget-text-editor[\s\S]{0,400}?<div class=["']elementor-widget-container["']>([\s\S]*?)<\/div>\s*<\/div>/i,
  );
  if (editor?.[1] && editor[1].length > 40) {
    body = editor[1];
  } else {
    // Fallback: contentDiv .inner after .rub until sidebar / tbl2
    const inner = html.match(
      /<div class=['"]?inner['"]?[^>]*>([\s\S]*?)(?:<div class=['"]?tbl2|class=['"]nyhetsflode|<div class=['"]?inner\b|<\/div>\s*<style)/i,
    );
    if (inner?.[1] && inner[1].length > 40) {
      body = inner[1].replace(/<div class=['"]?imgDiv[\s\S]*?<\/div>\s*<\/div>/i, '');
    } else {
      // Sektion / dokument / list pages: .inner has no tbl2 stop — use balanced extract.
      const best = extractBestInnerHtml(html);
      if (best && best.length > 40) {
        body = best;
      }
    }
  }
  body = stripNewsBlocks(body);
  // Remove leftover style blocks and empty sections
  body = body
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<section\b[^>]*>[\s\S]*?<\/section>/gi, (section) =>
      /NID=\d+/i.test(section) ? ' ' : section,
    );
  return body;
}

/**
 * Parse "Kommande matcher" / "Spelade matcher" sidebar blocks on team pages.
 * @returns {Array<{ title: string, when: string|null }>}
 */
function extractMatchList(html, sectionTitle) {
  const titleEsc = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const blockRe = new RegExp(
    `<b>${titleEsc}</b>[\\s\\S]*?<div class=['"]sektionsRutaInner['"][^>]*>([\\s\\S]*?)(?:<div class=['"]sektionsRutaOuter|</form>)`,
    'i',
  );
  const block = html.match(blockRe);
  if (!block?.[1]) {
    return [];
  }
  const chunk = block[1];
  /** @type {Array<{ title: string, when: string|null }>} */
  const items = [];
  // SportAdmin often uses unquoted href=...&AID=123
  const rowRe =
    /<a[^>]+href=(['"]?)([^'"\s>]*AID=\d+[^'"\s>]*)\1[^>]*>([\s\S]*?)<\/a>[\s\S]{0,400}?<i[^>]*>([\s\S]*?)<\/i>/gi;
  let m;
  while ((m = rowRe.exec(chunk))) {
    const title = sanitizeText(stripTags(m[3]).replace(/\u00a0/g, ' '));
    const when = sanitizeText(stripTags(m[4])) || null;
    if (!title) {
      continue;
    }
    items.push({ title, when });
    if (items.length >= 20) {
      break;
    }
  }
  return items;
}

/**
 * Turn SportAdmin body HTML into allowlisted description HTML (paragraphs, headings, lists).
 * @param {string} bodyHtml
 * @param {string|null} ogDescription
 * @returns {string|null}
 */
function bodyToDescription(bodyHtml, ogDescription) {
  const plain = htmlToPlainText(bodyHtml);
  let prepared = String(bodyHtml || '')
    .replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, ' ')
    .replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, ' ')
    .replace(/<div\b[^>]*class=['"]?imgDiv\b[\s\S]*?<\/div>\s*<\/div>/gi, ' ')
    .replace(
      /<b\b[^>]*class=(['"]?)[^'">\s]*\brub\b[^'">\s]*\1[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/b>/gi,
      '<h3>$2</h3>',
    )
    .replace(
      /<span\b[^>]*class=(['"]?)[^'">\s]*\brub\b[^'">\s]*\1[^>]*>([\s\S]*?)<\/span>/gi,
      '<h3>$2</h3>',
    )
    .replace(
      /<div\b[^>]*class=(['"]?)[^'">\s]*\binformation\b[^'">\s]*\1[^>]*>([\s\S]*?)<\/div>/gi,
      '<p>$2</p>',
    )
    .replace(/<div\b[^>]*class=(['"]?)[^'">\s]*\b(?:infoBox|seperator)\b[^'">\s]*\1[^>]*>/gi, ' ')
    .replace(/<\/div>/gi, ' ');
  const html = sanitizeHtml(prepared);
  const htmlTextLen = sanitizeText(html).length;
  if (html && htmlTextLen > 20) {
    return html;
  }
  if (plain && plain.length > 40) {
    return plain;
  }
  return ogDescription || plain || null;
}

function parseTeamFromDiscovery(entry, pageUrl, html) {
  const ogDescription = metaContent(html, 'og:description');
  const image = sanitizeUrl(metaContent(html, 'og:image'));
  const heading = html ? extractHeading(html) : null;
  const description_image_url = html ? extractDescriptionImage(html, pageUrl || entry.href) : null;
  const bodyHtml = html ? extractBodyHtml(html) : '';
  const description = bodyToDescription(bodyHtml, ogDescription);
  const upcoming_matches = html ? extractMatchList(html, 'Kommande matcher') : [];
  const played_matches = html ? extractMatchList(html, 'Spelade matcher') : [];
  const news_items = html ? extractNewsTeasers(html, pageUrl || entry.href) : [];
  const modules = html
    ? discoverTeamModules(html, pageUrl || entry.href)
    : {
        news: null,
        calendar: null,
        matches: null,
        roster: null,
        contact: null,
      };

  return {
    type: 'team',
    source_id: entry.sid,
    name: entry.name,
    category: entry.category || null,
    age_group: inferAgeGroup(entry.name),
    heading,
    description,
    description_image_url,
    upcoming_matches,
    played_matches,
    news_items,
    modules,
    players: Array.isArray(entry.players) ? entry.players : [],
    leaders: Array.isArray(entry.leaders) ? entry.leaders : [],
    contact: entry.contact || null,
    image_url: image || description_image_url,
    source_url: pageUrl || entry.href,
  };
}

function parseTeamLabelCategory(name, category) {
  return {
    name: stripTags(name),
    category: category || null,
    age_group: inferAgeGroup(name),
  };
}

module.exports = {
  parseTeamFromDiscovery,
  parseTeamLabelCategory,
  inferAgeGroup,
  extractBodyHtml,
  extractHeading,
  extractMatchList,
  extractNewsTeasers,
  extractDescriptionImage,
  bodyToDescription,
  htmlToPlainText,
  stripNewsBlocks,
};
