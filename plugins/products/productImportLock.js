// plugins/products/productImportLock.js
// Ref-count Excel/CSV import per tenant so batch sync can wait or reject while import runs.

const counts = new Map();

/** @type {((tenantId: string) => void) | null} */
let idleCallback = null;

function setIdleCallback(fn) {
  idleCallback = typeof fn === 'function' ? fn : null;
}

function begin(tenantId) {
  const tid = String(tenantId ?? '').trim();
  if (!tid) return;
  counts.set(tid, (counts.get(tid) || 0) + 1);
}

function end(tenantId) {
  const tid = String(tenantId ?? '').trim();
  if (!tid) return;
  const n = (counts.get(tid) || 0) - 1;
  if (n <= 0) {
    counts.delete(tid);
    if (idleCallback) {
      setImmediate(() => {
        try {
          idleCallback(tid);
        } catch (_) {
          /* ignore */
        }
      });
    }
  } else {
    counts.set(tid, n);
  }
}

function isActive(tenantId) {
  const tid = String(tenantId ?? '').trim();
  return tid ? (counts.get(tid) || 0) > 0 : false;
}

module.exports = {
  begin,
  end,
  isActive,
  setIdleCallback,
};
