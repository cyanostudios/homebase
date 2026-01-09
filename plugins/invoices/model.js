// plugins/invoices/model.js
// Invoices model - V2 with ServiceManager
const crypto = require('crypto');
const ServiceManager = require('../../server/core/ServiceManager');
const { AppError } = require('../../server/core/errors/AppError');

class InvoiceModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  _getContext(req) {
    return {
      userId: req?.session?.currentTenantUserId || req?.session?.user?.id,
      pool: req?.tenantPool,
    };
  }

  // Existing calculation method (unchanged)
  calculateTotals(lineItems, invoiceDiscount = 0) {
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
    const invoiceDiscountAmount = subtotalAfterDiscount * (invoiceDiscount / 100);
    const subtotalAfterInvoiceDiscount = subtotalAfterDiscount - invoiceDiscountAmount;
    const total = subtotalAfterInvoiceDiscount + totalVat;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
      invoiceDiscountAmount: Math.round(invoiceDiscountAmount * 100) / 100,
      subtotalAfterInvoiceDiscount: Math.round(subtotalAfterInvoiceDiscount * 100) / 100,
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
    
    return {
      id: row.id.toString(),
      invoiceNumber: row.invoice_number,
      contactId: row.contact_id ? row.contact_id.toString() : null,
      contactName: row.contact_name || '',
      organizationNumber: row.organization_number || '',
      currency: row.currency || 'SEK',
      lineItems: lineItems,
      invoiceDiscount: parseFloat(row.invoice_discount || 0),
      notes: row.notes || '',
      dueDate: row.due_date,
      subtotal: parseFloat(row.subtotal || 0),
      totalDiscount: parseFloat(row.total_discount || 0),
      subtotalAfterDiscount: parseFloat(row.subtotal_after_discount || 0),
      invoiceDiscountAmount: parseFloat(row.invoice_discount_amount || 0),
      subtotalAfterInvoiceDiscount: parseFloat(row.subtotal_after_invoice_discount || 0),
      totalVat: parseFloat(row.total_vat || 0),
      total: parseFloat(row.total || 0),
      status: row.status || 'draft',
      paidAt: row.paid_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Get next invoice number (uses transaction)
  async getNextInvoiceNumber(req) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;
      
      // Use direct pool for transaction
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        const currentYear = new Date().getFullYear();
        let attempts = 0;
        const maxAttempts = 100;
        
        do {
          const result = await client.query(`
            SELECT invoice_number 
            FROM invoices 
            WHERE invoice_number LIKE $1
            ORDER BY invoice_number DESC 
            LIMIT 1
          `, [`${currentYear}-%`]);
          
          let nextNumber = 1;
          if (result.rows.length > 0) {
            const lastNumber = result.rows[0].invoice_number;
            const numberPart = parseInt(lastNumber.split('-')[1]);
            nextNumber = numberPart + 1;
          }
          
          const invoiceNumber = `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;
          
          const checkResult = await client.query(
            'SELECT id FROM invoices WHERE invoice_number = $1',
            [invoiceNumber]
          );
          
          if (checkResult.rows.length === 0) {
            await client.query('COMMIT');
            return invoiceNumber;
          }
          
          attempts++;
          if (attempts >= maxAttempts) {
            throw new AppError('Could not find available invoice number', 500, AppError.CODES.DATABASE_ERROR);
          }
        } while (true);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to get next invoice number', error);
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get next invoice number', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Create invoice
  async create(req, invoiceData) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      const invoiceNumber = invoiceData.invoiceNumber || await this.getNextInvoiceNumber(req);
      const { subtotal, totalDiscount, subtotalAfterDiscount, invoiceDiscountAmount, subtotalAfterInvoiceDiscount, totalVat, total } = this.calculateTotals(invoiceData.lineItems || [], invoiceData.invoiceDiscount || 0);
      
      // Use database.insert for automatic tenant isolation
      const result = await database.insert('invoices', {
        invoice_number: invoiceNumber,
        contact_id: invoiceData.contactId || null,
        contact_name: invoiceData.contactName || '',
        organization_number: invoiceData.organizationNumber || '',
        currency: invoiceData.currency || 'SEK',
        line_items: JSON.stringify(invoiceData.lineItems || []),
        invoice_discount: invoiceData.invoiceDiscount || 0,
        notes: invoiceData.notes || '',
        due_date: invoiceData.dueDate || null,
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        invoice_discount_amount: invoiceDiscountAmount,
        subtotal_after_invoice_discount: subtotalAfterInvoiceDiscount,
        total_vat: totalVat,
        total: total,
        status: invoiceData.status || 'draft',
        paid_at: invoiceData.status === 'paid' ? new Date() : null,
      }, context);
      
      logger.info('Invoice created', { invoiceId: result.id, invoiceNumber, userId: context.userId });
      
      return this.transformRow(result);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to create invoice', error, { invoiceData: { invoiceNumber: invoiceData.invoiceNumber } });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create invoice', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get all invoices for user
  async getAll(req) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      
      // Tenant isolation automatic
      const rows = await database.query(
        'SELECT * FROM invoices ORDER BY created_at DESC',
        [],
        context
      );
      
      return rows.map(row => this.transformRow(row));
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to fetch invoices', error);
      throw new AppError('Failed to fetch invoices', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get single invoice by ID
  async getById(req, invoiceId) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      
      const rows = await database.query(
        'SELECT * FROM invoices WHERE id = $1',
        [invoiceId],
        context
      );
      
      if (rows.length === 0) {
        return null;
      }
      
      return this.transformRow(rows[0]);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to get invoice', error, { invoiceId });
      throw new AppError('Failed to get invoice', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Update invoice
  async update(req, invoiceId, invoiceData) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      // Verify invoice exists (ownership check automatic)
      const currentInvoice = await this.getById(req, invoiceId);
      if (!currentInvoice) {
        throw new AppError('Invoice not found', 404, AppError.CODES.NOT_FOUND);
      }
      
      const isBecomingPaid = currentInvoice.status !== 'paid' && invoiceData.status === 'paid';
      
      const { subtotal, totalDiscount, subtotalAfterDiscount, invoiceDiscountAmount, subtotalAfterInvoiceDiscount, totalVat, total } = this.calculateTotals(invoiceData.lineItems || [], invoiceData.invoiceDiscount || 0);
      
      // Use database.update for automatic tenant isolation
      const result = await database.update('invoices', invoiceId, {
        contact_id: invoiceData.contactId || null,
        contact_name: invoiceData.contactName || '',
        organization_number: invoiceData.organizationNumber || '',
        currency: invoiceData.currency || 'SEK',
        line_items: JSON.stringify(invoiceData.lineItems || []),
        invoice_discount: invoiceData.invoiceDiscount || 0,
        notes: invoiceData.notes || '',
        due_date: invoiceData.dueDate || null,
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        invoice_discount_amount: invoiceDiscountAmount,
        subtotal_after_invoice_discount: subtotalAfterInvoiceDiscount,
        total_vat: totalVat,
        total: total,
        status: invoiceData.status || 'draft',
        paid_at: isBecomingPaid ? new Date() : currentInvoice.paidAt,
      }, context);
      
      logger.info('Invoice updated', { invoiceId, userId: context.userId });
      
      return this.transformRow(result);
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to update invoice', error, { invoiceId });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update invoice', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Delete invoice
  async delete(req, invoiceId) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      
      // Delete the invoice (tenant isolation automatic)
      await database.delete('invoices', invoiceId, context);
      
      logger.info('Invoice deleted', { invoiceId, userId: context.userId });
      
      return true;
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to delete invoice', error, { invoiceId });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to delete invoice', 500, AppError.CODES.DATABASE_ERROR);
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

  async createShare(req, invoiceId, validUntil) {
    try {
      const database = ServiceManager.get('database', req);
      const logger = ServiceManager.get('logger');
      const context = this._getContext(req);
      const pool = context.pool;
      
      // Verify invoice exists and user owns it
      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const shareToken = this.generateShareToken();
      
      // Insert share (invoice_shares table doesn't have user_id, so we use direct pool)
      const result = await pool.query(`
        INSERT INTO invoice_shares (invoice_id, share_token, valid_until)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [invoiceId, shareToken, validUntil]);
      
      logger.info('Share created', { invoiceId, shareId: result.rows[0].id, userId: context.userId });
      
      return {
        id: result.rows[0].id.toString(),
        invoiceId: result.rows[0].invoice_id.toString(),
        shareToken: result.rows[0].share_token,
        validUntil: result.rows[0].valid_until,
        createdAt: result.rows[0].created_at,
        accessedCount: result.rows[0].accessed_count,
        lastAccessedAt: result.rows[0].last_accessed_at,
      };
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to create share', error, { invoiceId });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get invoice by share token (PUBLIC - no tenant isolation)
  async getInvoiceByShareToken(req, shareToken) {
    try {
      const pool = req.tenantPool || this._getContext(req).pool;
      
      const result = await pool.query(`
        SELECT 
          i.*,
          is.accessed_count,
          is.valid_until as share_valid_until
        FROM invoices i
        JOIN invoice_shares is ON i.id = is.invoice_id
        WHERE is.share_token = $1 AND is.valid_until > NOW()
      `, [shareToken]);
      
      if (!result.rows.length) {
        return null;
      }
      
      const row = result.rows[0];
      const currentAccessCount = row.accessed_count;
      
      await pool.query(`
        UPDATE invoice_shares 
        SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
        WHERE share_token = $1
      `, [shareToken]);
      
      const invoice = this.transformRow(row);
      invoice.shareValidUntil = row.share_valid_until;
      invoice.accessedCount = currentAccessCount + 1;
      
      return invoice;
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to get invoice by share token', error, { shareToken: shareToken.substring(0, 10) });
      throw new AppError('Failed to get invoice by share token', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getSharesForInvoice(req, invoiceId) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      const pool = context.pool;
      
      // Verify invoice exists and user owns it
      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      // Get shares (invoice_shares table doesn't have user_id, so we use direct pool)
      const result = await pool.query(`
        SELECT * FROM invoice_shares 
        WHERE invoice_id = $1 
        ORDER BY created_at DESC
      `, [invoiceId]);
      
      return result.rows.map(row => ({
        id: row.id.toString(),
        invoiceId: row.invoice_id.toString(),
        shareToken: row.share_token,
        validUntil: row.valid_until,
        createdAt: row.created_at,
        accessedCount: row.accessed_count,
        lastAccessedAt: row.last_accessed_at,
      }));
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to get shares for invoice', error, { invoiceId });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get shares for invoice', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async revokeShare(req, shareId) {
    try {
      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);
      const pool = context.pool;
      
      // Verify share belongs to user's invoice
      const shareCheck = await pool.query(
        'SELECT invoice_id FROM invoice_shares WHERE id = $1',
        [shareId]
      );
      
      if (!shareCheck.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }
      
      const invoiceId = shareCheck.rows[0].invoice_id;
      const invoice = await this.getById(req, invoiceId);
      
      if (!invoice) {
        throw new AppError('Share not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }
      
      // Delete the share
      const deleteResult = await pool.query(
        'DELETE FROM invoice_shares WHERE id = $1 RETURNING *',
        [shareId]
      );
      
      if (!deleteResult.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }
      
      const logger = ServiceManager.get('logger');
      logger.info('Share revoked', { shareId, invoiceId, userId: context.userId });
      
      return {
        id: deleteResult.rows[0].id.toString(),
        invoiceId: deleteResult.rows[0].invoice_id.toString(),
        shareToken: deleteResult.rows[0].share_token,
      };
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to revoke share', error, { shareId });
      
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to revoke share', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async cleanExpiredShares(req) {
    try {
      const pool = req.tenantPool || this._getContext(req).pool;
      const result = await pool.query(
        'DELETE FROM invoice_shares WHERE valid_until < NOW()'
      );
      
      return result.rowCount;
    } catch (error) {
      const logger = ServiceManager.get('logger');
      logger.error('Failed to clean expired shares', error);
      throw new AppError('Failed to clean expired shares', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = InvoiceModel;
