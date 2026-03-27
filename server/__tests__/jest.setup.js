// server/__tests__/jest.setup.js
// Test defaults: use local tenant provider unless a test overrides explicitly.

process.env.TENANT_PROVIDER = process.env.TENANT_PROVIDER || 'local';
delete process.env.NEON_API_KEY;
