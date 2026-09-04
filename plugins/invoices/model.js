// plugins/invoices/model.js
// Invoices model - V3 with @homebase/core SDK
const crypto = require('crypto');
const { Logger, Database, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
const {
  registerPublicShareRoute,
  RESOURCE_INVOICE,
} = require('../../server/core/services/publicShareRouting');
const {
  resolveTenantConnectionStringForShare,
} = require('../../server/core/utils/shareRoutingHelper');
const {
  resolveInvoiceNumbering,
  buildInvoiceNumberMatchRegex,
  buildInvoiceNumber,
  parseSequenceFromInvoiceNumber,
} = require('./invoiceNumbering');
const { sanitizeClientInvoiceStatus, derivePaymentStatus } = require('./paymentLedger');
const { calculateInvoiceTotals, withResolvedInvoiceTotals } = require('./invoiceTotals');

class InvoiceModel {
  constructor() {
    // No pool needed - ServiceManager provides database service
  }

  _getContext(req) {
    if (!req) {
      throw new Error('Request object is required');
    }

    const pool = req.tenantPool;
    if (!pool) {
      throw new Error('Tenant pool not found in request. Ensure auth middleware is applied.');
    }

    return {
      pool,
      userId: req.session?.currentTenantUserId || req.session?.user?.id,
    };
  }

  /** @deprecated Prefer calculateInvoiceTotals from ./invoiceTotals — kept as instance method for call sites. */
  calculateTotals(lineItems, invoiceDiscount = 0) {
    return calculateInvoiceTotals(lineItems, invoiceDiscount);
  }

  /**
   * Auto-overdue: sent invoices past due date become overdue.
   * paid / canceled / draft are never auto-changed.
   */
  isPastDue(dueDate) {
    if (!dueDate) {
      return false;
    }
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);
    return dueDay.getTime() < today.getTime();
  }

  applyEffectiveStatus(invoice) {
    if (!invoice) {
      return invoice;
    }
    if (
      invoice.status === 'sent' &&
      this.isPastDue(invoice.dueDate) &&
      invoice.status !== 'paid' &&
      invoice.status !== 'canceled'
    ) {
      return { ...invoice, status: 'overdue' };
    }
    return invoice;
  }

  /** Persist overdue status for all eligible invoices (idempotent). */
  async markOverdueInvoices(req) {
    try {
      const db = Database.get(req);
      await db.query(
        `UPDATE invoices
         SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
         WHERE status = 'sent'
           AND due_date IS NOT NULL
           AND due_date::date < CURRENT_DATE`,
        [],
      );
    } catch (error) {
      Logger.warn('Failed to mark overdue invoices', { message: error?.message });
    }
  }

  transformRow(row) {
    if (!row) return null;

    let lineItems = row.line_items || [];
    if (typeof lineItems === 'string') {
      try {
        lineItems = JSON.parse(lineItems);
      } catch (e) {
        lineItems = [];
      }
    }

    const invoice = {
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
      orderNumber: row.order_number || '',
      deliveryMethod: row.delivery_method || '',
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
      amountPaid: parseFloat(row.amount_paid || 0),
      estimateId: row.estimate_id ? row.estimate_id.toString() : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    return this.applyEffectiveStatus(withResolvedInvoiceTotals(invoice));
  }

  transformPaymentRow(row) {
    if (!row) return null;
    return {
      id: row.id.toString(),
      invoiceId: row.invoice_id.toString(),
      amount: parseFloat(row.amount || 0),
      paidOn: row.paid_on,
      reference: row.reference || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async refreshInvoicePaymentState(req, invoiceId) {
    const db = Database.get(req);
    const invoice = await this.getById(req, invoiceId);
    if (!invoice) {
      throw new AppError('Invoice not found', 404, AppError.CODES.NOT_FOUND);
    }

    const sumRows = await db.query(
      'SELECT COALESCE(SUM(amount), 0) AS total_paid FROM invoice_payments WHERE invoice_id = $1',
      [invoiceId],
    );
    const amountPaid = Math.round(parseFloat(sumRows[0]?.total_paid || 0) * 100) / 100;
    const derived = derivePaymentStatus({
      currentStatus: invoice.status,
      amountPaid,
      total: invoice.total,
      dueDate: invoice.dueDate,
      isPastDue: (d) => this.isPastDue(d),
      currentPaidAt: invoice.paidAt,
    });

    const updatedRows = await db.query(
      `UPDATE invoices
       SET amount_paid = $1, status = $2, paid_at = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [derived.amountPaid, derived.status, derived.paidAt, invoiceId],
    );

    if (!updatedRows?.length) {
      throw new AppError(
        'Failed to update invoice payment state',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }

    Logger.info('Invoice payment state refreshed', {
      invoiceId,
      amountPaid: derived.amountPaid,
      status: derived.status,
      previousStatus: invoice.status,
    });

    return this.transformRow(updatedRows[0]);
  }

  async _loadInvoiceNumbering(req) {
    const userId = Context.getUserId(req);
    if (!userId) {
      return resolveInvoiceNumbering(null);
    }
    try {
      const ServiceManager = require('../../server/core/ServiceManager');
      const SettingsModel = require('../settings/model');
      const settingsModel = new SettingsModel(ServiceManager.getMainPool());
      const settings = await settingsModel.getCategory(userId, 'invoices');
      return resolveInvoiceNumbering(settings);
    } catch (error) {
      Logger.warn('Failed to load invoice numbering settings; using defaults', {
        error: error?.message,
        userId,
      });
      return resolveInvoiceNumbering(null);
    }
  }

  async getNextInvoiceNumber(req) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;
      const { numberPrefix, numberStart, includeYear } = await this._loadInvoiceNumbering(req);

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const currentYear = new Date().getFullYear();
        const matchRegex = buildInvoiceNumberMatchRegex(numberPrefix, currentYear, includeYear);
        let attempts = 0;
        const maxAttempts = 100;

        do {
          const result = await client.query(
            `
            SELECT invoice_number
            FROM invoices
            WHERE invoice_number ~ $1
            ORDER BY COALESCE(
              NULLIF(substring(invoice_number from '[0-9]+$'), '')::int,
              0
            ) DESC
            LIMIT 1
          `,
            [matchRegex],
          );

          let nextNumber = numberStart;
          if (result.rows.length > 0 && result.rows[0].invoice_number) {
            const parsed = parseSequenceFromInvoiceNumber(
              result.rows[0].invoice_number,
              numberPrefix,
              currentYear,
              includeYear,
            );
            if (parsed != null) {
              nextNumber = Math.max(parsed + 1, numberStart);
            }
          }

          // Collision retries bump the sequence (e.g. race with another create).
          nextNumber += attempts;

          const invoiceNumber = buildInvoiceNumber(
            numberPrefix,
            currentYear,
            nextNumber,
            includeYear,
          );

          const checkResult = await client.query(
            'SELECT id FROM invoices WHERE invoice_number = $1',
            [invoiceNumber],
          );

          if (checkResult.rows.length === 0) {
            await client.query('COMMIT');
            Logger.info('Next invoice number generated', {
              invoiceNumber,
              numberPrefix,
              numberStart,
              includeYear,
            });
            return invoiceNumber;
          }

          attempts += 1;
          if (attempts >= maxAttempts) {
            await client.query('ROLLBACK');
            throw new AppError(
              'Failed to allocate unique invoice number',
              500,
              AppError.CODES.DATABASE_ERROR,
            );
          }
        } while (true);
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (_) {
          /* ignore */
        }
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      Logger.error('Failed to get next invoice number', error);

      if (error instanceof AppError) {
        throw error;
      }

      if (error?.code === '42P01') {
        throw new AppError(
          'Invoices table not found. Please run database migrations.',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      throw new AppError(
        `Failed to get next invoice number: ${error?.message || 'Unknown database error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    }
  }

  async create(req, invoiceData) {
    try {
      const db = Database.get(req);

      const invoiceNumber = invoiceData.invoiceNumber || (await this.getNextInvoiceNumber(req));
      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        invoiceDiscountAmount,
        subtotalAfterInvoiceDiscount,
        totalVat,
        total,
      } = this.calculateTotals(invoiceData.lineItems || [], invoiceData.invoiceDiscount || 0);

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

      const formatDateForDB = (dateValue) => {
        if (!dateValue) return null;
        if (dateValue instanceof Date) {
          return dateValue.toISOString();
        }
        if (typeof dateValue === 'string') {
          if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            return new Date(dateValue + 'T12:00:00Z').toISOString();
          }
          return dateValue;
        }
        return null;
      };

      const issueDate = formatDateForDB(invoiceData.issueDate);
      const dueDate = formatDateForDB(invoiceData.dueDate);

      let status = sanitizeClientInvoiceStatus(invoiceData.status, 'draft');
      if (status === 'sent' && this.isPastDue(dueDate)) {
        status = 'overdue';
      }

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
        order_number: invoiceData.orderNumber || '',
        delivery_method: invoiceData.deliveryMethod || '',
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
        status,
        paid_at: null,
        amount_paid: 0,
        estimate_id: estimateId,
      });

      Logger.info('Invoice created successfully', {
        invoiceId: result.id,
        invoiceNumber,
      });

      return this.transformRow(result);
    } catch (error) {
      Logger.error('Failed to create invoice', error, {
        invoiceNumber: invoiceData.invoiceNumber,
        contactId: invoiceData.contactId,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        `Failed to create invoice: ${error.message || 'Unknown database error'}`,
        500,
        AppError.CODES.DATABASE_ERROR,
        {
          originalError: error.message,
          errorCode: error.code,
        },
      );
    }
  }

  async getAll(req) {
    try {
      await this.markOverdueInvoices(req);
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM invoices ORDER BY created_at DESC', []);
      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch invoices', error);
      throw new AppError('Failed to fetch invoices', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, invoiceId) {
    try {
      await this.markOverdueInvoices(req);
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

  async update(req, invoiceId, invoiceData) {
    try {
      const db = Database.get(req);

      const currentInvoice = await this.getById(req, invoiceId);
      if (!currentInvoice) {
        throw new AppError('Invoice not found', 404, AppError.CODES.NOT_FOUND);
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

      let contactId = invoiceData.contactId
        ? typeof invoiceData.contactId === 'string'
          ? parseInt(invoiceData.contactId, 10)
          : invoiceData.contactId
        : null;
      // Customer is immutable once the invoice leaves draft.
      if (currentInvoice.status && currentInvoice.status !== 'draft') {
        contactId = currentInvoice.contactId
          ? typeof currentInvoice.contactId === 'string'
            ? parseInt(currentInvoice.contactId, 10)
            : currentInvoice.contactId
          : null;
        invoiceData.contactName = currentInvoice.contactName;
        invoiceData.organizationNumber = currentInvoice.organizationNumber;
      }
      const estimateId = invoiceData.estimateId
        ? typeof invoiceData.estimateId === 'string'
          ? parseInt(invoiceData.estimateId, 10)
          : invoiceData.estimateId
        : null;

      // amountPaid / paid / partially_paid are owned by invoice_payments (refresh below).
      let status = sanitizeClientInvoiceStatus(invoiceData.status, currentInvoice.status);
      if (status === 'sent' && this.isPastDue(invoiceData.dueDate || currentInvoice.dueDate)) {
        status = 'overdue';
      }

      await db.update('invoices', invoiceId, {
        contact_id: contactId,
        contact_name: invoiceData.contactName || '',
        organization_number: invoiceData.organizationNumber || '',
        currency: invoiceData.currency || 'SEK',
        line_items: JSON.stringify(invoiceData.lineItems || []),
        invoice_discount: invoiceData.invoiceDiscount || 0,
        notes: invoiceData.notes || '',
        payment_terms: invoiceData.paymentTerms || '',
        order_number: invoiceData.orderNumber || '',
        delivery_method: invoiceData.deliveryMethod || '',
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
        status,
        estimate_id: estimateId,
      });

      Logger.info('Invoice updated', { invoiceId });

      // Reconcile denormalized amount_paid + payment-derived status from ledger.
      return this.refreshInvoicePaymentState(req, invoiceId);
    } catch (error) {
      Logger.error('Failed to update invoice', error, { invoiceId });

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to update invoice', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async bulkDelete(req, idsTextArray) {
    try {
      const pool = req.tenantPool;
      const userId = req.session?.user?.id;

      if (pool && userId) {
        const ids = Array.isArray(idsTextArray)
          ? idsTextArray.map((x) => String(x).trim()).filter(Boolean)
          : [];
        if (ids.length > 0) {
          const integerIds = ids.map((id) => {
            const parsed = parseInt(id, 10);
            if (isNaN(parsed)) {
              throw new AppError(`Invalid ID format: ${id}`, 400, AppError.CODES.VALIDATION_ERROR);
            }
            return parsed;
          });

          await pool.query('DELETE FROM invoice_shares WHERE invoice_id = ANY($1::int[])', [
            integerIds,
          ]);
        }
      }

      return await BulkOperationsHelper.bulkDelete(req, 'invoices', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete invoices', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete invoices', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, invoiceId) {
    try {
      const db = Database.get(req);
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
      const context = this._getContext(req);
      const pool = context.pool;

      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

      const shareToken = this.generateShareToken();

      const result = await pool.query(
        `
        INSERT INTO invoice_shares (user_id, invoice_id, share_token, valid_until)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
        [context.userId, invoiceId, shareToken, validUntil],
      );

      Logger.info('Share created', { invoiceId, shareId: result.rows[0].id });

      const createdToken = result.rows[0].share_token;
      const tenantConnectionString = await resolveTenantConnectionStringForShare(req);
      if (tenantConnectionString) {
        try {
          await registerPublicShareRoute(createdToken, RESOURCE_INVOICE, tenantConnectionString);
        } catch (routeErr) {
          Logger.error('public_share_routing register failed', routeErr, {
            invoiceId,
            tokenPrefix: createdToken.substring(0, 8),
          });
        }
      } else {
        Logger.warn(
          'Invoice share created in tenant DB but public_share_routing not registered (no tenant connection string)',
          { invoiceId },
        );
      }

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

  async getInvoiceByShareToken(req, shareToken) {
    try {
      const pool = req.tenantPool || this._getContext(req).pool;

      const result = await pool.query(
        `
        SELECT 
          i.*,
          ins.accessed_count,
          ins.valid_until as share_valid_until,
          ins.user_id as share_owner_user_id
        FROM invoices i
        JOIN invoice_shares ins ON i.id = ins.invoice_id
        WHERE ins.share_token = $1 AND ins.valid_until > NOW()
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
      invoice.shareOwnerUserId = row.share_owner_user_id;

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
      const context = this._getContext(req);
      const pool = context.pool;

      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found or access denied', 404, AppError.CODES.NOT_FOUND);
      }

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
      const context = this._getContext(req);
      const pool = context.pool;

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

  // === Payments ===

  async getPaymentsForInvoice(req, invoiceId) {
    try {
      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found', 404, AppError.CODES.NOT_FOUND);
      }
      const db = Database.get(req);
      const rows = await db.query(
        'SELECT * FROM invoice_payments WHERE invoice_id = $1 ORDER BY paid_on DESC, id DESC',
        [invoiceId],
      );
      return rows.map((row) => this.transformPaymentRow(row));
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to get invoice payments', error, { invoiceId });
      throw new AppError('Failed to get invoice payments', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async createPayment(req, invoiceId, paymentData) {
    try {
      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found', 404, AppError.CODES.NOT_FOUND);
      }
      if (invoice.status === 'canceled') {
        throw new AppError(
          'Cannot record payment on a canceled invoice',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }
      const amount = Number(paymentData.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError(
          'Payment amount must be greater than 0',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const context = this._getContext(req);
      const db = Database.get(req);
      const paidOn = paymentData.paidOn || new Date().toISOString().slice(0, 10);
      const rows = await db.query(
        `INSERT INTO invoice_payments (invoice_id, amount, paid_on, reference, user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [invoiceId, amount, paidOn, paymentData.reference || '', context.userId],
      );

      const payment = this.transformPaymentRow(rows[0]);
      const updatedInvoice = await this.refreshInvoicePaymentState(req, invoiceId);
      Logger.info('Invoice payment recorded', { invoiceId, paymentId: payment.id });
      return { payment, invoice: updatedInvoice };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to create invoice payment', error, { invoiceId });
      throw new AppError('Failed to create invoice payment', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async deletePayment(req, paymentId) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM invoice_payments WHERE id = $1', [paymentId]);
      if (!rows.length) {
        throw new AppError('Payment not found', 404, AppError.CODES.NOT_FOUND);
      }
      const invoiceId = rows[0].invoice_id;
      await db.query('DELETE FROM invoice_payments WHERE id = $1', [paymentId]);
      const updatedInvoice = await this.refreshInvoicePaymentState(req, invoiceId);
      Logger.info('Invoice payment deleted', { paymentId, invoiceId });
      return { invoice: updatedInvoice };
    } catch (error) {
      if (error instanceof AppError) throw error;
      Logger.error('Failed to delete invoice payment', error, { paymentId });
      throw new AppError('Failed to delete invoice payment', 500, AppError.CODES.DATABASE_ERROR);
    }
  }
}

module.exports = InvoiceModel;
