// Base contract for audio generation providers (noop, future TTS integrations).

/**
 * @typedef {Object} AudioGenerationResult
 * @property {string} status - pending | processing | ready | failed | stale
 * @property {Buffer} [audioBuffer]
 * @property {number} [durationMs]
 * @property {string} [mimeType]
 * @property {string} [errorMessage]
 */

class AudioProvider {
  constructor() {
    /** @type {string} */
    this.name = 'base';
  }

  /**
   * @param {import('express').Request} req
   * @param {{ presentationId: string|number, presentationText?: string|null, language?: string }} input
   * @returns {Promise<AudioGenerationResult>}
   */
  async generate(req, input) {
    void req;
    void input;
    throw new Error('AudioProvider.generate not implemented');
  }

  /**
   * @param {import('express').Request} req
   * @param {{ presentationId: string|number, status?: string }} input
   * @returns {Promise<AudioGenerationResult>}
   */
  async getStatus(req, input) {
    void req;
    void input;
    throw new Error('AudioProvider.getStatus not implemented');
  }

  /**
   * @param {import('express').Request} req
   * @param {{ presentationId: string|number }} input
   * @returns {Promise<AudioGenerationResult>}
   */
  async cancel(req, input) {
    void req;
    void input;
    throw new Error('AudioProvider.cancel not implemented');
  }
}

module.exports = AudioProvider;
