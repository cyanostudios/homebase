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
   *   variantType: string,
   *   language: string,
   *   sourceLanguage?: string,
   *   sourcePackText?: string|null,
   *   sourceDeepText?: string|null,
   * }} input
   */
  async generate(_req, input) {
    const narrative = String(input.canonicalNarrative ?? '').trim();
    const sourcePackText = String(input.sourcePackText ?? '').trim();
    const sourceDeepText = String(input.sourceDeepText ?? '').trim();
    const body = sourceDeepText || sourcePackText || narrative;
    if (!body) {
      return {
        status: 'failed',
        errorMessage:
          'source pack, deep presentation, or canonicalNarrative is required for text derivation',
      };
    }
    const prefix = `[${input.variantType}/${input.language}] `;
    return {
      status: 'ready',
      presentationText: `${prefix}${body.slice(0, 2000)}`,
    };
  }
}

module.exports = NoopTextProvider;
