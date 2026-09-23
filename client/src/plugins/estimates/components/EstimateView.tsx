import {
  Calculator,
  Calendar,
  Eye,
  FileText,
  Hash,
  History,
  Info,
  Link2,
  ListOrdered,
  Package,
  Receipt,
  SlidersHorizontal,
  StickyNote,
  Truck,
  Users,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { EMPTY_ORGANIZATION, organizationApi } from '@/core/api/organizationApi';
import { LINKED_SECTION_BADGE_CLASS } from '@/core/ui/badgeStyles';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SubtleSectionHeading } from '@/core/ui/DetailSection';
import {
  DETAIL_EMPTY_STATE_CLASS,
  DETAIL_FIELD_VALUE_CLASS,
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
  LIST_FILTER_CHIP_ACTIVE_CLASS,
  LIST_FILTER_CHIP_CLASS,
  LIST_FILTER_CHIP_ROW_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { buildSlug } from '@/core/utils/slugUtils';
import { useEnabledPlugins } from '@/hooks/useEnabledPlugins';
import { cn } from '@/lib/utils';
import { AssignmentQuickInfoDialog } from '@/plugins/contacts/components/AssignmentQuickInfoDialog';
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';
import {
  formatInvoiceStatusForDisplay,
  INVOICE_STATUS_COLORS,
} from '@/plugins/invoices/components/InvoiceStatusSelect';
import type { Invoice } from '@/plugins/invoices/types/invoices';
import { displayPlainText } from '@/plugins/invoices/utils/htmlText';
import {
  formatInvoiceAmount,
  formatInvoiceMoney,
} from '@/plugins/invoices/utils/formatInvoiceAmount';
import {
  buildInvoiceCustomerBlock,
  displayNameFromEmail,
  fetchLogoAsDataUrl,
} from '@/plugins/invoices/utils/invoiceDocumentIdentity';
import {
  LINE_ITEM_LIST_ROW_CLASS,
  LINE_ITEM_MUTED_VALUE_CLASS,
  LINE_ITEM_PRIMARY_TEXT_CLASS,
  LINE_ITEM_VALUE_CLASS,
} from '@/plugins/invoices/utils/invoiceLineItemStyles';
import { resolveInvoiceTotals } from '@/plugins/invoices/utils/invoiceTotals';

import { useEstimateLinkedInvoice } from '../hooks/useEstimateLinkedInvoice';
import { useEstimates } from '../hooks/useEstimates';
import {
  ACCEPTANCE_REASONS,
  REJECTION_REASONS,
  calculateEstimateTotals,
  type Estimate,
} from '../types/estimate';
import { resolveEstimateTotals } from '../utils/estimateTotals';
import {
  openEstimatePreviewWindow,
  writeEstimatePreviewWindow,
} from '../utils/openEstimatePreviewWindow';
import { generateWebHTML } from '../webTemplate';

import { EstimateDocumentPreview } from './EstimateDocumentPreview';
import { EstimatePricingSummary } from './EstimatePricingSummary';
import { EstimateQuickContextPanel } from './EstimateQuickContextPanel';
import { EstimateShareBlock } from './EstimateActions';
import { EstimateStatusSelect } from './EstimateStatusSelect';
import { StatusReasonModal } from './StatusReasonModal';

interface EstimateViewProps {
  estimate: Estimate;
  stacked?: boolean;
}

type EstimateViewTab = 'information' | 'lines' | 'linked' | 'activity';

const ESTIMATE_VIEW_TABS: EstimateViewTab[] = ['information', 'lines', 'linked', 'activity'];

function parseEstimateViewTab(value: string | null): EstimateViewTab {
  if (value && ESTIMATE_VIEW_TABS.includes(value as EstimateViewTab)) {
    return value as EstimateViewTab;
  }
  return 'information';
}

const FACT_LABEL_CLASS =
  'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';

export function EstimateView({ estimate, stacked = false }: EstimateViewProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseEstimateViewTab(searchParams.get('tab'));
  const enabledPlugins = useEnabledPlugins();
  const { contacts, user } = useApp();
  const linkedInvoice = useEstimateLinkedInvoice(estimate.id, estimate.status);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  const setActiveTab = useCallback(
    (tab: EstimateViewTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'information') {
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
    requestStatusChange,
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

  const displayEstimate = useMemo(
    () =>
      estimate
        ? { ...estimate, status: (quickEditDraft?.status ?? estimate.status) as Estimate['status'] }
        : null,
    [estimate, quickEditDraft?.status],
  );

  const isInvoiced = estimate.status === 'invoiced';
  const lineItems = estimate.lineItems ?? [];
  const currency = estimate.currency ?? 'SEK';

  const openSharedStylePreview = useCallback(() => {
    const win = openEstimatePreviewWindow();
    if (!win) {
      alert(
        t('estimates.previewPopupBlocked', {
          defaultValue: 'Could not open preview. Allow pop-ups for this site and try again.',
        }),
      );
      return;
    }

    void (async () => {
      try {
        let organization = EMPTY_ORGANIZATION;
        try {
          const org = await organizationApi.getOrganization();
          const logoUrl = org.logoUrl ? await fetchLogoAsDataUrl(org.logoUrl) : '';
          organization = { ...org, logoUrl: logoUrl || org.logoUrl || '' };
        } catch {
          organization = EMPTY_ORGANIZATION;
        }

        const totals = calculateEstimateTotals(lineItems, estimate.estimateDiscount || 0);
        const numberLabel = formatDisplayNumber(
          'estimates',
          String(estimate.estimateNumber || estimate.id),
        );
        const contact =
          estimate.contactId && contacts
            ? contacts.find((c) => String(c.id) === String(estimate.contactId))
            : null;
        const customer = buildInvoiceCustomerBlock({
          contactName: estimate.contactName,
          organizationNumber: estimate.organizationNumber,
          contactId: estimate.contactId,
          contact: contact || null,
        });

        const html = generateWebHTML({
          id: estimate.id,
          estimateNumber: numberLabel,
          contactName: estimate.contactName,
          organizationNumber: estimate.organizationNumber,
          currency,
          lineItems,
          estimateDiscount: estimate.estimateDiscount || 0,
          notes: estimate.notes,
          orderNumber: estimate.orderNumber,
          deliveryMethod: estimate.deliveryMethod,
          validTo: estimate.validTo,
          status: estimate.status,
          createdAt: estimate.createdAt,
          ...totals,
          organization,
          referencePerson: displayNameFromEmail(user?.email),
          customer,
        });

        writeEstimatePreviewWindow(win, html, `Offert ${numberLabel}`, {
          pageBreakLabel: t('estimates.previewPageBreak', { defaultValue: 'Page break' }),
        });
      } catch (error) {
        console.error('Failed to open estimate preview', error);
        try {
          win.close();
        } catch {
          /* ignore */
        }
        alert(
          t('estimates.previewOpenFailed', {
            defaultValue: 'Could not open estimate preview. Try again.',
          }),
        );
      }
    })();
  }, [contacts, currency, estimate, lineItems, t, user?.email]);
  const totals = resolveEstimateTotals(estimate);
  const hasNotes = Boolean(displayPlainText(estimate.notes).trim());
  const contactRecord =
    estimate.contactId && contacts
      ? contacts.find((c) => String(c.id) === String(estimate.contactId))
      : null;

  const tabs = useMemo(
    () => [
      {
        id: 'information' as const,
        label: t('estimates.tabs.information', { defaultValue: 'Information' }),
        icon: Info,
        count: null as number | null,
      },
      {
        id: 'lines' as const,
        label: t('estimates.tabs.lines'),
        icon: ListOrdered,
        count: lineItems.length > 0 ? lineItems.length : null,
      },
      {
        id: 'linked' as const,
        label: t('estimates.tabs.linked', { defaultValue: 'Linked' }),
        icon: Link2,
        count: linkedInvoice ? 1 : null,
      },
      {
        id: 'activity' as const,
        label: t('estimates.tabs.activity'),
        icon: History,
        count: null as number | null,
      },
    ],
    [lineItems.length, linkedInvoice, t],
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

  const numberLabel = formatDisplayNumber('estimates', estimate.estimateNumber || estimate.id);
  const factValueClass = 'text-base font-medium text-foreground';

  const reasonLabels = (ids: string[] | undefined, pool: typeof ACCEPTANCE_REASONS) => {
    if (!ids?.length) {
      return [];
    }
    return ids.map((id) => pool.find((r) => r.id === id)?.label || id).filter(Boolean);
  };

  const informationCard = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('estimates.information')}
          icon={Info}
          iconPlugin="estimates"
          subtleTitle
          className="p-6"
        >
          <div className="grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-4">
            <div>
              <div className={FACT_LABEL_CLASS}>
                <Hash className="h-3 w-3" />
                {t('estimates.table.number')}
              </div>
              <div className={factValueClass}>{numberLabel || '—'}</div>
            </div>
            <div>
              <div className={FACT_LABEL_CLASS}>
                <Calendar className="h-3 w-3" />
                {t('estimates.fieldValidTo')}
              </div>
              <div className={factValueClass}>{formatDate(estimate.validTo) || '—'}</div>
            </div>
            <div>
              <div className={FACT_LABEL_CLASS}>
                <Receipt className="h-3 w-3" />
                {t('estimates.table.total')}
              </div>
              <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'tabular-nums')}>
                {formatInvoiceAmount(totals.total)} {currency}
              </div>
            </div>
            <div>
              <div className={FACT_LABEL_CLASS}>{t('estimates.fieldCurrency')}</div>
              <div className={factValueClass}>{currency}</div>
            </div>
            <div>
              <div className={FACT_LABEL_CLASS}>
                <Package className="h-3 w-3" />
                {t('invoices.orderNumber', { defaultValue: 'Order number' })}
              </div>
              <div className={factValueClass}>{estimate.orderNumber?.trim() || '—'}</div>
            </div>
            <div>
              <div className={FACT_LABEL_CLASS}>
                <Truck className="h-3 w-3" />
                {t('invoices.deliveryMethod', { defaultValue: 'Delivery method' })}
              </div>
              <div className={factValueClass}>{estimate.deliveryMethod?.trim() || '—'}</div>
            </div>
          </div>
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('estimates.estimateProperties')}
          icon={SlidersHorizontal}
          iconPlugin="estimates"
          subtleTitle
          className="p-6"
        >
          <div className="space-y-4">
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('estimates.fieldStatus')}
              </span>
              <EstimateStatusSelect
                estimate={displayEstimate ?? estimate}
                onStatusChange={(status) => requestStatusChange(status, estimate)}
                hideInlineLabel
                disabled={isInvoiced}
              />
            </div>
            {estimate.acceptanceReasons?.length ? (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t('estimates.acceptanceReasons', { defaultValue: 'Acceptance reasons' })}:{' '}
                </span>
                {reasonLabels(estimate.acceptanceReasons, ACCEPTANCE_REASONS).join(', ')}
              </div>
            ) : null}
            {estimate.rejectionReasons?.length ? (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t('estimates.rejectionReasons', { defaultValue: 'Rejection reasons' })}:{' '}
                </span>
                {reasonLabels(estimate.rejectionReasons, REJECTION_REASONS).join(', ')}
              </div>
            ) : null}
            {hasNotes ? (
              <div className="space-y-2">
                <SubtleSectionHeading title={t('estimates.notes')} icon={StickyNote} />
                <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                  <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                    {displayPlainText(estimate.notes)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DetailSection>
      </Card>

      <EstimateShareBlock estimate={estimate} />

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('estimates.previewTitle', { defaultValue: 'Estimate preview' })}
          icon={Eye}
          subtleTitle
          className="p-6"
        >
          <p className="mb-3 text-xs text-muted-foreground">
            {t('estimates.previewHelp', {
              defaultValue: 'This is how the estimate will look when shared or exported as PDF.',
            })}
          </p>
          <div className="mx-auto w-full max-w-[794px]">
            <EstimateDocumentPreview
              formData={{
                contactId: estimate.contactId || '',
                contactName: estimate.contactName || '',
                organizationNumber: estimate.organizationNumber || '',
                currency,
                lineItems,
                estimateDiscount: estimate.estimateDiscount || 0,
                notes: estimate.notes || '',
                orderNumber: estimate.orderNumber || '',
                deliveryMethod: estimate.deliveryMethod || '',
                validTo: estimate.validTo,
                status: estimate.status,
              }}
              estimateId={estimate.id}
              estimateNumber={estimate.estimateNumber}
            />
            <div className="mt-4 flex justify-end gap-2">
              <RoundIconLabelButton
                type="button"
                icon={Eye}
                label={t('common.preview')}
                variant="secondary"
                size="xs"
                alwaysExpanded
                onClick={openSharedStylePreview}
              />
            </div>
          </div>
        </DetailSection>
      </Card>
    </div>
  );

  const linesCard = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('estimates.lineItemsCount', { count: lineItems.length })}
          icon={ListOrdered}
          iconPlugin="estimates"
          subtleTitle
          className="p-6"
          collapsible
          defaultOpen
        >
          {lineItems.length > 0 ? (
            <div className="space-y-1">
              {lineItems.map((lineItem) => {
                if (lineItem.kind === 'text') {
                  return (
                    <div
                      key={lineItem.id || `text-${lineItem.description}`}
                      className={LINE_ITEM_LIST_ROW_CLASS}
                    >
                      <div
                        className={cn(LINE_ITEM_PRIMARY_TEXT_CLASS, 'min-w-0 flex-1 font-normal')}
                      >
                        {lineItem.description || '—'}
                      </div>
                    </div>
                  );
                }
                const title = lineItem.name || lineItem.description || 'Item';
                const lineSubtotal =
                  lineItem.lineSubtotal ?? (lineItem.quantity || 0) * (lineItem.unitPrice || 0);
                const lineDiscount =
                  lineItem.discountAmount ?? lineSubtotal * ((lineItem.discount || 0) / 100);
                const lineNet = lineSubtotal - lineDiscount;
                return (
                  <div
                    key={lineItem.id || `${lineItem.name}-${lineItem.description}`}
                    className={LINE_ITEM_LIST_ROW_CLASS}
                  >
                    <div className="min-w-0 flex-1">
                      <div className={LINE_ITEM_PRIMARY_TEXT_CLASS}>{title}</div>
                    </div>
                    <span className={cn(LINE_ITEM_MUTED_VALUE_CLASS, 'shrink-0')}>
                      {lineItem.quantity || 0}
                      {lineItem.unit ? ` ${lineItem.unit}` : ''} ×{' '}
                      {formatInvoiceAmount(lineItem.unitPrice || 0)}
                      {(lineItem.discount || 0) > 0 ? ` (−${lineItem.discount}%)` : ''}
                    </span>
                    <span className={cn(LINE_ITEM_VALUE_CLASS, 'shrink-0 font-semibold')}>
                      {formatInvoiceMoney(lineNet, currency)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={DETAIL_EMPTY_STATE_CLASS}>
              {t('estimates.noLineItems', { defaultValue: 'No line items' })}
            </p>
          )}
        </DetailSection>
      </Card>

      {lineItems.length > 0 ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('estimates.pricingSummary')}
            icon={Calculator}
            iconPlugin="estimates"
            subtleTitle
            className="p-6"
          >
            <EstimatePricingSummary
              totals={totals}
              currency={currency}
              estimateDiscount={estimate.estimateDiscount || 0}
            />
          </DetailSection>
        </Card>
      ) : null}
    </div>
  );

  const linkedCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('estimates.relations', { defaultValue: 'Relations' })}
        icon={Link2}
        iconPlugin="contacts"
        subtleTitle
        className="p-6"
      >
        {estimate.contactId || estimate.contactName || linkedInvoice ? (
          <QuickContextLinkTileGrid>
            {estimate.contactId || estimate.contactName ? (
              <QuickContextLinkTile
                label={t('nav.contact')}
                meta={
                  contactRecord
                    ? t(
                        `contacts.type.${contactRecord.contactType === 'private' ? 'private' : 'company'}`,
                      )
                    : estimate.organizationNumber
                      ? `Org: ${estimate.organizationNumber}`
                      : undefined
                }
                metaClassName={
                  contactRecord
                    ? CONTACT_TYPE_COLORS[
                        contactRecord.contactType === 'private' ? 'private' : 'company'
                      ]
                    : undefined
                }
                icon={Users}
                iconClassName="text-sky-600"
                onClick={() => {
                  if (contactRecord && enabledPlugins.has('contacts')) {
                    setViewingContact(contactRecord);
                  }
                }}
              >
                {estimate.contactName || t('estimates.noCustomer', { defaultValue: 'No customer' })}
              </QuickContextLinkTile>
            ) : null}
            {linkedInvoice && enabledPlugins.has('invoices') ? (
              <QuickContextLinkTile
                label={t('nav.invoice')}
                meta={formatInvoiceStatusForDisplay(linkedInvoice.status || 'draft')}
                metaClassName={
                  INVOICE_STATUS_COLORS[linkedInvoice.status || 'draft'] ??
                  'bg-muted/40 text-muted-foreground'
                }
                icon={Receipt}
                iconClassName="text-violet-600"
                onClick={() => setViewingInvoice(linkedInvoice)}
              >
                {formatDisplayNumber('invoices', linkedInvoice.invoiceNumber || linkedInvoice.id)}
              </QuickContextLinkTile>
            ) : null}
          </QuickContextLinkTileGrid>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>
            {t('estimates.tabs.linkedEmpty', { defaultValue: 'No linked records yet.' })}
          </p>
        )}
      </DetailSection>
    </Card>
  );

  const body = (
    <div className="space-y-4">
      <EstimateQuickContextPanel estimate={estimate} headerBelow={tabChips} />
      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'lines' ? linesCard : null}
      {activeTab === 'linked' ? linkedCard : null}
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
    </div>
  );

  const invoicePreviewStatus = viewingInvoice?.status || 'draft';
  const invoicePreviewTitle = viewingInvoice
    ? formatDisplayNumber('invoices', viewingInvoice.invoiceNumber || viewingInvoice.id)
    : '';
  const invoicePreviewTotals = viewingInvoice ? resolveInvoiceTotals(viewingInvoice) : null;
  const invoicePreviewLineCount = Array.isArray(viewingInvoice?.lineItems)
    ? viewingInvoice.lineItems.length
    : 0;
  const invoicePreviewCurrency = viewingInvoice?.currency || 'SEK';

  return (
    <>
      {stacked ? body : <DetailLayout gridClassName="grid-cols-1">{body}</DetailLayout>}

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigate(`/contacts/${buildSlug(viewingContact, contacts || [], 'companyName')}`);
            setViewingContact(null);
          }
        }}
        badges={
          viewingContact ? (
            <span
              className={cn(
                CONTACT_TYPE_BADGE_CLASS,
                CONTACT_TYPE_COLORS[viewingContact.contactType],
              )}
            >
              {t(`contacts.type.${viewingContact.contactType}`)}
            </span>
          ) : null
        }
      />

      <AssignmentQuickInfoDialog
        isOpen={viewingInvoice !== null}
        title={invoicePreviewTitle}
        icon={FileText}
        badges={
          viewingInvoice ? (
            <span
              className={cn(
                INVOICE_STATUS_COLORS[invoicePreviewStatus] ?? 'bg-muted/40 text-muted-foreground',
                LINKED_SECTION_BADGE_CLASS,
              )}
            >
              {formatInvoiceStatusForDisplay(invoicePreviewStatus)}
            </span>
          ) : null
        }
        details={
          viewingInvoice && invoicePreviewTotals
            ? [
                {
                  icon: FileText,
                  label: t('invoices.fieldStatus'),
                  value: formatInvoiceStatusForDisplay(invoicePreviewStatus),
                },
                {
                  icon: Hash,
                  label: t('invoices.quickInfo.items'),
                  value: t('invoices.quickInfo.itemsCount', { count: invoicePreviewLineCount }),
                },
                {
                  icon: FileText,
                  label: t('invoices.subtotalAfterInvoiceDiscount'),
                  value: formatInvoiceMoney(
                    invoicePreviewTotals.subtotalAfterInvoiceDiscount,
                    invoicePreviewCurrency,
                  ),
                },
                {
                  icon: FileText,
                  label: t('invoices.totalAmount'),
                  value: formatInvoiceMoney(invoicePreviewTotals.total, invoicePreviewCurrency),
                },
              ]
            : []
        }
        openLabel={t('contacts.openInvoice')}
        onClose={() => setViewingInvoice(null)}
        onOpen={() => {
          if (!viewingInvoice) {
            return;
          }
          navigate(`/invoices/${buildSlug(viewingInvoice, [], 'invoiceNumber')}`);
          setViewingInvoice(null);
        }}
      />

      <StatusReasonModal
        isOpen={estimateQuickEditShowStatusModal}
        onClose={handleEstimateQuickEditModalCancel}
        onConfirm={handleEstimateQuickEditModalConfirm}
        status={estimateQuickEditPendingStatus || 'accepted'}
        estimateNumber={formatDisplayNumber('estimates', estimate.estimateNumber)}
      />

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
