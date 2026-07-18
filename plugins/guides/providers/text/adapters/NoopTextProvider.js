// plugins/guides/providers/text/adapters/NoopTextProvider.js
class NoopTextProvider {
  constructor() {
    this.key = 'noop';
    this.version = '1';
  }

  /**
   * @param {import('express').Request} _req
   * @param {{
   *   canonicalNarrative?: string|null,
   *   language: string,
   *   sourceLanguage?: string,
   *   sourcePackText?: string|null,
   * }} input
   */
  async generate(_req, input) {
    const narrative = String(input.canonicalNarrative ?? '').trim();
    const sourcePackText = String(input.sourcePackText ?? '').trim();
    const body = sourcePackText || narrative;
    if (!body) {
      return {
        status: 'failed',
        errorMessage: 'source pack or canonicalNarrative is required for text derivation',
      };
    }
    const prefix = `[${input.language}] `;
    return {
      status: 'ready',
      presentationText: `${prefix}${body.slice(0, 2000)}`,
    };
  }
}

module.exports = NoopTextProvider;
