// plugins/guides/audio/adapters/NoopAudioProvider.js
const AudioProvider = require('../AudioProvider');

class NoopAudioProvider extends AudioProvider {
  constructor() {
    super();
    this.name = 'noop';
  }

  async generate(_req, _input) {
    return { status: 'pending' };
  }

  async getStatus(_req, input) {
    return { status: input.status ?? 'pending' };
  }

  async cancel(_req, _input) {
    return { status: 'pending' };
  }
}

module.exports = NoopAudioProvider;
