const ScheduleModel = require('./model');
const ScheduleController = require('./controller');
const createScheduleRoutes = require('./routes');
const config = require('./plugin.config');

function initializeSchedulePlugin(context) {
  const model = new ScheduleModel();
  const controller = new ScheduleController(model);
  const router = createScheduleRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeSchedulePlugin;
