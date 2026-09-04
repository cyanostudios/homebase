import { Check, Copy, Download, ExternalLink, Unlink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { formatDate } from '@/core/utils/dateFormat';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { invoicesApi } from '../api/invoicesApi';
import { useInvoices } from '../hooks/useInvoices';

/** Active link panel for the main content column (mirrors NoteShareBlock / TaskShareBlock). */
export function InvoiceShareBlock() {
  const { t } = useTranslation();
  const { currentInvoice, invoiceShare, handleCopyInvoiceShareUrl, handleRevokeInvoiceShare } =
    useInvoices();
  const [copied, setCopied] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  if (!invoiceShare) {
    return null;
  }

  const shareUrl = `${window.location.origin}/public/invoice/${invoiceShare.shareToken}`;
  const isShareExpired = new Date(invoiceShare.validUntil) <= new Date();
  const validUntilLabel = formatDate(invoiceShare.validUntil) || '—';

  const handleCopy = () => {
    handleCopyInvoiceShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!currentInvoice?.id || isDownloadingPdf) {
      return;
    }
    setIsDownloadingPdf(true);
    try {
      const blob = await invoicesApi.downloadPdf(currentInvoice.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${formatDisplayNumber(
        'invoices',
        currentInvoice.invoiceNumber || currentInvoice.id,
      )}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert(
        error instanceof Error
          ? error.message
          : t('invoices.pdfDownloadFailed', {
              defaultValue: 'Failed to download PDF. Please try again.',
            }),
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div
      className={`rounded-lg border p-4 ${
        isShareExpired
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
          : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30'
      }`}
    >
      <div
        className={`mb-2 text-sm font-medium ${
          isShareExpired ? 'text-red-900 dark:text-red-400' : 'text-blue-900 dark:text-blue-400'
        }`}
      >
        {isShareExpired ? t('invoices.shareExpired') : t('invoices.shareActive')}
      </div>

      <div className="mb-3 flex flex-col gap-3">
        <div className="min-w-0 break-all rounded border border-gray-200 bg-white p-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {shareUrl}
        </div>
        {!isShareExpired && (
          <div className="flex flex-wrap items-center gap-2">
            <RoundIconLabelButton
              type="button"
              icon={copied ? Check : Copy}
              label={copied ? t('common.copied') : t('common.copy')}
              variant={copied ? 'success' : 'soft'}
              alwaysExpanded
              onClick={handleCopy}
            />
            <RoundIconLabelButton
              type="button"
              icon={ExternalLink}
              label={t('common.view')}
              variant="soft"
              alwaysExpanded
              onClick={() => window.open(shareUrl, '_blank', 'noopener,noreferrer')}
            />
            <RoundIconLabelButton
              type="button"
              icon={Download}
              label={
                isDownloadingPdf
                  ? t('invoices.generatingPdf', { defaultValue: 'Generating PDF…' })
                  : t('invoices.downloadPdf', { defaultValue: 'Download PDF' })
              }
              variant="successSoft"
              alwaysExpanded
              disabled={isDownloadingPdf || !currentInvoice?.id}
              onClick={() => void handleDownloadPdf()}
            />
          </div>
        )}
      </div>

      <div
        className={`flex flex-wrap items-center gap-3 text-xs ${
          isShareExpired ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'
        }`}
      >
        <div>
          {isShareExpired ? t('invoices.expiredOn') : t('invoices.expiresOn')} {validUntilLabel}
          {invoiceShare.accessedCount > 0 && (
            <span className="ml-2">
              • {t('invoices.accessedCount', { count: invoiceShare.accessedCount })}
            </span>
          )}
        </div>
        <RoundIconLabelButton
          type="button"
          icon={Unlink}
          label={t('invoices.revokeShare')}
          variant="dangerSoft"
          alwaysExpanded
          onClick={() => void handleRevokeInvoiceShare()}
        />
      </div>
    </div>
  );
}
