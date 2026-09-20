import { FileSpreadsheet, History, List, SlidersHorizontal, StickyNote } from 'lucide-react';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { BADGE_CHIP_CLASS } from '@/core/ui/badgeStyles';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SectionCategoryIcon } from '@/core/ui/DetailSection';
import {
  DETAIL_HEADER_BELOW_MENUS_CLASS,
  DETAIL_HEADER_CHIP_GAP_CLASS,
} from '@/core/ui/DetailHeaderMenus';
import { PLUGIN_PAGE_TITLE_CLASS } from '@/core/ui/pluginPageStyles';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { useEstimates } from '../hooks/useEstimates';
import { Estimate, calculateEstimateTotals } from '../types/estimate';

import { EstimateDetailHeaderMenus } from './EstimateDetailHeaderMenus';
import { EstimateShareBlock } from './EstimateActions';
import { EstimateStatusSelect } from './EstimateStatusSelect';
import { StatusReasonModal } from './StatusReasonModal';

interface EstimateViewProps {
  estimate: Estimate;
  /** Single-column card stack (e.g. list detail column). */
  stacked?: boolean;
}

type EstimateViewTab = 'properties' | 'lines' | 'notes' | 'activity';

const ESTIMATE_VIEW_TABS: EstimateViewTab[] = ['properties', 'lines', 'notes', 'activity'];

function parseEstimateViewTab(value: string | null): EstimateViewTab {
  if (value && ESTIMATE_VIEW_TABS.includes(value as EstimateViewTab)) {
    return value as EstimateViewTab;
  }
  return 'properties';
}

export function EstimateView({ estimate, stacked = false }: EstimateViewProps) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseEstimateViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: EstimateViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'properties') {
            next.delete('tab');
          } else {
            next.set('tab', tab);
          }
          return next;
        },
        { replace: false },
      );
    },
    [setSearchParams],
  );
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

  const lineItemCount = estimate?.lineItems?.length ?? 0;

  const tabs = useMemo(
    () => [
      {
        id: 'properties' as const,
        label: t('estimates.tabs.properties'),
        icon: SlidersHorizontal,
        count: null as number | null,
      },
      {
        id: 'lines' as const,
        label: t('estimates.tabs.lines'),
        icon: List,
        count: lineItemCount > 0 ? lineItemCount : null,
      },
      {
        id: 'notes' as const,
        label: t('estimates.tabs.notes'),
        icon: StickyNote,
        count: null as number | null,
      },
      {
        id: 'activity' as const,
        label: t('estimates.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [lineItemCount, t],
  );

  const tabChips = (
    <div className={LIST_FILTER_CHIP_ROW_CLASS}>
      {tabs.map((tab) => {
        const TabIcon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <Button
            key={tab.id}
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={isActive}
            onClick={() => setActiveTab(tab.id)}
            className={cn(isActive ? LIST_FILTER_CHIP_ACTIVE_CLASS : LIST_FILTER_CHIP_CLASS)}
          >
            <TabIcon className="h-3.5 w-3.5" />
            <span>
              {tab.label}
              {tab.count != null ? (
                <>
                  {' '}
                  <span className="tabular-nums font-semibold">({tab.count})</span>
                </>
              ) : null}
            </span>
          </Button>
        );
      })}
    </div>
  );

  if (!estimate) {
    return null;
  }

  const totals = calculateEstimateTotals(estimate.lineItems || [], estimate.estimateDiscount || 0);

  const titleLeading = (
    <div className="flex min-w-0 items-center gap-2">
      <span title={t('nav.estimate')} className="inline-flex shrink-0">
        <SectionCategoryIcon
          icon={FileSpreadsheet}
          className="h-8 w-8 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 [&_svg]:h-4 [&_svg]:w-4"
        />
      </span>
      <h3 className={cn(PLUGIN_PAGE_TITLE_CLASS, 'min-w-0 tracking-[0.003em]')}>
        {formatDisplayNumber('estimates', estimate.estimateNumber)}
      </h3>
    </div>
  );

  const headerCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <div className="px-4 py-5">
        <EstimateDetailHeaderMenus estimate={estimate} leading={titleLeading} />
        {estimate.updatedAt ? (
          <div
            className={cn(
              DETAIL_HEADER_BELOW_MENUS_CLASS,
              'flex min-w-0 flex-wrap items-center',
              DETAIL_HEADER_CHIP_GAP_CLASS,
            )}
          >
            <p className="min-w-0 text-xs text-muted-foreground">
              {t('common.updated')}{' '}
              {new Date(estimate.updatedAt).toLocaleString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        ) : null}
        <div className="mt-4">{tabChips}</div>
      </div>
    </Card>
  );

  const propertiesContent = (
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
              <Badge
                className={cn(
                  BADGE_CHIP_CLASS,
                  'max-w-[min(100%,220px)] truncate bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
                {estimate.contactName || '—'}
              </Badge>
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('estimates.fieldCurrency')}
              </span>
              <Badge
                className={cn(
                  BADGE_CHIP_CLASS,
                  'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
                )}
              >
                {estimate.currency || '—'}
              </Badge>
            </div>
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('estimates.fieldValidTo')}
              </span>
              <Badge
                className={cn(
                  BADGE_CHIP_CLASS,
                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
                )}
              >
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
    </div>
  );

  const linesContent = (
    <div className="space-y-6">
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
                      <div className="text-sm font-medium text-foreground">{item.description}</div>
                      {item.vatRate > 0 && (
                        <div className="text-[10px] text-muted-foreground">VAT {item.vatRate}%</div>
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

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection title={t('estimates.pricingSummary')} iconPlugin="estimates" className="p-6">
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
    </div>
  );

  const notesContent = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection title={t('estimates.notes')} icon={StickyNote} subtleTitle className="p-6">
        {estimate.notes?.trim() ? (
          <div className={DETAIL_NOTE_CALLOUT_CLASS}>
            <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
              {estimate.notes}
            </p>
          </div>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('estimates.tabs.notesEmpty')}</p>
        )}
      </DetailSection>
    </Card>
  );

  const tabContent = (
    <>
      {activeTab === 'properties' ? propertiesContent : null}
      {activeTab === 'lines' ? linesContent : null}
      {activeTab === 'notes' ? notesContent : null}
      {activeTab === 'activity' ? (
        <DetailActivityLog
          entityType="estimate"
          entityId={estimate.id}
          limit={30}
          title={t('estimates.activity')}
          showClearButton
          refreshKey={String(estimate.updatedAt ?? estimate.id)}
          systemId={formatDisplayNumber('estimates', estimate.id)}
        />
      ) : null}
    </>
  );

  const body = (
    <div className="space-y-4">
      {headerCard}
      {tabContent}
    </div>
  );

  return (
    <>
      {stacked ? body : <DetailLayout gridClassName="grid-cols-1">{body}</DetailLayout>}

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
