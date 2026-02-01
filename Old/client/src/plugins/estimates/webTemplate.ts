// client/src/plugins/estimates/webTemplate.ts
// TypeScript version of web template for frontend use

interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  vatRate?: number;
  lineTotal: number;
}

interface Estimate {
  estimateNumber: string;
  status: string;
  contactName: string;
  organizationNumber?: string;
  currency: string;
  createdAt: string;
  validTo: string;
  shareValidUntil?: string;
  accessedCount?: number;
  notes?: string;
  lineItems: LineItem[];
}

function calculateTotals(lineItems: LineItem[], discount = 0) {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + item.quantity * item.unitPrice;
  }, 0);

  const discountAmount = subtotal * (discount / 100);
  const discountedSubtotal = subtotal - discountAmount;
  const vatAmount = discountedSubtotal * 0.25;
  const total = discountedSubtotal + vatAmount;

  return { subtotal, discountAmount, discountedSubtotal, vatAmount, total };
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

export function generateWebHTML(estimate: Estimate): string {
  const totals = calculateTotals(estimate.lineItems || []);
  const isExpired = new Date(estimate.shareValidUntil || estimate.validTo) < new Date();

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Estimate ${estimate.estimateNumber} - Professional Services</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .estimate-gradient { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .glass-effect { backdrop-filter: blur(10px); background: rgba(255, 255, 255, 0.9); }
        .hover-lift { transition: transform 0.2s ease; }
        .hover-lift:hover { transform: translateY(-2px); }
        .animate-fade-in { animation: fadeIn 0.5s ease-in; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      </style>
    </head>
    <body class="bg-gray-50 min-h-screen">
      <!-- Header with Gradient -->
      <div class="estimate-gradient text-white">
        <div class="max-w-6xl mx-auto px-4 py-8">
          <div class="glass-effect rounded-2xl p-6 text-gray-900">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between">
              <div class="mb-4 md:mb-0">
                <h1 class="text-3xl font-bold mb-2">Business Estimate</h1>
                <p class="text-gray-600">Professional estimate viewing portal</p>
                <div class="flex items-center mt-3 space-x-4">
                  <div class="flex items-center text-sm text-gray-500">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                    </svg>
                    Public View • Accessed ${estimate.accessedCount || 0} times
                  </div>
                  <div class="flex items-center text-sm ${isExpired ? 'text-red-600' : 'text-blue-600'}">
                    <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/>
                    </svg>
                    ${isExpired ? 'Expired' : 'Valid until'} ${formatDate(estimate.validTo)}
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm text-gray-500 mb-1">Estimate Number</div>
                <div class="text-2xl font-bold">${estimate.estimateNumber}</div>
                <div class="mt-2">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                    ${
                      estimate.status === 'draft'
                        ? 'bg-gray-100 text-gray-800'
                        : estimate.status === 'sent'
                          ? 'bg-blue-100 text-blue-800'
                          : estimate.status === 'accepted'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                    }">
                    ${estimate.status?.toUpperCase() || 'DRAFT'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="max-w-6xl mx-auto px-4 py-8">
        <div class="animate-fade-in space-y-8">
          
          <!-- Customer & Company Info -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <!-- Customer Information -->
            <div class="bg-white rounded-xl shadow-lg p-6 hover-lift">
              <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                </svg>
                Customer Information
              </h3>
              <div class="space-y-3">
                <div>
                  <div class="text-sm text-gray-500">Name</div>
                  <div class="font-medium text-gray-900">${estimate.contactName || 'Customer Name'}</div>
                </div>
                ${
                  estimate.organizationNumber
                    ? `
                <div>
                  <div class="text-sm text-gray-500">Organization Number</div>
                  <div class="text-gray-900">${estimate.organizationNumber}</div>
                </div>
                `
                    : ''
                }
              </div>
            </div>

            <!-- Company Information -->
            <div class="bg-white rounded-xl shadow-lg p-6 hover-lift">
              <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-6a1 1 0 00-1-1H9a1 1 0 00-1 1v6a1 1 0 01-1 1H4a1 1 0 110-2V4z" clip-rule="evenodd"/>
                </svg>
                Company Information
              </h3>
              <div class="space-y-3">
                <div>
                  <div class="text-sm text-gray-500">Company</div>
                  <div class="font-medium text-gray-900">Professional Services Ltd</div>
                </div>
                <div>
                  <div class="text-sm text-gray-500">Email</div>
                  <a href="mailto:hello@company.com" class="text-blue-600 hover:text-blue-800 font-medium">
                    hello@company.com
                  </a>
                </div>
                <div>
                  <div class="text-sm text-gray-500">Phone</div>
                  <a href="tel:+1234567890" class="text-blue-600 hover:text-blue-800 font-medium">
                    +1 (234) 567-8900
                  </a>
                </div>
              </div>
            </div>
          </div>

          <!-- Line Items -->
          <div class="bg-white rounded-xl shadow-lg overflow-hidden hover-lift">
            <div class="p-6 border-b border-gray-200">
              <h3 class="text-lg font-semibold text-gray-900 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
                </svg>
                Items & Services
              </h3>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full">
                <thead class="bg-gray-50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  ${(estimate.lineItems || [])
                    .map(
                      (item, index) => `
                  <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}">
                    <td class="px-6 py-4 text-sm text-gray-900">${item.description || 'Service Item'}</td>
                    <td class="px-6 py-4 text-sm text-gray-900 text-right">${item.quantity || 1}</td>
                    <td class="px-6 py-4 text-sm text-gray-900 text-right">${formatCurrency(item.unitPrice || 0, estimate.currency)}</td>
                    <td class="px-6 py-4 text-sm font-medium text-gray-900 text-right">${formatCurrency(item.lineTotal || 0, estimate.currency)}</td>
                  </tr>
                  `,
                    )
                    .join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Totals Section -->
          <div class="flex justify-end">
            <div class="bg-white rounded-xl shadow-lg p-6 w-full max-w-md hover-lift">
              <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                </svg>
                Summary
              </h3>
              <div class="space-y-3">
                <div class="flex justify-between">
                  <span class="text-gray-600">Subtotal:</span>
                  <span class="font-medium">${formatCurrency(totals.subtotal, estimate.currency)}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600">VAT (25%):</span>
                  <span class="font-medium">${formatCurrency(totals.vatAmount, estimate.currency)}</span>
                </div>
                <div class="border-t border-gray-200 pt-3">
                  <div class="flex justify-between text-lg font-bold text-blue-600">
                    <span>Total:</span>
                    <span>${formatCurrency(totals.total, estimate.currency)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          ${
            estimate.notes
              ? `
          <div class="bg-white rounded-xl shadow-lg p-6 hover-lift">
            <h3 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <svg class="w-5 h-5 mr-2 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd"/>
              </svg>
              Notes
            </h3>
            <div class="bg-gray-50 rounded-lg p-4 whitespace-pre-wrap text-gray-900">${estimate.notes}</div>
          </div>
          `
              : ''
          }

          <!-- Footer -->
          <div class="text-center py-8 border-t border-gray-200">
            <p class="text-gray-500 text-sm">
              Generated on ${formatDate(new Date())} • 
              This estimate is valid until ${formatDate(estimate.validTo)}
            </p>
            <p class="text-gray-400 text-xs mt-2">
              Professional Services Ltd • Powered by Homebase
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
