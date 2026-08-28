import { Copy, Check, ExternalLink, Unlink } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RoundIconLabelButton } from '@/components/ui/round-icon-label-button';
import { formatDisplayNumber } from '@/core/utils/displayNumber';
import { ShareDialog } from '@/plugins/estimates/components/ShareDialog';

import { garmentShareApi } from '../api/garmentsApi';
import { useGarments } from '../hooks/useGarments';
import type { GarmentList } from '../types/garments';

export function GarmentShareBlock({ list }: { list: GarmentList }) {
  const { t } = useTranslation();
  const {
    garmentShareExistingShare,
    garmentShareShowDialog,
    setGarmentShareShowDialog,
    handleGarmentCopyShareUrl,
    handleGarmentRevokeShare,
  } = useGarments();

  const [copied, setCopied] = useState(false);

  const shareUrl = garmentShareExistingShare
    ? garmentShareApi.generateShareUrl(garmentShareExistingShare.shareToken)
    : '';
  const isShareExpired = garmentShareExistingShare
    ? new Date(garmentShareExistingShare.validUntil) <= new Date()
    : false;

  const handleCopy = () => {
    handleGarmentCopyShareUrl();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const entityLabel = (list.name || '').trim() || formatDisplayNumber('garments', list.id);

  return (
    <>
      {garmentShareExistingShare && (
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
            {isShareExpired ? t('garments.shareExpired') : t('garments.shareActive')}
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
                  label={copied ? t('garments.copied') : t('garments.copy')}
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
              {isShareExpired ? t('garments.expiredOn') : t('garments.expiresOn')}{' '}
              {new Date(garmentShareExistingShare.validUntil).toLocaleDateString()}
              {garmentShareExistingShare.accessedCount > 0 && (
                <span className="ml-2">
                  •{' '}
                  {t('garments.accessedTimes', {
                    count: garmentShareExistingShare.accessedCount,
                  })}
                </span>
              )}
            </div>
            <RoundIconLabelButton
              type="button"
              icon={Unlink}
              label={t('garments.revoke')}
              variant="dangerSoft"
              alwaysExpanded
              onClick={() => void handleGarmentRevokeShare()}
            />
          </div>
        </div>
      )}

      <ShareDialog
        isOpen={garmentShareShowDialog}
        onClose={() => setGarmentShareShowDialog(false)}
        shareUrl={shareUrl}
        entityLabel={entityLabel}
        variant="garment"
        title={t('garments.shareDialogTitle')}
      />
    </>
  );
}
