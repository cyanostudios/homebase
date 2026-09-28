const express = require('express');
const request = require('supertest');

jest.mock('../../../server/core/middleware/csrf', () => ({
  csrfProtection: (_req, _res, next) => next(),
}));

jest.mock('../../../server/core/ServiceManager', () => ({
  get: jest.fn((name) => {
    if (name === 'database') {
      return {
        query: jest.fn(async () => []),
      };
    }
    if (name === 'logger') {
      return { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    }
    throw new Error(`unexpected ${name}`);
  }),
}));

const createTenantsRoutes = require('../routes');

describe('tenants routes allowlist', () => {
  function buildApp(sessionUser) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = {
        user: sessionUser,
        tenantOwnerUserId: sessionUser?.id,
      };
      next();
    });
    const controller = {
      list: (_req, res) => res.json({ tenants: [] }),
      get: (_req, res) => res.json({ tenant: { id: 1, plugins: [] } }),
      updatePlugins: (_req, res) => res.json({ tenant: { id: 1, plugins: [] } }),
    };
    app.use('/api/tenants', createTenantsRoutes(controller, {}));
    return app;
  }

  test('403 for non-allowlisted user', async () => {
    const app = buildApp({ id: 9, email: 'other@example.com', role: 'superuser' });
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(403);
  });

  test('200 for cyanostudios@gmail.com', async () => {
    const app = buildApp({ id: 1, email: 'cyanostudios@gmail.com', role: 'user' });
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tenants: [] });
  });

  test('403 for member even when tenantOwnerUserId is allowlisted owner', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.session = {
        user: { id: 99, email: 'member@example.com', role: 'user' },
        // Owner would be cyanostudios — must not grant admin to member
        tenantOwnerUserId: 1,
      };
      next();
    });
    const controller = {
      list: (_req, res) => res.json({ tenants: [] }),
      get: (_req, res) => res.json({ tenant: { id: 1, plugins: [] } }),
      updatePlugins: (_req, res) => res.json({ tenant: { id: 1, plugins: [] } }),
    };
    app.use('/api/tenants', createTenantsRoutes(controller, {}));
    const res = await request(app).get('/api/tenants');
    expect(res.status).toBe(403);
  });
});
