// plugins/contacts/controller.js
class ContactController {
    constructor(model) {
      this.model = model;
    }
  
    async getAll(req, res) {
      try {
        const contacts = await this.model.getAll(req.session.user.id);
        res.json(contacts);
      } catch (error) {
        console.error('Get contacts error:', error);
        res.status(500).json({ error: 'Failed to fetch contacts' });
      }
    }
  
    async create(req, res) {
      try {
        const contact = await this.model.create(req.session.user.id, req.body);
        res.json(contact);
      } catch (error) {
        console.error('Create contact error:', error);
        res.status(500).json({ error: 'Failed to create contact' });
      }
    }
  
    async update(req, res) {
      try {
        const contact = await this.model.update(
          req.session.user.id,
          req.params.id,
          req.body
        );
        res.json(contact);
      } catch (error) {
        console.error('Update contact error:', error);
        if (error.message === 'Contact not found') {
          res.status(404).json({ error: 'Contact not found' });
        } else {
          res.status(500).json({ error: 'Failed to update contact' });
        }
      }
    }
  
    async delete(req, res) {
      try {
        await this.model.delete(req.session.user.id, req.params.id);
        res.json({ message: 'Contact deleted successfully' });
      } catch (error) {
        console.error('Delete contact error:', error);
        if (error.message === 'Contact not found') {
          res.status(404).json({ error: 'Contact not found' });
        } else {
          res.status(500).json({ error: 'Failed to delete contact' });
        }
      }
    }
  }
  
  module.exports = ContactController;