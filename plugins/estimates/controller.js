// plugins/estimates/controller.js
// Estimates controller - V3 with @homebase/core SDK
const EstimateModel = require('./model');
const puppeteer = require('puppeteer');
const { generatePDFHTML } = require('./pdfTemplate');
const { Logger, Context } = require('@homebase/core');
const { AppError } = require('../../server/core/errors/AppError');

class EstimateController {
  constructor(model) {
    this.model = model;
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

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();

      const html = generatePDFHTML(estimate);

      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm',
        },
      });

      Logger.info('PDF generated', { estimateId: id, estimateNumber: estimate.estimateNumber });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=estimate-${estimate.estimateNumber}.pdf`,
      );
      res.setHeader('Content-Length', pdfBuffer.length);
      res.removeHeader('Content-Encoding');

      res.end(pdfBuffer);
    } catch (error) {
      Logger.error('PDF generation failed', error, { estimateId: req.params.id });
      res.status(500).json({ error: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        await browser.close();
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

      res.json(estimate);
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
