import { Copy, Check, ExternalLink, Unlink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { estimateShareApi } from '../api/estimatesApi';
import { useEstimates } from '../hooks/useEstimates';
import type { Estimate } from '../types/estimate';

import { ShareDialog } from './ShareDialog';

/** Renders share URL box + ShareDialog + Expired modal. Actions (Share, Download PDF) live in panel footer. */
export function EstimateShareBlock({ estimate }: { estimate: Estimate }) {
  const { t } = useTranslation();
  const {
    estimateShareExistingShare,
    estimateShareShowDialog,
    setEstimateShareShowDialog,
    estimateShareShowExpiredModal,
    setEstimateShareShowExpiredModal,
    handleEstimateCopyShareUrl,
    handleEstimateRevokeShare,
  } = useEstimates();

  const [copied, setCopied] = useState(false);

  const shareUrl = estimateShareExistingShare
    ? estimateShareApi.generateShareUrl(estimateShareExistingShare.shareToken)
    : '';
  const isShareExpired = estimateShareExistingShare
    ? new Date(estimateShareExistingShare.validUntil) <= new Date()
    : false;

  const handleCopy = () => {
    handleEstimateCopyShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {estimateShareExistingShare && (
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
                  onClick={() => shareUrl && window.open(shareUrl, '_blank', 'noopener,noreferrer')}
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
              {new Date(estimateShareExistingShare.validUntil).toLocaleDateString()}
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
              onClick={handleEstimateRevokeShare}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={estimateShareShowExpiredModal}
        title="Cannot create share link"
        message={`Estimate ${formatDisplayNumber('estimates', estimate.estimateNumber)} expired on ${new Date(estimate.validTo).toLocaleDateString()}. Share links can only be created for estimates that are still valid. Update the "Valid To" date in edit mode to create a share link.`}
        confirmText="Got it"
        cancelText="Close"
        onConfirm={() => setEstimateShareShowExpiredModal(false)}
        onCancel={() => setEstimateShareShowExpiredModal(false)}
        variant="warning"
      />

      <ShareDialog
        isOpen={estimateShareShowDialog}
        onClose={() => setEstimateShareShowDialog(false)}
        shareUrl={shareUrl}
        entityLabel={formatDisplayNumber('estimates', estimate.estimateNumber)}
        variant="estimate"
      />
    </>
  );
}
