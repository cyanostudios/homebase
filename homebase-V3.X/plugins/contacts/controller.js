// plugins/contacts/controller.js
// Contacts controller - V3 with @homebase/core SDK
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class ContactController {
  constructor(model) {
    this.model = model;
  }

  async getAll(req, res) {
    try {
      const contacts = await this.model.getAll(req);
      res.json(contacts);
    } catch (error) {
      Logger.error('Get contacts failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  }

  async create(req, res) {
    try {
      const contact = await this.model.create(req, req.body);
      res.json(contact);
    } catch (error) {
      Logger.error('Create contact failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create contact' });
    }
  }

  async update(req, res) {
    try {
      const contact = await this.model.update(req, req.params.id, req.body);
      res.json(contact);
    } catch (error) {
      Logger.error('Update contact failed', error, {
        contactId: req.params.id,
        userId: req.session?.user?.id,
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update contact' });
    }
  }

  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      // Use model's bulkDelete which uses BulkOperationsHelper
      const result = await this.model.bulkDelete(req, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Bulk delete failed' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
      Logger.error('Delete contact failed', error, {
        contactId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to delete contact' });
    }
  }

  async getTimeEntries(req, res) {
    try {
      const entries = await this.model.getTimeEntries(req, req.params.id);
      res.json(entries);
    } catch (error) {
      Logger.error('Get time entries failed', error, {
        contactId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      return res.status(500).json({ error: 'Failed to fetch time entries' });
    }
  }

  async createTimeEntry(req, res) {
    try {
      const entry = await this.model.createTimeEntry(req, req.params.id, req.body);
      res.status(201).json(entry);
    } catch (error) {
      Logger.error('Create time entry failed', error, {
        contactId: req.params.id,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      return res.status(500).json({ error: 'Failed to create time entry' });
    }
  }

  async deleteTimeEntry(req, res) {
    try {
      await this.model.deleteTimeEntry(req, req.params.id, req.params.entryId);
      res.json({ message: 'Time entry deleted' });
    } catch (error) {
      Logger.error('Delete time entry failed', error, {
        contactId: req.params.id,
        entryId: req.params.entryId,
        userId: Context.getUserId(req),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      return res.status(500).json({ error: 'Failed to delete time entry' });
    }
  }
}

module.exports = ContactController;
