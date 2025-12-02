// plugins/tasks/controller.js
// Tasks controller - handles HTTP requests for tasks CRUD operations
class TaskController {
  constructor(model) {
    this.model = model;
  }

  getUserId(req) {
    return req.session.currentTenantUserId || req.session.user.id;
  }

  async getAll(req, res) {
    try {
      const userId = this.getUserId(req);
      const tasks = await this.model.getAll(req, userId);
      res.json(tasks);
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  async create(req, res) {
    try {
      const userId = this.getUserId(req);
      const task = await this.model.create(req, userId, req.body);
      res.json(task);
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  async update(req, res) {
    try {
      const userId = this.getUserId(req);
      const task = await this.model.update(req, userId, req.params.id, req.body);
      res.json(task);
    } catch (error) {
      console.error('Update task error:', error);
      if (error.message === 'Task not found') {
        res.status(404).json({ error: 'Task not found' });
      } else {
        res.status(500).json({ error: 'Failed to update task' });
      }
    }
  }

  async delete(req, res) {
    try {
      const userId = this.getUserId(req);
      await this.model.delete(req, userId, req.params.id);
      res.json({ message: 'Task deleted successfully' });
    } catch (error) {
      console.error('Delete task error:', error);
      if (error.message === 'Task not found') {
        res.status(404).json({ error: 'Task not found' });
      } else {
        res.status(500).json({ error: 'Failed to delete task' });
      }
    }
  }
}

module.exports = TaskController;