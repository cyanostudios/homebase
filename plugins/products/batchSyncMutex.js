// plugins/products/batchSyncMutex.js
// At most one active batch sync job per tenant until channel phase completes.

const active = new Map(); // tenantId -> jobId

function acquire(tenantId, jobId) {
  const tid = String(tenantId ?? '').trim();
  const jid = String(jobId ?? '').trim();
  if (!tid || !jid) return false;
  if (active.has(tid)) {
    return false;
  }
  active.set(tid, jid);
  return true;
}

function releaseIfMatches(tenantId, jobId) {
  const tid = String(tenantId ?? '').trim();
  const jid = String(jobId ?? '').trim();
  if (active.get(tid) === jid) {
    active.delete(tid);
  }
}

function getActiveJobId(tenantId) {
  const tid = String(tenantId ?? '').trim();
  return active.get(tid) || null;
}

module.exports = {
  acquire,
  releaseIfMatches,
  getActiveJobId,
};
