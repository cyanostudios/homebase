// server/core/services/__tests__/MockAdapters.test.js
// Example tests using Mock Adapters

const ServiceManager = require('../../ServiceManager');
const MockDatabaseAdapter = require('../database/adapters/MockAdapter');
const MockLoggerAdapter = require('../logger/adapters/MockAdapter');
const AppError = require('../../errors/AppError');

describe('Mock Adapters', () => {
  let mockDb;
  let mockLogger;

  beforeEach(() => {
    // Create fresh mock instances
    mockDb = new MockDatabaseAdapter();
    mockLogger = new MockLoggerAdapter({ level: 'debug' });

    // Override services in ServiceManager
    ServiceManager.override('database', mockDb);
    ServiceManager.override('logger', mockLogger);
  });

  afterEach(() => {
    // Reset ServiceManager
    ServiceManager.reset();
  });

  describe('MockDatabaseAdapter', () => {
    it('should insert a record', async () => {
      const record = await mockDb.insert('contacts', {
        companyName: 'Test Company',
        email: 'test@example.com',
      });

      expect(record).toHaveProperty('id');
      expect(record.companyName).toBe('Test Company');
      expect(record.email).toBe('test@example.com');
      expect(record.created_at).toBeDefined();
    });

    it('should query inserted records', async () => {
      await mockDb.insert('contacts', { companyName: 'Company 1' });
      await mockDb.insert('contacts', { companyName: 'Company 2' });

      const results = await mockDb.query('SELECT * FROM contacts');
      expect(results).toHaveLength(2);
    });

    it('should update a record', async () => {
      const record = await mockDb.insert('contacts', {
        companyName: 'Original Name',
      });

      const updated = await mockDb.update('contacts', record.id, {
        companyName: 'Updated Name',
      });

      expect(updated.companyName).toBe('Updated Name');
      expect(updated.updated_at).toBeDefined();
    });

    it('should delete a record', async () => {
      const record = await mockDb.insert('contacts', {
        companyName: 'To Delete',
      });

      await mockDb.delete('contacts', record.id);

      const results = await mockDb.query('SELECT * FROM contacts WHERE id = $1', [record.id]);
      expect(results).toHaveLength(0);
    });

    it('should throw error when updating non-existent record', async () => {
      await expect(mockDb.update('contacts', '999', { companyName: 'Test' })).rejects.toThrow(
        AppError
      );
    });

    it('should support transactions', async () => {
      await mockDb.transaction(async (client) => {
        await client.insert('contacts', { companyName: 'Company 1' });
        await client.insert('contacts', { companyName: 'Company 2' });
      });

      const results = await mockDb.query('SELECT * FROM contacts');
      expect(results).toHaveLength(2);
    });

    it('should log queries', async () => {
      await mockDb.query('SELECT * FROM contacts');
      await mockDb.query('SELECT * FROM notes WHERE id = $1', ['123']);

      const log = mockDb.getQueryLog();
      expect(log).toHaveLength(2);
      expect(log[0].sql).toBe('SELECT * FROM contacts');
      expect(log[1].params).toEqual(['123']);
    });
  });

  describe('MockLoggerAdapter', () => {
    it('should log info messages', () => {
      mockLogger.info('Test message', { userId: '123' });

      const logs = mockLogger.getLogs('info');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Test message');
      expect(logs[0].context.userId).toBe('123');
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      mockLogger.error('Something went wrong', error, { userId: '123' });

      const logs = mockLogger.getLogs('error');
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Something went wrong');
      expect(logs[0].error).toBe(error);
    });

    it('should get last log entry', () => {
      mockLogger.info('First message');
      mockLogger.warn('Second message');
      mockLogger.error('Third message');

      const lastLog = mockLogger.getLastLog();
      expect(lastLog.message).toBe('Third message');
      expect(lastLog.level).toBe('error');
    });

    it('should clear logs', () => {
      mockLogger.info('Test message');
      mockLogger.clearLogs();

      expect(mockLogger.getLogs()).toHaveLength(0);
    });
  });
});
