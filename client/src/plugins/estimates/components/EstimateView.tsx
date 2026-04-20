import { Copy, Download, Edit, Info, SlidersHorizontal, Trash2, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { cn } from '@/lib/utils';

import { useEstimates } from '../hooks/useEstimates';
import { Estimate, calculateEstimateTotals } from '../types/estimate';

import { EstimateShareBlock } from './EstimateActions';
import { EstimateStatusSelect } from './EstimateStatusSelect';
import { StatusReasonModal } from './StatusReasonModal';

const ESTIMATE_DETAIL_CARD_CLASS = 'overflow-hidden border border-border/70 bg-card shadow-sm';

interface EstimateQuickActionsCardProps {
  estimate: Estimate;
  onEdit: (estimate: Estimate) => void;
  onDeleteClick: () => void;
  onDuplicate: () => void;
  getDuplicateConfig: (
    item: Estimate | null,
  ) => { defaultName: string; nameLabel: string; confirmOnly?: boolean } | null;
}

interface EstimateExportOptionsCardProps {
  estimate: Estimate;
  actions: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: (item: Estimate) => void;
    className?: string;
    disabled?: boolean;
  }>;
}

function getEstimateQuickActionIconTint(actionId: string): string {
  if (actionId === 'download-pdf') {
    return 'text-amber-600 dark:text-amber-400';
  }
  if (actionId === 'view-share') {
    return 'text-blue-600 dark:text-blue-400';
  }
  if (actionId === 'share') {
    return 'text-violet-600 dark:text-violet-400';
  }
  return '';
}

function EstimateQuickActionsCard({
  estimate,
  onEdit,
  onDeleteClick,
  onDuplicate,
  getDuplicateConfig,
}: EstimateQuickActionsCardProps) {
  const { t } = useTranslation();
  const canDuplicate = Boolean(getDuplicateConfig(estimate));
  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

  return (
    <Card padding="none" className={ESTIMATE_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('estimates.quickActions')}
        icon={Zap}
        iconPlugin="estimates"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Edit
                {...props}
                className={cn(props.className, 'text-blue-600 dark:text-blue-400')}
              />
            )}
            className={quickActionButtonClass}
            onClick={() => onEdit(estimate)}
          >
            {t('common.edit')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            icon={(props) => (
              <Trash2
                {...props}
                className={cn(props.className, 'text-red-600 dark:text-red-400')}
              />
            )}
            className="h-9 justify-start rounded-md px-3 text-xs hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
          {canDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              icon={(props) => (
                <Copy
                  {...props}
                  className={cn(props.className, 'text-green-600 dark:text-green-400')}
                />
              )}
              className={quickActionButtonClass}
              onClick={onDuplicate}
            >
              {t('common.duplicate')}
            </Button>
          )}
        </div>
      </DetailSection>
    </Card>
  );
}

