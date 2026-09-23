import {
  Copy,
  Download,
  Edit,
  ExternalLink,
  FileMinus,
  Mail,
  Share,
  Stamp,
  Trash2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { BulkEmailDialog, type BulkEmailRecipient } from '@/core/ui/BulkEmailDialog';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { invoicesApi } from '../api/invoicesApi';
import type { Invoice } from '../context/InvoicesContext';
import { useInvoiceStatusActions } from '../hooks/useInvoiceStatusActions';
import { useInvoices } from '../hooks/useInvoices';
import { canCreateCreditNoteFromInvoice } from '../utils/buildCreditNoteFromInvoice';
import { isInvoiceIssued } from '../utils/invoiceMlCompliance';
import {
  buildInvoiceShareUrl,
  formatInvoiceShareEmailHtml,
  formatInvoiceShareEmailText,
} from '../utils/invoiceShareEmail';

import { InvoiceShareModals } from './InvoiceShareModals';
import { InvoiceStatusModal } from './InvoiceStatusModal';

export function InvoiceDetailHeaderMenus({
  invoice,
  leading,
}: {
  invoice: Invoice;
  /** Optional leading content on the Actions/Export trigger row (e.g. invoice number). */
  leading?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { user, contacts } = useApp();
  const {
    openInvoiceForEdit,
    deleteInvoice,
    closeInvoicesPanel,
    getDuplicateConfig,
    executeDuplicate,
    createCreditNoteFromInvoice,
    setRecentlyDuplicatedInvoiceId,
    getDeleteMessage,
    invoiceShare,
    isCreatingInvoiceShare,
    openInvoiceShareForItem,
    ensureInvoiceShareForItem,
  } = useInvoices();
  const {
    showStatusModal,
    pendingStatus,
    pendingInvoice,
    handleStatusChange,
    handleModalConfirm,
    handleModalCancel,
  } = useInvoiceStatusActions();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showCreditNoteConfirm, setShowCreditNoteConfirm] = useState(false);
  const [isCreatingCreditNote, setIsCreatingCreditNote] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [sendEmailRecipients, setSendEmailRecipients] = useState<BulkEmailRecipient[]>([]);
  const [emailShareUrl, setEmailShareUrl] = useState<string | null>(null);
  const [isPreparingEmail, setIsPreparingEmail] = useState(false);

  const duplicateConfig = getDuplicateConfig(invoice);
  const canDuplicate = Boolean(duplicateConfig);
  const issued = isInvoiceIssued(invoice.status);
  const canCreditNote = canCreateCreditNoteFromInvoice(invoice);
  const hasActiveShare = Boolean(invoiceShare && new Date(invoiceShare.validUntil) > new Date());
  const canSendEmail =
    user?.role === 'superuser' || (Array.isArray(user?.plugins) && user.plugins.includes('mail'));
  const canIssue = (invoice.status || 'draft') === 'draft';
  const issuedLockHint = t('invoices.issuedLockedHint', {
    defaultValue: 'Issued documents cannot be edited. Create a credit note to correct.',
  });
  const shareLinkLabel = t('invoices.emailInvoiceLinkLabel', {
    defaultValue: 'Invoice link',
  });
  const issueLabel = t('invoices.issue', { defaultValue: 'Issue' });

  const handleDownloadPDF = async () => {
    setIsDownloadingPDF(true);
    try {
      const blob = await invoicesApi.downloadPdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    } finally {
      setIsDownloadingPDF(false);
    }
  };

  const handleEmailInvoice = async () => {
    if (!canSendEmail || isPreparingEmail || isCreatingInvoiceShare) {
      return;
    }
    setIsPreparingEmail(true);
    try {
      const share = await ensureInvoiceShareForItem(invoice);
      if (!share) {
        return;
      }
      const shareUrl = buildInvoiceShareUrl(share.shareToken);
      const contact =
        invoice.contactId != null
          ? contacts?.find((c) => String(c.id) === String(invoice.contactId))
          : undefined;
      const email = contact?.email ? String(contact.email).trim() : '';
      setSendEmailRecipients([
        {
          id: String(invoice.contactId || invoice.id),
          name: invoice.contactName || contact?.companyName || '',
          email,
        },
      ]);
      setEmailShareUrl(shareUrl);
      setShowSendEmailDialog(true);
    } finally {
      setIsPreparingEmail(false);
    }
  };

  const closeSendEmailDialog = () => {
    setShowSendEmailDialog(false);
    setSendEmailRecipients([]);
    setEmailShareUrl(null);
  };

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        disabled: issued,
        onClick: () => {
          if (issued) {
            return;
          }
          openInvoiceForEdit(invoice);
        },
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        disabled: issued,
        onClick: () => {
          if (issued) {
            return;
          }
          setShowDeleteConfirm(true);
        },
      },
    ];

    if (canDuplicate) {
      buttons.push({
        id: 'duplicate',
        icon: Copy,
        label: t('common.duplicate'),
        variant: 'secondary',
        contentClassName: 'text-green-600 dark:text-green-400',
        onClick: () => setShowDuplicateDialog(true),
      });
    }

    if (canCreditNote) {
      buttons.push({
        id: 'credit-note',
        icon: FileMinus,
        label: t('invoices.createCreditNote', { defaultValue: 'Create credit note' }),
        variant: 'secondary',
        contentClassName: 'text-amber-700 dark:text-amber-400',
        disabled: isCreatingCreditNote,
        onClick: () => setShowCreditNoteConfirm(true),
      });
    }

    return buttons;
  }, [canCreditNote, canDuplicate, invoice, isCreatingCreditNote, issued, openInvoiceForEdit, t]);

  const exportActions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'export-pdf',
        icon: Download,
        label: isDownloadingPDF
          ? t('invoices.generatingPdf', { defaultValue: 'Generating PDF…' })
          : t('invoices.downloadPdf', { defaultValue: 'Download PDF' }),
        variant: 'successSoft',
        disabled: isDownloadingPDF,
        onClick: () => void handleDownloadPDF(),
      },
    ];

    if (canSendEmail) {
      buttons.push({
        id: 'email-invoice',
        icon: Mail,
        label:
          isPreparingEmail || isCreatingInvoiceShare
            ? t('common.creating')
            : t('invoices.emailInvoice', { defaultValue: 'Email invoice' }),
        variant: 'soft',
        disabled: isPreparingEmail || isCreatingInvoiceShare,
        onClick: () => void handleEmailInvoice(),
      });
    }

    buttons.push(
      hasActiveShare
        ? {
            id: 'view-share',
            icon: ExternalLink,
            label: t('invoices.viewShare'),
            variant: 'soft',
            onClick: () => {
              if (!invoiceShare) {
                return;
              }
              window.open(
                buildInvoiceShareUrl(invoiceShare.shareToken),
                '_blank',
                'noopener,noreferrer',
              );
            },
          }
        : {
            id: 'share',
            icon: Share,
            label: isCreatingInvoiceShare ? t('common.creating') : t('invoices.shareInvoice'),
            variant: 'soft',
            disabled: isCreatingInvoiceShare,
            onClick: () => void openInvoiceShareForItem(invoice),
          },
    );

    return buttons;
  }, [
    canSendEmail,
    contacts,
    ensureInvoiceShareForItem,
    hasActiveShare,
    invoice,
    invoiceShare,
    isCreatingInvoiceShare,
    isDownloadingPDF,
    isPreparingEmail,
    openInvoiceShareForItem,
    t,
  ]);

  const entityLabel = formatDisplayNumber('invoices', invoice.invoiceNumber || invoice.id);

  return (
    <DetailHeaderMenus
      leading={leading}
      actions={actions}
      exportActions={exportActions}
      actionsLabel={t('common.headerActions')}
      exportLabel={t('common.headerExport')}
      beforeActions={
        canIssue ? (
          <RoundIconLabelButton
            type="button"
            icon={Stamp}
            label={issueLabel}
            variant="successSoft"
            alwaysExpanded
            onClick={() => handleStatusChange(invoice, 'sent')}
          />
        ) : null
      }
    >
      {issued ? (
        <p className="sr-only" id="invoice-issued-lock-hint">
          {issuedLockHint}
        </p>
      ) : null}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title={t('invoices.deleteTitle')}
        message={getDeleteMessage(invoice)}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        onConfirm={async () => {
          setShowDeleteConfirm(false);
          await deleteInvoice(invoice.id);
          closeInvoicesPanel();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showCreditNoteConfirm}
        title={t('invoices.createCreditNoteTitle', { defaultValue: 'Create credit note?' })}
        message={t('invoices.createCreditNoteConfirm', {
          number: entityLabel,
          defaultValue:
            'Creates a draft credit note linked to invoice {{number}}. You must describe what changed before issuing.',
        })}
        confirmText={t('invoices.createCreditNote', { defaultValue: 'Create credit note' })}
        cancelText={t('common.cancel')}
        onConfirm={() => {
          setShowCreditNoteConfirm(false);
          setIsCreatingCreditNote(true);
          void createCreditNoteFromInvoice(invoice).finally(() => setIsCreatingCreditNote(false));
        }}
        onCancel={() => setShowCreditNoteConfirm(false)}
      />

      <DuplicateDialog
        isOpen={showDuplicateDialog}
        onConfirm={(newName) => {
          executeDuplicate(invoice, newName)
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
        defaultName={duplicateConfig?.defaultName ?? ''}
        nameLabel={duplicateConfig?.nameLabel ?? t('nav.invoice')}
        confirmOnly={Boolean(duplicateConfig?.confirmOnly)}
      />

      <InvoiceShareModals entityLabel={entityLabel} />

      <BulkEmailDialog
        isOpen={showSendEmailDialog}
        onClose={closeSendEmailDialog}
        recipients={sendEmailRecipients}
        pluginSource="invoices"
        additionalText={
          emailShareUrl ? formatInvoiceShareEmailText(emailShareUrl, shareLinkLabel) : undefined
        }
        additionalHtml={
          emailShareUrl ? formatInvoiceShareEmailHtml(emailShareUrl, shareLinkLabel) : undefined
        }
        additionalPreview={
          emailShareUrl ? (
            <div className="text-xs text-muted-foreground space-y-1">
              <div>
                <span className="font-medium">{shareLinkLabel}:</span>
              </div>
              <div className="break-all font-mono">{emailShareUrl}</div>
            </div>
          ) : undefined
        }
      />

      <InvoiceStatusModal
        isOpen={showStatusModal}
        status={pendingStatus || ''}
        invoiceNumber={pendingInvoice?.invoiceNumber || invoice.invoiceNumber || ''}
        isIssuing={(pendingInvoice?.status || invoice.status || 'draft') === 'draft'}
        onConfirm={handleModalConfirm}
        onClose={handleModalCancel}
      />
    </DetailHeaderMenus>
  );
}
