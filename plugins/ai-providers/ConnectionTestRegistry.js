const { AppError } = require('../../server/core/errors/AppError');

/**
 * Registry of factories that produce objects with optional testConnection().
 * Owned by ai-providers so the controller never imports domain adapters.
 * Domain plugins (e.g. guides) register factories at plugin init.
 */
class ConnectionTestRegistry {
  constructor() {
    /** @type {Map<string, (options?: object) => { testConnection?: () => Promise<{ model: string }> }>} */
    this._factories = new Map();
  }

  register(key, factory) {
    if (typeof factory !== 'function') {
      throw new Error('Connection test factory must be a function');
    }
    this._factories.set(String(key).toLowerCase(), factory);
  }

  has(key) {
    return this._factories.has(String(key).toLowerCase());
  }

  create(key, options) {
    const normalized = String(key).toLowerCase();
    const factory = this._factories.get(normalized);
    if (!factory) {
      throw new AppError(
        'Connection test not available for this provider',
        400,
        AppError.CODES.VALIDATION_ERROR,
      );
    }
    return factory(options);
  }

  /** @internal test helper */
  clear() {
    this._factories.clear();
  }
}

const connectionTestRegistry = new ConnectionTestRegistry();
module.exports = connectionTestRegistry;
module.exports.ConnectionTestRegistry = ConnectionTestRegistry;
