// plugins/estimates/pdfTemplate.js
// PDF-optimized template for estimate rendering

function formatDate(date) {
  return new Date(date).toLocaleDateString('sv-SE');
}

function formatCurrency(amount, currency = 'SEK') {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

function generatePDFHTML(estimate) {
  const totals = {
    subtotal: estimate.subtotal || 0,
    totalDiscount: estimate.totalDiscount || 0,
    subtotalAfterDiscount: estimate.subtotalAfterDiscount || 0,
    estimateDiscountAmount: estimate.estimateDiscountAmount || 0,
    subtotalAfterEstimateDiscount: estimate.subtotalAfterEstimateDiscount || 0,
    totalVat: estimate.totalVat || 0,
    total: estimate.total || 0,
  };

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Estimate ${estimate.estimateNumber}</title>
        <style>
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            margin: 0;
            padding: 40px;
            font-size: 12px;
            line-height: 1.5;
            color: #1a1a1a;
            background: #fff;
          }
          
          .document-header {
            border-bottom: 3px solid #000;
            padding-bottom: 20px;
            margin-bottom: 40px;
            display: flex;
            justify-content: space-between;
          }
          
          .title {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: -1px;
            margin: 0;
          }
          
          .header-meta {
            text-align: right;
          }
          
          .meta-item {
            margin-bottom: 5px;
          }
          
          .meta-label {
            color: #777;
            text-transform: uppercase;
            font-size: 10px;
            font-weight: bold;
            margin-right: 10px;
          }
          
          .meta-value {
            font-weight: bold;
          }

          .address-grid {
            margin-bottom: 40px;
          }
          
          .address-section {
            width: 45%;
            display: inline-block;
            vertical-align: top;
          }
          
          .address-label {
            font-size: 10px;
            font-weight: bold;
            color: #777;
            text-transform: uppercase;
            border-bottom: 1px solid #eee;
            padding-bottom: 5px;
            margin-bottom: 10px;
          }
          
          .address-content {
            font-size: 12px;
          }

          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 40px;
          }
          
          .items-table th {
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
            font-weight: bold;
            padding: 10px 0;
            border-bottom: 2px solid #000;
          }
          
          .items-table td {
            padding: 15px 0;
            border-bottom: 1px solid #eee;
            vertical-align: top;
          }
          
          .text-right { text-align: right; }
          
          .totals-container {
            width: 100%;
            margin-top: 20px;
          }
          
          .totals-table {
            width: 250px;
            float: right;
            border-collapse: collapse;
          }
          
          .totals-table td {
            padding: 8px 0;
          }
          
          .total-row td {
            border-top: 2px solid #000;
            padding-top: 15px;
            font-size: 16px;
            font-weight: bold;
          }
          
          .notes-section {
            margin-top: 60px;
            clear: both;
          }
          
          .notes-label {
            font-size: 10px;
            font-weight: bold;
            color: #777;
            text-transform: uppercase;
            margin-bottom: 10px;
          }
          
          .notes-content {
            font-size: 11px;
            color: #555;
            white-space: pre-wrap;
          }
          
          .footer {
            position: fixed;
            bottom: 40px;
            left: 40px;
            right: 40px;
            text-align: center;
            font-size: 9px;
            color: #aaa;
            border-top: 1px solid #eee;
            padding-top: 20px;
          }
          
          .badge {
            display: inline-block;
            padding: 4px 8px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
            border: 1px solid #000;
          }
        </style>
      </head>
      <body>
        <div class="document-header">
          <div>
            <h1 class="title">ESTIMATE</h1>
            <div style="margin-top: 10px;">
              <span class="badge">${estimate.status || 'DRAFT'}</span>
            </div>
          </div>
          <div class="header-meta">
            <div class="meta-item">
              <span class="meta-label">Number</span>
              <span class="meta-value">${estimate.estimateNumber}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Date</span>
              <span class="meta-value">${formatDate(estimate.createdAt)}</span>
            </div>
            <div class="meta-item">
              <span class="meta-label">Valid Until</span>
              <span class="meta-value">${formatDate(estimate.validTo)}</span>
            </div>
          </div>
        </div>

        <div class="address-grid">
          <div class="address-section">
            <div class="address-label">From</div>
            <div class="address-content">
              <strong>Your Organization</strong><br>
              Billing Address Line 1<br>
              Postal Code, City<br>
              hello@organization.com
            </div>
          </div>
          <div class="address-section" style="margin-left: 5%;">
            <div class="address-label">Bill To</div>
            <div class="address-content">
              <strong>${estimate.contactName || 'Customer'}</strong><br>
              ${estimate.organizationNumber ? `Org: ${estimate.organizationNumber}<br>` : ''}
              ${estimate.customerEmail || ''}
            </div>
          </div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="text-right" style="width: 60px;">Qty</th>
              <th class="text-right" style="width: 100px;">Price</th>
              <th class="text-right" style="width: 100px;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${(estimate.lineItems || [])
      .map(
        (item) => `
              <tr>
                <td><strong>${item.description || 'Service Item'}</strong></td>
                <td class="text-right">${item.quantity || 1}</td>
                <td class="text-right">${formatCurrency(item.unitPrice || 0, estimate.currency)}</td>
                <td class="text-right"><strong>${formatCurrency(item.lineTotal || 0, estimate.currency)}</strong></td>
              </tr>
            `,
      )
      .join('')}
          </tbody>
        </table>

        <div class="totals-container">
          <table class="totals-table">
            <tr>
              <td style="color: #777;">Subtotal</td>
              <td class="text-right">${formatCurrency(totals.subtotal, estimate.currency)}</td>
            </tr>
            ${totals.totalDiscount > 0
      ? `
            <tr>
              <td style="color: #c00;">Discounts</td>
              <td class="text-right" style="color: #c00;">-${formatCurrency(totals.totalDiscount, estimate.currency)}</td>
            </tr>
            `
      : ''
    }
            ${totals.estimateDiscountAmount > 0
      ? `
            <tr>
              <td style="color: #c00;">Adjustment</td>
              <td class="text-right" style="color: #c00;">-${formatCurrency(totals.estimateDiscountAmount, estimate.currency)}</td>
            </tr>
            `
      : ''
    }
            <tr>
              <td style="color: #777;">Tax (VAT)</td>
              <td class="text-right">${formatCurrency(totals.totalVat, estimate.currency)}</td>
            </tr>
            <tr class="total-row">
              <td>TOTAL</td>
              <td class="text-right">${formatCurrency(totals.total, estimate.currency)}</td>
            </tr>
          </table>
        </div>

        ${estimate.notes
      ? `
        <div class="notes-section">
          <div class="address-label">Notes</div>
          <div class="notes-content">${estimate.notes}</div>
        </div>
        `
      : ''
    }

        <div class="footer">
          Generated on ${formatDate(new Date())} • This estimate is valid until ${formatDate(
      estimate.validTo,
    )}<br>
          PROCESSED BY HOMEBASE
        </div>
      </body>
      </html>
    `;
}

module.exports = {
  generatePDFHTML,
  formatDate,
  formatCurrency,
};