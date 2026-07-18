const PlacesController = require('./controller');
const createPlacesRoutes = require('./routes');
const config = require('./plugin.config');
const PlaceProviderRegistry = require('./PlaceProviderRegistry');
const { ensurePlaceProvidersRegistered } = require('./registerDefaultProviders');

function initializePlacesPlugin(context) {
  ensurePlaceProvidersRegistered();
  const controller = new PlacesController();
  const router = createPlacesRoutes(controller, context);

  return {
    config,
    router,
    controller,
    registry: PlaceProviderRegistry,
  };
}

module.exports = initializePlacesPlugin;
