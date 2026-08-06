// plugins/instructions/index.js
// V3: PluginSDK context
const InstructionModel = require('./model');
const InstructionController = require('./controller');
const createInstructionRoutes = require('./routes');
const config = require('./plugin.config');

function initializeInstructionsPlugin(context) {
  const model = new InstructionModel();
  const controller = new InstructionController(model);
  const router = createInstructionRoutes(controller, context);

  return {
    config,
    router,
    model,
    controller,
  };
}

module.exports = initializeInstructionsPlugin;
