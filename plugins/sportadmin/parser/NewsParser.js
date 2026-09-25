// plugins/sportadmin/parser/NewsParser.js
const { metaContent, stripTags, absoluteUrl } = require('./htmlUtils');
const { sanitizeHtml, sanitizeUrl, sanitizeText } = require('../sanitize/sanitize');

function parseNewsDetail(html, pageUrl) {
  const nidMatch = pageUrl.match(/[?&]NID=(\d+)/i);
  const sourceId = nidMatch ? nidMatch[1] : null;
  const title =
    metaContent(html, 'og:title') ||
    stripTags((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '') ||
    'Untitled';
  const image = sanitizeUrl(metaContent(html, 'og:image'));

  let publishedAt = null;
  const dateMatch = html.match(/(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/);
  if (dateMatch) {
    publishedAt = dateMatch[1];
  }

  // Prefer article-ish block; fall back to og description.
  let contentHtml = '';
  const newsBlock = html.match(
    /<div[^>]*class=['"][^'"]*news[^'"]*['"][^>]*>([\s\S]{0,20000}?)<\/div>/i,
  );
  if (newsBlock) {
    contentHtml = newsBlock[1];
  }
  const content = sanitizeHtml(contentHtml);
  const excerpt =
    sanitizeText(metaContent(html, 'og:description') || '') ||
    sanitizeText(content).slice(0, 280) ||
    null;

  return {
    type: 'news',
    source_id: sourceId || `url:${pageUrl}`,
    title: sanitizeText(title),
    excerpt,
    content: content || null,
    image_url: image,
    published_at: publishedAt,
    source_url: pageUrl,
  };
}

function parseNewsListFromHtml(html, pageUrl) {
  /** @type {Array<{ nid: string, title: string, href: string, publishedAt: string|null }>} */
  const items = [];
  const re = /<a[^>]+href=['"]([^'"]*[?&]NID=(\d+)[^'"]*)['"][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const nid = m[2];
    const href = absoluteUrl(pageUrl, m[1]);
    const inner = stripTags(m[3]);
    const dateMatch = inner.match(/(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/);
    const title = inner.replace(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/, '').trim();
    if (!nid || !title || items.some((i) => i.nid === nid)) {
      continue;
    }
    items.push({
      nid,
      title,
      href,
      publishedAt: dateMatch ? dateMatch[1] : null,
    });
  }
  return items;
}

module.exports = { parseNewsDetail, parseNewsListFromHtml };
