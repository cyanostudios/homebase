const crypto = require('crypto');

class InvoiceModel {
  constructor(pool) {
    this.pool = pool;
  }

  static TABLE = 'invoices';
  static SHARE_TABLE = 'invoice_shares';

  // === CALCULATIONS (mirrors Estimates) ===
  calculateTotals(lineItems = [], invoiceDiscount = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let subtotalAfterDiscount = 0;

    const normalized = (lineItems || []).map(item => {
      const qty = Number(item.quantity || 0);
      const price = Number(item.unitPrice || 0);
      const lineSubtotal = qty * price;
      const discountPct = Number(item.discount || 0) / 100;
      const discountAmount = lineSubtotal * discountPct;
      const afterDiscount = lineSubtotal - discountAmount;

      subtotal += lineSubtotal;
      totalDiscount += discountAmount;
      subtotalAfterDiscount += afterDiscount;

      return {
        ...item,
        lineSubtotal,
        discountAmount,
        lineSubtotalAfterDiscount: afterDiscount,
      };
    });

    const invoiceDiscountAmount = subtotalAfterDiscount * (Number(invoiceDiscount || 0) / 100);
    const subtotalAfterInvoiceDiscount = subtotalAfterDiscount - invoiceDiscountAmount;

    let totalVat = 0;
    const totalForAllocation = Math.max(subtotalAfterDiscount, 0.00001);
    normalized.forEach(item => {
      const proportion = item.lineSubtotalAfterDiscount / totalForAllocation;
      const finalLineAmount = subtotalAfterInvoiceDiscount * proportion;
      const vatRate = Number(item.vatRate || 25) / 100;
      totalVat += finalLineAmount * vatRate;
    });

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

  // === TRANSFORM DB -> API ===
  transformRow(row) {
    if (!row) return null;
    return {
      id: row.id.toString(),
      invoiceNumber: row.invoice_number || null,
      contactId: row.contact_id ? row.contact_id.toString() : null,
      contactName: row.contact_name || '',
      organizationNumber: row.organization_number || '',
      currency: row.currency || 'SEK',
      lineItems: Array.isArray(row.line_items) ? row.line_items : [],
      invoiceDiscount: parseFloat(row.invoice_discount || 0),
      notes: row.notes || '',
      paymentTerms: row.payment_terms || '',
      issueDate: row.issue_date,
      dueDate: row.due_date,
      subtotal: parseFloat(row.subtotal || 0),
      totalDiscount: parseFloat(row.total_discount || 0),
      subtotalAfterDiscount: parseFloat(row.subtotal_after_discount || 0),
      invoiceDiscountAmount: parseFloat(row.invoice_discount_amount || 0),
      subtotalAfterInvoiceDiscount: parseFloat(row.subtotal_after_invoice_discount || 0),
      totalVat: parseFloat(row.total_vat || 0),
      total: parseFloat(row.total || 0),
      status: row.status || 'draft',
      statusChangedAt: row.status_changed_at,
      paidAt: row.paid_at || null,
      estimateId: row.estimate_id ? row.estimate_id.toString() : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // === NUMBERING ===
  async getNextInvoiceNumber(userId) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const currentYear = new Date().getFullYear();
      let attempts = 0;
      const maxAttempts = 100;

      do {
        const likePattern = `INV${currentYear}-%`;
        const result = await client.query(
          `
          SELECT invoice_number
          FROM ${InvoiceModel.TABLE}
          WHERE user_id = $1 AND invoice_number LIKE $2
          ORDER BY invoice_number DESC
          LIMIT 1
          `,
          [userId, likePattern]
        );

        let nextNumber = 1;
        if (result.rows.length > 0 && result.rows[0].invoice_number) {
          const last = result.rows[0].invoice_number; // e.g., INV2025-007
          const numberPart = parseInt(last.split('-')[1], 10);
          if (!isNaN(numberPart)) nextNumber = numberPart + 1;
        }

        const candidate = `INV${currentYear}-${String(nextNumber).padStart(3, '0')}`;

        const exists = await client.query(
          `SELECT id FROM ${InvoiceModel.TABLE} WHERE invoice_number = $1 AND user_id = $2`,
          [candidate, userId]
        );

        if (exists.rows.length === 0) {
          await client.query('COMMIT');
          return candidate;
        }

        attempts++;
        if (attempts >= maxAttempts) throw new Error('Could not find available invoice number');
      } while (true);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // === CRUD ===
  async getAll(userId) {
    const result = await this.pool.query(
      `SELECT * FROM ${InvoiceModel.TABLE} WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows.map(r => this.transformRow(r));
  }

  async getById(userId, invoiceId) {
    const result = await this.pool.query(
      `SELECT * FROM ${InvoiceModel.TABLE} WHERE id = $1 AND user_id = $2`,
      [invoiceId, userId]
    );
    if (!result.rows.length) return null;
    return this.transformRow(result.rows[0]);
  }

  async create(userId, data) {
    const {
      contactId = null,
      contactName = '',
      organizationNumber = '',
      currency = 'SEK',
      lineItems = [],
      invoiceDiscount = 0,
      notes = '',
      paymentTerms = '',
      issueDate = new Date(),
      dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status = 'draft',
      estimateId = null,
      invoiceType = 'invoice', // om du använder typen
    } = data || {};
  
    const {
      subtotal, totalDiscount, subtotalAfterDiscount,
      invoiceDiscountAmount, subtotalAfterInvoiceDiscount,
      totalVat, total
    } = this.calculateTotals(lineItems, invoiceDiscount);
  
    const now = new Date();
    const paidAt = status === 'paid' ? now : null;
    const statusChangedAt = now;
  
    const result = await this.pool.query(
      `
      INSERT INTO ${InvoiceModel.TABLE} (
        user_id, invoice_number,
        contact_id, contact_name, organization_number,
        currency, line_items, invoice_discount, notes, payment_terms,
        issue_date, due_date,
        subtotal, total_discount, subtotal_after_discount, invoice_discount_amount,
        subtotal_after_invoice_discount, total_vat, total,
        status, status_changed_at, paid_at, estimate_id,
        created_at, updated_at,
        invoice_type
      ) VALUES (
        $1, $2,
        $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22, $23,
        NOW(), NOW(),
        $24
      )
      RETURNING *
      `,
      [
        userId,
        data.invoiceNumber || null,            // fakturanummer sätts senare vid "sent"
        contactId ? Number(contactId) : null,
        contactName,
        organizationNumber,
        currency,
        JSON.stringify(lineItems || []),
        invoiceDiscount,
        notes,
        paymentTerms,
        issueDate,
        dueDate,
        subtotal,
        totalDiscount,
        subtotalAfterDiscount,
        invoiceDiscountAmount,
        subtotalAfterInvoiceDiscount,
        totalVat,
        total,
        status,
        statusChangedAt,
        paidAt,
        estimateId ? Number(estimateId) : null,
        invoiceType
      ]
    );
  
    return this.transformRow(result.rows[0]);
  }
  

  async update(userId, invoiceId, data) {
    const current = await this.getById(userId, invoiceId);
    if (!current) throw new Error('Invoice not found');

    const merged = {
      ...current,
      ...data,
    };

    const recalc = this.calculateTotals(merged.lineItems || [], merged.invoiceDiscount || 0);

    const isStatusChanging = data.status && data.status !== current.status;
    const becomingSent = isStatusChanging && data.status === 'sent';
    const becomingPaid = isStatusChanging && data.status === 'paid';
    const leavingPaid = isStatusChanging && current.status === 'paid' && data.status !== 'paid';

    let invoiceNumber = current.invoiceNumber;
    if (becomingSent && !invoiceNumber) {
      invoiceNumber = await this.getNextInvoiceNumber(userId);
    }

    const paidAt = becomingPaid ? new Date() : (leavingPaid ? null : current.paidAt);

    const result = await this.pool.query(
      `
      UPDATE ${InvoiceModel.TABLE}
      SET
        invoice_number = $1,
        contact_id = $2,
        contact_name = $3,
        organization_number = $4,
        currency = $5,
        line_items = $6,
        invoice_discount = $7,
        notes = $8,
        payment_terms = $9,
        issue_date = $10,
        due_date = $11,
        subtotal = $12,
        total_discount = $13,
        subtotal_after_discount = $14,
        invoice_discount_amount = $15,
        subtotal_after_invoice_discount = $16,
        total_vat = $17,
        total = $18,
        status = $19,
        status_changed_at = CASE WHEN $20 THEN NOW() ELSE status_changed_at END,
        paid_at = $21,
        estimate_id = $22,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $23 AND user_id = $24
      RETURNING *
      `,
      [
        invoiceNumber,
        merged.contactId ? Number(merged.contactId) : null,
        merged.contactName || '',
        merged.organizationNumber || '',
        merged.currency || 'SEK',
        JSON.stringify(merged.lineItems || []),
        merged.invoiceDiscount || 0,
        merged.notes || '',
        merged.paymentTerms || '',
        merged.issueDate,
        merged.dueDate,
        recalc.subtotal,
        recalc.totalDiscount,
        recalc.subtotalAfterDiscount,
        recalc.invoiceDiscountAmount,
        recalc.subtotalAfterInvoiceDiscount,
        recalc.totalVat,
        recalc.total,
        merged.status || current.status,
        isStatusChanging,
        paidAt,
        merged.estimateId ? Number(merged.estimateId) : null,
        invoiceId,
        userId,
      ]
    );

    return this.transformRow(result.rows[0]);
  }

  async delete(userId, invoiceId) {
    const result = await this.pool.query(
      `DELETE FROM ${InvoiceModel.TABLE} WHERE id = $1 AND user_id = $2 RETURNING id`,
      [invoiceId, userId]
    );
    if (!result.rows.length) throw new Error('Invoice not found');
    return { id: invoiceId };
  }

  // === STATS (basic) ===
  async getStatusCounts(userId) {
    const result = await this.pool.query(
      `
      SELECT status, COUNT(*)::int as count
      FROM ${InvoiceModel.TABLE}
      WHERE user_id = $1
      GROUP BY status
      `,
      [userId]
    );
    const map = {};
    result.rows.forEach(r => { map[r.status] = r.count; });
    return map;
  }

  // === SHARING ===
  base62Encode(buffer) {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let out = '';
    let num = BigInt('0x' + buffer.toString('hex'));
    const base = BigInt(62);
    if (num === 0n) return '0';
    while (num > 0n) {
      const rem = num % base;
      out = chars[Number(rem)] + out;
      num = num / base;
    }
    return out.padStart(32, '0');
  }

  generateShareToken() {
    const bytes = crypto.randomBytes(24);
    return this.base62Encode(bytes);
  }

  async createShare(userId, invoiceId, validUntil) {
    const own = await this.pool.query(
      `SELECT id FROM ${InvoiceModel.TABLE} WHERE id = $1 AND user_id = $2`,
      [invoiceId, userId]
    );
    if (!own.rows.length) throw new Error('Invoice not found');

    const token = this.generateShareToken();
    const result = await this.pool.query(
      `
      INSERT INTO ${InvoiceModel.SHARE_TABLE}
        (user_id, invoice_id, share_token, valid_until, created_at, accessed_count)
      VALUES ($1, $2, $3, $4, NOW(), 0)
      RETURNING *
      `,
      [userId, invoiceId, token, validUntil]
    );
    return {
      id: result.rows[0].id.toString(),
      invoiceId: result.rows[0].invoice_id.toString(),
      shareToken: result.rows[0].share_token,
      validUntil: result.rows[0].valid_until,
      createdAt: result.rows[0].created_at,
      accessedCount: result.rows[0].accessed_count,
      lastAccessedAt: result.rows[0].last_accessed_at,
    };
  }

  async getInvoiceByShareToken(shareToken) {
    const result = await this.pool.query(
      `
      SELECT i.*, s.accessed_count, s.valid_until as share_valid_until
      FROM ${InvoiceModel.TABLE} i
      JOIN ${InvoiceModel.SHARE_TABLE} s ON i.id = s.invoice_id
      WHERE s.share_token = $1 AND s.valid_until > NOW()
      `,
      [shareToken]
    );
    if (!result.rows.length) return null;

    await this.pool.query(
      `UPDATE ${InvoiceModel.SHARE_TABLE}
       SET accessed_count = accessed_count + 1, last_accessed_at = NOW()
       WHERE share_token = $1`,
      [shareToken]
    );

    return this.transformRow(result.rows[0]);
  }

  async getSharesForInvoice(userId, invoiceId) {
    const own = await this.pool.query(
      `SELECT id FROM ${InvoiceModel.TABLE} WHERE id = $1 AND user_id = $2`,
      [invoiceId, userId]
    );
    if (!own.rows.length) throw new Error('Invoice not found');

    const result = await this.pool.query(
      `
      SELECT *
      FROM ${InvoiceModel.SHARE_TABLE}
      WHERE invoice_id = $1
      ORDER BY created_at DESC
      `,
      [invoiceId]
    );

    return result.rows.map(row => ({
      id: row.id.toString(),
      invoiceId: row.invoice_id.toString(),
      shareToken: row.share_token,
      validUntil: row.valid_until,
      createdAt: row.created_at,
      accessedCount: row.accessed_count,
      lastAccessedAt: row.last_accessed_at,
    }));
  }

  async revokeShare(userId, shareId) {
    const result = await this.pool.query(
      `
      DELETE FROM ${InvoiceModel.SHARE_TABLE}
      WHERE id = $1 AND user_id = $2
      RETURNING *
      `,
      [shareId, userId]
    );
    if (!result.rows.length) throw new Error('Share not found or access denied');
    return {
      id: result.rows[0].id.toString(),
      invoiceId: result.rows[0].invoice_id.toString(),
      shareToken: result.rows[0].share_token,
    };
  }

  async cleanExpiredShares() {
    const result = await this.pool.query(
      `DELETE FROM ${InvoiceModel.SHARE_TABLE} WHERE valid_until < NOW()`
    );
    return result.rowCount;
  }
}

module.exports = InvoiceModel;
