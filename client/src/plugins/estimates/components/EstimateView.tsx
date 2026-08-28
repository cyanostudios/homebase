import { SlidersHorizontal, StickyNote } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
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
  const { t } = useTranslation();
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

  return (
    <>
      <DetailLayout>
        <div className="space-y-6">
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={t('estimates.estimateProperties')}
              icon={SlidersHorizontal}
              subtleTitle
              className="p-6"
            >
              <div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('estimates.fieldContact')}
                  </span>
                  <Badge className="max-w-[min(100%,220px)] truncate border-0 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {estimate.contactName || '—'}
                  </Badge>
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('estimates.fieldCurrency')}
                  </span>
                  <Badge className="border-0 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                    {estimate.currency || '—'}
                  </Badge>
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('estimates.fieldValidTo')}
                  </span>
                  <Badge className="border-0 rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {estimate.validTo ? new Date(estimate.validTo).toLocaleDateString() : '—'}
                  </Badge>
                </div>
                <div className={DETAIL_PROP_ROW_CLASS}>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {t('estimates.fieldStatus')}
                  </span>
                  <EstimateStatusSelect
                    estimate={displayEstimate ?? estimate}
                    onStatusChange={(status) => setQuickEditField('status', status)}
                    hideInlineLabel
                  />
                </div>
              </div>
            </DetailSection>
          </Card>

          <EstimateShareBlock estimate={estimate} />

          {/* Line Items */}
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={t('estimates.lineItemsCount', { count: estimate.lineItems.length })}
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
          <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
            <DetailSection
              title={t('estimates.pricingSummary')}
              iconPlugin="estimates"
              className="p-6"
            >
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
              </div>
            </DetailSection>
          </Card>

          {estimate.notes?.trim() ? (
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('estimates.notes')}
                icon={StickyNote}
                subtleTitle
                className="p-6"
              >
                <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                  <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                    {estimate.notes}
                  </p>
                </div>
              </DetailSection>
            </Card>
          ) : null}
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
        title={t('estimates.markAsSentTitle')}
        message={t('estimates.markAsSentMessage', {
          number: formatDisplayNumber('estimates', estimate.estimateNumber),
        })}
        confirmText={t('estimates.markAsSent')}
        cancelText={t('common.cancel')}
        onConfirm={handleEstimateQuickEditSentConfirm}
        onCancel={handleEstimateQuickEditSentCancel}
        variant="warning"
      />

      {/* Discard quick-edit changes when closing */}
      <ConfirmDialog
        isOpen={showDiscardQuickEditDialog}
        title={t('dialog.unsavedChanges')}
        message={t('estimates.discardQuickEditMessage')}
        confirmText={t('dialog.discardChanges')}
        cancelText={t('dialog.continueEditing')}
        onConfirm={onDiscardQuickEditAndClose}
        onCancel={() => setShowDiscardQuickEditDialog(false)}
        variant="warning"
      />
    </>
  );
}
