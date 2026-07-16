// plugins/guides/providers/shared/ProviderRateLimiter.js
/**
 * In-process token bucket rate limiter per provider key.
 * Shared across P-TEXT and future P-TRANS adapters.
 */
class ProviderRateLimiter {
  constructor() {
    /** @type {Map<string, { tokens: number, lastRefill: number, rpm: number }>} */
    this._buckets = new Map();
  }

  /**
   * @param {string} key — provider registry key, e.g. 'openai'
   * @param {number} [rpm] — requests per minute
   * @returns {{ allowed: true } | { allowed: false, retryAfterMs: number }}
   */
  tryAcquire(key, rpm = 60) {
    const normalized = String(key).toLowerCase();
    const now = Date.now();
    let bucket = this._buckets.get(normalized);

    if (!bucket) {
      bucket = { tokens: rpm, lastRefill: now, rpm };
      this._buckets.set(normalized, bucket);
    }

    const elapsed = now - bucket.lastRefill;
    if (elapsed >= 60_000) {
      bucket.tokens = bucket.rpm;
      bucket.lastRefill = now;
    } else if (elapsed > 0) {
      const refill = Math.floor((elapsed / 60_000) * bucket.rpm);
      if (refill > 0) {
        bucket.tokens = Math.min(bucket.rpm, bucket.tokens + refill);
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens <= 0) {
      return { allowed: false, retryAfterMs: Math.max(1000, 60_000 - elapsed) };
    }

    bucket.tokens -= 1;
    return { allowed: true };
  }

  /** Reset all buckets — for tests only. */
  _reset() {
    this._buckets.clear();
  }
}

module.exports = new ProviderRateLimiter();
