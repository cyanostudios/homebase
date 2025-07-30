const crypto = require('crypto');

class EstimateModel {
  constructor(pool) {
    this.pool = pool;
  }

  // Existing calculation method
  calculateTotals(lineItems, estimateDiscount = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalVat = 0;

    lineItems.forEach(item => {
      const lineSubtotal = item.quantity * item.unitPrice;
      const discountAmount = lineSubtotal * (item.discount / 100);
      const lineSubtotalAfterDiscount = lineSubtotal - discountAmount;
      const vatAmount = lineSubtotalAfterDiscount * (item.vatRate / 100);

      subtotal += lineSubtotal;
      totalDiscount += discountAmount;
      totalVat += vatAmount;
    });

    const subtotalAfterDiscount = subtotal - totalDiscount;
    const estimateDiscountAmount = subtotalAfterDiscount * (estimateDiscount / 100);
    const subtotalAfterEstimateDiscount = subtotalAfterDiscount - estimateDiscountAmount;
    const total = subtotalAfterEstimateDiscount + totalVat;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
      estimateDiscountAmount: Math.round(estimateDiscountAmount * 100) / 100,
      subtotalAfterEstimateDiscount: Math.round(subtotalAfterEstimateDiscount * 100) / 100,
      totalVat: Math.round(totalVat * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }

  // Transform database row to JS object
  transformRow(row) {
    if (!row) return null;
    
    return {
      id: row.id.toString(),
      estimateNumber: row.estimate_number,
      contactId: row.contact_id ? row.contact_id.toString() : null,
      contactName: row.contact_name || '',
      organizationNumber: row.organization_number || '',
      currency: row.currency || 'SEK',
      lineItems: Array.isArray(row.line_items) ? row.line_items : [],
      estimateDiscount: parseFloat(row.estimate_discount || 0),
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
      // NEW: Add status reasons
      acceptanceReasons: row.acceptance_reasons ? JSON.parse(row.acceptance_reasons) : [],
      rejectionReasons: row.rejection_reasons ? JSON.parse(row.rejection_reasons) : [],
      statusChangedAt: row.status_changed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Get next estimate number
  async getNextEstimateNumber(userId) {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const currentYear = new Date().getFullYear();
      let attempts = 0;
      const maxAttempts = 100;
      
      do {
        const result = await client.query(`
          SELECT estimate_number 
          FROM estimates 
          WHERE user_id = $1 AND estimate_number LIKE $2
          ORDER BY estimate_number DESC 
          LIMIT 1
        `, [userId, `${currentYear}-%`]);
        
        let nextNumber = 1;
        if (result.rows.length > 0) {
          const lastNumber = result.rows[0].estimate_number;
          const numberPart = parseInt(lastNumber.split('-')[1]);
          nextNumber = numberPart + 1;
        }
        
        const estimateNumber = `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
        
        const checkResult = await client.query(
          'SELECT id FROM estimates WHERE estimate_number = $1',
          [estimateNumber]
        );
        
        if (checkResult.rows.length === 0) {
          await client.query('COMMIT');
          return estimateNumber;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
          throw new Error('Could not find available estimate number');
        }
        
      } while (true);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Create estimate
  async create(userId, estimateData) {
    const estimateNumber = estimateData.estimateNumber || await this.getNextEstimateNumber(userId);
    const { subtotal, totalDiscount, subtotalAfterDiscount, estimateDiscountAmount, subtotalAfterEstimateDiscount, totalVat, total } = this.calculateTotals(estimateData.lineItems || [], estimateData.estimateDiscount || 0);
    
    const result = await this.pool.query(`
      INSERT INTO estimates (
        user_id, estimate_number, contact_id, contact_name, organization_number,
        currency, line_items, estimate_discount, notes, valid_to, subtotal, total_discount, 
        subtotal_after_discount, estimate_discount_amount, subtotal_after_estimate_discount, 
        total_vat, total, status, acceptance_reasons, rejection_reasons, status_changed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
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
      estimateData.status || 'draft',
      // NEW: Handle status reasons
      JSON.stringify(estimateData.acceptanceReasons || []),
      JSON.stringify(estimateData.rejectionReasons || []),
      (estimateData.status === 'accepted' || estimateData.status === 'rejected') ? 'NOW()' : null
    ]);
    
    return this.transformRow(result.rows[0]);
  }

  // Get all estimates for user (keeping original method name)
  async getAll(userId) {
    const result = await this.pool.query(
      'SELECT * FROM estimates WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map(row => this.transformRow(row));
  }

  // Get single estimate by ID
  async getById(userId, estimateId) {
    const result = await this.pool.query(
      'SELECT * FROM estimates WHERE id = $1 AND user_id = $2',
      [estimateId, userId]
    );
    
    if (!result.rows.length) {
      return null;
    }
    
    return this.transformRow(result.rows[0]);
  }

  // Update estimate
  async update(userId, estimateId, estimateData) {
    const { subtotal, totalDiscount, subtotalAfterDiscount, estimateDiscountAmount, subtotalAfterEstimateDiscount, totalVat, total } = this.calculateTotals(estimateData.lineItems || [], estimateData.estimateDiscount || 0);
    
    // NEW: Check if status is changing to accepted/rejected to update status_changed_at
    const currentEstimate = await this.getById(userId, estimateId);
    const isStatusChanging = currentEstimate && currentEstimate.status !== estimateData.status;
    const isBecomingAcceptedOrRejected = (estimateData.status === 'accepted' || estimateData.status === 'rejected');
    
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
        acceptance_reasons = $19,
        rejection_reasons = $20,
        status_changed_at = CASE 
          WHEN $21 THEN CURRENT_TIMESTAMP 
          ELSE status_changed_at 
        END,
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
      estimateData.status || 'draft',
      // NEW: Handle status reasons
      JSON.stringify(estimateData.acceptanceReasons || []),
      JSON.stringify(estimateData.rejectionReasons || []),
      isStatusChanging && isBecomingAcceptedOrRejected
    ]);
    
    if (!result.rows.length) {
      throw new Error('Estimate not found');
    }
    
    return this.transformRow(result.rows[0]);
  }

  // Delete estimate
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

  // === NEW: STATISTICS METHODS ===

  // Get status transition statistics
  async getStatusStats(userId, startDate = null, endDate = null) {
    let dateFilter = '';
    let params = [userId];
    
    if (startDate && endDate) {
      dateFilter = 'AND status_changed_at BETWEEN $2 AND $3';
      params.push(startDate, endDate);
    }
    
    const result = await this.pool.query(`
      SELECT 
        status,
        acceptance_reasons,
        rejection_reasons,
        COUNT(*) as count,
        status_changed_at
      FROM estimates 
      WHERE user_id = $1 
        AND status IN ('accepted', 'rejected')
        AND status_changed_at IS NOT NULL
        ${dateFilter}
      ORDER BY status_changed_at DESC
    `, params);
    
    return result.rows.map(row => ({
      status: row.status,
      acceptanceReasons: row.acceptance_reasons ? JSON.parse(row.acceptance_reasons) : [],
      rejectionReasons: row.rejection_reasons ? JSON.parse(row.rejection_reasons) : [],
      count: parseInt(row.count),
      statusChangedAt: row.status_changed_at
    }));
  }

  // Get aggregated reason statistics
  async getReasonStats(userId, status, startDate = null, endDate = null) {
    let dateFilter = '';
    let params = [userId, status];
    
    if (startDate && endDate) {
      dateFilter = 'AND status_changed_at BETWEEN $3 AND $4';
      params.push(startDate, endDate);
    }
    
    const reasonField = status === 'accepted' ? 'acceptance_reasons' : 'rejection_reasons';
    
    const result = await this.pool.query(`
      SELECT ${reasonField} as reasons
      FROM estimates 
      WHERE user_id = $1 
        AND status = $2
        AND status_changed_at IS NOT NULL
        ${dateFilter}
    `, params);
    
    // Aggregate reasons
    const reasonCounts = {};
    result.rows.forEach(row => {
      if (row.reasons) {
        const reasons = JSON.parse(row.reasons);
        reasons.forEach(reason => {
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
        });
      }
    });
    
    return reasonCounts;
  }

  // === SHARING METHODS ===

  // Generate secure random token
  generateShareToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create estimate share
  async createShare(userId, estimateId, validUntil) {
    // First verify user owns the estimate
    const estimateCheck = await this.pool.query(
      'SELECT id FROM estimates WHERE id = $1 AND user_id = $2',
      [estimateId, userId]
    );
    
    if (!estimateCheck.rows.length) {
      throw new Error('Estimate not found or access denied');
    }

    const shareToken = this.generateShareToken();
    
    const result = await this.pool.query(`
      INSERT INTO estimate_shares (estimate_id, share_token, valid_until)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [estimateId, shareToken, validUntil]);
    
    return {
      id: result.rows[0].id.toString(),
      estimateId: result.rows[0].estimate_id.toString(),
      shareToken: result.rows[0].share_token,
      validUntil: result.rows[0].valid_until,
      createdAt: result.rows[0].created_at,
      accessedCount: result.rows[0].accessed_count,
      lastAccessedAt: result.rows[0].last_accessed_at,
    };
  }

  // Get estimate by share token (public access)
  async getEstimateByShareToken(shareToken) {
    const result = await this.pool.query(`
      SELECT 
        e.*,
        es.accessed_count,
        es.valid_until as share_valid_until
      FROM estimates e
      JOIN estimate_shares es ON e.id = es.estimate_id
      WHERE es.share_token = $1 AND es.valid_until > NOW()
    `, [shareToken]);
    
    if (!result.rows.length) {
      return null;
    }
    
    // Update access count
    await this.pool.query(`
      UPDATE estimate_shares 
      SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
      WHERE share_token = $1
    `, [shareToken]);
    
    const row = result.rows[0];
    const estimate = this.transformRow(row);
    
    // Add sharing info
    estimate.shareValidUntil = row.share_valid_until;
    estimate.accessedCount = row.accessed_count + 1; // Include this access
    
    return estimate;
  }

  // Get all shares for an estimate
  async getSharesForEstimate(userId, estimateId) {
    // Verify user owns the estimate
    const estimateCheck = await this.pool.query(
      'SELECT id FROM estimates WHERE id = $1 AND user_id = $2',
      [estimateId, userId]
    );
    
    if (!estimateCheck.rows.length) {
      throw new Error('Estimate not found or access denied');
    }

    const result = await this.pool.query(`
      SELECT * FROM estimate_shares 
      WHERE estimate_id = $1 
      ORDER BY created_at DESC
    `, [estimateId]);
    
    return result.rows.map(row => ({
      id: row.id.toString(),
      estimateId: row.estimate_id.toString(),
      shareToken: row.share_token,
      validUntil: row.valid_until,
      createdAt: row.created_at,
      accessedCount: row.accessed_count,
      lastAccessedAt: row.last_accessed_at,
    }));
  }

  // Revoke share (delete it)
  async revokeShare(userId, shareId) {
    // First verify user owns the estimate that this share belongs to
    const result = await this.pool.query(`
      DELETE FROM estimate_shares 
      WHERE id = $1 
      AND estimate_id IN (
        SELECT id FROM estimates WHERE user_id = $2
      )
      RETURNING *
    `, [shareId, userId]);
    
    if (!result.rows.length) {
      throw new Error('Share not found or access denied');
    }
    
    return {
      id: result.rows[0].id.toString(),
      estimateId: result.rows[0].estimate_id.toString(),
      shareToken: result.rows[0].share_token,
    };
  }

  // Clean up expired shares (utility method)
  async cleanExpiredShares() {
    const result = await this.pool.query(
      'DELETE FROM estimate_shares WHERE valid_until < NOW()'
    );
    
    return result.rowCount;
  }
}

module.exports = EstimateModel;