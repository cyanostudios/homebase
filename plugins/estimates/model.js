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
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const currentYear = new Date().getFullYear();
      let nextNumber;
      let estimateNumber;
      let attempts = 0;
      const maxAttempts = 1000; // Säkerhet mot oändlig loop
      
      do {
        // Get or create sequence for this user
        let result = await client.query(
          'SELECT last_estimate_number FROM estimate_sequences WHERE user_id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          // First estimate for this user
          await client.query(
            'INSERT INTO estimate_sequences (user_id, last_estimate_number) VALUES ($1, 1)',
            [userId]
          );
          nextNumber = 1;
        } else {
          // Increment existing sequence
          nextNumber = result.rows[0].last_estimate_number + 1;
          await client.query(
            'UPDATE estimate_sequences SET last_estimate_number = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2',
            [nextNumber, userId]
          );
        }
        
        estimateNumber = `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
        
        // Check if this number already exists
        const existsResult = await client.query(
          'SELECT id FROM estimates WHERE estimate_number = $1',
          [estimateNumber]
        );
        
        if (existsResult.rows.length === 0) {
          // Number is available, we can use it
          break;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Could not find available estimate number');
        }
        
      } while (true);
      
      await client.query('COMMIT');
      return estimateNumber;
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async create(userId, estimateData) {
    // Only generate number if not provided (for backward compatibility)
    const estimateNumber = estimateData.estimateNumber || await this.getNextEstimateNumber(userId);
    
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
      estimateData.contactId || null,
      estimateData.contactName || '',
      estimateData.organizationNumber || '',
      estimateData.currency || 'SEK',
      JSON.stringify(estimateData.lineItems || []),
      estimateData.estimateDiscount || 0,
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
        contact_id = $3,
        contact_name = $4,
        organization_number = $5,
        currency = $6,
        line_items = $7,
        estimate_discount = $8,
        notes = $9,
        valid_to = $10,
        subtotal = $11,
        total_discount = $12,
        subtotal_after_discount = $13,
        estimate_discount_amount = $14,
        subtotal_after_estimate_discount = $15,
        total_vat = $16,
        total = $17,
        status = $18,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [
      estimateId,
      userId,
      estimateData.contactId || null,
      estimateData.contactName || '',
      estimateData.organizationNumber || '',
      estimateData.currency || 'SEK',
      JSON.stringify(estimateData.lineItems || []),
      estimateData.estimateDiscount || 0,
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
    
    return true;
  }

  calculateTotals(lineItems, estimateDiscount = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalVat = 0;
    
    // Calculate line item totals
    lineItems.forEach(item => {
      const lineSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const lineDiscountAmount = lineSubtotal * ((item.discount || 0) / 100);
      const lineSubtotalAfterDiscount = lineSubtotal - lineDiscountAmount;
      const lineVatAmount = lineSubtotalAfterDiscount * ((item.vatRate || 25) / 100);
      
      subtotal += lineSubtotal;
      totalDiscount += lineDiscountAmount;
      totalVat += lineVatAmount;
    });
    
    const subtotalAfterDiscount = subtotal - totalDiscount;
    
    // Apply estimate-level discount to the subtotal after line discounts
    const estimateDiscountAmount = subtotalAfterDiscount * (estimateDiscount / 100);
    const subtotalAfterEstimateDiscount = subtotalAfterDiscount - estimateDiscountAmount;
    
    // Recalculate VAT on the final subtotal (after both line and estimate discounts)
    const finalVatAmount = subtotalAfterEstimateDiscount * 0.25; // Assuming 25% VAT
    const total = subtotalAfterEstimateDiscount + finalVatAmount;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
      estimateDiscountAmount: Math.round(estimateDiscountAmount * 100) / 100,
      subtotalAfterEstimateDiscount: Math.round(subtotalAfterEstimateDiscount * 100) / 100,
      totalVat: Math.round(finalVatAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  transformRow(row) {
    return {
      id: row.id.toString(),
      estimateNumber: row.estimate_number,
      contactId: row.contact_id ? row.contact_id.toString() : null,
      contactName: row.contact_name || '',
      organizationNumber: row.organization_number || '',
      currency: row.currency || 'SEK',
      lineItems: row.line_items || [],
      estimateDiscount: row.estimate_discount || 0,
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