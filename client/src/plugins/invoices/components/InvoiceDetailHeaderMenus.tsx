import { Copy, Download, Edit, ExternalLink, FileMinus, Share, Trash2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { DetailHeaderMenus, type DetailHeaderMenuAction } from '@/core/ui/DetailHeaderMenus';
import { DuplicateDialog } from '@/core/ui/DuplicateDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { invoicesApi } from '../api/invoicesApi';
import type { Invoice } from '../context/InvoicesContext';
import { useInvoices } from '../hooks/useInvoices';
import { canCreateCreditNoteFromInvoice } from '../utils/buildCreditNoteFromInvoice';

import { InvoiceShareModals } from './InvoiceShareModals';

export function InvoiceDetailHeaderMenus({
  invoice,
  leading,
}: {
  invoice: Invoice;
  /** Optional leading content on the Actions/Export trigger row (e.g. invoice number). */
  leading?: React.ReactNode;
}) {
  const { t } = useTranslation();
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
    openCreateInvoiceShare,
    openInvoiceShareDialog,
  } = useInvoices();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [showCreditNoteConfirm, setShowCreditNoteConfirm] = useState(false);
  const [isCreatingCreditNote, setIsCreatingCreditNote] = useState(false);
  const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);

  const duplicateConfig = getDuplicateConfig(invoice);
  const canDuplicate = Boolean(duplicateConfig);
  const canCreditNote = canCreateCreditNoteFromInvoice(invoice);
  const hasActiveShare = Boolean(invoiceShare && new Date(invoiceShare.validUntil) > new Date());

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

  const actions = useMemo((): DetailHeaderMenuAction[] => {
    const buttons: DetailHeaderMenuAction[] = [
      {
        id: 'edit',
        icon: Edit,
        label: t('common.edit'),
        variant: 'soft',
        onClick: () => openInvoiceForEdit(invoice),
      },
      {
        id: 'delete',
        icon: Trash2,
        label: t('common.delete'),
        variant: 'secondary',
        contentClassName: 'text-red-600 dark:text-red-400',
        onClick: () => setShowDeleteConfirm(true),
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
  }, [canCreditNote, canDuplicate, invoice, isCreatingCreditNote, openInvoiceForEdit, t]);

  const exportActions = useMemo((): DetailHeaderMenuAction[] => {
    return [
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
      hasActiveShare
        ? {
            id: 'view-share',
            icon: ExternalLink,
            label: t('invoices.viewShare'),
            variant: 'soft',
            onClick: openInvoiceShareDialog,
          }
        : {
            id: 'share',
            icon: Share,
            label: isCreatingInvoiceShare ? t('common.creating') : t('invoices.shareInvoice'),
            variant: 'soft',
            disabled: isCreatingInvoiceShare,
            onClick: openCreateInvoiceShare,
          },
    ];
  }, [
    hasActiveShare,
    isCreatingInvoiceShare,
    isDownloadingPDF,
    openCreateInvoiceShare,
    openInvoiceShareDialog,
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
    >
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
            'Create a draft credit note from invoice {{number}}? Line amounts stay positive; document type will be Credit note.',
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
    </DetailHeaderMenus>
  );
}
