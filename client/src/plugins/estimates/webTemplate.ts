// client/src/plugins/estimates/webTemplate.ts
// TypeScript version of web template for frontend use

interface _LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  vatRate?: number;
  lineTotal: number;
}

function escapeHtml(str: string | null | undefined): string {
  if (str === null || str === undefined) {
    return '';
  }
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('sv-SE');
}

function formatCurrency(amount: number, currency = 'SEK') {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function generateWebHTML(estimate: any): string {
  // Use pre-calculated totals if available, fallback to simple calculation
  const totals = {
    subtotal: estimate.subtotal || 0,
    totalDiscount: estimate.totalDiscount || 0,
    subtotalAfterDiscount: estimate.subtotalAfterDiscount || 0,
    estimateDiscountAmount: estimate.estimateDiscountAmount || 0,
    subtotalAfterEstimateDiscount: estimate.subtotalAfterEstimateDiscount || 0,
    totalVat: estimate.totalVat || 0,
    total: estimate.total || 0,
  };

  const isExpired = new Date(estimate.shareValidUntil || estimate.validTo) < new Date();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Estimate ${estimate.estimateNumber}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
        .print-shadow { box-shadow: 0 0 40px rgba(0,0,0,0.05); }
        @media print {
          .no-print { display: none; }
          body { background: white; }
          .print-shadow { box-shadow: none; }
        }
      </style>
    </head>
    <body class="bg-gray-100 min-h-screen py-10 px-4">
      <div class="max-w-4xl mx-auto">
        <!-- Document Container -->
        <div class="bg-white rounded-lg print-shadow overflow-hidden">
          
          <!-- Top Bar (Alerts) -->
          ${
            isExpired
              ? `
          <div class="bg-red-600 text-white text-center py-2 text-sm font-medium no-print">
            This estimate has expired and is no longer valid for acceptance.
          </div>
          `
              : ''
          }
          
          <!-- Header -->
          <div class="p-8 md:p-12 border-b border-gray-100">
            <div class="flex flex-col md:flex-row justify-between gap-8">
              <div>
                <h1 class="text-4xl font-bold text-gray-900 tracking-tight">ESTIMATE</h1>
                <div class="mt-4 space-y-1">
                  <div class="flex items-center text-sm font-medium text-gray-500">
                    <span class="w-24 uppercase">Number</span>
                    <span class="text-gray-900 font-bold">${escapeHtml(estimate.estimateNumber)}</span>
                  </div>
                  <div class="flex items-center text-sm font-medium text-gray-500">
                    <span class="w-24 uppercase">Date</span>
                    <span class="text-gray-900 font-semibold">${formatDate(estimate.createdAt)}</span>
                  </div>
                  <div class="flex items-center text-sm font-medium text-gray-500">
                    <span class="w-24 uppercase font-bold text-gray-900">Valid To</span>
                    <span class="text-gray-900 font-semibold">${formatDate(estimate.validTo)}</span>
                  </div>
                </div>
              </div>
              
              <div class="md:text-right">
                <div class="inline-block px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4
                  ${
                    estimate.status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : estimate.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                  }">
                  ${escapeHtml(estimate.status) || 'DRAFT'}
                </div>
              </div>
            </div>
          </div>

          <!-- Billing Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-12 p-8 md:p-12 bg-gray-50/50">
            <div>
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">From</h2>
              <div class="text-gray-900">
                <div class="font-bold text-lg">Your Organization</div>
                <div class="text-sm text-gray-500 mt-1">
                  <p>Billing Address Line 1</p>
                  <p>Postal Code, City</p>
                  <p class="mt-2">hello@organization.com</p>
                </div>
              </div>
            </div>
            
            <div>
              <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Bill To</h2>
              <div class="text-gray-900">
                <div class="font-bold text-lg">${escapeHtml(estimate.contactName) || 'Customer'}</div>
                <div class="text-sm text-gray-500 mt-1">
                  ${estimate.organizationNumber ? `<p>Org: ${escapeHtml(estimate.organizationNumber)}</p>` : ''}
                  <p>${escapeHtml(estimate.customerEmail)}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Items Table -->
          <div class="px-8 md:p-12">
            <table class="w-full text-left">
              <thead>
                <tr class="border-b-2 border-gray-900">
                  <th class="py-4 text-xs font-bold text-gray-900 uppercase tracking-widest">Description</th>
                  <th class="py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-widest w-20">Qty</th>
                  <th class="py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-widest w-32">Price</th>
                  <th class="py-4 text-right text-xs font-bold text-gray-900 uppercase tracking-widest w-32">Amount</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 text-gray-700">
                ${(estimate.lineItems || [])
                  .map(
                    (item: any) => `
                <tr>
                  <td class="py-6 align-top">
                    <div class="font-semibold text-gray-900">${escapeHtml(item.description) || 'Service Item'}</div>
                  </td>
                  <td class="py-6 text-right align-top tabular-nums">${item.quantity || 1}</td>
                  <td class="py-6 text-right align-top tabular-nums">${formatCurrency(item.unitPrice || 0, estimate.currency)}</td>
                  <td class="py-6 text-right align-top font-semibold text-gray-900 tabular-nums">${formatCurrency(item.lineTotal || 0, estimate.currency)}</td>
                </tr>
                `,
                  )
                  .join('')}
              </tbody>
            </table>
          </div>

          <!-- Summary Section -->
          <div class="p-8 md:p-12 bg-gray-900 text-white">
            <div class="flex justify-end">
              <div class="w-full max-w-xs space-y-3">
                <div class="flex justify-between text-sm text-gray-400">
                  <span>Subtotal</span>
                  <span class="tabular-nums font-medium">${formatCurrency(totals.subtotal, estimate.currency)}</span>
                </div>
                
                ${
                  totals.totalDiscount > 0
                    ? `
                <div class="flex justify-between text-sm text-red-400">
                  <span>Discounts</span>
                  <span class="tabular-nums font-medium">-${formatCurrency(totals.totalDiscount, estimate.currency)}</span>
                </div>
                `
                    : ''
                }
                
                ${
                  totals.estimateDiscountAmount > 0
                    ? `
                <div class="flex justify-between text-sm text-red-400">
                  <span>Adjustment</span>
                  <span class="tabular-nums font-medium">-${formatCurrency(totals.estimateDiscountAmount, estimate.currency)}</span>
                </div>
                `
                    : ''
                }

                <div class="flex justify-between text-sm text-gray-400">
                  <span>Tax (VAT)</span>
                  <span class="tabular-nums font-medium">${formatCurrency(totals.totalVat, estimate.currency)}</span>
                </div>

                <div class="pt-4 border-t border-gray-700 mt-4 flex justify-between items-baseline">
                  <span class="text-lg font-bold uppercase tracking-widest">Total</span>
                  <span class="text-3xl font-bold tabular-nums tracking-tighter">${formatCurrency(totals.total, estimate.currency)}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Notes Section -->
          ${
            estimate.notes
              ? `
          <div class="p-8 md:p-12 border-t border-gray-100">
            <h2 class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Terms & Notes</h2>
            <div class="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              ${escapeHtml(estimate.notes)}
            </div>
          </div>
          `
              : ''
          }

          <!-- Footer -->
          <div class="p-8 md:px-12 md:py-8 bg-gray-50 text-center">
            <div class="text-[10px] text-gray-400 uppercase tracking-[0.2em]">
              ${formatDate(new Date())} • PROCESSED BY HOMEBASE
            </div>
          </div>
        </div>

        <!-- Floating Action Button for acceptance could be added here -->
      </div>
    </body>
    </html>
  `;
}
