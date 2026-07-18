// plugins/guides/sources/ContentSource.js
/**
 * @typedef {Object} PlaceQuery
 * @property {string|null} [displayName]
 * @property {string|null} [formattedAddress]
 * @property {string|null} [countryCode]
 * @property {string|null} [adminArea]
 * @property {string|null} [locality]
 * @property {{ lat: number, lng: number }|null} [coordinates]
 * @property {string[]} [placeTypes]
 * @property {string} [language]
 */

/**
 * @typedef {Object} SourceExcerpt
 * @property {string} sourceKey
 * @property {string} title
 * @property {string} url
 * @property {string} excerpt
 * @property {string|null} [externalId]
 */

/**
 * @typedef {Object} SourceFetchResult
 * @property {string} sourceKey
 * @property {'ok'|'empty'|'failed'} status
 * @property {SourceExcerpt[]} excerpts
 * @property {string|null} [errorMessage]
 * @property {string|null} [attribution]
 */

/**
 * @typedef {Object} ContentSource
 * @property {string} key
 * @property {(place: PlaceQuery, options?: object) => Promise<SourceFetchResult>} fetch
 */

module.exports = {};
