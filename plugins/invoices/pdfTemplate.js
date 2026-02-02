// plugins/invoices/pdfTemplate.js
// PDF template for invoices: shows issue/due dates, payment terms and paid/overdue badges.

function formatDate(d) {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: '2-digit' });
  }
  
  function formatCurrency(amount, currency = 'SEK') {
    const n = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return new Intl.NumberFormat('sv-SE', { style: 'currency', currency }).format(n);
  }
  
  // Fallback calculator (only used if DB totals are missing). DB totals should already be provided.
  function fallbackTotals(lineItems = [], invoiceDiscount = 0, vatRateDefault = 0.25) {
    const subtotal = lineItems.reduce((sum, li) => sum + (Number(li.quantity || 0) * Number(li.unitPrice || 0)), 0);
    const invoiceDiscountAmount = subtotal * (Number(invoiceDiscount || 0) / 100);
    const afterDiscount = subtotal - invoiceDiscountAmount;
    const totalVat = afterDiscount * vatRateDefault;
    const total = afterDiscount + totalVat;
    return {
      subtotal, totalDiscount: 0, subtotalAfterDiscount: subtotal,
      invoiceDiscountAmount, subtotalAfterInvoiceDiscount: afterDiscount,
      totalVat, total
    };
  }
  
  function generatePDFHTML(invoice) {
    // Prefer server-calculated totals; fall back if missing.
    const totals = {
      subtotal: invoice.subtotal ?? undefined,
      totalDiscount: invoice.totalDiscount ?? undefined,
      subtotalAfterDiscount: invoice.subtotalAfterDiscount ?? undefined,
      invoiceDiscountAmount: invoice.invoiceDiscountAmount ?? undefined,
      subtotalAfterInvoiceDiscount: invoice.subtotalAfterInvoiceDiscount ?? undefined,
      totalVat: invoice.totalVat ?? undefined,
      total: invoice.total ?? undefined,
    };
    const needFallback = Object.values(totals).some(v => typeof v !== 'number' || Number.isNaN(v));
    const safeTotals = needFallback
      ? fallbackTotals(invoice.lineItems, invoice.invoiceDiscount)
      : totals;
  
    const isPaid = invoice.status === 'paid';
    const isOverdue = invoice.status === 'overdue';
    const numberLabel = invoice.invoiceNumber || `DRAFT-${invoice.id}`;
  
    return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Invoice ${numberLabel}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; color:#111827; margin:0; padding:24px; }
      .invoice-container { max-width: 800px; margin: 0 auto; }
      .invoice-header { display: flex; justify-content: space-between; margin-bottom: 24px; border-bottom: 2px solid #2563eb; padding-bottom: 16px; }
      .company-info h1 { margin: 0 0 8px 0; color: #2563eb; font-size: 22px; }
      .company-info p { margin: 4px 0; color: #6b7280; }
      .invoice-info { text-align: right; }
      .invoice-info h2 { margin: 0 0 8px 0; font-size: 20px; letter-spacing: 1px; }
      .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; margin-top: 6px; }
      .badge-paid { background: #10b981; color: white; }
      .badge-overdue { background: #ef4444; color: white; }
      .badge-draft { background: #9ca3af; color: white; }
  
      .details { display:flex; gap: 24px; margin: 18px 0 8px 0; }
      .col { flex: 1; }
      .section-title { font-weight: 700; margin: 0 0 8px 0; color: #1f2937; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
  
      .items-table { width:100%; border-collapse: collapse; margin-top: 16px; }
      .items-table th, .items-table td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; vertical-align: top; }
      .items-table th { background: #f3f4f6; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; color:#374151; }
      .right { text-align: right; white-space: nowrap; }
  
      .totals { margin-top: 16px; display:flex; justify-content:flex-end; }
      .totals table { width: 360px; border-collapse: collapse; }
      .totals td { padding: 6px 0; }
      .totals .label { color:#374151; }
      .totals .amount { text-align: right; }
      .totals .grand { border-top: 2px solid #111827; padding-top: 8px; font-weight: 700; }
  
      .notes { margin-top: 20px; background:#f8fafc; padding:12px; border-radius:8px; white-space: pre-wrap; }
      .footer { margin-top: 28px; font-size: 12px; color:#6b7280; text-align:center; }
  
      .watermark-paid { position: fixed; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-15deg); font-size: 80px; color: rgba(16,185,129,0.15); font-weight: 900; pointer-events: none; }
    </style>
  </head>
  <body>
    ${isPaid ? '<div class="watermark-paid">PAID</div>' : ''}
    <div class="invoice-container">
      <div class="invoice-header">
        <div class="company-info">
          <h1>Professional Services Ltd</h1>
          <p>Business Address Line 1</p>
          <p>City, Postal Code</p>
          <p>Email: hello@company.com</p>
          <p>Phone: +1 (234) 567-8900</p>
        </div>
        <div class="invoice-info">
          <h2>INVOICE</h2>
          <p><strong>Number:</strong> ${numberLabel}</p>
          <p><strong>Issue Date:</strong> ${formatDate(invoice.issueDate || invoice.createdAt)}</p>
          <p><strong>Due Date:</strong> ${formatDate(invoice.dueDate)}</p>
          <div class="badge ${isPaid ? 'badge-paid' : isOverdue ? 'badge-overdue' : 'badge-draft'}">
            ${isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : (invoice.status || 'DRAFT').toUpperCase()}
          </div>
        </div>
      </div>
  
      <div class="details">
        <div class="col">
          <div class="section-title">Bill To</div>
          <div><strong>${invoice.contactName || 'Customer Name'}</strong></div>
          ${invoice.organizationNumber ? `<div>Org.nr: ${invoice.organizationNumber}</div>` : ''}
        </div>
        <div class="col">
          <div class="section-title">Payment</div>
          <div><strong>Terms:</strong> ${invoice.paymentTerms || '30 days net'}</div>
          <div><strong>Currency:</strong> ${invoice.currency || 'SEK'}</div>
          ${invoice.paidAt ? `<div><strong>Paid At:</strong> ${formatDate(invoice.paidAt)}</div>` : ''}
        </div>
      </div>
  
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:48%;">Item</th>
            <th style="width:12%;">Qty</th>
            <th style="width:20%;" class="right">Unit Price</th>
            <th style="width:20%;" class="right">Line Total</th>
          </tr>
        </thead>
        <tbody>
          ${(invoice.lineItems || []).map(li => `
            <tr>
              <td>
                <div><strong>${li.name || li.title || 'Item'}</strong></div>
                ${li.description ? `<div style="color:#6b7280; font-size:12px;">${li.description}</div>` : ''}
              </td>
              <td>${li.quantity || 0}</td>
              <td class="right">${formatCurrency((li.unitPrice || 0), invoice.currency)}</td>
              <td class="right">${formatCurrency((li.quantity || 0) * (li.unitPrice || 0), invoice.currency)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
  
      <div class="totals">
        <table>
          <tr>
            <td class="label">Subtotal:</td>
            <td class="amount">${formatCurrency(safeTotals.subtotal, invoice.currency)}</td>
          </tr>
          ${Number(safeTotals.invoiceDiscountAmount || 0) > 0 ? `
          <tr>
            <td class="label">Invoice Discount:</td>
            <td class="amount">-${formatCurrency(safeTotals.invoiceDiscountAmount, invoice.currency)}</td>
          </tr>` : ''}
          <tr>
            <td class="label">VAT:</td>
            <td class="amount">${formatCurrency(safeTotals.totalVat, invoice.currency)}</td>
          </tr>
          <tr>
            <td class="label grand">Total:</td>
            <td class="amount grand">${formatCurrency(safeTotals.total, invoice.currency)}</td>
          </tr>
        </table>
      </div>
  
      ${invoice.notes ? `
        <div class="notes">
          ${invoice.notes}
        </div>
      ` : ''}
  
      <div class="footer">
        <p>Generated on ${formatDate(new Date())}</p>
        <p>Thank you for your business!</p>
      </div>
    </div>
  </body>
  </html>
  `;
  }
  
  module.exports = {
    generatePDFHTML,
    formatDate,
    formatCurrency,
    fallbackTotals
  };
  