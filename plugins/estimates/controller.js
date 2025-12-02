// plugins/estimates/controller.js
// Estimates controller - handles HTTP requests for estimates CRUD, sharing, PDF generation, and statistics
const EstimateModel = require('./model');
const puppeteer = require('puppeteer');
const { generatePDFHTML } = require('./pdfTemplate');

class EstimateController {
  constructor(model) {
    this.model = model;
  }

  getUserId(req) {
    return req.session.currentTenantUserId || req.session.user.id;
  }

  // Get all estimates for user
  async getEstimates(req, res) {
    try {
      const userId = this.getUserId(req);
      const estimates = await this.model.getAll(req, userId);
      res.json(estimates);
    } catch (error) {
      console.error('Error getting estimates:', error);
      res.status(500).json({ error: 'Failed to get estimates' });
    }
  }

  // Get single estimate
  async getEstimate(req, res) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      const estimate = await this.model.getById(req, userId, id);
      
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }
      
      res.json(estimate);
    } catch (error) {
      console.error('Error getting estimate:', error);
      res.status(500).json({ error: 'Failed to get estimate' });
    }
  }

  // Create new estimate
  async createEstimate(req, res) {
    try {
      const userId = this.getUserId(req);
      const estimate = await this.model.create(req, userId, req.body);
      res.status(201).json(estimate);
    } catch (error) {
      console.error('Error creating estimate:', error);
      res.status(500).json({ error: 'Failed to create estimate' });
    }
  }

  // Update estimate with status reasons support
  async updateEstimate(req, res) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      
      // Get current estimate to check status change
      const currentEstimate = await this.model.getById(req, userId, id);
      if (!currentEstimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }
      
      // Ensure status reasons are properly formatted
      const updateData = {
        ...req.body,
        acceptanceReasons: req.body.acceptanceReasons || [],
        rejectionReasons: req.body.rejectionReasons || []
      };
      
      const estimate = await this.model.update(req, userId, id, updateData);
      res.json(estimate);
    } catch (error) {
      console.error('Error updating estimate:', error);
      if (error.message === 'Estimate not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update estimate' });
    }
  }

  // Delete estimate
  async deleteEstimate(req, res) {
    try {
      const { id } = req.params;
      const userId = this.getUserId(req);
      await this.model.delete(req, userId, id);
      res.json({ message: 'Estimate deleted successfully' });
    } catch (error) {
      console.error('Error deleting estimate:', error);
      if (error.message === 'Estimate not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to delete estimate' });
    }
  }

  // Get next estimate number
  async getNextEstimateNumber(req, res) {
    try {
      const userId = this.getUserId(req);
      const estimateNumber = await this.model.getNextEstimateNumber(req, userId);
      res.json({ estimateNumber });
    } catch (error) {
      console.error('Error getting next estimate number:', error);
      res.status(500).json({ error: 'Failed to get next estimate number' });
    }
  }

  // Get status statistics
  async getStatusStats(req, res) {
    try {
      const userId = this.getUserId(req);
      const { startDate, endDate } = req.query;
      
      const stats = await this.model.getStatusStats(req, userId, startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error('Error getting status stats:', error);
      res.status(500).json({ error: 'Failed to get status statistics' });
    }
  }

  // Get reason statistics
  async getReasonStats(req, res) {
    try {
      const userId = this.getUserId(req);
      const { status } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be accepted or rejected' });
      }
      
      const stats = await this.model.getReasonStats(req, userId, status, startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error('Error getting reason stats:', error);
      res.status(500).json({ error: 'Failed to get reason statistics' });
    }
  }

  // Generate PDF
  async generatePDF(req, res) {
    let browser = null;

    try {
      const { id } = req.params;
      const userId = this.getUserId(req);

      // Get estimate data
      const estimate = await this.model.getById(req, userId, id);
      if (!estimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }

      // Launch Puppeteer browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Generate HTML content using PDF template
      const html = generatePDFHTML(estimate);

      // Set HTML content
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      });

      // Set response headers for download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=estimate-${estimate.estimateNumber}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.removeHeader('Content-Encoding');

      // Send PDF as binary
      res.end(pdfBuffer);

    } catch (error) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  // === SHARING ENDPOINTS ===

  // Create share link
  async createShare(req, res) {
    try {
      const { estimateId, validUntil } = req.body;
      const userId = this.getUserId(req);
      
      if (!estimateId || !validUntil) {
        return res.status(400).json({ 
          error: 'Estimate ID and valid until date are required' 
        });
      }

      // Validate that validUntil is in the future
      const validUntilDate = new Date(validUntil);
      if (validUntilDate <= new Date()) {
        return res.status(400).json({ 
          error: 'Valid until date must be in the future' 
        });
      }

      const share = await this.model.createShare(req, userId, estimateId, validUntilDate);
      res.json(share);
    } catch (error) {
      console.error('Error creating estimate share:', error);
      if (error.message === 'Estimate not found or access denied') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to create share link' });
    }
  }

  // Get estimate by share token (public endpoint)
  async getPublicEstimate(req, res) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ error: 'Share token is required' });
      }

      const estimate = await this.model.getEstimateByShareToken(req, token);
      
      if (!estimate) {
        return res.status(404).json({ 
          error: 'Estimate not found or share link has expired' 
        });
      }

      res.json(estimate);
    } catch (error) {
      console.error('Error getting public estimate:', error);
      res.status(500).json({ error: 'Failed to load estimate' });
    }
  }

  // Get shares for estimate
  async getShares(req, res) {
    try {
      const { estimateId } = req.params;
      const userId = this.getUserId(req);
      
      const shares = await this.model.getSharesForEstimate(req, userId, estimateId);
      res.json(shares);
    } catch (error) {
      console.error('Error getting estimate shares:', error);
      if (error.message === 'Estimate not found or access denied') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to get shares' });
    }
  }

  // Revoke share
  async revokeShare(req, res) {
    try {
      const { shareId } = req.params;
      const userId = this.getUserId(req);
      
      const revokedShare = await this.model.revokeShare(req, userId, shareId);
      res.json({ message: 'Share revoked successfully', share: revokedShare });
    } catch (error) {
      console.error('Error revoking share:', error);
      if (error.message === 'Share not found or access denied') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to revoke share' });
    }
  }
}

module.exports = EstimateController;