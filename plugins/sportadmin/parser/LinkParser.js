// plugins/sportadmin/parser/LinkParser.js
const { absoluteUrl, stripTags } = require('./htmlUtils');
const { sanitizeUrl, sanitizeText } = require('../sanitize/sanitize');

const BLOCKED_HOST_PARTS = [
  'identity.sportadmin.se',
  'portalweb.sportadmin.se/mypages',
  'entry.sportadmin.se',
];

function parsePublicLinks(html, pageUrl) {
  /** @type {Array<{ source_id: string, title: string, url: string, source_url: string }>} */
  const links = [];
  const seen = new Set();
  const re = /<a[^>]+href=['"](https?:\/\/[^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const url = sanitizeUrl(m[1]);
    if (!url || seen.has(url)) {
      continue;
    }
    if (BLOCKED_HOST_PARTS.some((p) => url.includes(p))) {
      continue;
    }
    const title = sanitizeText(stripTags(m[2])) || url;
    seen.add(url);
    links.push({
      source_id: `link:${Buffer.from(url).toString('base64url').slice(0, 40)}`,
      title,
      url,
      source_url: pageUrl,
    });
  }
  return links.slice(0, 50);
}

function parseDocumentLinks(html, pageUrl) {
  return parsePublicLinks(html, pageUrl).filter((l) =>
    /dokument|pdf|\.doc|drive\.google|forms\.google/i.test(l.url + l.title),
  );
}

module.exports = { parsePublicLinks, parseDocumentLinks, absoluteUrl };
