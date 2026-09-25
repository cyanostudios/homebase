// plugins/sportadmin/parser/MatchParser.js
const { stripTags, absoluteUrl } = require('./htmlUtils');
const { sanitizeText, sanitizeUrl } = require('../sanitize/sanitize');

function parseMatchList(html, pageUrl) {
  /** @type {Array<{ aid: string, href: string, snippet: string }>} */
  const items = [];
  const seen = new Set();
  const re = /href=['"]([^'"]*[?&]AID=(\d+)[^'"]*)['"]/gi;
  let m;
  while ((m = re.exec(html))) {
    const aid = m[2];
    if (seen.has(aid)) {
      continue;
    }
    seen.add(aid);
    const href = absoluteUrl(pageUrl, m[1]);
    const start = Math.max(0, m.index - 200);
    const snippet = stripTags(html.slice(start, m.index + 400));
    items.push({ aid, href, snippet });
  }
  return items;
}

function parseMatchDetail(html, pageUrl, orgName) {
  const aidMatch = pageUrl.match(/[?&]AID=(\d+)/i);
  const sourceId = aidMatch ? aidMatch[1] : `url:${pageUrl}`;

  let homeTeam = null;
  let awayTeam = null;
  const vsBlock = html.match(
    /title=['"]([^'"]+)['"][\s\S]{0,200}?>([^<]*)<\/[\s\S]{0,400}?vs[\s\S]{0,400}?title=['"]([^'"]+)['"]/i,
  );
  if (vsBlock) {
    homeTeam = sanitizeText(vsBlock[1] || vsBlock[2]);
    awayTeam = sanitizeText(vsBlock[3]);
  } else {
    const boldTeams = [...html.matchAll(/<b[^>]*>\s*([^<]{2,80})\s*<\/b>/gi)].map((x) =>
      sanitizeText(x[1]),
    );
    const filtered = boldTeams.filter((t) => t && !/^vs$/i.test(t) && t.length < 60);
    if (filtered.length >= 2) {
      homeTeam = filtered[0];
      awayTeam = filtered[1];
    }
  }

  const timeMatch = html.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  const dateMatch = html.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  const venueMatch =
    html.match(/class=['"]mCal['"][^>]*>([\s\S]*?)<\//i) ||
    html.match(/Plats[:\s]*<\/[^>]+>\s*([^<]{3,120})/i);

  const org = sanitizeText(orgName || '');
  let isHome = null;
  let opponent = null;
  let team = null;
  if (homeTeam && awayTeam && org) {
    const homeHasOrg = homeTeam.toLowerCase().includes(org.toLowerCase().slice(0, 8));
    const awayHasOrg = awayTeam.toLowerCase().includes(org.toLowerCase().slice(0, 8));
    if (homeHasOrg && !awayHasOrg) {
      isHome = true;
      opponent = awayTeam;
    } else if (awayHasOrg && !homeHasOrg) {
      isHome = false;
      opponent = homeTeam;
    }
  }

  return {
    type: 'match',
    source_id: sourceId,
    team,
    home_team: homeTeam,
    away_team: awayTeam,
    opponent,
    is_home: isHome,
    date: dateMatch ? dateMatch[1] : null,
    time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null,
    venue: venueMatch ? sanitizeText(venueMatch[1]) : null,
    pitch: null,
    category: null,
    image_url: sanitizeUrl(
      (html.match(/cdn\.sportadmin\.se\/0\/clubmark\/[^"'>\s]+/i) || [])[0]
        ? `https://${(html.match(/cdn\.sportadmin\.se\/0\/clubmark\/[^"'>\s]+/i) || [])[0]}`
        : null,
    ),
    source_url: pageUrl,
  };
}

module.exports = { parseMatchList, parseMatchDetail };
