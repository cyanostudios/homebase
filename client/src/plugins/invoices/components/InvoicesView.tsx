import React from 'react';
import { Heading } from '@/core/ui/Typography';
import { Card } from '@/core/ui/Card';
import { Invoice } from '../types/invoices';
import { InvoiceActions } from './InvoiceActions';

interface InvoiceViewProps {
  invoice?: Invoice;
  item?: any; // Generic fallback prop for automated system compatibility
}

export const InvoicesView: React.FC<InvoiceViewProps> = ({ 
  invoice, 
  item 
}) => {
  const actualItem = invoice || item;
  
  if (!actualItem) return null;

  const created = actualItem.createdAt ? new Date(actualItem.createdAt) : null;
  const updated = actualItem.updatedAt ? new Date(actualItem.updatedAt) : null;
  const issueDate = actualItem.issueDate ? new Date(actualItem.issueDate) : null;
  const dueDate = actualItem.dueDate ? new Date(actualItem.dueDate) : null;

  // Summary fields
  const invoiceNumber: string = actualItem.invoiceNumber ?? '';
  const status: string = actualItem.status ?? 'draft';
  const contactName: string = actualItem.contactName ?? '';
  const currency: string = actualItem.currency ?? 'SEK';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Invoice</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-gray-500">Number</div>
            <div className="text-gray-900 font-medium">{invoiceNumber || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Status</div>
            <div className="text-gray-900">{status}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Customer</div>
            <div className="text-gray-900">{contactName || '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Issue Date</div>
            <div className="text-gray-900">{issueDate ? issueDate.toLocaleDateString() : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Due Date</div>
            <div className="text-gray-900">{dueDate ? dueDate.toLocaleDateString() : '—'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Currency</div>
            <div className="text-gray-900">{currency}</div>
          </div>
        </div>
      </Card>

      {/* Line Items */}
      {actualItem.lineItems && actualItem.lineItems.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">
            Line Items ({actualItem.lineItems.length})
          </Heading>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {actualItem.lineItems.map((lineItem: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {lineItem.name || lineItem.description || 'Item'}
                      </div>
                      {lineItem.description && lineItem.name && (
                        <div className="text-xs text-gray-500">{lineItem.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {lineItem.quantity || 0}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-900">
                      {(lineItem.unitPrice || 0).toFixed(2)} {currency}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {((lineItem.quantity || 0) * (lineItem.unitPrice || 0)).toFixed(2)} {currency}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Totals */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Totals</Heading>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span className="text-gray-900 font-medium">{Number(actualItem.subtotal ?? 0).toFixed(2)} {currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Line Discounts</span>
            <span className="text-gray-900 font-medium">-{Number(actualItem.totalDiscount ?? 0).toFixed(2)} {currency}</span>
          </div>
          <div className="flex justify-between border-t border-gray-200 pt-2">
            <span className="text-gray-600">Subtotal after line discounts</span>
            <span className="text-gray-900 font-medium">{Number(actualItem.subtotalAfterDiscount ?? 0).toFixed(2)} {currency}</span>
          </div>
          {Number(actualItem.invoiceDiscount ?? 0) > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-600">Invoice Discount ({actualItem.invoiceDiscount}%)</span>
                <span className="text-gray-900 font-medium">-{Number(actualItem.invoiceDiscountAmount ?? 0).toFixed(2)} {currency}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-600">Subtotal after invoice discount</span>
                <span className="text-gray-900 font-medium">{Number(actualItem.subtotalAfterInvoiceDiscount ?? 0).toFixed(2)} {currency}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Total VAT</span>
            <span className="text-gray-900 font-medium">{Number(actualItem.totalVat ?? 0).toFixed(2)} {currency}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold border-t border-gray-200 pt-2">
            <span>Total</span>
            <span>{Number(actualItem.total ?? 0).toFixed(2)} {currency}</span>
          </div>
        </div>
      </Card>

      {/* Payment & Notes */}
      {(actualItem.paymentTerms || actualItem.notes) && (
        <>
          <hr className="border-gray-100" />
          <Card padding="sm" className="shadow-none px-0">
            <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Payment & Notes</Heading>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {actualItem.paymentTerms && (
                <div>
                  <div className="text-xs text-gray-500">Payment Terms</div>
                  <div className="text-sm text-gray-900">{actualItem.paymentTerms}</div>
                </div>
              )}
              {actualItem.notes && (
                <div className="sm:col-span-2">
                  <div className="text-xs text-gray-500">Notes</div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-sm text-gray-900 whitespace-pre-wrap">{actualItem.notes}</div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <hr className="border-gray-100" />

      {/* Quick Actions */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Quick Actions</Heading>
        <InvoiceActions invoice={actualItem} />
      </Card>

      <hr className="border-gray-100" />

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <Heading level={3} className="mb-3 text-sm font-semibold text-gray-900">Invoice Information</Heading>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-gray-500">System ID</div>
            <div className="text-sm font-mono text-gray-900">{String(actualItem.id ?? '—')}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Created</div>
            <div className="text-sm text-gray-900">
              {created ? created.toLocaleDateString() : '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Last Updated</div>
            <div className="text-sm text-gray-900">
              {updated ? updated.toLocaleDateString() : '—'}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};