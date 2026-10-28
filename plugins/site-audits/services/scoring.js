// plugins/site-audits/services/scoring.js
// Pure scoring functions (no I/O) per ADR docs/ai/adr/SITE_AUDITS_ETAPP1.md:
// category weights indexing 0.30 / content 0.30 / technical 0.25 / sharing 0.15,
// findings carry severity critical | warning | info and an optional pillar (seo | ai | security).
// Category weights are fixed by the etapp 1 ADR. Point deductions below are etapp 1.1 only;
// HSTS deducts more than CSP / X-Content-Type-Options.
const { usefulJsonLdTypes, jsonLdHasAuthor } = require('./htmlAnalyzer');
const { buildSecurityHeadersInventory } = require('./securityHeadersInventory');
const { THIRD_PARTY_SCRIPT_HOST_INFO_THRESHOLD } = require('./resourceInventory');
const { detectTechnologies } = require('./techFingerprint');

const WEIGHTS = Object.freeze({ indexing: 0.3, content: 0.3, technical: 0.25, sharing: 0.15 });

const SLOW_RESPONSE_MS = 2000;
const LARGE_HTML_BYTES = 1.5 * 1024 * 1024;
const TITLE_MIN = 10;
const TITLE_MAX = 60;
const META_DESCRIPTION_MIN = 50;
const META_DESCRIPTION_MAX = 160;
const THIN_BODY_CHARS = 300;
const THIN_BODY_DEDUCTION = 10;
const MISSING_H2_DEDUCTION = 5;
const MIXED_CONTENT_DEDUCTION = 15;
const JSONLD_TYPE_DEDUCTION = 10;
const LLMS_DEDUCTION = 5;
const AI_BOT_DEDUCTION = 5;
const AUTHOR_DEDUCTION = 5;
const HSTS_DEDUCTION = 10;
const CSP_DEDUCTION = 4;
const XCTO_DEDUCTION = 3;
const REFERRER_POLICY_DEDUCTION = 3;
const PERMISSIONS_POLICY_DEDUCTION = 3;
const FRAME_PROTECTION_DEDUCTION = 3;
const COOKIE_FLAG_DEDUCTION = 5;
const PROBE_EXPOSURE_DEDUCTION = 25;
const PROBE_EXPOSURE_CAP = 50;
const TLS_EXPIRING_DAYS = 30;

function finding(severity, category, message, meta = {}) {
  return { severity, category, message, pillar: 'seo', ...meta };
}

