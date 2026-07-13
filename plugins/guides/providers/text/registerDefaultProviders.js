// plugins/guides/providers/text/registerDefaultProviders.js
const TextProviderRegistry = require('./TextProviderRegistry');
const NoopTextProvider = require('./adapters/NoopTextProvider');

let registered = false;

function ensureTextProvidersRegistered() {
  if (registered) return;
  TextProviderRegistry.register('noop', new NoopTextProvider());
  registered = true;
}

module.exports = { ensureTextProvidersRegistered };
