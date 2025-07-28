// plugins/estimates/pdfTemplate.js
// PDF-optimized template for estimate rendering

function calculateTotals(lineItems, discount = 0) {
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);
    
    const discountAmount = subtotal * (discount / 100);
    const discountedSubtotal = subtotal - discountAmount;
    const vatAmount = discountedSubtotal * 0.25;
    const total = discountedSubtotal + vatAmount;
    
    return { subtotal, discountAmount, discountedSubtotal, vatAmount, total };
  }
  
  function formatDate(date) {
    return new Date(date).toLocaleDateString('sv-SE');
  }
  
  function formatCurrency(amount, currency = 'SEK') {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }
  
  function generatePDFHTML(estimate) {
    const totals = calculateTotals(estimate.lineItems || [], estimate.estimateDiscount || 0);
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Estimate ${estimate.estimateNumber}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            font-size: 14px;
            line-height: 1.4;
            color: #333;
          }
          
          .estimate-container {
            max-width: 800px;
            margin: 0 auto;
          }
          
          .estimate-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
          }
          
          .company-info h1 {
            margin: 0 0 10px 0;
            color: #2563eb;
            font-size: 24px;
          }
          
          .company-info p {
            margin: 5px 0;
            color: #666;
          }
          
          .estimate-info {
            text-align: right;
          }
          
          .estimate-info h2 {
            margin: 0 0 10px 0;
            font-size: 20px;
            color: #333;
          }
          
          .estimate-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
          }
          
          .customer-section,
          .estimate-meta {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
          }
          
          .section-title {
            font-weight: bold;
            margin-bottom: 15px;
            color: #1f2937;
            border-bottom: 1px solid #d1d5db;
            padding-bottom: 5px;
          }
          
          .line-items {
            margin: 30px 0;
          }
          
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          
          .items-table th,
          .items-table td {
            padding: 12px 8px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .items-table th {
            background-color: #f3f4f6;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            color: #374151;
          }
          
          .items-table td.number {
            text-align: right;
          }
          
          .items-table th.number {
            text-align: right;
          }
          
          .totals-section {
            margin-top: 30px;
            display: flex;
            justify-content: flex-end;
          }
          
          .totals-table {
            width: 300px;
            border-collapse: collapse;
          }
          
          .totals-table td {
            padding: 8px 12px;
            border: none;
          }
          
          .totals-table .label {
            text-align: right;
            font-weight: normal;
          }
          
          .totals-table .amount {
            text-align: right;
            font-weight: bold;
            width: 120px;
          }
          
          .total-row {
            border-top: 2px solid #2563eb;
            font-size: 16px;
            color: #2563eb;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
          }
          
          .status-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
          }
          
          .status-draft { background: #f3f4f6; color: #374151; }
          .status-sent { background: #dbeafe; color: #1d4ed8; }
          .status-accepted { background: #d1fae5; color: #065f46; }
          .status-rejected { background: #fee2e2; color: #991b1b; }
          
          @media print {
            body { margin: 0; padding: 15px; }
            .estimate-container { max-width: none; }
          }
        </style>
      </head>
      <body>
        <div class="estimate-container">
          <!-- Header -->
          <div class="estimate-header">
            <div class="company-info">
              <h1>Professional Services Ltd</h1>
              <p>Business Address Line 1</p>
              <p>City, Postal Code</p>
              <p>Email: hello@company.com</p>
              <p>Phone: +1 (234) 567-8900</p>
            </div>
            <div class="estimate-info">
              <h2>ESTIMATE</h2>
              <p><strong>Number:</strong> ${estimate.estimateNumber}</p>
              <p><strong>Date:</strong> ${formatDate(estimate.createdAt)}</p>
              <p><strong>Valid Until:</strong> ${formatDate(estimate.validTo)}</p>
              <div class="status-badge status-${estimate.status}">${estimate.status}</div>
            </div>
          </div>
  
          <!-- Customer and Estimate Details -->
          <div class="estimate-details">
            <div class="customer-section">
              <div class="section-title">Bill To:</div>
              <div><strong>${estimate.customerName || 'Customer Name'}</strong></div>
              <div>${estimate.customerEmail || ''}</div>
              <div>${estimate.customerAddress || ''}</div>
            </div>
            
            <div class="estimate-meta">
              <div class="section-title">Estimate Details:</div>
              <p><strong>Title:</strong> ${estimate.title || 'Professional Services'}</p>
              <p><strong>Currency:</strong> ${estimate.currency || 'SEK'}</p>
              <p><strong>Payment Terms:</strong> ${estimate.paymentTerms || 'Net 30'}</p>
            </div>
          </div>
  
          <!-- Line Items -->
          <div class="line-items">
            <div class="section-title">Items & Services</div>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th class="number">Qty</th>
                  <th class="number">Unit Price</th>
                  <th class="number">Discount</th>
                  <th class="number">Total</th>
                </tr>
              </thead>
              <tbody>
                ${(estimate.lineItems || []).map(item => `
                  <tr>
                    <td>${item.description || 'Service Item'}</td>
                    <td class="number">${item.quantity || 1}</td>
                    <td class="number">${formatCurrency(item.unitPrice || 0, estimate.currency)}</td>
                    <td class="number">${item.discount || 0}%</td>
                    <td class="number">${formatCurrency((item.quantity || 1) * (item.unitPrice || 0), estimate.currency)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
  
          <!-- Totals -->
          <div class="totals-section">
            <table class="totals-table">
              <tr>
                <td class="label">Subtotal:</td>
                <td class="amount">${formatCurrency(totals.subtotal, estimate.currency)}</td>
              </tr>
              ${totals.discountAmount > 0 ? `
              <tr>
                <td class="label">Discount:</td>
                <td class="amount">-${formatCurrency(totals.discountAmount, estimate.currency)}</td>
              </tr>
              ` : ''}
              <tr>
                <td class="label">VAT (25%):</td>
                <td class="amount">${formatCurrency(totals.vatAmount, estimate.currency)}</td>
              </tr>
              <tr class="total-row">
                <td class="label"><strong>Total:</strong></td>
                <td class="amount"><strong>${formatCurrency(totals.total, estimate.currency)}</strong></td>
              </tr>
            </table>
          </div>
  
          <!-- Notes -->
          ${estimate.notes ? `
          <div style="margin-top: 30px;">
            <div class="section-title">Notes</div>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; white-space: pre-wrap;">${estimate.notes}</div>
          </div>
          ` : ''}
  
          <!-- Footer -->
          <div class="footer">
            <p>Generated on ${formatDate(new Date())} • This estimate is valid until ${formatDate(estimate.validTo)}</p>
            <p>Thank you for your business!</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
  module.exports = {
    generatePDFHTML,
    calculateTotals,
    formatDate,
    formatCurrency
  };