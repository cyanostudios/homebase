import React from 'react';

import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

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
  const invoiceNumberDisplay = formatDisplayNumber(
    'invoices',
    actualItem.invoiceNumber || actualItem.id,
  );
  const status: string = actualItem.status ?? 'draft';
  const contactName: string = actualItem.contactName ?? '';
  const currency: string = actualItem.currency ?? 'SEK';

  return (
    <DetailLayout
      sidebar={
        <div className="space-y-6">
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50 plugin-invoices">
            <DetailSection title="Information" className="p-4">
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Number</span>
                  <span className="font-mono font-medium">{invoiceNumberDisplay || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <span className="capitalize font-medium text-plugin">{status.toLowerCase().replace(/^./, (str) => str.toUpperCase())}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium truncate max-w-[150px]">{contactName || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Issue Date</span>
                  <span className="font-medium">{issueDate ? issueDate.toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">{dueDate ? dueDate.toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Currency</span>
                  <span className="font-medium">{currency}</span>
                </div>
                <div className="pt-2 mt-2 border-t border-border/50">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium font-mono text-[10px] opacity-70">{created ? created.toLocaleDateString() : '—'}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium font-mono text-[10px] opacity-70">{updated ? updated.toLocaleDateString() : '—'}</span>
                  </div>
                </div>
              </div>
            </DetailSection>
          </Card>

          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Quick Actions" className="p-4">
              <InvoiceActions invoice={actualItem} />
            </DetailSection>
          </Card>


        </div>
      }
    >
      <div className="space-y-6">
        {/* Internal Notes & Terms */}
        {(actualItem.notes || actualItem.paymentTerms) && (
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Notes & Terms" className="p-6">
              {actualItem.notes && (
                <div className="text-sm text-muted-foreground italic leading-relaxed mb-4">
                  "{actualItem.notes}"
                </div>
              )}
              {actualItem.paymentTerms && (
                <div className={cn("pt-4 border-t border-border/50", !actualItem.notes && "border-t-0 pt-0")}>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-1">Payment Terms</div>
                  <div className="text-xs text-muted-foreground">{actualItem.paymentTerms}</div>
                </div>
              )}
            </DetailSection>
          </Card>
        )}

        {/* Line Items */}
        {actualItem.lineItems && actualItem.lineItems.length > 0 && (
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title={`Line Items (${actualItem.lineItems.length})`} className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Description</th>
                      <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Qty</th>
                      <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Price</th>
                      <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {actualItem.lineItems.map((lineItem: any) => (
                      <tr key={lineItem.id || `${lineItem.name}-${lineItem.description}`} className="group hover:bg-muted/30">
                        <td className="py-4">
                          <div className="text-sm font-medium text-foreground">{lineItem.name || lineItem.description || 'Item'}</div>
                          {lineItem.description && lineItem.name && (
                            <div className="text-[10px] text-muted-foreground">{lineItem.description}</div>
                          )}
                        </td>
                        <td className="py-4 text-right text-sm text-foreground">{lineItem.quantity || 0}</td>
                        <td className="py-4 text-right text-sm text-foreground">{(lineItem.unitPrice || 0).toFixed(2)}</td>
                        <td className="py-4 text-right text-sm font-medium text-foreground">
                          {((lineItem.quantity || 0) * (lineItem.unitPrice || 0)).toFixed(2)} {currency}
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
        <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
          <DetailSection title="Pricing Summary" className="p-6">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{Number(actualItem.subtotal ?? 0).toFixed(2)} {currency}</span>
              </div>
              {Number(actualItem.totalDiscount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Line Discounts</span>
                  <span className="font-medium text-red-600">-{Number(actualItem.totalDiscount ?? 0).toFixed(2)} {currency}</span>
                </div>
              )}
              {Number(actualItem.invoiceDiscount ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice Discount ({actualItem.invoiceDiscount}%)</span>
                  <span className="font-medium text-red-600">-{Number(actualItem.invoiceDiscountAmount ?? 0).toFixed(2)} {currency}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total VAT</span>
                <span className="font-medium">{Number(actualItem.totalVat ?? 0).toFixed(2)} {currency}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold pt-4 border-t border-border">
                <span>Total Amount</span>
                <span>{Number(actualItem.total ?? 0).toFixed(2)} {currency}</span>
              </div>
            </div>
          </DetailSection>
        </Card>
      </div>
    </DetailLayout>
  );
};
