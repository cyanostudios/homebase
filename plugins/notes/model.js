// plugins/notes/model.js
class NoteModel {
    constructor(pool) {
      this.pool = pool;
    }
  
    async getAll(userId) {
      const result = await this.pool.query(
        'SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows.map(this.transformRow);
    }
  
    async create(userId, noteData) {
      const { title, content, mentions } = noteData;
      
      const result = await this.pool.query(`
        INSERT INTO notes (user_id, title, content, mentions)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        userId,
        title,
        content,
        JSON.stringify(mentions || []),
      ]);
      
      return this.transformRow(result.rows[0]);
    }
  
    async update(userId, noteId, noteData) {
      const { title, content, mentions } = noteData;
      
      const result = await this.pool.query(`
        UPDATE notes SET
          title = $1, content = $2, mentions = $3, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4 AND user_id = $5
        RETURNING *
      `, [
        title,
        content,
        JSON.stringify(mentions || []),
        noteId,
        userId,
      ]);
      
      if (!result.rows.length) {
        throw new Error('Note not found');
      }
      
      return this.transformRow(result.rows[0]);
    }
  
    async delete(userId, noteId) {
      const result = await this.pool.query(
        'DELETE FROM notes WHERE id = $1 AND user_id = $2 RETURNING id',
        [noteId, userId]
      );
      
      if (!result.rows.length) {
        throw new Error('Note not found');
      }
      
      return { id: noteId };
    }
  
    transformRow(row) {
      return {
        id: row.id.toString(),
        title: row.title,
        content: row.content || '',
        mentions: row.mentions || [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  }
  
  module.exports = NoteModel;