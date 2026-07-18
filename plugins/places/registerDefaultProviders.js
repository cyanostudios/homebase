// plugins/places/registerDefaultProviders.js
const PlaceProviderRegistry = require('./PlaceProviderRegistry');
const NominatimPlaceProvider = require('./adapters/NominatimPlaceProvider');

let registered = false;

function ensurePlaceProvidersRegistered() {
  if (registered) return;
  // Keyless default; safe to construct once and reuse.
  PlaceProviderRegistry.register('nominatim', (options) => new NominatimPlaceProvider(options));
  registered = true;
}

module.exports = { ensurePlaceProvidersRegistered };
