// plugins/products/batchSyncStarterQueue.js
// Serializes batch sync starters per tenant: waits while import runs or another batch holds the mutex.

const productImportLock = require('./productImportLock');
const batchSyncMutex = require('./batchSyncMutex');

/** @type {Map<string, Array<() => void>>} */
const queues = new Map();

let importHooked = false;

function hookImportIdle() {
  if (importHooked) return;
  importHooked = true;
  productImportLock.setIdleCallback((tenantId) => {
    tryDrain(String(tenantId ?? '').trim());
  });
}

/**
 * @param {string|number} tenantId
 * @param {() => void} starter sync callback — must acquire mutex and schedule runBatchSyncJob
 */
function enqueue(tenantId, starter) {
  const tid = String(tenantId ?? '').trim();
  if (!tid) return;
  hookImportIdle();
  const q = queues.get(tid) || [];
  q.push(starter);
  queues.set(tid, q);
  tryDrain(tid);
}

function tryDrain(tenantId) {
  const tid = String(tenantId ?? '').trim();
  if (!tid) return;
  if (productImportLock.isActive(tid)) return;
  if (batchSyncMutex.getActiveJobId(tid)) return;
  const q = queues.get(tid);
  if (!q || q.length === 0) return;
  const starter = q.shift();
  if (q.length === 0) queues.delete(tid);
  else queues.set(tid, q);
  try {
    starter();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('batchSyncStarterQueue starter failed', e);
  }
}

/** Call after batch job releases mutex (import queue + stacked batch requests). */
function onBatchFinished(tenantId) {
  tryDrain(String(tenantId ?? '').trim());
}

module.exports = {
  enqueue,
  tryDrain,
  onBatchFinished,
};
