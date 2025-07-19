// plugins/estimates/model.js
class EstimateModel {
    constructor(pool) {
      this.pool = pool;
    }
  
    async getAll(userId) {
      const result = await this.pool.query(
        'SELECT * FROM estimates WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      
      return result.rows.map(this.transformRow);
    }
  
    async getNextEstimateNumber(userId) {
      const currentYear = new Date().getFullYear();
      const result = await this.pool.query(`
        SELECT estimate_number FROM estimates 
        WHERE user_id = $1 AND estimate_number LIKE $2 
        ORDER BY estimate_number DESC LIMIT 1
      `, [userId, `${currentYear}-%`]);
      
      if (!result.rows.length) {
        return `${currentYear}-001`;
      }
      
      const lastNumber = result.rows[0].estimate_number;
      const numberPart = parseInt(lastNumber.split('-')[1]);
      const nextNumber = (numberPart + 1).toString().padStart(3, '0');
      return `${currentYear}-${nextNumber}`;
    }
  
    async create(userId, estimateData) {
      const estimateNumber = await this.getNextEstimateNumber(userId);
      
      // Calculate totals
      const { subtotal, totalVat, total } = this.calculateTotals(estimateData.lineItems || []);
      
      const result = await this.pool.query(`
        INSERT INTO estimates (
          user_id, estimate_number, contact_id, contact_name, organization_number,
          currency, line_items, notes, valid_to, subtotal, total_vat, total, status
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) RETURNING *
      `, [
        userId,
        estimateNumber,
        estimateData.contactId,
        estimateData.contactName,
        estimateData.organizationNumber,
        estimateData.currency || 'SEK',
        JSON.stringify(estimateData.lineItems || []),
        estimateData.notes || '',
        estimateData.validTo,
        subtotal,
        totalVat,
        total,
        estimateData.status || 'draft'
      ]);
      
      return this.transformRow(result.rows[0]);
    }
  
    async update(userId, estimateId, estimateData) {
      // Calculate totals
      const { subtotal, totalVat, total } = this.calculateTotals(estimateData.lineItems || []);
      
      const result = await this.pool.query(`
        UPDATE estimates SET
          contact_id = $1, contact_name = $2, organization_number = $3,
          currency = $4, line_items = $5, notes = $6, valid_to = $7,
          subtotal = $8, total_vat = $9, total = $10, status = $11,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $12 AND user_id = $13
        RETURNING *
      `, [
        estimateData.contactId,
        estimateData.contactName,
        estimateData.organizationNumber,
        estimateData.currency || 'SEK',
        JSON.stringify(estimateData.lineItems || []),
        estimateData.notes || '',
        estimateData.validTo,
        subtotal,
        totalVat,
        total,
        estimateData.status || 'draft',
        estimateId,
        userId
      ]);
      
      if (!result.rows.length) {
        throw new Error('Estimate not found');
      }
      
      return this.transformRow(result.rows[0]);
    }
  
    async delete(userId, estimateId) {
      const result = await this.pool.query(
        'DELETE FROM estimates WHERE id = $1 AND user_id = $2 RETURNING id',
        [estimateId, userId]
      );
      
      if (!result.rows.length) {
        throw new Error('Estimate not found');
      }
      
      return { id: estimateId };
    }
  
    calculateTotals(lineItems) {
      let subtotal = 0;
      let totalVat = 0;
      
      lineItems.forEach(item => {
        const lineSubtotal = item.quantity * item.unitPrice;
        const vatAmount = lineSubtotal * (item.vatRate / 100);
        
        subtotal += lineSubtotal;
        totalVat += vatAmount;
      });
      
      const total = subtotal + totalVat;
      
      return {
        subtotal: Math.round(subtotal * 100) / 100,
        totalVat: Math.round(totalVat * 100) / 100,
        total: Math.round(total * 100) / 100
      };
    }
  
    transformRow(row) {
      return {
        id: row.id.toString(),
        estimateNumber: row.estimate_number,
        contactId: row.contact_id?.toString() || null,
        contactName: row.contact_name || '',
        organizationNumber: row.organization_number || '',
        currency: row.currency || 'SEK',
        lineItems: row.line_items || [],
        notes: row.notes || '',
        validTo: row.valid_to,
        subtotal: parseFloat(row.subtotal || 0),
        totalVat: parseFloat(row.total_vat || 0),
        total: parseFloat(row.total || 0),
        status: row.status || 'draft',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  }
  
  module.exports = EstimateModel;