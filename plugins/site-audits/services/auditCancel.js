// In-process cancel registry for fire-and-forget audit jobs (single Node process).
const CANCELLED_MESSAGE = 'Cancelled by user';

/** @type {Map<string, AbortController>} */
const controllersByJobId = new Map();
/** @type {Map<string, string>} runId -> jobId */
const jobIdByRunId = new Map();
/** @type {Map<string, string[]>} jobId -> runIds */
const runIdsByJobId = new Map();

function cancelledError() {
  const err = new Error(CANCELLED_MESSAGE);
  err.name = 'AuditCancelledError';
  err.code = 'CANCELLED';
  return err;
}

function isCancelledError(error) {
  return (
    error?.code === 'CANCELLED' ||
    error?.name === 'AuditCancelledError' ||
    (typeof error?.message === 'string' && error.message === CANCELLED_MESSAGE)
  );
}

/**
 * @param {string} jobId
 * @param {Array<string|number>} runIds
 * @returns {AbortSignal}
 */
function registerJob(jobId, runIds) {
  const existing = controllersByJobId.get(jobId);
  if (existing) {
    return existing.signal;
  }
  const controller = new AbortController();
  controllersByJobId.set(jobId, controller);
  const ids = (Array.isArray(runIds) ? runIds : [])
    .filter((id) => id != null && id !== '')
    .map((id) => String(id));
  runIdsByJobId.set(jobId, ids);
  for (const id of ids) {
    jobIdByRunId.set(id, jobId);
  }
  return controller.signal;
}

/**
 * @param {string|number} runId
 * @returns {{ aborted: boolean, jobId: string|null, runIds: string[] }}
 */
function requestCancelByRunId(runId) {
  const key = String(runId);
  const jobId = jobIdByRunId.get(key) || null;
  if (!jobId) {
    return { aborted: false, jobId: null, runIds: [key] };
  }
  const controller = controllersByJobId.get(jobId);
  if (controller && !controller.signal.aborted) {
    controller.abort();
  }
  return {
    aborted: true,
    jobId,
    runIds: runIdsByJobId.get(jobId) || [key],
  };
}

/**
 * @param {string} jobId
 */
function cleanupJob(jobId) {
  const ids = runIdsByJobId.get(jobId) || [];
  for (const id of ids) {
    jobIdByRunId.delete(id);
  }
  runIdsByJobId.delete(jobId);
  controllersByJobId.delete(jobId);
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw cancelledError();
  }
}

/**
 * Abort-aware sleep used between crawl fetches.
 * @param {number} ms
 * @param {AbortSignal} [signal]
 */
function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(cancelledError());
      return;
    }
    const timer = setTimeout(() => {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(cancelledError());
    };
    if (signal) {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

function resetForTests() {
  controllersByJobId.clear();
  jobIdByRunId.clear();
  runIdsByJobId.clear();
}

module.exports = {
  CANCELLED_MESSAGE,
  cancelledError,
  isCancelledError,
  registerJob,
  requestCancelByRunId,
  cleanupJob,
  throwIfAborted,
  sleep,
  resetForTests,
};
