// plugins/guides/sources/adapters/WikipediaContentSource.js
const { getContentSourceCatalogEntry } = require('../contentSourceCatalog');

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RADIUS_M = 5000;
const DEFAULT_LIMIT = 3;
const MAX_EXCERPT_CHARS = 3500;

function wikiHostForLanguage(language) {
  const lang = String(language || 'en')
    .trim()
    .toLowerCase()
    .slice(0, 2);
  return `https://${lang || 'en'}.wikipedia.org`;
}

class WikipediaContentSource {
  /**
   * @param {{ fetchFn?: typeof fetch, timeoutMs?: number, userAgent?: string }} [options]
   */
  constructor(options = {}) {
    this.key = 'wikipedia';
    this._fetch = options.fetchFn ?? fetch;
    this._timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._userAgent =
      options.userAgent ??
      process.env.WIKIPEDIA_USER_AGENT ??
      'HomebaseGuides/1.0 (content research)';
  }

  _headers() {
    return {
      'User-Agent': this._userAgent,
      Accept: 'application/json',
    };
  }

  _signal() {
    try {
      return AbortSignal.timeout(this._timeoutMs);
    } catch {
      return undefined;
    }
  }

  /**
   * @param {import('../ContentSource').PlaceQuery} place
   * @returns {Promise<import('../ContentSource').SourceFetchResult>}
   */
  async fetch(place) {
    const catalog = getContentSourceCatalogEntry(this.key);
    const attribution = catalog?.attribution ?? null;
    const language = place?.language || 'en';
    const host = wikiHostForLanguage(language);

    try {
      const pageIds = await this._resolvePageIds(host, place);
      if (!pageIds.length) {
        return { sourceKey: this.key, status: 'empty', excerpts: [], attribution };
      }

      const excerpts = await this._fetchExtracts(host, pageIds);
      if (!excerpts.length) {
        return { sourceKey: this.key, status: 'empty', excerpts: [], attribution };
      }

      return { sourceKey: this.key, status: 'ok', excerpts, attribution };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wikipedia fetch failed';
      return {
        sourceKey: this.key,
        status: 'failed',
        excerpts: [],
        errorMessage: message,
        attribution,
      };
    }
  }

  async _resolvePageIds(host, place) {
    const coords = place?.coordinates;
    if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
      const params = new URLSearchParams({
        action: 'query',
        list: 'geosearch',
        gscoord: `${coords.lat}|${coords.lng}`,
        gsradius: String(DEFAULT_RADIUS_M),
        gslimit: String(DEFAULT_LIMIT),
        format: 'json',
        origin: '*',
      });
      const response = await this._fetch(`${host}/w/api.php?${params}`, {
        headers: this._headers(),
        signal: this._signal(),
      });
      if (!response.ok) {
        throw new Error(`Wikipedia geosearch failed (${response.status})`);
      }
      const data = await response.json();
      const rows = data?.query?.geosearch;
      if (Array.isArray(rows) && rows.length) {
        return rows.map((r) => r.pageid).filter(Boolean);
      }
    }

    const query = String(place?.displayName || place?.locality || '').trim();
    if (!query) return [];

    const params = new URLSearchParams({
      action: 'query',
      list: 'search',
      srsearch: query,
      srlimit: String(DEFAULT_LIMIT),
      format: 'json',
      origin: '*',
    });
    const response = await this._fetch(`${host}/w/api.php?${params}`, {
      headers: this._headers(),
      signal: this._signal(),
    });
    if (!response.ok) {
      throw new Error(`Wikipedia search failed (${response.status})`);
    }
    const data = await response.json();
    const rows = data?.query?.search;
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => r.pageid).filter(Boolean);
  }

  async _fetchExtracts(host, pageIds) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts|info',
      pageids: pageIds.join('|'),
      explaintext: '1',
      exintro: '0',
      exchars: String(MAX_EXCERPT_CHARS),
      inprop: 'url',
      format: 'json',
      origin: '*',
    });
    const response = await this._fetch(`${host}/w/api.php?${params}`, {
      headers: this._headers(),
      signal: this._signal(),
    });
    if (!response.ok) {
      throw new Error(`Wikipedia extracts failed (${response.status})`);
    }
    const data = await response.json();
    const pages = data?.query?.pages;
    if (!pages || typeof pages !== 'object') return [];

    return Object.values(pages)
      .filter((p) => p && !p.missing && p.extract)
      .map((p) => ({
        sourceKey: this.key,
        title: String(p.title || 'Wikipedia'),
        url: String(p.fullurl || `${host}/wiki/${encodeURIComponent(p.title || '')}`),
        excerpt: String(p.extract).slice(0, MAX_EXCERPT_CHARS),
        externalId: p.pageid != null ? String(p.pageid) : null,
      }));
  }
}

module.exports = WikipediaContentSource;
