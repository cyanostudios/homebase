// plugins/estimates/model.js
// Estimates model - V3 with @homebase/core SDK
const crypto = require('crypto');
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class EstimateModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  // Existing calculation method (unchanged)
  calculateTotals(lineItems, estimateDiscount = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalVat = 0;

    lineItems.forEach((item) => {
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

    // Parse JSON fields if they're strings
    let lineItems = row.line_items || [];
    if (typeof lineItems === 'string') {
      try {
        lineItems = JSON.parse(lineItems);
      } catch (e) {
        lineItems = [];
      }
    }

    let acceptanceReasons = row.acceptance_reasons || [];
    if (typeof acceptanceReasons === 'string') {
      try {
        acceptanceReasons = JSON.parse(acceptanceReasons);
      } catch (e) {
        acceptanceReasons = [];
      }
    }

    let rejectionReasons = row.rejection_reasons || [];
    if (typeof rejectionReasons === 'string') {
      try {
        rejectionReasons = JSON.parse(rejectionReasons);
      } catch (e) {
        rejectionReasons = [];
      }
    }

    return {
      id: row.id.toString(),
      estimateNumber: row.estimate_number,
      contactId: row.contact_id ? row.contact_id.toString() : null,
      contactName: row.contact_name || '',
      organizationNumber: row.organization_number || '',
      currency: row.currency || 'SEK',
      lineItems: lineItems,
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
      acceptanceReasons: acceptanceReasons,
      rejectionReasons: rejectionReasons,
      statusChangedAt: row.status_changed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Get next estimate number (uses transaction)
  async getNextEstimateNumber(req) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      const pool = context.pool;

      // Use direct pool for transaction (database.transaction doesn't support this pattern yet)
      const client = await pool.connect();

      try {
        await client.query('BEGIN');

        const currentYear = new Date().getFullYear();
        let attempts = 0;
        const maxAttempts = 100;

        do {
          const result = await client.query(
            `
            SELECT estimate_number 
            FROM estimates 
            WHERE estimate_number LIKE $1
            ORDER BY estimate_number DESC 
            LIMIT 1
          `,
            [`${currentYear}-%`],
          );

          let nextNumber = 1;
          if (result.rows.length > 0) {
            const lastNumber = result.rows[0].estimate_number;
            const numberPart = parseInt(lastNumber.split('-')[1]);
            nextNumber = numberPart + 1;
          }

          const estimateNumber = `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;

          const checkResult = await client.query(
            'SELECT id FROM estimates WHERE estimate_number = $1',
            [estimateNumber],
          );

          if (checkResult.rows.length === 0) {
            await client.query('COMMIT');
            return estimateNumber;
          }

          attempts++;
          if (attempts >= maxAttempts) {
            throw new AppError(
              'Could not find available estimate number',
              500,
              AppError.CODES.DATABASE_ERROR,
            );
          }
        } while (true);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      Logger.error('Failed to get next estimate number', error);

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get next estimate number', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Create estimate
  async create(req, estimateData) {
    try {
      const db = Database.get(req);

      const estimateNumber = estimateData.estimateNumber || (await this.getNextEstimateNumber(req));
      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        estimateDiscountAmount,
        subtotalAfterEstimateDiscount,
        totalVat,
        total,
      } = this.calculateTotals(estimateData.lineItems || [], estimateData.estimateDiscount || 0);

      // Use database.insert for automatic tenant isolation
      const result = await db.insert('estimates', {
        estimate_number: estimateNumber,
        contact_id: estimateData.contactId || null,
        contact_name: estimateData.contactName || '',
        organization_number: estimateData.organizationNumber || '',
        currency: estimateData.currency || 'SEK',
        line_items: JSON.stringify(estimateData.lineItems || []),
        estimate_discount: estimateData.estimateDiscount || 0,
        notes: estimateData.notes || '',
        valid_to: estimateData.validTo || null,
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        estimate_discount_amount: estimateDiscountAmount,
        subtotal_after_estimate_discount: subtotalAfterEstimateDiscount,
        total_vat: totalVat,
        total: total,
        status: estimateData.status || 'draft',
        acceptance_reasons: JSON.stringify(estimateData.acceptanceReasons || []),
        rejection_reasons: JSON.stringify(estimateData.rejectionReasons || []),
        status_changed_at:
          estimateData.status === 'accepted' || estimateData.status === 'rejected'
            ? new Date()
            : null,
      });

      Logger.info('Estimate created', { estimateId: result.id, estimateNumber });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create estimate', error, {
        estimateData: { estimateNumber: estimateData.estimateNumber },
      });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create estimate', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get all estimates for user
  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic
      const rows = await db.query('SELECT * FROM estimates ORDER BY created_at DESC', []);

      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch estimates', error);
      throw new AppError('Failed to fetch estimates', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get single estimate by ID
  async getById(req, estimateId) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);

      const result = await db.query('SELECT * FROM estimates WHERE id = $1', [estimateId], context);

      if (result.rows.length === 0) {
        return null;
      }

      return this.transformRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to get estimate', error, { estimateId });
      throw new AppError('Failed to get estimate', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Update estimate
  async update(req, estimateId, estimateData) {
    try {
      const db = Database.get(req);

      // Verify estimate exists (ownership check automatic)
      const currentEstimate = await this.getById(req, estimateId);
      if (!currentEstimate) {
        throw new AppError('Estimate not found', 404, AppError.CODES.NOT_FOUND);
      }

      const isStatusChanging = currentEstimate.status !== estimateData.status;
      const isBecomingAcceptedOrRejected =
        estimateData.status === 'accepted' || estimateData.status === 'rejected';

      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        estimateDiscountAmount,
        subtotalAfterEstimateDiscount,
        totalVat,
        total,
      } = this.calculateTotals(estimateData.lineItems || [], estimateData.estimateDiscount || 0);

      // Use database.update for automatic tenant isolation
      const result = await db.update('estimates', estimateId, {
        contact_id: estimateData.contactId || null,
        contact_name: estimateData.contactName || '',
        organization_number: estimateData.organizationNumber || '',
        currency: estimateData.currency || 'SEK',
        line_items: JSON.stringify(estimateData.lineItems || []),
        estimate_discount: estimateData.estimateDiscount || 0,
        notes: estimateData.notes || '',
        valid_to: estimateData.validTo || null,
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        estimate_discount_amount: estimateDiscountAmount,
        subtotal_after_estimate_discount: subtotalAfterEstimateDiscount,
        total_vat: totalVat,
        total: total,
        status: estimateData.status || 'draft',
        acceptance_reasons: JSON.stringify(estimateData.acceptanceReasons || []),
        rejection_reasons: JSON.stringify(estimateData.rejectionReasons || []),
        status_changed_at:
          isStatusChanging && isBecomingAcceptedOrRejected
            ? new Date()
            : currentEstimate.statusChangedAt,
      });

      Logger.info('Estimate updated', { estimateId });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update estimate', error, { estimateId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update estimate', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'estimates', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete estimates', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete estimates', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Delete estimate
  async delete(req, estimateId) {
    try {
      const db = Database.get(req);

      // Delete the estimate (tenant isolation automatic)
      await db.deleteRecord('estimates', estimateId);

      Logger.info('Estimate deleted', { estimateId });

      return true;
    } catch (error) {
      Logger.error('Failed to delete estimate', error, { estimateId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete estimate', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get status transition statistics
  async getStatusStats(req, startDate = null, endDate = null) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);

      let dateFilter = '';
      let params = [];

      if (startDate && endDate) {
        dateFilter = 'AND status_changed_at BETWEEN $1 AND $2';
        params = [startDate, endDate];
      }

      const result = await db.query(
        `
        SELECT 
          status,
          acceptance_reasons,
          rejection_reasons,
          COUNT(*) as count,
          status_changed_at
        FROM estimates 
        WHERE status IN ('accepted', 'rejected')
          AND status_changed_at IS NOT NULL
          ${dateFilter}
        GROUP BY status, acceptance_reasons, rejection_reasons, status_changed_at
        ORDER BY status_changed_at DESC
      `,
        params,
      );

      return result.rows.map((row) => {
        let acceptanceReasons = row.acceptance_reasons || [];
        if (typeof acceptanceReasons === 'string') {
          try {
            acceptanceReasons = JSON.parse(acceptanceReasons);
          } catch (e) {
            acceptanceReasons = [];
          }
        }

        let rejectionReasons = row.rejection_reasons || [];
        if (typeof rejectionReasons === 'string') {
          try {
            rejectionReasons = JSON.parse(rejectionReasons);
          } catch (e) {
            rejectionReasons = [];
          }
        }

        return {
          status: row.status,
          acceptanceReasons: acceptanceReasons,
          rejectionReasons: rejectionReasons,
          count: parseInt(row.count),
          statusChangedAt: row.status_changed_at,
        };
      });
    } catch (error) {
      Logger.error('Failed to get status stats', error);
      throw new AppError('Failed to get status stats', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get aggregated reason statistics
  async getReasonStats(req, status, startDate = null, endDate = null) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);

      let dateFilter = '';
      let params = [status];

      if (startDate && endDate) {
        dateFilter = 'AND status_changed_at BETWEEN $2 AND $3';
        params = [status, startDate, endDate];
      }

      const reasonField = status === 'accepted' ? 'acceptance_reasons' : 'rejection_reasons';

      const result = await db.query(
        `
        SELECT ${reasonField} as reasons
        FROM estimates 
        WHERE status = $1
          AND status_changed_at IS NOT NULL
          ${dateFilter}
      `,
        params,
      );

      const reasonCounts = {};
      rows.forEach((row) => {
        if (row.reasons) {
          let reasons = row.reasons;
          if (typeof reasons === 'string') {
            try {
              reasons = JSON.parse(reasons);
            } catch (e) {
              reasons = [];
            }
          }
          reasons.forEach((reason) => {
            reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
          });
        }
      });

      return reasonCounts;
    } catch (error) {
      Logger.error('Failed to get reason stats', error, { status });
      throw new AppError('Failed to get reason stats', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // SHARING METHODS
  generateShareToken() {
    const bytes = crypto.randomBytes(24);
    return this.base62Encode(bytes);
  }

  base62Encode(buffer) {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let result = '';
    let num = BigInt('0x' + buffer.toString('hex'));

    while (num > 0) {
      result = chars[num % 62n] + result;
      num = num / 62n;
    }

    return result.padStart(32, '0');
  }

  async createShare(req, estimateId, validUntil) {
    try {
      const db = Database.get(req);
      const pool = context.pool;

      // Verify estimate exists and user owns it
      const estimate = await this.getById(req, estimateId);
      if (!estimate) {
        throw new AppError('Estimate not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const shareToken = this.generateShareToken();

      // Insert share (estimate_shares table doesn't have user_id, so we use direct pool)
      const result = await pool.query(
        `
        INSERT INTO estimate_shares (estimate_id, share_token, valid_until)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
        [estimateId, shareToken, validUntil],
      );

      Logger.info('Share created', { estimateId, shareId: result.rows[0].id });

      return {
        id: result.rows[0].id.toString(),
        estimateId: result.rows[0].estimate_id.toString(),
        shareToken: result.rows[0].share_token,
        validUntil: result.rows[0].valid_until,
        createdAt: result.rows[0].created_at,
        accessedCount: result.rows[0].accessed_count,
        lastAccessedAt: result.rows[0].last_accessed_at,
      };
    } catch (error) {
      Logger.error('Failed to create share', error, { estimateId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get estimate by share token (PUBLIC - no tenant isolation)
  async getEstimateByShareToken(req, shareToken) {
    try {
      const pool = req.tenantPool || this._getContext(req).pool;

      const result = await pool.query(
        `
        SELECT 
          e.*,
          es.accessed_count,
          es.valid_until as share_valid_until
        FROM estimates e
        JOIN estimate_shares es ON e.id = es.estimate_id
        WHERE es.share_token = $1 AND es.valid_until > NOW()
      `,
        [shareToken],
      );

      if (!result.rows.length) {
        return null;
      }

      const row = result.rows[0];
      const currentAccessCount = row.accessed_count;

      await pool.query(
        `
        UPDATE estimate_shares 
        SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
        WHERE share_token = $1
      `,
        [shareToken],
      );

      const estimate = this.transformRow(row);
      estimate.shareValidUntil = row.share_valid_until;
      estimate.accessedCount = currentAccessCount + 1;

      return estimate;
    } catch (error) {
      Logger.error('Failed to get estimate by share token', error, {
        shareToken: shareToken.substring(0, 10),
      });
      throw new AppError(
        'Failed to get estimate by share token',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async getSharesForEstimate(req, estimateId) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      const pool = context.pool;

      // Verify estimate exists and user owns it
      const estimate = await this.getById(req, estimateId);
      if (!estimate) {
        throw new AppError('Estimate not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      // Get shares (estimate_shares table doesn't have user_id, so we use direct pool)
      const result = await pool.query(
        `
        SELECT * FROM estimate_shares 
        WHERE estimate_id = $1 
        ORDER BY created_at DESC
      `,
        [estimateId],
      );

      return result.rows.map((row) => ({
        id: row.id.toString(),
        estimateId: row.estimate_id.toString(),
        shareToken: row.share_token,
        validUntil: row.valid_until,
        createdAt: row.created_at,
        accessedCount: row.accessed_count,
        lastAccessedAt: row.last_accessed_at,
      }));
    } catch (error) {
      Logger.error('Failed to get shares for estimate', error, { estimateId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get shares for estimate', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async revokeShare(req, shareId) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      const pool = context.pool;

      // Verify share belongs to user's estimate
      const result = await pool.query(
        `
        DELETE FROM estimate_shares 
        WHERE id = $1 
        AND estimate_id IN (
          SELECT id FROM estimates WHERE id = estimate_shares.estimate_id
        )
        RETURNING *
      `,
        [shareId],
      );

      // Better approach: Get estimate_id first, then verify ownership
      const shareCheck = await pool.query('SELECT estimate_id FROM estimate_shares WHERE id = $1', [
        shareId,
      ]);

      if (!shareCheck.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      const estimateId = shareCheck.rows[0].estimate_id;
      const estimate = await this.getById(req, estimateId);

      if (!estimate) {
        throw new AppError('Share not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      // Delete the share
      const deleteResult = await pool.query(
        'DELETE FROM estimate_shares WHERE id = $1 RETURNING *',
        [shareId],
      );

      if (!deleteResult.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Share revoked', { shareId, estimateId });

      return {
        id: deleteResult.rows[0].id.toString(),
        estimateId: deleteResult.rows[0].estimate_id.toString(),
        shareToken: deleteResult.rows[0].share_token,
      };
    } catch (error) {
      Logger.error('Failed to revoke share', error, { shareId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to revoke share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async cleanExpiredShares(req) {
    try {
      const pool = req.tenantPool || this._getContext(req).pool;
      const result = await pool.query('DELETE FROM estimate_shares WHERE valid_until < NOW()');

      return result.rowCount;
    } catch (error) {
      Logger.error('Failed to clean expired shares', error);
      throw new AppError('Failed to clean expired shares', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = EstimateModel;
