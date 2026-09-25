// plugins/sportadmin/parser/OrganizationParser.js
const { metaContent, stripTags } = require('./htmlUtils');
const { sanitizeUrl } = require('../sanitize/sanitize');

function parseOrganization(html, pageUrl, discovery) {
  const name =
    discovery?.orgName ||
    metaContent(html, 'og:site_name') ||
    stripTags((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '') ||
    'Organization';
  const description = metaContent(html, 'og:description') || metaContent(html, 'description');
  const image = sanitizeUrl(discovery?.logoUrl || metaContent(html, 'og:image'));

  return {
    type: 'organization',
    source_id: 'org',
    name,
    description: description || null,
    image_url: image,
    source_url: pageUrl,
  };
}

module.exports = { parseOrganization };
