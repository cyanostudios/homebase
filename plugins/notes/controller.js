// plugins/notes/controller.js
// Notes controller - handles HTTP requests for notes CRUD operations
class NoteController {
  constructor(model, pool) {
    this.model = model;
    this.pool = pool; // Need pool access for direct SQL queries
  }

  getUserId(req) {
    return req.session.currentTenantUserId || req.session.user.id;
  }

  async getAll(req, res) {
    try {
      const userId = this.getUserId(req);
      const notes = await this.model.getAll(req, userId);
  
      const parsedNotes = notes.map(note => {
        if (typeof note.mentions === 'string') {
          try {
            note.mentions = JSON.parse(note.mentions);
          } catch (e) {
            console.warn('Failed to parse mentions:', note.mentions);
            note.mentions = [];
          }
        }
        return note;
      });
  
      res.json(parsedNotes);
    } catch (error) {
      console.error('Get notes error:', error);
      res.status(500).json({ error: 'Failed to fetch notes' });
    }
  }

  async create(req, res) {
    try {
      const userId = this.getUserId(req);
      const note = await this.model.create(req, userId, req.body);
      res.json(note);
    } catch (error) {
      console.error('Create note error:', error);
      res.status(500).json({ error: 'Failed to create note' });
    }
  }

  async update(req, res) {
    try {
      const userId = this.getUserId(req);
      const note = await this.model.update(req, userId, req.params.id, req.body);
      res.json(note);
    } catch (error) {
      console.error('Update note error:', error);
      if (error.message === 'Note not found') {
        res.status(404).json({ error: 'Note not found' });
      } else {
        res.status(500).json({ error: 'Failed to update note' });
      }
    }
  }

  async delete(req, res) {
    try {
      const noteId = req.params.id;
      const userId = this.getUserId(req);
      
      // Get correct pool (tenant-specific or Railway)
      const pool = req.tenantPool || this.pool;
      
      // First, delete all tasks that were created from this note
      await pool.query(
        'DELETE FROM tasks WHERE created_from_note = $1 AND user_id = $2',
        [noteId, userId]
      );
      
      // Then delete the note
      await this.model.delete(req, userId, noteId);
      res.json({ message: 'Note deleted successfully' });
    } catch (error) {
      console.error('Delete note error:', error);
      if (error.message === 'Note not found') {
        res.status(404).json({ error: 'Note not found' });
      } else {
        res.status(500).json({ error: 'Failed to delete note' });
      }
    }
  }
}

module.exports = NoteController;