// plugins/guides/providers/translation/adapters/NoopTranslationProvider.js
class NoopTranslationProvider {
  constructor() {
    this.key = 'noop';
    this.version = '1';
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ presentationText: string, sourceLanguage: string, targetLanguage: string }} input
   */
  async translate(_req, input) {
    const text = String(input.presentationText ?? '').trim();
    if (!text) {
      return { status: 'failed', errorMessage: 'presentationText is required for translation' };
    }
    return {
      status: 'ready',
      translatedText: `[${input.targetLanguage}] ${text}`,
    };
  }
}

module.exports = NoopTranslationProvider;
