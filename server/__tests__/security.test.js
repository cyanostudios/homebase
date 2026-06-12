// server/__tests__/security.test.js
// Regression tests for rate-limit env toggles, CSRF no-op mode, and public-share routing constants.

const express = require('express');
const request = require('supertest');

describe('Security: rate limiting env', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  it('enforceRateLimits is false in development without FORCE_RATE_LIMIT', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.FORCE_RATE_LIMIT;
    jest.resetModules();
    const { enforceRateLimits } = require('../core/middleware/rateLimit');
    expect(enforceRateLimits).toBe(false);
  });

  it('enforceRateLimits is true when FORCE_RATE_LIMIT=1 in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.FORCE_RATE_LIMIT = '1';
    jest.resetModules();
    const { enforceRateLimits } = require('../core/middleware/rateLimit');
    expect(enforceRateLimits).toBe(true);
  });

  it('enforceRateLimits is true in production without FORCE_RATE_LIMIT', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.FORCE_RATE_LIMIT;
    jest.resetModules();
    const { enforceRateLimits } = require('../core/middleware/rateLimit');
    expect(enforceRateLimits).toBe(true);
  });

  it('express-rate-limit returns 429 after max (smoke)', async () => {
    const rateLimit = require('express-rate-limit');
    const limiter = rateLimit({
      windowMs: 60_000,
      max: 2,
      skip: () => false,
      standardHeaders: true,
      legacyHeaders: false,
    });
    const app = express();
    app.set('trust proxy', 1);
    app.use(limiter);
    app.get('/t', (_req, res) => res.sendStatus(200));
    await request(app).get('/t').expect(200);
    await request(app).get('/t').expect(200);
    await request(app).get('/t').expect(429);
  });
});

describe('Security: CSRF middleware', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    jest.resetModules();
  });

  it('csrfProtection invokes next when ENABLE_CSRF is not true', (done) => {
    delete process.env.ENABLE_CSRF;
    jest.resetModules();
    const { csrfProtection } = require('../core/middleware/csrf');
    csrfProtection({}, {}, () => done());
  });

  it('csrfProtection issues a token when ENABLE_CSRF is true (session mode)', async () => {
    process.env.ENABLE_CSRF = 'true';
    jest.resetModules();
    const express = require('express');
    const session = require('express-session');
    const { csrfProtection, csrfTokenHandler } = require('../core/middleware/csrf');
    const app = express();
    app.use(
      session({
        secret: 'test-csrf-session-secret-32chars',
        resave: false,
        saveUninitialized: true,
      }),
    );
    app.get('/api/csrf-token', csrfProtection, csrfTokenHandler);
    const res = await request(app).get('/api/csrf-token').expect(200);
    expect(typeof res.body.csrfToken).toBe('string');
    expect(res.body.csrfToken).not.toBe('csrf-disabled');
  });

  it('csrfTokenHandler returns csrf-disabled when CSRF off', () => {
    return new Promise((resolve, reject) => {
      delete process.env.ENABLE_CSRF;
      jest.resetModules();
      const { csrfTokenHandler } = require('../core/middleware/csrf');
      const req = {};
      const res = {
        json(body) {
          try {
            expect(body.csrfToken).toBe('csrf-disabled');
            resolve();
          } catch (e) {
            reject(e);
          }
        },
      };
      csrfTokenHandler(req, res, (err) => {
        if (err) reject(err);
      });
    });
  });
});

describe('Security: public share routing module', () => {
  it('exports resource type constants', () => {
    const {
      RESOURCE_TASK,
      RESOURCE_NOTE,
      RESOURCE_ESTIMATE,
      RESOURCE_INVOICE,
    } = require('../core/services/publicShareRouting');
    expect(RESOURCE_TASK).toBe('task');
    expect(RESOURCE_NOTE).toBe('note');
    expect(RESOURCE_ESTIMATE).toBe('estimate');
    expect(RESOURCE_INVOICE).toBe('invoice');
  });
});
