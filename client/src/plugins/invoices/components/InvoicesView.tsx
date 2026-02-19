import React from 'react';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';

import { Invoice } from '../types/invoices';

import { InvoiceActions } from './InvoiceActions';

interface InvoiceViewProps {
  invoice?: Invoice;
  item?: any; // Generic fallback prop for automated system compatibility
}

export const InvoicesView: React.FC<InvoiceViewProps> = ({ invoice, item }) => {
  const actualItem = invoice || item;

  if (!actualItem) {
    return null;
  }

  const created = actualItem.createdAt ? new Date(actualItem.createdAt) : null;
  const updated = actualItem.updatedAt ? new Date(actualItem.updatedAt) : null;
  const issueDate = actualItem.issueDate ? new Date(actualItem.issueDate) : null;
  const dueDate = actualItem.dueDate ? new Date(actualItem.dueDate) : null;
  const paidAt = actualItem.paidAt ? new Date(actualItem.paidAt) : null;

  // Summary fields
  const invoiceNumber: string = actualItem.invoiceNumber ?? '';
  const status: string = actualItem.status ?? 'draft';
  const contactName: string = actualItem.contactName ?? '';
  const currency: string = actualItem.currency ?? 'SEK';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Invoice">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Number</div>
              <div className="text-foreground font-medium">{invoiceNumber || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Status</div>
              <div className="text-foreground">{status}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Customer</div>
              <div className="text-foreground">{contactName || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Issue Date</div>
              <div className="text-foreground">
                {issueDate ? issueDate.toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Due Date</div>
              <div className="text-foreground">{dueDate ? dueDate.toLocaleDateString() : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Currency</div>
              <div className="text-foreground">{currency}</div>
            </div>
          </div>
        </DetailSection>
      </Card>

      {/* Line Items */}
      {actualItem.lineItems && actualItem.lineItems.length > 0 && (
        <Card padding="sm" className="shadow-none px-0">
          <DetailSection title={`Line Items (${actualItem.lineItems.length})`}>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {actualItem.lineItems.map((lineItem: any) => (
                    <tr
                      key={lineItem.id || `${lineItem.name}-${lineItem.description}`}
                      className="hover:bg-accent transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-foreground">
                          {lineItem.name || lineItem.description || 'Item'}
                        </div>
                        {lineItem.description && lineItem.name && (
                          <div className="text-xs text-muted-foreground">
                            {lineItem.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">
                        {lineItem.quantity || 0}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-foreground">
                        {(lineItem.unitPrice || 0).toFixed(2)} {currency}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                        {((lineItem.quantity || 0) * (lineItem.unitPrice || 0)).toFixed(2)}{' '}
                        {currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailSection>
        </Card>
      )}

      {/* Totals */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Totals">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground font-medium">
                {Number(actualItem.subtotal ?? 0).toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Line Discounts</span>
              <span className="text-foreground font-medium">
                -{Number(actualItem.totalDiscount ?? 0).toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Subtotal after line discounts</span>
              <span className="text-foreground font-medium">
                {Number(actualItem.subtotalAfterDiscount ?? 0).toFixed(2)} {currency}
              </span>
            </div>
            {Number(actualItem.invoiceDiscount ?? 0) > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Invoice Discount ({actualItem.invoiceDiscount}%)
                  </span>
                  <span className="text-foreground font-medium">
                    -{Number(actualItem.invoiceDiscountAmount ?? 0).toFixed(2)} {currency}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Subtotal after invoice discount</span>
                  <span className="text-foreground font-medium">
                    {Number(actualItem.subtotalAfterInvoiceDiscount ?? 0).toFixed(2)} {currency}
                  </span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total VAT</span>
              <span className="text-foreground font-medium">
                {Number(actualItem.totalVat ?? 0).toFixed(2)} {currency}
              </span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t border-border pt-2">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">
                {Number(actualItem.total ?? 0).toFixed(2)} {currency}
              </span>
            </div>
          </div>
        </DetailSection>
      </Card>

      {/* Payment & Notes */}
      {(actualItem.paymentTerms || actualItem.notes) && (
        <>
          <hr className="border-border" />
          <Card padding="sm" className="shadow-none px-0">
            <DetailSection title="Payment & Notes">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {actualItem.paymentTerms && (
                  <div>
                    <div className="text-xs text-muted-foreground">Payment Terms</div>
                    <div className="text-sm text-foreground">{actualItem.paymentTerms}</div>
                  </div>
                )}
                {actualItem.notes && (
                  <div className="sm:col-span-2">
                    <div className="text-xs text-muted-foreground">Notes</div>
                    <div className="bg-muted border border-border rounded-lg p-4">
                      <div className="text-sm text-foreground whitespace-pre-wrap">
                        {actualItem.notes}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </DetailSection>
          </Card>
        </>
      )}

      <hr className="border-border" />

      {/* Quick Actions */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Quick Actions">
          <InvoiceActions invoice={actualItem} />
        </DetailSection>
      </Card>

      <hr className="border-border" />

      {/* Metadata */}
      <Card padding="sm" className="shadow-none px-0">
        <DetailSection title="Invoice Information">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">System ID</div>
              <div className="text-sm font-medium font-mono">{String(actualItem.id ?? '—')}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Created</div>
              <div className="text-sm font-medium">
                {created ? created.toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Last Updated</div>
              <div className="text-sm font-medium">
                {updated ? updated.toLocaleDateString() : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Paid At</div>
              <div className="text-sm font-medium">
                {paidAt ? paidAt.toLocaleDateString() : '—'}
              </div>
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  );
};
