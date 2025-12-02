// plugins/invoices/controller.js
// Invoices controller - handles HTTP requests for invoices CRUD, sharing, and PDF generation
const puppeteer = require('puppeteer');
const { generatePDFHTML } = require('./pdfTemplate');

class InvoiceController {
  constructor(model) {
    this.model = model;
  }

  getUserId(req) {
    return req.session.currentTenantUserId || req.session.user.id;
  }

  // === CRUD ===
  async getInvoices(req, res) {
    try {
      const userId = this.getUserId(req);
      const items = await this.model.getAll(req, userId);
      res.json(items);
    } catch (error) {
      console.error('Error getting invoices:', error);
      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  }

  async createInvoice(req, res) {
    try {
      const userId = this.getUserId(req);
      const item = await this.model.create(req, userId, req.body);
      res.json(item);
    } catch (error) {
      console.error('Error creating invoice:', error);
      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }

  async updateInvoice(req, res) {
    try {
      const userId = this.getUserId(req);
      const item = await this.model.update(req, userId, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      console.error('Error updating invoice:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.status(500).json({ error: 'Failed to update invoice' });
    }
  }

  async deleteInvoice(req, res) {
    try {
      const userId = this.getUserId(req);
      await this.model.delete(req, userId, req.params.id);
      res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
      console.error('Error deleting invoice:', error);
      if (/not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      res.status(500).json({ error: 'Failed to delete invoice' });
    }
  }

  // === Numbering ===
  async getNextInvoiceNumber(req, res) {
    try {
      const userId = this.getUserId(req);
      const invoiceNumber = await this.model.getNextInvoiceNumber(req, userId);
      res.json({ invoiceNumber });
    } catch (error) {
      console.error('Error getting next invoice number:', error);
      res.status(500).json({ error: 'Failed to get next invoice number' });
    }
  }

  // === PDF ===
  async generatePDF(req, res) {
    let browser = null;
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);

      const invoice = await this.model.getById(req, userId, id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();

      const html = generatePDFHTML(invoice);
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.invoiceNumber || invoice.id}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        try { await browser.close(); } catch {}
      }
    }
  }

  // === Public access ===
  async getPublicInvoice(req, res) {
    try {
      const { token } = req.params;
      if (!token) return res.status(400).json({ error: 'Share token is required' });

      const invoice = await this.model.getInvoiceByShareToken(req, token);
      if (!invoice) return res.status(404).json({ error: 'Invoice not found or link expired' });

      res.json(invoice);
    } catch (error) {
      console.error('Error getting public invoice:', error);
      res.status(500).json({ error: 'Failed to load invoice' });
    }
  }

  // === Sharing ===
  async createShare(req, res) {
    try {
      const { invoiceId, validUntil } = req.body;
      const userId = this.getUserId(req);

      if (!invoiceId || !validUntil) {
        return res.status(400).json({ error: 'Invoice ID and valid until date are required' });
      }

      const validUntilDate = new Date(validUntil);
      if (isNaN(+validUntilDate) || validUntilDate <= new Date()) {
        return res.status(400).json({ error: 'Valid until date must be in the future' });
      }

      const share = await this.model.createShare(req, userId, invoiceId, validUntilDate);
      res.json(share);
    } catch (error) {
      console.error('Error creating invoice share:', error);
      if (/Invoice not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Invoice not found or access denied' });
      }
      res.status(500).json({ error: 'Failed to create share link' });
    }
  }

  async getShares(req, res) {
    try {
      const { invoiceId } = req.params;
      const userId = this.getUserId(req);

      const shares = await this.model.getSharesForInvoice(req, userId, invoiceId);
      res.json(shares);
    } catch (error) {
      console.error('Error getting invoice shares:', error);
      if (/Invoice not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Invoice not found or access denied' });
      }
      res.status(500).json({ error: 'Failed to get shares' });
    }
  }

  async revokeShare(req, res) {
    try {
      const { shareId } = req.params;
      const userId = this.getUserId(req);

      const revoked = await this.model.revokeShare(req, userId, shareId);
      res.json({ message: 'Share revoked successfully', share: revoked });
    } catch (error) {
      console.error('Error revoking share:', error);
      if (/Share not found/i.test(String(error?.message))) {
        return res.status(404).json({ error: 'Share not found or access denied' });
      }
      res.status(500).json({ error: 'Failed to revoke share' });
    }
  }
}

module.exports = InvoiceController;