// plugins/guides/providers/text/TextProvider.js
/**
 * @typedef {Object} TextGenerateInput
 * @property {string|null|undefined} canonicalNarrative
 * @property {'quick'|'normal'|'deep'} variantType
 * @property {string} language — ISO 639-1, e.g. 'sv'
 * @property {string} [sourceLanguage]
 */

/**
 * @typedef {Object} TextProviderResult
 * @property {'ready'|'failed'|'retry'} status
 * @property {string} [presentationText]
 * @property {string} [errorMessage]
 * @property {number} [retryAfterMs]
 * @property {Object} [providerResult] — full blob for DB persistence (P4)
 */

/**
 * @typedef {Object} TextProvider
 * @property {string} key
 * @property {string} version
 * @property {(req: import('express').Request, input: TextGenerateInput) => Promise<TextProviderResult>} generate
 */

module.exports = {};
