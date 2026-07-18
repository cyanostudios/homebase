// plugins/guides/providers/translation/registerDefaultProviders.js
const TranslationProviderRegistry = require('./TranslationProviderRegistry');
const NoopTranslationProvider = require('./adapters/NoopTranslationProvider');
const OpenAITranslationProvider = require('./adapters/OpenAITranslationProvider');

let registered = false;

function ensureTranslationProvidersRegistered() {
  if (registered) return;
  TranslationProviderRegistry.register('noop', new NoopTranslationProvider());
  TranslationProviderRegistry.register(
    'openai',
    (options) => new OpenAITranslationProvider(options),
  );
  registered = true;
}

function listGeneratableTranslationProviderKeys() {
  ensureTranslationProvidersRegistered();
  return TranslationProviderRegistry.listKeys().filter((key) => key !== 'noop');
}

module.exports = {
  ensureTranslationProvidersRegistered,
  listGeneratableTranslationProviderKeys,
};