function EstimateExportOptionsCard({ estimate, actions }: EstimateExportOptionsCardProps) {
  const { t } = useTranslation();
  if (!Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  const quickActionButtonClass = 'h-9 justify-start rounded-md px-3 text-xs hover:bg-muted';

  return (
    <Card padding="none" className={ESTIMATE_DETAIL_CARD_CLASS}>
      <DetailSection
        title={t('estimates.exportOptions')}
        icon={Download}
        iconPlugin="estimates"
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            const iconTint = getEstimateQuickActionIconTint(action.id);
            return (
              <Button
                key={action.id}
                type="button"
                variant="ghost"
                size="sm"
                icon={(props) => <Icon {...props} className={cn(props.className, iconTint)} />}
                disabled={action.disabled}
                className={cn(quickActionButtonClass, 'disabled:opacity-50', action.className)}
                onClick={() => action.onClick(estimate)}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      </DetailSection>
    </Card>
  );
}

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
    openEstimateForEdit,
    deleteEstimate,
    closeEstimatePanel,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedEstimateId,
    getDeleteMessage,
    detailFooterActions,
  } = useEstimates();

  const [showDeleteEstimateConfirm, setShowDeleteEstimateConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

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

  const handleConfirmDelete = async () => {
    await deleteEstimate(estimate.id);
    setShowDeleteEstimateConfirm(false);
    closeEstimatePanel();
  };

  return (
    <>
      <DetailLayout
        sidebar={
          <div className="space-y-6">
            <EstimateQuickActionsCard
              estimate={estimate}
              onEdit={openEstimateForEdit}
              onDeleteClick={() => setShowDeleteEstimateConfirm(true)}
              onDuplicate={() => setShowDuplicateDialog(true)}
              getDuplicateConfig={getDuplicateConfig}
            />
            <EstimateExportOptionsCard estimate={estimate} actions={detailFooterActions} />
            <Card padding="none" className={ESTIMATE_DETAIL_CARD_CLASS}>
              <DetailSection title={t('estimates.information')} icon={Info} className="p-4">
                <div className="space-y-4 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">ID</span>
                    <span className="font-mono font-medium">
                      {formatDisplayNumber('estimates', estimate.id)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Created</span>
                    <span className="font-medium">
                      {new Date(estimate.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Updated</span>
                    <span className="font-medium">
                      {new Date(estimate.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </DetailSection>
            </Card>
            <DetailActivityLog
              entityType="estimate"
              entityId={estimate.id}
              limit={30}
              title={t('estimates.activity')}
              showClearButton
              refreshKey={String(estimate.updatedAt ?? estimate.id)}
            />
          </div>
        }
      >
        <div className="space-y-6">
          <Card padding="none" className={ESTIMATE_DETAIL_CARD_CLASS}>
            <div className="space-y-2 p-6">
              <div className="mb-1 flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/80 text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </span>
                <span className="truncate text-sm font-semibold text-foreground">
                  {t('estimates.estimateProperties')}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">{t('estimates.fieldContact')}</div>
                    <div className="flex h-9 min-w-0 max-w-[180px] items-center justify-end rounded-md border border-border bg-background px-3 text-xs font-medium leading-none">
                      <span className="truncate text-right">{estimate.contactName || '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">{t('estimates.fieldCurrency')}</div>
                    <div className="h-9 max-w-[180px] rounded-md border border-border bg-background px-3 text-xs leading-9">
                      {estimate.currency || '—'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-sm font-medium">{t('estimates.fieldValidTo')}</div>
                    <div className="h-9 max-w-[180px] rounded-md border border-border bg-background px-3 text-xs leading-9">
                      {estimate.validTo ? new Date(estimate.validTo).toLocaleDateString() : '—'}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-border p-4">
                  <EstimateStatusSelect
                    estimate={displayEstimate ?? estimate}
                    onStatusChange={(status) => setQuickEditField('status', status)}
                  />
                </div>
              </div>
            </div>
          </Card>

          <EstimateShareBlock estimate={estimate} />

          {/* Line Items */}
          <Card padding="none" className={ESTIMATE_DETAIL_CARD_CLASS}>
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
          <Card padding="none" className={ESTIMATE_DETAIL_CARD_CLASS}>
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

          {estimate.notes && (
            <Card padding="none" className={ESTIMATE_DETAIL_CARD_CLASS}>
              <DetailSection title={t('estimates.notes')} iconPlugin="estimates" className="p-6">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {estimate.notes}
                </p>
              </DetailSection>
            </Card>
          )}
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

      <ConfirmDialog
        isOpen={showDeleteEstimateConfirm}
        title={t('estimates.deleteTitle')}
        message={getDeleteMessage(estimate)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteEstimateConfirm(false)}
        variant="danger"
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(estimate, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedEstimateId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => {
              setShowDuplicateDialog(false);
            });
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(estimate)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(estimate)?.nameLabel ?? t('nav.estimate')}
        confirmOnly={Boolean(getDuplicateConfig(estimate)?.confirmOnly)}
      />
    </>
  );
}
