import React from 'react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DetailSection } from '@/core/ui/DetailSection';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useEstimateStatusActions } from '../hooks/useEstimateStatusActions';
import { Estimate, calculateEstimateTotals } from '../types/estimate';

import { EstimateActions } from './EstimateActions';
import { EstimateStatusButtons } from './EstimateStatusButtons';
import { StatusReasonModal } from './StatusReasonModal';

interface EstimateViewProps {
  estimate: Estimate;
}

export function EstimateView({ estimate }: EstimateViewProps) {
  const {
    showStatusModal,
    showSentConfirmation,
    pendingStatus,
    handleStatusChange,
    handleSentConfirm,
    handleSentCancel,
    handleModalConfirm,
    handleModalCancel,
  } = useEstimateStatusActions();

  if (!estimate) {
    return null;
  }

  const totals = calculateEstimateTotals(estimate.lineItems || [], estimate.estimateDiscount || 0);
  const estimateNumberDisplay = formatDisplayNumber('estimates', estimate.estimateNumber);

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50 plugin-estimates">
              <DetailSection title="Information" className="p-4">
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Number</span>
                    <span className="font-mono font-medium">{estimateNumberDisplay || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status</span>
                    <span className="capitalize font-medium text-plugin">{estimate.status?.toLowerCase().replace(/^./, (str) => str.toUpperCase())}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contact</span>
                    <span className="font-medium truncate max-w-[150px]">{estimate.contactName || '—'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Valid To</span>
                    <span className="font-medium">
                      {estimate.validTo ? new Date(estimate.validTo).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Currency</span>
                    <span className="font-medium">{estimate.currency}</span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-border/50">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium font-mono text-[10px] opacity-70">{new Date(estimate.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="font-medium font-mono text-[10px] opacity-70">{new Date(estimate.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </DetailSection>
            </Card>

            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Quick Actions" className="p-4">
                <div className="space-y-4">
                  <EstimateStatusButtons
                    estimate={estimate}
                    onStatusChange={(status) => handleStatusChange(estimate, status)}
                  />
                  <EstimateActions estimate={estimate} />
                </div>
              </DetailSection>
            </Card>


          </div>
        }
      >
        <div className="space-y-6">
          {/* Internal Notes */}
          {estimate.notes && (
            <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
              <DetailSection title="Notes" className="p-6">
                <div className="text-sm text-muted-foreground italic leading-relaxed">
                  "{estimate.notes}"
                </div>
              </DetailSection>
            </Card>
          )}

          {/* Line Items */}
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title={`Line Items (${estimate.lineItems.length})`} className="p-6">
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
                    {estimate.lineItems.map((item) => (
                      <tr key={item.id} className="group hover:bg-muted/30">
                        <td className="py-4">
                          <div className="text-sm font-medium text-foreground">{item.description}</div>
                          {item.vatRate > 0 && (
                            <div className="text-[10px] text-muted-foreground">VAT {item.vatRate}%</div>
                          )}
                        </td>
                        <td className="py-4 text-right text-sm text-foreground">{item.quantity}</td>
                        <td className="py-4 text-right text-sm text-foreground">{(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="py-4 text-right text-sm font-medium text-foreground">{(item.lineTotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailSection>
          </Card>

          {/* Pricing Summary */}
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Pricing Summary" className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{totals.subtotal.toFixed(2)} {estimate.currency}</span>
                </div>
                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Line Discounts</span>
                    <span className="font-medium text-red-600">-{totals.totalDiscount.toFixed(2)} {estimate.currency}</span>
                  </div>
                )}
                {totals.estimateDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Estimate Discount ({(estimate.estimateDiscount || 0).toFixed(1)}%)</span>
                    <span className="font-medium text-red-600">-{totals.estimateDiscountAmount.toFixed(2)} {estimate.currency}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total VAT</span>
                  <span className="font-medium">{totals.totalVat.toFixed(2)} {estimate.currency}</span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-4 border-t border-border">
                  <span>Total Amount</span>
                  <span>{totals.total.toFixed(2)} {estimate.currency}</span>
                </div>
              </div>
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>

      {/* Status Reason Modal */}
      <StatusReasonModal
        isOpen={showStatusModal}
        onClose={handleModalCancel}
        onConfirm={(reasons) => handleModalConfirm(estimate, reasons)}
        status={pendingStatus || 'accepted'}
        estimateNumber={formatDisplayNumber('estimates', estimate.estimateNumber)}
      />

      {/* Sent Confirmation Dialog */}
      {showSentConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Mark estimate as sent?
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Estimate {formatDisplayNumber('estimates', estimate.estimateNumber)}
                </p>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This will change the status to "Sent" and indicate that the estimate has been
                delivered to the customer.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                You can change it back to "Draft" at any time if needed.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end space-x-3 p-4 border-t border-gray-100 dark:border-gray-700">
              <Button variant="secondary" size="sm" onClick={handleSentCancel}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleSentConfirm(estimate)}
                className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800"
              >
                Mark as Sent
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
