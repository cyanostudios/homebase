// plugins/guides/__tests__/openai-translation-provider.test.js
const OpenAITranslationProvider = require('../providers/translation/adapters/OpenAITranslationProvider');
const ProviderRateLimiter = require('../providers/shared/ProviderRateLimiter');

function mockFetch(response) {
  return jest.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    headers: {
      get: (name) => (response.headers ?? {})[name.toLowerCase()] ?? null,
    },
    json: async () => response.body,
  });
}

describe('OpenAITranslationProvider', () => {
  beforeEach(() => {
    ProviderRateLimiter._reset();
  });

  test('version includes model and prompt set', () => {
    const provider = new OpenAITranslationProvider({ apiKey: 'sk-test', model: 'gpt-4o-mini' });
    expect(provider.key).toBe('openai');
    expect(provider.version).toBe('openai-trans@gpt-4o-mini@prompts-v1');
  });

  test('returns ready with full providerResult on success', async () => {
    const fetchFn = mockFetch({
      body: {
        choices: [{ message: { content: '  Welcome to the square.  ' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
      },
    });
    const provider = new OpenAITranslationProvider({
      apiKey: 'sk-test',
      fetchFn,
      rpm: 100,
    });

    const result = await provider.translate(
      {},
      {
        presentationText: 'Välkommen till torget.',
        sourceLanguage: 'sv',
        targetLanguage: 'en',
      },
    );

    expect(result.status).toBe('ready');
    expect(result.translatedText).toBe('Welcome to the square.');
    expect(result.providerResult.translatedText).toBe('Welcome to the square.');
    expect(result.providerResult.usage.totalTokens).toBe(120);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });

  test('returns retry on HTTP 429 rate limit', async () => {
    const fetchFn = mockFetch({
      ok: false,
      status: 429,
      headers: { 'retry-after': '12' },
      body: { error: { message: 'Rate limit' } },
    });
    const provider = new OpenAITranslationProvider({ apiKey: 'sk-test', fetchFn, rpm: 100 });

    const result = await provider.translate(
      {},
      { presentationText: 'Text', sourceLanguage: 'sv', targetLanguage: 'en' },
    );

    expect(result.status).toBe('retry');
    expect(result.retryAfterMs).toBe(12000);
  });

  test('returns failed when presentationText is empty', async () => {
    const provider = new OpenAITranslationProvider({ apiKey: 'sk-test', fetchFn: jest.fn() });
    const result = await provider.translate(
      {},
      { presentationText: '  ', sourceLanguage: 'sv', targetLanguage: 'en' },
    );
    expect(result.status).toBe('failed');
    expect(result.failureCode).toBe('content_input_invalid');
  });
});
