import { Check, Copy, ExternalLink, Unlink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';

import { useInvoices } from '../hooks/useInvoices';

/** Active link panel for the main content column (mirrors NoteShareBlock / TaskShareBlock). */
export function InvoiceShareBlock() {
  const { t, i18n } = useTranslation();
  const { invoiceShare, handleCopyInvoiceShareUrl, handleRevokeInvoiceShare } = useInvoices();
  const [copied, setCopied] = useState(false);

  if (!invoiceShare) {
    return null;
  }

  const shareUrl = `${window.location.origin}/public/invoice/${invoiceShare.shareToken}`;
  const isShareExpired = new Date(invoiceShare.validUntil) <= new Date();
  const validUntilLabel = new Date(invoiceShare.validUntil).toLocaleDateString(i18n.language);

  const handleCopy = () => {
    handleCopyInvoiceShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 break-all rounded border border-gray-200 bg-white p-2 font-mono text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {shareUrl}
        </div>
        {!isShareExpired && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
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
