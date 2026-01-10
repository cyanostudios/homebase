// plugins/invoices/controller.js
// Invoices controller - V3 with @homebase/core SDK
const puppeteer = require('puppeteer');
const { generatePDFHTML } = require('./pdfTemplate');
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class InvoiceController {
  constructor(model) {
    this.model = model;
  }

  // === CRUD ===
  async getInvoices(req, res) {
    try {
      const items = await this.model.getAll(req);
      res.json(items);
    } catch (error) {
      Logger.error('Get invoices failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to fetch invoices' });
    }
  }

  async createInvoice(req, res) {
    try {
      const item = await this.model.create(req, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Create invoice failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create invoice' });
    }
  }

  async updateInvoice(req, res) {
    try {
      const item = await this.model.update(req, req.params.id, req.body);
      res.json(item);
    } catch (error) {
      Logger.error('Update invoice failed', error, {
        invoiceId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update invoice' });
    }
  }

  async deleteInvoice(req, res) {
    try {
      await this.model.delete(req, req.params.id);
      res.json({ message: 'Invoice deleted successfully' });
    } catch (error) {
      Logger.error('Delete invoice failed', error, {
        invoiceId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to delete invoice' });
    }
  }

  // === Numbering ===
  async getNextInvoiceNumber(req, res) {
    try {
      const invoiceNumber = await this.model.getNextInvoiceNumber(req);
      res.json({ invoiceNumber });
    } catch (error) {
      Logger.error('Get next invoice number failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get next invoice number' });
    }
  }

  // === PDF ===
  async generatePDF(req, res) {
    let browser = null;
    try {
      const { id } = req.params;

      const invoice = await this.model.getById(req, id);
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

      Logger.info('PDF generated', { invoiceId: id, invoiceNumber: invoice.invoiceNumber });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="invoice-${invoice.invoiceNumber || invoice.id}.pdf"`,
      );
      res.send(pdfBuffer);
    } catch (error) {
      Logger.error('PDF generation failed', error, { invoiceId: req.params.id });
      res.status(500).json({ error: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {}
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
      Logger.error('Get public invoice failed', error, {
        token: req.params.token?.substring(0, 10),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to load invoice' });
    }
  }

  // === Sharing ===
  async createShare(req, res) {
    try {
      const { invoiceId, validUntil } = req.body;

      if (!invoiceId || !validUntil) {
        return res.status(400).json({ error: 'Invoice ID and valid until date are required' });
      }

      const validUntilDate = new Date(validUntil);
      if (isNaN(+validUntilDate) || validUntilDate <= new Date()) {
        return res.status(400).json({ error: 'Valid until date must be in the future' });
      }

      const share = await this.model.createShare(req, invoiceId, validUntilDate);
      res.json(share);
    } catch (error) {
      Logger.error('Create share failed', error, {
        invoiceId: req.body.invoiceId,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create share link' });
    }
  }

  async getShares(req, res) {
    try {
      const { invoiceId } = req.params;

      const shares = await this.model.getSharesForInvoice(req, invoiceId);
      res.json(shares);
    } catch (error) {
      Logger.error('Get shares failed', error, {
        invoiceId: req.params.invoiceId,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get shares' });
    }
  }

  async revokeShare(req, res) {
    try {
      const { shareId } = req.params;

      const revoked = await this.model.revokeShare(req, shareId);
      res.json({ message: 'Share revoked successfully', share: revoked });
    } catch (error) {
      Logger.error('Revoke share failed', error, {
        shareId: req.params.shareId,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to revoke share' });
    }
  }
}

module.exports = InvoiceController;
