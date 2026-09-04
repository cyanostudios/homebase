import { Calculator, Eye, Link2, ListOrdered, StickyNote, Users } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { EMPTY_ORGANIZATION, organizationApi } from '@/core/api/organizationApi';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection, SubtleSectionHeading } from '@/core/ui/DetailSection';
import {
  DETAIL_NOTE_CALLOUT_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { QuickContextLinkTile, QuickContextLinkTileGrid } from '@/core/ui/QuickContextLinkTile';
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
import { useInvoices } from '../hooks/useInvoices';
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
}

export const InvoicesView: React.FC<InvoiceViewProps> = ({ invoice, item }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enabledPlugins = useEnabledPlugins();
  const { contacts, user } = useApp();
  const { openInvoiceForEdit } = useInvoices();
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

  const previewFormData = {
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
  };

  const leftColumn = (
    <div className="space-y-4">
      <InvoiceQuickContextPanel
        invoice={actualItem}
        onEdit={() => openInvoiceForEdit(actualItem)}
        variant="full"
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
              filled
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
      </InvoiceQuickContextPanel>

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

      <InvoicePaymentsBlock
        invoiceId={String(actualItem.id)}
        currency={currency}
        total={totals.total}
        amountPaid={Number(actualItem.amountPaid ?? 0)}
        status={status}
      />

      {actualItem.contactId && enabledPlugins.has('contacts') ? (
        <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
          <DetailSection
            title={t('invoices.relations', { defaultValue: 'Relations' })}
            icon={Link2}
            iconPlugin="contacts"
            subtleTitle
            className="p-6"
          >
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
                  if (contactRecord) {
                    setViewingContact(contactRecord);
                  }
                }}
              >
                {actualItem.contactName || t('invoices.noCustomer')}
              </QuickContextLinkTile>
            </QuickContextLinkTileGrid>
          </DetailSection>
        </Card>
      ) : null}

      <InvoiceShareBlock />
    </div>
  );

  const rightColumn = (
    <div className="lg:sticky lg:top-4">
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
          <div className="w-full max-w-[794px]">
            <InvoiceDocumentPreview
              formData={previewFormData}
              invoiceId={actualItem.id}
              invoiceNumber={actualItem.invoiceNumber}
            />
            <div className="mt-4 flex justify-end">
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

  return (
    <>
      <div className="plugin-invoices">
        <DetailLayout gridClassName="grid-cols-1 lg:grid-cols-2" leftSidebar={leftColumn}>
          {rightColumn}
        </DetailLayout>
      </div>

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
