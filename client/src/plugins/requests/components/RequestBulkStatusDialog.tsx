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

import type { RequestPayload } from '../api/requestsApi';
import type { Request, RequestStatus } from '../types/requests';
import { REQUEST_STATUSES, formatRequestStatusForDisplay } from '../types/requests';
import { buildRequestListStatusSavePayload } from '../utils/requestListSave';

type Phase = 'idle' | 'applying' | 'done';

export interface RequestBulkStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedRequests: Request[];
  saveRequest: (data: RequestPayload, requestId?: string) => Promise<boolean>;
  onSuccess?: () => void;
}

export function RequestBulkStatusDialog({
  isOpen,
  onClose,
  selectedRequests,
  saveRequest,
  onSuccess,
}: RequestBulkStatusDialogProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<RequestStatus>('not started');
  const [phase, setPhase] = useState<Phase>('idle');
  const [updatedCount, setUpdatedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setStatus('not started');
    setPhase('idle');
    setUpdatedCount(0);
    setFailedCount(0);
  }, [isOpen]);

  const handleApply = useCallback(async () => {
    if (selectedRequests.length === 0) {
      return;
    }

    setPhase('applying');
    setUpdatedCount(0);
    setFailedCount(0);

    let updated = 0;
    let failed = 0;
    for (const request of selectedRequests) {
      try {
        const ok = await saveRequest(
          buildRequestListStatusSavePayload(request, status),
          request.id,
        );
        if (ok) {
          updated += 1;
        } else {
          failed += 1;
        }
      } catch {
        failed += 1;
      }
      setUpdatedCount(updated);
      setFailedCount(failed);
    }

    setPhase('done');
  }, [saveRequest, selectedRequests, status]);

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

  if (!isOpen) {
    return null;
  }

  const count = selectedRequests.length;

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
              {t('requests.bulkStatusTitle')}
            </DialogHeading>
            <div className={DIALOG_SUBTITLE_CLASS}>
              {t('requests.bulkStatusSubtitle', { count })}
            </div>
          </div>

          <div className={DIALOG_BODY_SCROLL_CLASS}>
            {phase === 'idle' && (
              <div className="space-y-2">
                <label
                  htmlFor="requests-bulk-status"
                  className="text-sm font-medium text-foreground"
                >
                  {t('requests.form.status')}
                </label>
                <NativeSelect
                  id="requests-bulk-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RequestStatus)}
                >
                  {REQUEST_STATUSES.map((option) => (
                    <option key={option} value={option}>
                      {formatRequestStatusForDisplay(option, t)}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}

            {phase === 'applying' && (
              <p className="text-sm text-muted-foreground">
                {t('requests.bulkStatusApplying', {
                  current: updatedCount + failedCount,
                  total: count,
                })}
              </p>
            )}

            {phase === 'done' && (
              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{t('requests.bulkStatusDone')}</p>
                <p
                  className={
                    failedCount === 0
                      ? 'font-medium text-green-600 dark:text-green-400'
                      : updatedCount === 0
                        ? 'font-medium text-red-600 dark:text-red-400'
                        : 'font-medium text-yellow-600 dark:text-yellow-500'
                  }
                >
                  {t('requests.bulkStatusResult', {
                    updated: updatedCount,
                    failed: failedCount,
                  })}
                </p>
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
                      ? t('requests.bulkStatusApplyingShort')
                      : t('requests.bulkStatusApply')
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
