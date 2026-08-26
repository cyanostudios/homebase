import {
  Copy,
  Download,
  Edit,
  Info,
  Link2,
  SlidersHorizontal,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useApp } from '@/core/api/AppContext';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailActivityLog } from '@/core/ui/DetailActivityLog';
import { DetailLayout } from '@/core/ui/DetailLayout';
import { DetailSection } from '@/core/ui/DetailSection';
import {
  DETAIL_INFO_ROW_CLASS,
  DETAIL_PROP_ROW_CLASS,
  DETAIL_QUICK_ACTION_ROW_CLASS,
  DETAIL_VIEW_CARD_CLASS,
} from '@/core/ui/detailViewCardStyles';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
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
import { formatInvoiceDueDate, formatPaymentTermsLabel } from '../utils/invoiceDueDate';

import { InvoiceActions } from './InvoiceActions';
import { InvoiceQuickContextPanel } from './InvoiceQuickContextPanel';
import {
  InvoiceShareBlock,
  InvoiceShareExportButton,
  InvoiceShareProvider,
} from './InvoiceShareBlock';
import { InvoiceStatusModal } from './InvoiceStatusModal';
import { InvoiceStatusSelect } from './InvoiceStatusSelect';

function InvoiceQuickActionsCard({
  invoice,
  onEdit,
  onDeleteClick,
  onDuplicate,
  canDuplicate,
}: {
  invoice: Invoice;
  onEdit: (invoice: Invoice) => void;
  onDeleteClick: () => void;
  onDuplicate: () => void;
  canDuplicate: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
      <DetailSection
        title={t('invoices.quickActions')}
        icon={Zap}
        iconPlugin="invoices"
        subtleTitle
        className="p-4"
      >
        <div className="flex flex-col items-start gap-1">
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
            className={DETAIL_QUICK_ACTION_ROW_CLASS}
            onClick={() => onEdit(invoice)}
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
            className="h-9 justify-start rounded-md px-3 text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 transition-colors"
            onClick={onDeleteClick}
          >
            {t('common.delete')}
          </Button>
          {canDuplicate ? (
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
              className={DETAIL_QUICK_ACTION_ROW_CLASS}
              onClick={onDuplicate}
            >
              {t('common.duplicate')}
            </Button>
          ) : null}
        </div>
      </DetailSection>
    </Card>
  );
}

interface InvoiceViewProps {
  invoice?: Invoice;
  item?: Invoice;
}

