// plugins/tasks/index.js
const TaskModel = require('./model');
const TaskController = require('./controller');
const createTaskRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTasksPlugin(pool, requirePlugin) {
  // V2: Model and controller no longer need pool - ServiceManager provides database service
  const model = new TaskModel();
  const controller = new TaskController(model);
  const router = createTaskRoutes(controller, requirePlugin);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeTasksPlugin;