// plugins/guides/audio/adapters/NoopAudioProvider.js
const AudioProvider = require('../AudioProvider');
const { createMinimalWavBuffer } = require('../minimalWav');

class NoopAudioProvider extends AudioProvider {
  constructor() {
    super();
    this.name = 'noop';
  }

  async generate(_req, _input) {
    const buffer = createMinimalWavBuffer(1000);
    return {
      status: 'ready',
      audioBuffer: buffer,
      durationMs: 1000,
      mimeType: 'audio/wav',
    };
  }

  async getStatus(_req, input) {
    return { status: input.status ?? 'pending' };
  }

  async cancel(_req, _input) {
    return { status: 'pending' };
  }
}

module.exports = NoopAudioProvider;
