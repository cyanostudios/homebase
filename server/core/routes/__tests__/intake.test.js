// server/core/routes/__tests__/intake.test.js
// Unit tests for CF7 intake webhook validation

const request = require('supertest');
const express = require('express');
const intakeRoutes = require('../intake');

describe('Intake inspection-request', () => {
  let app;
  let envBackup;

  beforeEach(() => {
    envBackup = {
      CF7_WEBHOOK_SECRET: process.env.CF7_WEBHOOK_SECRET,
      TENANT_PROVIDER: process.env.TENANT_PROVIDER,
      DATABASE_URL: process.env.DATABASE_URL,
    };
    process.env.CF7_WEBHOOK_SECRET = 'test-secret-123';
    process.env.TENANT_PROVIDER = 'local';
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/test';
    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/intake', intakeRoutes);
  });

  afterEach(() => {
    Object.assign(process.env, envBackup);
  });

  it('returns 401 without secret', async () => {
    const res = await request(app)
      .post('/api/intake/inspection-request')
      .send({ beteckning: 'TEST 1' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await request(app)
      .post('/api/intake/inspection-request')
      .set('x-webhook-secret', 'wrong')
      .send({ beteckning: 'TEST 1' });
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('returns 400 when beteckning is missing', async () => {
    const res = await request(app)
      .post('/api/intake/inspection-request')
      .set('x-webhook-secret', 'test-secret-123')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/beteckning|fastighetsbeteckning/);
    expect(res.body.traceId).toBeDefined();
  });

  it('returns 400 when beteckning is empty', async () => {
    const res = await request(app)
      .post('/api/intake/inspection-request')
      .set('x-webhook-secret', 'test-secret-123')
      .send({ beteckning: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/beteckning|fastighetsbeteckning/);
  });

  it('accepts beteckning as fastighetsbeteckning', async () => {
    const res = await request(app)
      .post('/api/intake/inspection-request')
      .set('x-webhook-secret', 'test-secret-123')
      .send({ beteckning: 'FRETTEN 7' });
    expect(res.status).not.toBe(400);
    expect(res.status).not.toBe(401);
  });

  it('accepts secret from body when header is missing', async () => {
    const res = await request(app)
      .post('/api/intake/inspection-request')
      .send({
        beteckning: 'TEST 2',
        webhook_secret: 'test-secret-123',
      });
    expect(res.status).not.toBe(401);
    expect(res.body.traceId).toBeDefined();
  });
});
