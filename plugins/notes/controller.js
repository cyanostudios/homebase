// plugins/notes/controller.js
class NoteController {
    constructor(model) {
      this.model = model;
    }
  
    async getAll(req, res) {
      try {
        const notes = await this.model.getAll(req.session.user.id);
        res.json(notes);
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
        await this.model.delete(req.session.user.id, req.params.id);
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