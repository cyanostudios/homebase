import { SlidersHorizontal } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NativeSelect } from '@/components/ui/select';
import {
  DialogCancelButton,
  DialogCloseButton,
  DialogSaveButton,
} from '@/core/ui/DialogRoundButtons';
import {
  DIALOG_BODY_SCROLL_CLASS,
  DIALOG_FOOTER_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_SUBTITLE_CLASS,
} from '@/core/ui/dialogStyles';
import { DialogHeading } from '@/core/ui/DialogHeading';

import { guidesApi } from '../api/guidesApi';
import { type Guide, type GuideLifecycleStatus, GUIDE_LIFECYCLE_STATUSES } from '../types/guides';

type Phase = 'idle' | 'applying' | 'done';

export interface BulkStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedGuides: Guide[];
  onSuccess?: () => void;
}

export function BulkStatusDialog({
  isOpen,
  onClose,
  selectedGuides,
  onSuccess,
}: BulkStatusDialogProps) {
  const { t } = useTranslation();
  const [lifecycleStatus, setLifecycleStatus] = useState<GuideLifecycleStatus>('draft');
  const [phase, setPhase] = useState<Phase>('idle');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    setLifecycleStatus('draft');
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
  }, [isOpen]);

  const handleApply = useCallback(async () => {
    if (selectedGuides.length === 0) return;

    setPhase('applying');
    setUpdatedCount(0);
    setFailedCount(0);

    let updated = 0;
    let failed = 0;
    for (const guide of selectedGuides) {
      try {
        await guidesApi.updateGuide(guide.id, {
          displayName: guide.displayName,
          shortIntro: guide.shortIntro,
          geographicReference: guide.geographicReference,
          place: guide.place ?? null,
          lifecycleStatus,
          sourceLanguage: guide.sourceLanguage,
          masterGuideEditorialStatus: guide.masterGuideEditorialStatus,
        });
        updated += 1;
      } catch {
        failed += 1;
      }
      setUpdatedCount(updated);
      setFailedCount(failed);
    }

    setPhase('done');
  }, [lifecycleStatus, selectedGuides]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
    onClose();
  }, [onClose]);

  const handleDoneClose = useCallback(() => {
    onSuccess?.();
    handleClose();
  }, [handleClose, onSuccess]);

  if (!isOpen) return null;

  const count = selectedGuides.length;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={phase === 'applying' ? undefined : handleClose}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 flex w-[92vw] max-w-lg max-h-[90vh] -translate-x-1/2 -translate-y-1/2 flex-col">
        <div className="flex max-h-full flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
          <div className={DIALOG_HEADER_CLASS}>
            <DialogHeading className="mb-0 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
              {t('guides.bulkStatusTitle')}
            </DialogHeading>
            <div className={DIALOG_SUBTITLE_CLASS}>{t('guides.bulkStatusSubtitle', { count })}</div>
          </div>

          <div className={DIALOG_BODY_SCROLL_CLASS}>
            {phase === 'idle' && (
              <div className="space-y-2">
                <label
                  htmlFor="guides-bulk-lifecycle"
                  className="text-sm font-medium text-foreground"
                >
                  {t('guides.lifecycleStatus')}
                </label>
                <NativeSelect
                  id="guides-bulk-lifecycle"
                  value={lifecycleStatus}
                  onChange={(e) => setLifecycleStatus(e.target.value as GuideLifecycleStatus)}
                >
                  {GUIDE_LIFECYCLE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {t(`guides.lifecycle.${status}`)}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{t('guides.lifecycleActiveHint')}</p>
              </div>
            )}

            {phase === 'applying' && (
              <p className="text-sm text-muted-foreground">
                {t('guides.bulkStatusApplying', {
                  current: updatedCount + failedCount,
                  total: count,
                })}
              </p>
            )}

            {phase === 'done' && (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{t('guides.bulkStatusDone')}</p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : updatedCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('guides.bulkStatusResult', {
                    updated: updatedCount,
                    failed: failedCount,
                  })}
                </p>
                {failedCount > 0 && lifecycleStatus === 'active' && (
                  <p className="text-xs text-muted-foreground">
                    {t('guides.lifecycleActiveRequiresPublished')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className={DIALOG_FOOTER_CLASS}>
            {phase === 'done' ? (
              <DialogCloseButton onClick={handleDoneClose} />
            ) : (
              <>
                <DialogCancelButton onClick={handleClose} disabled={phase === 'applying'} />
                <DialogSaveButton
                  onClick={() => void handleApply()}
                  disabled={phase === 'applying' || count === 0}
                  label={
                    phase === 'applying'
                      ? t('guides.bulkStatusApplyingShort')
                      : t('guides.bulkStatusApply')
                  }
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
