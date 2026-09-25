// plugins/sportadmin/parser/GroupParser.js
const { stripTags, decodeBasicEntities, absoluteUrl } = require('./htmlUtils');
const { sanitizeText, sanitizeUrl } = require('../sanitize/sanitize');

/**
 * Discover team-scoped public module URLs from a team shell page.
 * Skips image gallery by design.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {{ news: string|null, calendar: string|null, matches: string|null, roster: string|null, contact: string|null }}
 */
function discoverTeamModules(html, pageUrl) {
  /** @type {{ news: string|null, calendar: string|null, matches: string|null, roster: string|null, contact: string|null }} */
  const modules = {
    news: null,
    calendar: null,
    matches: null,
    roster: null,
    contact: null,
  };
  if (!html) {
    return modules;
  }
  const navLinkRe =
    /<a[^>]+href=['"]?([^'"\s>]+)['"]?[^>]*>\s*(?:<span>)?\s*([^<]*?)\s*(?:<\/span>)?\s*<\/a>/gi;
  let m;
  while ((m = navLinkRe.exec(html))) {
    const href = absoluteUrl(pageUrl, m[1]);
    const label = stripTags(decodeBasicEntities(m[2] || ''))
      .toLowerCase()
      .trim();
    if (!href) {
      continue;
    }
    if (/\/galleri\//i.test(href) || label.includes('bildgalleri') || label === 'bilder') {
      continue;
    }
    if (/\/nyheter\//i.test(href) || label.includes('nyhet')) {
      modules.news = modules.news || href;
    } else if (/\/kalender\//i.test(href) || label.includes('kalender')) {
      modules.calendar = modules.calendar || href;
    } else if (/\/match\//i.test(href) || label === 'matcher') {
      modules.matches = modules.matches || href;
    } else if (/\/grupp\//i.test(href) || label.includes('trupp')) {
      modules.roster = modules.roster || href;
    } else if (
      (/\/sida\//i.test(href) && (label.includes('kontakt') || label.includes('contact'))) ||
      label === 'kontakt'
    ) {
      modules.contact = modules.contact || href;
    }
  }
  return modules;
}

/**
 * @param {string} sectionHtml
 * @returns {Array<{ name: string, age: string|null, description: string|null, source_user_id: string|null }>}
 */
function parsePeopleSection(sectionHtml) {
  /** @type {Array<{ name: string, age: string|null, description: string|null, source_user_id: string|null }>} */
  const people = [];
  if (!sectionHtml) {
    return people;
  }
  const idRe = /id=userInfo(\d+)_\d/gi;
  let m;
  while ((m = idRe.exec(sectionHtml))) {
    const uid = m[1];
    const before = sectionHtml.slice(Math.max(0, m.index - 500), m.index);
    const block = sectionHtml.slice(m.index, m.index + 900);
    const nameMatch = before.match(/<a[^>]*>([^<]+)<\/a>\s*<\/td>/i);
    const name = sanitizeText(stripTags(nameMatch?.[1] || ''));
    if (!name) {
      continue;
    }
    const ageMatch =
      block.match(/<b>[^<]*<\/b>\s*<td>([^<]*)/i) || block.match(/<b>[^<]*<td>([^<]*)/i);
    const ageRaw = sanitizeText(stripTags(ageMatch?.[1] || '')) || null;
    const descMatch = block.match(/<i>([^<]*)<\/i>/i);
    let description = sanitizeText(stripTags(descMatch?.[1] || '')) || null;
    if (description && /beskrivning saknas/i.test(description)) {
      description = null;
    }
    people.push({
      name,
      age: ageRaw,
      description,
      source_user_id: uid || null,
    });
    if (people.length >= 200) {
      break;
    }
  }
  return people;
}

/**
 * Parse a public SportAdmin /grupp/ (Truppen) page.
 * @param {string} html
 * @param {string} pageUrl
 * @returns {{ players: Array<object>, leaders: Array<object>, source_url: string|null }}
 */
function parseGroupPage(html, pageUrl) {
  const empty = {
    players: [],
    leaders: [],
    source_url: sanitizeUrl(pageUrl) || pageUrl || null,
  };
  if (!html) {
    return empty;
  }
  const lGrupp = html.match(/id=['"]?lGrupp['"]?([\s\S]*?)(?=<div class=['"]?hr\b|<\/form>|$)/i);
  const chunk = lGrupp ? lGrupp[0] : html;
  const playersChunk = (chunk.match(/<b>\s*Spelare\s*<\/b>([\s\S]*?)(?:<b>\s*Ledare\s*<\/b>|$)/i) ||
    [])[1];
  const leadersChunk = (chunk.match(/<b>\s*Ledare\s*<\/b>([\s\S]*?)(?:<b>[^<]+<\/b>|$)/i) || [])[1];
  return {
    players: parsePeopleSection(playersChunk || ''),
    leaders: parsePeopleSection(leadersChunk || ''),
    source_url: sanitizeUrl(pageUrl) || pageUrl || null,
  };
}

module.exports = {
  discoverTeamModules,
  parseGroupPage,
  parsePeopleSection,
};
