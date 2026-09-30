import { CircleDot } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NativeSelect } from '@/components/ui/select';
import {
  DIALOG_BODY_SCROLL_CLASS,
  DIALOG_FOOTER_SPLIT_CLASS,
  DIALOG_HEADER_CLASS,
  DIALOG_SUBTITLE_CLASS,
} from '@/core/ui/dialogStyles';
import {
  DialogCancelButton,
  DialogCloseButton,
  DialogSaveButton,
} from '@/core/ui/DialogRoundButtons';
import { DialogHeading } from '@/core/ui/DialogHeading';

import type { PublicationStatus } from '../types/clubdesk';

type Phase = 'idle' | 'applying' | 'done';

export interface InventoryBulkStatusResult {
  changed: number;
  skipped: number;
  failed: number;
}

export interface InventoryBulkStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCount: number;
  onApply: (
    status: PublicationStatus,
    onProgress: (done: number) => void,
  ) => Promise<InventoryBulkStatusResult>;
}

export function InventoryBulkStatusDialog({
  isOpen,
  onClose,
  selectedCount,
  onApply,
}: InventoryBulkStatusDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<PublicationStatus>('published');
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<InventoryBulkStatusResult | null>(null);
  const [applyCount, setApplyCount] = useState(selectedCount);

  const handleClose = useCallback(() => {
    if (phase === 'applying') {
      return;
    }
    setPhase('idle');
    setProgress(0);
    setResult(null);
    setStatus('published');
    onClose();
  }, [onClose, phase]);

  const handleApply = useCallback(async () => {
    setApplyCount(selectedCount);
    setPhase('applying');
    setProgress(0);
    const next = await onApply(status, setProgress);
    setResult(next);
    setProgress(selectedCount);
    setPhase('done');
  }, [onApply, selectedCount, status]);

  if (!isOpen) {
    return null;
  }

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
              <CircleDot className="h-5 w-5 text-muted-foreground" />
              {t('clubdesk.inventory.bulkStatusTitle')}
            </DialogHeading>
            <div className={DIALOG_SUBTITLE_CLASS}>
              {t('clubdesk.inventory.bulkStatusSubtitle', {
                count: phase === 'idle' ? selectedCount : applyCount,
              })}
            </div>
          </div>

          <div className={DIALOG_BODY_SCROLL_CLASS}>
            {phase === 'idle' ? (
              <div className="space-y-2">
                <label
                  htmlFor="clubdesk-inventory-bulk-status"
                  className="text-sm font-medium text-foreground"
                >
                  {t('clubdesk.inventory.bulkStatusLabel')}
                </label>
                <NativeSelect
                  id="clubdesk-inventory-bulk-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as PublicationStatus)}
                >
                  <option value="published">{t('clubdesk.status.published')}</option>
                  <option value="draft">{t('clubdesk.status.draft')}</option>
                </NativeSelect>
              </div>
            ) : null}

            {phase === 'applying' ? (
              <p className="text-sm text-muted-foreground">
                {t('clubdesk.inventory.bulkStatusApplying', {
                  current: progress,
                  total: applyCount,
                })}
              </p>
            ) : null}

            {phase === 'done' && result ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">
                  {t('clubdesk.inventory.bulkStatusDone')}
                </p>
                <p
                  className={
                    result.failed === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : result.changed === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('clubdesk.inventory.bulkStatusResult', {
                    changed: result.changed,
                    skipped: result.skipped,
                    failed: result.failed,
                  })}
                </p>
              </div>
            ) : null}
          </div>

          <div className={DIALOG_FOOTER_SPLIT_CLASS}>
            {phase === 'done' ? (
              <div className="flex w-full justify-end">
                <DialogCloseButton onClick={handleClose} />
              </div>
            ) : (
              <div className="flex w-full items-center justify-end gap-2">
                <DialogCancelButton onClick={handleClose} disabled={phase === 'applying'} />
                <DialogSaveButton
                  onClick={() => void handleApply()}
                  disabled={phase === 'applying' || selectedCount === 0}
                  label={
                    phase === 'applying'
                      ? t('clubdesk.inventory.bulkStatusApplyingShort')
                      : t('clubdesk.inventory.bulkStatusApply')
                  }
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
