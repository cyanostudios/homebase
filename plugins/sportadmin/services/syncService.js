// plugins/sportadmin/services/syncService.js
const { Logger } = require('@homebase/core');
const { SportadminHttpClient } = require('../client/httpClient');
const { discoverFromStartHtml } = require('../discovery/discoverFromHtml');
const { parseOrganization } = require('../parser/OrganizationParser');
const {
  parseTeamFromDiscovery,
  bodyToDescription,
  extractBodyHtml,
  htmlToPlainText,
} = require('../parser/TeamParser');
const { parseClubPage } = require('../parser/PageParser');
const { parseGroupPage } = require('../parser/GroupParser');
const { metaContent } = require('../parser/htmlUtils');
const { parseNewsDetail, parseNewsListFromHtml } = require('../parser/NewsParser');
const { parseMatchList, parseMatchDetail } = require('../parser/MatchParser');
const { parseCalendarAjax } = require('../parser/CalendarParser');
const { parsePublicLinks } = require('../parser/LinkParser');
const { normalizeResource } = require('../normalizer/normalize');

const MAX_NEWS_DETAILS = 15;
const MAX_MATCH_DETAILS = 20;
const MAX_TEAM_PAGES = 20;
const MAX_CLUB_PAGES = 20;

function normalizeSiteUrl(siteUrl) {
  const u = new URL(siteUrl);
  u.hash = '';
  let path = u.pathname || '/';
  if (!path.endsWith('/')) {
    // keep as-is for deep URLs; for bare host ensure trailing slash
    if (path === '' || path === '/') {
      path = '/';
    }
  }
  u.pathname = path;
  return u.href;
}

