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
  resolveInvoiceNumberingForType,
  sanitizeInvoiceNumberingType,
  buildInvoiceNumberMatchRegex,
  buildInvoiceNumber,
  parseSequenceFromInvoiceNumber,
} = require('./invoiceNumbering');
const { sanitizeClientInvoiceStatus, derivePaymentStatus } = require('./paymentLedger');
const {
  calculateInvoiceTotals,
  withResolvedInvoiceTotals,
  resolveInvoiceTotals,
} = require('./invoiceTotals');
const {
  buildVatBreakdown,
  deriveContentProfile,
  isIssuedStatus,
  normalizeCurrency,
  validateContentProfile,
  validateVatEngine,
} = require('./vatEngine');
const {
  assertDraftDeletable,
  hasMlFieldMutation,
  resolveIssuedStatusTransition,
} = require('./mlLock');

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

    let vatBreakdown = row.vat_breakdown || null;
    if (typeof vatBreakdown === 'string') {
      try {
        vatBreakdown = JSON.parse(vatBreakdown);
      } catch (e) {
        vatBreakdown = null;
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
      supplyDate: row.supply_date || null,
      dueDate: row.due_date,
      invoiceType: row.invoice_type || 'invoice',
      contentProfile: row.content_profile || 'full',
      creditedInvoiceId: row.credited_invoice_id ? row.credited_invoice_id.toString() : null,
      creditedInvoiceNumber: row.credited_invoice_number || null,
      correctionSummary: row.correction_summary || null,
      vatBreakdown: Array.isArray(vatBreakdown) ? vatBreakdown : null,
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

  _formatDateForDB(dateValue) {
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
  }

  _throwGateError(code, message, field = 'general', statusCode = 400) {
    throw new AppError(message, statusCode, code, {
      errors: [{ field, message }],
    });
  }

  async _resolveCreditLink(req, invoiceType, invoiceData, currentInvoice) {
    const type = sanitizeInvoiceNumberingType(invoiceType);
    if (type !== 'credit_note') {
      return {
        creditedInvoiceId: null,
        creditedInvoiceNumber: null,
        correctionSummary: null,
      };
    }

    const rawId = invoiceData.creditedInvoiceId ?? currentInvoice?.creditedInvoiceId ?? null;
    if (rawId == null || String(rawId).trim() === '') {
      this._throwGateError(
        'CREDIT_LINK_REQUIRED',
        'Credit notes must link to an original invoice.',
        'creditedInvoiceId',
      );
    }

    const creditedId = typeof rawId === 'string' ? parseInt(rawId, 10) : Number(rawId);
    if (!Number.isFinite(creditedId)) {
      this._throwGateError(
        'CREDIT_LINK_REQUIRED',
        'Credit notes must link to an original invoice.',
        'creditedInvoiceId',
      );
    }

    const original = await this.getById(req, creditedId);
    if (!original) {
      this._throwGateError(
        'CREDIT_LINK_REQUIRED',
        'Original invoice not found in this tenant.',
        'creditedInvoiceId',
        404,
      );
    }
    if (sanitizeInvoiceNumberingType(original.invoiceType) !== 'invoice') {
      this._throwGateError(
        'CREDIT_LINK_REQUIRED',
        'Credit notes may only reference a standard invoice.',
        'creditedInvoiceId',
      );
    }
    if (!isIssuedStatus(original.status)) {
      this._throwGateError(
        'CREDIT_LINK_REQUIRED',
        'Credit notes may only reference an issued invoice.',
        'creditedInvoiceId',
      );
    }

    const correctionSummary = String(
      invoiceData.correctionSummary ?? currentInvoice?.correctionSummary ?? '',
    ).trim();
    if (!correctionSummary) {
      this._throwGateError(
        'CORRECTION_SUMMARY_REQUIRED',
        'Describe what changed versus the original invoice.',
        'correctionSummary',
      );
    }

    // Imprint number is server-owned from the original at create; keep on update.
    const creditedInvoiceNumber =
      currentInvoice?.creditedInvoiceNumber || original.invoiceNumber || String(original.id);

    return {
      creditedInvoiceId: creditedId,
      creditedInvoiceNumber,
      correctionSummary,
    };
  }

  /**
   * Shared create/update gate: type, VAT, credit link, content profile, supply date.
   */
  async _buildPersistPayload(req, invoiceData, currentInvoice) {
    const invoiceType = sanitizeInvoiceNumberingType(
      invoiceData.invoiceType ?? currentInvoice?.invoiceType ?? 'invoice',
    );

    if (
      currentInvoice &&
      isIssuedStatus(currentInvoice.status) &&
      hasMlFieldMutation(currentInvoice, {
        ...invoiceData,
        invoiceType,
      })
    ) {
      this._throwGateError(
        'INVOICE_ML_LOCKED',
        'This document is issued and cannot be changed.',
        'general',
        409,
      );
    }

    // Issued rows: only status may move via payment ledger / overdue / canceled path —
    // if caller sent ML fields that match, we still rewrite from current for safety.
    const source =
      currentInvoice && isIssuedStatus(currentInvoice.status)
        ? {
            ...currentInvoice,
            status: invoiceData.status,
          }
        : invoiceData;

    const lineItems = source.lineItems || currentInvoice?.lineItems || [];
    const invoiceDiscount = source.invoiceDiscount ?? currentInvoice?.invoiceDiscount ?? 0;

    const totals = resolveInvoiceTotals({
      invoiceType,
      lineItems,
      invoiceDiscount,
    });

    let status = sanitizeClientInvoiceStatus(source.status, currentInvoice?.status || 'draft');
    const wasDraft = !currentInvoice || !isIssuedStatus(currentInvoice.status);
    const willIssue = wasDraft && isIssuedStatus(status);

    const issueDate = this._formatDateForDB(source.issueDate ?? currentInvoice?.issueDate);
    let supplyDate = this._formatDateForDB(source.supplyDate ?? currentInvoice?.supplyDate);
    if (willIssue && !supplyDate) {
      supplyDate = issueDate;
    }

    const dueDate = this._formatDateForDB(source.dueDate ?? currentInvoice?.dueDate);
    if (status === 'sent' && this.isPastDue(dueDate)) {
      status = 'overdue';
    }

    const currency = normalizeCurrency(source.currency ?? currentInvoice?.currency);
    const vatCheck = validateVatEngine(
      { ...source, currency, lineItems, invoiceType },
      { supplyDate, issuing: willIssue || isIssuedStatus(status) },
    );
    if (!vatCheck.ok) {
      this._throwGateError(vatCheck.code, vatCheck.message, vatCheck.field || 'general');
    }

    const credit = await this._resolveCreditLink(req, invoiceType, source, currentInvoice);

    const profileCheck = validateContentProfile({
      invoiceType,
      contentProfile: source.contentProfile ?? currentInvoice?.contentProfile,
      currency,
      total: totals.total,
    });
    if (!profileCheck.ok) {
      this._throwGateError(
        profileCheck.code,
        profileCheck.message,
        profileCheck.field || 'contentProfile',
      );
    }

    // Soft draft credit notes still need link+summary (same as FE).
    if (invoiceType === 'credit_note' && !willIssue && !isIssuedStatus(status)) {
      // _resolveCreditLink already enforced
    }

    const vatBreakdown = buildVatBreakdown(lineItems, invoiceDiscount);
    const contentProfile =
      profileCheck.contentProfile ||
      deriveContentProfile({ invoiceType, currency, total: totals.total });

    let contactId = source.contactId
      ? typeof source.contactId === 'string'
        ? parseInt(source.contactId, 10)
        : source.contactId
      : null;
    if (currentInvoice && isIssuedStatus(currentInvoice.status)) {
      contactId = currentInvoice.contactId
        ? typeof currentInvoice.contactId === 'string'
          ? parseInt(currentInvoice.contactId, 10)
          : currentInvoice.contactId
        : null;
    }

    const estimateId = source.estimateId
      ? typeof source.estimateId === 'string'
        ? parseInt(source.estimateId, 10)
        : source.estimateId
      : currentInvoice?.estimateId
        ? typeof currentInvoice.estimateId === 'string'
          ? parseInt(currentInvoice.estimateId, 10)
          : currentInvoice.estimateId
        : null;

    return {
      invoiceType,
      willIssue,
      wasDraft,
      status,
      totals,
      vatBreakdown,
      contentProfile,
      currency,
      contactId,
      estimateId,
      issueDate,
      supplyDate,
      dueDate,
      lineItems,
      invoiceDiscount,
      credit,
      contactName: source.contactName ?? currentInvoice?.contactName ?? '',
      organizationNumber: source.organizationNumber ?? currentInvoice?.organizationNumber ?? '',
      notes: source.notes ?? currentInvoice?.notes ?? '',
      paymentTerms: source.paymentTerms ?? currentInvoice?.paymentTerms ?? '',
      orderNumber: source.orderNumber ?? currentInvoice?.orderNumber ?? '',
      deliveryMethod: source.deliveryMethod ?? currentInvoice?.deliveryMethod ?? '',
    };
  }

  async _insertIssueSnapshot(req, invoiceId, snapshotInvoice) {
    const context = this._getContext(req);
    const cryptoHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(snapshotInvoice))
      .digest('hex');
    try {
      await context.pool.query(
        `INSERT INTO invoice_issue_snapshots
           (user_id, invoice_id, content_hash, snapshot_json)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (invoice_id) DO NOTHING`,
        [context.userId, invoiceId, cryptoHash, JSON.stringify(snapshotInvoice)],
      );
    } catch (error) {
      // Table may not exist until migration 164 — surface clearly.
      if (error?.code === '42P01') {
        throw new AppError(
          'Invoice snapshots table not found. Please run database migrations.',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }
      throw error;
    }
  }

  async getIssueSnapshot(req, invoiceId) {
    try {
      const context = this._getContext(req);
      const result = await context.pool.query(
        `SELECT id, invoice_id, issued_at, content_hash, snapshot_json, pdf_bytes, pdf_sha256
         FROM invoice_issue_snapshots
         WHERE invoice_id = $1 AND user_id = $2`,
        [invoiceId, context.userId],
      );
      return result.rows[0] || null;
    } catch (error) {
      if (error?.code === '42P01') {
        return null;
      }
      throw error;
    }
  }

  /** Fill PDF bytes once on an existing snapshot (never overwrite non-null PDF). */
  async fillIssueSnapshotPdf(req, invoiceId, pdfBuffer) {
    const context = this._getContext(req);
    const sha = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
    await context.pool.query(
      `UPDATE invoice_issue_snapshots
       SET pdf_bytes = $1, pdf_sha256 = $2
       WHERE invoice_id = $3 AND user_id = $4 AND pdf_bytes IS NULL`,
      [pdfBuffer, sha, invoiceId, context.userId],
    );
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

  async _loadInvoiceNumbering(req, invoiceType) {
    const userId = Context.getUserId(req);
    const type = sanitizeInvoiceNumberingType(invoiceType);
    if (!userId) {
      return resolveInvoiceNumberingForType(null, type);
    }
    try {
      const ServiceManager = require('../../server/core/ServiceManager');
      const SettingsModel = require('../settings/model');
      const settingsModel = new SettingsModel(ServiceManager.getMainPool());
      const settings = await settingsModel.getCategory(userId, 'invoices');
      return resolveInvoiceNumberingForType(settings, type);
    } catch (error) {
      Logger.warn('Failed to load invoice numbering settings; using defaults', {
        error: error?.message,
        userId,
        invoiceType: type,
      });
      return resolveInvoiceNumberingForType(null, type);
    }
  }

  async getNextInvoiceNumber(req, invoiceType) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;
      const type = sanitizeInvoiceNumberingType(
        invoiceType ?? req?.query?.type ?? req?.body?.invoiceType,
      );
      const { numberPrefix, numberStart, includeYear } = await this._loadInvoiceNumbering(
        req,
        type,
      );

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
              invoiceType: type,
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
      const prepared = await this._buildPersistPayload(req, invoiceData, null);

      const invoiceNumber =
        invoiceData.invoiceNumber || (await this.getNextInvoiceNumber(req, prepared.invoiceType));

      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        invoiceDiscountAmount,
        subtotalAfterInvoiceDiscount,
        totalVat,
        total,
      } = prepared.totals;

      const result = await db.insert('invoices', {
        invoice_number: invoiceNumber,
        contact_id: prepared.contactId,
        contact_name: prepared.contactName || '',
        organization_number: prepared.organizationNumber || '',
        currency: prepared.currency,
        line_items: JSON.stringify(prepared.lineItems || []),
        invoice_discount: prepared.invoiceDiscount || 0,
        notes: prepared.notes || '',
        payment_terms: prepared.paymentTerms || '',
        order_number: prepared.orderNumber || '',
        delivery_method: prepared.deliveryMethod || '',
        issue_date: prepared.issueDate,
        supply_date: prepared.supplyDate,
        due_date: prepared.dueDate,
        invoice_type: prepared.invoiceType,
        content_profile: prepared.contentProfile,
        credited_invoice_id: prepared.credit.creditedInvoiceId,
        credited_invoice_number: prepared.credit.creditedInvoiceNumber,
        correction_summary: prepared.credit.correctionSummary,
        vat_breakdown: JSON.stringify(prepared.vatBreakdown || []),
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        invoice_discount_amount: invoiceDiscountAmount,
        subtotal_after_invoice_discount: subtotalAfterInvoiceDiscount,
        total_vat: totalVat,
        total: total,
        status: prepared.status,
        paid_at: null,
        amount_paid: 0,
        estimate_id: prepared.estimateId,
      });

      const created = this.transformRow(result);

      if (prepared.willIssue && created?.id) {
        await this._insertIssueSnapshot(req, created.id, created);
      }

      Logger.info('Invoice created successfully', {
        invoiceId: result.id,
        invoiceNumber,
      });

      return created;
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

      // Issued: never rewrite ML columns. Status-only allowlist; ignore ML body (B2).
      // Refuse unlock via draft (B1).
      if (isIssuedStatus(currentInvoice.status)) {
        const transition = resolveIssuedStatusTransition(
          currentInvoice.status,
          invoiceData.status,
          { isPastDue: this.isPastDue(currentInvoice.dueDate) },
        );
        if (!transition.ok) {
          this._throwGateError(transition.code, transition.message, 'status', 409);
        }
        if (transition.status !== currentInvoice.status) {
          await db.update('invoices', invoiceId, { status: transition.status });
        }
        return this.refreshInvoicePaymentState(req, invoiceId);
      }

      const prepared = await this._buildPersistPayload(req, invoiceData, currentInvoice);
      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        invoiceDiscountAmount,
        subtotalAfterInvoiceDiscount,
        totalVat,
        total,
      } = prepared.totals;

      await db.update('invoices', invoiceId, {
        contact_id: prepared.contactId,
        contact_name: prepared.contactName || '',
        organization_number: prepared.organizationNumber || '',
        currency: prepared.currency,
        line_items: JSON.stringify(prepared.lineItems || []),
        invoice_discount: prepared.invoiceDiscount || 0,
        notes: prepared.notes || '',
        payment_terms: prepared.paymentTerms || '',
        order_number: prepared.orderNumber || '',
        delivery_method: prepared.deliveryMethod || '',
        issue_date: prepared.issueDate,
        supply_date: prepared.supplyDate,
        due_date: prepared.dueDate,
        invoice_type: prepared.invoiceType,
        content_profile: prepared.contentProfile,
        credited_invoice_id: prepared.credit.creditedInvoiceId,
        credited_invoice_number: prepared.credit.creditedInvoiceNumber,
        correction_summary: prepared.credit.correctionSummary,
        vat_breakdown: JSON.stringify(prepared.vatBreakdown || []),
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        invoice_discount_amount: invoiceDiscountAmount,
        subtotal_after_invoice_discount: subtotalAfterInvoiceDiscount,
        total_vat: totalVat,
        total: total,
        status: prepared.status,
        estimate_id: prepared.estimateId,
      });

      Logger.info('Invoice updated', { invoiceId });

      const refreshed = await this.refreshInvoicePaymentState(req, invoiceId);

      if (prepared.willIssue) {
        await this._insertIssueSnapshot(req, invoiceId, refreshed);
      }

      return refreshed;
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

      const ids = Array.isArray(idsTextArray)
        ? idsTextArray.map((x) => String(x).trim()).filter(Boolean)
        : [];
      if (ids.length > 0) {
        for (const id of ids) {
          const invoice = await this.getById(req, id);
          if (invoice) {
            try {
              assertDraftDeletable(invoice);
            } catch (lockErr) {
              throw new AppError(lockErr.message, 409, 'INVOICE_ML_LOCKED', {
                errors: [{ field: 'general', message: lockErr.message }],
              });
            }
          }
        }
      }

      if (pool && userId) {
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
      const invoice = await this.getById(req, invoiceId);
      if (!invoice) {
        throw new AppError('Invoice not found', 404, AppError.CODES.NOT_FOUND);
      }
      try {
        assertDraftDeletable(invoice);
      } catch (lockErr) {
        throw new AppError(lockErr.message, 409, 'INVOICE_ML_LOCKED', {
          errors: [{ field: 'general', message: lockErr.message }],
        });
      }
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
