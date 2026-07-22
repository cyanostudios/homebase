// plugins/guides/__tests__/text-prompt-loader.test.js
const TextPromptLoader = require('../providers/text/TextPromptLoader');

describe('TextPromptLoader', () => {
  afterEach(() => {
    TextPromptLoader._resetCache();
  });

  test('loads manifest and interpolates variables', () => {
    const prompts = TextPromptLoader.getPrompts({
      canonicalNarrative: 'A historic square with a fountain.',
      language: 'sv',
    });

    expect(prompts.promptSetVersion).toBe('v1.4');
    expect(prompts.promptVersion).toBe('v1');
    expect(prompts.maxCompletionTokens).toBe(2800);
    expect(prompts.system).toContain('audioguide');
    expect(prompts.system).toContain('1200–1800');
    expect(prompts.user).toContain('A historic square with a fountain.');
    expect(prompts.user).toContain('Language: sv');
    expect(prompts.user).toContain('1200–1800');
    expect(prompts.user).not.toContain('Variant type');
  });

  test('getPromptSetVersion returns manifest version', () => {
    expect(TextPromptLoader.getPromptSetVersion()).toBe('v1.4');
  });

  test('includes place context block when provided', () => {
    const prompts = TextPromptLoader.getPrompts({
      canonicalNarrative: 'Notes',
      language: 'en',
      placeContext: { displayName: 'Museum Square', locality: 'Stockholm' },
      sourcePackText: 'Facts here',
    });
    expect(prompts.user).toContain('Museum Square');
    expect(prompts.user).toContain('Stockholm');
    expect(prompts.user).toContain('Facts here');
  });
});
