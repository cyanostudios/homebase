// plugins/guides/__tests__/provider-rate-limiter.test.js
const ProviderRateLimiter = require('../providers/shared/ProviderRateLimiter');

describe('ProviderRateLimiter', () => {
  beforeEach(() => {
    ProviderRateLimiter._reset();
  });

  test('allows requests up to rpm limit', () => {
    for (let i = 0; i < 5; i += 1) {
      const result = ProviderRateLimiter.tryAcquire('openai', 5);
      expect(result.allowed).toBe(true);
    }
    const blocked = ProviderRateLimiter.tryAcquire('openai', 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  test('tracks buckets per provider key independently', () => {
    ProviderRateLimiter.tryAcquire('openai', 1);
    const openaiBlocked = ProviderRateLimiter.tryAcquire('openai', 1);
    const noopAllowed = ProviderRateLimiter.tryAcquire('noop', 1);
    expect(openaiBlocked.allowed).toBe(false);
    expect(noopAllowed.allowed).toBe(true);
  });
});
