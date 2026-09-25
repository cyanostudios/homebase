// plugins/sportadmin/parser/PageParser.js
const { metaContent } = require('./htmlUtils');
const { sanitizeUrl, sanitizeText } = require('../sanitize/sanitize');
const {
  extractHeading,
  extractBodyHtml,
  extractNewsTeasers,
  extractDescriptionImage,
  bodyToDescription,
} = require('./TeamParser');

/**
 * Parse a club content page (sida / start / sektion / dokument / galleri).
 * @param {{ sourceId: string, name: string, kind: string, href: string }} entry
 * @param {string} pageUrl
 * @param {string} html
 */
function parseClubPage(entry, pageUrl, html) {
  const ogDescription = metaContent(html, 'og:description');
  const image = sanitizeUrl(metaContent(html, 'og:image'));
  const heading = html ? extractHeading(html) : null;
  const description_image_url = html ? extractDescriptionImage(html, pageUrl || entry.href) : null;
  const bodyHtml = html ? extractBodyHtml(html) : '';
  const description = bodyToDescription(bodyHtml, ogDescription);
  const news_items = html ? extractNewsTeasers(html, pageUrl || entry.href) : [];

  return {
    type: 'page',
    source_id: entry.sourceId,
    title: sanitizeText(entry.name) || entry.name,
    kind: entry.kind || null,
    heading,
    description,
    description_image_url,
    news_items,
    image_url: image || description_image_url,
    source_url: pageUrl || entry.href,
  };
}

module.exports = { parseClubPage };
