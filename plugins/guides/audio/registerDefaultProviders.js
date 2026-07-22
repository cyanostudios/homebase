const NoopAudioProvider = require('./adapters/NoopAudioProvider');
const ElevenLabsAudioProvider = require('./adapters/ElevenLabsAudioProvider');
const AudioProviderRegistry = require('./AudioProviderRegistry');
const ConnectionTestRegistry = require('../../ai-providers/ConnectionTestRegistry');

let registered = false;

function ensureAudioProvidersRegistered() {
  if (registered) return;
  AudioProviderRegistry.register('noop', new NoopAudioProvider());
  const elevenLabsFactory = (options) => new ElevenLabsAudioProvider(options);
  AudioProviderRegistry.register('elevenlabs', elevenLabsFactory);
  ConnectionTestRegistry.register('elevenlabs', elevenLabsFactory);
  registered = true;
}

/**
 * Keys that can power real TTS routing (excludes noop stub).
 * @returns {string[]}
 */
function listGeneratableAudioProviderKeys() {
  ensureAudioProvidersRegistered();
  return AudioProviderRegistry.listKeys().filter((key) => key !== 'noop');
}

module.exports = { ensureAudioProvidersRegistered, listGeneratableAudioProviderKeys };
