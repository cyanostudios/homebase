const TTL_MS_DEFAULT = 30000;

class AnalyticsCache {
  constructor() {
    this.store = new Map();
  }

  buildKey(userId, endpointName, payload) {
    return `${userId}:${endpointName}:${JSON.stringify(payload || {})}`;
  }

  get(key) {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlMs = TTL_MS_DEFAULT) {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidateUser(userId) {
    const prefix = `${userId}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

module.exports = new AnalyticsCache();
