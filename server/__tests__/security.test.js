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
    const { RESOURCE_TASK, RESOURCE_NOTE } = require('../core/services/publicShareRouting');
    expect(RESOURCE_TASK).toBe('task');
    expect(RESOURCE_NOTE).toBe('note');
  });
});
