/**
 * @typedef {Object} PlaceResolved
 * @property {'nominatim'|'google'|'mapbox'|'manual'} provider
 * @property {string|null} providerRef — stable external reference (null for manual)
 * @property {string} displayName
 * @property {string|null} formattedAddress
 * @property {{ lat: number, lng: number }|null} coordinates
 * @property {string|null} countryCode — ISO 3166-1 alpha-2 (uppercase)
 * @property {string|null} adminArea
 * @property {string|null} locality
 * @property {string[]} placeTypes
 * @property {[number, number, number, number]|null} bbox — [minLon, minLat, maxLon, maxLat]
 * @property {string} resolvedAt — ISO timestamp
 */

/**
 * @typedef {Object} PlaceProvider
 * @property {string} key
 * @property {(query: string, options?: { limit?: number, language?: string, signal?: AbortSignal }) => Promise<PlaceResolved[]>} search
 * @property {(providerRef: string, options?: { language?: string }) => Promise<PlaceResolved|null>} [getByRef]
 */

module.exports = {};
