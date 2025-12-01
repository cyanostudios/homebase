// plugins/contacts/controller.js
class ContactController {
  constructor(model) {
    this.model = model;
  }

  getUserId(req) {
    // Use currentTenantUserId if admin has switched, otherwise use logged-in user
    return req.session.currentTenantUserId || req.session.user.id;
  }

  async getAll(req, res) {
    try {
      const userId = this.getUserId(req);
      const contacts = await this.model.getAll(req, userId);
      res.json(contacts);
    } catch (error) {
      console.error('Get contacts error:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  }

  async create(req, res) {
    try {
      const userId = this.getUserId(req);
      const contact = await this.model.create(req, userId, req.body);
      res.json(contact);
    } catch (error) {
      console.error('Create contact error:', error);
      res.status(500).json({ error: 'Failed to create contact' });
    }
  }

  async update(req, res) {
    try {
      const userId = this.getUserId(req);
      const contact = await this.model.update(
        req,
        userId,
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
      const userId = this.getUserId(req);
      await this.model.delete(req, userId, req.params.id);
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