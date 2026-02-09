// plugins/mail/index.js
const createMailRoutes = require('./routes');
const config = require('./plugin.config');

function initializeMailPlugin(context) {
  const router = createMailRoutes(context);

  return {
    config,
    router,
  };
}

module.exports = initializeMailPlugin;
