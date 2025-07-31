// plugins/tasks/controller.js
class TaskController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const tasks = await this.model.getAll(req.session.user.id);
      res.json(tasks);
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({ error: 'Failed to fetch tasks' });
    }
  }

  async create(req, res) {
    try {
      const task = await this.model.create(req.session.user.id, req.body);
      res.json(task);
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }

  async update(req, res) {
    try {
      const task = await this.model.update(
        req.session.user.id,
        req.params.id,
        req.body
      );
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
      await this.model.delete(req.session.user.id, req.params.id);
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