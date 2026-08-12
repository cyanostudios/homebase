/**
 * Referrer → { bucket, referrer_domain } for Cupappen pageviews.
 * Keep in sync with public-cups/api/referrer_classify.php (PHP is runtime source of truth).
 * UMD: Jest (CommonJS) + optional browser global.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root && typeof root === 'object') {
    root.CupappenReferrerClassify = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MAX_REFERRER_CHARS = 2048;
  const INTERNAL_HOSTS = new Set(['cupappen.se', 'www.cupappen.se', 'localhost', '127.0.0.1']);

  const SEARCH_MARKERS = ['google.', 'bing.', 'duckduckgo.', 'yahoo.', 'ecosia.', 'brave.'];
  const SOCIAL_HOSTS = [
    'facebook.com',
    'fb.com',
    'instagram.com',
    'twitter.com',
    'x.com',
    't.co',
    'linkedin.com',
    'tiktok.com',
    'youtube.com',
    'youtu.be',
  ];

  function truncateReferrer(raw) {
    const s = String(raw || '').trim();
    if (s.length <= MAX_REFERRER_CHARS) return s;
    return s.slice(0, MAX_REFERRER_CHARS);
  }

  function extractHost(referrer) {
    const raw = truncateReferrer(referrer);
    if (!raw) return '';
    try {
      const withProto = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) ? raw : `https://${raw}`;
      const url = new URL(withProto);
      return String(url.hostname || '')
        .trim()
        .toLowerCase();
    } catch {
      return '';
    }
  }

  function stripWww(host) {
    return host.startsWith('www.') ? host.slice(4) : host;
  }

  function hostMatchesBase(host, base) {
    return host === base || host.endsWith(`.${base}`);
  }

  function isSearchHost(host) {
    return SEARCH_MARKERS.some((m) => host.includes(m));
  }

  function isSocialHost(host) {
    const bare = stripWww(host);
    return SOCIAL_HOSTS.some((base) => hostMatchesBase(bare, base) || hostMatchesBase(host, base));
  }

  /**
   * @param {string|null|undefined} referrer
   * @returns {{ bucket: string, referrer_domain: string }}
   */
  function classifyReferrer(referrer) {
    const host = extractHost(referrer);
    if (!host) {
      return { bucket: 'direct', referrer_domain: '' };
    }

    const bare = stripWww(host);
    const domain = bare.slice(0, 255);

    if (INTERNAL_HOSTS.has(host) || INTERNAL_HOSTS.has(bare) || host.endsWith('.cupappen.se')) {
      return { bucket: 'internal', referrer_domain: domain || 'cupappen.se' };
    }
    if (isSearchHost(host)) {
      return { bucket: 'search', referrer_domain: domain };
    }
    if (isSocialHost(host)) {
      return { bucket: 'social', referrer_domain: domain };
    }
    return { bucket: 'other', referrer_domain: domain };
  }

  return {
    MAX_REFERRER_CHARS,
    classifyReferrer,
    extractHost,
    truncateReferrer,
  };
});
