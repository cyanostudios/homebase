# Testing with Mock Adapters

This directory contains mock adapters and example tests for the V2 core services.

## Mock Adapters

### MockDatabaseAdapter

A simple in-memory database adapter for testing. It supports:

- Basic CRUD operations (insert, update, delete, query)
- Transactions
- Query logging for testing
- Auto-increment IDs
- Automatic timestamps

### MockLoggerAdapter

A logger adapter that stores all log messages in memory for testing. It supports:

- All log levels (info, warn, error, debug)
- Log retrieval and filtering
- Log clearing

## Usage Example

```javascript
const ServiceManager = require('../../ServiceManager');
const MockDatabaseAdapter = require('../database/adapters/MockAdapter');
const MockLoggerAdapter = require('../logger/adapters/MockAdapter');

describe('My Plugin Tests', () => {
  let mockDb;
  let mockLogger;

  beforeEach(() => {
    // Create fresh mock instances
    mockDb = new MockDatabaseAdapter();
    mockLogger = new MockLoggerAdapter({ level: 'debug' });

    // Override services
    ServiceManager.override('database', mockDb);
    ServiceManager.override('logger', mockLogger);
  });

  afterEach(() => {
    // Reset ServiceManager
    ServiceManager.reset();
    mockDb.clear();
  });

  it('should create an item', async () => {
    const item = await mockDb.insert('items', {
      title: 'Test Item',
      content: 'Test Content',
    });

    expect(item).toHaveProperty('id');
    expect(item.title).toBe('Test Item');
  });
});
```

## Benefits

✅ **No database setup required** - Tests run in-memory
✅ **Fast execution** - No I/O operations
✅ **Isolated tests** - Each test gets a fresh database
✅ **Query logging** - Inspect what queries were executed
✅ **Easy debugging** - Check logs and data state

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```
