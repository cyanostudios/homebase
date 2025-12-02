// plugins/notes/model.js
// Notes model - handles note CRUD operations with multi-tenant support
class NoteModel {
  constructor(pool) {
    this.defaultPool = pool;
  }

  getPool(req) {
    return req.tenantPool || this.defaultPool;
  }

  async getAll(req, userId) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'SELECT * FROM notes WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map(this.transformRow);
  }

  async create(req, userId, noteData) {
    const pool = this.getPool(req);
    const { title, content, mentions } = noteData;
    
    const result = await pool.query(`
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

  async update(req, userId, noteId, noteData) {
    const pool = this.getPool(req);
    const { title, content, mentions } = noteData;
    
    const result = await pool.query(`
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

  async delete(req, userId, noteId) {
    const pool = this.getPool(req);
    const result = await pool.query(
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