/**
 * Data-driven metadata for supported place providers.
 * Mirrors ai-providers/providerCatalog.js: the catalog is the single source of
 * truth for which adapters exist and how they are configured.
 *
 * `nominatim` (OpenStreetMap) is keyless and is the default adapter. Optional
 * adapters (google, mapbox) can be activated later via credentials without any
 * change to the domain layer.
 */
function freeze(entry) {
  return Object.freeze({ ...entry });
}

const PLACE_PROVIDER_CATALOG = Object.freeze({
  nominatim: freeze({
    key: 'nominatim',
    label: 'OpenStreetMap (Nominatim)',
    keyless: true,
    envApiKey: null,
    // Nominatim usage policy requires attribution and a descriptive User-Agent.
    attribution: '© OpenStreetMap contributors',
    requiresAttribution: true,
  }),
  google: freeze({
    key: 'google',
    label: 'Google Places',
    keyless: false,
    envApiKey: 'GOOGLE_PLACES_API_KEY',
    attribution: null,
    requiresAttribution: false,
  }),
  mapbox: freeze({
    key: 'mapbox',
    label: 'Mapbox',
    keyless: false,
    envApiKey: 'MAPBOX_ACCESS_TOKEN',
    attribution: null,
    requiresAttribution: false,
  }),
});

const DEFAULT_PLACE_PROVIDER = 'nominatim';

const SUPPORTED_PLACE_PROVIDERS = new Set(Object.keys(PLACE_PROVIDER_CATALOG));

function getPlaceProviderCatalogEntry(providerKey) {
  const normalized = String(providerKey ?? '')
    .trim()
    .toLowerCase();
  return PLACE_PROVIDER_CATALOG[normalized] ?? null;
}

module.exports = {
  PLACE_PROVIDER_CATALOG,
  DEFAULT_PLACE_PROVIDER,
  SUPPORTED_PLACE_PROVIDERS,
  getPlaceProviderCatalogEntry,
};
