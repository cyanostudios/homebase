// plugins/sportadmin/parser/htmlUtils.js
const { sanitizeText, sanitizeUrl } = require('../sanitize/sanitize');

function decodeBasicEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function stripTags(html) {
  return sanitizeText(decodeBasicEntities(html));
}

function metaContent(html, property) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`,
    'i',
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`,
    'i',
  );
  const m = html.match(re) || html.match(re2);
  return m ? decodeBasicEntities(m[1]).trim() : null;
}

function absoluteUrl(baseUrl, href) {
  if (!href) {
    return null;
  }
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function extractQueryParam(url, key) {
  try {
    return new URL(url).searchParams.get(key);
  } catch {
    return null;
  }
}

/**
 * Return inner HTML of the <div...> that starts at openIndex (index of '<div').
 * Handles nested divs; returns '' if unbalanced.
 * @param {string} html
 * @param {number} openIndex
 * @returns {string}
 */
function extractBalancedDivInner(html, openIndex) {
  if (!html || openIndex < 0 || openIndex >= html.length) {
    return '';
  }
  const openTagEnd = html.indexOf('>', openIndex);
  if (openTagEnd < 0) {
    return '';
  }
  let depth = 1;
  let i = openTagEnd + 1;
  while (i < html.length && depth > 0) {
    const slice = html.slice(i);
    const nextOpen = slice.search(/<div\b/i);
    const nextClose = slice.search(/<\/div>/i);
    if (nextClose < 0) {
      return '';
    }
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i += nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return html.slice(openTagEnd + 1, i + nextClose);
    }
    i += nextClose + 6;
  }
  return '';
}

/**
 * Prefer the best .inner block that looks like page content (rub / lists / tables).
 * News teaser inners (NID in heading) are demoted so a long photo collage does not
 * beat a shorter welcome/description block that holds the editorial image.
 * @param {string} html
 * @returns {string}
 */
function extractBestInnerHtml(html) {
  if (!html) {
    return '';
  }
  const re = /<div\b[^>]*class=['"]?inner\b[^>]*>/gi;
  let best = '';
  let bestScore = -Infinity;
  let m;
  while ((m = re.exec(html))) {
    const inner = extractBalancedDivInner(html, m.index);
    if (!inner || inner.length < 40) {
      continue;
    }
    let score = 0;
    if (/class=['"]?rub\b/i.test(inner)) {
      score += 10;
    }
    if (/class=['"]?infoBox\b/i.test(inner)) {
      score += 25;
    }
    if (/class=['"]?information\b/i.test(inner)) {
      score += 20;
    }
    if (/<table\b/i.test(inner)) {
      score += 15;
    }
    if (/<p\b/i.test(inner)) {
      score += 5;
    }
    // Soft length preference among comparable content.
    score += Math.min(inner.length / 400, 25);
    // Demote SportAdmin news teaser blocks (section rub links to NID=…).
    const head = inner.trimStart().slice(0, 600);
    if (/^<section\b/i.test(head) && /NID=\d+/i.test(head)) {
      score -= 80;
    }
    // Prefer editorial hero: imgDiv without news NID.
    if (/class=['"]?imgDiv\b/i.test(inner) && !/NID=\d+/i.test(inner)) {
      score += 40;
    }
    if (score > bestScore || (score === bestScore && inner.length > best.length)) {
      bestScore = score;
      best = inner;
    }
  }
  return best;
}

module.exports = {
  decodeBasicEntities,
  stripTags,
  metaContent,
  absoluteUrl,
  extractQueryParam,
  extractBalancedDivInner,
  extractBestInnerHtml,
  sanitizeUrl,
};
