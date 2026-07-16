// plugins/guides/providers/text/registerDefaultProviders.js
const TextProviderRegistry = require('./TextProviderRegistry');
const NoopTextProvider = require('./adapters/NoopTextProvider');
const OpenAITextProvider = require('./adapters/OpenAITextProvider');

let registered = false;

function ensureTextProvidersRegistered() {
  if (registered) return;
  TextProviderRegistry.register('noop', new NoopTextProvider());
  if (process.env.OPENAI_API_KEY) {
    TextProviderRegistry.register('openai', new OpenAITextProvider());
  }
  registered = true;
}

module.exports = { ensureTextProvidersRegistered };
