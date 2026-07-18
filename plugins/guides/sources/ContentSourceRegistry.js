const { AppError } = require('../../../server/core/errors/AppError');

class ContentSourceRegistry {
  constructor() {
    /** @type {Map<string, import('./ContentSource').ContentSource|((options?: object) => import('./ContentSource').ContentSource)>} */
    this._sources = new Map();
  }

  register(key, source) {
    this._sources.set(String(key).toLowerCase(), source);
  }

  has(key) {
    return this._sources.has(String(key).toLowerCase());
  }

  get(key) {
    const source = this._sources.get(String(key).toLowerCase());
    if (!source) {
      throw new AppError('Content source not registered', 400, AppError.CODES.VALIDATION_ERROR);
    }
    return source;
  }

  create(key, options) {
    const entry = this.get(key);
    return typeof entry === 'function' ? entry(options) : entry;
  }

  listKeys() {
    return Array.from(this._sources.keys());
  }

  /** @internal */
  clear() {
    this._sources.clear();
  }
}

module.exports = new ContentSourceRegistry();
module.exports.ContentSourceRegistry = ContentSourceRegistry;
