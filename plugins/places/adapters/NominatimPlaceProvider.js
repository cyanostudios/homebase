// plugins/places/adapters/NominatimPlaceProvider.js
// Default, keyless place provider backed by OpenStreetMap Nominatim.
// Nominatim usage policy requires a descriptive User-Agent identifying the app.

const DEFAULT_BASE_URL = 'https://nominatim.openstreetmap.org';
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LIMIT = 5;
const MAX_LIMIT = 10;
const DEFAULT_USER_AGENT = 'Homebase/1.0 (+https://homebase.se)';

const OSM_TYPE_PREFIX = Object.freeze({ node: 'N', way: 'W', relation: 'R' });
const OSM_PREFIX_TYPE = Object.freeze({ N: 'node', W: 'way', R: 'relation' });

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Build a stable, provider-scoped reference like `N240109189`. */
function buildProviderRef(item) {
  const prefix = OSM_TYPE_PREFIX[item?.osm_type];
  if (!prefix || item?.osm_id === undefined || item?.osm_id === null) {
    return null;
  }
  return `${prefix}${item.osm_id}`;
}

/** Convert Nominatim boundingbox [minLat, maxLat, minLon, maxLon] → [minLon, minLat, maxLon, maxLat]. */
function mapBoundingBox(boundingbox) {
  if (!Array.isArray(boundingbox) || boundingbox.length !== 4) return null;
  const [minLat, maxLat, minLon, maxLon] = boundingbox.map(toNumberOrNull);
  if ([minLat, maxLat, minLon, maxLon].some((n) => n === null)) return null;
  return [minLon, minLat, maxLon, maxLat];
}

function deriveDisplayName(item) {
  const name = String(item?.name ?? '').trim();
  if (name) return name;
  const display = String(item?.display_name ?? '').trim();
  if (display) return display.split(',')[0].trim() || display;
  return 'Unknown place';
}

function deriveLocality(address) {
  if (!address) return null;
  return (
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.hamlet ||
    address.suburb ||
    null
  );
}

function derivePlaceTypes(item) {
  const types = [item?.addresstype, item?.category, item?.type]
    .map((value) => (value == null ? '' : String(value).trim().toLowerCase()))
    .filter(Boolean);
  return Array.from(new Set(types));
}

/**
 * Pure mapper from a Nominatim result item to a PlaceResolved snapshot.
 * Exported for unit testing without network access.
 * @param {object} item
 * @returns {import('../PlaceProvider').PlaceResolved}
 */
function mapNominatimItem(item, { resolvedAt } = {}) {
  const address = item?.address ?? null;
  const lat = toNumberOrNull(item?.lat);
  const lng = toNumberOrNull(item?.lon);
  const countryCode = address?.country_code
    ? String(address.country_code).trim().toUpperCase().slice(0, 2)
    : null;

  return {
    provider: 'nominatim',
    providerRef: buildProviderRef(item),
    displayName: deriveDisplayName(item),
    formattedAddress: item?.display_name ? String(item.display_name) : null,
    coordinates: lat !== null && lng !== null ? { lat, lng } : null,
    countryCode,
    adminArea: address?.state || address?.region || address?.county || null,
    locality: deriveLocality(address),
    placeTypes: derivePlaceTypes(item),
    bbox: mapBoundingBox(item?.boundingbox),
    resolvedAt: resolvedAt ?? new Date().toISOString(),
  };
}

class NominatimPlaceProvider {
  /**
   * @param {{ baseUrl?: string, userAgent?: string, timeoutMs?: number, fetchFn?: typeof fetch, email?: string }} [options]
   */
  constructor(options = {}) {
    this.key = 'nominatim';
    this._baseUrl = options.baseUrl ?? process.env.NOMINATIM_BASE_URL ?? DEFAULT_BASE_URL;
    this._userAgent = options.userAgent ?? process.env.NOMINATIM_USER_AGENT ?? DEFAULT_USER_AGENT;
    this._email = options.email ?? process.env.NOMINATIM_EMAIL ?? null;
    this._timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this._fetch = options.fetchFn ?? fetch;
  }

  _headers() {
    // Nominatim requires an identifying User-Agent per its usage policy.
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
   * @param {string} query
   * @param {{ limit?: number, language?: string, countryCode?: string }} [options]
   * @returns {Promise<import('../PlaceProvider').PlaceResolved[]>}
   */
  async search(query, options = {}) {
    const q = String(query ?? '').trim();
    if (!q) return [];

    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(options.limit) || DEFAULT_LIMIT));
    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      addressdetails: '1',
      limit: String(limit),
    });
    if (options.language) {
      params.set('accept-language', String(options.language));
    }
    if (options.countryCode) {
      params.set('countrycodes', String(options.countryCode).toLowerCase().slice(0, 2));
    }
    if (this._email) {
      params.set('email', this._email);
    }

    const response = await this._fetch(`${this._baseUrl}/search?${params.toString()}`, {
      method: 'GET',
      headers: this._headers(),
      signal: this._signal(),
    });

    if (!response.ok) {
      throw new Error(`Nominatim search failed (${response.status})`);
    }

    const body = await response.json();
    const items = Array.isArray(body) ? body : [];
    const resolvedAt = new Date().toISOString();
    return items.map((item) => mapNominatimItem(item, { resolvedAt }));
  }

  /**
   * @param {string} providerRef — e.g. `N240109189`
   * @param {{ language?: string }} [options]
   * @returns {Promise<import('../PlaceProvider').PlaceResolved|null>}
   */
  async getByRef(providerRef, options = {}) {
    const ref = String(providerRef ?? '').trim();
    const prefix = ref.charAt(0).toUpperCase();
    const osmType = OSM_PREFIX_TYPE[prefix];
    const osmId = ref.slice(1);
    if (!osmType || !/^\d+$/.test(osmId)) {
      return null;
    }

    const params = new URLSearchParams({
      osm_ids: `${prefix}${osmId}`,
      format: 'jsonv2',
      addressdetails: '1',
    });
    if (options.language) {
      params.set('accept-language', String(options.language));
    }
    if (this._email) {
      params.set('email', this._email);
    }

    const response = await this._fetch(`${this._baseUrl}/lookup?${params.toString()}`, {
      method: 'GET',
      headers: this._headers(),
      signal: this._signal(),
    });

    if (!response.ok) {
      throw new Error(`Nominatim lookup failed (${response.status})`);
    }

    const body = await response.json();
    const items = Array.isArray(body) ? body : [];
    if (!items.length) return null;
    return mapNominatimItem(items[0]);
  }
}

module.exports = NominatimPlaceProvider;
module.exports.mapNominatimItem = mapNominatimItem;
module.exports.mapBoundingBox = mapBoundingBox;
module.exports.buildProviderRef = buildProviderRef;
