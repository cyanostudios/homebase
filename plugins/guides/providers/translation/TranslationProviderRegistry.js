// plugins/guides/providers/translation/TranslationProviderRegistry.js
const { AppError } = require('../../../../server/core/errors/AppError');

class TranslationProviderRegistry {
  constructor() {
    /** @type {Map<string, object|((options?: object) => object)>} */
    this._providers = new Map();
  }

  register(key, provider) {
    this._providers.set(String(key).toLowerCase(), provider);
  }

  has(key) {
    return this._providers.has(String(key).toLowerCase());
  }

  get(key) {
    const normalized = String(key).toLowerCase();
    const provider = this._providers.get(normalized);
    if (!provider) {
      throw new AppError(
        'Translation provider not registered',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return provider;
  }

  create(key, options) {
    const entry = this.get(key);
    if (typeof entry === 'function') {
      return entry(options);
    }
    return entry;
  }

  listKeys() {
    return Array.from(this._providers.keys());
  }
}

module.exports = new TranslationProviderRegistry();
