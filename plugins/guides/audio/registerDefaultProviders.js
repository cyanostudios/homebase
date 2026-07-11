// plugins/guides/audio/registerDefaultProviders.js
const NoopAudioProvider = require('./adapters/NoopAudioProvider');
const AudioProviderRegistry = require('./AudioProviderRegistry');

let registered = false;

function ensureAudioProvidersRegistered() {
  if (!registered) {
    AudioProviderRegistry.register('noop', new NoopAudioProvider());
    registered = true;
  }
}

module.exports = { ensureAudioProvidersRegistered };
