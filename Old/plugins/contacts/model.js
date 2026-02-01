// plugins/contacts/model.js
class ContactModel {
    constructor(pool) {
      this.pool = pool;
    }
  
    async getAll(userId) {
      const result = await this.pool.query(
        'SELECT * FROM contacts WHERE user_id = $1 ORDER BY contact_number',
        [userId]
      );
      
      return result.rows.map(this.transformRow);
    }
  
    async create(userId, contactData) {
      const result = await this.pool.query(`
        INSERT INTO contacts (
          user_id, contact_number, contact_type, company_name, company_type,
          organization_number, vat_number, personal_number, contact_persons, addresses,
          email, phone, phone2, website, tax_rate, payment_terms, currency, f_tax, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING *
      `, [
        userId,
        contactData.contactNumber,
        contactData.contactType,
        contactData.companyName,
        contactData.companyType,
        contactData.organizationNumber,
        contactData.vatNumber,
        contactData.personalNumber,
        JSON.stringify(contactData.contactPersons || []),
        JSON.stringify(contactData.addresses || []),
        contactData.email,
        contactData.phone,
        contactData.phone2,
        contactData.website,
        contactData.taxRate,
        contactData.paymentTerms,
        contactData.currency,
        contactData.fTax,
        contactData.notes,
      ]);
      
      return this.transformRow(result.rows[0]);
    }
  
    async update(userId, contactId, contactData) {
      const result = await this.pool.query(`
        UPDATE contacts SET
          contact_number = $1, contact_type = $2, company_name = $3, company_type = $4,
          organization_number = $5, vat_number = $6, personal_number = $7, 
          contact_persons = $8, addresses = $9, email = $10, phone = $11, phone2 = $12,
          website = $13, tax_rate = $14, payment_terms = $15, currency = $16, f_tax = $17,
          notes = $18, updated_at = CURRENT_TIMESTAMP
        WHERE id = $19 AND user_id = $20
        RETURNING *
      `, [
        contactData.contactNumber,
        contactData.contactType,
        contactData.companyName,
        contactData.companyType,
        contactData.organizationNumber,
        contactData.vatNumber,
        contactData.personalNumber,
        JSON.stringify(contactData.contactPersons || []),
        JSON.stringify(contactData.addresses || []),
        contactData.email,
        contactData.phone,
        contactData.phone2,
        contactData.website,
        contactData.taxRate,
        contactData.paymentTerms,
        contactData.currency,
        contactData.fTax,
        contactData.notes,
        contactId,
        userId,
      ]);
      
      if (!result.rows.length) {
        throw new Error('Contact not found');
      }
      
      return this.transformRow(result.rows[0]);
    }
  
    async delete(userId, contactId) {
      const result = await this.pool.query(
        'DELETE FROM contacts WHERE id = $1 AND user_id = $2 RETURNING id',
        [contactId, userId]
      );
      
      if (!result.rows.length) {
        throw new Error('Contact not found');
      }
      
      return { id: contactId };
    }
  
    transformRow(row) {
      return {
        id: row.id.toString(),
        contactNumber: row.contact_number,
        contactType: row.contact_type,
        companyName: row.company_name,
        companyType: row.company_type || '',
        organizationNumber: row.organization_number || '',
        vatNumber: row.vat_number || '',
        personalNumber: row.personal_number || '',
        contactPersons: row.contact_persons || [],
        addresses: row.addresses || [],
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