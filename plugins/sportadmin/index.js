// plugins/sportadmin/index.js
const SportadminModel = require('./model');
const SportadminController = require('./controller');
const createSportadminRoutes = require('./routes');
const config = require('./plugin.config');
const { SportAdminProvider } = require('./providers/SportAdminProvider');

function initializeSportadminPlugin(context) {
  const model = new SportadminModel();
  const controller = new SportadminController(model);
  const router = createSportadminRoutes(controller, context);
  const provider = new SportAdminProvider(model);

  return {
    config,
    router,
    model,
    controller,
    provider,
  };
}

module.exports = initializeSportadminPlugin;
