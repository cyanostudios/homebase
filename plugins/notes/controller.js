// plugins/notes/controller.js
class NoteController {
    constructor(model, pool) {
      this.model = model;
      this.pool = pool; // Need pool access for direct SQL queries
    }
  
    async getAll(req, res) {
        try {
          const notes = await this.model.getAll(req.session.user.id);
      
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
        const note = await this.model.create(req.session.user.id, req.body);
        res.json(note);
      } catch (error) {
        console.error('Create note error:', error);
        res.status(500).json({ error: 'Failed to create note' });
      }
    }
  
    async update(req, res) {
      try {
        const note = await this.model.update(
          req.session.user.id,
          req.params.id,
          req.body
        );
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
        const userId = req.session.user.id;
        
        // FIXED: Use PostgreSQL syntax ($1, $2) and correct column name
        // First, delete all tasks that were created from this note
        await this.pool.query(
          'DELETE FROM tasks WHERE created_from_note = $1 AND user_id = $2',
          [noteId, userId]
        );
        
        // Then delete the note
        await this.model.delete(userId, noteId);
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