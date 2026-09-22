// plugins/estimates/controller.js
// Estimates controller - V3 with @homebase/core SDK
const EstimateModel = require('./model');
const puppeteer = require('puppeteer');
const { renderInvoicePdf } = require('../../server/core/utils/puppeteerPdf');
const { generatePDFHTML } = require('./pdfTemplate');
const { displayNameFromEmail, resolveLogoDataUrl } = require('../invoices/documentAssets');
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

function stripInternalShareFields(estimate) {
  if (!estimate || typeof estimate !== 'object') {
    return estimate;
  }
  const { shareOwnerUserId, ...rest } = estimate;
  return rest;
}

function pickContactAddress(addresses) {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return null;
  }
  const preferred =
    addresses.find((a) => /billing|faktura|invoice/i.test(String(a?.type || ''))) ||
    addresses.find((a) => /main|huvud|office/i.test(String(a?.type || ''))) ||
    addresses[0];
  if (!preferred || typeof preferred !== 'object') {
    return null;
  }
  return {
    line1: preferred.addressLine1 || preferred.line1 || '',
    line2: preferred.addressLine2 || preferred.line2 || '',
    postalCode: preferred.postalCode || '',
    city: preferred.city || '',
    country: preferred.country || '',
  };
}

function pickReferencePersonName(contactPersons) {
  if (!Array.isArray(contactPersons) || contactPersons.length === 0) {
    return '';
  }
  for (const person of contactPersons) {
    if (!person || typeof person !== 'object' || person.invoiceReference !== true) {
      continue;
    }
    const name = String(person.name || '').trim();
    if (name) {
      return name;
    }
  }
  for (const person of contactPersons) {
    if (!person || typeof person !== 'object') {
      continue;
    }
    const name = String(person.name || '').trim();
    if (name) {
      return name;
    }
  }
  return '';
}

