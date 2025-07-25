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
    
    // Calculate totals with estimate discount
    const { subtotal, totalDiscount, subtotalAfterDiscount, estimateDiscountAmount, subtotalAfterEstimateDiscount, totalVat, total } = this.calculateTotals(estimateData.lineItems || [], estimateData.estimateDiscount || 0);
    
    const result = await this.pool.query(`
      INSERT INTO estimates (
        user_id, estimate_number, contact_id, contact_name, organization_number,
        currency, line_items, estimate_discount, notes, valid_to, subtotal, total_discount, 
        subtotal_after_discount, estimate_discount_amount, subtotal_after_estimate_discount, 
        total_vat, total, status
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) RETURNING *
    `, [
      userId,
      estimateNumber,
      estimateData.contactId,
      estimateData.contactName,
      estimateData.organizationNumber,
      estimateData.currency || 'SEK',
      JSON.stringify(estimateData.lineItems || []),
      estimateData.estimateDiscount || 0, // NEW: Save estimate discount
      estimateData.notes || '',
      estimateData.validTo,
      subtotal,
      totalDiscount,
      subtotalAfterDiscount,
      estimateDiscountAmount,
      subtotalAfterEstimateDiscount,
      totalVat,
      total,
      estimateData.status || 'draft'
    ]);
    
    return this.transformRow(result.rows[0]);
  }

  async update(userId, estimateId, estimateData) {
    // Calculate totals with estimate discount
    const { subtotal, totalDiscount, subtotalAfterDiscount, estimateDiscountAmount, subtotalAfterEstimateDiscount, totalVat, total } = this.calculateTotals(estimateData.lineItems || [], estimateData.estimateDiscount || 0);
    
    const result = await this.pool.query(`
      UPDATE estimates SET
        contact_id = $1, contact_name = $2, organization_number = $3,
        currency = $4, line_items = $5, estimate_discount = $6, notes = $7, valid_to = $8,
        subtotal = $9, total_discount = $10, subtotal_after_discount = $11, 
        estimate_discount_amount = $12, subtotal_after_estimate_discount = $13, 
        total_vat = $14, total = $15, status = $16, updated_at = CURRENT_TIMESTAMP
      WHERE id = $17 AND user_id = $18
      RETURNING *
    `, [
      estimateData.contactId,
      estimateData.contactName,
      estimateData.organizationNumber,
      estimateData.currency || 'SEK',
      JSON.stringify(estimateData.lineItems || []),
      estimateData.estimateDiscount || 0, // NEW: Save estimate discount
      estimateData.notes || '',
      estimateData.validTo,
      subtotal,
      totalDiscount,
      subtotalAfterDiscount,
      estimateDiscountAmount,
      subtotalAfterEstimateDiscount,
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

  calculateTotals(lineItems, estimateDiscount = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalVat = 0;
    
    lineItems.forEach(item => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const discountAmount = lineSubtotal * ((item.discount || 0) / 100);
      const lineSubtotalAfterDiscount = lineSubtotal - discountAmount;
      const vatAmount = lineSubtotalAfterDiscount * (item.vatRate / 100);
      
      subtotal += lineSubtotal;
      totalDiscount += discountAmount;
      totalVat += vatAmount;
    });
    
    const subtotalAfterDiscount = subtotal - totalDiscount;
    
    // NEW: Calculate estimate discount
    const estimateDiscountAmount = subtotalAfterDiscount * (estimateDiscount / 100);
    const subtotalAfterEstimateDiscount = subtotalAfterDiscount - estimateDiscountAmount;
    
    // Total VAT remains the same (VAT is calculated per line item, not affected by estimate discount)
    const total = subtotalAfterEstimateDiscount + totalVat;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
      estimateDiscountAmount: Math.round(estimateDiscountAmount * 100) / 100,
      subtotalAfterEstimateDiscount: Math.round(subtotalAfterEstimateDiscount * 100) / 100,
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
      estimateDiscount: parseFloat(row.estimate_discount || 0), // NEW: Include estimate discount
      notes: row.notes || '',
      validTo: row.valid_to,
      subtotal: parseFloat(row.subtotal || 0),
      totalDiscount: parseFloat(row.total_discount || 0),
      subtotalAfterDiscount: parseFloat(row.subtotal_after_discount || 0),
      estimateDiscountAmount: parseFloat(row.estimate_discount_amount || 0),
      subtotalAfterEstimateDiscount: parseFloat(row.subtotal_after_estimate_discount || 0),
      totalVat: parseFloat(row.total_vat || 0),
      total: parseFloat(row.total || 0),
      status: row.status || 'draft',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

module.exports = EstimateModel;