// plugins/clubdesk/index.js
// V3: PluginSDK context
const ClubdeskModel = require('./model');
const ClubdeskController = require('./controller');
const PriceListModel = require('./priceListModel');
const PriceListController = require('./priceListController');
const SiteContentModel = require('./siteContentModel');
const SiteContentController = require('./siteContentController');
const SwishProfileModel = require('./swishProfileModel');
const SwishProfileController = require('./swishProfileController');
const InfoContactModel = require('./infoContactModel');
const InfoContactController = require('./infoContactController');
const InventoryModel = require('./inventoryModel');
const InventoryController = require('./inventoryController');
const createClubdeskRoutes = require('./routes');
const config = require('./plugin.config');

function initializeClubdeskPlugin(context) {
  const model = new ClubdeskModel();
  const controller = new ClubdeskController(model);
  const priceListModel = new PriceListModel();
  const priceListController = new PriceListController(priceListModel);
  const siteContentModel = new SiteContentModel();
  const siteContentController = new SiteContentController(siteContentModel);
  const swishProfileModel = new SwishProfileModel();
  const swishProfileController = new SwishProfileController(swishProfileModel);
  const infoContactModel = new InfoContactModel();
  const infoContactController = new InfoContactController(infoContactModel);
  const inventoryModel = new InventoryModel();
  const inventoryController = new InventoryController(inventoryModel);
  const router = createClubdeskRoutes(
    controller,
    context,
    priceListController,
    siteContentController,
    swishProfileController,
    infoContactController,
    inventoryController,
  );

  return {
    config,
    router,
    model,
    controller,
    priceListModel,
    priceListController,
    siteContentModel,
    siteContentController,
    swishProfileModel,
    swishProfileController,
    infoContactModel,
    infoContactController,
    inventoryModel,
    inventoryController,
  };
}

module.exports = initializeClubdeskPlugin;
