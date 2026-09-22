import { Check, Copy, Download, ExternalLink, Unlink } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { formatDate } from '@/core/utils/dateFormat';

import { estimateShareApi, estimatesApi } from '../api/estimatesApi';
import { useEstimates } from '../hooks/useEstimates';
import type { Estimate } from '../types/estimate';

/** Active share link panel (mirrors TaskShareBlock / InvoiceShareBlock). ShareDialog lives in header Export. */
export function EstimateShareBlock({ estimate }: { estimate: Estimate }) {
  const { t } = useTranslation();
  const {
    estimateShareExistingShare,
    syncEstimateShareForEstimate,
    handleEstimateCopyShareUrl,
    handleEstimateRevokeShare,
  } = useEstimates();

  const [copied, setCopied] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  useEffect(() => {
    void syncEstimateShareForEstimate(estimate.id);
  }, [estimate.id, syncEstimateShareForEstimate]);

  const shareMatchesEstimate =
    estimateShareExistingShare != null &&
    String(estimateShareExistingShare.estimateId) === String(estimate.id);

  const shareUrl = shareMatchesEstimate
    ? estimateShareApi.generateShareUrl(estimateShareExistingShare.shareToken)
    : '';
  const isShareExpired = shareMatchesEstimate
    ? new Date(estimateShareExistingShare.validUntil) <= new Date()
    : false;
  const validUntilLabel = shareMatchesEstimate
    ? formatDate(estimateShareExistingShare.validUntil) || '—'
    : '—';

  const handleCopy = () => {
    handleEstimateCopyShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!estimate.id || isDownloadingPdf) {
      return;
    }
    setIsDownloadingPdf(true);
    try {
      await estimatesApi.downloadPDF(estimate.id);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert(
        error instanceof Error
          ? error.message
          : t('estimates.pdfDownloadFailed', {
              defaultValue: 'Failed to download PDF. Please try again.',
            }),
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!shareMatchesEstimate || !estimateShareExistingShare) {
    return null;
  }

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
        {isShareExpired
          ? t('estimates.shareExpired', { defaultValue: 'Share Link Expired' })
          : t('estimates.shareActive', { defaultValue: 'Active Share Link' })}
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
              onClick={() => shareUrl && window.open(shareUrl, '_blank', 'noopener,noreferrer')}
            />
            <RoundIconLabelButton
              type="button"
              icon={Download}
              label={
                isDownloadingPdf
                  ? t('estimates.generatingPdf', { defaultValue: 'Generating PDF…' })
                  : t('estimates.downloadPdf', { defaultValue: 'Download PDF' })
              }
              variant="successSoft"
              alwaysExpanded
              disabled={isDownloadingPdf || !estimate.id}
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
          {isShareExpired
            ? t('estimates.expiredOn', { defaultValue: 'Expired on' })
            : t('estimates.expiresOn', { defaultValue: 'Expires on' })}{' '}
          {validUntilLabel}
          {estimateShareExistingShare.accessedCount > 0 && (
            <span className="ml-2">
              •{' '}
              {t('estimates.accessedCount', {
                defaultValue: 'Accessed {{count}} times',
                count: estimateShareExistingShare.accessedCount,
              })}
            </span>
          )}
        </div>
        <RoundIconLabelButton
          type="button"
          icon={Unlink}
          label={t('estimates.revokeShare', { defaultValue: 'Revoke' })}
          variant="dangerSoft"
          alwaysExpanded
          onClick={() => void handleEstimateRevokeShare()}
        />
      </div>
    </div>
  );
}
