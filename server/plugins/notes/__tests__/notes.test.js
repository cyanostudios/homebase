// server/plugins/notes/__tests__/notes.test.js
// Example plugin tests using Mock Adapters
// Uses model API: create(req, data), getAll(req), update(req, id, data), delete(req, id)
// Requires TENANT_PROVIDER=local so ServiceManager can initialize without NEON_API_KEY

process.env.TENANT_PROVIDER = 'local';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/test';

const ServiceManager = require('../../../core/ServiceManager');
const MockDatabaseAdapter = require('../../../core/services/database/adapters/MockAdapter');
const MockLoggerAdapter = require('../../../core/services/logger/adapters/MockAdapter');
const NotesModel = require('../../../../plugins/notes/model');

const mockReq = { session: { user: { id: 1 } } };
const ENV_KEYS = ['TENANT_PROVIDER', 'DATABASE_URL'];

describe('Notes Plugin - Model Tests', () => {
  let mockDb;
  let mockLogger;
  let notesModel;
  let savedEnv;

  beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) {
      if (process.env[k] !== undefined) savedEnv[k] = process.env[k];
    }
    process.env.TENANT_PROVIDER = 'local';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    ServiceManager.reset();
    mockDb = new MockDatabaseAdapter();
    mockLogger = new MockLoggerAdapter({ level: 'debug' });
    ServiceManager.override('database', mockDb);
    ServiceManager.override('logger', mockLogger);
    notesModel = new NotesModel();
  });

  afterEach(() => {
    ServiceManager.reset();
    mockDb.clear();
    for (const k of ENV_KEYS) {
      if (savedEnv[k] !== undefined) process.env[k] = savedEnv[k];
      else delete process.env[k];
    }
  });

  describe('create', () => {
    it('should create a note with valid data', async () => {
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note',
        mentions: [],
      };

      const note = await notesModel.create(mockReq, noteData);

      expect(note).toHaveProperty('id');
      expect(note.title).toBe('Test Note');
      expect(note.content).toBe('This is a test note');
      expect(note.createdAt).toBeDefined();
    });

    it('accepts empty title (model does not validate)', async () => {
      const note = await notesModel.create(mockReq, { title: '' });
      expect(note).toHaveProperty('id');
      expect(note.title).toBe('');
    });
  });

  describe('getAll', () => {
    it('should retrieve a note by ID via getAll', async () => {
      const created = await notesModel.create(mockReq, {
        title: 'Test Note',
        content: 'Content',
      });

      const all = await notesModel.getAll(mockReq);
      const retrieved = all.find((n) => n.id === created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Test Note');
    });

    it('should return empty array when no notes', async () => {
      const notes = await notesModel.getAll(mockReq);
      expect(notes).toEqual([]);
    });
  });

  describe('update', () => {
    it('should update a note', async () => {
      const created = await notesModel.create(mockReq, {
        title: 'Original Title',
        content: 'Original Content',
      });

      const updated = await notesModel.update(mockReq, created.id, {
        title: 'Updated Title',
        content: 'Original Content',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Original Content');
    });
  });

  describe('delete', () => {
    it('should delete a note', async () => {
      const created = await notesModel.create(mockReq, {
        title: 'To Delete',
        content: 'Content',
      });

      await notesModel.delete(mockReq, created.id);

      const all = await notesModel.getAll(mockReq);
      const found = all.find((n) => n.id === created.id);
      expect(found).toBeUndefined();
    });
  });

  describe('getAll multiple', () => {
    it('should retrieve all notes', async () => {
      await notesModel.create(mockReq, { title: 'Note 1', content: 'Content 1' });
      await notesModel.create(mockReq, { title: 'Note 2', content: 'Content 2' });
      await notesModel.create(mockReq, { title: 'Note 3', content: 'Content 3' });

      const notes = await notesModel.getAll(mockReq);
      expect(notes).toHaveLength(3);
    });
  });
});
