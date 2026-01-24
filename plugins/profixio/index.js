// plugins/profixio/index.js
const ProfixioModel = require('./model');
const ProfixioController = require('./controller');
const createProfixioRoutes = require('./routes');
const config = require('./plugin.config');

function initializeProfixioPlugin(pool, requirePlugin, csrfProtection, validateRequest) {
  const controller = ProfixioController;
  const router = createProfixioRoutes(controller, requirePlugin, csrfProtection, validateRequest);

  return {
    config,
    router,
    model: ProfixioModel,
    controller,
  };
}

module.exports = initializeProfixioPlugin;
