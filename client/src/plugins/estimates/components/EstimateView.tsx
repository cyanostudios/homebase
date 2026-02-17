import { Info } from 'lucide-react';
import React from 'react';

import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { useEstimates } from '../hooks/useEstimates';
import { Estimate, calculateEstimateTotals } from '../types/estimate';

import { EstimateShareBlock } from './EstimateActions';
import { EstimateStatusSelect } from './EstimateStatusSelect';
import { StatusReasonModal } from './StatusReasonModal';

interface EstimateViewProps {
  estimate: Estimate;
}

export function EstimateView({ estimate }: EstimateViewProps) {
  const {
    quickEditDraft,
    setQuickEditField,
    estimateQuickEditShowStatusModal,
    estimateQuickEditShowSentConfirmation,
    estimateQuickEditPendingStatus,
    handleEstimateQuickEditSentConfirm,
    handleEstimateQuickEditSentCancel,
    handleEstimateQuickEditModalConfirm,
    handleEstimateQuickEditModalCancel,
    showDiscardQuickEditDialog,
    setShowDiscardQuickEditDialog,
    onDiscardQuickEditAndClose,
  } = useEstimates();

  const displayEstimate = React.useMemo(
    () =>
      estimate
        ? { ...estimate, status: (quickEditDraft?.status ?? estimate.status) as Estimate['status'] }
        : null,
    [estimate, quickEditDraft?.status],
  );

  if (!estimate) {
    return null;
  }

  const totals = calculateEstimateTotals(estimate.lineItems || [], estimate.estimateDiscount || 0);
  const estimateNumberDisplay = formatDisplayNumber('estimates', estimate.estimateNumber);

  return (
    <div className="plugin-estimates">
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <Card
              padding="none"
              className="overflow-hidden border-none shadow-sm bg-background/50 plugin-estimates"
            >
              <DetailSection title="Information" icon={Info} iconPlugin="estimates" className="p-4">
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Number</span>
                    <span className="font-mono font-medium">{estimateNumberDisplay || '—'}</span>
                  </div>
                  <EstimateStatusSelect
                    estimate={displayEstimate ?? estimate}
                    onStatusChange={(status) => setQuickEditField('status', status)}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Contact</span>
                    <span className="font-medium truncate max-w-[150px]">
                      {estimate.contactName || '—'}
                    </span>
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
                      <span className="font-medium font-mono text-[10px] opacity-70">
                        {new Date(estimate.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Updated</span>
                      <span className="font-medium font-mono text-[10px] opacity-70">
                        {new Date(estimate.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
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
              <DetailSection title="Notes" iconPlugin="estimates" className="p-6">
                <div className="text-sm text-muted-foreground italic leading-relaxed">
                  "{estimate.notes}"
                </div>
              </DetailSection>
            </Card>
          )}

          {/* Line Items */}
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection
              title={`Line Items (${estimate.lineItems.length})`}
              iconPlugin="estimates"
              className="p-6"
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="pb-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Description
                      </th>
                      <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Qty
                      </th>
                      <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Price
                      </th>
                      <th className="pb-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {estimate.lineItems.map((item) => (
                      <tr key={item.id} className="group hover:bg-muted/30">
                        <td className="py-4">
                          <div className="text-sm font-medium text-foreground">
                            {item.description}
                          </div>
                          {item.vatRate > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              VAT {item.vatRate}%
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-right text-sm text-foreground">{item.quantity}</td>
                        <td className="py-4 text-right text-sm text-foreground">
                          {(item.unitPrice || 0).toFixed(2)}
                        </td>
                        <td className="py-4 text-right text-sm font-medium text-foreground">
                          {(item.lineTotal || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailSection>
          </Card>

          {/* Pricing Summary */}
          <Card padding="none" className="overflow-hidden border-none shadow-sm bg-background/50">
            <DetailSection title="Pricing Summary" iconPlugin="estimates" className="p-6">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    {totals.subtotal.toFixed(2)} {estimate.currency}
                  </span>
                </div>
                {totals.totalDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Line Discounts</span>
                    <span className="font-medium text-red-600">
                      -{totals.totalDiscount.toFixed(2)} {estimate.currency}
                    </span>
                  </div>
                )}
                {totals.estimateDiscountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      Estimate Discount ({(estimate.estimateDiscount || 0).toFixed(1)}%)
                    </span>
                    <span className="font-medium text-red-600">
                      -{totals.estimateDiscountAmount.toFixed(2)} {estimate.currency}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total VAT</span>
                  <span className="font-medium">
                    {totals.totalVat.toFixed(2)} {estimate.currency}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-semibold pt-4 border-t border-border">
                  <span>Total Amount</span>
                  <span>
                    {totals.total.toFixed(2)} {estimate.currency}
                  </span>
                </div>
                <div className="pt-4 mt-4 border-t border-border/50">
                  <EstimateShareBlock estimate={estimate} />
                </div>
              </div>
            </DetailSection>
          </Card>
        </div>
      </DetailLayout>

      {/* Status Reason Modal (when applying quick-edit to accepted/rejected) */}
      <StatusReasonModal
        isOpen={estimateQuickEditShowStatusModal}
        onClose={handleEstimateQuickEditModalCancel}
        onConfirm={handleEstimateQuickEditModalConfirm}
        status={estimateQuickEditPendingStatus || 'accepted'}
        estimateNumber={formatDisplayNumber('estimates', estimate.estimateNumber)}
      />

      {/* Sent Confirmation (when applying quick-edit to sent) */}
      <ConfirmDialog
        isOpen={estimateQuickEditShowSentConfirmation}
        title="Mark estimate as sent?"
        message={`Estimate ${formatDisplayNumber('estimates', estimate.estimateNumber)}. This will change the status to "Sent" and indicate that the estimate has been delivered to the customer. You can change it back to "Draft" at any time if needed.`}
        confirmText="Mark as Sent"
        cancelText="Cancel"
        onConfirm={handleEstimateQuickEditSentConfirm}
        onCancel={handleEstimateQuickEditSentCancel}
        variant="warning"
      />

      {/* Discard quick-edit changes when closing */}
      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title="Unsaved changes"
        message="You have unsaved status change. Do you want to discard it?"
        confirmText="Discard"
        cancelText="Continue editing"
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </div>
  );
}
