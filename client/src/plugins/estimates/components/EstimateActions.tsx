import { Copy, Check, ExternalLink } from 'lucide-react';
import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/core/ui/ConfirmDialog';
import { formatDisplayNumber } from '@/core/utils/displayNumber';

import { estimateShareApi } from '../api/estimatesApi';
import { useEstimates } from '../hooks/useEstimates';
import type { Estimate } from '../types/estimate';

import { ShareDialog } from './ShareDialog';

/** Renders share URL box + ShareDialog + Expired modal. Actions (Share, Download PDF) live in panel footer. */
export function EstimateShareBlock({ estimate }: { estimate: Estimate }) {
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
          className={`mt-4 p-4 rounded-lg border ${
            isShareExpired
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
              : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
          }`}
        >
          <div
            className={`text-sm font-medium mb-2 ${
              isShareExpired ? 'text-red-900 dark:text-red-400' : 'text-blue-900 dark:text-blue-400'
            }`}
          >
            {isShareExpired ? 'Share Link Expired' : 'Active Share Link'}
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-sm font-mono break-all text-gray-900 dark:text-gray-100">
              {shareUrl}
            </div>
            {!isShareExpired && (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={copied ? Check : Copy}
                  onClick={handleCopy}
                  className={`h-9 text-xs px-3 ${
                    copied
                      ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                      : ''
                  }`}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ExternalLink}
                  onClick={() => shareUrl && window.open(shareUrl, '_blank', 'noopener,noreferrer')}
                  className="h-9 text-xs px-3"
                >
                  View
                </Button>
              </div>
            )}
          </div>

          <div
            className={`text-xs ${isShareExpired ? 'text-red-700 dark:text-red-400' : 'text-blue-700 dark:text-blue-400'}`}
          >
            <div className="flex items-center justify-left">
              <div>
                {isShareExpired ? 'Expired on' : 'Expires on'}{' '}
                {new Date(estimateShareExistingShare.validUntil).toLocaleDateString()}
                {estimateShareExistingShare.accessedCount > 0 && (
                  <span className="ml-2">
                    • Accessed {estimateShareExistingShare.accessedCount} times
                  </span>
                )}
              </div>
              <Button
                variant="link"
                size="sm"
                onClick={handleEstimateRevokeShare}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 h-auto p-0 underline decoration-red-600/30 font-normal ml-4"
              >
                Revoke
              </Button>
            </div>
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
        estimateNumber={formatDisplayNumber('estimates', estimate.estimateNumber)}
      />
    </>
  );
}
