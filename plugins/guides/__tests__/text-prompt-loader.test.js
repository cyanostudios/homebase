// plugins/guides/__tests__/text-prompt-loader.test.js
const TextPromptLoader = require('../providers/text/TextPromptLoader');

describe('TextPromptLoader', () => {
  afterEach(() => {
    TextPromptLoader._resetCache();
  });

  test('loads manifest and interpolates variables', () => {
    const prompts = TextPromptLoader.getPrompts('normal', {
      canonicalNarrative: 'A historic square with a fountain.',
      language: 'sv',
      variantType: 'normal',
    });

    expect(prompts.promptSetVersion).toBe('v1');
    expect(prompts.promptVersion).toBe('v1');
    expect(prompts.maxCompletionTokens).toBe(400);
    expect(prompts.system).toContain('tour guide');
    expect(prompts.user).toContain('A historic square with a fountain.');
    expect(prompts.user).toContain('Language: sv');
    expect(prompts.user).toContain('Variant type: normal');
  });

  test('token budgets differ per variant type', () => {
    const quick = TextPromptLoader.getPrompts('quick', {
      canonicalNarrative: 'X',
      language: 'en',
      variantType: 'quick',
    });
    const deep = TextPromptLoader.getPrompts('deep', {
      canonicalNarrative: 'X',
      language: 'en',
      variantType: 'deep',
    });
    expect(quick.maxCompletionTokens).toBe(150);
    expect(deep.maxCompletionTokens).toBe(800);
  });

  test('getPromptSetVersion returns manifest version', () => {
    expect(TextPromptLoader.getPromptSetVersion()).toBe('v1');
  });

  test('throws for unknown variant type', () => {
    expect(() =>
      TextPromptLoader.getPrompts('unknown', {
        canonicalNarrative: 'X',
        language: 'sv',
        variantType: 'unknown',
      }),
    ).toThrow('No prompt config');
  });
});
