// plugins/site-audits/services/htmlAnalyzer.js
// Static (no JS execution) HTML analysis for a single fetched page, using cheerio.
const cheerio = require('cheerio');
const { TECH_FINGERPRINT_CATALOG } = require('./techFingerprintCatalog');

/**
 * @param {string} href
 * @returns {boolean} true for hrefs that should never be treated as crawlable page links
 */
function isSkippableHref(href) {
  if (!href) return true;
  return (
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  );
}

// Concrete schema.org types that carry SEO / AI-readiness signal. A bare `Thing`
// (or an untyped block) does not. Compared on the short name so `https://schema.org/Article`
// and `Article` are the same type.
const USEFUL_JSONLD_TYPES = new Set([
  'Article',
  'NewsArticle',
  'BlogPosting',
  'WebPage',
  'WebSite',
  'Organization',
  'LocalBusiness',
  'Person',
  'Product',
  'FAQPage',
  'BreadcrumbList',
  'SoftwareApplication',
  'ItemList',
  'Review',
  'AggregateRating',
  'HowTo',
  'Recipe',
  'Event',
  'VideoObject',
  'Course',
  'JobPosting',
  'ProfilePage',
  'Service',
  'Offer',
  'Brand',
  'ImageObject',
  'SiteNavigationElement',
]);

const MIXED_CONTENT_LIMIT = 5;
const TECH_HINT_VALUE_CAP = 200;
const TECH_PATH_HIT_CAP = 20;
// Path needles come from the catalog so HTML hints and fingerprint rules stay aligned.
const TECH_PATH_FRAGMENTS = Object.freeze(
  (() => {
    const fragments = [];
    const seen = new Set();
    for (const entry of TECH_FINGERPRINT_CATALOG) {
      const list =
        entry && entry.match && Array.isArray(entry.match.pathIncludes)
          ? entry.match.pathIncludes
          : [];
      for (const fragment of list) {
        if (typeof fragment !== 'string' || !fragment || seen.has(fragment)) continue;
        seen.add(fragment);
        fragments.push(fragment);
      }
    }
    return fragments;
  })(),
);
const ASSET_LINK_RELS = new Set([
  'stylesheet',
  'icon',
  'shortcut',
  'preload',
  'modulepreload',
  'apple-touch-icon',
]);

function jsonLdTypeName(type) {
  const trimmed = String(type || '').trim();
  if (!trimmed) return '';
  const slash = trimmed.lastIndexOf('/');
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

function jsonLdTypeNames(type) {
  const list = Array.isArray(type) ? type : type ? [type] : [];
  return list.map(jsonLdTypeName).filter(Boolean);
}

function walkJsonLd(value, visit, depth = 0, seen = new Set()) {
  if (value == null || depth > 6 || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => walkJsonLd(item, visit, depth + 1, seen));
    return;
  }
  if (value._parseError) return;
  visit(value);
  for (const key of Object.keys(value)) {
    if (key === '@context') continue;
    const child = value[key];
    if (child && typeof child === 'object') walkJsonLd(child, visit, depth + 1, seen);
  }
}

function usefulJsonLdTypes(jsonLd) {
  const found = [];
  const seen = new Set();
  walkJsonLd(jsonLd, (node) => {
    for (const name of jsonLdTypeNames(node['@type'])) {
      if (!USEFUL_JSONLD_TYPES.has(name) || seen.has(name)) continue;
      seen.add(name);
      found.push(name);
    }
  });
  return found;
}

function hasAuthorValue(author) {
  if (author == null) return false;
  if (typeof author === 'string') return author.trim().length > 0;
  if (Array.isArray(author)) return author.some((item) => hasAuthorValue(item));
  if (typeof author === 'object') {
    if (typeof author.name === 'string' && author.name.trim()) return true;
    if (typeof author.url === 'string' && author.url.trim()) return true;
    if (typeof author['@id'] === 'string' && author['@id'].trim()) return true;
    if (author['@type']) return true;
  }
  return false;
}

function jsonLdHasAuthor(jsonLd) {
  let found = false;
  walkJsonLd(jsonLd, (node) => {
    if (found) return;
    const types = jsonLdTypeNames(node['@type']).map((name) => name.toLowerCase());
    if (types.includes('person') && (node.name || node.url)) {
      found = true;
      return;
    }
    if (hasAuthorValue(node.author)) found = true;
  });
  return found;
}

