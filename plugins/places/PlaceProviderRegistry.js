const { AppError } = require('../../server/core/errors/AppError');

/**
 * Registry of place provider adapters. Mirrors the guides TextProviderRegistry:
 * adapters are registered at plugin init and resolved by key. Keeps the
 * controller free of any concrete provider imports (principle PL1).
 */
class PlaceProviderRegistry {
  constructor() {
    /** @type {Map<string, import('./PlaceProvider').PlaceProvider|((options?: object) => import('./PlaceProvider').PlaceProvider)>} */
    this._providers = new Map();
  }

  register(key, provider) {
    this._providers.set(String(key).toLowerCase(), provider);
  }

  has(key) {
    return this._providers.has(String(key).toLowerCase());
  }

  get(key) {
    const provider = this._providers.get(String(key).toLowerCase());
    if (!provider) {
      throw new AppError('Place provider not registered', 400, AppError.CODES.VALIDATION_ERROR);
    }
    return provider;
  }

  create(key, options) {
    const entry = this.get(key);
    return typeof entry === 'function' ? entry(options) : entry;
  }

  /** @internal test helper */
  clear() {
    this._providers.clear();
  }
}

module.exports = new PlaceProviderRegistry();
module.exports.PlaceProviderRegistry = PlaceProviderRegistry;
