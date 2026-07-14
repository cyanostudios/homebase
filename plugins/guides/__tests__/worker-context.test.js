// plugins/guides/__tests__/worker-context.test.js
const { createWorkerReq } = require('../production/workerContext');

describe('createWorkerReq', () => {
  test('builds tenant-scoped request for worker', () => {
    const pool = { query: jest.fn() };
    const req = createWorkerReq(pool, 42);

    expect(req.tenantPool).toBe(pool);
    expect(req.session.user.id).toBe(42);
    expect(req.session.currentTenantUserId).toBe(42);
  });
});
