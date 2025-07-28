const EstimateModel = require('./model');
const puppeteer = require('puppeteer');
const { generatePDFHTML } = require('./pdfTemplate'); // 🆕 Import PDF template

class EstimateController {
  constructor(model) {
    this.model = model;
  }

  // Get all estimates for user - matches model.getAll()
  async getEstimates(req, res) {
    try {
      const estimates = await this.model.getAll(req.session.user.id);
      res.json(estimates);
    } catch (error) {
      console.error('Error getting estimates:', error);
      res.status(500).json({ error: 'Failed to get estimates' });
    }
  }

  // Get single estimate - now uses model.getById()
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

  // Create new estimate - matches model.create()
  async createEstimate(req, res) {
    try {
      const estimate = await this.model.create(req.session.user.id, req.body);
      res.status(201).json(estimate);
    } catch (error) {
      console.error('Error creating estimate:', error);
      res.status(500).json({ error: 'Failed to create estimate' });
    }
  }

  // Update estimate - matches model.update()
  async updateEstimate(req, res) {
    try {
      const { id } = req.params;
      const estimate = await this.model.update(req.session.user.id, id, req.body);
      res.json(estimate);
    } catch (error) {
      console.error('Error updating estimate:', error);
      if (error.message === 'Estimate not found') {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: 'Failed to update estimate' });
    }
  }

  // Delete estimate - matches model.delete()
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

  // Get next estimate number - matches model.getNextEstimateNumber()
  async getNextEstimateNumber(req, res) {
    try {
      const estimateNumber = await this.model.getNextEstimateNumber(req.session.user.id);
      res.json({ estimateNumber });
    } catch (error) {
      console.error('Error getting next estimate number:', error);
      res.status(500).json({ error: 'Failed to get next estimate number' });
    }
  }

  // === PDF GENERATION METHOD ===
  async generatePDF(req, res) {
    let browser = null;

    try {
      console.log('🚀 PDF Route params:', req.params);
      console.log('🚀 PDF Route URL:', req.url);
      const { id } = req.params;
      console.log('🚀 Extracted ID:', id, 'Type:', typeof id);
      const userId = req.session.user.id;
      console.log('🚀 User ID:', userId);

      console.log('📋 Getting estimate data for ID:', id);

      // Get estimate data
      const estimate = await this.model.getById(userId, id);
      if (!estimate) {
        console.log('❌ Estimate not found');
        return res.status(404).json({ error: 'Estimate not found' });
      }

      console.log('✅ Estimate found:', estimate.estimateNumber);
      console.log('🌐 Launching Puppeteer browser...');

      // Launch Puppeteer browser
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('✅ Browser launched successfully');

      const page = await browser.newPage();
      console.log('✅ Page created');

      // 🆕 Generate HTML content using the new PDF template
      console.log('📝 Generating HTML using pdfTemplate...');
      const html = generatePDFHTML(estimate);
      console.log('✅ HTML generated, length:', html.length);

      // Set HTML content
      console.log('📄 Setting page content...');
      await page.setContent(html, { waitUntil: 'networkidle0' });
      console.log('✅ Page content set');

      // Generate PDF
      console.log('📄 Generating PDF...');
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
      console.log('✅ PDF generated, size:', pdfBuffer.length, 'bytes');

      // Set response headers for download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=estimate-${estimate.estimateNumber}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.removeHeader('Content-Encoding'); // Prevent gzip issues

      console.log('📤 Sending PDF to client...');
      // Send PDF as binary
      res.end(pdfBuffer);
      console.log('✅ PDF sent successfully');

    } catch (error) {
      console.error('❌ Error generating PDF:', error);
      res.status(500).json({ error: 'Failed to generate PDF' });
    } finally {
      if (browser) {
        console.log('🔒 Closing browser...');
        await browser.close();
        console.log('✅ Browser closed');
      }
    }
  }

  // 🗑️ REMOVED: generateEstimateHTML() - now in pdfTemplate.js
  // 🗑️ REMOVED: calculateTotals() - now in pdfTemplate.js

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

  // Get estimate by share token (public endpoint - no auth required)
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

      // Return estimate data for public view
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