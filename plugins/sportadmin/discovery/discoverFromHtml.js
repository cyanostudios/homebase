// plugins/sportadmin/discovery/discoverFromHtml.js
const { absoluteUrl, stripTags, metaContent } = require('../parser/htmlUtils');

/**
 * Discover public SportAdmin structure from a start-page HTML body.
 * @param {string} html
 * @param {string} pageUrl
 */
function discoverFromStartHtml(html, pageUrl) {
  const base = pageUrl;
  const orgName =
    metaContent(html, 'og:site_name') ||
    stripTags((html.match(/<title>([^<]*)<\/title>/i) || [])[1] || '') ||
    null;

  const logoMatch = html.match(
    /id=['"]foreningslogotyp['"][^>]*src=['"]([^'"]+)['"]|src=['"]([^'"]+)['"][^>]*id=['"]foreningslogotyp['"]/i,
  );
  const logoHref = logoMatch ? logoMatch[1] || logoMatch[2] : null;
  const logoUrl = absoluteUrl(base, logoHref);

  const isSportAdmin =
    /sportadmin/i.test(html) ||
    /\.web\.sportadmin\.se/i.test(pageUrl) ||
    /saGen\.css|getLogga\.asp/i.test(html);

  /** @type {Array<{ sid: string, name: string, category: string|null, href: string }>} */
  const teams = [];
  const teamSeen = new Set();
  // Team SIDs appear in mobile menyLista and desktop lagmeny; scan the full document.
  let currentCategory = null;
  const categoryRe = /<b>([^<]+)<\/b>/gi;
  const teamRe =
    /<a[^>]+href=['"]([^'"]*[?&]SID=(\d+)[^'"]*)['"][^>]*>\s*<span>\s*([^<]+?)\s*<\/span>/gi;

  // Walk in document order by finding next category or team.
  const tokens = [];
  let m;
  while ((m = categoryRe.exec(html))) {
    tokens.push({ index: m.index, kind: 'cat', value: stripTags(m[1]) });
  }
  while ((m = teamRe.exec(html))) {
    tokens.push({
      index: m.index,
      kind: 'team',
      sid: m[2],
      name: stripTags(m[3]),
      href: absoluteUrl(base, m[1]),
    });
  }
  tokens.sort((a, b) => a.index - b.index);
  for (const token of tokens) {
    if (token.kind === 'cat') {
      if (token.value && !/^hem$/i.test(token.value)) {
        currentCategory = token.value;
      }
      continue;
    }
    if (!token.sid || !token.name || /^hem$/i.test(token.name) || teamSeen.has(token.sid)) {
      continue;
    }
    teamSeen.add(token.sid);
    teams.push({
      sid: token.sid,
      name: token.name,
      category: currentCategory,
      href: token.href,
    });
  }

  /** @type {Record<string, string|null>} */
  const sections = {
    start: null,
    news: null,
    matches: null,
    calendar: null,
    documents: null,
    gallery: null,
    about: null,
    teamsOverview: null,
  };

  const navLinkRe =
    /<a[^>]+href=['"]([^'"]+)['"][^>]*>\s*(?:<span>)?\s*([^<]+?)\s*(?:<\/span>)?\s*<\/a>/gi;
  while ((m = navLinkRe.exec(html))) {
    const href = absoluteUrl(base, m[1]);
    const label = stripTags(m[2]).toLowerCase();
    if (!href) {
      continue;
    }
    if (/\/nyheter\//i.test(href) || label.includes('nyhet')) {
      sections.news = sections.news || href;
    } else if (/\/match\//i.test(href) || label === 'matcher') {
      sections.matches = sections.matches || href;
    } else if (/\/kalender\//i.test(href) || label.includes('kalender')) {
      sections.calendar = sections.calendar || href;
    } else if (/\/dokument\//i.test(href) || label.includes('dokument')) {
      sections.documents = sections.documents || href;
    } else if (/\/galleri\//i.test(href) || label.includes('bilder')) {
      sections.gallery = sections.gallery || href;
    } else if (/\/sektion\//i.test(href) || label.includes('lag')) {
      sections.teamsOverview = sections.teamsOverview || href;
    } else if (/\/sida\//i.test(href) && label.includes('om ')) {
      sections.about = sections.about || href;
    } else if (/\/start\//i.test(href) || label === 'hem') {
      sections.start = sections.start || href;
    }
  }

  const webcalMatch = html.match(/https?:\/\/portalweb\.sportadmin\.se\/webcal\?id=[0-9a-f-]+/i);
  const ajaxCalMatch = html.match(/ajaxKalender\.asp\?ID=(\d+)/i);
  const calendarAjaxUrl = ajaxCalMatch
    ? absoluteUrl(base, `../kalender/ajaxKalender.asp?ID=${ajaxCalMatch[1]}`)
    : sections.calendar
      ? absoluteUrl(
          sections.calendar,
          'ajaxKalender.asp' + (new URL(sections.calendar).search || ''),
        )
      : null;

  /** @type {Array<{ nid: string, title: string, href: string, publishedAt: string|null }>} */
  const newsTeasers = [];
  const newsRe = /<a[^>]+href=['"]([^'"]*[?&]NID=(\d+)[^'"]*)['"][^>]*>([\s\S]*?)<\/a>/gi;
  while ((m = newsRe.exec(html))) {
    const nid = m[2];
    const href = absoluteUrl(base, m[1]);
    const inner = stripTags(m[3]);
    const dateMatch = inner.match(/(\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?)/);
    const title = inner.replace(/\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/, '').trim();
    if (!nid || !title) {
      continue;
    }
    if (newsTeasers.some((n) => n.nid === nid)) {
      continue;
    }
    newsTeasers.push({
      nid,
      title,
      href,
      publishedAt: dateMatch ? dateMatch[1] : null,
    });
  }

  const teamSidSet = new Set(teams.map((t) => t.sid));
  /** @type {Array<{ sourceId: string, pageId: string, kind: string, name: string, href: string }>} */
  const pages = [];
  const pageSeen = new Set();
  const pageNavRe =
    /<a[^>]+href=['"]([^'"]+)['"][^>]*>\s*(?:<span>)?\s*([^<]+?)\s*(?:<\/span>)?\s*<\/a>/gi;
  while ((m = pageNavRe.exec(html))) {
    const href = absoluteUrl(base, m[1]);
    const name = stripTags(m[2]);
    if (!href || !name) {
      continue;
    }
    if (/platform=/i.test(href) || /webbversion/i.test(name)) {
      continue;
    }
    // Functional modules synced as their own resource types — not club "pages".
    if (/\/nyheter\//i.test(href) || /\/match\//i.test(href) || /\/kalender\//i.test(href)) {
      continue;
    }
    const sidMatch = href.match(/[?&]SID=(\d+)/i);
    if (sidMatch && teamSidSet.has(sidMatch[1])) {
      continue;
    }

    let kind = null;
    let pageId = null;
    if (/\/sida\//i.test(href)) {
      kind = 'sida';
      pageId = (href.match(/[?&]ID=(\d+)/i) || [])[1] || null;
    } else if (/\/start\//i.test(href)) {
      kind = 'start';
      pageId = (href.match(/[?&]ID=(\d+)/i) || [])[1] || null;
    } else if (/\/sektion\//i.test(href)) {
      kind = 'sektion';
      pageId = (href.match(/[?&]ID=(\d+)/i) || [])[1] || null;
    } else if (/\/dokument\//i.test(href)) {
      kind = 'dokument';
      pageId = (href.match(/[?&]ID=(\d+)/i) || [])[1] || null;
    } else if (/\/galleri\//i.test(href)) {
      kind = 'galleri';
      pageId = (href.match(/[?&]ID=(\d+)/i) || [])[1] || null;
    } else {
      continue;
    }
    if (!pageId) {
      continue;
    }
    // One home entry only (/start/), skip duplicate Hem labels.
    if (kind === 'start' && [...pageSeen].some((id) => id.startsWith('start:'))) {
      continue;
    }
    const sourceId = `${kind}:${pageId}`;
    if (pageSeen.has(sourceId)) {
      continue;
    }
    pageSeen.add(sourceId);
    pages.push({
      sourceId,
      pageId,
      kind,
      name,
      href,
    });
  }

  return {
    isSportAdmin,
    orgName,
    logoUrl,
    teams,
    pages,
    sections,
    newsTeasers,
    webcalUrl: webcalMatch ? webcalMatch[0] : null,
    calendarAjaxUrl,
  };
}

module.exports = { discoverFromStartHtml };
