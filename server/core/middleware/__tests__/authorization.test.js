// server/core/middleware/__tests__/authorization.test.js
// Regression: requireTenantRole hierarchy and superuser bypass

const { requireTenantRole } = require('../authorization');

function mockReq(session = {}) {
  return {
    session: session,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('requireTenantRole', () => {
  test('throws if allowedRoles is not a non-empty array', () => {
    expect(() => requireTenantRole()).toThrow('allowedRoles must be a non-empty array');
    expect(() => requireTenantRole([])).toThrow('allowedRoles must be a non-empty array');
    expect(() => requireTenantRole('admin')).toThrow();
  });

  test('throws if role is invalid', () => {
    expect(() => requireTenantRole(['invalid'])).toThrow('invalid role');
  });

  test('returns 401 when no session or user', async () => {
    const middleware = requireTenantRole(['admin']);
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });

  test('superuser bypass: next() regardless of tenantRole', async () => {
    const middleware = requireTenantRole(['admin']);
    const req = mockReq({ user: { id: 1, role: 'superuser' }, tenantRole: 'user' });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("tenant admin passes for requireTenantRole(['admin'])", async () => {
    const middleware = requireTenantRole(['admin']);
    const req = mockReq({ user: { id: 1, role: 'user' }, tenantRole: 'admin' });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("tenant user fails for requireTenantRole(['admin'])", async () => {
    const middleware = requireTenantRole(['admin']);
    const req = mockReq({ user: { id: 1, role: 'user' }, tenantRole: 'user' });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden: insufficient tenant role',
      required: ['admin'],
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("tenant editor passes for requireTenantRole(['editor', 'admin'])", async () => {
    const middleware = requireTenantRole(['editor', 'admin']);
    const req = mockReq({ user: { id: 1 }, tenantRole: 'editor' });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test("tenant user passes for requireTenantRole(['user'])", async () => {
    const middleware = requireTenantRole(['user']);
    const req = mockReq({ user: { id: 1 }, tenantRole: 'user' });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('missing tenantRole defaults to user', async () => {
    const middleware = requireTenantRole(['admin']);
    const req = mockReq({ user: { id: 1 }, tenantRole: undefined });
    const res = mockRes();
    const next = jest.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
