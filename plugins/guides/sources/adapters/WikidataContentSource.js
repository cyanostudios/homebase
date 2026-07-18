// plugins/guides/sources/adapters/WikidataContentSource.js
const { getContentSourceCatalogEntry } = require('../contentSourceCatalog');

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RADIUS_KM = 5;
const DEFAULT_LIMIT = 3;
const MAX_EXCERPT_CHARS = 2500;
const SPARQL_URL = 'https://query.wikidata.org/sparql';
const API_URL = 'https://www.wikidata.org/w/api.php';

class WikidataContentSource {
  /**
   * @param {{ fetchFn?: typeof fetch, timeoutMs?: number, sparqlUrl?: string, apiUrl?: string, userAgent?: string }} [options]
   */
  constructor(options = {}) {
    this.key = 'wikidata';
    this._fetch = options.fetchFn ?? fetch;
    this._timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._sparqlUrl = options.sparqlUrl ?? process.env.WIKIDATA_SPARQL_URL ?? SPARQL_URL;
    this._apiUrl = options.apiUrl ?? process.env.WIKIDATA_API_URL ?? API_URL;
    this._userAgent =
      options.userAgent ??
      process.env.WIKIDATA_USER_AGENT ??
      'HomebaseGuides/1.0 (content research; Wikidata)';
  }

  _headers(accept = 'application/sparql-results+json') {
    return {
      'User-Agent': this._userAgent,
      Accept: accept,
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

    try {
      let items = [];
      const coords = place?.coordinates;
      if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
        items = await this._searchByCoordinates(coords.lat, coords.lng, place?.language);
      }
      if (!items.length) {
        const name = String(place?.displayName || place?.locality || '').trim();
        if (name) {
          items = await this._searchByName(name, place?.language);
        }
      }

      if (!items.length) {
        return { sourceKey: this.key, status: 'empty', excerpts: [], attribution };
      }

      const excerpts = items.slice(0, DEFAULT_LIMIT).map((item) => ({
        sourceKey: this.key,
        title: item.label,
        url: `https://www.wikidata.org/wiki/${item.id}`,
        excerpt: String(item.description || item.label).slice(0, MAX_EXCERPT_CHARS),
        externalId: item.id,
      }));

      return { sourceKey: this.key, status: 'ok', excerpts, attribution };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wikidata fetch failed';
      return {
        sourceKey: this.key,
        status: 'failed',
        excerpts: [],
        errorMessage: message,
        attribution,
      };
    }
  }

  async _searchByCoordinates(lat, lng, language) {
    const lang =
      String(language || 'en')
        .trim()
        .toLowerCase()
        .slice(0, 2) || 'en';
    const query = `
SELECT ?item ?itemLabel ?itemDescription ?heritage WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lng} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${DEFAULT_RADIUS_KM}" .
  }
  OPTIONAL { ?item wdt:P1435 ?heritage . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en" . }
}
ORDER BY DESC(BOUND(?heritage)) ASC(?itemLabel)
LIMIT ${DEFAULT_LIMIT}
`.trim();

    const url = `${this._sparqlUrl}?query=${encodeURIComponent(query)}`;
    const response = await this._fetch(url, {
      headers: this._headers(),
      signal: this._signal(),
    });
    if (!response.ok) {
      throw new Error(`Wikidata SPARQL failed (${response.status})`);
    }
    const data = await response.json();
    return parseSparqlBindings(data);
  }

  async _searchByName(name, language) {
    const lang =
      String(language || 'en')
        .trim()
        .toLowerCase()
        .slice(0, 2) || 'en';
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      search: name,
      language: lang,
      uselang: lang,
      type: 'item',
      limit: String(DEFAULT_LIMIT),
      format: 'json',
      origin: '*',
    });
    const response = await this._fetch(`${this._apiUrl}?${params}`, {
      headers: this._headers('application/json'),
      signal: this._signal(),
    });
    if (!response.ok) {
      throw new Error(`Wikidata search failed (${response.status})`);
    }
    const data = await response.json();
    const rows = Array.isArray(data?.search) ? data.search : [];
    return rows.map((row) => ({
      id: row.id,
      label: row.label || row.id,
      description: row.description || '',
      hasHeritage: false,
    }));
  }
}

function parseSparqlBindings(data) {
  const bindings = data?.results?.bindings;
  if (!Array.isArray(bindings)) return [];
  return bindings
    .map((row) => {
      const uri = row.item?.value || '';
      const id = uri.split('/').pop();
      if (!id) return null;
      return {
        id,
        label: row.itemLabel?.value || id,
        description: row.itemDescription?.value || '',
        hasHeritage: Boolean(row.heritage?.value),
      };
    })
    .filter(Boolean);
}

module.exports = WikidataContentSource;
module.exports.parseSparqlBindings = parseSparqlBindings;
