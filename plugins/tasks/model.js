// plugins/tasks/model.js
// Tasks model - handles task CRUD operations with multi-tenant support
class TaskModel {
  constructor(pool) {
    this.defaultPool = pool;
  }

  getPool(req) {
    return req.tenantPool || this.defaultPool;
  }

  async getAll(req, userId) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map(this.transformRow);
  }

  async create(req, userId, taskData) {
    const pool = this.getPool(req);
    const { 
      title, 
      content, 
      mentions, 
      status, 
      priority, 
      due_date, 
      assigned_to, 
      created_from_note 
    } = taskData;
    
    console.log('Creating task with data:', { 
      assigned_to, 
      title, 
      userId 
    });
    
    const result = await pool.query(`
      INSERT INTO tasks (
        user_id, title, content, mentions, status, priority, 
        due_date, assigned_to, created_from_note, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      userId,
      title,
      content,
      JSON.stringify(mentions || []),
      status || 'not started',
      priority || 'Medium',
      due_date || null,
      assigned_to || null,
      created_from_note || null,
    ]);
    
    return this.transformRow(result.rows[0]);
  }

  async update(req, userId, taskId, taskData) {
    const pool = this.getPool(req);
    const { 
      title, 
      content, 
      mentions, 
      status, 
      priority, 
      due_date, 
      assigned_to 
    } = taskData;
    
    const result = await pool.query(`
      UPDATE tasks SET
        title = $1, content = $2, mentions = $3, status = $4, 
        priority = $5, due_date = $6, assigned_to = $7, updated_at = CURRENT_TIMESTAMP
      WHERE id = $8 AND user_id = $9
      RETURNING *
    `, [
      title,
      content,
      JSON.stringify(mentions || []),
      status,
      priority,
      due_date,
      assigned_to,
      taskId,
      userId,
    ]);
    
    if (!result.rows.length) {
      throw new Error('Task not found');
    }
    
    return this.transformRow(result.rows[0]);
  }

  async delete(req, userId, taskId) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [taskId, userId]
    );
    
    if (!result.rows.length) {
      throw new Error('Task not found');
    }
    
    return { id: taskId };
  }

  transformRow(row) {
    let mentions = row.mentions || [];
    if (typeof mentions === 'string') {
      try {
        mentions = JSON.parse(mentions);
      } catch (e) {
        console.warn('Failed to parse task mentions:', mentions);
        mentions = [];
      }
    }

    return {
      id: row.id.toString(),
      title: row.title,
      content: row.content || '',
      mentions: mentions,
      status: row.status || 'not started',
      priority: row.priority || 'Medium',
      due_date: row.due_date,
      assigned_to: row.assigned_to,
      created_from_note: row.created_from_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = TaskModel;