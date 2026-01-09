// plugins/contacts/controller.js
// Contacts controller - V2 with ServiceManager
const ServiceManager = require('../../server/core/ServiceManager');
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
      const logger = ServiceManager.get('logger');
      logger.error('Get contacts failed', error, { userId: req.session?.user?.id });
      
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
      const logger = ServiceManager.get('logger');
      logger.error('Create contact failed', error, { userId: req.session?.user?.id });
      
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
      const logger = ServiceManager.get('logger');
      logger.error('Update contact failed', error, { 
        contactId: req.params.id,
        userId: req.session?.user?.id 
      });
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      
      res.status(500).json({ error: 'Failed to update contact' });
    }
  }

  async delete(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Contact deleted successfully' });
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Delete contact failed', error, { 
        contactId: req.params.id,
        userId: req.session?.user?.id 
      });
      
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  }
}

module.exports = ContactController;
