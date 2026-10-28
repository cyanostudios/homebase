const {
  CANCELLED_MESSAGE,
  cleanupJob,
  isCancelledError,
  registerJob,
  requestCancelByRunId,
  resetForTests,
  sleep,
  throwIfAborted,
} = require('../auditCancel');

describe('auditCancel registry', () => {
  afterEach(() => {
    resetForTests();
  });

  test('registerJob returns a live signal and abort reaches sleep', async () => {
    const signal = registerJob('job-1', [10, 11]);
    expect(signal.aborted).toBe(false);

    const pending = sleep(5_000, signal);
    const { aborted, runIds } = requestCancelByRunId(10);
    expect(aborted).toBe(true);
    expect(runIds).toEqual(['10', '11']);
    expect(signal.aborted).toBe(true);

    await expect(pending).rejects.toMatchObject({ code: 'CANCELLED', message: CANCELLED_MESSAGE });
  });

  test('throwIfAborted and isCancelledError', () => {
    const signal = registerJob('job-2', [20]);
    expect(() => throwIfAborted(signal)).not.toThrow();
    requestCancelByRunId(20);
    expect(() => throwIfAborted(signal)).toThrow();
    try {
      throwIfAborted(signal);
    } catch (error) {
      expect(isCancelledError(error)).toBe(true);
    }
    cleanupJob('job-2');
  });
});