function clampScore(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function average(numbers) {
  if (!numbers.length) return 0;
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

function weightedScore(categories) {
  return clampScore(
    categories.indexing * WEIGHTS.indexing +
      categories.content * WEIGHTS.content +
      categories.technical * WEIGHTS.technical +
      categories.sharing * WEIGHTS.sharing,
  );
}

/**
 * Score a single crawled page.
 * @param {{
 *   url: string,
 *   finalUrl?: string,
 *   statusCode?: number|null,
 *   elapsedMs?: number|null,
 *   analysis?: ReturnType<typeof import('./htmlAnalyzer').analyzeHtml>
 * }} pageData
 */
function analyzePage(pageData) {
  const page = pageData || {};
  const analysis = page.analysis || {};
  const url = page.url || page.finalUrl || null;
  const statusCode = page.statusCode ?? null;
  const isHttps = typeof page.finalUrl === 'string' && page.finalUrl.startsWith('https://');
  const elapsedMs = typeof page.elapsedMs === 'number' ? page.elapsedMs : null;
  const htmlSize = analysis.htmlSize ?? 0;
  const findings = [];

  // --- indexing (30%) ---
  let indexing = 100;
  if (analysis.noindex) {
    indexing -= 60;
    findings.push(
      finding('critical', 'indexing', 'Page has a noindex meta robots directive', {
        url,
        code: 'noindex',
      }),
    );
  }
  if (!analysis.canonical) {
    indexing -= 15;
    findings.push(
      finding('warning', 'indexing', 'Missing canonical link', { url, code: 'missing_canonical' }),
    );
  }
  if (statusCode != null && statusCode >= 400) {
    indexing -= 80;
    findings.push(
      finding('critical', 'indexing', `Page returned HTTP ${statusCode}`, {
        url,
        code: 'http_error_status',
      }),
    );
  } else if (statusCode != null && statusCode >= 300) {
    indexing -= 10;
    findings.push(
      finding('info', 'indexing', 'Page responded with a redirect', {
        url,
        code: 'redirect_response',
      }),
    );
  }
  const titleLower = (analysis.title || '').toLowerCase();
  if (
    statusCode === 200 &&
    (titleLower.includes('404') ||
      titleLower.includes('not found') ||
      titleLower.includes('page not found'))
  ) {
    indexing -= 30;
    findings.push(
      finding('warning', 'indexing', 'Possible soft-404 (HTTP 200 with a 404-like title)', {
        url,
        code: 'soft_404',
      }),
    );
  }
  indexing = clampScore(indexing);

  // --- content (30%) ---
  let content = 100;
  if (!analysis.title) {
    content -= 30;
    findings.push(
      finding('critical', 'content', 'Missing <title>', { url, code: 'missing_title' }),
    );
  } else if (analysis.title.length < TITLE_MIN || analysis.title.length > TITLE_MAX) {
    content -= 10;
    findings.push(
      finding(
        'warning',
        'content',
        `Title length (${analysis.title.length}) outside recommended ${TITLE_MIN}-${TITLE_MAX} characters`,
        {
          url,
          code: analysis.title.length < TITLE_MIN ? 'title_too_short' : 'title_too_long',
        },
      ),
    );
  }
  if (!analysis.metaDescription) {
    content -= 20;
    findings.push(
      finding('warning', 'content', 'Missing meta description', {
        url,
        code: 'missing_meta_description',
      }),
    );
  } else if (
    analysis.metaDescription.length < META_DESCRIPTION_MIN ||
    analysis.metaDescription.length > META_DESCRIPTION_MAX
  ) {
    content -= 10;
    findings.push(
      finding(
        'info',
        'content',
        `Meta description length (${analysis.metaDescription.length}) outside recommended ${META_DESCRIPTION_MIN}-${META_DESCRIPTION_MAX} characters`,
        { url, code: 'meta_description_length' },
      ),
    );
  }
  if (!analysis.h1Count) {
    content -= 20;
    findings.push(finding('warning', 'content', 'Missing H1', { url, code: 'missing_h1' }));
  } else if (analysis.h1Count > 1) {
    content -= 10;
    findings.push(
      finding('info', 'content', `Multiple H1 tags (${analysis.h1Count})`, {
        url,
        code: 'multiple_h1',
      }),
    );
  }
  if (analysis.shellOnly) {
    content -= 15;
    findings.push(
      finding(
        'warning',
        'content',
        'Page appears to be a JS-rendered shell with little crawlable content',
        { url, code: 'shell_only' },
      ),
    );
  }
  // htmlAnalyzer samples img alt. Any image with a missing or blank alt is a content warning.
  const images = Array.isArray(analysis.images) ? analysis.images : [];
  const missingAltCount = images.filter((img) => {
    if (!img || img.alt == null) return true;
    return String(img.alt).trim() === '';
  }).length;
  if (images.length > 0 && missingAltCount > 0) {
    content -= 10;
    findings.push(
      finding(
        'warning',
        'content',
        `${missingAltCount} of ${images.length} image(s) missing alt text`,
        { url, code: 'missing_alt' },
      ),
    );
  }
  // Thin text is an AI-readiness warning. Skip it when the page is already a JS shell —
  // that finding covers the same empty document.
  if (
    typeof analysis.bodyTextLength === 'number' &&
    analysis.bodyTextLength < THIN_BODY_CHARS &&
    !analysis.shellOnly
  ) {
    content -= THIN_BODY_DEDUCTION;
    findings.push(
      finding('warning', 'content', `Thin body text (${analysis.bodyTextLength} characters)`, {
        url,
        pillar: 'ai',
        code: 'thin_body',
      }),
    );
  }
  if (analysis.h1Count > 0 && analysis.h2Count === 0) {
    content -= MISSING_H2_DEDUCTION;
    findings.push(
      finding('info', 'content', 'H1 is present but the page has no H2', {
        url,
        pillar: 'ai',
        code: 'missing_h2',
      }),
    );
  }
  content = clampScore(content);

  // --- technical (25%) ---
  let technical = 100;
  if (!isHttps) {
    technical -= 30;
    findings.push(
      finding('critical', 'technical', 'Page is served over HTTP, not HTTPS', {
        url,
        code: 'not_https',
      }),
    );
  }
  if (elapsedMs != null && elapsedMs > SLOW_RESPONSE_MS) {
    technical -= 15;
    findings.push(
      finding('warning', 'technical', `Slow response time (${elapsedMs}ms)`, {
        url,
        code: 'slow_response',
      }),
    );
  }
  if (htmlSize > LARGE_HTML_BYTES) {
    technical -= 10;
    findings.push(
      finding('info', 'technical', `Large HTML size (${Math.round(htmlSize / 1024)} KB)`, {
        url,
        code: 'large_html',
      }),
    );
  }
  if (!analysis.viewport) {
    technical -= 15;
    findings.push(
      finding('warning', 'technical', 'Missing responsive viewport meta tag', {
        url,
        code: 'missing_viewport',
      }),
    );
  }
  if (!analysis.lang) {
    technical -= 5;
    findings.push(
      finding('info', 'technical', 'Missing html lang attribute', { url, code: 'missing_lang' }),
    );
  }
  const mixedContentSample = Array.isArray(analysis.mixedContentSample)
    ? analysis.mixedContentSample.slice(0, 5)
    : [];
  if (mixedContentSample.length > 0) {
    technical -= MIXED_CONTENT_DEDUCTION;
    findings.push(
      finding(
        'warning',
        'technical',
        `Mixed content: ${mixedContentSample.length} HTTP asset(s) on an HTTPS page`,
        { url, pillar: 'security', sample: mixedContentSample, code: 'mixed_content' },
      ),
    );
  }
  technical = clampScore(technical);

  // --- sharing / schema (15%) ---
  let sharing = 100;
  const og = analysis.og || {};
  if (!og['og:title']) {
    sharing -= 20;
    findings.push(
      finding('warning', 'sharing', 'Missing og:title', { url, code: 'missing_og_title' }),
    );
  }
  if (!og['og:description']) {
    sharing -= 15;
    findings.push(
      finding('info', 'sharing', 'Missing og:description', { url, code: 'missing_og_description' }),
    );
  }
  if (!og['og:image']) {
    sharing -= 20;
    findings.push(
      finding('warning', 'sharing', 'Missing og:image', { url, code: 'missing_og_image' }),
    );
  }
  const twitter = analysis.twitter || {};
  if (!twitter['twitter:card']) {
    sharing -= 10;
    findings.push(
      finding('info', 'sharing', 'Missing twitter:card', { url, code: 'missing_twitter_card' }),
    );
  }
  const jsonLd = Array.isArray(analysis.jsonLd) ? analysis.jsonLd : [];
  const invalidJsonLd = jsonLd.filter((block) => block && block._parseError);
  if (invalidJsonLd.length) {
    sharing -= 15;
    findings.push(
      finding('warning', 'sharing', `${invalidJsonLd.length} invalid JSON-LD block(s)`, {
        url,
        code: 'invalid_json_ld',
      }),
    );
  }
  const parsedJsonLd = jsonLd.filter((block) => block && !block._parseError);
  if (parsedJsonLd.length && usefulJsonLdTypes(parsedJsonLd).length === 0) {
    sharing -= JSONLD_TYPE_DEDUCTION;
    findings.push(
      finding('warning', 'sharing', 'JSON-LD is present but has no useful @type', {
        url,
        pillar: 'ai',
        code: 'json_ld_no_useful_type',
      }),
    );
  }
  sharing = clampScore(sharing);

  const categories = { indexing, content, technical, sharing };
  const authorMeta = typeof analysis.author === 'string' ? analysis.author.trim() : '';

  return {
    url,
    finalUrl: page.finalUrl || url,
    title: analysis.title || null,
    statusCode,
    categories,
    score: weightedScore(categories),
    findings,
    shellOnly: !!analysis.shellOnly,
    hasAuthor: !!authorMeta || jsonLdHasAuthor(jsonLd),
    mixedContentSample,
  };
}

function headerMap(headers) {
  const map = {};
  for (const [key, value] of Object.entries(headers || {})) {
    map[String(key).toLowerCase()] = value;
  }
  return map;
}

function headerPresent(map, name) {
  const value = map[name];
  if (value == null) return false;
  if (Array.isArray(value)) return value.some((item) => String(item).trim() !== '');
  return String(value).trim() !== '';
}

function cookieFlagIssues(setCookie) {
  const cookies = !setCookie ? [] : Array.isArray(setCookie) ? setCookie : [setCookie];
  const issues = [];
  for (const cookie of cookies) {
    const raw = String(cookie);
    const name = raw.split('=')[0].trim();
    if (!name) continue;
    const attrs = raw
      .split(';')
      .slice(1)
      .map((part) => part.trim().toLowerCase());
    const missing = [];
    if (!attrs.some((attr) => attr === 'secure')) missing.push('Secure');
    if (!attrs.some((attr) => attr === 'httponly')) missing.push('HttpOnly');
    if (!attrs.some((attr) => attr.startsWith('samesite='))) missing.push('SameSite');
    if (missing.length) issues.push({ name, missing });
  }
  return issues;
}

function blockedAiBots(aiBotRobots) {
  if (!aiBotRobots || typeof aiBotRobots !== 'object') return [];
  if (Array.isArray(aiBotRobots.blocked)) return aiBotRobots.blocked.filter(Boolean);
  return [];
}

function aggregateMixedContent(pageResults) {
  const sample = [];
  const seen = new Set();
  for (const page of pageResults) {
    const urls = Array.isArray(page.mixedContentSample) ? page.mixedContentSample : [];
    for (const url of urls) {
      if (!url || seen.has(url) || sample.length >= 5) continue;
      seen.add(url);
      sample.push(url);
    }
  }
  return sample;
}

/**
 * Score a whole audit run: averages per-page category scores, adds site-level findings
 * (robots.txt/sitemap/llms.txt, AI crawler robots, response headers, probes, duplicate titles).
 * @param {Array} pages - raw crawled pages (crawler.js shape) or already-scored analyzePage() results
 * @param {{
 *   robotsTxtFound?: boolean,
 *   sitemapFound?: boolean,
 *   homepageHeaders?: Object,
 *   llmsTxtFound?: boolean,
 *   aiBotRobots?: { byAgent?: Object, blocked?: string[] },
 *   securityProbes?: Array
 * }} [siteMeta]
 */
function analyzeSite(pages, siteMeta = {}) {
  const rawPages = Array.isArray(pages) ? pages : [];
  const pageResults = rawPages.map((p) => (p && p.categories ? p : analyzePage(p)));
  const siteFindings = [];

  let indexingPenalty = 0;
  let technicalPenalty = 0;
  let sharingPenalty = 0;

  if (!siteMeta.robotsTxtFound) {
    indexingPenalty += 5;
    siteFindings.push(
      finding('warning', 'indexing', 'robots.txt not found', { code: 'robots_txt_missing' }),
    );
  }
  if (!siteMeta.sitemapFound) {
    indexingPenalty += 10;
    siteFindings.push(
      finding('warning', 'indexing', 'sitemap.xml not found', { code: 'sitemap_missing' }),
    );
  }
  // Missing means we looked and the file was absent or empty. Callers that omit the field
  // (older fixtures) are treated the same: llms.txt was not observed.
  if (siteMeta.llmsTxtFound !== true) {
    indexingPenalty += LLMS_DEDUCTION;
    siteFindings.push(
      finding('warning', 'indexing', 'llms.txt is missing or empty', {
        pillar: 'ai',
        code: 'llms_txt_missing',
      }),
    );
  }
  const blockedBots = blockedAiBots(siteMeta.aiBotRobots);
  if (blockedBots.length) {
    indexingPenalty += AI_BOT_DEDUCTION;
    siteFindings.push(
      finding(
        'warning',
        'indexing',
        `AI crawlers blocked by robots.txt: ${blockedBots.join(', ')}`,
        {
          pillar: 'ai',
          code: 'ai_bots_blocked',
        },
      ),
    );
  }

  const headers = headerMap(siteMeta.homepageHeaders);
  // Do not score a missing Content-Encoding header. safeFetch does not send Accept-Encoding,
  // so the origin never negotiates compression and the header stays absent even when the site
  // would gzip for a normal browser. Treating that as "not compressed" is a false finding.
  if (!headerPresent(headers, 'cache-control')) {
    siteFindings.push(
      finding('info', 'technical', 'Homepage response has no Cache-Control header', {
        code: 'no_cache_control',
      }),
    );
  }

  const homepage = pageResults[0];
  const homepageUrl = homepage?.finalUrl || homepage?.url || '';
  const isHttpsHomepage = typeof homepageUrl === 'string' && homepageUrl.startsWith('https://');

  if (isHttpsHomepage && !headerPresent(headers, 'strict-transport-security')) {
    technicalPenalty += HSTS_DEDUCTION;
    siteFindings.push(
      finding(
        'warning',
        'technical',
        'Homepage is missing a Strict-Transport-Security (HSTS) header',
        { pillar: 'security', url: homepageUrl || undefined, code: 'no_hsts' },
      ),
    );
  }
  if (!headerPresent(headers, 'content-security-policy')) {
    technicalPenalty += CSP_DEDUCTION;
    siteFindings.push(
      finding('warning', 'technical', 'Homepage is missing a Content-Security-Policy header', {
        pillar: 'security',
        url: homepageUrl || undefined,
        code: 'no_csp',
      }),
    );
  }
  if (!headerPresent(headers, 'x-content-type-options')) {
    technicalPenalty += XCTO_DEDUCTION;
    siteFindings.push(
      finding('warning', 'technical', 'Homepage is missing an X-Content-Type-Options header', {
        pillar: 'security',
        url: homepageUrl || undefined,
        code: 'no_xcto',
      }),
    );
  }

  const securityHeaders = buildSecurityHeadersInventory(siteMeta.homepageHeaders);
  if (!securityHeaders.referrerPolicy.present) {
    technicalPenalty += REFERRER_POLICY_DEDUCTION;
    siteFindings.push(
      finding('warning', 'technical', 'Homepage is missing a Referrer-Policy header', {
        pillar: 'security',
        url: homepageUrl || undefined,
        code: 'no_referrer_policy',
      }),
    );
  }
  if (!securityHeaders.permissionsPolicy.present) {
    technicalPenalty += PERMISSIONS_POLICY_DEDUCTION;
    siteFindings.push(
      finding('warning', 'technical', 'Homepage is missing a Permissions-Policy header', {
        pillar: 'security',
        url: homepageUrl || undefined,
        code: 'no_permissions_policy',
      }),
    );
  }
  if (!securityHeaders.frameProtection.present) {
    technicalPenalty += FRAME_PROTECTION_DEDUCTION;
    siteFindings.push(
      finding(
        'warning',
        'technical',
        'Homepage is missing frame protection (X-Frame-Options or CSP frame-ancestors)',
        { pillar: 'security', url: homepageUrl || undefined, code: 'no_frame_protection' },
      ),
    );
  }

  const tls = siteMeta.tls && typeof siteMeta.tls === 'object' ? siteMeta.tls : null;
  if (tls && tls.ok) {
    if (
      tls.hostnameMatch === false ||
      (typeof tls.daysRemaining === 'number' && tls.daysRemaining < 0)
    ) {
      siteFindings.push(
        finding(
          'critical',
          'technical',
          tls.hostnameMatch === false
            ? 'TLS certificate does not match the hostname'
            : 'TLS certificate has expired',
          {
            pillar: 'security',
            url: homepageUrl || undefined,
            code: tls.hostnameMatch === false ? 'tls_hostname_mismatch' : 'tls_expired',
          },
        ),
      );
    } else if (typeof tls.daysRemaining === 'number' && tls.daysRemaining < TLS_EXPIRING_DAYS) {
      siteFindings.push(
        finding('warning', 'technical', `TLS certificate expires in ${tls.daysRemaining} day(s)`, {
          pillar: 'security',
          url: homepageUrl || undefined,
          code: 'tls_expiring',
        }),
      );
    }
  }

  const dns = siteMeta.dns && typeof siteMeta.dns === 'object' ? siteMeta.dns : null;
  if (dns && dns.ok) {
    if (!dns.spfPresent) {
      siteFindings.push(
        finding('info', 'technical', 'No SPF TXT record found for the audit hostname', {
          pillar: 'security',
          code: 'spf_missing',
        }),
      );
    }
    if (!dns.dmarcPresent) {
      siteFindings.push(
        finding('info', 'technical', 'No DMARC record found (_dmarc TXT)', {
          pillar: 'security',
          code: 'dmarc_missing',
        }),
      );
    }
  }

  const resources =
    siteMeta.resources && typeof siteMeta.resources === 'object' ? siteMeta.resources : null;
  if (
    resources &&
    typeof resources.thirdPartyScriptHostCount === 'number' &&
    resources.thirdPartyScriptHostCount >= THIRD_PARTY_SCRIPT_HOST_INFO_THRESHOLD
  ) {
    siteFindings.push(
      finding(
        'info',
        'technical',
        `${resources.thirdPartyScriptHostCount} distinct third-party script hosts detected`,
        { pillar: 'security', code: 'third_party_script_hosts' },
      ),
    );
  }

  const cookieIssues = isHttpsHomepage ? cookieFlagIssues(headers['set-cookie']) : [];
  if (cookieIssues.length) {
    technicalPenalty += COOKIE_FLAG_DEDUCTION;
    const names = cookieIssues.map((issue) => issue.name).join(', ');
    siteFindings.push(
      finding(
        'warning',
        'technical',
        `Set-Cookie is missing Secure, HttpOnly, or SameSite (${names})`,
        { pillar: 'security', url: homepageUrl || undefined, code: 'cookie_flags_missing' },
      ),
    );
  }

  const titleCounts = new Map();
  for (const page of pageResults) {
    const normalizedTitle = (page.title || '').trim().toLowerCase();
    if (!normalizedTitle) continue;
    titleCounts.set(normalizedTitle, (titleCounts.get(normalizedTitle) || 0) + 1);
  }
  const duplicateTitleCount = Array.from(titleCounts.values()).filter((count) => count > 1).length;
  if (duplicateTitleCount > 0) {
    siteFindings.push(
      finding(
        'warning',
        'content',
        `${duplicateTitleCount} duplicate title(s) found across pages`,
        {
          code: 'duplicate_titles',
        },
      ),
    );
  }

  const brokenPages = pageResults.filter((p) => p.statusCode != null && p.statusCode >= 400);
  if (brokenPages.length) {
    siteFindings.push(
      finding('critical', 'indexing', `${brokenPages.length} page(s) returned an error status`, {
        sample: brokenPages.slice(0, 5).map((p) => ({ url: p.url, statusCode: p.statusCode })),
        code: 'broken_pages',
      }),
    );
  }

  if (homepage && homepage.hasAuthor === false) {
    sharingPenalty += AUTHOR_DEDUCTION;
    siteFindings.push(
      finding('info', 'sharing', 'Homepage is missing an author', {
        pillar: 'ai',
        url: homepage.url || homepageUrl || undefined,
        code: 'missing_author',
      }),
    );
  }

  const securityProbes = Array.isArray(siteMeta.securityProbes) ? siteMeta.securityProbes : [];
  const exposedProbes = securityProbes.filter((probe) => probe && probe.exposed === true);
  if (exposedProbes.length) {
    technicalPenalty += Math.min(
      PROBE_EXPOSURE_CAP,
      exposedProbes.length * PROBE_EXPOSURE_DEDUCTION,
    );
    for (const probe of exposedProbes) {
      siteFindings.push(
        finding('critical', 'technical', `Sensitive path exposed: ${probe.path}`, {
          pillar: 'security',
          path: probe.path,
          statusCode: probe.statusCode ?? null,
          code: 'probe_exposed',
        }),
      );
    }
  }

  const categoryAverages = {
    indexing: average(pageResults.map((p) => p.categories.indexing)),
    content: average(pageResults.map((p) => p.categories.content)),
    technical: average(pageResults.map((p) => p.categories.technical)),
    sharing: average(pageResults.map((p) => p.categories.sharing)),
  };

  const categories = {
    indexing: clampScore(categoryAverages.indexing - indexingPenalty),
    content: clampScore(categoryAverages.content - (duplicateTitleCount > 0 ? 10 : 0)),
    technical: clampScore(categoryAverages.technical - technicalPenalty),
    sharing: clampScore(categoryAverages.sharing - sharingPenalty),
  };

  const shellOnlyPageCount = pageResults.filter((p) => p.shellOnly).length;

  // Inventory only. Must not add findings or change WEIGHTS / category penalties.
  const technologies = detectTechnologies({
    homepageHeaders: siteMeta.homepageHeaders,
    pages: rawPages,
    resources,
  });

  return {
    score: weightedScore(categories),
    categories,
    weights: WEIGHTS,
    pageCount: pageResults.length,
    shellOnly: pageResults.length > 0 && shellOnlyPageCount === pageResults.length,
    shellOnlyPageCount,
    findings: [...siteFindings, ...pageResults.flatMap((p) => p.findings)],
    pages: pageResults,
    siteMeta: {
      robotsTxtFound: !!siteMeta.robotsTxtFound,
      sitemapFound: !!siteMeta.sitemapFound,
      llmsTxtFound: siteMeta.llmsTxtFound === true,
      aiBotRobots: siteMeta.aiBotRobots || null,
      cookieFlags: {
        applicable: isHttpsHomepage,
        issues: cookieIssues,
      },
      mixedContentSample: aggregateMixedContent(pageResults),
      securityProbes,
      securityHeaders,
      tls: tls || null,
      dns: dns || null,
      resources: resources || null,
      crawlGraph:
        siteMeta.crawlGraph && typeof siteMeta.crawlGraph === 'object' ? siteMeta.crawlGraph : null,
      compression:
        siteMeta.compression && typeof siteMeta.compression === 'object'
          ? siteMeta.compression
          : null,
      technologies,
      pathScope:
        typeof siteMeta.pathScope === 'string' && siteMeta.pathScope ? siteMeta.pathScope : null,
      auditMode: siteMeta.auditMode === 'quick' ? 'quick' : 'full',
    },
  };
}

module.exports = { WEIGHTS, clampScore, analyzePage, analyzeSite };
