// plugins/guides/__tests__/noop-providers.test.js
const NoopTextProvider = require('../providers/text/adapters/NoopTextProvider');
const NoopTranslationProvider = require('../providers/translation/adapters/NoopTranslationProvider');

describe('noop production providers', () => {
  test('NoopTextProvider prefixes narrative', async () => {
    const provider = new NoopTextProvider();
    const result = await provider.generate(
      {},
      {
        canonicalNarrative: 'Story',
        variantType: 'quick',
        language: 'sv',
      },
    );
    expect(result.status).toBe('ready');
    expect(result.presentationText).toBe('[quick/sv] Story');
  });

  test('NoopTranslationProvider prefixes target language', async () => {
    const provider = new NoopTranslationProvider();
    const result = await provider.translate(
      {},
      {
        presentationText: 'Hello',
        sourceLanguage: 'sv',
        targetLanguage: 'en',
      },
    );
    expect(result.status).toBe('ready');
    expect(result.translatedText).toBe('[en] Hello');
  });
});
