// plugins/site-audits/services/crawler.js
// Crawl starting at the audit URL. The entry URL is fetched first so a redirect
// (apex → www) can set the crawl host from the final URL. robots.txt and sitemap.xml are then
// read for that host, followed by a BFS of same-host HTML links under the start URL's path
// prefix (whole host when path is `/`), capped at 500 pages (50 in quick mode), with a short
// delay between fetches. Read-only — GET only. Respects robots.txt disallow rules. Quick mode
// skips security-path probes and the homepage compression probe; robots, sitemap, llms.txt,
// TLS, and DNS still run.
const { safeFetch } = require('./safeFetch');
const { validateAuditUrl, resolveAndAssertPublic } = require('./urlGuard');
const { parseRobots, summarizeAiBots, DEFAULT_USER_AGENT } = require('./robotsParser');
const { runSecurityProbes } = require('./securityProbes');
const { extractLocs, isSitemapIndex } = require('./sitemapParser');
const { analyzeHtml } = require('./htmlAnalyzer');
const { inspectTls } = require('./tlsInventory');
const { inspectDns } = require('./dnsInventory');
const { aggregateResources } = require('./resourceInventory');
const { buildCrawlGraph } = require('./crawlGraph');
const { sleep: cancelAwareSleep, throwIfAborted } = require('./auditCancel');
const { isInPathScope, pathScopeFromStartUrl } = require('./pathScope');

const MAX_PAGES = 500;
const CRAWL_DELAY_MS = 200;
const QUICK_MAX_PAGES = 50;
const QUICK_CRAWL_DELAY_MS = 50;
const MAX_SITEMAP_FILES = 3;
const MAX_SITEMAP_INDEX_CHILDREN = 5;
const MAX_QUEUE_SIZE = MAX_PAGES * 4;

function sleep(ms, signal) {
  return cancelAwareSleep(ms, signal);
}

function normalizePageUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function auditHostname(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return null;
  }
}

function isSameAuditHost(urlString, host) {
  const candidate = auditHostname(urlString);
  return !!host && !!candidate && candidate === host;
}

function isHtmlDocument(body, contentType) {
  const contentTypeText = String(contentType || '').toLowerCase();
  if (contentTypeText.includes('text/html') || contentTypeText.includes('application/xhtml'))
    return true;
  const head = String(body || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .slice(0, 200);
  return /^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head);
}

async function fetchRobots(origin) {
  try {
    const res = await safeFetch(`${origin}/robots.txt`);
    if (res.ok && typeof res.body === 'string') {
      return {
        found: true,
        parsed: parseRobots(res.body, { userAgent: DEFAULT_USER_AGENT }),
        aiBotRobots: summarizeAiBots(res.body),
      };
    }
  } catch {
    // fall through to "not found"
  }
  return {
    found: false,
    parsed: parseRobots('', { userAgent: DEFAULT_USER_AGENT }),
    aiBotRobots: summarizeAiBots(''),
  };
}

