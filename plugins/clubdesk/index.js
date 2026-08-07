// plugins/clubdesk/index.js
// V3: PluginSDK context
const ClubdeskModel = require('./model');
const ClubdeskController = require('./controller');
const PriceListModel = require('./priceListModel');
const PriceListController = require('./priceListController');
const createClubdeskRoutes = require('./routes');
const config = require('./plugin.config');

function initializeClubdeskPlugin(context) {
  const model = new ClubdeskModel();
  const controller = new ClubdeskController(model);
  const priceListModel = new PriceListModel();
  const priceListController = new PriceListController(priceListModel);
  const router = createClubdeskRoutes(controller, context, priceListController);

  return {
    config,
    router,
    model,
    controller,
    priceListModel,
    priceListController,
  };
}

module.exports = initializeClubdeskPlugin;
