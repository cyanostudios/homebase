// plugins/settings/index.js
// Always-on settings plugin: user settings + activity log

const SettingsModel = require('./model');
const SettingsController = require('./controller');
const createSettingsRoutes = require('./routes');
const config = require('./plugin.config');

function initializeSettingsPlugin(context) {
  const pool = context.pool;
  if (!pool) {
    throw new Error('Settings plugin requires context.pool (main DB for user_settings)');
  }

  const model = new SettingsModel(pool);
  const controller = new SettingsController(model);
  const router = createSettingsRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeSettingsPlugin;
