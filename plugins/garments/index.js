// plugins/garments/index.js
const GarmentsModel = require('./model');
const GarmentsController = require('./controller');
const createGarmentsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeGarmentsPlugin(context) {
  const model = new GarmentsModel();
  const controller = new GarmentsController(model);
  const router = createGarmentsRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeGarmentsPlugin;
