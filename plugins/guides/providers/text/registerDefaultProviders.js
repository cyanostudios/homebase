// plugins/guides/providers/text/registerDefaultProviders.js
const TextProviderRegistry = require('./TextProviderRegistry');
const NoopTextProvider = require('./adapters/NoopTextProvider');
const OpenAITextProvider = require('./adapters/OpenAITextProvider');
const ConnectionTestRegistry = require('../../../ai-providers/ConnectionTestRegistry');

let registered = false;

function ensureTextProvidersRegistered() {
  if (registered) return;
  TextProviderRegistry.register('noop', new NoopTextProvider());
  const openaiFactory = (options) => new OpenAITextProvider(options);
  TextProviderRegistry.register('openai', openaiFactory);
  ConnectionTestRegistry.register('openai', openaiFactory);
  registered = true;
}

module.exports = { ensureTextProvidersRegistered };
