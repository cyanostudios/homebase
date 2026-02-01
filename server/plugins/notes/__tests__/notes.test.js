// server/plugins/notes/__tests__/notes.test.js
// Example plugin tests using Mock Adapters

const ServiceManager = require('../../../core/ServiceManager');
const MockDatabaseAdapter = require('../../../core/services/database/adapters/MockAdapter');
const MockLoggerAdapter = require('../../../core/services/logger/adapters/MockAdapter');
const NotesModel = require('../model');

describe('Notes Plugin - Model Tests', () => {
  let mockDb;
  let mockLogger;
  let notesModel;

  beforeEach(() => {
    // Create fresh mock instances
    mockDb = new MockDatabaseAdapter();
    mockLogger = new MockLoggerAdapter({ level: 'debug' });

    // Override services
    ServiceManager.override('database', mockDb);
    ServiceManager.override('logger', mockLogger);

    // Create model instance
    notesModel = new NotesModel();
  });

  afterEach(() => {
    // Reset ServiceManager and clear data
    ServiceManager.reset();
    mockDb.clear();
  });

  describe('createNote', () => {
    it('should create a note with valid data', async () => {
      const noteData = {
        title: 'Test Note',
        content: 'This is a test note',
        mentions: [],
      };

      const note = await notesModel.createNote(noteData);

      expect(note).toHaveProperty('id');
      expect(note.title).toBe('Test Note');
      expect(note.content).toBe('This is a test note');
      expect(note.created_at).toBeDefined();
    });

    it('should throw error on invalid data', async () => {
      await expect(notesModel.createNote({ title: '' })).rejects.toThrow();
    });
  });

  describe('getNote', () => {
    it('should retrieve a note by ID', async () => {
      const created = await notesModel.createNote({
        title: 'Test Note',
        content: 'Content',
      });

      const retrieved = await notesModel.getNote(created.id);

      expect(retrieved.id).toBe(created.id);
      expect(retrieved.title).toBe('Test Note');
    });

    it('should return null for non-existent note', async () => {
      const note = await notesModel.getNote('999');
      expect(note).toBeNull();
    });
  });

  describe('updateNote', () => {
    it('should update a note', async () => {
      const created = await notesModel.createNote({
        title: 'Original Title',
        content: 'Original Content',
      });

      const updated = await notesModel.updateNote(created.id, {
        title: 'Updated Title',
      });

      expect(updated.title).toBe('Updated Title');
      expect(updated.content).toBe('Original Content'); // Unchanged
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', async () => {
      const created = await notesModel.createNote({
        title: 'To Delete',
        content: 'Content',
      });

      await notesModel.deleteNote(created.id);

      const retrieved = await notesModel.getNote(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllNotes', () => {
    it('should retrieve all notes', async () => {
      await notesModel.createNote({ title: 'Note 1', content: 'Content 1' });
      await notesModel.createNote({ title: 'Note 2', content: 'Content 2' });
      await notesModel.createNote({ title: 'Note 3', content: 'Content 3' });

      const notes = await notesModel.getAllNotes();

      expect(notes).toHaveLength(3);
    });
  });
});
