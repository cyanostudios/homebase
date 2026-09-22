// plugins/estimates/model.js
// Estimates model - V3 with @homebase/core SDK
const crypto = require('crypto');
const { Logger, Database } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');
const ServiceManager = require('../../server/core/ServiceManager');
const BulkOperationsHelper = require('../../server/core/helpers/BulkOperationsHelper');
const {
  registerPublicShareRoute,
  resolvePublicShareTenantFromToken,
  RESOURCE_ESTIMATE,
} = require('../../server/core/services/publicShareRouting');
const {
  resolveTenantConnectionStringForShare,
} = require('../../server/core/utils/shareRoutingHelper');
const { calculateEstimateTotals, normalizeEstimateLineItems } = require('./estimateTotals');
const {
  resolveEstimateNumbering,
  buildInvoiceNumberMatchRegex,
  buildInvoiceNumber,
  parseSequenceFromInvoiceNumber,
} = require('./estimateNumbering');
const { assertClientEstimateStatus } = require('./estimateStatus');
const { isPluginEnabledForRequest } = require('./pluginAccess');
const { calculateInvoiceTotals } = require('../invoices/invoiceTotals');
const InvoiceModel = require('../invoices/model');

class EstimateModel {
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

  calculateTotals(lineItems, estimateDiscount = 0) {
    return calculateEstimateTotals(lineItems, estimateDiscount);
  }

  async _loadEstimateNumbering(req) {
    const context = this._getContext(req);
    const userId = context.userId;
    try {
      const SettingsModel = require('../settings/model');
      const settingsModel = new SettingsModel(ServiceManager.getMainPool());
      const settings = await settingsModel.getCategory(userId, 'estimates');
      return resolveEstimateNumbering(settings);
    } catch (error) {
      Logger.warn('Failed to load estimate numbering settings; using defaults', {
        error: error?.message,
        userId,
      });
      return resolveEstimateNumbering(null);
    }
  }

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
      orderNumber: row.order_number || '',
      deliveryMethod: row.delivery_method || '',
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

