// plugins/guides/__tests__/openai-text-provider.test.js
const OpenAITextProvider = require('../providers/text/adapters/OpenAITextProvider');
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

describe('OpenAITextProvider', () => {
  beforeEach(() => {
    ProviderRateLimiter._reset();
  });

  test('version includes model and prompt set', () => {
    const provider = new OpenAITextProvider({ apiKey: 'sk-test', model: 'gpt-4o-mini' });
    expect(provider.key).toBe('openai');
    expect(provider.version).toBe('openai@gpt-4o-mini@prompts-v1');
  });

  test('returns ready with full providerResult on success', async () => {
    const fetchFn = mockFetch({
      body: {
        choices: [{ message: { content: '  Welcome to the square.  ' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      },
    });
    const provider = new OpenAITextProvider({
      apiKey: 'sk-test',
      fetchFn,
      rpm: 100,
    });

    const result = await provider.generate(
      {},
      { canonicalNarrative: 'A square.', variantType: 'normal', language: 'sv' },
    );

    expect(result.status).toBe('ready');
    expect(result.presentationText).toBe('Welcome to the square.');
    expect(result.providerResult.presentationText).toBe('Welcome to the square.');
    expect(result.providerResult.raw.text).toBe('  Welcome to the square.  ');
    expect(result.providerResult.raw.model).toBe('gpt-4o-mini');
    expect(result.providerResult.usage.totalTokens).toBe(150);
    expect(result.providerResult.latencyMs).toBeGreaterThanOrEqual(0);
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });

  test('returns retry on HTTP 429', async () => {
    const fetchFn = mockFetch({
      ok: false,
      status: 429,
      headers: { 'retry-after': '15' },
      body: { error: { message: 'Rate limit' } },
    });
    const provider = new OpenAITextProvider({ apiKey: 'sk-test', fetchFn, rpm: 100 });

    const result = await provider.generate(
      {},
      { canonicalNarrative: 'Story', variantType: 'quick', language: 'en' },
    );

    expect(result.status).toBe('retry');
    expect(result.retryAfterMs).toBe(15000);
  });

  test('returns failed when narrative is empty', async () => {
    const provider = new OpenAITextProvider({ apiKey: 'sk-test', fetchFn: jest.fn() });
    const result = await provider.generate(
      {},
      { canonicalNarrative: '  ', variantType: 'normal', language: 'sv' },
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('canonicalNarrative');
  });

  test('returns failed when API key is missing', async () => {
    const provider = new OpenAITextProvider({ apiKey: '', fetchFn: jest.fn() });
    const result = await provider.generate(
      {},
      { canonicalNarrative: 'Story', variantType: 'normal', language: 'sv' },
    );
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toContain('OPENAI_API_KEY');
  });

  test('returns retry when proactive rate limit exceeded', async () => {
    const fetchFn = mockFetch({
      body: {
        choices: [{ message: { content: 'A' }, finish_reason: 'stop' }],
      },
    });
    const provider = new OpenAITextProvider({ apiKey: 'sk-test', fetchFn, rpm: 1 });

    await provider.generate({}, { canonicalNarrative: 'A', variantType: 'quick', language: 'sv' });

    const result = await provider.generate(
      {},
      { canonicalNarrative: 'B', variantType: 'quick', language: 'sv' },
    );

    expect(result.status).toBe('retry');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  test('testConnection validates configured model', async () => {
    const fetchFn = mockFetch({ body: { id: 'gpt-4o-mini' } });
    const provider = new OpenAITextProvider({ apiKey: 'sk-test', model: 'gpt-4o-mini', fetchFn });

    const result = await provider.testConnection();

    expect(result).toEqual({ ok: true, model: 'gpt-4o-mini' });
    expect(fetchFn).toHaveBeenCalledWith(
      'https://api.openai.com/v1/models/gpt-4o-mini',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    );
  });
});
