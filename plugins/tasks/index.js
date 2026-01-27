// plugins/tasks/index.js
// V3: Uses PluginSDK context instead of legacy (pool, requirePlugin) signature
const TaskModel = require('./model');
const TaskController = require('./controller');
const createTaskRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTasksPlugin(context) {
  // V3: Model and controller use @homebase/core SDK (no pool needed)
  const model = new TaskModel();
  const controller = new TaskController(model);
  const router = createTaskRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeTasksPlugin;