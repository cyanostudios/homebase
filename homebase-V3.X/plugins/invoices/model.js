// plugins/invoices/model.js
// Invoices model - V3 with @homebase/core SDK
const crypto = require('crypto');
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class InvoiceModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  // Existing calculation method (unchanged)
  calculateTotals(lineItems, invoiceDiscount = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalVat = 0;

    // Handle empty lineItems array
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return {
        subtotal: 0,
        totalDiscount: 0,
        subtotalAfterDiscount: 0,
        invoiceDiscountAmount: 0,
        subtotalAfterInvoiceDiscount: 0,
        totalVat: 0,
        total: 0,
      };
    }

    lineItems.forEach((item) => {
      // Use calculated fields if available, otherwise calculate from raw data
      const lineSubtotal = item.lineSubtotal ?? (item.quantity || 0) * (item.unitPrice || 0);
      const discountAmount = item.discountAmount ?? lineSubtotal * ((item.discount || 0) / 100);
      const lineSubtotalAfterDiscount = lineSubtotal - discountAmount;
      const vatRate = item.vatRate || 25;
      const vatAmount = item.vatAmount ?? lineSubtotalAfterDiscount * (vatRate / 100);

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
      paymentTerms: row.payment_terms || '',
      issueDate: row.issue_date,
      dueDate: row.due_date,
      invoiceType: row.invoice_type || 'invoice',
      subtotal: parseFloat(row.subtotal || 0),
      totalDiscount: parseFloat(row.total_discount || 0),
      subtotalAfterDiscount: parseFloat(row.subtotal_after_discount || 0),
      invoiceDiscountAmount: parseFloat(row.invoice_discount_amount || 0),
      subtotalAfterInvoiceDiscount: parseFloat(row.subtotal_after_invoice_discount || 0),
      totalVat: parseFloat(row.total_vat || 0),
      total: parseFloat(row.total || 0),
      status: row.status || 'draft',
      paidAt: row.paid_at,
      estimateId: row.estimate_id ? row.estimate_id.toString() : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // Get next invoice number
  // Using same approach as contacts plugin - simple query with automatic tenant isolation
  async getNextInvoiceNumber(req) {
    try {
      // Log initial state for debugging
      Logger.info('Getting next invoice number', {
        hasSession: !!req?.session,
        hasUser: !!req?.session?.user,
        userId: req?.session?.user?.id,
        hasTenantPool: !!req?.tenantPool,
        hasTenantConnectionString: !!req?.session?.tenantConnectionString,
      });

      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);

      // Validate context
      if (!context.userId) {
        const errorMsg = 'User ID is required. Please ensure you are logged in.';
        Logger.error(errorMsg, null, {
          session: req?.session,
          hasUser: !!req?.session?.user,
          hasCurrentTenantUserId: !!req?.session?.currentTenantUserId,
        });
        throw new AppError(errorMsg, 400, AppError.CODES.VALIDATION_ERROR);
      }

      Logger.info('Context validated', {
        userId: context.userId,
        hasPool: !!context.pool,
        hasDatabase: !!database,
        hasDatabasePool: !!(database && database.pool),
      });

      const currentYear = new Date().getFullYear();
      const pattern = `${currentYear}-%`;

      // Use db.query() which automatically handles tenant isolation
      // It will add user_id filter if not present in the query
      // The query will become: WHERE invoice_number LIKE $1 AND user_id = $2
      Logger.info('Executing query for invoice numbers', {
        userId: context.userId,
        year: currentYear,
        pattern: pattern,
      });

      // Query will automatically add user_id filter via _addTenantFilter()
      // So final query will be: WHERE invoice_number LIKE $1 AND user_id = $2
      // And params will be: [pattern, userId]
      const result = await db.query(
        `SELECT invoice_number 
         FROM invoices 
         WHERE invoice_number LIKE $1
         ORDER BY invoice_number DESC 
         LIMIT 1`,
        [pattern],
        context,
      );

      Logger.info('Query executed successfully', {
        rowCount: rows?.length || 0,
        firstRow: rows?.[0] || null,
        isEmpty: !rows || rows.length === 0,
      });

      let nextNumber = 1;
      if (rows && rows.length > 0 && rows[0] && rows[0].invoice_number) {
        const lastNumber = rows[0].invoice_number;
        Logger.info('Found existing invoice number', { lastNumber });
        const parts = lastNumber.split('-');
        if (parts.length >= 2) {
          const numberPart = parseInt(parts[1], 10);
          if (!isNaN(numberPart) && numberPart > 0) {
            nextNumber = numberPart + 1;
          }
        }
      } else {
        Logger.info(
          'No existing invoices found (rows.length=0), returning nextNumber=1 for empty DB case',
        );
      }

      const invoiceNumber = `${currentYear}-${nextNumber.toString().padStart(3, '0')}`;

      // Verify empty DB case handling
      if (!rows || rows.length === 0) {
        Logger.info(`Empty DB case: rows.length=0 -> returning ${invoiceNumber}`);
      }

      Logger.info('Next invoice number generated successfully', {
        invoiceNumber,
        userId: context.userId,
        year: currentYear,
        nextNumber,
      });

      return invoiceNumber;
    } catch (error) {
      // Enhanced error logging
      const errorDetails = {
        userId: req?.session?.user?.id,
        currentTenantUserId: req?.session?.currentTenantUserId,
        errorMessage: error?.message,
        errorName: error?.name,
        errorCode: error?.code,
        errorStack: error?.stack?.substring(0, 500), // Limit stack trace
        hasDatabase: false,
        hasContext: false,
      };

      try {
        const database = ServiceManager.get('database', req);
        errorDetails.hasDatabase = !!database;
        errorDetails.hasDatabasePool = !!(database && database.pool);

        const context = this._getContext(req);
        errorDetails.hasContext = !!context;
        errorDetails.contextUserId = context?.userId;
      } catch (e) {
        // Ignore errors when trying to get context for logging
      }

      Logger.error('Failed to get next invoice number - DETAILED ERROR', error, errorDetails);

      // Return more descriptive error message
      if (error instanceof AppError) {
        throw error;
      }

      // Check for specific database errors
      if (error?.code === '42P01') {
        // Table does not exist
        throw new AppError(
          'Invoices table not found. Please run database migrations.',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
        // Connection error
        throw new AppError(
          'Database connection failed. Please check your database configuration.',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      // Generic error with original message
      throw new AppError(
        `Failed to get next invoice number: ${error?.message || 'Unknown database error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  // Create invoice
  async create(req, invoiceData) {
    try {
      Logger.info('Creating invoice', {
        hasInvoiceNumber: !!invoiceData.invoiceNumber,
        userId: req?.session?.user?.id,
        currentTenantUserId: req?.session?.currentTenantUserId,
        hasTenantPool: !!req?.tenantPool,
        hasTenantConnectionString: !!req?.session?.tenantConnectionString,
      });

      const database = ServiceManager.get('database', req);
      const context = this._getContext(req);

      Logger.info('Context retrieved', {
        userId: context.userId,
        hasPool: !!context.pool,
      });

      let invoiceNumber;
      if (invoiceData.invoiceNumber) {
        invoiceNumber = invoiceData.invoiceNumber;
        Logger.info('Using provided invoice number', { invoiceNumber });
      } else {
        Logger.info('Getting next invoice number...');
        invoiceNumber = await this.getNextInvoiceNumber(req);
        Logger.info('Got next invoice number', { invoiceNumber });
      }
      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        invoiceDiscountAmount,
        subtotalAfterInvoiceDiscount,
        totalVat,
        total,
      } = this.calculateTotals(invoiceData.lineItems || [], invoiceData.invoiceDiscount || 0);

      // Convert contactId to int if it's a string
      const contactId = invoiceData.contactId
        ? typeof invoiceData.contactId === 'string'
          ? parseInt(invoiceData.contactId, 10)
          : invoiceData.contactId
        : null;
      const estimateId = invoiceData.estimateId
        ? typeof invoiceData.estimateId === 'string'
          ? parseInt(invoiceData.estimateId, 10)
          : invoiceData.estimateId
        : null;

      // Format dates for PostgreSQL (accept ISO strings, Date objects, or null)
      const formatDateForDB = (dateValue) => {
        if (!dateValue) return null;
        if (dateValue instanceof Date) {
          return dateValue.toISOString();
        }
        if (typeof dateValue === 'string') {
          // If already ISO string, return as-is (PostgreSQL accepts ISO format)
          // If it's a date-only string (YYYY-MM-DD), convert to timestamp
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return new Date(dateValue + 'T12:00:00Z').toISOString();
          }
          return dateValue; // Assume already ISO format
        }
        return null;
      };

      const issueDate = formatDateForDB(invoiceData.issueDate);
      const dueDate = formatDateForDB(invoiceData.dueDate);

      Logger.info('Preparing invoice data for insert', {
        invoiceNumber,
        contactId,
        issueDate,
        dueDate,
        hasLineItems: !!(invoiceData.lineItems && invoiceData.lineItems.length > 0),
        lineItemsCount: invoiceData.lineItems?.length || 0,
      });

      // Use database.insert for automatic tenant isolation
      const result = await db.insert('invoices', {
        invoice_number: invoiceNumber,
        contact_id: contactId,
        contact_name: invoiceData.contactName || '',
        organization_number: invoiceData.organizationNumber || '',
        currency: invoiceData.currency || 'SEK',
        line_items: JSON.stringify(invoiceData.lineItems || []),
        invoice_discount: invoiceData.invoiceDiscount || 0,
        notes: invoiceData.notes || '',
        payment_terms: invoiceData.paymentTerms || '',
        issue_date: issueDate,
        due_date: dueDate,
        invoice_type: invoiceData.invoiceType || 'invoice',
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        invoice_discount_amount: invoiceDiscountAmount,
        subtotal_after_invoice_discount: subtotalAfterInvoiceDiscount,
        total_vat: totalVat,
        total: total,
        status: invoiceData.status || 'draft',
        paid_at: invoiceData.status === 'paid' ? new Date().toISOString() : null,
        estimate_id: estimateId,
      });

      Logger.info('Invoice created successfully', {
        invoiceId: result.id,
        invoiceNumber,
        userId: context.userId,
      });

      return this.transformRow(result);
    } catch (error) {
      // Enhanced error logging with full context
      Logger.error('Failed to create invoice - DETAILED ERROR', error, {
        userId: req?.session?.user?.id,
        currentTenantUserId: req?.session?.currentTenantUserId,
        invoiceData: {
          invoiceNumber: invoiceData.invoiceNumber,
          contactId: invoiceData.contactId,
          hasLineItems: !!(invoiceData.lineItems && invoiceData.lineItems.length > 0),
          lineItemsCount: invoiceData.lineItems?.length || 0,
          issueDate: invoiceData.issueDate,
          dueDate: invoiceData.dueDate,
          status: invoiceData.status,
        },
        errorCode: error.code,
        errorMessage: error.message,
        errorDetail: error.detail,
        errorHint: error.hint,
        errorStack: error.stack?.substring(0, 1000),
      });

      if (error instanceof AppError) {
        throw error;
      }

      // Return detailed error message
      throw new AppError(
        `Failed to create invoice: ${error.message || 'Unknown database error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
        {
          originalError: error.message,
          errorCode: error.code,
          errorDetail: error.detail,
          errorHint: error.hint,
          constraint: error.constraint,
        },
      );
    }
  }

  // Get all invoices for user
  async getAll(req) {
    try {
      const db = Database.get(req);

      // Tenant isolation automatic
      const rows = await db.query('SELECT * FROM invoices ORDER BY created_at DESC', []);

      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch invoices', error);
      throw new AppError('Failed to fetch invoices', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Get single invoice by ID
  async getById(req, invoiceId) {
    try {
      const db = Database.get(req);

      const rows = await db.query('SELECT * FROM invoices WHERE id = $1', [invoiceId]);

      if (rows.length === 0) {
        return null;
      }

      return this.transformRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to get invoice', error, { invoiceId });
      throw new AppError('Failed to get invoice', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Update invoice
  async update(req, invoiceId, invoiceData) {
    try {
      const db = Database.get(req);

      // Verify invoice exists (ownership check automatic)
      const currentInvoice = await this.getById(req, invoiceId);
      if (!currentInvoice) {
        throw new AppError('Invoice not found', 404, AppError.CODES.NOT_FOUND);
      }

      const isBecomingPaid = currentInvoice.status !== 'paid' && invoiceData.status === 'paid';

      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        invoiceDiscountAmount,
        subtotalAfterInvoiceDiscount,
        totalVat,
        total,
      } = this.calculateTotals(invoiceData.lineItems || [], invoiceData.invoiceDiscount || 0);

      // Convert contactId to int if it's a string
      const contactId = invoiceData.contactId
        ? typeof invoiceData.contactId === 'string'
          ? parseInt(invoiceData.contactId, 10)
          : invoiceData.contactId
        : null;
      const estimateId = invoiceData.estimateId
        ? typeof invoiceData.estimateId === 'string'
          ? parseInt(invoiceData.estimateId, 10)
          : invoiceData.estimateId
        : null;

      // Use database.update for automatic tenant isolation
      const result = await db.update('invoices', invoiceId, {
        contact_id: contactId,
        contact_name: invoiceData.contactName || '',
        organization_number: invoiceData.organizationNumber || '',
        currency: invoiceData.currency || 'SEK',
        line_items: JSON.stringify(invoiceData.lineItems || []),
        invoice_discount: invoiceData.invoiceDiscount || 0,
        notes: invoiceData.notes || '',
        payment_terms: invoiceData.paymentTerms || '',
        issue_date: invoiceData.issueDate || null,
        due_date: invoiceData.dueDate || null,
        invoice_type: invoiceData.invoiceType || 'invoice',
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        invoice_discount_amount: invoiceDiscountAmount,
        subtotal_after_invoice_discount: subtotalAfterInvoiceDiscount,
        total_vat: totalVat,
        total: total,
        status: invoiceData.status || 'draft',
        paid_at: isBecomingPaid ? new Date() : currentInvoice.paidAt,
        estimate_id: estimateId,
      });

      Logger.info('Invoice updated', { invoiceId });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to update invoice', error, { invoiceId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update invoice', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Bulk delete invoices (hybrid approach - pre-delete invoice_shares)
  async bulkDelete(req, idsTextArray) {
    try {
      const pool = req.tenantPool;
      const userId = req.session?.user?.id;

      // First, delete all invoice_shares for these invoices
      if (pool && userId) {
        const ids = Array.isArray(idsTextArray)
          ? idsTextArray.map((x) => String(x).trim()).filter(Boolean)
          : [];
        if (ids.length > 0) {
          // Convert string IDs to integers for INTEGER column comparison
          const integerIds = ids.map((id) => {
            const parsed = parseInt(id, 10);
            if (isNaN(parsed)) {
              throw new AppError(`Invalid ID format: ${id}`, 400, AppError.CODES.VALIDATION_ERROR);
            }
            return parsed;
          });

          // Delete invoice_shares (even though CASCADE handles it, explicit deletion is cleaner)
          await pool.query('DELETE FROM invoice_shares WHERE invoice_id = ANY($1::int[])', [
            integerIds,
          ]);
        }
      }

      // Use core BulkOperationsHelper for generic bulk delete logic
      const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
      return await BulkOperationsHelper.bulkDelete(req, 'invoices', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete invoices', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete invoices', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  // Delete invoice
  async delete(req, invoiceId) {
    try {
      const db = Database.get(req);

      // Delete the invoice (tenant isolation automatic)
      await db.deleteRecord('invoices', invoiceId);

      Logger.info('Invoice deleted', { invoiceId });

      return true;
    } catch (error) {
      Logger.error('Failed to delete invoice', error, { invoiceId });

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
      const db = Database.get(req);
      const pool = context.pool;

      // Verify invoice exists and user owns it
      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const shareToken = this.generateShareToken();

      // Insert share with user_id for tenant isolation
      const result = await pool.query(
        `
        INSERT INTO invoice_shares (user_id, invoice_id, share_token, valid_until)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
        [context.userId, invoiceId, shareToken, validUntil],
      );

      Logger.info('Share created', { invoiceId, shareId: result.rows[0].id });

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
      Logger.error('Failed to create share', error, { invoiceId });

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

      const result = await pool.query(
        `
        SELECT 
          i.*,
          is.accessed_count,
          is.valid_until as share_valid_until
        FROM invoices i
        JOIN invoice_shares is ON i.id = is.invoice_id
        WHERE is.share_token = $1 AND is.valid_until > NOW()
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
        UPDATE invoice_shares 
        SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
        WHERE share_token = $1
      `,
        [shareToken],
      );

      const invoice = this.transformRow(row);
      invoice.shareValidUntil = row.share_valid_until;
      invoice.accessedCount = currentAccessCount + 1;

      return invoice;
    } catch (error) {
      Logger.error('Failed to get invoice by share token', error, {
        shareToken: shareToken.substring(0, 10),
      });
      throw new AppError(
        'Failed to get invoice by share token',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
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

      // Get shares filtered by user_id for tenant isolation
      const result = await pool.query(
        `
        SELECT * FROM invoice_shares 
        WHERE user_id = $1 AND invoice_id = $2 
        ORDER BY created_at DESC
      `,
        [context.userId, invoiceId],
      );

      return result.rows.map((row) => ({
        id: row.id.toString(),
        invoiceId: row.invoice_id.toString(),
        shareToken: row.share_token,
        validUntil: row.valid_until,
        createdAt: row.created_at,
        accessedCount: row.accessed_count,
        lastAccessedAt: row.last_accessed_at,
      }));
    } catch (error) {
      Logger.error('Failed to get shares for invoice', error, { invoiceId });

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
        'SELECT invoice_id FROM invoice_shares WHERE id = $1 AND user_id = $2',
        [shareId, context.userId],
      );

      if (!shareCheck.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      const invoiceId = shareCheck.rows[0].invoice_id;
      const invoice = await this.getById(req, invoiceId);

      if (!invoice) {
        throw new AppError('Share not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      // Delete the share with user_id check for tenant isolation
      const deleteResult = await pool.query(
        'DELETE FROM invoice_shares WHERE id = $1 AND user_id = $2 RETURNING *',
        [shareId, context.userId],
      );

      if (!deleteResult.rows.length) {
        throw new AppError('Share not found', 404, AppError.CODES.NOT_FOUND);
      }

      Logger.info('Share revoked', { shareId, invoiceId });

      return {
        id: deleteResult.rows[0].id.toString(),
        invoiceId: deleteResult.rows[0].invoice_id.toString(),
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
      const result = await pool.query('DELETE FROM invoice_shares WHERE valid_until < NOW()');

      return result.rowCount;
    } catch (error) {
      Logger.error('Failed to clean expired shares', error);
      throw new AppError('Failed to clean expired shares', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = InvoiceModel;
