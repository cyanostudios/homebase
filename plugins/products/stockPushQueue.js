// plugins/products/stockPushQueue.js
// Per-tenant FIFO: all batch-queued stock work runs before order-queued work (plan 6.3).

const { Logger } = require('@homebase/core');

/** @typedef {() => Promise<void>} StockPushFn */

function getTenantState(tenantId) {
  const tid = String(tenantId ?? '').trim();
  if (!tid) {
    throw new Error('stockPushQueue: tenantId required');
  }
  if (!getTenantState._map.has(tid)) {
    getTenantState._map.set(tid, { batchQ: [], orderQ: [], draining: null });
  }
  return getTenantState._map.get(tid);
}
getTenantState._map = new Map();

async function drainTenant(tenantId) {
  const s = getTenantState(tenantId);
  if (s.draining) {
    return s.draining;
  }
  s.draining = (async () => {
    try {
      while (s.batchQ.length > 0 || s.orderQ.length > 0) {
        const fn = s.batchQ.length > 0 ? s.batchQ.shift() : s.orderQ.shift();
        if (!fn) continue;
        try {
          await fn();
          // Yield a microtask so synchronous enqueue* calls in the same stack
          // run before we decide the queues are empty (avoids finishing drain too early).
          await Promise.resolve();
        } catch (err) {
          Logger.warn('stockPushQueue: push failed', err, { tenantId });
        }
      }
    } finally {
      s.draining = null;
    }
  })();
  return s.draining;
}

/**
 * @param {string|number} tenantId
 * @param {StockPushFn} fn
 * @returns {Promise<void>}
 */
function enqueueBatch(tenantId, fn) {
  return new Promise((resolve, reject) => {
    const s = getTenantState(tenantId);
    s.batchQ.push(() => fn().then(resolve, reject));
    void drainTenant(tenantId);
  });
}

/**
 * @param {string|number} tenantId
 * @param {StockPushFn} fn
 * @returns {Promise<void>}
 */
function enqueueOrder(tenantId, fn) {
  return new Promise((resolve, reject) => {
    const s = getTenantState(tenantId);
    s.orderQ.push(() => fn().then(resolve, reject));
    void drainTenant(tenantId);
  });
}

module.exports = {
  enqueueBatch,
  enqueueOrder,
};