class EstimateController {
  constructor(model) {
    this.model = model;
  }

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
      Logger.warn('Failed to load organization for estimate', { message: error?.message });
      return null;
    }
  }

  async loadReferencePerson(userId) {
    if (userId == null || userId === '') {
      return '';
    }
    try {
      const UserService = require('../../server/core/services/user/UserService');
      const user = await new UserService().findById(userId);
      return displayNameFromEmail(user?.email) || '';
    } catch (error) {
      Logger.warn('Failed to load reference person for estimate', { message: error?.message });
      return '';
    }
  }

  async prepareOrganizationForDocument(organization) {
    if (!organization || typeof organization !== 'object') {
      return {};
    }
    const logoUrl = await resolveLogoDataUrl(organization.logoUrl);
    return { ...organization, logoUrl };
  }

  async loadCustomerForEstimate(req, estimate) {
    const base = {
      name: estimate?.contactName || '',
      organizationNumber: estimate?.organizationNumber || '',
      line1: '',
      line2: '',
      postalCode: '',
      city: '',
      country: '',
      reference: '',
      customerNumber: '',
    };

    if (!estimate?.contactId) {
      return base;
    }

    try {
      const { Database } = require('@homebase/core');
      const db = Database.get(req);
      const rows = await db.query('SELECT * FROM contacts WHERE id = $1', [estimate.contactId]);
      if (!rows?.length) {
        return base;
      }
      const row = rows[0];
      let addresses = row.addresses || [];
      if (typeof addresses === 'string') {
        try {
          addresses = JSON.parse(addresses);
        } catch {
          addresses = [];
        }
      }
      let contactPersons = row.contact_persons || [];
      if (typeof contactPersons === 'string') {
        try {
          contactPersons = JSON.parse(contactPersons);
        } catch {
          contactPersons = [];
        }
      }
      const addr = pickContactAddress(addresses) || {};
      return {
        name: row.company_name || base.name,
        organizationNumber: row.organization_number || base.organizationNumber,
        line1: addr.line1 || '',
        line2: addr.line2 || '',
        postalCode: addr.postalCode || '',
        city: addr.city || '',
        country: addr.country || '',
        reference: pickReferencePersonName(contactPersons),
        customerNumber: String(row.contact_number || '').trim(),
      };
    } catch (error) {
      Logger.warn('Failed to load contact for estimate document', {
        contactId: estimate.contactId,
        message: error?.message,
      });
      return base;
    }
  }

  async getEstimates(req, res) {
    try {
      const estimates = await this.model.getAll(req);
      res.json(estimates);
    } catch (error) {
      Logger.error('Get estimates failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get estimates' });
    }
  }

  async getEstimate(req, res) {
    try {
      const { id } = req.params;
      const estimate = await this.model.getById(req, id);

      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      res.json(estimate);
    } catch (error) {
      Logger.error('Get estimate failed', error, {
        estimateId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get estimate' });
    }
  }

  async createEstimate(req, res) {
    try {
      const estimate = await this.model.create(req, req.body);
      res.status(201).json(estimate);
    } catch (error) {
      Logger.error('Create estimate failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create estimate' });
    }
  }

  async updateEstimate(req, res) {
    try {
      const { id } = req.params;

      // Ensure status reasons are properly formatted
      const updateData = {
        ...req.body,
        acceptanceReasons: req.body.acceptanceReasons || [],
        rejectionReasons: req.body.rejectionReasons || [],
      };

      const estimate = await this.model.update(req, id, updateData);
      res.json(estimate);
    } catch (error) {
      Logger.error('Update estimate failed', error, {
        estimateId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to update estimate' });
    }
  }

  // Bulk delete estimates
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

      // Use model's bulkDelete which uses BulkOperationsHelper
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

  async deleteEstimate(req, res) {
    try {
      const { id } = req.params;
      await this.model.delete(req, id);
      res.json({ message: 'Estimate deleted successfully' });
    } catch (error) {
      Logger.error('Delete estimate failed', error, {
        estimateId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to delete estimate' });
    }
  }

  async convertToInvoice(req, res) {
    try {
      const { id } = req.params;
      const result = await this.model.convertToInvoice(req, id);

      req.activityLogEntityName = result.estimate?.estimateNumber;
      req.activityLogMetadata = {
        action: 'convert_to_invoice',
        invoiceId: result.invoice?.id,
        invoiceNumber: result.invoice?.invoiceNumber,
      };

      res.status(201).json(result);
    } catch (error) {
      Logger.error('Convert estimate to invoice failed', error, {
        estimateId: req.params.id,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        if (error.statusCode === 409 && error.existingInvoiceId) {
          return res.status(409).json({
            error: error.message,
            code: error.code,
            existingInvoiceId: error.existingInvoiceId,
          });
        }
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to convert estimate to invoice' });
    }
  }

  async getNextEstimateNumber(req, res) {
    try {
      const estimateNumber = await this.model.getNextEstimateNumber(req);
      res.json({ estimateNumber });
    } catch (error) {
      Logger.error('Get next estimate number failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get next estimate number' });
    }
  }

  async getStatusStats(req, res) {
    try {
      const { startDate, endDate } = req.query;

      const stats = await this.model.getStatusStats(req, startDate, endDate);
      res.json(stats);
    } catch (error) {
      Logger.error('Get status stats failed', error, { userId: Context.getUserId(req) });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get status statistics' });
    }
  }

  async getReasonStats(req, res) {
    try {
      const { status } = req.params;
      const { startDate, endDate } = req.query;

      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be accepted or rejected' });
      }

      const stats = await this.model.getReasonStats(req, status, startDate, endDate);
      res.json(stats);
    } catch (error) {
      Logger.error('Get reason stats failed', error, {
        status: req.params.status,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to get reason statistics' });
    }
  }

  async generatePDF(req, res) {
    let browser = null;

    try {
      const { id } = req.params;

      const estimate = await this.model.getById(req, id);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      const userId = Context.getUserId(req);
      const [organizationRaw, customer, referencePerson] = await Promise.all([
        this.loadOrganization(req, userId),
        this.loadCustomerForEstimate(req, estimate),
        this.loadReferencePerson(userId),
      ]);
      const organization = await this.prepareOrganizationForDocument(organizationRaw);

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      const html = generatePDFHTML(estimate, organization, customer, { referencePerson });
      const pdfBuffer = await renderInvoicePdf(page, html);

      Logger.info('PDF generated', { estimateId: id, estimateNumber: estimate.estimateNumber });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="offert-${estimate.estimateNumber || estimate.id}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.removeHeader('Content-Encoding');

      res.end(pdfBuffer);
    } catch (error) {
      Logger.error('PDF generation failed', error, { estimateId: req.params.id });
      res.status(500).json({ error: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }

  async createShare(req, res) {
    try {
      const { estimateId, validUntil } = req.body;

      if (!estimateId || !validUntil) {
        return res.status(400).json({
          error: 'Estimate ID and valid until date are required',
        });
      }

      // Validate that validUntil is in the future
      const validUntilDate = new Date(validUntil);
      if (validUntilDate <= new Date()) {
        return res.status(400).json({
          error: 'Valid until date must be in the future',
        });
      }

      const share = await this.model.createShare(req, estimateId, validUntilDate);
      res.json(share);
    } catch (error) {
      Logger.error('Create share failed', error, {
        estimateId: req.body.estimateId,
        userId: Context.getUserId(req),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to create share link' });
    }
  }

  async generatePublicPDF(req, res) {
    let browser = null;

    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ error: 'Share token is required' });
      }

      const estimate = await this.model.getEstimateByShareToken(req, token);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found or link expired' });
      }

      const ownerUserId = estimate.shareOwnerUserId;
      const [organizationRaw, customer, referencePerson] = await Promise.all([
        this.loadOrganization(req, ownerUserId),
        this.loadCustomerForEstimate(req, estimate),
        this.loadReferencePerson(ownerUserId),
      ]);
      const organization = await this.prepareOrganizationForDocument(organizationRaw);
      const publicEstimate = stripInternalShareFields(estimate);

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
      const page = await browser.newPage();

      const html = generatePDFHTML(publicEstimate, organization, customer, { referencePerson });
      const pdfBuffer = await renderInvoicePdf(page, html);

      Logger.info('Public PDF generated', {
        estimateId: publicEstimate.id,
        estimateNumber: publicEstimate.estimateNumber,
        token: token.substring(0, 10),
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="offert-${publicEstimate.estimateNumber || publicEstimate.id}.pdf"`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.removeHeader('Content-Encoding');
      res.end(pdfBuffer);
    } catch (error) {
      Logger.error('Public PDF generation failed', error, {
        token: req.params.token?.substring(0, 10),
      });
      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }
      res.status(500).json({ error: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        try {
          await browser.close();
        } catch {}
      }
    }
  }

  async getPublicEstimate(req, res) {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ error: 'Share token is required' });
      }

      const estimate = await this.model.getEstimateByShareToken(req, token);

      if (!estimate) {
        return res.status(404).json({
          error: 'Estimate not found or share link has expired',
        });
      }

      const [organizationRaw, customer, referencePerson] = await Promise.all([
        this.loadOrganization(req, estimate.shareOwnerUserId),
        this.loadCustomerForEstimate(req, estimate),
        this.loadReferencePerson(estimate.shareOwnerUserId),
      ]);
      const organization = await this.prepareOrganizationForDocument(organizationRaw);
      const publicEstimate = stripInternalShareFields(estimate);

      res.json({
        ...publicEstimate,
        organization: organization && Object.keys(organization).length ? organization : null,
        customer,
        referencePerson: referencePerson || null,
      });
    } catch (error) {
      Logger.error('Get public estimate failed', error, {
        token: req.params.token?.substring(0, 10),
      });

      if (error instanceof AppError) {
        return res.status(error.statusCode).json(error.toJSON());
      }

      res.status(500).json({ error: 'Failed to load estimate' });
    }
  }

  async getShares(req, res) {
    try {
      const { estimateId } = req.params;

      const shares = await this.model.getSharesForEstimate(req, estimateId);
      res.json(shares);
    } catch (error) {
      Logger.error('Get shares failed', error, {
        estimateId: req.params.estimateId,
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

      const revokedShare = await this.model.revokeShare(req, shareId);
      res.json({ message: 'Share revoked successfully', share: revokedShare });
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

module.exports = EstimateController;