async function fetchLlmsTxt(origin, host) {
  const url = `${origin}/llms.txt`;
  try {
    const res = await safeFetch(url);
    if (!res || res.statusCode !== 200 || typeof res.body !== 'string') return false;
    if (host && res.finalUrl && !isSameAuditHost(res.finalUrl, host)) return false;
    const body = res.body.trim();
    if (!body) return false;
    // SPA fallbacks answer 200 + HTML for every unknown path. That is not an llms.txt.
    if (isHtmlDocument(body, res.headers?.['content-type'])) return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchSitemapUrls(origin, sitemapHints, host, signal, crawlDelayMs = CRAWL_DELAY_MS) {
  const collected = new Set();
  // robots.txt Sitemap directives are absolute and sometimes point off-host (or at a
  // private address). Only fetch same-host sitemaps; fall back to /sitemap.xml on the
  // audit origin when every hint is off-host.
  const sameHostHints = sitemapHints.filter((url) => isSameAuditHost(url, host));
  const candidates = (sameHostHints.length ? sameHostHints : [`${origin}/sitemap.xml`]).filter(
    (url) => isSameAuditHost(url, host),
  );
  let found = false;

  for (const sitemapUrl of candidates.slice(0, MAX_SITEMAP_FILES)) {
    throwIfAborted(signal);
    let res;
    try {
      // eslint-disable-next-line no-await-in-loop
      res = await safeFetch(sitemapUrl);
    } catch {
      continue; // eslint-disable-line no-continue
    }
    if (!res.ok || typeof res.body !== 'string') continue; // eslint-disable-line no-continue

    found = true;
    const locs = extractLocs(res.body);

    if (isSitemapIndex(res.body)) {
      for (const childSitemapUrl of locs.slice(0, MAX_SITEMAP_INDEX_CHILDREN)) {
        if (!isSameAuditHost(childSitemapUrl, host)) continue; // eslint-disable-line no-continue
        // eslint-disable-next-line no-await-in-loop
        await sleep(crawlDelayMs, signal);
        try {
          // eslint-disable-next-line no-await-in-loop
          const childRes = await safeFetch(childSitemapUrl);
          if (childRes.ok && typeof childRes.body === 'string') {
            extractLocs(childRes.body).forEach((loc) => collected.add(loc));
          }
        } catch {
          // ignore a single broken child sitemap
        }
      }
    } else {
      locs.forEach((loc) => collected.add(loc));
    }
  }

  return { found, urls: Array.from(collected) };
}

function failedPage(currentUrl, message, depth = 0) {
  return {
    url: currentUrl,
    finalUrl: currentUrl,
    statusCode: null,
    elapsedMs: null,
    redirects: [],
    depth,
    analysis: { htmlSize: 0 },
    error: message,
  };
}

function pageFromResult(currentUrl, result, depth = 0) {
  const contentType = String(result.headers?.['content-type'] || '');
  const isHtml =
    !contentType ||
    contentType.includes('text/html') ||
    contentType.includes('application/xhtml+xml');
  const analysis =
    isHtml && result.body
      ? analyzeHtml(result.body, result.finalUrl || currentUrl)
      : { htmlSize: Buffer.byteLength(result.body || '', 'utf8') };

  return {
    isHtml,
    page: {
      url: currentUrl,
      finalUrl: result.finalUrl || currentUrl,
      statusCode: result.statusCode,
      elapsedMs: result.elapsedMs,
      redirects: result.redirects,
      depth,
      analysis,
      error: result.error,
    },
  };
}

function enqueueLinks(queue, visited, links, depth, pathScope) {
  if (!Array.isArray(links)) return;
  for (const link of links) {
    const normalized = normalizePageUrl(link);
    if (
      normalized &&
      !visited.has(normalized) &&
      isInPathScope(normalized, pathScope) &&
      queue.length < MAX_QUEUE_SIZE
    ) {
      queue.push({ url: normalized, depth });
    }
  }
}

async function probeHomepageCompression(homepageUrl) {
  if (!homepageUrl) {
    return { contentEncoding: null, ok: false, error: 'No homepage URL' };
  }
  try {
    const result = await safeFetch(homepageUrl, {
      extraHeaders: { 'Accept-Encoding': 'gzip, deflate, br' },
    });
    const raw = result.headers?.['content-encoding'];
    const contentEncoding = Array.isArray(raw) ? raw[0] : raw || null;
    return {
      contentEncoding: contentEncoding ? String(contentEncoding).slice(0, 80) : null,
      ok: result.ok === true,
      error: result.error || null,
    };
  } catch (err) {
    return { contentEncoding: null, ok: false, error: err?.message || 'Compression probe failed' };
  }
}

/**
 * @param {string} startUrl - the site's homepage / entry URL
 * @param {{ signal?: AbortSignal, mode?: 'full'|'quick' }} [options]
 * @returns {Promise<{
 *   pages: Array<{ url: string, finalUrl: string, statusCode: number|null, elapsedMs: number|null,
 *     redirects: Array, analysis: Object, error: string|null }>,
 *   siteMeta: Object
 * }>}
 */
async function crawl(startUrl, options = {}) {
  const signal = options.signal;
  const auditMode = options.mode === 'quick' ? 'quick' : 'full';
  const maxPages = auditMode === 'quick' ? QUICK_MAX_PAGES : MAX_PAGES;
  const crawlDelayMs = auditMode === 'quick' ? QUICK_CRAWL_DELAY_MS : CRAWL_DELAY_MS;
  throwIfAborted(signal);

  const check = validateAuditUrl(startUrl);
  if (!check.ok) {
    throw new Error(check.error);
  }

  const dnsCheck = await resolveAndAssertPublic(check.url.hostname);
  if (!dnsCheck.ok) {
    throw new Error(dnsCheck.error);
  }
  throwIfAborted(signal);

  // Host and origin start on the requested URL, then move to the entry URL's final URL
  // after a successful fetch. Apex and www are different hostnames; keeping the start
  // host would drop every www link and sitemap loc after an apex→www redirect.
  // Path scope comes from the URL the operator entered (before redirect retargets host).
  let origin = check.url.origin;
  let host = auditHostname(startUrl);
  const pathScope = pathScopeFromStartUrl(startUrl);

  const visited = new Set();
  const queue = [];
  const pages = [];
  let homepageHeaders = {};
  let homepageLinks = [];
  let homepageFinalUrl = null;

  const normalizedStart = normalizePageUrl(startUrl);
  if (normalizedStart) {
    visited.add(normalizedStart);
    try {
      const result = await safeFetch(normalizedStart);
      homepageHeaders = result.headers || {};
      const recorded = pageFromResult(normalizedStart, result, 0);
      pages.push(recorded.page);
      homepageLinks = recorded.page.analysis?.internalLinks || [];
      homepageFinalUrl = recorded.page.finalUrl || normalizedStart;

      if (result.ok && result.finalUrl) {
        const resolvedHost = auditHostname(result.finalUrl);
        if (resolvedHost) {
          host = resolvedHost;
          try {
            origin = new URL(result.finalUrl).origin;
          } catch {
            // Keep the start origin when finalUrl cannot be parsed.
          }
        }
        const normalizedFinal = normalizePageUrl(result.finalUrl);
        if (normalizedFinal) visited.add(normalizedFinal);
      }
    } catch (err) {
      pages.push(failedPage(normalizedStart, err?.message || 'Fetch failed', 0));
    }
  }

  const robots = await fetchRobots(origin);
  throwIfAborted(signal);
  const sitemap = await fetchSitemapUrls(
    origin,
    robots.parsed.sitemaps,
    host,
    signal,
    crawlDelayMs,
  );

  for (const url of sitemap.urls) {
    const normalized = normalizePageUrl(url);
    if (normalized && isSameAuditHost(normalized, host) && isInPathScope(normalized, pathScope)) {
      queue.push({ url: normalized, depth: 1 });
    }
  }
  // Sitemap URLs stay ahead of links discovered on the entry page, matching the previous BFS order.
  enqueueLinks(queue, visited, homepageLinks, 1, pathScope);

  while (queue.length > 0 && pages.length < maxPages) {
    throwIfAborted(signal);
    const item = queue.shift();
    const currentUrl = item?.url;
    const depth = typeof item?.depth === 'number' ? item.depth : 1;
    if (!currentUrl || visited.has(currentUrl)) continue; // eslint-disable-line no-continue
    visited.add(currentUrl);

    let currentHost;
    let currentPath;
    try {
      const parsedCurrent = new URL(currentUrl);
      currentHost = auditHostname(parsedCurrent.toString());
      currentPath = parsedCurrent.pathname || '/';
    } catch {
      continue; // eslint-disable-line no-continue
    }
    if (currentHost !== host) continue; // eslint-disable-line no-continue
    if (!isInPathScope(currentUrl, pathScope)) continue; // eslint-disable-line no-continue
    if (!robots.parsed.isAllowed(currentPath)) continue; // eslint-disable-line no-continue

    // eslint-disable-next-line no-await-in-loop
    await sleep(crawlDelayMs, signal);

    let result;
    try {
      // eslint-disable-next-line no-await-in-loop
      result = await safeFetch(currentUrl);
    } catch (err) {
      pages.push(failedPage(currentUrl, err?.message || 'Fetch failed', depth));
      continue; // eslint-disable-line no-continue
    }

    const recorded = pageFromResult(currentUrl, result, depth);
    pages.push(recorded.page);

    if (recorded.isHtml) {
      enqueueLinks(queue, visited, recorded.page.analysis?.internalLinks, depth + 1, pathScope);
    }
  }

  // Host is final (homepage redirect already retargeted origin). llms.txt and, in full mode,
  // the five security probes are extra GETs: they are not HTML pages and do not count toward
  // the page cap. Quick mode skips those probes and the compression probe.
  throwIfAborted(signal);
  await sleep(crawlDelayMs, signal);
  const llmsTxtFound = await fetchLlmsTxt(origin, host);
  throwIfAborted(signal);
  const securityProbes =
    auditMode === 'quick' ? [] : await runSecurityProbes(origin, { host, delayMs: crawlDelayMs });

  throwIfAborted(signal);
  const dnsInventory = await inspectDns(host);
  let tlsInventory = null;
  if (origin.startsWith('https://')) {
    let tlsPort = 443;
    try {
      const parsedOrigin = new URL(origin);
      tlsPort = parsedOrigin.port ? Number(parsedOrigin.port) : 443;
    } catch {
      tlsPort = 443;
    }
    throwIfAborted(signal);
    tlsInventory = await inspectTls(host, { port: tlsPort });
  }

  throwIfAborted(signal);
  let compression;
  if (auditMode === 'quick') {
    compression = { contentEncoding: null, skipped: true };
  } else {
    await sleep(crawlDelayMs, signal);
    compression = await probeHomepageCompression(homepageFinalUrl || normalizedStart);
  }

  const resources = aggregateResources(pages, host);
  const scopedSitemapUrls = (sitemap.urls || []).filter((url) => isInPathScope(url, pathScope));
  const crawlGraph = buildCrawlGraph({
    pages,
    sitemapUrls: scopedSitemapUrls,
    homepageUrl: homepageFinalUrl || normalizedStart,
  });

  return {
    pages,
    siteMeta: {
      auditMode,
      robotsTxtFound: robots.found,
      sitemapFound: sitemap.found,
      homepageHeaders,
      llmsTxtFound,
      aiBotRobots: robots.aiBotRobots,
      securityProbes,
      tls: tlsInventory,
      dns: dnsInventory,
      compression,
      resources,
      crawlGraph,
      pathScope,
    },
  };
}

module.exports = {
  crawl,
  MAX_PAGES,
  CRAWL_DELAY_MS,
  QUICK_MAX_PAGES,
  QUICK_CRAWL_DELAY_MS,
  isSameAuditHost,
  pathScopeFromStartUrl,
  isInPathScope,
};
