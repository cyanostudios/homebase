import {
  Calculator,
  Calendar,
  CreditCard,
  Eye,
  FileText,
  Hash,
  History,
  Info,
  Link2,
  ListOrdered,
  Receipt,
  Send,
  SlidersHorizontal,
  StickyNote,
  Users,
  Wallet,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { EMPTY_ORGANIZATION, organizationApi } from '@/core/api/organizationApi';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
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
import { ContactQuickInfoDialog } from '@/plugins/contacts/components/ContactQuickInfoDialog';
import {
  CONTACT_TYPE_BADGE_CLASS,
  CONTACT_TYPE_COLORS,
  type Contact,
} from '@/plugins/contacts/types/contacts';

import type { Invoice } from '../context/InvoicesContext';
import { useInvoiceStatusActions } from '../hooks/useInvoiceStatusActions';
import type { Invoice as InvoiceRecord } from '../types/invoices';
import { resolveInvoiceTotals } from '../utils/invoiceTotals';
import { displayPlainText } from '../utils/htmlText';
import { formatInvoiceAmount, formatInvoiceMoney } from '../utils/formatInvoiceAmount';
import {
  buildInvoiceCustomerBlock,
  displayNameFromEmail,
  fetchLogoAsDataUrl,
} from '../utils/invoiceDocumentIdentity';
import { formatInvoiceDueDate, formatPaymentTermsLabel } from '../utils/invoiceDueDate';
import {
  LINE_ITEM_LIST_ROW_CLASS,
  LINE_ITEM_MUTED_VALUE_CLASS,
  LINE_ITEM_PRIMARY_TEXT_CLASS,
  LINE_ITEM_SECONDARY_TEXT_CLASS,
  LINE_ITEM_VALUE_CLASS,
} from '../utils/invoiceLineItemStyles';
import {
  openInvoicePreviewWindow,
  writeInvoicePreviewWindow,
} from '../utils/openInvoicePreviewWindow';
import { generateInvoiceWebHTML } from '../webTemplate';

import { InvoiceDocumentPreview } from './InvoiceDocumentPreview';
import { InvoicePaymentsBlock } from './InvoicePaymentsBlock';
import { InvoicePricingSummary } from './InvoicePricingSummary';
import { InvoiceQuickContextPanel } from './InvoiceQuickContextPanel';
import { InvoiceShareBlock } from './InvoiceShareBlock';
import { InvoiceStatusModal } from './InvoiceStatusModal';
import { InvoiceStatusSelect } from './InvoiceStatusSelect';

interface InvoiceViewProps {
  invoice?: Invoice;
  item?: Invoice;
  /** Single-column card stack (e.g. list detail column). Default is two-column full panel. */
  stacked?: boolean;
}

type InvoiceViewTab = 'information' | 'lines' | 'payments' | 'linked' | 'activity';

const INVOICE_VIEW_TABS: InvoiceViewTab[] = [
  'information',
  'lines',
  'payments',
  'linked',
  'activity',
];

function parseInvoiceViewTab(value: string | null): InvoiceViewTab {
  if (value && INVOICE_VIEW_TABS.includes(value as InvoiceViewTab)) {
    return value as InvoiceViewTab;
  }
  return 'information';
}

export const InvoicesView: React.FC<InvoiceViewProps> = ({
  invoice,
  item,
  stacked: _stacked = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = parseInvoiceViewTab(searchParams.get('tab'));
  const setActiveTab = useCallback(
    (tab: InvoiceViewTab) => {
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
  const enabledPlugins = useEnabledPlugins();
  const { contacts, user } = useApp();
  const {
    showStatusModal,
    pendingStatus,
    pendingInvoice,
    handleStatusChange,
    handleModalConfirm,
    handleModalCancel,
  } = useInvoiceStatusActions();

  const actualItem = invoice || item;
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  const openSharedStylePreview = useCallback(() => {
    if (!actualItem) {
      return;
    }
    const win = openInvoicePreviewWindow();
    if (!win) {
      alert(
        t('invoices.previewPopupBlocked', {
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

        const lineItems = actualItem.lineItems || [];
        const totals = resolveInvoiceTotals(actualItem);
        const numberLabel = formatDisplayNumber(
          'invoices',
          String(actualItem.invoiceNumber || actualItem.id),
        );
        const contact =
          actualItem.contactId && contacts
            ? contacts.find((c) => String(c.id) === String(actualItem.contactId))
            : null;
        const customer = buildInvoiceCustomerBlock({
          contactName: actualItem.contactName,
          organizationNumber: actualItem.organizationNumber,
          contactId: actualItem.contactId,
          contact: contact || null,
        });

        const html = generateInvoiceWebHTML({
          id: actualItem.id,
          invoiceNumber: numberLabel,
          contactName: actualItem.contactName,
          organizationNumber: actualItem.organizationNumber,
          currency: actualItem.currency || 'SEK',
          lineItems,
          invoiceDiscount: actualItem.invoiceDiscount || 0,
          notes: actualItem.notes,
          paymentTerms: actualItem.paymentTerms,
          orderNumber: actualItem.orderNumber,
          deliveryMethod: actualItem.deliveryMethod,
          issueDate: actualItem.issueDate,
          dueDate: actualItem.dueDate,
          status: actualItem.status,
          invoiceType: actualItem.invoiceType,
          ...totals,
          organization,
          referencePerson: displayNameFromEmail(user?.email),
          customer,
        });

        writeInvoicePreviewWindow(win, html, `Faktura ${numberLabel}`, {
          pageBreakLabel: t('invoices.previewPageBreak', { defaultValue: 'Page break' }),
        });
      } catch (error) {
        console.error('Failed to open invoice preview', error);
        try {
          win.close();
        } catch {
          /* ignore */
        }
        alert(
          t('invoices.previewOpenFailed', {
            defaultValue: 'Could not open invoice preview. Try again.',
          }),
        );
      }
    })();
  }, [actualItem, contacts, t, user?.email]);

  if (!actualItem) {
    return null;
  }

  const status = actualItem.status ?? 'draft';
  const currency = actualItem.currency ?? 'SEK';
  const contactRecord =
    actualItem.contactId && contacts
      ? contacts.find((c) => String(c.id) === String(actualItem.contactId))
      : null;
  const hasLineItems = Boolean(actualItem.lineItems && actualItem.lineItems.length > 0);
  const hasNotes = Boolean(displayPlainText(actualItem.notes).trim());
  const statusInvoice = actualItem as unknown as InvoiceRecord;
  const lineItems = actualItem.lineItems ?? [];
  const invoiceDiscount = Number(actualItem.invoiceDiscount ?? 0);
  const totals = resolveInvoiceTotals(actualItem);

  const navigateToContact = (contact: Contact) => {
    navigate(`/contacts/${buildSlug(contact, contacts || [], 'companyName')}`);
  };

  const tabs = [
    {
      id: 'information' as const,
      label: t('invoices.tabs.information'),
      icon: Info,
      count: null as number | null,
    },
    {
      id: 'lines' as const,
      label: t('invoices.tabs.lines'),
      icon: ListOrdered,
      count: lineItems.length > 0 ? lineItems.length : null,
    },
    {
      id: 'payments' as const,
      label: t('invoices.tabs.payments'),
      icon: CreditCard,
      count: null as number | null,
    },
    {
      id: 'linked' as const,
      label: t('invoices.tabs.linked'),
      icon: Link2,
      count: null as number | null,
    },
    {
      id: 'activity' as const,
      label: t('invoices.tabs.activity'),
      icon: History,
      count: null as number | null,
    },
  ];

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

  const numberLabel = formatDisplayNumber('invoices', actualItem.invoiceNumber || actualItem.id);
  const invoiceType = actualItem.invoiceType || 'invoice';
  const typeLabel = t(`invoices.type.${invoiceType}`, { defaultValue: invoiceType });
  const issueDateLabel = formatDate(actualItem.issueDate) || '—';
  const dueDateLabel = formatDate(actualItem.dueDate) || '—';
  const due = formatInvoiceDueDate(actualItem.dueDate);
  const showDueUrgency = status !== 'paid' && status !== 'canceled';
  const amountLabel = formatInvoiceAmount(totals.total);
  const paymentTermsLabel = formatPaymentTermsLabel(actualItem.paymentTerms);
  const factLabelClass =
    'mb-0.5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400';
  const factValueClass = 'text-base font-medium text-foreground';

  const informationCard = (
    <div className="space-y-4">
      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('invoices.information')}
          icon={Info}
          iconPlugin="invoices"
          subtleTitle
          className="p-6"
        >
          <div className="grid grid-cols-1 gap-y-3 md:grid-cols-2 md:gap-x-4">
            <div>
              <div className={factLabelClass}>
                <Hash className="h-3 w-3" />
                {t('invoices.table.number')}
              </div>
              <div className={factValueClass}>{numberLabel || '—'}</div>
            </div>
            <div>
              <div className={factLabelClass}>
                <FileText className="h-3 w-3" />
                {t('invoices.invoiceType', { defaultValue: 'Invoice type' })}
              </div>
              <div className={factValueClass}>{typeLabel}</div>
            </div>
            <div>
              <div className={factLabelClass}>
                <Calendar className="h-3 w-3" />
                {t('invoices.issueDate')}
              </div>
              <div className={factValueClass}>{issueDateLabel}</div>
            </div>
            <div>
              <div className={factLabelClass}>
                <Calendar className="h-3 w-3" />
                {t('invoices.fieldDueDate')}
              </div>
              <div
                className={cn(
                  DETAIL_FIELD_VALUE_CLASS,
                  showDueUrgency && due ? due.className : undefined,
                )}
              >
                {due && showDueUrgency ? due.text : dueDateLabel}
              </div>
            </div>
            <div>
              <div className={factLabelClass}>
                <Wallet className="h-3 w-3" />
                {t('invoices.table.total')}
              </div>
              <div className={cn(DETAIL_FIELD_VALUE_CLASS, 'tabular-nums')}>
                {amountLabel} {currency}
              </div>
            </div>
            <div>
              <div className={factLabelClass}>
                <Receipt className="h-3 w-3" />
                {t('invoices.currency')}
              </div>
              <div className={factValueClass}>{currency}</div>
            </div>
            <div>
              <div className={factLabelClass}>{t('invoices.paymentTerms')}</div>
              <div className={cn(factValueClass, 'truncate')}>{paymentTermsLabel}</div>
            </div>
          </div>
        </DetailSection>
      </Card>

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('invoices.invoiceProperties', { defaultValue: 'Invoice Properties' })}
          icon={SlidersHorizontal}
          iconPlugin="invoices"
          subtleTitle
          className="p-6"
        >
          <div className="space-y-4">
            <div className={DETAIL_PROP_ROW_CLASS}>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {t('invoices.propertyStatus', { defaultValue: 'Status' })}
              </span>
              <InvoiceStatusSelect
                invoice={actualItem}
                onStatusChange={(nextStatus) => handleStatusChange(statusInvoice, nextStatus)}
                hideInlineLabel
              />
            </div>

            {hasNotes ? (
              <div className="space-y-2">
                <SubtleSectionHeading title={t('invoices.notesAndTerms')} icon={StickyNote} />
                <div className={DETAIL_NOTE_CALLOUT_CLASS}>
                  <p className="whitespace-pre-wrap text-sm font-medium text-amber-950 dark:text-amber-200">
                    {displayPlainText(actualItem.notes)}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </DetailSection>
      </Card>
      <InvoiceShareBlock invoice={actualItem} />

      <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
        <DetailSection
          title={t('invoices.previewTitle', { defaultValue: 'Invoice preview' })}
          icon={Eye}
          subtleTitle
          className="p-6"
        >
          <p className="mb-3 text-xs text-muted-foreground">
            {t('invoices.previewHelp', {
              defaultValue: 'This is how the invoice will look when shared or exported as PDF.',
            })}
          </p>
          <div className="mx-auto w-full max-w-[794px]">
            <InvoiceDocumentPreview
              formData={{
                contactId: actualItem.contactId || '',
                contactName: actualItem.contactName || '',
                organizationNumber: actualItem.organizationNumber || '',
                currency,
                lineItems,
                invoiceDiscount,
                notes: actualItem.notes || '',
                paymentTerms: actualItem.paymentTerms || '30',
                orderNumber: actualItem.orderNumber || '',
                deliveryMethod: actualItem.deliveryMethod || '',
                issueDate: actualItem.issueDate ? new Date(actualItem.issueDate) : null,
                dueDate: actualItem.dueDate ? new Date(actualItem.dueDate) : null,
                status,
                invoiceType: actualItem.invoiceType || 'invoice',
              }}
              invoiceId={actualItem.id}
              invoiceNumber={actualItem.invoiceNumber}
            />
            <div className="mt-4 flex justify-end gap-2">
              {status === 'draft' ? (
                <RoundIconLabelButton
                  type="button"
                  icon={Send}
                  label={t('invoices.send', { defaultValue: 'Send' })}
                  variant="soft"
                  size="xs"
                  alwaysExpanded
                  onClick={() => handleStatusChange(statusInvoice, 'sent')}
                />
              ) : null}
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
          title={t('invoices.lineItemsCount', { count: lineItems.length })}
          icon={ListOrdered}
          iconPlugin="invoices"
          subtleTitle
          className="p-6"
          collapsible
          defaultOpen
        >
          {hasLineItems ? (
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
                const showDescription =
                  Boolean(lineItem.description && lineItem.name) &&
                  lineItem.description !== lineItem.name;
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
                      {showDescription ? (
                        <div className={LINE_ITEM_SECONDARY_TEXT_CLASS}>{lineItem.description}</div>
                      ) : null}
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
            <p className="text-xs text-muted-foreground">
              {t('invoices.noLineItems', { defaultValue: 'No line items' })}
            </p>
          )}
        </DetailSection>
      </Card>

      {hasLineItems ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('invoices.pricingSummary')}
            icon={Calculator}
            iconPlugin="invoices"
            subtleTitle
            className="p-6"
          >
            <InvoicePricingSummary
              totals={totals}
              currency={currency}
              invoiceDiscount={invoiceDiscount}
            />
          </DetailSection>
        </Card>
      ) : null}
    </div>
  );

  const paymentsCard = (
    <InvoicePaymentsBlock
      invoiceId={String(actualItem.id)}
      currency={currency}
      total={totals.total}
      amountPaid={Number(actualItem.amountPaid ?? 0)}
      status={status}
    />
  );

  const linkedCard = (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('invoices.relations', { defaultValue: 'Relations' })}
        icon={Link2}
        iconPlugin="contacts"
        subtleTitle
        className="p-6"
      >
        {actualItem.contactId || actualItem.contactName ? (
          <QuickContextLinkTileGrid>
            <QuickContextLinkTile
              label={t('nav.contact')}
              meta={
                contactRecord
                  ? t(
                      `contacts.type.${contactRecord.contactType === 'private' ? 'private' : 'company'}`,
                    )
                  : actualItem.organizationNumber
                    ? `Org: ${actualItem.organizationNumber}`
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
              {actualItem.contactName || t('invoices.noCustomer')}
            </QuickContextLinkTile>
          </QuickContextLinkTileGrid>
        ) : (
          <p className={DETAIL_EMPTY_STATE_CLASS}>{t('invoices.tabs.linkedEmpty')}</p>
        )}
      </DetailSection>
    </Card>
  );

  const leftColumn = (
    <div className="space-y-4">
      <InvoiceQuickContextPanel invoice={actualItem} headerBelow={tabChips} />

      {activeTab === 'information' ? informationCard : null}
      {activeTab === 'lines' ? linesCard : null}
      {activeTab === 'payments' ? paymentsCard : null}
      {activeTab === 'linked' ? linkedCard : null}
      {activeTab === 'activity' ? (
        <DetailActivityLog
          entityType="invoice"
          entityId={actualItem.id}
          limit={30}
          title={t('invoices.activity')}
          showClearButton
          refreshKey={String(actualItem.updatedAt ?? actualItem.id)}
          systemId={formatDisplayNumber('invoices', actualItem.id)}
        />
      ) : null}
    </div>
  );

  return (
    <>
      <div className="plugin-invoices">{leftColumn}</div>

      <ContactQuickInfoDialog
        isOpen={viewingContact !== null}
        contact={viewingContact}
        onClose={() => setViewingContact(null)}
        onOpenContact={() => {
          if (viewingContact) {
            navigateToContact(viewingContact);
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

      <InvoiceStatusModal
        isOpen={showStatusModal}
        status={pendingStatus || ''}
        invoiceNumber={pendingInvoice?.invoiceNumber || ''}
        onConfirm={handleModalConfirm}
        onClose={handleModalCancel}
      />
    </>
  );
};
