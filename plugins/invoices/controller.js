// plugins/invoices/controller.js
// Invoices controller - V3 with @homebase/core SDK
const puppeteer = require('puppeteer');
const { setPdfHtmlContent } = require('../../server/core/utils/puppeteerPdf');
const { generatePDFHTML } = require('./pdfTemplate');
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

function stripInternalShareFields(invoice) {
  if (!invoice || typeof invoice !== 'object') {
    return invoice;
  }
  const { shareOwnerUserId, ...rest } = invoice;
  return rest;
}

class InvoiceController {
  constructor(model) {
    this.model = model;
  }

  /**
   * Load tenant organization for invoice PDF / public view.
   * Auth: session.tenantId. Public: share owner userId → TenantContextService.
   */
  async loadOrganization(req, ownerUserId) {
    try {
      const ServiceManager = require('../../server/core/ServiceManager');
      const TenantContextService = require('../../server/core/services/tenant/TenantContextService');
      const {
        OrganizationService,
      } = require('../../server/core/services/organization/OrganizationService');

      const mainPool = ServiceManager.getMainPool();
      let tenantId = req.session?.tenantId ?? null;

      if (tenantId == null && ownerUserId) {
        const tenantContext = await new TenantContextService().getTenantContextByUserId(
          ownerUserId,
        );
        tenantId = tenantContext?.tenantId ?? null;
      }

      if (tenantId == null) {
        return null;
      }

      const organizationService = new OrganizationService(mainPool);
      return await organizationService.getOrganization(tenantId);
    } catch (error) {
      Logger.warn('Failed to load organization for invoice', { message: error?.message });
      return null;
    }
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

  async bulkDelete(req, res) {
    try {
      const idsRaw = req.body?.ids;
      if (!Array.isArray(idsRaw)) {
        return res
          .status(400)
          .json({ error: 'ids[] required (must be an array)', code: 'VALIDATION_ERROR' });
      }

      const ids = Array.from(new Set(idsRaw.map((x) => String(x).trim()).filter(Boolean)));

      if (!ids.length) {
        return res.json({ ok: true, requested: 0, deleted: 0 });
      }

      if (ids.length > 500) {
        return res
          .status(400)
          .json({ error: 'Too many ids (max 500 per request)', code: 'VALIDATION_ERROR' });
      }

      const result = await this.model.bulkDelete(req, ids);

      const deleted =
        typeof result?.deletedCount === 'number'
          ? result.deletedCount
          : Array.isArray(result?.deletedIds)
            ? result.deletedIds.length
            : 0;

      return res.json({
        ok: true,
        requested: ids.length,
        deleted,
        deletedIds: result?.deletedIds || [],
      });
    } catch (error) {
      Logger.error('Bulk delete error', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      return res.status(500).json({ error: 'Bulk delete failed' });
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

  async generatePDF(req, res) {
    let browser = null;
    try {
      const { id } = req.params;

      const invoice = await this.model.getById(req, id);
      if (!invoice) {
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const organization = await this.loadOrganization(req, Context.getUserId(req));

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();

      const html = generatePDFHTML(invoice, organization || {});
      await setPdfHtmlContent(page, html);

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '12mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });

      Logger.info('PDF generated', { invoiceId: id, invoiceNumber: invoice.invoiceNumber });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="faktura-${invoice.invoiceNumber || invoice.id}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.removeHeader('Content-Encoding');
      res.end(pdfBuffer);
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

  async getPublicInvoice(req, res) {
    try {
      const { token } = req.params;
      if (!token) return res.status(400).json({ error: 'Share token is required' });

      const invoice = await this.model.getInvoiceByShareToken(req, token);
      if (!invoice) return res.status(404).json({ error: 'Invoice not found or link expired' });

      const organization = await this.loadOrganization(req, invoice.shareOwnerUserId);
      const publicInvoice = stripInternalShareFields(invoice);

      res.json({
        ...publicInvoice,
        organization: organization || null,
      });
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

  async createShare(req, res) {
    try {
      const { invoiceId, validUntil } = req.body;

      if (!invoiceId || !validUntil) {
        return res.status(400).json({ error: 'Invoice ID and valid until date are required' });
      }

      const validUntilDate = validUntil instanceof Date ? validUntil : new Date(validUntil);
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