  async getNextEstimateNumber(req) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;
      const { numberPrefix, numberStart, includeYear } = await this._loadEstimateNumbering(req);

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
            SELECT estimate_number
            FROM estimates
            WHERE estimate_number ~ $1
            ORDER BY COALESCE(
              NULLIF(substring(estimate_number from '[0-9]+$'), '')::int,
              0
            ) DESC
            LIMIT 1
          `,
            [matchRegex],
          );

          let nextNumber = numberStart;
          if (result.rows.length > 0 && result.rows[0].estimate_number) {
            const parsed = parseSequenceFromInvoiceNumber(
              result.rows[0].estimate_number,
              numberPrefix,
              currentYear,
              includeYear,
            );
            if (parsed != null) {
              nextNumber = Math.max(parsed + 1, numberStart);
            }
          }

          nextNumber += attempts;

          const estimateNumber = buildInvoiceNumber(
            numberPrefix,
            currentYear,
            nextNumber,
            includeYear,
          );

          const checkResult = await client.query(
            'SELECT id FROM estimates WHERE estimate_number = $1',
            [estimateNumber],
          );

          if (checkResult.rows.length === 0) {
            await client.query('COMMIT');
            return estimateNumber;
          }

          attempts += 1;
          if (attempts >= maxAttempts) {
            await client.query('ROLLBACK');
            throw new AppError(
              'Could not find available estimate number',
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
      Logger.error('Failed to get next estimate number', error);

      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to get next estimate number', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async create(req, estimateData) {
    try {
      const db = Database.get(req);

      const estimateNumber = estimateData.estimateNumber || (await this.getNextEstimateNumber(req));
      const lineItems = normalizeEstimateLineItems(estimateData.lineItems || []);
      const status = assertClientEstimateStatus(estimateData.status, 'draft');
      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        estimateDiscountAmount,
        subtotalAfterEstimateDiscount,
        totalVat,
        total,
      } = this.calculateTotals(lineItems, estimateData.estimateDiscount || 0);

      const result = await db.insert('estimates', {
        estimate_number: estimateNumber,
        contact_id: estimateData.contactId || null,
        contact_name: estimateData.contactName || '',
        organization_number: estimateData.organizationNumber || '',
        currency: estimateData.currency || 'SEK',
        line_items: JSON.stringify(lineItems),
        estimate_discount: estimateData.estimateDiscount || 0,
        notes: estimateData.notes || '',
        order_number: estimateData.orderNumber || '',
        delivery_method: estimateData.deliveryMethod || '',
        valid_to: estimateData.validTo || null,
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        estimate_discount_amount: estimateDiscountAmount,
        subtotal_after_estimate_discount: subtotalAfterEstimateDiscount,
        total_vat: totalVat,
        total: total,
        status,
        acceptance_reasons: JSON.stringify(estimateData.acceptanceReasons || []),
        rejection_reasons: JSON.stringify(estimateData.rejectionReasons || []),
        status_changed_at: status === 'accepted' || status === 'rejected' ? new Date() : null,
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

  async getAll(req) {
    try {
      const db = Database.get(req);

      const rows = await db.query('SELECT * FROM estimates ORDER BY created_at DESC', []);

      return rows.map((row) => this.transformRow(row));
    } catch (error) {
      Logger.error('Failed to fetch estimates', error);
      throw new AppError('Failed to fetch estimates', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async getById(req, estimateId) {
    try {
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM estimates WHERE id = $1', [estimateId]);
      if (rows.length === 0) {
        return null;
      }
      return this.transformRow(rows[0]);
    } catch (error) {
      Logger.error('Failed to get estimate', error, { estimateId });
      throw new AppError('Failed to get estimate', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async update(req, estimateId, estimateData) {
    try {
      const db = Database.get(req);

      const currentEstimate = await this.getById(req, estimateId);
      if (!currentEstimate) {
        throw new AppError('Estimate not found', 404, AppError.CODES.NOT_FOUND);
      }

      if (currentEstimate.status === 'invoiced') {
        throw new AppError(
          'Invoiced estimates cannot be edited',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const nextStatus = assertClientEstimateStatus(
        estimateData.status,
        currentEstimate.status || 'draft',
      );
      const isStatusChanging = currentEstimate.status !== nextStatus;
      const isBecomingAcceptedOrRejected = nextStatus === 'accepted' || nextStatus === 'rejected';

      const lineItems = normalizeEstimateLineItems(estimateData.lineItems || []);
      const {
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        estimateDiscountAmount,
        subtotalAfterEstimateDiscount,
        totalVat,
        total,
      } = this.calculateTotals(lineItems, estimateData.estimateDiscount || 0);

      const result = await db.update('estimates', estimateId, {
        contact_id: estimateData.contactId || null,
        contact_name: estimateData.contactName || '',
        organization_number: estimateData.organizationNumber || '',
        currency: estimateData.currency || 'SEK',
        line_items: JSON.stringify(lineItems),
        estimate_discount: estimateData.estimateDiscount || 0,
        notes: estimateData.notes || '',
        order_number: estimateData.orderNumber ?? currentEstimate.orderNumber ?? '',
        delivery_method: estimateData.deliveryMethod ?? currentEstimate.deliveryMethod ?? '',
        valid_to: estimateData.validTo || null,
        subtotal: subtotal,
        total_discount: totalDiscount,
        subtotal_after_discount: subtotalAfterDiscount,
        estimate_discount_amount: estimateDiscountAmount,
        subtotal_after_estimate_discount: subtotalAfterEstimateDiscount,
        total_vat: totalVat,
        total: total,
        status: nextStatus,
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
      return await BulkOperationsHelper.bulkDelete(req, 'estimates', idsTextArray);
    } catch (error) {
      Logger.error('Failed to bulk delete estimates', error);
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to bulk delete estimates', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async delete(req, estimateId) {
    try {
      const db = Database.get(req);

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

  async getStatusStats(req, startDate = null, endDate = null) {
    try {
      const db = Database.get(req);

      let dateFilter = '';
      let params = [];

      if (startDate && endDate) {
        dateFilter = 'AND status_changed_at BETWEEN $1 AND $2';
        params = [startDate, endDate];
      }

      const rows = await db.query(
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

      return rows.map((row) => {
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

  async getReasonStats(req, status, startDate = null, endDate = null) {
    try {
      const db = Database.get(req);

      let dateFilter = '';
      let params = [status];

      if (startDate && endDate) {
        dateFilter = 'AND status_changed_at BETWEEN $2 AND $3';
        params = [status, startDate, endDate];
      }

      const reasonField = status === 'accepted' ? 'acceptance_reasons' : 'rejection_reasons';

      const rows = await db.query(
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
      const context = this._getContext(req);
      const pool = context.pool;

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

      const createdToken = result.rows[0].share_token;
      const tenantConnectionString = await resolveTenantConnectionStringForShare(req);
      if (tenantConnectionString) {
        try {
          await registerPublicShareRoute(createdToken, RESOURCE_ESTIMATE, tenantConnectionString);
        } catch (routeErr) {
          Logger.error('public_share_routing register failed', routeErr, {
            estimateId,
            tokenPrefix: createdToken.substring(0, 8),
          });
        }
      } else {
        Logger.warn(
          'Estimate share created in tenant DB but public_share_routing not registered (no tenant connection string)',
          { estimateId },
        );
      }

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

  async getEstimateByShareToken(req, shareToken) {
    try {
      await resolvePublicShareTenantFromToken(req, RESOURCE_ESTIMATE, shareToken);
      if (!req.tenantPool) {
        return null;
      }
      const pool = req.tenantPool;

      const result = await pool.query(
        `
        SELECT 
          e.*,
          es.accessed_count,
          es.valid_until as share_valid_until,
          e.user_id as share_owner_user_id
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
      estimate.shareOwnerUserId = row.share_owner_user_id;

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