function readAuthor($) {
  const metaAuthor = $('meta[name="author"]').attr('content');
  if (typeof metaAuthor === 'string' && metaAuthor.trim()) return metaAuthor.trim();

  let linkAuthor = null;
  $('link[rel]').each((_, el) => {
    if (linkAuthor) return;
    const rels = ($(el).attr('rel') || '').toLowerCase().split(/\s+/);
    if (!rels.includes('author')) return;
    const href = ($(el).attr('href') || '').trim();
    if (href) linkAuthor = href;
  });
  return linkAuthor;
}

function collectMixedContent($, pageUrl) {
  let isHttps = false;
  try {
    isHttps = new URL(pageUrl).protocol === 'https:';
  } catch {
    return [];
  }
  // Mixed content is an HTTPS-page problem. An HTTP page is already scored as not-HTTPS.
  if (!isHttps) return [];

  const sample = [];
  const seen = new Set();
  const addUrl = (raw) => {
    if (!raw || sample.length >= MIXED_CONTENT_LIMIT) return;
    const value = String(raw).trim();
    if (!/^http:\/\//i.test(value) || seen.has(value)) return;
    seen.add(value);
    sample.push(value);
  };

  $('img, script, iframe, audio, video, source, embed').each((_, el) => {
    if (sample.length >= MIXED_CONTENT_LIMIT) return false;
    addUrl($(el).attr('src'));
    const srcset = $(el).attr('srcset');
    if (srcset) {
      srcset.split(',').forEach((part) => {
        addUrl(part.trim().split(/\s+/)[0]);
      });
    }
    return undefined;
  });

  $('link[href]').each((_, el) => {
    if (sample.length >= MIXED_CONTENT_LIMIT) return false;
    const rels = ($(el).attr('rel') || '').toLowerCase().split(/\s+/);
    if (rels.some((rel) => ASSET_LINK_RELS.has(rel))) addUrl($(el).attr('href'));
    return undefined;
  });

  return sample;
}

function truncateTechHint(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length <= TECH_HINT_VALUE_CAP) return trimmed;
  return `${trimmed.slice(0, TECH_HINT_VALUE_CAP)}…`;
}

function collectTechPathHits(urls) {
  const haystacks = [];
  for (const raw of urls) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim().toLowerCase();
    if (value) haystacks.push(value);
  }
  const hits = [];
  for (const fragment of TECH_PATH_FRAGMENTS) {
    if (hits.length >= TECH_PATH_HIT_CAP) break;
    const needle = fragment.toLowerCase();
    if (!needle || !haystacks.some((url) => url.includes(needle))) continue;
    const stored = truncateTechHint(fragment);
    if (stored) hits.push(stored);
  }
  return hits;
}

/**
 * @param {string} html
 * @param {string} pageUrl - the page's own (final, post-redirect) URL, used to resolve relative
 *   links and to determine which links are "internal" (same host).
 */
