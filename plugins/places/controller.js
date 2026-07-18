const { Logger } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const PlaceProviderRegistry = require('./PlaceProviderRegistry');
const { ensurePlaceProvidersRegistered } = require('./registerDefaultProviders');
const { DEFAULT_PLACE_PROVIDER, getPlaceProviderCatalogEntry } = require('./placeProviderCatalog');

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 200;

class PlacesController {
  /**
   * @param {{ registry?: typeof PlaceProviderRegistry }} [options]
   */
  constructor(options = {}) {
    this.registry = options.registry ?? PlaceProviderRegistry;
  }

  /** Active provider for this tenant. v1: catalog default, overridable via env. */
  _activeProviderKey() {
    const fromEnv = String(process.env.PLACES_PROVIDER || '')
      .trim()
      .toLowerCase();
    if (fromEnv && getPlaceProviderCatalogEntry(fromEnv)) {
      return fromEnv;
    }
    return DEFAULT_PLACE_PROVIDER;
  }

  _attributionFor(providerKey) {
    const entry = getPlaceProviderCatalogEntry(providerKey);
    return entry?.requiresAttribution ? entry.attribution : null;
  }

  async search(req, res) {
    try {
      ensurePlaceProvidersRegistered();
      const q = String(req.query.q ?? '').trim();
      if (q.length < MIN_QUERY_LENGTH) {
        throw new AppError(
          `Query must be at least ${MIN_QUERY_LENGTH} characters`,
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      if (q.length > MAX_QUERY_LENGTH) {
        throw new AppError('Query is too long', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const limit = req.query.limit !== undefined ? Number(req.query.limit) : undefined;
      if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
        throw new AppError('limit must be a positive number', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const language =
        typeof req.query.language === 'string' && req.query.language.trim()
          ? req.query.language.trim().slice(0, 35)
          : undefined;

      const providerKey = this._activeProviderKey();
      const provider = this.registry.create(providerKey);
      const results = await provider.search(q, { limit, language });

      res.json({
        provider: providerKey,
        attribution: this._attributionFor(providerKey),
        results,
      });
    } catch (error) {
      Logger.error('Place search failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(502).json({ error: 'Place search failed' });
    }
  }

  async getByRef(req, res) {
    try {
      ensurePlaceProvidersRegistered();
      const providerRef = String(req.params.providerRef ?? '').trim();
      if (!providerRef) {
        throw new AppError('providerRef is required', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const language =
        typeof req.query.language === 'string' && req.query.language.trim()
          ? req.query.language.trim().slice(0, 35)
          : undefined;

      const providerKey = this._activeProviderKey();
      const provider = this.registry.create(providerKey);
      if (typeof provider.getByRef !== 'function') {
        throw new AppError('Detail lookup not supported', 400, AppError.CODES.VALIDATION_ERROR);
      }

      const result = await provider.getByRef(providerRef, { language });
      if (!result) {
        throw new AppError('Place not found', 404, AppError.CODES.NOT_FOUND);
      }

      res.json({
        provider: providerKey,
        attribution: this._attributionFor(providerKey),
        result,
      });
    } catch (error) {
      Logger.error('Place lookup failed', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(502).json({ error: 'Place lookup failed' });
    }
  }
}

module.exports = PlacesController;
