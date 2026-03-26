// plugins/cups/index.js
const CupsModel = require('./model');
const CupsController = require('./controller');
const createCupsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeCupsPlugin(context) {
  const model = new CupsModel();
  const controller = new CupsController(model);
  const router = createCupsRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeCupsPlugin;