function siteHostFromUrl(siteUrl) {
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * @param {object} model
 * @param {object} req
 * @param {{ connectionTestOnly?: boolean }} [opts]
 */
async function runSportadminSync(model, req, opts = {}) {
  const config = await model.getConfig(req);
  if (!config.site_url) {
    const err = new Error('SportAdmin URL is not configured');
    err.statusCode = 400;
    throw err;
  }

  const siteUrl = normalizeSiteUrl(config.site_url);
  const siteHost = siteHostFromUrl(siteUrl);
  // Custom club domains (e.g. www.sorgenfriff.se) are allowed only as this siteHost;
  // discovered crawl URLs must still be siteHost or fixed SportAdmin hosts.
  const client = new SportadminHttpClient({ siteHost, concurrency: 1 });
  const attemptedAt = new Date().toISOString();
  await model.updateSyncMeta(req, {
    last_attempted_sync: attemptedAt,
    last_error: null,
  });
  await model.clearOldErrors(req);

  const errors = [];
  const logError = async (resource, status, message) => {
    errors.push({ at: new Date().toISOString(), resource, status: status ?? null, message });
    await model.addError(req, { resource, status, message });
    Logger.warn('[SportAdmin] ERROR', { resource, status, message });
  };

  Logger.info('[SportAdmin] sync started', { siteUrl });

  const startRes = await client.get(siteUrl);
  if (!startRes.ok) {
    await logError(siteUrl, startRes.status, startRes.error);
    await model.updateSyncMeta(req, {
      last_attempted_sync: attemptedAt,
      last_error: startRes.error || 'Start page unreachable',
    });
    return {
      ok: false,
      error: startRes.error,
      connectionTest: [
        { key: 'reachable', ok: false, label: 'URL reachable', detail: startRes.error },
      ],
    };
  }

  const discovery = discoverFromStartHtml(startRes.body, startRes.url);
  const connectionTest = [
    {
      key: 'reachable',
      ok: true,
      label: 'URL reachable',
    },
    {
      key: 'sportadmin',
      ok: discovery.isSportAdmin,
      label: discovery.isSportAdmin ? 'SportAdmin detected' : 'SportAdmin not detected',
      warning: !discovery.isSportAdmin,
    },
    {
      key: 'organization',
      ok: Boolean(discovery.orgName),
      label: discovery.orgName
        ? `Organization found (${discovery.orgName})`
        : 'Organization not found',
      warning: !discovery.orgName,
    },
    {
      key: 'teams',
      ok: discovery.teams.length > 0,
      label:
        discovery.teams.length > 0 ? `${discovery.teams.length} teams found` : 'Teams not found',
      warning: discovery.teams.length === 0,
    },
    {
      key: 'news',
      ok: Boolean(discovery.sections.news) || discovery.newsTeasers.length > 0,
      label:
        discovery.newsTeasers.length > 0
          ? `${discovery.newsTeasers.length} news teasers found`
          : discovery.sections.news
            ? 'News section found'
            : 'News not found',
      warning: !discovery.sections.news && discovery.newsTeasers.length === 0,
    },
    {
      key: 'matches',
      ok: Boolean(discovery.sections.matches),
      label: discovery.sections.matches ? 'Matches section found' : 'Matches not found',
      warning: !discovery.sections.matches,
    },
    {
      key: 'calendar',
      ok: Boolean(discovery.calendarAjaxUrl || discovery.sections.calendar),
      label: discovery.calendarAjaxUrl
        ? 'Calendar found'
        : discovery.sections.calendar
          ? 'Calendar page found'
          : 'Calendar not found',
      warning: !discovery.calendarAjaxUrl && !discovery.sections.calendar,
    },
  ];

  if (discovery.webcalUrl) {
    const calFeed = await client.get(discovery.webcalUrl.replace(/^webcal:/i, 'https:'));
    connectionTest.push({
      key: 'ical',
      ok: calFeed.ok,
      warning: !calFeed.ok,
      label: calFeed.ok ? 'Calendar feed available' : 'Calendar feed not available',
      detail: calFeed.ok ? undefined : calFeed.error || `HTTP ${calFeed.status}`,
    });
  } else {
    connectionTest.push({
      key: 'ical',
      ok: false,
      warning: true,
      label: 'Calendar feed not found',
    });
  }

  const discoveryTree = {
    label: 'START',
    children: [
      { label: 'Teams', count: discovery.teams.length },
      { label: 'News', count: discovery.newsTeasers.length },
      {
        label: 'Matches',
        count: discovery.sections.matches ? 1 : 0,
        warning: !discovery.sections.matches,
      },
      {
        label: 'Calendar',
        count: discovery.calendarAjaxUrl || discovery.sections.calendar ? 1 : 0,
        warning: !discovery.calendarAjaxUrl && !discovery.sections.calendar,
      },
      { label: 'Documents', count: discovery.sections.documents ? 1 : 0 },
    ],
  };

  if (opts.connectionTestOnly) {
    await model.updateSyncMeta(req, {
      last_attempted_sync: attemptedAt,
      connection_test: connectionTest,
      discovery_snapshot: {
        siteUrl,
        tree: discoveryTree,
        resources: discovery.teams.map((t) => ({
          id: `sportadmin:team:${t.sid}`,
          type: 'team',
          source_url: t.href,
        })),
        errors,
      },
      last_error: discovery.isSportAdmin ? null : 'SportAdmin shell not detected',
    });
    return { ok: discovery.isSportAdmin, connectionTest, discovery };
  }

  if (!discovery.isSportAdmin) {
    await model.updateSyncMeta(req, {
      last_attempted_sync: attemptedAt,
      last_error: 'SportAdmin shell not detected',
      connection_test: connectionTest,
      discovery_snapshot: { siteUrl, tree: discoveryTree, errors },
    });
    return { ok: false, error: 'SportAdmin shell not detected', connectionTest };
  }

  let written = 0;
  let skipped = 0;

  const upsert = async (parsed) => {
    const row = normalizeResource(parsed);
    const result = await model.upsertResource(req, row);
    if (result.skipped) {
      skipped += 1;
    } else {
      written += 1;
    }
    return row;
  };

  await upsert(parseOrganization(startRes.body, startRes.url, discovery));
  Logger.info('[SportAdmin] organization discovered', { name: discovery.orgName });

  for (const link of parsePublicLinks(startRes.body, startRes.url).slice(0, 20)) {
    await upsert({ type: 'link', ...link, image_url: null });
  }

  const pagesToFetch = (discovery.pages || []).slice(0, MAX_CLUB_PAGES);
  for (let i = 0; i < pagesToFetch.length; i += 1) {
    const page = pagesToFetch[i];
    const pageUrl = page.href;
    const pageRes = await client.get(pageUrl);
    if (!pageRes.ok) {
      await logError(pageUrl, pageRes.status, pageRes.error);
      await upsert({
        ...parseClubPage(page, pageUrl, ''),
        sort_index: i,
      });
      continue;
    }
    await upsert({
      ...parseClubPage(page, pageRes.url, pageRes.body),
      sort_index: i,
    });
  }
  Logger.info('[SportAdmin] club pages discovered', { count: pagesToFetch.length });

  const teamsToFetch = discovery.teams.slice(0, MAX_TEAM_PAGES);
  for (const team of teamsToFetch) {
    const teamUrl = team.href || `${new URL(siteUrl).origin}/?SID=${team.sid}`;
    const teamRes = await client.get(teamUrl);
    if (!teamRes.ok) {
      await logError(teamUrl, teamRes.status, teamRes.error);
      await upsert(parseTeamFromDiscovery(team, teamUrl, ''));
      continue;
    }
    const parsed = parseTeamFromDiscovery(team, teamRes.url, teamRes.body);
    const modules = parsed.modules || {};

    // Team-scoped Truppen (/grupp/) — skip gallery by design.
    if (modules.roster) {
      const rosterRes = await client.get(modules.roster);
      if (rosterRes.ok) {
        const group = parseGroupPage(rosterRes.body, rosterRes.url);
        parsed.players = group.players;
        parsed.leaders = group.leaders;
      } else {
        await logError(modules.roster, rosterRes.status, rosterRes.error);
      }
    }

    // Team-scoped Kontakt (/sida/) — short public contact copy (mailto often stripped by HTML sanitizer).
    if (modules.contact) {
      const contactRes = await client.get(modules.contact);
      if (contactRes.ok) {
        const bodyHtml = extractBodyHtml(contactRes.body);
        const ogDescription = metaContent(contactRes.body, 'og:description');
        parsed.contact =
          htmlToPlainText(bodyHtml) || bodyToDescription(bodyHtml, ogDescription) || ogDescription;
      } else {
        await logError(modules.contact, contactRes.status, contactRes.error);
      }
    }

    await upsert(parsed);
  }
  Logger.info('[SportAdmin] teams discovered', { count: teamsToFetch.length });

  /** @type {Array<{ nid: string, href: string, title?: string, publishedAt?: string|null }>} */
  let newsItems = [...discovery.newsTeasers];
  if (discovery.sections.news) {
    const newsListRes = await client.get(discovery.sections.news);
    if (newsListRes.ok) {
      const listed = parseNewsListFromHtml(newsListRes.body, newsListRes.url);
      for (const item of listed) {
        if (!newsItems.some((n) => n.nid === item.nid)) {
          newsItems.push(item);
        }
      }
    } else {
      await logError(discovery.sections.news, newsListRes.status, newsListRes.error);
    }
  }

  newsItems = newsItems.slice(0, MAX_NEWS_DETAILS);
  for (const item of newsItems) {
    const newsRes = await client.get(item.href);
    if (!newsRes.ok) {
      await logError(item.href, newsRes.status, newsRes.error);
      await upsert({
        type: 'news',
        source_id: item.nid,
        title: item.title || `News ${item.nid}`,
        excerpt: null,
        content: null,
        image_url: null,
        published_at: item.publishedAt || null,
        source_url: item.href,
      });
      continue;
    }
    await upsert(parseNewsDetail(newsRes.body, newsRes.url));
  }
  Logger.info('[SportAdmin] news items discovered', { count: newsItems.length });

  let matchCount = 0;
  if (discovery.sections.matches) {
    const matchListRes = await client.get(discovery.sections.matches);
    if (matchListRes.ok) {
      const matches = parseMatchList(matchListRes.body, matchListRes.url).slice(
        0,
        MAX_MATCH_DETAILS,
      );
      for (const match of matches) {
        const detailRes = await client.get(match.href);
        if (!detailRes.ok) {
          await logError(match.href, detailRes.status, detailRes.error);
          continue;
        }
        await upsert(parseMatchDetail(detailRes.body, detailRes.url, discovery.orgName));
        matchCount += 1;
      }
    } else {
      await logError(discovery.sections.matches, matchListRes.status, matchListRes.error);
    }
  }
  Logger.info('[SportAdmin] matches discovered', { count: matchCount });

  let eventCount = 0;
  if (discovery.calendarAjaxUrl) {
    const calRes = await client.get(discovery.calendarAjaxUrl);
    if (calRes.ok) {
      const events = parseCalendarAjax(calRes.body, calRes.url).slice(0, 80);
      for (const event of events) {
        await upsert({
          type: 'event',
          ...event,
          image_url: null,
        });
        eventCount += 1;
      }
    } else {
      await logError(discovery.calendarAjaxUrl, calRes.status, calRes.error);
    }
  }
  Logger.info('[SportAdmin] events discovered', { count: eventCount });

  const successAt = new Date().toISOString();
  const hasPartialErrors = errors.length > 0;
  await model.updateSyncMeta(req, {
    last_successful_sync: successAt,
    last_attempted_sync: attemptedAt,
    last_error: hasPartialErrors ? `${errors.length} resource error(s) during sync` : null,
    connection_test: connectionTest,
    discovery_snapshot: {
      siteUrl,
      tree: {
        label: 'START',
        children: [
          { label: 'Pages', count: pagesToFetch.length },
          { label: 'Teams', count: teamsToFetch.length },
          { label: 'News', count: newsItems.length },
          { label: 'Matches', count: matchCount },
          { label: 'Calendar', count: eventCount, warning: eventCount === 0 },
          { label: 'Documents', count: discovery.sections.documents ? 1 : 0 },
        ],
      },
      resources: [
        ...pagesToFetch.map((p) => ({
          id: `sportadmin:page:${p.sourceId}`,
          type: 'page',
          source_url: p.href,
        })),
        ...teamsToFetch.map((t) => ({
          id: `sportadmin:team:${t.sid}`,
          type: 'team',
          source_url: t.href,
        })),
      ],
      errors,
    },
  });

  Logger.info('[SportAdmin] sync completed', { written, skipped, errors: errors.length });
  return {
    ok: true,
    written,
    skipped,
    errors,
    connectionTest,
  };
}

module.exports = {
  runSportadminSync,
  normalizeSiteUrl,
  siteHostFromUrl,
};
