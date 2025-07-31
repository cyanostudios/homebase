// plugins/tasks/index.js
const TaskModel = require('./model');
const TaskController = require('./controller');
const createTaskRoutes = require('./routes');
const config = require('./plugin.config');

function initializeTasksPlugin(pool, requirePlugin) {
  const model = new TaskModel(pool);
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