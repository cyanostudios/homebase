const { activityLogMiddleware } = require('./server/core/middleware/activityLog');
const ActivityLogService = require('./server/core/services/activity-log/ActivityLogService');

// Mock ServiceManager to avoid loading actual services
const ServiceManager = require('./server/core/ServiceManager');
ServiceManager.get = (name) => {
  if (name === 'logger') {
    return {
      error: (msg, err) => console.error('Logger Error:', msg, err),
      info: (msg) => console.log('Logger Info:', msg),
    };
  }
  return {};
};

// Mock Tenant Pool
const mockTenantPool = {
  query: async (sql, params) => {
    console.log('SQL Query:', sql);
    console.log('Params:', params);
    return { rows: [] };
  },
};

// Mock Request
const req = {
  method: 'POST',
  path: '/api/custom-plugins',
  session: {
    user: { id: 123 },
    tenantId: 'tenant-1',
  },
  tenantPool: mockTenantPool,
  headers: {
    'user-agent': 'test-agent',
  },
  get: (header) => 'test-agent', // Express get header
};

// Mock Response
const res = {
  statusCode: 201, // Created
  on: (event, callback) => {
    if (event === 'finish') {
      res.finishCallback = callback;
    }
  },
  json: (data) => {
    console.log('Response JSON called with:', data);
    // Simulate finish event immediately for testing
    if (res.finishCallback) res.finishCallback();
  },
};

const next = () => {
  console.log('Next called');
};

console.log('--- Starting Test ---');

// 1. Run Middleware
activityLogMiddleware(req, res, next);

// 2. Simulate Route Handler sending response
console.log('--- Simulating Route Handler ---');
res.json({
  id: 999,
  companyName: 'Test Company',
  email: 'test@example.com',
});

console.log('--- Test Complete ---');
