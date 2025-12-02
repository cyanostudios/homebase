// plugins/invoices/model.js
// Invoices model - handles invoice CRUD, sharing, calculations, and numbering with multi-tenant support
const crypto = require('crypto');

class InvoiceModel {
  constructor(pool) {
    this.defaultPool = pool;
  }

  getPool(req) {
    return req.tenantPool || this.defaultPool;
  }

  // Existing calculation method
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
    
    return {
      id: row.id.toString(),
      invoiceNumber: row.invoice_number,
      contactId: row.contact_id ? row.contact_id.toString() : null,
      contactName: row.contact_name || '',
      organizationNumber: row.organization_number || '',
      currency: row.currency || 'SEK',
      lineItems: Array.isArray(row.line_items) ? row.line_items : [],
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

  // Get next invoice number
  async getNextInvoiceNumber(req, userId) {
    const pool = this.getPool(req);
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
          WHERE user_id = $1 AND invoice_number LIKE $2
          ORDER BY invoice_number DESC 
          LIMIT 1
        `, [userId, `${currentYear}-%`]);
        
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
          throw new Error('Could not find available invoice number');
        }
        
      } while (true);
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Create invoice
  async create(req, userId, invoiceData) {
    const pool = this.getPool(req);
    const invoiceNumber = invoiceData.invoiceNumber || await this.getNextInvoiceNumber(req, userId);
    const { subtotal, totalDiscount, subtotalAfterDiscount, invoiceDiscountAmount, subtotalAfterInvoiceDiscount, totalVat, total } = this.calculateTotals(invoiceData.lineItems || [], invoiceData.invoiceDiscount || 0);
    
    const result = await pool.query(`
      INSERT INTO invoices (
        user_id, invoice_number, contact_id, contact_name, organization_number,
        currency, line_items, invoice_discount, notes, due_date, subtotal, total_discount, 
        subtotal_after_discount, invoice_discount_amount, subtotal_after_invoice_discount, 
        total_vat, total, status, paid_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      ) RETURNING *
    `, [
      userId,
      invoiceNumber,
      invoiceData.contactId || null,
      invoiceData.contactName || '',
      invoiceData.organizationNumber || '',
      invoiceData.currency || 'SEK',
      JSON.stringify(invoiceData.lineItems || []),
      invoiceData.invoiceDiscount || 0,
      invoiceData.notes || '',
      invoiceData.dueDate,
      subtotal,
      totalDiscount,
      subtotalAfterDiscount,
      invoiceDiscountAmount,
      subtotalAfterInvoiceDiscount,
      totalVat,
      total,
      invoiceData.status || 'draft',
      invoiceData.status === 'paid' ? 'NOW()' : null
    ]);
    
    return this.transformRow(result.rows[0]);
  }

  // Get all invoices for user
  async getAll(req, userId) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    
    return result.rows.map(row => this.transformRow(row));
  }

  // Get single invoice by ID
  async getById(req, userId, invoiceId) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [invoiceId, userId]
    );
    
    if (!result.rows.length) {
      return null;
    }
    
    return this.transformRow(result.rows[0]);
  }

  // Update invoice
  async update(req, userId, invoiceId, invoiceData) {
    const pool = this.getPool(req);
    const { subtotal, totalDiscount, subtotalAfterDiscount, invoiceDiscountAmount, subtotalAfterInvoiceDiscount, totalVat, total } = this.calculateTotals(invoiceData.lineItems || [], invoiceData.invoiceDiscount || 0);
    
    const currentInvoice = await this.getById(req, userId, invoiceId);
    const isBecomingPaid = currentInvoice && currentInvoice.status !== 'paid' && invoiceData.status === 'paid';
    
    const result = await pool.query(`
      UPDATE invoices SET
        contact_id = $3,
        contact_name = $4,
        organization_number = $5,
        currency = $6,
        line_items = $7,
        invoice_discount = $8,
        notes = $9,
        due_date = $10,
        subtotal = $11,
        total_discount = $12,
        subtotal_after_discount = $13,
        invoice_discount_amount = $14,
        subtotal_after_invoice_discount = $15,
        total_vat = $16,
        total = $17,
        status = $18,
        paid_at = CASE 
          WHEN $19 THEN CURRENT_TIMESTAMP 
          ELSE paid_at 
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [
      invoiceId,
      userId,
      invoiceData.contactId || null,
      invoiceData.contactName || '',
      invoiceData.organizationNumber || '',
      invoiceData.currency || 'SEK',
      JSON.stringify(invoiceData.lineItems || []),
      invoiceData.invoiceDiscount || 0,
      invoiceData.notes || '',
      invoiceData.dueDate,
      subtotal,
      totalDiscount,
      subtotalAfterDiscount,
      invoiceDiscountAmount,
      subtotalAfterInvoiceDiscount,
      totalVat,
      total,
      invoiceData.status || 'draft',
      isBecomingPaid
    ]);
    
    if (!result.rows.length) {
      throw new Error('Invoice not found');
    }
    
    return this.transformRow(result.rows[0]);
  }

  // Delete invoice
  async delete(req, userId, invoiceId) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING id',
      [invoiceId, userId]
    );
    
    if (!result.rows.length) {
      throw new Error('Invoice not found');
    }
    
    return true;
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

  async createShare(req, userId, invoiceId, validUntil) {
    const pool = this.getPool(req);
    const invoiceCheck = await pool.query(
      'SELECT id FROM invoices WHERE id = $1 AND user_id = $2',
      [invoiceId, userId]
    );
    
    if (!invoiceCheck.rows.length) {
      throw new Error('Invoice not found or access denied');
    }

    const shareToken = this.generateShareToken();
    
    const result = await pool.query(`
      INSERT INTO invoice_shares (invoice_id, share_token, valid_until)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [invoiceId, shareToken, validUntil]);
    
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

  async getInvoiceByShareToken(req, shareToken) {
    const pool = this.getPool(req);
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
  }

  async getSharesForInvoice(req, userId, invoiceId) {
    const pool = this.getPool(req);
    const invoiceCheck = await pool.query(
      'SELECT id FROM invoices WHERE id = $1 AND user_id = $2',
      [invoiceId, userId]
    );
    
    if (!invoiceCheck.rows.length) {
      throw new Error('Invoice not found or access denied');
    }

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
  }

  async revokeShare(req, userId, shareId) {
    const pool = this.getPool(req);
    const result = await pool.query(`
      DELETE FROM invoice_shares 
      WHERE id = $1 
      AND invoice_id IN (
        SELECT id FROM invoices WHERE user_id = $2
      )
      RETURNING *
    `, [shareId, userId]);
    
    if (!result.rows.length) {
      throw new Error('Share not found or access denied');
    }
    
    return {
      id: result.rows[0].id.toString(),
      invoiceId: result.rows[0].invoice_id.toString(),
      shareToken: result.rows[0].share_token,
    };
  }

  async cleanExpiredShares(req) {
    const pool = this.getPool(req);
    const result = await pool.query(
      'DELETE FROM invoice_shares WHERE valid_until < NOW()'
    );
    
    return result.rowCount;
  }
}

module.exports = InvoiceModel;