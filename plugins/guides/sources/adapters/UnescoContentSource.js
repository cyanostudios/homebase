// plugins/guides/sources/adapters/UnescoContentSource.js
// v1: query UNESCO WHC public list JSON by site name / country when available.
const { getContentSourceCatalogEntry } = require('../contentSourceCatalog');

const DEFAULT_TIMEOUT_MS = 12_000;
const WHC_LIST_URL = 'https://whc.unesco.org/en/list/?mode=json&format=json';
const MAX_EXCERPT_CHARS = 2500;
const MAX_RESULTS = 3;

class UnescoContentSource {
  /**
   * @param {{ fetchFn?: typeof fetch, timeoutMs?: number, listUrl?: string }} [options]
   */
  constructor(options = {}) {
    this.key = 'unesco';
    this._fetch = options.fetchFn ?? fetch;
    this._timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._listUrl = options.listUrl ?? process.env.UNESCO_WHC_LIST_URL ?? WHC_LIST_URL;
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
    const needle = String(place?.displayName || place?.locality || '')
      .trim()
      .toLowerCase();
    const country = String(place?.countryCode || '')
      .trim()
      .toUpperCase();

    if (!needle && !country) {
      return { sourceKey: this.key, status: 'empty', excerpts: [], attribution };
    }

    try {
      const response = await this._fetch(this._listUrl, {
        headers: { Accept: 'application/json' },
        signal: this._signal(),
      });
      if (!response.ok) {
        throw new Error(`UNESCO list failed (${response.status})`);
      }

      const data = await response.json();
      const sites = normalizeUnescoList(data);
      const matched = sites
        .filter((site) => matchesPlace(site, needle, country))
        .slice(0, MAX_RESULTS);

      if (!matched.length) {
        return { sourceKey: this.key, status: 'empty', excerpts: [], attribution };
      }

      const excerpts = matched.map((site) => ({
        sourceKey: this.key,
        title: site.name,
        url: site.url,
        excerpt: site.excerpt.slice(0, MAX_EXCERPT_CHARS),
        externalId: site.id,
      }));

      return { sourceKey: this.key, status: 'ok', excerpts, attribution };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'UNESCO fetch failed';
      return {
        sourceKey: this.key,
        status: 'failed',
        excerpts: [],
        errorMessage: message,
        attribution,
      };
    }
  }
}

function normalizeUnescoList(data) {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.query?.sites)
      ? data.query.sites
      : Array.isArray(data?.sites)
        ? data.sites
        : [];

  return rows
    .map((row) => {
      const name = String(row.name_en || row.name || row.site || '').trim();
      if (!name) return null;
      const id = row.id_no != null ? String(row.id_no) : row.id != null ? String(row.id) : null;
      const url = id ? `https://whc.unesco.org/en/list/${id}/` : 'https://whc.unesco.org/en/list/';
      const short = String(
        row.short_description_en || row.short_description || row.description || row.category || '',
      ).trim();
      const states = String(row.states_name_en || row.states || row.country || '').trim();
      const excerpt = [short, states ? `States: ${states}` : ''].filter(Boolean).join('\n\n');
      return {
        id,
        name,
        nameLower: name.toLowerCase(),
        statesLower: states.toLowerCase(),
        countryCodes: String(row.iso_code || row.iso || '')
          .toUpperCase()
          .split(/[,;\s]+/)
          .filter(Boolean),
        url,
        excerpt: excerpt || name,
      };
    })
    .filter(Boolean);
}

function matchesPlace(site, needle, country) {
  if (needle && site.nameLower.includes(needle)) return true;
  if (needle && site.statesLower.includes(needle)) return true;
  if (country && site.countryCodes.includes(country)) {
    if (!needle) return true;
    // Prefer country match only when name also loosely related
    return site.nameLower.includes(needle.split(' ')[0] || needle);
  }
  return false;
}

module.exports = UnescoContentSource;
module.exports.normalizeUnescoList = normalizeUnescoList;
module.exports.matchesPlace = matchesPlace;
