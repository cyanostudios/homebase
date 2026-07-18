// plugins/guides/providers/text/TextProvider.js
/**
 * @typedef {Object} PlaceContext
 * @property {string|null} [displayName]
 * @property {string|null} [formattedAddress]
 * @property {string|null} [countryCode]
 * @property {string|null} [adminArea]
 * @property {string|null} [locality]
 * @property {{ lat: number, lng: number }|null} [coordinates]
 * @property {string[]} [placeTypes]
 */

/**
 * @typedef {Object} TextGenerateInput
 * @property {string|null|undefined} canonicalNarrative
 * @property {'quick'|'normal'|'deep'} variantType
 * @property {string} language — ISO 639-1, e.g. 'sv'
 * @property {string} [sourceLanguage]
 * @property {PlaceContext|null} [placeContext] — structured place snapshot for prompt interpolation (P-PLACE)
 */

/**
 * @typedef {Object} TextProviderResult
 * @property {'ready'|'failed'|'retry'} status
 * @property {string} [presentationText]
 * @property {string} [errorMessage]
 * @property {string} [failureCode] — stable GenerationFailureCode from ai-providers (P-GEN-STATUS)
 * @property {number} [retryAfterMs]
 * @property {Object} [providerResult] — full blob for DB persistence (P4)
 */

/**
 * @typedef {Object} TextProvider
 * @property {string} key
 * @property {string} version
 * @property {(req: import('express').Request, input: TextGenerateInput) => Promise<TextProviderResult>} generate
 * @property {() => Promise<{ ok?: boolean, model: string }>} [testConnection] — optional; used by ai-providers connection test
 */

module.exports = {};
