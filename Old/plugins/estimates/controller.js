const EstimateModel = require('./model');
const puppeteer = require('puppeteer');
const { generatePDFHTML } = require('./pdfTemplate');

class EstimateController {
  constructor(model) {
    this.model = model;
  }

  // Get all estimates for user
  async getEstimates(req, res) {
    try {
      const estimates = await this.model.getAll(req.session.user.id);
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
      const estimate = await this.model.getById(req.session.user.id, id);
      
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
      const estimate = await this.model.create(req.session.user.id, req.body);
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
      
      // Get current estimate to check status change
      const currentEstimate = await this.model.getById(req.session.user.id, id);
      if (!currentEstimate) {
        return res.status(404).json({ error: 'Estimate not found' });
      }
      
      // Ensure status reasons are properly formatted
      const updateData = {
        ...req.body,
        acceptanceReasons: req.body.acceptanceReasons || [],
        rejectionReasons: req.body.rejectionReasons || []
      };
      
      const estimate = await this.model.update(req.session.user.id, id, updateData);
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
      await this.model.delete(req.session.user.id, id);
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
      const estimateNumber = await this.model.getNextEstimateNumber(req.session.user.id);
      res.json({ estimateNumber });
    } catch (error) {
      console.error('Error getting next estimate number:', error);
      res.status(500).json({ error: 'Failed to get next estimate number' });
    }
  }

  // Get status statistics
  async getStatusStats(req, res) {
    try {
      const userId = req.session.user.id;
      const { startDate, endDate } = req.query;
      
      const stats = await this.model.getStatusStats(userId, startDate, endDate);
      res.json(stats);
    } catch (error) {
      console.error('Error getting status stats:', error);
      res.status(500).json({ error: 'Failed to get status statistics' });
    }
  }

  // Get reason statistics
  async getReasonStats(req, res) {
    try {
      const userId = req.session.user.id;
      const { status } = req.params;
      const { startDate, endDate } = req.query;
      
      if (!['accepted', 'rejected'].includes(status)) {
        return res.status(400).json({ error: 'Status must be accepted or rejected' });
      }
      
      const stats = await this.model.getReasonStats(userId, status, startDate, endDate);
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
      const userId = req.session.user.id;

      // Get estimate data
      const estimate = await this.model.getById(userId, id);
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
      const userId = req.session.user.id;
      
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

      const share = await this.model.createShare(userId, estimateId, validUntilDate);
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

      const estimate = await this.model.getEstimateByShareToken(token);
      
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
      const userId = req.session.user.id;
      
      const shares = await this.model.getSharesForEstimate(userId, estimateId);
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
      const userId = req.session.user.id;
      
      const revokedShare = await this.model.revokeShare(userId, shareId);
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