export const InvoicesView: React.FC<InvoiceViewProps> = ({ invoice, item }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const enabledPlugins = useEnabledPlugins();
  const { contacts } = useApp();
  const {
    openInvoiceForEdit,
    deleteInvoice,
    closeInvoicesPanel,
    getDuplicateConfig,
    executeDuplicate,
    setRecentlyDuplicatedInvoiceId,
    getDeleteMessage,
  } = useInvoices();
  const {
    showStatusModal,
    pendingStatus,
    pendingInvoice,
    handleStatusChange,
    handleModalConfirm,
    handleModalCancel,
  } = useInvoiceStatusActions();

  const actualItem = invoice || item;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [viewingContact, setViewingContact] = useState<Contact | null>(null);

  if (!actualItem) {
    return null;
  }

  const created = actualItem.createdAt ? new Date(actualItem.createdAt) : null;
  const updated = actualItem.updatedAt ? new Date(actualItem.updatedAt) : null;
  const issueDate = actualItem.issueDate ? new Date(actualItem.issueDate) : null;
  const dueDate = actualItem.dueDate ? new Date(actualItem.dueDate) : null;
  const status = actualItem.status ?? 'draft';
  const currency = actualItem.currency ?? 'SEK';
  const invoiceNumberDisplay = formatDisplayNumber(
    'invoices',
    actualItem.invoiceNumber || actualItem.id,
  );
  const dueDisplay = formatInvoiceDueDate(actualItem.dueDate);
  const showDueUrgency = status !== 'paid' && status !== 'canceled';
  const canDuplicate = Boolean(getDuplicateConfig(actualItem));
  const contactRecord =
    actualItem.contactId && contacts
      ? contacts.find((c) => String(c.id) === String(actualItem.contactId))
      : null;
  const hasLineItems = Boolean(actualItem.lineItems && actualItem.lineItems.length > 0);
  const hasNotes = Boolean(actualItem.notes?.trim());
  const statusInvoice = actualItem as unknown as InvoiceRecord;
  const lineItems = actualItem.lineItems ?? [];
  const subtotal = Number(actualItem.subtotal ?? 0);
  const totalDiscount = Number(actualItem.totalDiscount ?? 0);
  const paymentTermsLabel = formatPaymentTermsLabel(actualItem.paymentTerms);

  const handleConfirmDelete = async () => {
    await deleteInvoice(actualItem.id);
    setShowDeleteConfirm(false);
    closeInvoicesPanel();
  };

  const navigateToContact = (contact: Contact) => {
    navigate(`/contacts/${buildSlug(contact, contacts || [], 'companyName')}`);
  };

  const relationsCard =
    actualItem.contactId && enabledPlugins.has('contacts') ? (
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
              iconClassName={contactRecord ? 'text-sky-600' : 'text-slate-400'}
              onClick={contactRecord ? () => setViewingContact(contactRecord) : undefined}
              className={!contactRecord ? 'opacity-70' : undefined}
            >
              {actualItem.contactName || t('nav.contact')}
            </QuickContextLinkTile>
          </QuickContextLinkTileGrid>
        </DetailSection>
      </Card>
    ) : null;

  return (
    <InvoiceShareProvider invoice={actualItem}>
      <div className="plugin-invoices">
        <DetailLayout
          gridClassName="grid-cols-1 lg:grid-cols-[1.3fr_1fr_260px]"
          leftSidebar={
            <div className="space-y-4">
              <InvoiceQuickContextPanel
                invoice={actualItem}
                onEdit={() => openInvoiceForEdit(actualItem)}
                variant="full"
              >
                {hasLineItems ? (
                  <div className="overflow-x-auto">
                    <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {t('invoices.lineItemsCount', { count: lineItems.length })}
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="pb-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t('invoices.description', { defaultValue: 'Description' })}
                          </th>
                          <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t('invoices.qty', { defaultValue: 'Qty' })}
                          </th>
                          <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t('invoices.price', { defaultValue: 'Price' })}
                          </th>
                          <th className="pb-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {t('invoices.table.total', { defaultValue: 'Total' })}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {lineItems.map((lineItem) => (
                          <tr
                            key={lineItem.id || `${lineItem.name}-${lineItem.description}`}
                            className="group hover:bg-muted/30"
                          >
                            <td className="py-4">
                              <div className="text-sm font-medium text-foreground">
                                {lineItem.name || lineItem.description || 'Item'}
                              </div>
                              {lineItem.description && lineItem.name ? (
                                <div className="text-[10px] text-muted-foreground">
                                  {lineItem.description}
                                </div>
                              ) : null}
                            </td>
                            <td className="py-4 text-right text-sm text-foreground">
                              {lineItem.quantity || 0}
                            </td>
                            <td className="py-4 text-right text-sm text-foreground">
                              {(lineItem.unitPrice || 0).toFixed(2)}
                            </td>
                            <td className="py-4 text-right text-sm font-medium text-foreground">
                              {((lineItem.quantity || 0) * (lineItem.unitPrice || 0)).toFixed(2)}{' '}
                              {currency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('invoices.noLineItems', { defaultValue: 'No line items' })}
                  </p>
                )}

                <div className="space-y-3 text-sm">
                  <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                    {t('invoices.pricingSummary')}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('invoices.subtotal', { defaultValue: 'Subtotal' })}
                    </span>
                    <span className="font-medium">
                      {subtotal.toFixed(2)} {currency}
                    </span>
                  </div>
                  {totalDiscount > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        {t('invoices.lineDiscounts', { defaultValue: 'Line Discounts' })}
                      </span>
                      <span className="font-medium text-red-600">
                        -{totalDiscount.toFixed(2)} {currency}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {t('invoices.totalVat', { defaultValue: 'Total VAT' })}
                    </span>
                    <span className="font-medium">
                      {Number(actualItem.totalVat ?? 0).toFixed(2)} {currency}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-4 text-lg font-semibold">
                    <span>{t('invoices.totalAmount', { defaultValue: 'Total Amount' })}</span>
                    <span>
                      {Number(actualItem.total ?? 0).toFixed(2)} {currency}
                    </span>
                  </div>
                </div>

                {hasNotes ? (
                  <div className="space-y-2 border-t border-border/50 pt-4">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      {t('invoices.notesAndTerms')}
                    </div>
                    <div className="text-sm italic leading-relaxed text-muted-foreground">
                      "{actualItem.notes}"
                    </div>
                  </div>
                ) : null}
              </InvoiceQuickContextPanel>
            </div>
          }
          sidebar={
            <div className="space-y-4">
              <InvoiceQuickActionsCard
                invoice={actualItem}
                onEdit={openInvoiceForEdit}
                onDeleteClick={() => setShowDeleteConfirm(true)}
                onDuplicate={() => setShowDuplicateDialog(true)}
                canDuplicate={canDuplicate}
              />

              <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
                <DetailSection
                  title={t('invoices.exportOptions', { defaultValue: 'Export options' })}
                  icon={Download}
                  iconPlugin="invoices"
                  subtleTitle
                  className="p-4"
                >
                  <div className="flex flex-col items-start gap-1">
                    <InvoiceActions invoice={actualItem} exportOnly />
                    <InvoiceShareExportButton />
                  </div>
                </DetailSection>
              </Card>

              <Card padding="none" className={cn(DETAIL_VIEW_CARD_CLASS, 'plugin-invoices')}>
                <DetailSection
                  title={t('invoices.information')}
                  icon={Info}
                  iconPlugin="invoices"
                  subtleTitle
                  className="p-4"
                  collapsible
                >
                  <div>
                    <div className={DETAIL_INFO_ROW_CLASS}>
                      <span className="text-slate-500 dark:text-slate-400">ID</span>
                      <span className="font-mono font-extrabold text-foreground">
                        {invoiceNumberDisplay || '—'}
                      </span>
                    </div>
                    <div className={DETAIL_INFO_ROW_CLASS}>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('common.created', { defaultValue: 'Created' })}
                      </span>
                      <span className="font-mono font-extrabold text-foreground">
                        {created ? created.toLocaleDateString() : '—'}
                      </span>
                    </div>
                    <div className={DETAIL_INFO_ROW_CLASS}>
                      <span className="text-slate-500 dark:text-slate-400">
                        {t('common.updated', { defaultValue: 'Updated' })}
                      </span>
                      <span className="font-mono font-extrabold text-foreground">
                        {updated ? updated.toLocaleDateString() : '—'}
                      </span>
                    </div>
                  </div>
                </DetailSection>
              </Card>

              <DetailActivityLog
                entityType="invoice"
                entityId={actualItem.id}
                limit={30}
                title={t('invoices.activity', { defaultValue: 'Activity' })}
                showClearButton
                refreshKey={String(actualItem.updatedAt ?? actualItem.id)}
              />
            </div>
          }
        >
          <div className="space-y-4">
            <Card padding="none" className={DETAIL_VIEW_CARD_CLASS}>
              <DetailSection
                title={t('invoices.invoiceProperties', {
                  defaultValue: 'Invoice Properties',
                })}
                icon={SlidersHorizontal}
                iconPlugin="invoices"
                subtleTitle
                className="p-6"
              >
                <div>
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
                  <div className={DETAIL_PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('invoices.issueDate', { defaultValue: 'Issue Date' })}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {issueDate ? issueDate.toLocaleDateString() : '—'}
                    </span>
                  </div>
                  <div className={DETAIL_PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('invoices.paymentTerms', { defaultValue: 'Payment terms' })}
                    </span>
                    <span className="text-sm font-medium text-foreground">{paymentTermsLabel}</span>
                  </div>
                  <div className={DETAIL_PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('invoices.fieldDueDate', { defaultValue: 'Due Date' })}
                    </span>
                    <span
                      className={cn(
                        'text-sm font-medium',
                        showDueUrgency && dueDisplay ? dueDisplay.className : 'text-foreground',
                      )}
                    >
                      {dueDisplay && showDueUrgency
                        ? dueDisplay.text
                        : dueDate
                          ? dueDate.toLocaleDateString()
                          : '—'}
                    </span>
                  </div>
                  <div className={DETAIL_PROP_ROW_CLASS}>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('invoices.currency', { defaultValue: 'Currency' })}
                    </span>
                    <span className="text-sm font-medium text-foreground">{currency}</span>
                  </div>
                </div>
              </DetailSection>
            </Card>

            {relationsCard}
            <InvoiceShareBlock />
          </div>
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

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('invoices.deleteTitle')}
        message={getDeleteMessage(actualItem)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <InvoiceStatusModal
        isOpen={showStatusModal}
        onClose={handleModalCancel}
        onConfirm={handleModalConfirm}
        status={pendingStatus || ''}
        invoiceNumber={formatDisplayNumber(
          'invoices',
          pendingInvoice?.invoiceNumber || pendingInvoice?.id || '',
        )}
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(actualItem, newName)
            .then(({ closePanel, highlightId }) => {
              closePanel();
              if (highlightId) {
                setRecentlyDuplicatedInvoiceId(highlightId);
              }
              setShowDuplicateDialog(false);
            })
            .catch(() => setShowDuplicateDialog(false));
        }}
        onCancel={() => setShowDuplicateDialog(false)}
        defaultName={getDuplicateConfig(actualItem)?.defaultName ?? ''}
        nameLabel={getDuplicateConfig(actualItem)?.nameLabel ?? t('nav.invoice')}
        confirmOnly={Boolean(getDuplicateConfig(actualItem)?.confirmOnly)}
      />
    </InvoiceShareProvider>
  );
};
