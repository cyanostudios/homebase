const EstimateModel = require('./model');
const puppeteer = require('puppeteer');

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

    // Generate HTML content for the estimate
    console.log('📝 Generating HTML...');
    const html = this.generateEstimateHTML(estimate);
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


  // Generate HTML template for estimate PDF
  generateEstimateHTML(estimate) {
    // Calculate totals
    const totals = this.calculateTotals(estimate.lineItems || [], estimate.estimateDiscount || 0);
    
    // Format date helper
    const formatDate = (date) => {
      return new Date(date).toLocaleDateString('sv-SE'); // Swedish date format
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Estimate ${estimate.estimateNumber}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px;
          color: #1f2937;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 2px solid #e5e7eb;
          padding-bottom: 20px;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          color: #111827;
          margin-bottom: 8px;
        }
        .estimate-title {
          font-size: 20px;
          color: #374151;
          margin: 0;
        }
        .estimate-number {
          font-size: 16px;
          color: #6b7280;
          margin-top: 5px;
        }
        .info-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-bottom: 40px;
        }
        .info-block h3 {
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          margin: 0 0 10px 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .info-block p {
          margin: 4px 0;
          font-size: 14px;
        }
        .line-items {
          margin-bottom: 40px;
        }
        .line-items h3 {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 15px;
          color: #111827;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        th {
          background-color: #f9fafb;
          padding: 12px 8px;
          text-align: left;
          font-weight: 600;
          color: #374151;
          border-bottom: 1px solid #e5e7eb;
        }
        th.number {
          text-align: right;
        }
        td {
          padding: 12px 8px;
          border-bottom: 1px solid #f3f4f6;
        }
        td.number {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
        .description {
          max-width: 200px;
          word-wrap: break-word;
        }
        .totals {
          margin-top: 20px;
          text-align: right;
        }
        .totals table {
          margin-left: auto;
          width: 300px;
        }
        .totals th, .totals td {
          padding: 8px;
          border: none;
        }
        .totals .final-total {
          font-weight: bold;
          font-size: 14px;
          border-top: 2px solid #111827;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .status-draft {
          background-color: #f3f4f6;
          color: #374151;
        }
        .status-sent {
          background-color: #dbeafe;
          color: #1d4ed8;
        }
        .status-accepted {
          background-color: #d1fae5;
          color: #065f46;
        }
        .status-rejected {
          background-color: #fee2e2;
          color: #991b1b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">Homebase Business Application</div>
        <h1 class="estimate-title">Estimate</h1>
        <div class="estimate-number">#${estimate.estimateNumber}</div>
        <div style="margin-top: 10px;">
          <span class="status-badge status-${estimate.status}">${estimate.status}</span>
        </div>
      </div>

      <div class="info-section">
        <div class="info-block">
          <h3>To</h3>
          <p><strong>${estimate.contactName}</strong></p>
          ${estimate.organizationNumber ? `<p>Org.nr: ${estimate.organizationNumber}</p>` : ''}
        </div>
        <div class="info-block">
          <h3>Estimate Details</h3>
          <p><strong>Date:</strong> ${formatDate(estimate.createdAt)}</p>
          <p><strong>Valid to:</strong> ${formatDate(estimate.validTo)}</p>
          <p><strong>Currency:</strong> ${estimate.currency}</p>
        </div>
      </div>

      ${estimate.lineItems && estimate.lineItems.length > 0 ? `
      <div class="line-items">
        <h3>Line Items</h3>
        <table>
          <thead>
            <tr>
              <th class="description">Description</th>
              <th class="number">Qty</th>
              <th class="number">Unit Price</th>
              <th class="number">Discount %</th>
              <th class="number">VAT %</th>
              <th class="number">Subtotal</th>
              <th class="number">Discount</th>
              <th class="number">VAT</th>
              <th class="number">Total</th>
            </tr>
          </thead>
          <tbody>
            ${estimate.lineItems.map(item => `
            <tr>
              <td class="description">${item.description || ''}</td>
              <td class="number">${(item.quantity || 0).toFixed(1)}</td>
              <td class="number">${(item.unitPrice || 0).toFixed(2)}</td>
              <td class="number">${(item.discount || 0).toFixed(1)}</td>
              <td class="number">${(item.vatRate || 0).toFixed(0)}</td>
              <td class="number">${(item.lineSubtotal || 0).toFixed(2)}</td>
              <td class="number">-${(item.discountAmount || 0).toFixed(2)}</td>
              <td class="number">${(item.vatAmount || 0).toFixed(2)}</td>
              <td class="number"><strong>${(item.lineTotal || 0).toFixed(2)}</strong></td>
            </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div class="totals">
        <table>
          <tr>
            <th>Subtotal:</th>
            <td class="number">${totals.subtotal.toFixed(2)} ${estimate.currency}</td>
          </tr>
          ${totals.totalDiscount > 0 ? `
          <tr>
            <th>Total Line Discount:</th>
            <td class="number">-${totals.totalDiscount.toFixed(2)} ${estimate.currency}</td>
          </tr>
          ` : ''}
          ${estimate.estimateDiscount > 0 ? `
          <tr>
            <th>Estimate Discount (${estimate.estimateDiscount}%):</th>
            <td class="number">-${totals.estimateDiscountAmount.toFixed(2)} ${estimate.currency}</td>
          </tr>
          ` : ''}
          <tr>
            <th>Subtotal after discounts:</th>
            <td class="number">${totals.subtotalAfterEstimateDiscount.toFixed(2)} ${estimate.currency}</td>
          </tr>
          <tr>
            <th>Total VAT:</th>
            <td class="number">${totals.totalVat.toFixed(2)} ${estimate.currency}</td>
          </tr>
          <tr class="final-total">
            <th>Total Amount:</th>
            <td class="number">${totals.total.toFixed(2)} ${estimate.currency}</td>
          </tr>
        </table>
      </div>

      ${estimate.notes ? `
      <div style="margin-top: 40px;">
        <h3>Notes</h3>
        <p style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 0;">${estimate.notes}</p>
      </div>
      ` : ''}

      <div class="footer">
        <p>Generated on ${formatDate(new Date())} by Homebase Business Application</p>
      </div>
    </body>
    </html>
    `;
  }

  // Helper method to calculate totals (copied from frontend logic)
  calculateTotals(lineItems, estimateDiscount = 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalVat = 0;
    
    lineItems.forEach(item => {
      const lineSubtotal = item.lineSubtotal || ((item.quantity || 0) * (item.unitPrice || 0));
      const discountAmount = item.discountAmount || 0;
      const vatAmount = item.vatAmount || 0;
      
      subtotal += lineSubtotal;
      totalDiscount += discountAmount;
      totalVat += vatAmount;
    });
    
    const subtotalAfterDiscount = subtotal - totalDiscount;
    const estimateDiscountAmount = subtotalAfterDiscount * (estimateDiscount / 100);
    const subtotalAfterEstimateDiscount = subtotalAfterDiscount - estimateDiscountAmount;
    const totalVatAfterEstimateDiscount = subtotalAfterEstimateDiscount * 0.25; // Simplified VAT calculation
    const total = subtotalAfterEstimateDiscount + totalVatAfterEstimateDiscount;
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalDiscount: Math.round(totalDiscount * 100) / 100,
      subtotalAfterDiscount: Math.round(subtotalAfterDiscount * 100) / 100,
      estimateDiscountAmount: Math.round(estimateDiscountAmount * 100) / 100,
      subtotalAfterEstimateDiscount: Math.round(subtotalAfterEstimateDiscount * 100) / 100,
      totalVat: Math.round(totalVatAfterEstimateDiscount * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
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