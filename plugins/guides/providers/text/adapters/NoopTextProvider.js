// plugins/guides/providers/text/adapters/NoopTextProvider.js
class NoopTextProvider {
  constructor() {
    this.key = 'noop';
    this.version = '1';
  }

  /**
   * @param {import('express').Request} _req
   * @param {{ canonicalNarrative: string|null|undefined, variantType: string, language: string, sourceLanguage?: string }} input
   */
  async generate(_req, input) {
    const narrative = String(input.canonicalNarrative ?? '').trim();
    if (!narrative) {
      return {
        status: 'failed',
        errorMessage: 'canonicalNarrative is required for text derivation',
      };
    }
    const prefix = `[${input.variantType}/${input.language}] `;
    return {
      status: 'ready',
      presentationText: `${prefix}${narrative}`,
    };
  }
}

module.exports = NoopTextProvider;
