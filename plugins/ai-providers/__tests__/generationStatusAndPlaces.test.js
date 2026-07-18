const { calculateCost } = require('../CostCalculator');
const { mapHttpStatusToFailureCode, isRetryableFailureCode } = require('../generationFailureCodes');
const { AIProviderRouter } = require('../AIProviderRouter');

describe('CostCalculator', () => {
  test('computes estimated cost from catalog pricing', () => {
    const cost = calculateCost({
      providerKey: 'openai',
      model: 'gpt-4o-mini',
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
    });
    expect(cost).toEqual({
      currency: 'USD',
      inputCost: 0.15,
      outputCost: 0.6,
      totalCost: 0.75,
      estimated: true,
      pricingSource: 'catalog@2026-07',
    });
  });

  test('returns null when model has no pricing', () => {
    expect(
      calculateCost({
        providerKey: 'anthropic',
        model: 'claude-sonnet-4-5',
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    ).toBeNull();
  });
});

describe('generationFailureCodes', () => {
  test('maps HTTP statuses to stable codes', () => {
    expect(mapHttpStatusToFailureCode(401)).toBe('provider_auth_failed');
    expect(mapHttpStatusToFailureCode(402)).toBe('provider_quota_exhausted');
    expect(mapHttpStatusToFailureCode(429)).toBe('provider_rate_limited');
    expect(mapHttpStatusToFailureCode(429, 'insufficient_quota')).toBe('provider_quota_exhausted');
    expect(mapHttpStatusToFailureCode(503)).toBe('provider_unavailable');
    expect(mapHttpStatusToFailureCode(400)).toBe('provider_invalid_request');
  });

  test('identifies retryable codes', () => {
    expect(isRetryableFailureCode('provider_rate_limited')).toBe(true);
    expect(isRetryableFailureCode('provider_quota_exhausted')).toBe(false);
  });
});

describe('AIProviderRouter.checkReadiness', () => {
  test('returns not ready when resolve yields null', async () => {
    const settingsModel = {
      getRoutingForScope: jest.fn().mockResolvedValue(null),
      getPreferredEnabledProviderKey: jest.fn().mockResolvedValue(null),
      resolveRuntimeConfig: jest.fn(),
    };
    const router = new AIProviderRouter({ settingsModel });
    const result = await router.checkReadiness({}, { pluginKey: 'guides' });
    expect(result).toEqual({
      ready: false,
      failure: { code: 'provider_not_configured' },
    });
  });

  test('returns ready with providerKey and model when configured', async () => {
    const settingsModel = {
      getRoutingForScope: jest.fn().mockResolvedValue({
        scope: 'guides',
        providerKey: 'openai',
        model: 'gpt-4o-mini',
      }),
      getPreferredEnabledProviderKey: jest.fn(),
      resolveRuntimeConfig: jest.fn().mockResolvedValue({
        providerKey: 'openai',
        apiKey: 'sk-test',
        defaultModel: 'gpt-4o-mini',
      }),
    };
    const router = new AIProviderRouter({ settingsModel });
    const result = await router.checkReadiness({}, { pluginKey: 'guides' });
    expect(result).toEqual({
      ready: true,
      providerKey: 'openai',
      model: 'gpt-4o-mini',
    });
  });

  test('returns not ready when provider is not in generatable allow-list', async () => {
    const settingsModel = {
      getRoutingForScope: jest.fn().mockResolvedValue({
        scope: 'guides',
        providerKey: 'anthropic',
        model: 'claude-sonnet-4-5',
      }),
      getPreferredEnabledProviderKey: jest.fn(),
      resolveRuntimeConfig: jest.fn().mockResolvedValue({
        providerKey: 'anthropic',
        apiKey: 'sk-ant',
        defaultModel: 'claude-sonnet-4-5',
      }),
    };
    const router = new AIProviderRouter({ settingsModel });
    const result = await router.checkReadiness(
      {},
      { pluginKey: 'guides', generatableProviderKeys: ['openai'] },
    );
    expect(result).toEqual({
      ready: false,
      providerKey: 'anthropic',
      model: 'claude-sonnet-4-5',
      failure: { code: 'provider_not_generation_capable' },
    });
  });
});
