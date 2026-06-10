// plugins/teams/index.js
// V3: Uses PluginSDK context
const TeamModel = require('./model');
const TeamController = require('./controller');
const createTeamRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTeamsPlugin(context) {
  const model = new TeamModel();
  const controller = new TeamController(model);
  const router = createTeamRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeTeamsPlugin;