      // Check if table doesn't exist (common migration issue)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        Logger.error('estimate_shares table does not exist. Please run migrations.', error, {
          estimateId,
        });
        throw new AppError(
          'Shares table not found. Please run database migrations.',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }

      throw new AppError('Failed to get shares for estimate', 500, AppError.CODES.DATABASE_ERROR);
    }
  }

  async revokeShare(req, shareId) {
    try {
      const context = this._getContext(req);
      const pool = context.pool;

      // Get estimate_id first, then verify ownership before deleting
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

  async _allocateNextInvoiceNumberInTransaction(client, req) {
    const invoiceModel = new InvoiceModel();
    const { numberPrefix, numberStart, includeYear } = await invoiceModel._loadInvoiceNumbering(
      req,
      'invoice',
    );
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

      nextNumber += attempts;

      const invoiceNumber = buildInvoiceNumber(numberPrefix, currentYear, nextNumber, includeYear);

      const checkResult = await client.query('SELECT id FROM invoices WHERE invoice_number = $1', [
        invoiceNumber,
      ]);

      if (checkResult.rows.length === 0) {
        return invoiceNumber;
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        throw new AppError(
          'Failed to allocate unique invoice number',
          500,
          AppError.CODES.DATABASE_ERROR,
        );
      }
    } while (true);
  }

  async convertToInvoice(req, estimateId) {
    const invoicesEnabled = await isPluginEnabledForRequest(req, 'invoices');
    if (!invoicesEnabled) {
      throw new AppError('Invoices plugin is not enabled', 403, AppError.CODES.FORBIDDEN);
    }

    const context = this._getContext(req);
    const pool = context.pool;
    const userId = context.userId;
    if (!userId) {
      throw new AppError('User context required for convert', 400, AppError.CODES.BAD_REQUEST);
    }
    const client = await pool.connect();
    const invoiceModel = new InvoiceModel();

    try {
      await client.query('BEGIN');

      const existing = await client.query(
        'SELECT id FROM invoices WHERE estimate_id = $1 LIMIT 1',
        [estimateId],
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        const conflict = new AppError(
          'An invoice already exists for this estimate',
          409,
          AppError.CODES.CONFLICT,
        );
        conflict.existingInvoiceId = existing.rows[0].id.toString();
        throw conflict;
      }

      const estimateResult = await client.query('SELECT * FROM estimates WHERE id = $1', [
        estimateId,
      ]);
      if (!estimateResult.rows.length) {
        await client.query('ROLLBACK');
        throw new AppError('Estimate not found', 404, AppError.CODES.NOT_FOUND);
      }

      const estimateRow = estimateResult.rows[0];
      if (estimateRow.status !== 'accepted') {
        await client.query('ROLLBACK');
        throw new AppError(
          'Only accepted estimates can be converted to an invoice',
          400,
          AppError.CODES.VALIDATION_ERROR,
        );
      }

      const lineItems = JSON.parse(JSON.stringify(this.transformRow(estimateRow).lineItems || []));
      const invoiceDiscount = parseFloat(estimateRow.estimate_discount || 0);
      const totals = calculateInvoiceTotals(lineItems, invoiceDiscount);
      const invoiceNumber = await this._allocateNextInvoiceNumberInTransaction(client, req);

      const contactId = estimateRow.contact_id;
      const insertResult = await client.query(
        `
        INSERT INTO invoices (
          invoice_number,
          contact_id,
          contact_name,
          organization_number,
          currency,
          line_items,
          invoice_discount,
          notes,
          payment_terms,
          order_number,
          delivery_method,
          issue_date,
          due_date,
          invoice_type,
          subtotal,
          total_discount,
          subtotal_after_discount,
          invoice_discount_amount,
          subtotal_after_invoice_discount,
          total_vat,
          total,
          status,
          paid_at,
          amount_paid,
          estimate_id,
          user_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
          NULL, NULL, 'invoice',
          $12, $13, $14, $15, $16, $17, $18,
          'draft', NULL, 0, $19, $20
        )
        RETURNING *
      `,
        [
          invoiceNumber,
          contactId,
          estimateRow.contact_name || '',
          estimateRow.organization_number || '',
          estimateRow.currency || 'SEK',
          JSON.stringify(lineItems),
          invoiceDiscount,
          estimateRow.notes || '',
          '',
          estimateRow.order_number || '',
          estimateRow.delivery_method || '',
          totals.subtotal,
          totals.totalDiscount,
          totals.subtotalAfterDiscount,
          totals.invoiceDiscountAmount,
          totals.subtotalAfterInvoiceDiscount,
          totals.totalVat,
          totals.total,
          estimateId,
          userId,
        ],
      );

      const updatedEstimateResult = await client.query(
        `
        UPDATE estimates
        SET status = 'invoiced', status_changed_at = NOW(), updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING *
      `,
        [estimateId],
      );

      await client.query('COMMIT');

      return {
        estimate: this.transformRow(updatedEstimateResult.rows[0]),
        invoice: invoiceModel.transformRow(insertResult.rows[0]),
      };
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* ignore */
      }
      if (error instanceof AppError) {
        throw error;
      }
      Logger.error('Failed to convert estimate to invoice', error, { estimateId });
      throw new AppError(
        'Failed to convert estimate to invoice',
        500,
        AppError.CODES.DATABASE_ERROR,
      );
    } finally {
      client.release();
    }
  }
}

module.exports = EstimateModel;
