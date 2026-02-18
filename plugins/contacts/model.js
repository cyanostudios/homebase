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
      const rows = await db.query('SELECT * FROM contacts ORDER BY contact_number', []);

      return rows.map(this.transformRow);
    } catch (error) {
      Logger.error('Failed to fetch contacts', error);
      throw new AppError('Failed to fetch contacts', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getNextContactNumber(req) {
    try {
      const db = Database.get(req);

      const rows = await db.query('SELECT COUNT(*) + 1 as next_number FROM contacts', []);

      return rows[0]?.next_number?.toString() || '1';
    } catch (error) {
      Logger.error('Failed to get next contact number', error);
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

      if (!existing || existing.length === 0) {
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

  async bulkDelete(req, idsTextArray) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'contacts', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete contacts', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete contacts', 500, AppError.CODES.DATABASE_ERROR);
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

  async getTimeEntries(req, contactId) {
    try {
      const db = Database.get(req);

      const rows = await db.query(
        'SELECT * FROM contact_time_entries WHERE contact_id = $1 ORDER BY logged_at DESC',
        [contactId],
      );

      return rows.map((row) => this.transformTimeEntryRow(row));
    } catch (error) {
      Logger.error('Failed to fetch contact time entries', error, { contactId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to fetch time entries', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createTimeEntry(req, contactId, data) {
    try {
      const db = Database.get(req);

      const userId = req.session?.currentTenantUserId ?? req.session?.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
      }

      const existing = await db.query('SELECT id FROM contacts WHERE id = $1', [contactId]);
      if (!existing || existing.length === 0) {
        throw new AppError('Contact not found', 404, AppError.CODES.NOT_FOUND);
      }

      const loggedAt = data.loggedAt
        ? new Date(data.loggedAt).toISOString()
        : new Date().toISOString();

      const result = await db.insert('contact_time_entries', {
        contact_id: parseInt(contactId, 10),
        seconds: parseInt(data.seconds, 10),
        logged_at: loggedAt,
      });

      return this.transformTimeEntryRow(result);
    } catch (error) {
      Logger.error('Failed to create time entry', error, { contactId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create time entry', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deleteTimeEntry(req, contactId, entryId) {
    try {
      const db = Database.get(req);
      const userId = req.session?.currentTenantUserId ?? req.session?.user?.id;
      if (!userId) {
        throw new AppError('Unauthorized', 401, AppError.CODES.UNAUTHORIZED);
      }

      const rows = await db.query(
        'DELETE FROM contact_time_entries WHERE id = $1 AND contact_id = $2 AND user_id = $3 RETURNING id',
        [entryId, contactId, userId],
      );

      if (!rows || rows.length === 0) {
        throw new AppError('Time entry not found', 404, AppError.CODES.NOT_FOUND);
      }

      return { id: entryId };
    } catch (error) {
      Logger.error('Failed to delete time entry', error, { contactId, entryId });
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete time entry', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  transformTimeEntryRow(row) {
    return {
      id: row.id.toString(),
      contactId: row.contact_id != null ? row.contact_id.toString() : undefined,
      seconds: row.seconds,
      loggedAt: row.logged_at,
      createdAt: row.created_at,
    };
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
