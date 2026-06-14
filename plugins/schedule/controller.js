class ScheduleController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res, next) {
    try {
      const schedules = await this.model.getAll(req);
      res.json(schedules);
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const schedule = await this.model.getById(req, req.params.id);
      res.json(schedule);
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const schedule = await this.model.create(req, req.body);
      res.json(schedule);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const schedule = await this.model.update(req, req.params.id, req.body);
      res.json(schedule);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async createEvent(req, res, next) {
    try {
      const event = await this.model.createEvent(req, req.params.scheduleId, req.body);
      res.json(event);
    } catch (error) {
      next(error);
    }
  }

  async updateEvent(req, res, next) {
    try {
      const event = await this.model.updateEvent(
        req,
        req.params.scheduleId,
        req.params.eventId,
        req.body,
      );
      res.json(event);
    } catch (error) {
      next(error);
    }
  }

  async deleteEvent(req, res, next) {
    try {
      await this.model.deleteEvent(req, req.params.scheduleId, req.params.eventId);
      res.json({ deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = ScheduleController;