function analyzeHtml(html, pageUrl) {
  const source = typeof html === 'string' ? html : '';
  const $ = cheerio.load(source);

  const title = $('title').first().text().trim();
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
  const h1s = $('h1')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const canonical = $('link[rel="canonical"]').attr('href') || null;
  const robotsMeta = $('meta[name="robots"]').attr('content')?.trim().toLowerCase() || null;
  const lang = $('html').attr('lang') || null;
  const viewport = $('meta[name="viewport"]').attr('content') || null;

  const og = {};
  $('meta[property^="og:"]').each((_, el) => {
    const prop = $(el).attr('property');
    if (prop) og[prop] = $(el).attr('content') ?? null;
  });

  const twitter = {};
  $('meta[name^="twitter:"]').each((_, el) => {
    const name = $(el).attr('name');
    if (name) twitter[name] = $(el).attr('content') ?? null;
  });

  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = ($(el).html() || '').trim();
    if (!raw) return;
    try {
      jsonLd.push(JSON.parse(raw));
    } catch {
      jsonLd.push({ _parseError: true, raw: raw.slice(0, 500) });
    }
  });

  const images = $('img')
    .map((_, el) => ({
      src: $(el).attr('src') || null,
      alt: Object.prototype.hasOwnProperty.call(el.attribs || {}, 'alt') ? $(el).attr('alt') : null,
    }))
    .get();

  let base = null;
  try {
    base = new URL(pageUrl);
  } catch {
    base = null;
  }

  const internalLinksSet = new Set();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (isSkippableHref(href)) return;
    try {
      const resolved = base ? new URL(href, base).toString() : new URL(href).toString();
      const resolvedHost = new URL(resolved).hostname;
      if (!base || resolvedHost === base.hostname) {
        internalLinksSet.add(resolved);
      }
    } catch {
      // Ignore unparsable hrefs (e.g. relative with no base available).
    }
  });

  // SPA-shell heuristic: a near-empty #root/#app (typical React/Vue/Angular mount point) with
  // little rendered text, or generally very little body text alongside scripts, means the real
  // content only exists after client-side JS runs — which this crawler never executes.
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const rootMount = $('#root, #app').first();
  const rootText = rootMount.length ? rootMount.text().replace(/\s+/g, ' ').trim() : '';
  const scriptCount = $('script').length;
  const shellOnly =
    rootMount.length > 0 ? rootText.length < 50 : scriptCount > 0 && bodyText.length < 50;

  const h2s = $('h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);

  const scriptSrcs = [];
  let asyncScripts = 0;
  let deferScripts = 0;
  $('script').each((_, el) => {
    const src = ($(el).attr('src') || '').trim();
    if (src) scriptSrcs.push(src);
    if ($(el).attr('async') != null) asyncScripts += 1;
    if ($(el).attr('defer') != null) deferScripts += 1;
  });

  const stylesheetHrefs = [];
  let hasManifest = false;
  $('link[rel]').each((_, el) => {
    const rels = ($(el).attr('rel') || '').toLowerCase().split(/\s+/);
    const href = ($(el).attr('href') || '').trim();
    if (rels.includes('stylesheet') && href) stylesheetHrefs.push(href);
    if (rels.includes('manifest') && href) hasManifest = true;
  });

  const missingDimensionSample = [];
  $('img').each((_, el) => {
    if (missingDimensionSample.length >= 5) return false;
    const hasWidth = $(el).attr('width') != null && String($(el).attr('width')).trim() !== '';
    const hasHeight = $(el).attr('height') != null && String($(el).attr('height')).trim() !== '';
    if (!hasWidth || !hasHeight) {
      const src = ($(el).attr('src') || '').trim();
      if (src) missingDimensionSample.push(src.slice(0, 200));
    }
    return undefined;
  });

  const hasServiceWorkerHint =
    /navigator\.serviceWorker\.register\s*\(/i.test(source) ||
    /serviceWorker\.register\s*\(/i.test(source);

  return {
    title: title || null,
    titleLength: title.length,
    metaDescription,
    h1s,
    h1Count: h1s.length,
    h2Count: h2s.length,
    // Same collapsed body string as the shell heuristic, so "thin" and "shell" describe one text.
    bodyTextLength: bodyText.length,
    author: readAuthor($),
    canonical,
    robotsMeta,
    noindex: !!robotsMeta && /noindex/.test(robotsMeta),
    lang,
    viewport,
    og,
    twitter,
    jsonLd,
    usefulJsonLdTypes: usefulJsonLdTypes(jsonLd),
    images,
    internalLinks: Array.from(internalLinksSet),
    mixedContentSample: collectMixedContent($, pageUrl),
    shellOnly,
    htmlSize: Buffer.byteLength(source, 'utf8'),
    resources: {
      scriptCount: $('script').length,
      scriptSrcs: scriptSrcs.slice(0, 50),
      stylesheetCount: stylesheetHrefs.length,
      stylesheetHrefs: stylesheetHrefs.slice(0, 50),
      imageCount: images.length,
      asyncScripts,
      deferScripts,
      hasManifest,
      hasServiceWorkerHint,
      missingDimensionSample,
    },
    // Inventory signals for tech fingerprinting. Anchor hrefs are crawl links, not asset paths.
    techHints: {
      generator: truncateTechHint($('meta[name="generator"]').attr('content')),
      pathHits: collectTechPathHits([
        ...scriptSrcs,
        ...stylesheetHrefs,
        ...images.map((image) => image && image.src).filter(Boolean),
      ]),
    },
  };
}

module.exports = {
  analyzeHtml,
  usefulJsonLdTypes,
  jsonLdHasAuthor,
  USEFUL_JSONLD_TYPES,
};
