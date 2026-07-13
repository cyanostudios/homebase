// plugins/guides/providers/translation/registerDefaultProviders.js
const TranslationProviderRegistry = require('./TranslationProviderRegistry');
const NoopTranslationProvider = require('./adapters/NoopTranslationProvider');

let registered = false;

function ensureTranslationProvidersRegistered() {
  if (registered) return;
  TranslationProviderRegistry.register('noop', new NoopTranslationProvider());
  registered = true;
}

module.exports = { ensureTranslationProvidersRegistered };
