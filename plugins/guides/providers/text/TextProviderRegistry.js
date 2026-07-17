// plugins/guides/providers/text/TextProviderRegistry.js
const { AppError } = require('../../../../server/core/errors/AppError');

class TextProviderRegistry {
  constructor() {
    /** @type {Map<string, import('./TextProvider')|((options?: any) => import('./TextProvider'))>} */
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
      throw new AppError('Text provider not registered', 400, AppError.CODES.VALIDATION_ERROR);
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
}

module.exports = new TextProviderRegistry();
