// plugins/contacts/model.js
// Contacts model - V3 with @homebase/core SDK
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class ContactModel {
  constructor() {
    // No pool needed - SDK provides database interface
  }

  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic
      const result = await db.query('SELECT * FROM contacts ORDER BY contact_number', []);

      return result.rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch contacts', error);
      throw new AppError('Failed to fetch contacts', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getNextContactNumber(req) {
    try {
      const db = Database.get(req);

      const result = await db.query('SELECT COUNT(*) + 1 as next_number FROM contacts', []);

      return result.rows[0]?.next_number?.toString() || '1';
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to get next contact number', error);
      throw new AppError('Failed to get next contact number', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, contactData) {
    try {
      const db = Database.get(req);

      const contactNumber = contactData.contactNumber || (await this.getNextContactNumber(req));

      // Use db.insert for automatic tenant isolation
      const result = await db.insert('contacts', {
        contact_number: contactNumber,
        contact_type: contactData.contactType || '',
        company_name: contactData.companyName || '',
        company_type: contactData.companyType || '',
        organization_number: contactData.organizationNumber || '',
        vat_number: contactData.vatNumber || '',
        personal_number: contactData.personalNumber || '',
        contact_persons: JSON.stringify(contactData.contactPersons || []),
        addresses: JSON.stringify(contactData.addresses || []),
        email: contactData.email || '',
        phone: contactData.phone || '',
        phone2: contactData.phone2 || '',
        website: contactData.website || '',
        tax_rate: contactData.taxRate || '',
        payment_terms: contactData.paymentTerms || '',
        currency: contactData.currency || '',
        f_tax: contactData.fTax || '',
        notes: contactData.notes || '',
      });

      Logger.info('Contact created', { contactId: result.id });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create contact', error, {
        contactData: { companyName: contactData.companyName },
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create contact', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, contactId, contactData) {
    try {
      const db = Database.get(req);

      // Verify contact exists (ownership check automatic)
      const existing = await db.query('SELECT * FROM contacts WHERE id = $1', [contactId]);

      if (existing.rows.length === 0) {
        throw new AppError('Contact not found', 404, AppError.CODES.NOT_FOUND);
      }

      // Use db.update for automatic tenant isolation
      const result = await db.update('contacts', contactId, {
        contact_number: contactData.contactNumber,
        contact_type: contactData.contactType || '',
        company_name: contactData.companyName || '',
        company_type: contactData.companyType || '',
        organization_number: contactData.organizationNumber || '',
        vat_number: contactData.vatNumber || '',
        personal_number: contactData.personalNumber || '',
        contact_persons: JSON.stringify(contactData.contactPersons || []),
        addresses: JSON.stringify(contactData.addresses || []),
        email: contactData.email || '',
        phone: contactData.phone || '',
        phone2: contactData.phone2 || '',
        website: contactData.website || '',
        tax_rate: contactData.taxRate || '',
        payment_terms: contactData.paymentTerms || '',
        currency: contactData.currency || '',
        f_tax: contactData.fTax || '',
        notes: contactData.notes || '',
      });

      Logger.info('Contact updated', { contactId });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update contact', error, { contactId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update contact', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, contactId) {
    try {
      const db = Database.get(req);

      // Delete the contact (tenant isolation automatic)
      await db.deleteRecord('contacts', contactId);

      Logger.info('Contact deleted', { contactId });

      return { id: contactId };
    } catch (error) {
      Logger.error('Failed to delete contact', error, { contactId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete contact', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformRow(row) {
    // Parse JSON fields if they're strings
    let contactPersons = row.contact_persons || [];
    if (typeof contactPersons === 'string') {
      try {
        contactPersons = JSON.parse(contactPersons);
      } catch (e) {
        contactPersons = [];
      }
    }

    let addresses = row.addresses || [];
    if (typeof addresses === 'string') {
      try {
        addresses = JSON.parse(addresses);
      } catch (e) {
        addresses = [];
      }
    }

    return {
      id: row.id.toString(),
      contactNumber: row.contact_number,
      contactType: row.contact_type,
      companyName: row.company_name,
      companyType: row.company_type || '',
      organizationNumber: row.organization_number || '',
      vatNumber: row.vat_number || '',
      personalNumber: row.personal_number || '',
      contactPersons: contactPersons,
      addresses: addresses,
      email: row.email || '',
      phone: row.phone || '',
      phone2: row.phone2 || '',
      website: row.website || '',
      taxRate: row.tax_rate || '',
      paymentTerms: row.payment_terms || '',
      currency: row.currency || '',
      fTax: row.f_tax || '',
      notes: row.notes || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = ContactModel;
