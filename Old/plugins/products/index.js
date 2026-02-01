// plugins/products/index.js
const ProductModel = require('./model');
const ProductController = require('./controller');
const createProductRoutes = require('./routes');
const config = require('./plugin.config');

function initializeProductsPlugin(pool, requirePlugin) {
  const model = new ProductModel(pool);
  const controller = new ProductController(model);
  const router = createProductRoutes(controller, requirePlugin);

  return { config, router, model, controller };
}

module.exports = initializeProductsPlugin;
